"""Abuse middleware + FastAPI dependencies. Fails closed if Redis is unavailable."""
import base64, hashlib, hmac, json, os, secrets, time
from fastapi import HTTPException, Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from .crypto import identity_hash
from .ratelimit import Limiter
from .turnstile import verify_turnstile

ENV = os.getenv("ENV", "prod")
KEY = os.environ["HMAC_KEY"].encode()
SIM_SRC = os.getenv("SIM_TRUSTED_SOURCE", "")      # load generator private IP (ENV=test only)
HOPS = int(os.getenv("TRUSTED_PROXY_HOPS", "1"))   # proxies that overwrite/append XFF
MAX_BODY = 16 * 1024
DEV_CAP = int(os.getenv("DEVICE_REG_CAP", "2"))    # registrations per device fingerprint / 24h
IP_CAP = int(os.getenv("IP_REG_CAP", "5"))         # registrations per IP / 24h
RULES = {"/api/register": (0.05, 3), "/api/queue/status": (1, 5),
         "/api/reserve": (0.5, 3), "/api/confirm": (0.5, 3)}   # (tokens/s, burst)
DEFAULT, GLOBAL = (10, 20), (20, 40)
HEADERS = {"Strict-Transport-Security": "max-age=63072000; includeSubDomains",
           "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
           "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'"}

def client_ip(req: Request) -> str:
    peer = req.client.host if req.client else "0.0.0.0"
    xff = [x.strip() for x in req.headers.get("x-forwarded-for", "").split(",") if x.strip()]
    ip = xff[-HOPS] if HOPS and len(xff) >= HOPS else peer
    if ENV == "test" and SIM_SRC and ip == SIM_SRC:      # per-bot IPs in simulation only
        ip = req.headers.get("x-sim-client-ip", ip)
    return ip

def _deny(code, msg, retry=0):
    return JSONResponse({"error": msg}, status_code=code, headers={"Retry-After": str(int(retry))})

class Guard(BaseHTTPMiddleware):
    def __init__(self, app, limiter: Limiter):
        super().__init__(app); self.rl = limiter

    async def dispatch(self, req, call_next):
        ip = req.state.ip = client_ip(req)
        try:
            if int(req.headers.get("content-length") or 0) > MAX_BODY:
                return _deny(413, "too_large")
        except ValueError:
            return _deny(400, "bad_request")
        try:
            r = self.rl.r
            if await r.exists(f"ban:{ip}"):
                return _deny(429, "banned", 900)
            rate, burst = RULES.get(req.url.path, DEFAULT)
            ok, retry = await self.rl.hit(f"{ip}:{req.url.path}", rate, burst)
            if ok:
                ok, retry = await self.rl.hit(f"{ip}:all", *GLOBAL)
            if not ok:
                n = await r.incr(f"viol:{ip}")
                if n == 1: await r.expire(f"viol:{ip}", 60)
                if n >= 30: await r.set(f"ban:{ip}", 1, ex=900)   # 30 violations/min -> 15 min ban
                return _deny(429, "rate_limited", retry)
        except Exception:
            return _deny(503, "unavailable", 5)
        resp = await call_next(req)
        resp.headers.update(HEADERS)
        return resp

# ---- signed sessions / single-use admission permissions ----
def _sign(p: dict) -> str:
    b = base64.urlsafe_b64encode(json.dumps(p, separators=(",", ":")).encode()).decode().rstrip("=")
    return b + "." + hmac.new(KEY, b.encode(), hashlib.sha256).hexdigest()

def _open(tok: str):
    try:
        b, sig = tok.rsplit(".", 1)
        if not hmac.compare_digest(sig, hmac.new(KEY, b.encode(), hashlib.sha256).hexdigest()):
            return None
        p = json.loads(base64.urlsafe_b64decode(b + "=" * (-len(b) % 4)))
        return p if p["exp"] > time.time() else None
    except Exception:
        return None

def issue_session(uid: str, ttl=21600) -> str:
    return _sign({"u": uid, "sc": "ses", "exp": time.time() + ttl})

def issue_admission(uid: str, ttl=120) -> str:
    return _sign({"u": uid, "sc": "adm", "j": secrets.token_hex(8), "exp": time.time() + ttl})

async def require_session(req: Request) -> str:
    h = req.headers.get("authorization", "")
    p = _open(h[7:]) if h.startswith("Bearer ") else None
    if not p or p.get("sc") != "ses":
        raise HTTPException(401, "bad_session")
    return p["u"]

async def consume_admission(r, token: str, uid: str) -> bool:
    """True once per admission token, only for the user it was issued to."""
    p = _open(token)
    if not p or p.get("sc") != "adm" or p["u"] != uid:
        return False
    return bool(await r.set(f"adm:{p['j']}", 1, nx=True, ex=300))

# ---- registration guard ----
class RegBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    device_fp: str = Field(min_length=8, max_length=128)
    turnstile_token: str = Field(default="", max_length=2048)

async def guard_registration(req: Request, body: RegBody) -> dict:
    """Returns {'uid','existing'}. Backend persists the user (encrypt_pii) when existing is False."""
    r, ip = req.app.state.redis, req.state.ip
    if not await verify_turnstile(body.turnstile_token, ip):
        raise HTTPException(403, "challenge_failed")
    ident = identity_hash(body.email)
    ex = await r.get(f"reg:{ident}")
    if ex:
        return {"uid": ex, "existing": True}          # returning user: show existing entry
    if await r.exists("reg:closed"):
        raise HTTPException(423, "registration_closed")
    fp = hashlib.sha256(body.device_fp.encode()).hexdigest()[:32]
    for k, lim in ((f"cap:dev:{fp}", DEV_CAP), (f"cap:ip:{ip}", IP_CAP)):
        n = await r.incr(k)
        if n == 1: await r.expire(k, 86400)
        if n > lim:
            raise HTTPException(429, "too_many_registrations")
    uid = secrets.token_hex(16)
    if not await r.set(f"reg:{ident}", uid, nx=True):   # lost a race -> same identity
        return {"uid": await r.get(f"reg:{ident}"), "existing": True}
    return {"uid": uid, "existing": False}
