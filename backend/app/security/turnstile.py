from uuid import NAMESPACE_URL, UUID, uuid5

import httpx

from app.core.config import Settings
from app.core.errors import AppError
from app.security.interface import SecurityResult


class TurnstileVerifier:
    """Validate browser tokens with Cloudflare before entering the DB transaction."""

    def __init__(self, settings: Settings, http: httpx.AsyncClient):
        self.settings = settings
        self.http = http

    async def verify(self, token: str, user_id: UUID, event_id: UUID) -> SecurityResult:
        if not token or len(token) > 2048:
            return SecurityResult(False, user_id, event_id)
        if not self.settings.turnstile_secret_key:
            raise AppError(503, "security_unavailable", "Security verification is not configured.")
        try:
            response = await self.http.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                json={
                    "secret": self.settings.turnstile_secret_key.get_secret_value(),
                    "response": token,
                    # Keep retries bound to the same token, authenticated user and event.
                    "idempotency_key": str(
                        uuid5(NAMESPACE_URL, f"fairdrop:{user_id}:{event_id}:{token}")
                    ),
                },
            )
            response.raise_for_status()
            data = response.json()
            if type(data.get("success")) is not bool:
                raise ValueError("Invalid security response")
            allowed = data["success"] and data.get("action") == "register"
            if self.settings.turnstile_expected_hostname:
                allowed = (
                    allowed and data.get("hostname") == self.settings.turnstile_expected_hostname
                )
            return SecurityResult(allowed, user_id, event_id)
        except (httpx.HTTPError, ValueError, TypeError, AttributeError) as exc:
            raise AppError(
                503, "security_unavailable", "Security verification unavailable."
            ) from exc
