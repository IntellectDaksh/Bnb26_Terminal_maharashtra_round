import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError
from app.db.connection import create_engine, session_factory
from app.db.models import (
    Event,
    EventStatus,
    Registration,
    RegistrationStatus,
    Reservation,
    ReservationStatus,
)
from app.services.admission import admit_next
from app.services.common import database_now, lock_event
from app.services.events import get_admin_status, open_registration
from app.services.queue import generate_queue, get_queue_status
from app.services.reservation import confirm_reservation, expire_reservations
from app.workers.expiration_worker import process_due_expirations

pytestmark = pytest.mark.integration


async def make_overdue(database, reservation_id):
    async with database.engine.begin() as connection:
        await connection.execute(
            update(Reservation)
            .where(Reservation.id == reservation_id)
            .values(
                offered_at=datetime.now(UTC) - timedelta(minutes=4),
                expires_at=datetime.now(UTC) - timedelta(seconds=1),
            )
        )


async def test_five_users_two_tickets_acceptance_and_restart(database):
    event_id, ordered = await database.drawn()
    assert [r.queue_position for r in ordered] == [1, 2, 3, 4, 5]
    first = await database.call(get_queue_status, event_id, ordered[0].user_id)
    second = await database.call(get_queue_status, event_id, ordered[1].user_id)
    assert first.reservation.status == second.reservation.status == ReservationStatus.OFFERED
    assert first.reservation.expires_at - first.reservation.offered_at == timedelta(minutes=3)
    assert (await database.call(get_queue_status, event_id, ordered[2].user_id)).reservation is None
    original = await database.call(confirm_reservation, event_id, ordered[0].user_id)
    assert await database.call(confirm_reservation, event_id, ordered[0].user_id) == original
    await make_overdue(database, second.reservation.id)
    # Reads know the deadline even before the worker persists expiration.
    expired_status = await database.call(get_queue_status, event_id, ordered[1].user_id)
    assert expired_status.reservation.status == ReservationStatus.EXPIRED
    assert expired_status.registration.queue_position == 2

    # New engine/session pool simulates process restart: worker reconstructs everything from DB.
    restarted = create_engine(database.settings)
    try:
        assert await process_due_expirations(session_factory(restarted)) == 1
        assert await process_due_expirations(session_factory(restarted)) == 0
    finally:
        await restarted.dispose()
    third = await database.call(get_queue_status, event_id, ordered[2].user_id)
    assert third.reservation.status == ReservationStatus.OFFERED
    await database.call(confirm_reservation, event_id, ordered[2].user_id)
    status = await database.call(get_admin_status, event_id)
    assert status.confirmed == 2
    assert status.active_reservations == status.available_capacity == 0
    assert status.event.status == EventStatus.FINISHED
    for registration in ordered:
        retry = await database.register(event_id, registration.user_id)
        assert not retry.created
        assert retry.registration.queue_position == registration.queue_position
    with pytest.raises(AppError, match="Reservation has expired"):
        await database.call(confirm_reservation, event_id, ordered[1].user_id)


async def test_simultaneous_registration_and_repeat_draw(database):
    event_id = await database.event(capacity=1)
    user_id = await database.user()
    results = await asyncio.gather(*(database.register(event_id, user_id) for _ in range(12)))
    assert sum(result.created for result in results) == 1
    assert len({result.registration.id for result in results}) == 1
    with pytest.raises(AppError) as error:
        await database.call(generate_queue, event_id)
    assert error.value.code == "registration_still_open"
    await database.close(event_id)
    draws = await asyncio.gather(*(database.call(generate_queue, event_id) for _ in range(5)))
    assert len({draw.draw_completed_at for draw in draws}) == 1
    async with database.sessions() as db:
        assert await db.scalar(select(func.count()).select_from(Reservation)) == 1


async def test_simultaneous_confirmations_are_idempotent(database):
    event_id, ordered = await database.drawn(count=6, capacity=2)
    results = await asyncio.gather(
        *(database.call(confirm_reservation, event_id, ordered[i % 2].user_id) for i in range(12))
    )
    assert len({result.reservation.id for result in results}) == 2
    assert (await database.call(get_admin_status, event_id)).confirmed == 2


async def test_confirmation_waiting_for_lock_checks_clock_after_lock(database):
    event_id, ordered = await database.drawn(count=3, capacity=1)
    first = await database.call(get_queue_status, event_id, ordered[0].user_id)
    async with database.sessions() as blocker, blocker.begin():
        await lock_event(event_id, blocker)
        # The waiting request's transaction starts before this deadline.
        deadline = await database_now(blocker) + timedelta(milliseconds=180)
        await blocker.execute(
            update(Reservation)
            .where(Reservation.id == first.reservation.id)
            .values(expires_at=deadline)
        )
        confirmation = asyncio.create_task(
            database.call(confirm_reservation, event_id, ordered[0].user_id)
        )
        expiration = asyncio.create_task(database.call(expire_reservations, event_id))
        await blocker.execute(text("SELECT pg_sleep(0.3)"))
    results = await asyncio.gather(confirmation, expiration, return_exceptions=True)
    assert isinstance(results[0], AppError)
    assert results[0].code == "reservation_expired"
    status = await database.call(get_admin_status, event_id)
    assert status.confirmed == 0
    assert status.active_reservations == 1
    next_user = await database.call(get_queue_status, event_id, ordered[1].user_id)
    assert next_user.reservation.status == ReservationStatus.OFFERED


