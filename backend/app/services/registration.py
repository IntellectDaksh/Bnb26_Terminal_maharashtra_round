from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import EventStatus, Registration, RegistrationStatus
from app.schemas.registrations import RegisterResponse, RegistrationResponse
from app.security.interface import SecurityResult
from app.services.common import database_now, lock_event


async def get_registration(event_id: UUID, user_id: UUID, db: AsyncSession) -> Registration | None:
    return await db.scalar(
        select(Registration).where(
            Registration.event_id == event_id, Registration.user_id == user_id
        )
    )


async def register_user(
    event_id: UUID, user_id: UUID, security_result: SecurityResult, db: AsyncSession
) -> RegisterResponse:
    if (
        not security_result.allowed
        or security_result.user_id != user_id
        or security_result.event_id != event_id
    ):
        raise AppError(403, "security_rejected", "Security verification rejected registration.")
    async with db.begin():
        event = await lock_event(event_id, db)
        existing = await get_registration(event_id, user_id, db)
        # Safe retries remain successful even after registration closes or the draw completes.
        if existing:
            return RegisterResponse(
                created=False, registration=RegistrationResponse.model_validate(existing)
            )
        now = await database_now(db)
        if event.status != EventStatus.OPEN:
            raise AppError(409, "registration_closed", "Registration is not open.")
        if now < event.registration_opens_at:
            raise AppError(409, "registration_not_started", "Registration has not started.")
        if now >= event.registration_closes_at:
            raise AppError(409, "registration_closed", "Registration deadline has passed.")
        registration = Registration(
            event_id=event_id,
            user_id=user_id,
            status=RegistrationStatus.ELIGIBLE,
            registered_at=now,
        )
        db.add(registration)
        await db.flush()
        return RegisterResponse(
            created=True, registration=RegistrationResponse.model_validate(registration)
        )
