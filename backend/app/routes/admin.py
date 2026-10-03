from uuid import UUID

from fastapi import APIRouter

from app.core.dependencies import DB, AdminUser
from app.schemas.events import AdminStatus, EventResponse
from app.services.events import close_registration, get_admin_status, open_registration
from app.services.queue import generate_queue

router = APIRouter(prefix="/admin", tags=["administration"])


@router.get("/me")
async def admin_identity(admin: AdminUser) -> dict[str, UUID]:
    return {"user_id": admin.id}


@router.post("/events/{event_id}/open", response_model=EventResponse)
async def open_event(event_id: UUID, admin: AdminUser, db: DB) -> EventResponse:
    return await open_registration(event_id, db)


@router.post("/events/{event_id}/close", response_model=EventResponse)
async def close_event(event_id: UUID, admin: AdminUser, db: DB) -> EventResponse:
    return await close_registration(event_id, db)


@router.post("/events/{event_id}/draw", response_model=EventResponse)
async def draw_event(event_id: UUID, admin: AdminUser, db: DB) -> EventResponse:
    return await generate_queue(event_id, db)


@router.get("/events/{event_id}/status", response_model=AdminStatus)
async def event_status(event_id: UUID, admin: AdminUser, db: DB) -> AdminStatus:
    return await get_admin_status(event_id, db)