async def test_registration_waiting_for_lock_cannot_cross_cutoff(database):
    event_id = await database.event(capacity=1)
    user_id = await database.user()
    async with database.sessions() as blocker, blocker.begin():
        await lock_event(event_id, blocker)
        deadline = await database_now(blocker) + timedelta(milliseconds=180)
        await blocker.execute(
            update(Event).where(Event.id == event_id).values(registration_closes_at=deadline)
        )
        registration = asyncio.create_task(database.register(event_id, user_id))
        draw = asyncio.create_task(database.call(generate_queue, event_id))
        await blocker.execute(text("SELECT pg_sleep(0.3)"))
    results = await asyncio.gather(registration, draw, return_exceptions=True)
    assert isinstance(results[0], AppError)
    assert results[0].code == "registration_closed"
    assert not isinstance(results[1], Exception)
    assert (await database.call(get_admin_status, event_id)).registrations == 0


async def test_multiple_workers_fifo_and_no_duplicate_offers(database):
    event_id, ordered = await database.drawn(count=8, capacity=2)
    for registration in ordered[:2]:
        status = await database.call(get_queue_status, event_id, registration.user_id)
        await make_overdue(database, status.reservation.id)
    await asyncio.gather(*(process_due_expirations(database.sessions) for _ in range(4)))
    states = [await database.call(get_queue_status, event_id, r.user_id) for r in ordered]
    assert [s.registration.status for s in states] == [
        RegistrationStatus.EXPIRED,
        RegistrationStatus.EXPIRED,
        RegistrationStatus.OFFERED,
        RegistrationStatus.OFFERED,
        *([RegistrationStatus.QUEUED] * 4),
    ]
    assert (await database.call(get_admin_status, event_id)).active_reservations == 2
    async with database.sessions() as db, db.begin():
        event = await lock_event(event_id, db)
        assert await admit_next(event, db, await database_now(db)) == 0


async def test_draw_failure_rolls_back_queue_and_state(database):
    event_id = await database.event()
    for _ in range(4):
        await database.register(event_id, await database.user())
    await database.close(event_id)

    class BrokenShuffler:
        def shuffle(self, population):
            # Simulate a real database constraint failure part way through the draw.
            for registration in population:
                registration.user_id = uuid4()

    with pytest.raises(IntegrityError):
        await database.call(generate_queue, event_id, randomizer=BrokenShuffler())
    async with database.sessions() as db:
        event = await db.get(Event, event_id)
        assert event.status == EventStatus.OPEN
        assert event.draw_completed_at is None
        entries = list((await db.scalars(select(Registration))).all())
        assert all(
            r.queue_position is None and r.status == RegistrationStatus.ELIGIBLE for r in entries
        )
        assert await db.scalar(select(func.count()).select_from(Reservation)) == 0
    assert (await database.call(generate_queue, event_id)).draw_completed_at is not None


async def test_expiry_admission_failure_rolls_back_all_changes(database, monkeypatch):
    event_id, ordered = await database.drawn(count=3, capacity=1)
    first = await database.call(get_queue_status, event_id, ordered[0].user_id)
    await make_overdue(database, first.reservation.id)

    async def broken_admission(event, db, now):
        await db.execute(text("SELECT 1 / 0"))

    from sqlalchemy.exc import DBAPIError

    from app.services import reservation as module

    with monkeypatch.context() as patch:
        patch.setattr(module, "admit_next", broken_admission)
        with pytest.raises(DBAPIError):
            await database.call(expire_reservations, event_id)
    async with database.sessions() as db:
        reservation = await db.get(Reservation, first.reservation.id)
        assert reservation.status == ReservationStatus.OFFERED
        registration = await db.get(Registration, ordered[0].id)
        assert registration.status == RegistrationStatus.OFFERED
    assert await process_due_expirations(database.sessions) == 1


async def test_constraints_ownership_uniqueness_immutability_private_schema(database):
    event_id, ordered = await database.drawn(count=2, capacity=1)
    other_event = await database.event(status=EventStatus.DRAFT)
    async with database.sessions() as db:
        with pytest.raises(IntegrityError):
            async with db.begin():
                await db.execute(
                    update(Registration)
                    .where(Registration.id == ordered[0].id)
                    .values(queue_position=99)
                )
        with pytest.raises(IntegrityError):
            async with db.begin():
                db.add(
                    Reservation(
                        event_id=other_event,
                        registration_id=ordered[1].id,
                        status=ReservationStatus.OFFERED,
                        offered_at=datetime.now(UTC),
                        expires_at=datetime.now(UTC) + timedelta(minutes=3),
                    )
                )
                await db.flush()
        with pytest.raises(IntegrityError):
            async with db.begin():
                db.add(
                    Registration(
                        event_id=event_id,
                        user_id=ordered[0].user_id,
                        status=RegistrationStatus.ELIGIBLE,
                        registered_at=datetime.now(UTC),
                    )
                )
                await db.flush()
    async with database.engine.connect() as connection:
        assert not await connection.scalar(
            text("SELECT has_schema_privilege('authenticated', 'fairdrop', 'USAGE')")
        )
        assert not await connection.scalar(
            text("SELECT has_table_privilege('anon', 'fairdrop.events', 'SELECT')")
        )


