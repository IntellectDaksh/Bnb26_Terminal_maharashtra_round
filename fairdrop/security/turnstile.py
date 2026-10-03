"""Cloudflare Turnstile server-side verification. Fails closed."""
import hashlib, hmac, os, secrets
import httpx

URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
SECRET = os.environ["TURNSTILE_SECRET"]
EXPECT_HOST = os.getenv("TURNSTILE_HOSTNAME", "")
# Test-only: lets the load generator mint "solved" tokens. Inert unless ENV=test.
SIM_KEY = os.getenv("SIM_KEY", "").encode() if os.getenv("ENV") == "test" else b""
_c = httpx.AsyncClient(timeout=5)

async def verify_turnstile(token: str, ip: str) -> bool:
    if not token or len(token) > 2048:
        return False
    if SIM_KEY and token.startswith("sim."):
        try:
            _, n, sig = token.split(".")
        except ValueError:
            return False
        return hmac.compare_digest(sig, hmac.new(SIM_KEY, n.encode(), hashlib.sha256).hexdigest())
    try:
        r = await _c.post(URL, data={"secret": SECRET, "response": token, "remoteip": ip,
                                     "idempotency_key": secrets.token_hex(16)})
        d = r.json()
        if r.status_code != 200 or d.get("success") is not True:
            return False
        return not EXPECT_HOST or d.get("hostname") == EXPECT_HOST
    except Exception:
        return False
