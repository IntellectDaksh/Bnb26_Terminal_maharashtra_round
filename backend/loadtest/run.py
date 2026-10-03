"""Run with: python -m loadtest.run. Never reads application .env files."""

import argparse
import asyncio
import json
import math
import multiprocessing
import platform
import socket
import time
from collections import Counter
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import asyncpg
import httpx
import jwt
import uvicorn
from cryptography.hazmat.primitives.asymmetric import ec

from app.core.config import Settings
from app.main import create_app
from app.security.turnstile import TurnstileVerifier

ROOT = Path(__file__).resolve().parents[2]


def serve(
    database_url,
    pool_size,
    port,
    jwk,
    simulated_challenge=False,
    redis_url=None,
    abuse_namespace="fairdrop-benchmark",
):
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=database_url,
        database_ssl=False,
        database_pool_size=pool_size,
        supabase_url=f"http://127.0.0.1:{port}",
        security_allow_development=not simulated_challenge,
        turnstile_secret_key="local-test-only" if simulated_challenge else None,
        turnstile_expected_hostname="localhost" if simulated_challenge else None,
        redis_url=redis_url,
        abuse_protection_enabled=bool(redis_url),
        abuse_key_secret="local-benchmark-secret-at-least-32-characters" if redis_url else None,
        abuse_namespace=abuse_namespace,
    )
    app = create_app(settings)
    if simulated_challenge:
        original_lifespan = app.router.lifespan_context

        def siteverify(request):
            if str(request.url) != "https://challenges.cloudflare.com/turnstile/v0/siteverify":
                raise RuntimeError("Unexpected external request in local benchmark")
            payload = json.loads(request.content)
            return httpx.Response(
                200,
                json={
                    "success": payload.get("response") == "sim.solved",
                    "action": "register",
                    "hostname": "localhost",
                },
            )

        @asynccontextmanager
        async def local_lifespan(application):
            async with original_lifespan(application):
                async with httpx.AsyncClient(transport=httpx.MockTransport(siteverify)) as http:
                    application.state.security = TurnstileVerifier(settings, http)
                    yield

        app.router.lifespan_context = local_lifespan

    @app.get("/auth/v1/.well-known/jwks.json", include_in_schema=False)
    async def keys():
        return {"keys": [jwk]}

    uvicorn.run(app, host="127.0.0.1", port=port, access_log=False, log_level="warning")


def percentile(values, fraction):
    ordered = sorted(values)
    return round(ordered[max(0, math.ceil(len(ordered) * fraction) - 1)], 2)


