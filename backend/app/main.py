from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.auth import TokenVerifier
from app.core.config import Settings, load_settings
from app.core.errors import AppError, ErrorResponse, install_error_handlers
from app.db.connection import create_engine, session_factory
from app.routes import admin, events, registrations, reservations
from app.schemas.events import HealthResponse
from app.security.interface import ExternalSecurityVerifier


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = create_engine(settings)
        async with httpx.AsyncClient(timeout=5) as http:
            app.state.settings = settings
            app.state.engine = engine
            app.state.sessions = session_factory(engine)
            app.state.tokens = TokenVerifier(settings, http)
            app.state.security = ExternalSecurityVerifier(settings, http)
            try:
                yield
            finally:
                await engine.dispose()

    app = FastAPI(title="Fair Drop Backend", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        expose_headers=["Retry-After"],
    )
    install_error_handlers(app)
    for router in (events.router, registrations.router, reservations.router, admin.router):
        app.include_router(
            router,
            prefix="/api/v1",
            responses={
                status: {"model": ErrorResponse} for status in (401, 403, 404, 409, 422, 500, 503)
            },
        )

    @app.get("/health/live", response_model=HealthResponse, tags=["health"])
    async def live() -> HealthResponse:
        return HealthResponse(status="ok")

    @app.get(
        "/health/ready",
        response_model=HealthResponse,
        tags=["health"],
        responses={503: {"model": ErrorResponse}},
    )
    async def ready() -> HealthResponse:
        try:
            async with app.state.engine.connect() as connection:
                # Check the actual migrated schema, not merely database reachability.
                await connection.execute(text("SELECT id FROM fairdrop.events LIMIT 1"))
                await connection.execute(text("SELECT id FROM fairdrop.registrations LIMIT 1"))
                await connection.execute(text("SELECT id FROM fairdrop.reservations LIMIT 1"))
                await connection.execute(
                    text("SELECT user_id FROM fairdrop.administrators LIMIT 1")
                )
        except SQLAlchemyError as exc:
            raise AppError(503, "not_ready", "Database or migrations unavailable.") from exc
        return HealthResponse(status="ready")

    return app
