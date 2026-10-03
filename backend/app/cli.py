"""Run trusted bootstrap operations with the migration-owner DB connection."""

import argparse
import asyncio
from datetime import datetime
from uuid import UUID

from sqlalchemy import text

from app.core.config import load_settings
from app.db.connection import create_engine


async def run(args: argparse.Namespace) -> None:
    engine = create_engine(load_settings())
    try:
        async with engine.begin() as connection:
            if args.command == "create-event":
                opens = datetime.fromisoformat(args.opens_at.replace("Z", "+00:00"))
                closes = datetime.fromisoformat(args.closes_at.replace("Z", "+00:00"))
                if opens.tzinfo is None or closes.tzinfo is None:
                    raise ValueError("Event timestamps require an explicit timezone")
                event_id = await connection.scalar(
                    text("""
                    INSERT INTO fairdrop.events
                        (name, capacity, registration_opens_at, registration_closes_at)
                    VALUES (:name, :capacity, :opens, :closes) RETURNING id
                """),
                    {
                        "name": args.name,
                        "capacity": args.capacity,
                        "opens": opens,
                        "closes": closes,
                    },
                )
                print(event_id)
            elif args.command == "add-admin":
                await connection.execute(
                    text("""
                    INSERT INTO fairdrop.administrators (user_id) VALUES (:user_id)
                    ON CONFLICT (user_id) DO NOTHING
                """),
                    {"user_id": UUID(args.user_id)},
                )
                print("Administrator approved.")
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Fair Drop trusted bootstrap operations")
    commands = parser.add_subparsers(dest="command", required=True)
    event = commands.add_parser("create-event")
    event.add_argument("--name", required=True)
    event.add_argument("--capacity", type=int, required=True)
    event.add_argument("--opens-at", required=True)
    event.add_argument("--closes-at", required=True)
    admin = commands.add_parser("add-admin")
    admin.add_argument("--user-id", required=True)
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
