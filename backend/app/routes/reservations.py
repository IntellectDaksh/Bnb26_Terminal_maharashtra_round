from uuid import UUID

from fastapi import APIRouter, Request

from app.core.dependencies import DB, AuthenticatedUser
from app.schemas.reservations import ConfirmationResponse
from app.services.reservation import confirm_reservation

router = APIRouter(prefix="/events", tags=["reservations"])


@router.post("/{event_id}/confirm", response_model=ConfirmationResponse)
async def confirm(
    event_id: UUID, request: Request, user: AuthenticatedUser, db: DB
) -> ConfirmationResponse:
    await request.app.state.abuse.limit(user.id, "confirm")
    # Ownership is resolved from the verified subject; no client reservation ID is accepted.
    return await confirm_reservation(event_id, user.id, db)