async def test_open_and_terminal_states(database):
    event_id = await database.event(status=EventStatus.DRAFT)
    assert (await database.call(open_registration, event_id)).status == EventStatus.OPEN
    assert (await database.call(open_registration, event_id)).status == EventStatus.OPEN
    second = await database.event(status=EventStatus.DRAFT)
    with pytest.raises(AppError) as error:
        await database.call(open_registration, second)
    assert error.value.code == "active_event_exists"
    await database.close(event_id)
    # An empty draw completes immediately; an exhausted event can finish below capacity.
    assert (await database.call(generate_queue, event_id)).status == EventStatus.FINISHED
    with pytest.raises(AppError):
        await database.call(open_registration, event_id)


async def test_all_offers_expire_with_insufficient_population(database):
    event_id, ordered = await database.drawn(count=1, capacity=2)
    first = await database.call(get_queue_status, event_id, ordered[0].user_id)
    await make_overdue(database, first.reservation.id)
    assert await database.call(expire_reservations, event_id) == 1
    status = await database.call(get_admin_status, event_id)
    assert status.event.status == EventStatus.FINISHED
    assert status.available_capacity == 2


async def test_backend_role_enforces_rls_and_cannot_grant_admin(database):
    from sqlalchemy.exc import DBAPIError

    event_id = await database.event()
    user_id = await database.user()
    async with database.engine.connect() as connection:
        await connection.execute(text("SET ROLE fairdrop_backend"))
        row = await connection.execute(
            text("SELECT id FROM fairdrop.events WHERE id = :id"), {"id": event_id}
        )
        assert row.scalar() == event_id
        await connection.execute(
            text("""
            INSERT INTO fairdrop.registrations (event_id, user_id)
            VALUES (:event_id, :user_id)
        """),
            {"event_id": event_id, "user_id": user_id},
        )
        assert await connection.scalar(text("SELECT count(*) FROM fairdrop.administrators")) == 0
        await connection.commit()
        with pytest.raises(DBAPIError):
            await connection.execute(
                text("""
                INSERT INTO fairdrop.administrators (user_id) VALUES (:id)
            """),
                {"id": user_id},
            )
        await connection.rollback()
        with pytest.raises(DBAPIError):
            await connection.execute(text("DELETE FROM fairdrop.registrations"))
        await connection.rollback()
        await connection.execute(text("RESET ROLE"))


async def test_injectable_draw_order_is_persisted_once(database):
    event_id = await database.event(capacity=1)
    for _ in range(4):
        await database.register(event_id, await database.user())
    async with database.sessions() as db:
        ids = list((await db.scalars(select(Registration.id).order_by(Registration.id))).all())

    class ReverseOrder:
        def shuffle(self, population):
            population.reverse()

    await database.close(event_id)
    await database.call(generate_queue, event_id, randomizer=ReverseOrder())
    await database.call(generate_queue, event_id)
    async with database.sessions() as db:
        positions = list(
            (await db.scalars(select(Registration.id).order_by(Registration.queue_position))).all()
        )
    assert positions == list(reversed(ids))


async def test_registration_window_and_security_binding(database):
    from app.security.interface import SecurityResult
    from app.services.registration import register_user

    event_id = await database.event(status=EventStatus.DRAFT)
    user_id = await database.user()
    with pytest.raises(AppError) as error:
        await database.register(event_id, user_id)
    assert error.value.code == "registration_closed"
    async with database.engine.begin() as connection:
        await connection.execute(
            update(Event)
            .where(Event.id == event_id)
            .values(registration_opens_at=datetime.now(UTC) + timedelta(minutes=1))
        )
    await database.call(open_registration, event_id)
    with pytest.raises(AppError) as error:
        await database.register(event_id, user_id)
    assert error.value.code == "registration_not_started"
    for result in (
        SecurityResult(False, user_id, event_id),
        SecurityResult(True, uuid4(), event_id),
        SecurityResult(True, user_id, uuid4()),
    ):
        with pytest.raises(AppError) as error:
            await database.call(register_user, event_id, user_id, result)
        assert error.value.code == "security_rejected"


async def test_confirmation_before_expiry_racing_worker_keeps_ticket(database):
    event_id, ordered = await database.drawn(count=3, capacity=1)
    results = await asyncio.gather(
        database.call(confirm_reservation, event_id, ordered[0].user_id),
        process_due_expirations(database.sessions),
    )
    assert results[0].ticket_confirmed
    assert results[1] == 0
    status = await database.call(get_admin_status, event_id)
    assert status.confirmed == 1 and status.active_reservations == 0
    assert (await database.call(get_queue_status, event_id, ordered[1].user_id)).reservation is None
