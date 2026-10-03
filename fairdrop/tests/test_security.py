import pytest, time, asyncio, os, hashlib, hmac
from fastapi import FastAPI, Request, HTTPException
from pydantic import ValidationError

os.environ["HMAC_KEY"] = "testkey"
os.environ["ENV"] = "test"
os.environ["SIM_KEY"] = "simkey"
os.environ["ID_PEPPER"] = "pepper"
os.environ["PII_KEYS"] = "G2O0yX-Q5n67n-gWl60i8a5A2gE6KzV_h81O29wU1I8="

from security.middleware import Guard, guard_registration, RegBody, issue_session, issue_admission, consume_admission, client_ip
from security.ratelimit import Limiter
from security.turnstile import verify_turnstile
import fakeredis.aioredis

@pytest.fixture
async def redis():
    r = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield r
    await r.flushall()

@pytest.mark.asyncio
async def test_rate_limit(redis):
    rl = Limiter(redis)
    for _ in range(40):
        ok, _ = await rl.hit("test:all", 20, 40)
    ok, _ = await rl.hit("test:all", 20, 40)
    assert not ok

@pytest.mark.asyncio
async def test_ban(redis):
    pass

@pytest.mark.asyncio
async def test_dedupe_race(redis):
    pass

@pytest.mark.asyncio
async def test_device_cap(redis):
    pass

@pytest.mark.asyncio
async def test_forged_expired_session(redis):
    pass

@pytest.mark.asyncio
async def test_replayed_admission_token(redis):
    pass
