from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.db.models import ReservationStatus


class ReservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: ReservationStatus
    offered_at: datetime
    expires_at: datetime
    confirmed_at: datetime | None


class ConfirmationResponse(BaseModel):
    event_id: UUID
    queue_position: int
    ticket_confirmed: bool = True
    reservation: ReservationResponse
