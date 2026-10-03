import asyncio
from dataclasses import dataclass
from uuid import UUID

import httpx
import jwt
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import Administrator


@dataclass(frozen=True)
class User:
    id: UUID


class TokenVerifier:
    def __init__(self, settings: Settings, http: httpx.AsyncClient):
        self.settings = settings
        self.http = http
        self.jwks = PyJWKClient(
            f"{settings.auth_issuer}/.well-known/jwks.json", lifespan=300, timeout=5
        )

    async def verify_access_token(self, token: str) -> User:
        try:
            header = jwt.get_unverified_header(token)
            algorithm = header.get("alg")
            if algorithm in ("ES256", "RS256"):
                key = await asyncio.to_thread(self.jwks.get_signing_key_from_jwt, token)
                if key.algorithm_name != algorithm:
                    raise jwt.InvalidAlgorithmError()
                claims = jwt.decode(
                    token,
                    key.key,
                    algorithms=[algorithm],
                    issuer=self.settings.auth_issuer,
                    audience=self.settings.auth_audience,
                    options={"require": ["exp", "iss", "aud", "sub", "role"]},
                )
            elif algorithm == "HS256":
                # Supabase recommends Auth-server verification for legacy shared-secret tokens.
                if not self.settings.supabase_publishable_key:
                    raise AppError(
                        503, "auth_unavailable", "Legacy token verification unavailable."
                    )
                response = await self.http.get(
                    f"{self.settings.auth_issuer}/user",
                    headers={
                        "apikey": self.settings.supabase_publishable_key.get_secret_value(),
                        "Authorization": f"Bearer {token}",
                    },
                )
                if response.status_code in (401, 403):
                    raise jwt.InvalidTokenError()
                if response.status_code != 200:
                    raise AppError(503, "auth_unavailable", "Authentication service unavailable.")
                # Signature verified by Auth above; independently enforce the remaining claims.
                claims = jwt.decode(
                    token,
                    options={
                        "verify_signature": False,
                        "verify_exp": True,
                        "verify_nbf": True,
                        "verify_iat": True,
                        "verify_iss": True,
                        "verify_aud": True,
                        "require": ["exp", "iss", "aud", "sub", "role"],
                    },
                    issuer=self.settings.auth_issuer,
                    audience=self.settings.auth_audience,
                )
                if response.json().get("id") != claims["sub"]:
                    raise jwt.InvalidTokenError()
            else:
                raise jwt.InvalidAlgorithmError()
            if claims["role"] != "authenticated" or claims.get("is_anonymous", False):
                raise jwt.InvalidTokenError()
            return User(UUID(claims["sub"]))
        except jwt.PyJWKClientConnectionError as exc:
            raise AppError(503, "auth_unavailable", "Authentication service unavailable.") from exc
        except (
            jwt.InvalidTokenError,
            jwt.PyJWKClientError,
            ValueError,
            KeyError,
            TypeError,
        ) as exc:
            raise AppError(401, "invalid_token", "A valid access token is required.") from exc
        except httpx.HTTPError as exc:
            raise AppError(503, "auth_unavailable", "Authentication service unavailable.") from exc


async def require_admin(user: User, db: AsyncSession) -> User:
    if (
        await db.scalar(select(Administrator.user_id).where(Administrator.user_id == user.id))
        is None
    ):
        raise AppError(403, "admin_required", "Administrator access is required.")
    return user
