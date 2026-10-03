from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SQLAEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class EventStatus(StrEnum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    DRAWING = "DRAWING"
    LIVE = "LIVE"
    FINISHED = "FINISHED"
    CANCELLED = "CANCELLED"


class RegistrationStatus(StrEnum):
    ELIGIBLE = "ELIGIBLE"
    QUEUED = "QUEUED"
    OFFERED = "OFFERED"
    CONFIRMED = "CONFIRMED"
    EXPIRED = "EXPIRED"


class ReservationStatus(StrEnum):
    OFFERED = "OFFERED"
    CONFIRMED = "CONFIRMED"
    EXPIRED = "EXPIRED"


class Base(DeclarativeBase):
    pass


def enum_type(enum: type[StrEnum], name: str) -> SQLAEnum:
    return SQLAEnum(enum, name=name, schema="fairdrop", create_type=False)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = {"schema": "fairdrop"}
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(Text)
    capacity: Mapped[int] = mapped_column(Integer)
    status: Mapped[EventStatus] = mapped_column(enum_type(EventStatus, "event_status"))
    registration_opens_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    registration_closes_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    next_queue_position: Mapped[int] = mapped_column(Integer, default=1)
    draw_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (
        UniqueConstraint("event_id", "user_id"),
        UniqueConstraint("event_id", "queue_position"),
        UniqueConstraint("event_id", "id"),
        {"schema": "fairdrop"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(ForeignKey("fairdrop.events.id"))
    # Auth is managed by Supabase; the migration owns the auth.users foreign key.
    user_id: Mapped[UUID] = mapped_column()
    status: Mapped[RegistrationStatus] = mapped_column(
        enum_type(RegistrationStatus, "registration_status")
    )
    queue_position: Mapped[int | None] = mapped_column(Integer)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        UniqueConstraint("registration_id"),
        ForeignKeyConstraint(
            ["event_id", "registration_id"],
            ["fairdrop.registrations.event_id", "fairdrop.registrations.id"],
        ),
        {"schema": "fairdrop"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(ForeignKey("fairdrop.events.id"))
    registration_id: Mapped[UUID] = mapped_column()
    status: Mapped[ReservationStatus] = mapped_column(
        enum_type(ReservationStatus, "reservation_status")
    )
    offered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Administrator(Base):
    __tablename__ = "administrators"
    __table_args__ = {"schema": "fairdrop"}
    user_id: Mapped[UUID] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
