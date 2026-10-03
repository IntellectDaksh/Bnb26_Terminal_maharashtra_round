from uuid import UUID

from fastapi import APIRouter

from app.core.dependencies import DB
from app.schemas.events import PublicEventResponse
from app.services.events import get_event, list_events

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[PublicEventResponse])
async def event_list(db: DB) -> list[PublicEventResponse]:
    return await list_events(db)


@router.get("/{event_id}", response_model=PublicEventResponse)
async def event_info(event_id: UUID, db: DB) -> PublicEventResponse:
    return await get_event(event_id, db)
