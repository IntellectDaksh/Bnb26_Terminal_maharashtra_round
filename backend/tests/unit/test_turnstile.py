import json
from uuid import UUID, uuid4

import httpx
import pytest

from app.core.config import Settings
from app.core.errors import AppError
from app.security.turnstile import TurnstileVerifier


def settings(**overrides):
    return Settings(
        _env_file=None,
        database_url="postgresql+asyncpg://user@localhost/fairdrop_test",
        supabase_url="https://test.supabase.co",
        turnstile_secret_key="test-server-secret",
        abuse_protection_enabled=True,
        redis_url="redis://localhost:6379/0",
        abuse_key_secret="test-abuse-secret-at-least-32-characters",
        **overrides,
    )


async def test_siteverify_payload_binding_and_retry_identity():
    seen = []

    def handler(request):
        assert str(request.url) == "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        payload = json.loads(request.content)
        assert payload["secret"] == "test-server-secret"
        assert payload["response"] == "challenge"
        UUID(payload["idempotency_key"])
        seen.append(payload["idempotency_key"])
        return httpx.Response(200, json={"success": True, "action": "register"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        # Real verification still runs when the old development bypass is enabled.
        verifier = TurnstileVerifier(settings(security_allow_development=True), http)
        user_id, event_id = uuid4(), uuid4()
        result = await verifier.verify("challenge", user_id, event_id)
        assert result.allowed and result.user_id == user_id and result.event_id == event_id
        await verifier.verify("challenge", user_id, event_id)
        await verifier.verify("challenge", uuid4(), event_id)
        await verifier.verify("challenge", user_id, uuid4())
    assert seen[0] == seen[1]
    assert len(set(seen)) == 3


@pytest.mark.parametrize(
    "payload,allowed",
    [
        ({"success": False, "error-codes": ["timeout-or-duplicate"]}, False),
        ({"success": True, "action": "login", "hostname": "localhost"}, False),
        ({"success": True, "action": "register", "hostname": "other.example"}, False),
        ({"success": True, "action": "register", "hostname": "localhost"}, True),
        ({"success": True}, False),
    ],
)
async def test_cloudflare_rejection_action_and_hostname(payload, allowed):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))
    ) as http:
        result = await TurnstileVerifier(
            settings(turnstile_expected_hostname="localhost"), http
        ).verify("challenge", uuid4(), uuid4())
    assert result.allowed is allowed


@pytest.mark.parametrize("payload", [{}, {"success": "true"}, {"success": 1}, [], None])
async def test_malformed_responses_fail_closed(payload):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))
    ) as http:
        with pytest.raises(AppError) as error:
            await TurnstileVerifier(settings(), http).verify("challenge", uuid4(), uuid4())
    assert error.value.status == 503
    assert error.value.code == "security_unavailable"


@pytest.mark.parametrize("failure", ["timeout", "http", "json"])
async def test_cloudflare_outages_fail_closed(failure):
    def handler(request):
        if failure == "timeout":
            raise httpx.ReadTimeout("Unavailable", request=request)
        return httpx.Response(503 if failure == "http" else 200, text="not json")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        with pytest.raises(AppError) as error:
            await TurnstileVerifier(settings(), http).verify("challenge", uuid4(), uuid4())
    assert error.value.code == "security_unavailable"


@pytest.mark.parametrize("token", ["", "a" * 2049])
async def test_invalid_tokens_do_not_call_cloudflare(token):
    def unexpected_request(request):
        pytest.fail("Invalid token should be rejected locally")

    async with httpx.AsyncClient(transport=httpx.MockTransport(unexpected_request)) as http:
        result = await TurnstileVerifier(settings(), http).verify(token, uuid4(), uuid4())
    assert not result.allowed


def test_turnstile_production_config_and_secret_redaction():
    config = settings(environment="production")
    assert "test-server-secret" not in repr(config)
