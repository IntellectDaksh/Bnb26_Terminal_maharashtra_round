"""Atomic Redis token bucket (single Lua call, uses Redis clock)."""
_LUA = """
local t=redis.call('TIME'); local now=tonumber(t[1])+tonumber(t[2])/1e6
local rate=tonumber(ARGV[1]); local cap=tonumber(ARGV[2])
local d=redis.call('HMGET',KEYS[1],'t','ts')
local tok=tonumber(d[1]); local ts=tonumber(d[2])
if tok==nil then tok=cap; ts=now end
tok=math.min(cap,tok+(now-ts)*rate)
local ok=0
if tok>=1 then tok=tok-1; ok=1 end
redis.call('HSET',KEYS[1],'t',tok,'ts',now)
redis.call('EXPIRE',KEYS[1],math.ceil(cap/rate)+5)
return {ok, math.max(0,math.ceil((1-tok)/rate))}
"""

class Limiter:
    def __init__(self, r):
        self.r = r
        self._s = r.register_script(_LUA)

    async def hit(self, key: str, per_sec: float, burst: int):
        ok, retry = await self._s(keys=[f"rl:{key}"], args=[per_sec, burst])
        return bool(ok), int(retry)
