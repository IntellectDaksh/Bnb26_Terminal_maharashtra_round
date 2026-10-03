from uuid import UUID

from fastapi import APIRouter, Request

from app.core.dependencies import DB, AuthenticatedUser
from app.schemas.registrations import QueueStatus, RegisterRequest, RegisterResponse
from app.services.queue import get_queue_status
from app.services.registration import register_user

router = APIRouter(prefix="/events", tags=["registration and queue"])


@router.post("/{event_id}/register", response_model=RegisterResponse)
async def register(
    event_id: UUID, body: RegisterRequest, request: Request, user: AuthenticatedUser, db: DB
) -> RegisterResponse:
    # External network I/O must finish before starting the database transaction.
    decision = await request.app.state.security.verify(body.security_token, user.id, event_id)
    return await register_user(event_id, user.id, decision, db)


@router.get("/{event_id}/me", response_model=QueueStatus)
async def my_status(event_id: UUID, user: AuthenticatedUser, db: DB) -> QueueStatus:
    return await get_queue_status(event_id, user.id, db)
