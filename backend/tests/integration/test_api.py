from uuid import uuid4

import httpx
import pytest
from sqlalchemy import text

from app.core.auth import User
from app.core.dependencies import get_user
from app.main import create_app
from app.security.interface import SecurityResult

pytestmark = pytest.mark.integration


async def test_documented_api_flow_authorization_errors_and_cors(database):
    user_id = await database.user()
    event_id = await database.event()
    app = create_app(database.settings)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            assert (await client.get("/health/live")).json() == {"status": "ok"}
            assert (await client.get("/health/ready")).json() == {"status": "ready"}
            base = f"/api/v1/events/{event_id}"
            assert (await client.get(base)).status_code == 200
            catalog = (await client.get("/api/v1/events")).json()
            assert catalog[0]["id"] == str(event_id)
            assert catalog[0]["registrations"] == 0
            assert (await client.get("/api/v1/admin/me")).status_code == 401
            assert (await client.get(f"{base}/me")).status_code == 401
            assert (await client.get(f"/api/v1/events/{uuid4()}")).json()[
                "code"
            ] == "event_not_found"
            assert (await client.get("/api/v1/events/invalid")).json()["code"] == "invalid_request"
            app.dependency_overrides[get_user] = lambda: User(user_id)
            assert (await client.get(f"{base}/me")).json()["registration"] is None
            admin = f"/api/v1/admin/events/{event_id}"
            assert (await client.post(f"{admin}/draw")).status_code == 403
            assert (await client.get("/api/v1/admin/me")).status_code == 403
            assert (await client.post(f"{admin}/close")).status_code == 403
            async with database.engine.begin() as connection:
                await connection.execute(
                    text("INSERT INTO fairdrop.administrators (user_id) VALUES (:id)"),
                    {"id": user_id},
                )
            assert (await client.post(f"{admin}/open")).status_code == 200
            assert (await client.get("/api/v1/admin/me")).json() == {"user_id": str(user_id)}
            response = await client.post(f"{base}/register", json={"security_token": "test"})
            assert response.json()["created"]
            assert not (
                await client.post(f"{base}/register", json={"security_token": "test"})
            ).json()["created"]
            # Client cannot override the trusted user or inject a queue position.
            assert (
                await client.post(
                    f"{base}/register",
                    json={
                        "security_token": "test",
                        "user_id": str(uuid4()),
                        "queue_position": 1,
                    },
                )
            ).status_code == 422
            assert (await client.get(base)).json()["registrations"] == 1
            assert (await client.post(f"{admin}/draw")).status_code == 409
            closed = await client.post(f"{admin}/close")
            assert closed.status_code == 200
            assert (await client.post(f"{admin}/close")).json() == closed.json()
            assert not (
                await client.post(f"{base}/register", json={"security_token": "test"})
            ).json()["created"]
            draw = await client.post(f"{admin}/draw")
            assert draw.status_code == 200
            assert (await client.get(f"{base}/me")).json()["registration"]["queue_position"] == 1
            confirmation = await client.post(f"{base}/confirm")
            assert confirmation.json()["ticket_confirmed"]
            assert (await client.post(f"{base}/confirm")).json() == confirmation.json()
            assert (await client.get(f"{admin}/status")).json()["confirmed"] == 1
            # Another authenticated account cannot read or confirm this ticket.
            stranger = await database.user()
            app.dependency_overrides[get_user] = lambda: User(stranger)
            assert (await client.get(f"{base}/me")).json()["registration"] is None
            assert (await client.post(f"{base}/confirm")).status_code == 404
            cors = await client.options(
                f"{base}/register",
                headers={
                    "Origin": "http://localhost:3000",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
                },
            )
            assert cors.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"
            paths = (await client.get("/openapi.json")).json()["paths"]
            assert len(paths) == 12
            assert "/api/v1/events/{event_id}/confirm" in paths


async def test_security_rejection_never_creates_registration(database):
    user_id = await database.user()
    event_id = await database.event()
    app = create_app(database.settings)
    app.dependency_overrides[get_user] = lambda: User(user_id)

    class RejectingSecurity:
        async def verify(self, token, user_id, event_id):
            return SecurityResult(False, user_id, event_id)

    async with app.router.lifespan_context(app):
        app.state.security = RejectingSecurity()
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            base = f"/api/v1/events/{event_id}"
            assert (
                await client.post(f"{base}/register", json={"security_token": "test"})
            ).status_code == 403
            assert (await client.get(f"{base}/me")).json()["registration"] is None
