import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from pydantic import ValidationError

from app.core.auth import TokenVerifier
from app.core.config import Settings
from app.core.errors import AppError
from app.security.interface import ExternalSecurityVerifier


def settings(**kwargs):
    return Settings(
        _env_file=None,
        database_url="postgresql+asyncpg://user@localhost/fairdrop_test",
        supabase_url="https://test.supabase.co",
        **kwargs,
    )


def claims(**overrides):
    data = {
        "sub": str(uuid4()),
        "iss": "https://test.supabase.co/auth/v1",
        "aud": "authenticated",
        "exp": datetime.now(UTC) + timedelta(minutes=5),
        "role": "authenticated",
    }
    return data | overrides


@pytest.mark.parametrize("algorithm", ["ES256", "RS256"])
async def test_asymmetric_signature_and_claim_validation(algorithm, monkeypatch):
    key = (
        ec.generate_private_key(ec.SECP256R1())
        if algorithm == "ES256"
        else rsa.generate_private_key(public_exponent=65537, key_size=2048)
    )
    jwk_algorithm = (
        jwt.algorithms.ECAlgorithm if algorithm == "ES256" else jwt.algorithms.RSAAlgorithm
    )
    jwk = jwt.PyJWK(
        json.loads(jwk_algorithm.to_jwk(key.public_key()))
        | {
            "kid": "test-key",
            "alg": algorithm,
        }
    )
    async with httpx.AsyncClient() as http:
        verifier = TokenVerifier(settings(), http)
        monkeypatch.setattr(verifier.jwks, "get_signing_key_from_jwt", lambda token: jwk)
        data = claims()
        valid = jwt.encode(data, key, algorithm=algorithm, headers={"kid": "test-key"})
        assert str((await verifier.verify_access_token(valid)).id) == data["sub"]
        for override in (
            {"iss": "https://other.supabase.co/auth/v1"},
            {"aud": "other"},
            {"exp": datetime.now(UTC) - timedelta(seconds=1)},
            {"role": "service_role"},
            {"is_anonymous": True},
            {"sub": "not-a-uuid"},
            {"nbf": datetime.now(UTC) + timedelta(hours=1)},
        ):
            invalid = jwt.encode(data | override, key, algorithm=algorithm)
            with pytest.raises(AppError) as error:
                await verifier.verify_access_token(invalid)
            assert error.value.status == 401
        missing = data.copy()
        del missing["exp"]
        with pytest.raises(AppError):
            await verifier.verify_access_token(jwt.encode(missing, key, algorithm=algorithm))
        other_key = (
            ec.generate_private_key(ec.SECP256R1())
            if algorithm == "ES256"
            else rsa.generate_private_key(public_exponent=65537, key_size=2048)
        )
        with pytest.raises(AppError):
            await verifier.verify_access_token(jwt.encode(data, other_key, algorithm=algorithm))


async def test_jwks_rotation_failure_is_closed(monkeypatch):
    async with httpx.AsyncClient() as http:
        verifier = TokenVerifier(settings(), http)

        def unavailable(token):
            raise jwt.PyJWKClientConnectionError("unavailable")

        monkeypatch.setattr(verifier.jwks, "get_signing_key_from_jwt", unavailable)
        key = ec.generate_private_key(ec.SECP256R1())
        with pytest.raises(AppError) as error:
            await verifier.verify_access_token(jwt.encode(claims(), key, algorithm="ES256"))
        assert error.value.code == "auth_unavailable"


async def test_legacy_verification_uses_auth_server_and_checks_subject():
    data = claims()
    key = "a-test-secret-at-least-32-characters-long"
    token = jwt.encode(data, key, algorithm="HS256")
    seen = []

    def handler(request):
        seen.append(request)
        return httpx.Response(200, json={"id": data["sub"]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        verifier = TokenVerifier(settings(supabase_publishable_key="sb_publishable_test"), http)
        assert str((await verifier.verify_access_token(token)).id) == data["sub"]
        assert seen[0].headers["Authorization"] == f"Bearer {token}"
        assert seen[0].headers["apikey"] == "sb_publishable_test"
        assert str(seen[0].url) == "https://test.supabase.co/auth/v1/user"
        with pytest.raises(AppError):
            await verifier.verify_access_token(
                jwt.encode(data | {"aud": "other"}, key, algorithm="HS256")
            )
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json={"id": str(uuid4())}))
    ) as http:
        with pytest.raises(AppError) as error:
            await TokenVerifier(settings(supabase_publishable_key="key"), http).verify_access_token(
                token
            )
        assert error.value.code == "invalid_token"


@pytest.mark.parametrize("status,expected", [(401, 401), (403, 401), (500, 503)])
async def test_legacy_server_failures(status, expected):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(status))
    ) as http:
        token = jwt.encode(claims(), "test-secret-with-at-least-32-characters", algorithm="HS256")
        with pytest.raises(AppError) as error:
            await TokenVerifier(settings(supabase_publishable_key="key"), http).verify_access_token(
                token
            )
        assert error.value.status == expected


async def test_unsigned_malformed_and_missing_legacy_config():
    async with httpx.AsyncClient() as http:
        verifier = TokenVerifier(settings(), http)
        for token in ("malformed", jwt.encode(claims(), "", algorithm="none")):
            with pytest.raises(AppError) as error:
                await verifier.verify_access_token(token)
            assert error.value.status == 401
        with pytest.raises(AppError) as error:
            await verifier.verify_access_token(
                jwt.encode(claims(), "test-secret-with-at-least-32-characters", algorithm="HS256")
            )
        assert error.value.status == 503


@pytest.mark.parametrize(
    "response",
    [
        {"allowed": "true"},
        {"allowed": True},
        {"allowed": False},
        {"wrong": True},
    ],
)
async def test_security_failures_and_binding(response):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response))
    ) as http:
        verifier = ExternalSecurityVerifier(
            settings(
                security_verification_url="https://security.example/verify",
                security_verification_secret="test-secret",
            ),
            http,
        )
        with pytest.raises(AppError) as error:
            await verifier.verify("token", uuid4(), uuid4())
        assert error.value.code == "security_unavailable"


async def test_external_security_contract_and_explicit_rejection():
    user_id, event_id = uuid4(), uuid4()

    def handler(request):
        assert request.headers["Authorization"] == "Bearer test-secret"
        payload = json.loads(request.content)
        assert payload == {"token": "challenge", "user_id": str(user_id), "event_id": str(event_id)}
        return httpx.Response(
            200,
            json={
                "allowed": False,
                "user_id": str(user_id),
                "event_id": str(event_id),
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        verifier = ExternalSecurityVerifier(
            settings(
                security_verification_url="https://security.example/verify",
                security_verification_secret="test-secret",
            ),
            http,
        )
        result = await verifier.verify("challenge", user_id, event_id)
        assert not result.allowed and result.user_id == user_id
        with pytest.raises(AppError):
            await ExternalSecurityVerifier(settings(), http).verify("token", user_id, event_id)


def test_production_config_rejects_bypass_missing_security_and_plaintext():
    for changes in (
        {"security_allow_development": True},
        {"database_ssl": False},
        {"security_verification_url": None},
        {"security_verification_url": "http://security.example/verify"},
    ):
        with pytest.raises(ValidationError):
            settings(
                **(
                    {
                        "environment": "production",
                        "security_verification_url": "https://security.example/verify",
                        "security_verification_secret": "test-secret",
                    }
                    | changes
                )
            )


def test_secret_redaction():
    config = settings(database_pool_size=3, security_verification_secret="supersecret")
    assert "supersecret" not in repr(config)
