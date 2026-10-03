from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
from pydantic import ValidationError
from redis.exceptions import ConnectionError

from app.core.auth import User
from app.core.config import Settings
from app.core.dependencies import get_db_session, get_user
from app.core.errors import AppError
from app.main import create_app
from app.security.abuse import AbuseGuard


def settings(**overrides):
    return Settings(
        _env_file=None,
        database_url="postgresql+asyncpg://user@localhost/fairdrop_test",
        database_ssl=False,
        supabase_url="https://test.supabase.co",
        **(
            {
                "abuse_protection_enabled": True,
                "redis_url": "redis://localhost:6379/0",
                "abuse_key_secret": "test-abuse-secret-at-least-32-characters",
            }
            | overrides
        ),
    )


async def test_redis_failure_is_not_counted_as_detection():
    redis = AsyncMock()
    redis.eval.side_effect = ConnectionError()
    with pytest.raises(AppError) as error:
        await AbuseGuard(settings(), redis).limit(uuid4(), "me")
    assert (error.value.status, error.value.retry_after) == (503, 5)


@pytest.mark.parametrize(
    "endpoint,method", [("register", "POST"), ("me", "GET"), ("confirm", "POST")]
)
async def test_rejection_precedes_database_and_challenge(endpoint, method):
    app = create_app(settings())
    async with app.router.lifespan_context(app):
        redis = AsyncMock()
        redis.eval.return_value = 19
        app.state.abuse = AbuseGuard(settings(), redis)
        app.state.security = AsyncMock()
        app.dependency_overrides[get_user] = lambda: User(uuid4())
        # Creating an AsyncSession is lazy; rejection must never execute SQL.
        db = AsyncMock()
        app.dependency_overrides[get_db_session] = lambda: db
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.request(
                method,
                f"/api/v1/events/{uuid4()}/{endpoint}",
                json={"security_token": "solved", "device_fp": "test-device"}
                if endpoint == "register"
                else None,
                headers={"Origin": "http://localhost:3000"},
            )
        assert response.status_code == 429
        assert response.headers["Retry-After"] == "19"
        assert "Retry-After" in response.headers["access-control-expose-headers"]
        app.state.security.verify.assert_not_called()
        assert not db.mock_calls


def test_production_requires_guard_and_secret():
    with pytest.raises(ValidationError):
        settings(environment="production", abuse_protection_enabled=False)
    for changes in ({"redis_url": None}, {"abuse_key_secret": "short"}):
        values = settings().model_dump() | changes
        with pytest.raises(ValidationError):
            Settings(_env_file=None, **values)


def test_keys_hide_personal_signals():
    guard = AbuseGuard(settings(), None)
    key = guard.key("device:personal-device:192.0.2.1")
    assert "personal-device" not in key and "192.0.2.1" not in key
