"""Small live Siteverify transport check using Cloudflare's public testing keys.

Does not load application secrets, bypass the register action check, or solve a real widget.
Run explicitly with: python -m loadtest.turnstile_smoke
"""

import asyncio
import json
from pathlib import Path
from uuid import uuid4

import httpx

from app.core.config import Settings
from app.security.turnstile import TurnstileVerifier

OUTPUT = Path(__file__).resolve().parents[2] / "fairdrop/results/turnstile-live-smoke.json"


async def main():
    results = []
    async with httpx.AsyncClient(timeout=10) as http:
        for label, prefix, success in [
            ("pass", "1x", True),
            ("fail", "2x", False),
            ("spent", "3x", False),
        ]:
            secret = prefix + "0000000000000000000000000000000AA"
            response = await http.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                json={"secret": secret, "response": "XXXX.DUMMY.TOKEN.XXXX"},
            )
            response.raise_for_status()
            data = response.json()
            assert data["success"] is success, f"Unexpected {label} response"
            settings = Settings(
                _env_file=None,
                environment="test",
                database_url="postgresql+asyncpg://unused@localhost/unused_test",
                supabase_url="https://test.supabase.co",
                turnstile_secret_key=secret,
            )
            decision = await TurnstileVerifier(settings, http).verify(
                "XXXX.DUMMY.TOKEN.XXXX", uuid4(), uuid4()
            )
            # Official dummy responses may use action 'test'. The production
            # verifier must keep enforcing action 'register', even on success.
            expected = success and data.get("action") == "register"
            assert decision.allowed is expected
            results.append(
                {
                    "case": label,
                    "siteverify_success": data["success"],
                    "action": data.get("action"),
                    "backend_allowed": decision.allowed,
                    "error_codes": data.get("error-codes", []),
                }
            )
    await asyncio.to_thread(
        OUTPUT.write_text,
        json.dumps(
            {
                "scope": "Real Cloudflare Siteverify; official dummy keys; no real widget solving",
                "documentation": "https://developers.cloudflare.com/turnstile/troubleshooting/testing/",
                "results": results,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(OUTPUT)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
