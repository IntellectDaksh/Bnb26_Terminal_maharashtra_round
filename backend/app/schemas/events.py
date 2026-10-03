from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.db.models import EventStatus


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    capacity: int
    status: EventStatus
    registration_opens_at: datetime
    registration_closes_at: datetime
    next_queue_position: int
    draw_completed_at: datetime | None
    created_at: datetime


class AdminStatus(BaseModel):
    event: EventResponse
    registrations: int
    queued: int
    confirmed: int
    active_reservations: int
    expired: int
    available_capacity: int
    server_time: datetime


class PublicEventResponse(EventResponse):
    registrations: int
    confirmed: int
    active_reservations: int
    server_time: datetime


class HealthResponse(BaseModel):
    status: str
