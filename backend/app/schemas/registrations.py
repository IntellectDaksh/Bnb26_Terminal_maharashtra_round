from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import EventStatus, RegistrationStatus
from app.schemas.reservations import ReservationResponse


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    security_token: str = Field(min_length=1, max_length=8192)


class RegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    event_id: UUID
    status: RegistrationStatus
    queue_position: int | None
    registered_at: datetime


class RegisterResponse(BaseModel):
    created: bool
    registration: RegistrationResponse


class QueueStatus(BaseModel):
    event_id: UUID
    event_status: EventStatus
    registration: RegistrationResponse | None
    reservation: ReservationResponse | None
    ticket_confirmed: bool
    server_time: datetime
