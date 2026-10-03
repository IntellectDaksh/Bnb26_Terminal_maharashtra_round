"""Run against real Redis; unique namespaces never reset shared server state."""

import asyncio
import os
from uuid import uuid4

import pytest
from redis.asyncio import Redis
from starlette.requests import Request

from app.core.config import Settings
from app.core.errors import AppError
from app.security.abuse import AbuseGuard


@pytest.fixture
async def guard():
    url = os.environ.get("TEST_REDIS_URL")
    if not url:
        pytest.skip("Set TEST_REDIS_URL for real Redis checks")
    settings = Settings(
        _env_file=None,
        database_url="postgresql+asyncpg://user@localhost/fairdrop_test",
        supabase_url="https://test.supabase.co",
        abuse_protection_enabled=True,
        redis_url=url,
        abuse_key_secret="test-abuse-secret-at-least-32-characters",
        abuse_namespace=f"test-{uuid4().hex}",
        polling_rate=1,
        polling_burst=1,
        abuse_violation_threshold=3,
        abuse_cooldown_seconds=1,
    )
    redis = Redis.from_url(url)
    try:
        await redis.ping()
        yield AbuseGuard(settings, redis)
    finally:
        await redis.aclose()


def request(ip="192.0.2.1"):
    return Request({"type": "http", "client": (ip, 1234), "headers": []})


async def test_atomic_limits_across_independent_workers_and_retry(guard):
    user = uuid4()
    other = AbuseGuard(guard.settings, guard.redis)
    results = await asyncio.gather(
        *(g.limit(user, "me") for g in [guard, other] * 20), return_exceptions=True
    )
    assert sum(r is None for r in results) == 1
    assert all(isinstance(r, AppError) and r.status == 429 for r in results if r is not None)
    await guard.limit(uuid4(), "me")
    await guard.limit(user, "confirm")
    await asyncio.sleep(1.1)
    await guard.limit(user, "me")


async def test_atomic_multi_account_cap_and_idempotent_retry(guard):
    event = uuid4()
    users = [uuid4() for _ in range(20)]
    results = await asyncio.gather(
        *(guard.registration(request(), user, event, "shared-device") for user in users),
        return_exceptions=True,
    )
    assert sum(r is None for r in results) == 2
    for user, result in zip(users, results, strict=True):
        if result is None:
            await guard.registration(request(), user, event, "shared-device")
        else:
            assert result.status == 429 and result.retry_after > 0
    await guard.registration(request(), uuid4(), uuid4(), "shared-device")


async def test_shared_network_humans_and_ip_rotation(guard):
    event = uuid4()
    await asyncio.gather(
        *(guard.registration(request(), uuid4(), event, f"human-device-{i}") for i in range(100))
    )
    for i in range(6):
        await guard.registration(request(f"192.0.2.{i + 1}"), uuid4(), event, "rotating-device")
    with pytest.raises(AppError) as error:
        await guard.registration(request("192.0.2.100"), uuid4(), event, "rotating-device")
    assert error.value.code == "registration_abuse"


async def test_sustained_rejections_have_fixed_cooldown(guard):
    user = uuid4()
    await guard.limit(user, "me")
    for _ in range(3):
        with pytest.raises(AppError):
            await guard.limit(user, "me")
    key = guard.key(f"rate:me:{user}")
    blocked = await guard.redis.hget(key, "blocked")
    for _ in range(50):
        with pytest.raises(AppError):
            await guard.limit(user, "me")
    assert await guard.redis.hget(key, "blocked") == blocked


async def test_expired_identity_budget_and_missing_device(guard):
    with pytest.raises(AppError) as error:
        await guard.registration(request(), uuid4(), uuid4(), None)
    assert error.value.status == 422
    guard.settings.abuse_identity_window_seconds = 1
    event = uuid4()
    for _ in range(2):
        await guard.registration(request(), uuid4(), event, "expiring-device")
    with pytest.raises(AppError):
        await guard.registration(request(), uuid4(), event, "expiring-device")
    await asyncio.sleep(1.1)
    await guard.registration(request(), uuid4(), event, "expiring-device")
