from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

import httpx

from app.core.config import Settings
from app.core.errors import AppError


@dataclass(frozen=True)
class SecurityResult:
    allowed: bool
    user_id: UUID
    event_id: UUID


class SecurityVerifier(Protocol):
    async def verify(self, token: str, user_id: UUID, event_id: UUID) -> SecurityResult: ...


class ExternalSecurityVerifier:
    """Server-to-server interface owned by the external security team; fail closed."""

    def __init__(self, settings: Settings, http: httpx.AsyncClient):
        self.settings = settings
        self.http = http

    async def verify(self, token: str, user_id: UUID, event_id: UUID) -> SecurityResult:
        if self.settings.security_allow_development:
            return SecurityResult(True, user_id, event_id)
        if not self.settings.security_verification_url:
            raise AppError(503, "security_unavailable", "Security verification is not configured.")
        try:
            response = await self.http.post(
                self.settings.security_verification_url,
                headers={
                    "Authorization": (
                        f"Bearer {self.settings.security_verification_secret.get_secret_value()}"
                    )
                },
                json={"token": token, "user_id": str(user_id), "event_id": str(event_id)},
            )
            response.raise_for_status()
            data = response.json()
            if (
                type(data.get("allowed")) is not bool
                or data.get("user_id") != str(user_id)
                or data.get("event_id") != str(event_id)
            ):
                raise ValueError("Invalid security response")
            return SecurityResult(data["allowed"], user_id, event_id)
        except (httpx.HTTPError, ValueError, TypeError, AttributeError) as exc:
            raise AppError(
                503, "security_unavailable", "Security verification unavailable."
            ) from exc
