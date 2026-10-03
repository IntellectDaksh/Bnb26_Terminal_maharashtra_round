import asyncio
import logging
import signal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import load_settings
from app.db.connection import create_engine, session_factory
from app.db.models import Event, EventStatus
from app.services.reservation import expire_reservations

logger = logging.getLogger(__name__)


async def process_due_expirations(sessions: async_sessionmaker) -> int:
    # Scan durable state on every cycle, including the first cycle after a restart.
    async with sessions() as db:
        event_ids = list(
            (await db.scalars(select(Event.id).where(Event.status == EventStatus.LIVE))).all()
        )
    total = 0
    for event_id in event_ids:
        async with sessions() as db:
            total += await expire_reservations(event_id, db)
    return total


async def run_worker() -> None:
    settings = load_settings()
    engine = create_engine(settings)
    sessions = session_factory(engine)
    stopping = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stopping.set)
        except NotImplementedError:  # Windows
            signal.signal(sig, lambda *_: loop.call_soon_threadsafe(stopping.set))
    try:
        while not stopping.is_set():
            try:
                count = await process_due_expirations(sessions)
                if count:
                    logger.info("Expired %d reservations", count)
            except Exception:
                # Transactions have rolled back. Retry from durable state on the next cycle.
                logger.error("Expiration cycle failed; retrying next cycle")
            try:
                await asyncio.wait_for(stopping.wait(), timeout=settings.worker_interval_seconds)
            except TimeoutError:
                pass
    finally:
        await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
