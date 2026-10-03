from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import (
    Event,
    EventStatus,
    Registration,
    RegistrationStatus,
    Reservation,
    ReservationStatus,
)
from app.schemas.events import AdminStatus, EventResponse, PublicEventResponse
from app.services.admission import calculate_available_capacity
from app.services.common import database_now, lock_event


async def get_event(event_id: UUID, db: AsyncSession) -> PublicEventResponse:
    snapshot = await get_admin_status(event_id, db)
    return PublicEventResponse(
        **snapshot.event.model_dump(),
        registrations=snapshot.registrations,
        confirmed=snapshot.confirmed,
        active_reservations=snapshot.active_reservations,
        server_time=snapshot.server_time,
    )


async def list_events(db: AsyncSession) -> list[PublicEventResponse]:
    # A bounded discovery feed for the participant UI; no participant identifiers.
    async with db.begin():
        ids = list(await db.scalars(select(Event.id).order_by(Event.created_at.desc()).limit(50)))
    return [await get_event(event_id, db) for event_id in ids]


async def close_registration(event_id: UUID, db: AsyncSession) -> EventResponse:
    async with db.begin():
        event = await lock_event(event_id, db)
        if event.status != EventStatus.OPEN:
            raise AppError(409, "invalid_event_state", "Only an open event can close registration.")
        now = await database_now(db)
        if now <= event.registration_opens_at:
            raise AppError(409, "registration_not_open", "Registration has not started yet.")
        if now < event.registration_closes_at:
            event.registration_closes_at = now
            await db.flush()
        return EventResponse.model_validate(event)


async def open_registration(event_id: UUID, db: AsyncSession) -> EventResponse:
    try:
        async with db.begin():
            event = await lock_event(event_id, db)
            if event.status == EventStatus.OPEN:
                return EventResponse.model_validate(event)
            if event.status != EventStatus.DRAFT:
                raise AppError(409, "invalid_event_state", "Only a draft event can be opened.")
            now = await database_now(db)
            if now >= event.registration_closes_at:
                raise AppError(409, "registration_closed", "Registration deadline has passed.")
            event.status = EventStatus.OPEN
            await db.flush()
            return EventResponse.model_validate(event)
    except IntegrityError as exc:
        if getattr(exc.orig, "sqlstate", None) == "23505":
            raise AppError(409, "active_event_exists", "Another event is already active.") from exc
        raise


async def get_admin_status(event_id: UUID, db: AsyncSession) -> AdminStatus:
    async with db.begin():
        event = await lock_event(event_id, db, read=True)
        now = await database_now(db)
        registrations = await db.scalar(
            select(func.count()).select_from(Registration).where(Registration.event_id == event_id)
        )
        queued = await db.scalar(
            select(func.count())
            .select_from(Registration)
            .where(
                Registration.event_id == event_id, Registration.status == RegistrationStatus.QUEUED
            )
        )
        rows = (
            await db.execute(
                select(Reservation.status, Reservation.expires_at).where(
                    Reservation.event_id == event_id
                )
            )
        ).all()
        return AdminStatus(
            event=EventResponse.model_validate(event),
            registrations=registrations,
            queued=queued,
            confirmed=sum(status == ReservationStatus.CONFIRMED for status, _ in rows),
            active_reservations=sum(
                status == ReservationStatus.OFFERED and expiry > now for status, expiry in rows
            ),
            expired=sum(
                status == ReservationStatus.EXPIRED
                or (status == ReservationStatus.OFFERED and expiry <= now)
                for status, expiry in rows
            ),
            available_capacity=await calculate_available_capacity(event, db, now),
            server_time=now,
        )
