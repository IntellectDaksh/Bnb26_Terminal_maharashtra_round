import asyncio
import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import asyncpg
import pytest
from sqlalchemy import select, text, update
from sqlalchemy.engine import make_url

from app.core.config import Settings
from app.db.connection import create_engine, session_factory
from app.db.models import Event, EventStatus, Registration
from app.security.interface import SecurityResult
from app.services.queue import generate_queue
from app.services.registration import register_user


class Harness:
    def __init__(self, settings, engine):
        self.settings = settings
        self.engine = engine
        self.sessions = session_factory(engine)

    async def call(self, service, *args, **kwargs):
        async with self.sessions() as db:
            return await service(*args, db=db, **kwargs)

    async def user(self) -> UUID:
        user_id = uuid4()
        async with self.engine.begin() as connection:
            await connection.execute(
                text("INSERT INTO auth.users (id) VALUES (:id)"), {"id": user_id}
            )
        return user_id

    async def event(self, capacity=2, status=EventStatus.OPEN) -> UUID:
        now = datetime.now(UTC)
        async with self.sessions() as db, db.begin():
            event = Event(
                name="Acceptance event",
                capacity=capacity,
                status=status,
                registration_opens_at=now - timedelta(hours=1),
                registration_closes_at=now + timedelta(hours=1),
            )
            db.add(event)
            await db.flush()
            return event.id

    async def close(self, event_id):
        async with self.engine.begin() as connection:
            await connection.execute(
                update(Event)
                .where(Event.id == event_id)
                .values(registration_closes_at=datetime.now(UTC) - timedelta(seconds=1))
            )

    async def register(self, event_id, user_id):
        return await self.call(
            register_user, event_id, user_id, SecurityResult(True, user_id, event_id)
        )

    async def drawn(self, count=5, capacity=2):
        event_id = await self.event(capacity=capacity)
        users = [await self.user() for _ in range(count)]
        for user_id in users:
            await self.register(event_id, user_id)
        await self.close(event_id)
        await self.call(generate_queue, event_id)
        async with self.sessions() as db:
            registrations = list(
                (
                    await db.scalars(
                        select(Registration)
                        .where(Registration.event_id == event_id)
                        .order_by(Registration.queue_position)
                    )
                ).all()
            )
        return event_id, registrations


@pytest.fixture
async def database() -> AsyncIterator[Harness]:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to an isolated PostgreSQL database ending in _test")
    parsed = make_url(url)
    if not parsed.database or not parsed.database.endswith("_test"):
        pytest.fail("Integration tests only operate on databases whose name ends in _test")
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=url,
        database_ssl=os.environ.get("TEST_DATABASE_SSL", "false").lower() == "true",
        supabase_url="https://test.supabase.co",
        security_allow_development=True,
    )
    # Minimal auth identity fixture only in this isolated database. Never create auth.users in prod.
    connection = await asyncpg.connect(
        host=parsed.host,
        port=parsed.port or 5432,
        user=parsed.username,
        password=parsed.password,
        database=parsed.database,
        ssl="verify-full" if settings.database_ssl else False,
    )
    try:
        await connection.execute("""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
                    CREATE ROLE anon NOLOGIN;
                END IF;
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
                    CREATE ROLE authenticated NOLOGIN;
                END IF;
            END $$;
            CREATE SCHEMA IF NOT EXISTS auth;
            CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);
            DROP SCHEMA IF EXISTS fairdrop CASCADE;
        """)

        def read_migrations():
            root = Path(__file__).resolve().parents[2]
            return [
                path.read_text(encoding="utf-8")
                for path in sorted((root / "supabase" / "migrations").glob("*.sql"))
            ]

        for migration_sql in await asyncio.to_thread(read_migrations):
            async with connection.transaction():
                await connection.execute(migration_sql)
    finally:
        await connection.close()
    engine = create_engine(settings)
    try:
        yield Harness(settings, engine)
    finally:
        await engine.dispose()
