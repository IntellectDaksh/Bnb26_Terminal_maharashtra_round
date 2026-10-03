from random import SystemRandom
from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import (
    EventStatus,
    Registration,
    RegistrationStatus,
    Reservation,
    ReservationStatus,
)
from app.schemas.events import EventResponse
from app.schemas.registrations import QueueStatus, RegistrationResponse
from app.schemas.reservations import ReservationResponse
from app.services.admission import admit_next
from app.services.common import database_now, lock_event
from app.services.registration import get_registration


class Shuffler(Protocol):
    def shuffle(self, population: list[Registration]) -> None: ...


async def generate_queue(
    event_id: UUID, db: AsyncSession, randomizer: Shuffler | None = None
) -> EventResponse:
    async with db.begin():
        event = await lock_event(event_id, db)
        if event.draw_completed_at is not None:
            return EventResponse.model_validate(event)
        now = await database_now(db)
        if event.status != EventStatus.OPEN:
            raise AppError(409, "invalid_event_state", "Only an open event can be drawn.")
        if now < event.registration_closes_at:
            raise AppError(409, "registration_still_open", "Wait until registration closes.")
        event.status = EventStatus.DRAWING
        population = list(
            (
                await db.scalars(
                    select(Registration)
                    .where(
                        Registration.event_id == event_id,
                        Registration.status == RegistrationStatus.ELIGIBLE,
                    )
                    .order_by(Registration.id)
                )
            ).all()
        )
        (randomizer or SystemRandom()).shuffle(population)
        for position, registration in enumerate(population, start=1):
            registration.queue_position = position
            registration.status = RegistrationStatus.QUEUED
        event.next_queue_position = 1
        event.draw_completed_at = await database_now(db)
        event.status = EventStatus.LIVE
        await db.flush()
        await admit_next(event, db, await database_now(db))
        await db.flush()
        return EventResponse.model_validate(event)


async def get_queue_status(event_id: UUID, user_id: UUID, db: AsyncSession) -> QueueStatus:
    async with db.begin():
        event = await lock_event(event_id, db, read=True)
        registration = await get_registration(event_id, user_id, db)
        reservation = None
        if registration:
            reservation = await db.scalar(
                select(Reservation).where(Reservation.registration_id == registration.id)
            )
        now = await database_now(db)
        registration_data = (
            RegistrationResponse.model_validate(registration) if registration else None
        )
        reservation_data = ReservationResponse.model_validate(reservation) if reservation else None
        # Reads report authoritative expiration even if the separate worker has not run yet.
        if (
            reservation_data
            and reservation_data.status == ReservationStatus.OFFERED
            and reservation_data.expires_at <= now
        ):
            reservation_data.status = ReservationStatus.EXPIRED
            registration_data.status = RegistrationStatus.EXPIRED
        return QueueStatus(
            event_id=event_id,
            event_status=event.status,
            registration=registration_data,
            reservation=reservation_data,
            ticket_confirmed=bool(
                reservation and reservation.status == ReservationStatus.CONFIRMED
            ),
            server_time=now,
        )
