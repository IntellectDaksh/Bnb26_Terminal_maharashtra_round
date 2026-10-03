from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import Event


async def lock_event(event_id: UUID, db: AsyncSession, *, read: bool = False) -> Event:
    """Always acquire this lock before reading the clock or changing allocation state."""
    event = await db.scalar(select(Event).where(Event.id == event_id).with_for_update(read=read))
    if event is None:
        raise AppError(404, "event_not_found", "Event not found.")
    return event


async def database_now(db: AsyncSession) -> datetime:
    # now()/CURRENT_TIMESTAMP is fixed at transaction start, potentially BEFORE a lock wait.
    return await db.scalar(select(func.clock_timestamp()))
