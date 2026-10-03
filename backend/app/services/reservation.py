from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import EventStatus, RegistrationStatus, Reservation, ReservationStatus
from app.schemas.reservations import ConfirmationResponse, ReservationResponse
from app.services.admission import admit_next, expire_overdue, finish_if_complete
from app.services.common import database_now, lock_event
from app.services.registration import get_registration


async def confirm_reservation(
    event_id: UUID, user_id: UUID, db: AsyncSession
) -> ConfirmationResponse:
    failure = None
    result = None
    async with db.begin():
        event = await lock_event(event_id, db)
        registration = await get_registration(event_id, user_id, db)
        if registration is None:
            raise AppError(404, "registration_not_found", "Register for this event first.")
        reservation = await db.scalar(
            select(Reservation).where(Reservation.registration_id == registration.id)
        )
        if reservation is None:
            raise AppError(409, "reservation_not_offered", "No reservation has been offered.")
        if reservation.status == ReservationStatus.CONFIRMED:
            return ConfirmationResponse(
                event_id=event_id,
                queue_position=registration.queue_position,
                reservation=ReservationResponse.model_validate(reservation),
            )
        if event.status not in (EventStatus.LIVE, EventStatus.FINISHED):
            raise AppError(409, "invalid_event_state", "Event does not accept confirmations.")
        # Check after BOTH lock acquisition and reservation lookup, never transaction start time.
        now = await database_now(db)
        await expire_overdue(event_id, db, now)
        if reservation.status == ReservationStatus.EXPIRED:
            failure = AppError(409, "reservation_expired", "Reservation has expired.")
        elif event.status != EventStatus.LIVE:
            failure = AppError(409, "invalid_event_state", "Event does not accept confirmations.")
        else:
            reservation.status = ReservationStatus.CONFIRMED
            reservation.confirmed_at = now
            registration.status = RegistrationStatus.CONFIRMED
            await db.flush()
            result = ConfirmationResponse(
                event_id=event_id,
                queue_position=registration.queue_position,
                reservation=ReservationResponse.model_validate(reservation),
            )
        await admit_next(event, db, await database_now(db))
        await finish_if_complete(event, db)
    # Expiry + inventory recovery MUST commit, even though confirmation returns a conflict.
    if failure:
        raise failure
    return result


async def expire_reservations(event_id: UUID, db: AsyncSession) -> int:
    async with db.begin():
        event = await lock_event(event_id, db)
        if event.status != EventStatus.LIVE:
            return 0
        now = await database_now(db)
        expired = await expire_overdue(event_id, db, now)
        await admit_next(event, db, await database_now(db))
        return expired
