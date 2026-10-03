"""Shared, atomic abuse controls. Redis time is authoritative across API workers."""

import hashlib
import hmac
import logging
from uuid import UUID

from fastapi import Request
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import Settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)

# A token bucket plus a rolling violation window and a fixed cooldown. Rejected
# requests do not extend the cooldown, so Retry-After is safe for cooperative clients.
RATE_LUA = """
local t=redis.call('TIME'); local now=tonumber(t[1])+tonumber(t[2])/1e6
local rate=tonumber(ARGV[1]); local cap=tonumber(ARGV[2])
local d=redis.call('HMGET',KEYS[1],'tokens','ts','violations','window','blocked')
local blocked=tonumber(d[5]) or 0
if blocked>now then return math.ceil(blocked-now) end
local tok=tonumber(d[1]) or cap; local ts=tonumber(d[2]) or now
local n=tonumber(d[3]) or 0; local window=tonumber(d[4]) or now
if now-window>=60 then n=0; window=now end
tok=math.min(cap,tok+math.max(0,now-ts)*rate)
local retry=0
if tok>=1 then tok=tok-1 else
  n=n+1; retry=math.max(1,math.ceil((1-tok)/rate))
  if n>=tonumber(ARGV[3]) then
    blocked=now+tonumber(ARGV[4]); retry=tonumber(ARGV[4]); n=0; window=now
  end
end
redis.call('HSET',KEYS[1],'tokens',tok,'ts',now,'violations',n,'window',window,'blocked',blocked)
redis.call('EXPIRE',KEYS[1],math.ceil(math.max(cap/rate,60,tonumber(ARGV[4])))+5)
return retry
"""

# Per-event unique accounts. Repeated requests by the same account consume no
# additional identity capacity. Check both sets before writing either one.
IDENTITY_LUA = """
local user=ARGV[1]; local ttl=tonumber(ARGV[2])
if redis.call('SISMEMBER',KEYS[1],user)==1 then return 0 end
if redis.call('SCARD',KEYS[1])>=tonumber(ARGV[3]) or
   redis.call('SCARD',KEYS[2])>=tonumber(ARGV[4]) then
  return math.max(1,redis.call('TTL',KEYS[1]))
end
for _,key in ipairs(KEYS) do
  redis.call('SADD',key,user)
  if redis.call('TTL',key)<0 then redis.call('EXPIRE',key,ttl) end
end
return 0
"""


class AbuseGuard:
    def __init__(self, settings: Settings, redis: Redis | None):
        self.settings = settings
        self.redis = redis

    def digest(self, value: str) -> str:
        return hmac.new(
            self.settings.abuse_key_secret.get_secret_value().encode(),
            value.encode(),
            hashlib.sha256,
        ).hexdigest()

    def key(self, scope: str) -> str:
        # Same hash slot for atomic multi-key scripts on Redis Cluster.
        return f"{self.settings.abuse_namespace}:{{abuse}}:{self.digest(scope)}"

    async def evaluate(self, script: str, keys: list[str], args: list) -> int:
        try:
            return int(await self.redis.eval(script, len(keys), *keys, *args))
        except (RedisError, OSError) as exc:
            raise AppError(
                503, "abuse_protection_unavailable", "Traffic protection unavailable.", 5
            ) from exc

    async def limit(self, user_id: UUID, endpoint: str) -> None:
        if not self.settings.abuse_protection_enabled:
            return
        s = self.settings
        rate, burst = {
            "register": (s.registration_rate, s.registration_burst),
            "me": (s.polling_rate, s.polling_burst),
            "confirm": (s.confirm_rate, s.confirm_burst),
        }[endpoint]
        # Scope spans events: switching event URLs cannot reset an account's budget.
        retry = await self.evaluate(
            RATE_LUA,
            [self.key(f"rate:{endpoint}:{user_id}")],
            [rate, burst, s.abuse_violation_threshold, s.abuse_cooldown_seconds],
        )
        if retry:
            raise AppError(429, "rate_limited", "Please wait before trying again.", retry)

    async def registration(
        self, request: Request, user_id: UUID, event_id: UUID, device_fp: str | None
    ) -> None:
        if not self.settings.abuse_protection_enabled:
            return
        if device_fp is None:
            raise AppError(422, "device_required", "A device identifier is required.")
        # ASGI client is authoritative. Never parse caller-supplied X-Forwarded-For.
        # Configure uvicorn's trusted proxy allow-list at deployment instead.
        ip = request.client.host if request.client else "unknown"
        retry = await self.evaluate(
            IDENTITY_LUA,
            [
                self.key(f"device:{event_id}:{device_fp}"),
                self.key(f"device-network:{event_id}:{device_fp}:{ip}"),
            ],
            [
                str(user_id),
                self.settings.abuse_identity_window_seconds,
                self.settings.device_account_cap,
                self.settings.device_network_account_cap,
            ],
        )
        if retry:
            logger.info("Suspicious registration cluster for event %s", event_id)
            raise AppError(
                429, "registration_abuse", "Too many accounts from this device. Try later.", retry
            )