async def benchmark(args):
    # Fixed loopback destination and generated database name: no cloud targets accepted.
    dbname = f"fairdrop_load_{uuid4().hex}_test"
    connection_args = {
        "host": "127.0.0.1",
        "port": args.db_port,
        "user": "fairdrop_test",
        "database": "postgres",
        "ssl": False,
    }
    owner = await asyncpg.connect(**connection_args)
    try:
        await owner.execute(f'CREATE DATABASE "{dbname}"')
    finally:
        await owner.close()
    connection_args["database"] = dbname
    db = await asyncpg.connect(**connection_args)
    process = None
    try:
        await db.execute("""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN
                    CREATE ROLE anon NOLOGIN;
                END IF;
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN
                    CREATE ROLE authenticated NOLOGIN;
                END IF;
            END $$;
            CREATE SCHEMA auth;
            CREATE TABLE auth.users (id UUID PRIMARY KEY);
        """)
        for migration in sorted((ROOT / "supabase/migrations").glob("*.sql")):
            async with db.transaction():
                await db.execute(migration.read_text(encoding="utf-8"))
        # Benchmark through the application's restricted role, not the migration owner.
        await db.execute("ALTER ROLE fairdrop_api LOGIN")
        database_url = f"postgresql+asyncpg://fairdrop_api@127.0.0.1:{args.db_port}/{dbname}"
        private_key = ec.generate_private_key(ec.SECP256R1())
        jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key()))
        jwk.update(kid="local-loadtest", alg="ES256", use="sig")
        process = multiprocessing.Process(
            target=serve, args=(database_url, args.pool_size, args.api_port, jwk)
        )
        process.start()
        base = f"http://127.0.0.1:{args.api_port}"
        records = []
        invariants = []
        async with httpx.AsyncClient(
            base_url=base,
            timeout=60,
            trust_env=False,
            limits=httpx.Limits(
                max_connections=max(args.concurrency), max_keepalive_connections=100
            ),
        ) as client:
            for _ in range(100):
                if not process.is_alive():
                    raise RuntimeError("Benchmark API failed to start")
                try:
                    response = await client.get("/health/ready")
                    if response.status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.1)
            else:
                raise RuntimeError("Benchmark API readiness timed out")

            def token(user):
                return jwt.encode(
                    {
                        "sub": str(user),
                        "iss": f"{base}/auth/v1",
                        "aud": "authenticated",
                        "role": "authenticated",
                        "exp": int(time.time()) + 3600,
                    },
                    private_key,
                    algorithm="ES256",
                    headers={"kid": "local-loadtest"},
                )

            for concurrency in args.concurrency:
                event, admin = uuid4(), uuid4()
                users = [uuid4() for _ in range(args.users)]
                capacity = max(1, args.users // 5)
                await db.executemany(
                    "INSERT INTO auth.users (id) VALUES ($1)", [(user,) for user in [admin, *users]]
                )
                await db.execute("INSERT INTO fairdrop.administrators (user_id) VALUES ($1)", admin)
                await db.execute(
                    """
                    INSERT INTO fairdrop.events
                        (id,name,capacity,status,registration_opens_at,registration_closes_at)
                    VALUES ($1,'Local load test',$2,'OPEN',
                            clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour')
                """,
                    event,
                    capacity,
                )
                headers = [{"Authorization": f"Bearer {token(user)}"} for user in users]
                admin_headers = {"Authorization": f"Bearer {token(admin)}"}
                path = f"/api/v1/events/{event}"
                # Warm the real ES256/JWKS verification path, outside timed stages.
                warm = await client.get(f"{path}/me", headers=headers[0])
                warm.raise_for_status()

                async def stage(name, method, url, identities, body=None, concurrency=concurrency):
                    semaphore = asyncio.Semaphore(concurrency)
                    samples, codes, errors = [], Counter(), []

                    async def request(identity):
                        async with semaphore:
                            started = time.perf_counter()
                            try:
                                result = await client.request(
                                    method, url, headers=identity, json=body
                                )
                                codes[str(result.status_code)] += 1
                                if not 200 <= result.status_code < 300 and len(errors) < 5:
                                    errors.append(result.text[:300])
                            except httpx.HTTPError as exc:
                                codes["transport_error"] += 1
                                if len(errors) < 5:
                                    errors.append(type(exc).__name__)
                            samples.append((time.perf_counter() - started) * 1000)

                    started = time.perf_counter()
                    await asyncio.gather(*(request(identity) for identity in identities))
                    elapsed = time.perf_counter() - started
                    failures = sum(
                        count
                        for code, count in codes.items()
                        if not code.isdigit() or not 200 <= int(code) < 300
                    )
                    row = {
                        "stage": name,
                        "concurrency": concurrency,
                        "requests": len(samples),
                        "seconds": round(elapsed, 3),
                        "rps": round(len(samples) / elapsed, 2),
                        "p50_ms": percentile(samples, 0.5),
                        "p95_ms": percentile(samples, 0.95),
                        "p99_ms": percentile(samples, 0.99),
                        "max_ms": round(max(samples), 2),
                        "failures": failures,
                        "status_codes": dict(codes),
                        "errors": errors,
                    }
                    records.append(row)
                    print(json.dumps(row), flush=True)

                await stage(
                    "register",
                    "POST",
                    f"{path}/register",
                    headers,
                    {"security_token": "local-benchmark"},
                )
                await stage(
                    "register_retry",
                    "POST",
                    f"{path}/register",
                    headers,
                    {"security_token": "local-benchmark"},
                )
                await stage("event_read", "GET", path, headers)
                closed = await client.post(
                    f"/api/v1/admin/events/{event}/close", headers=admin_headers
                )
                closed.raise_for_status()
                await stage("draw", "POST", f"/api/v1/admin/events/{event}/draw", [admin_headers])
                await stage("participant_poll", "GET", f"{path}/me", headers * args.poll_rounds)
                offered = await db.fetch(
                    """
                    SELECT r.user_id FROM fairdrop.registrations r
                    JOIN fairdrop.reservations s ON s.registration_id=r.id
                    WHERE r.event_id=$1 AND s.status='OFFERED'
                """,
                    event,
                )
                winner_headers = [
                    {"Authorization": f"Bearer {token(row['user_id'])}"} for row in offered
                ]
                if winner_headers:
                    await stage("confirm", "POST", f"{path}/confirm", winner_headers)
                    await stage("confirm_retry", "POST", f"{path}/confirm", winner_headers)
                snapshot = dict(
                    await db.fetchrow(
                        """
                    SELECT (SELECT count(*) FROM fairdrop.registrations
                            WHERE event_id=$1) AS registrations,
                           (SELECT count(DISTINCT queue_position) FROM fairdrop.registrations
                            WHERE event_id=$1) AS ranked,
                           (SELECT count(*) FROM fairdrop.reservations
                            WHERE event_id=$1 AND status='CONFIRMED') AS confirmed,
                           (SELECT count(*) FROM fairdrop.reservations
                            WHERE event_id=$1 AND status IN ('CONFIRMED','OFFERED')) AS allocated
                """,
                        event,
                    )
                )
                passed = (
                    snapshot["registrations"] == args.users
                    and snapshot["ranked"] == args.users
                    and snapshot["confirmed"] == capacity
                    and snapshot["allocated"] == capacity
                )
                invariants.append(
                    {"concurrency": concurrency, "capacity": capacity, "passed": passed, **snapshot}
                )
                # Finish a failed stage's event too, so the next level can run independently.
                await db.execute("UPDATE fairdrop.events SET status='CANCELLED' WHERE id=$1", event)

        report = {
            "created_at_utc": datetime.now(UTC).isoformat(),
            "config": {
                **vars(args),
                "database": dbname,
                "postgres": await db.fetchval("SELECT version()"),
                "platform": platform.platform(),
                "python": platform.python_version(),
                "api_workers": 1,
                "db_tls": False,
                "auth": "real ES256 verification, local JWKS",
                "security": "development bypass",
                "env_files_loaded": False,
            },
            "results": records,
            "invariants": invariants,
            "passed": all(row["failures"] == 0 for row in records)
            and all(row["passed"] for row in invariants),
        }
        output = ROOT / "docs/load-testing"
        output.mkdir(parents=True, exist_ok=True)
        (output / "latest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        lines = [
            "# Local API load test",
            "",
            f"Run: {report['created_at_utc']}",
            f"Result: {'PASS' if report['passed'] else 'FAIL'}",
            "",
            "## Configuration",
            "",
            "```json",
            json.dumps(report["config"], indent=2),
            "```",
            "",
            "## Measurements",
            "",
            "| Stage | Concurrency | Requests | RPS | p50 ms | p95 ms | p99 ms | Failures |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
        for row in records:
            lines.append(
                "| "
                + " | ".join(
                    str(row[key])
                    for key in (
                        "stage",
                        "concurrency",
                        "requests",
                        "rps",
                        "p50_ms",
                        "p95_ms",
                        "p99_ms",
                        "failures",
                    )
                )
                + " |"
            )
        lines += [
            "",
            "## Allocation checks",
            "",
            "```json",
            json.dumps(invariants, indent=2),
            "```",
            "",
            "## Interpretation",
            "",
            "Finite, closed-loop bursts against one event at each concurrency level. "
            "Latency starts when a client slot is available; client semaphore wait is excluded. "
            "The API runs in a separate process, but client, API and database share this machine. "
            "These results do not predict cloud capacity. No frontend, Google OAuth, real "
            "Supabase Auth service, Turnstile, expiration worker, soak test or open-loop "
            "arrival rate is covered. Draw is a single administrative request per level. "
            "Error details and status counts are in latest.json.",
        ]
        (output / "latest.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"Report: {output / 'latest.md'}")
        return report["passed"]
    finally:
        if process is not None:
            process.terminate()
            process.join(timeout=10)
        await db.close()
        # The unique test database is retained for inspection. No existing database is reset.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--users", type=int, default=500)
    parser.add_argument("--concurrency", type=int, nargs="+", default=[10, 50, 100])
    parser.add_argument("--pool-size", type=int, choices=range(1, 51), default=5)
    parser.add_argument("--poll-rounds", type=int, default=5)
    parser.add_argument("--db-port", type=int, default=55432)
    parser.add_argument("--api-port", type=int, default=18000)
    args = parser.parse_args()
    if args.users < 1 or args.poll_rounds < 1 or min(args.concurrency) < 1:
        parser.error("users, poll-rounds and concurrency must be positive")
    # Refuse an occupied API port before allocating a database.
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", args.api_port))
    raise SystemExit(0 if asyncio.run(benchmark(args)) else 1)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
