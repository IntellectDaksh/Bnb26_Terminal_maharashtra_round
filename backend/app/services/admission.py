from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Event,
    EventStatus,
    Registration,
    RegistrationStatus,
    Reservation,
    ReservationStatus,
)
from app.services.common import database_now

RESERVATION_WINDOW = timedelta(minutes=3)


async def calculate_available_capacity(event: Event, db: AsyncSession, now: datetime) -> int:
    occupied = await db.scalar(
        select(func.count())
        .select_from(Reservation)
        .where(
            Reservation.event_id == event.id,
            or_(
                Reservation.status == ReservationStatus.CONFIRMED,
                (Reservation.status == ReservationStatus.OFFERED) & (Reservation.expires_at > now),
            ),
        )
    )
    if occupied > event.capacity:
        raise RuntimeError("Inventory invariant violated")
    return event.capacity - occupied


async def admit_next(event: Event, db: AsyncSession, now: datetime) -> int:
    """Caller owns transaction and event lock and has expired all overdue offers."""
    if event.status != EventStatus.LIVE:
        return 0
    available = await calculate_available_capacity(event, db, now)
    registrations = list(
        (
            await db.scalars(
                select(Registration)
                .where(
                    Registration.event_id == event.id,
                    Registration.status == RegistrationStatus.QUEUED,
                    Registration.queue_position >= event.next_queue_position,
                )
                .order_by(Registration.queue_position)
                .limit(available)
            )
        ).all()
    )
    if registrations:
        # Offer clocks start after selection, giving each admitted participant a full window.
        offered_at = await database_now(db)
        for registration in registrations:
            db.add(
                Reservation(
                    event_id=event.id,
                    registration_id=registration.id,
                    status=ReservationStatus.OFFERED,
                    offered_at=offered_at,
                    expires_at=offered_at + RESERVATION_WINDOW,
                )
            )
            registration.status = RegistrationStatus.OFFERED
            event.next_queue_position = registration.queue_position + 1
        await db.flush()
    await finish_if_complete(event, db)
    return len(registrations)


async def finish_if_complete(event: Event, db: AsyncSession) -> None:
    if event.status != EventStatus.LIVE:
        return
    confirmed = await db.scalar(
        select(func.count())
        .select_from(Reservation)
        .where(Reservation.event_id == event.id, Reservation.status == ReservationStatus.CONFIRMED)
    )
    pending = await db.scalar(
        select(func.count())
        .select_from(Registration)
        .where(
            Registration.event_id == event.id,
            Registration.status.in_([RegistrationStatus.QUEUED, RegistrationStatus.OFFERED]),
        )
    )
    if confirmed == event.capacity or pending == 0:
        event.status = EventStatus.FINISHED


async def expire_overdue(event_id: UUID, db: AsyncSession, now: datetime) -> int:
    """Internal helper: never commits; requires the event lock."""
    reservations = list(
        (
            await db.scalars(
                select(Reservation).where(
                    Reservation.event_id == event_id,
                    Reservation.status == ReservationStatus.OFFERED,
                    Reservation.expires_at <= now,
                )
            )
        ).all()
    )
    if not reservations:
        return 0
    ids = [reservation.registration_id for reservation in reservations]
    registrations = list(
        (await db.scalars(select(Registration).where(Registration.id.in_(ids)))).all()
    )
    for reservation in reservations:
        reservation.status = ReservationStatus.EXPIRED
    for registration in registrations:
        registration.status = RegistrationStatus.EXPIRED
    await db.flush()
    return len(reservations)
