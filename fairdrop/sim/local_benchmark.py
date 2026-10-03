"""Windows-compatible, cloud-free benchmark of the real FastAPI backend.

Run from fairdrop: ../backend/.venv/Scripts/python.exe sim/local_benchmark.py
"""

import argparse
import asyncio
import hashlib
import html
import json
import multiprocessing
import platform
import random
import socket
import sys
import time
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import asyncpg
import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import ec

PROJECT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT / "backend"))
from loadtest.run import percentile, serve

LOCAL = Path(__file__).resolve().parents[1]
DEFENSE_CODES = {"authentication_required", "invalid_token", "security_rejected"}


def summarize(rows):
    roles = {}
    for role in sorted({row["role"] for row in rows}):
        subset = [row for row in rows if row["role"] == role]
        registrations = [row for row in subset if row["endpoint"] == "register"]
        attempted = {row["id"] for row in registrations}
        accepted = {row["id"] for row in registrations if 200 <= row["status"] < 300}
        blocked = sum(
            row["code"] in DEFENSE_CODES or row["status"] == 429 for row in subset
        )
        roles[role] = {
            "requests": len(subset),
            "defense_rejections": blocked,
            "request_block_pct": round(100 * blocked / len(subset), 2),
            "successful_requests": sum(200 <= row["status"] < 300 for row in subset),
            "server_or_transport_errors": sum(
                row["status"] == 0 or row["status"] >= 500 for row in subset
            ),
            "registration_identities_attempted": len(attempted),
            "registration_identities_accepted": len(accepted),
            "registration_defense_block_pct": round(
                100
                * len(
                    {
                        row["id"]
                        for row in registrations
                        if row["code"] in DEFENSE_CODES or row["status"] == 429
                    }
                    - accepted
                )
                / len(attempted),
                2,
            )
            if attempted
            else None,
            "registration_accept_pct": round(100 * len(accepted) / len(attempted), 2)
            if attempted
            else None,
            "statuses": dict(Counter(str(row["status"]) for row in subset)),
            "reasons": dict(Counter(row["code"] for row in subset if row["code"])),
            "p50_ms": percentile([row["ms"] for row in subset], 0.5),
            "p95_ms": percentile([row["ms"] for row in subset], 0.95),
            "registration_p95_ms": percentile([row["ms"] for row in registrations], 0.95)
            if registrations else None,
            "p99_ms": percentile([row["ms"] for row in subset], 0.99),
        }
    return roles


def write_report(output, report):
    output.mkdir(parents=True, exist_ok=True)
    (output / "metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    metrics = report["roles"]
    lines = [
        "# Fair Drop — local bot and human traffic report",
        "",
        f"Run: {report['started_utc']} · **{report['verdict']}**",
        "",
        (
            f"**Bot requests blocked: {report['bot_request_block_pct']}%** "
            f"({report['bot_blocked_requests']}/{report['bot_requests']})."
        ),
        (
            f"**Human registration success: {metrics['legit']['registration_accept_pct']}%** "
            f"({metrics['legit']['registration_identities_accepted']}/"
            f"{metrics['legit']['registration_identities_attempted']})."
        ),
        "",
        "## Scenario results",
        "",
        "| Scenario | Requests | Defense blocks | Block % | Registered / attempted identities | p95 ms | Server/network errors |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for role, m in metrics.items():
        lines.append(
            f"| {role} | {m['requests']} | {m['defense_rejections']} | {m['request_block_pct']}% | "
            f"{m['registration_identities_accepted']} / {m['registration_identities_attempted']} | "
            f"{m['p95_ms']} | {m['server_or_transport_errors']} |"
        )
    lines += [
        "",
        "### Registration defense blocking by scenario",
        "",
        "| Scenario | Identities blocked by defense % | Identity registration success % |",
        "| --- | ---: | ---: |",
        *[
            f"| {role} | {m['registration_defense_block_pct']}% | {m['registration_accept_pct']}% |"
            for role, m in metrics.items()
        ],
        "",
        "### HTTP response breakdown",
        "",
        "| Scenario | Status counts | Rejection reasons |",
        "| --- | --- | --- |",
        *[
            f"| {role} | {json.dumps(m['statuses'])} | {json.dumps(m['reasons'])} |"
            for role, m in metrics.items()
        ],
        "",
        "## What the scenarios mean",
        "",
        "- legit: authenticated identities with a simulated solved challenge; register, poll, and confirm if offered.",
        "- speed: authenticated identities with forged challenges, plus attempts to confirm without registering.",
        "- unauthenticated: missing or forged bearer tokens attempting registration and status reads.",
        "- flood: authenticated, solved-challenge bots repeatedly poll the status endpoint without delays.",
        "- multi: distinct authenticated accounts with solved challenges, grouped by a shared device/IP label.",
        "- dup: solved-challenge bots submit five concurrent registrations for the same account.",
        "",
        "## Findings",
        "",
        *[f"- {finding}" for finding in report["findings"]],
        "",
        "## Database verification",
        "",
        "```json",
        json.dumps(report["database_checks"], indent=2),
        "```",
        "",
        "## Configuration",
        "",
        "```json",
        json.dumps(report["config"], indent=2),
        "```",
        "",
        "## Scope and measurement",
        "",
        (
            "This tests the actual backend routes, ES256 token verification, SQL migrations, restricted "
            "application database role, registration transactions, draw and confirmation against local PostgreSQL. "
            "Cloudflare Siteverify responses are simulated: sim.solved receives success; forged challenges receive rejection. "
            "No real CAPTCHA solving, Google sign-in, browser behavior or cloud service is measured. "
            "Ground-truth bot/human labels are assigned by the generator; the app does not receive those labels."
        ),
        "",
        (
            "Defense blocks count explicit authentication/challenge rejections and HTTP 429. "
            "Validation errors, business-rule conflicts, missing registrations, server errors and timeouts "
            "are not counted as bot detection. Duplicate registrations that safely return the existing entry "
            "are successful idempotent requests, not blocked bots. No ticket offer is a capacity outcome, not a human rejection."
        ),
        "",
        (
            "The headline block percentage is request-weighted and specific to this workload. "
            "Identity registration success is reported separately. Requests use a bounded closed-loop client; "
            "latency excludes waiting for a client slot. API, database and generator share one host. "
            "This is a finite local functional/load benchmark, not a production capacity or general bot-detection claim."
        ),
    ]
    markdown = "\n".join(lines) + "\n"
    (output / "report.md").write_text(markdown, encoding="utf-8")
    table = "".join(
        f"<tr><td>{html.escape(role)}</td><td>{m['requests']:,}</td><td>{m['request_block_pct']}%</td>"
        f"<td>{m['registration_identities_accepted']} / {m['registration_identities_attempted']}</td>"
        f"<td>{m['p95_ms']}</td><td>{m['server_or_transport_errors']}</td></tr>"
        for role, m in metrics.items()
    )
    page = f"""<!doctype html><html lang="en"><meta charset="utf-8"><title>Fair Drop local benchmark</title>
    <style>body{{font:16px system-ui;background:#edf2f7;color:#182738;margin:0}}main{{max-width:1050px;margin:40px auto;background:white;padding:42px;border-radius:16px}}h1{{font-size:32px}}.cards{{display:flex;gap:20px}}.card{{flex:1;background:#eef4fb;padding:24px;border-radius:12px}}strong{{font-size:32px;display:block}}table{{border-collapse:collapse;width:100%;margin:25px 0}}td,th{{text-align:left;padding:12px;border-bottom:1px solid #ddd}}pre{{white-space:pre-wrap;font:14px system-ui;line-height:1.6}}small{{color:#526478}}@media print{{body{{background:white}}main{{margin:0;padding:10px}}}}</style>
    <main><small>LOCAL BACKEND BENCHMARK · {html.escape(report["started_utc"])}</small>
    <h1>Fair Drop: bot resistance and human access</h1><p>{html.escape(report["verdict"])}</p>
    <p><b>Real localhost backend and database. Synthetic traffic and simulated challenge decisions.</b></p>
    <div class="cards"><div class="card"><strong>{report["bot_request_block_pct"]}%</strong>Bot requests blocked<br><small>{report["bot_blocked_requests"]:,} of {report["bot_requests"]:,}</small></div>
    <div class="card"><strong>{metrics["legit"]["registration_accept_pct"]}%</strong>Human registration success<br><small>Simulated identities; simulated challenge decisions</small></div></div>
    <table><tr><th>Scenario</th><th>Requests</th><th>Blocked</th><th>Registered identities</th><th>p95 ms</th><th>Errors</th></tr>{table}</table>
    <h2>Findings</h2><ul>{"".join("<li>" + html.escape(f) + "</li>" for f in report["findings"])}</ul>
    <h2>Method, configuration and full detail</h2><pre>{html.escape(markdown)}</pre></main></html>"""
    (output / "report.html").write_text(page, encoding="utf-8")


async def run(args):
    started = datetime.now(UTC).isoformat()
    config = {
        "host": "127.0.0.1",
        "port": args.db_port,
        "user": "fairdrop_test",
        "ssl": False,
    }
    name = f"fairdrop_security_{uuid4().hex}_test"
    owner = await asyncpg.connect(**config, database="postgres")
    try:
        await owner.execute(f'CREATE DATABASE "{name}"')
    finally:
        await owner.close()
    db = await asyncpg.connect(**config, database=name)
    process = None
    rows = []
    try:
        await db.execute("""DO $$ BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
            END $$; CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY);""")
        migrations = sorted((PROJECT / "supabase/migrations").glob("*.sql"))
        for migration in migrations:
            async with db.transaction():
                await db.execute(migration.read_text(encoding="utf-8"))
        identities = [
            json.loads(line)
            for line in (LOCAL / "data/identities.jsonl").read_text().splitlines()
        ]
        subjects = []
        for role, count in {
            "legit": args.humans,
            "speed": 30,
            "flood": 10,
            "multi": 100,
            "dup": 10,
        }.items():
            selected = [i for i in identities if i["role"] == role]
            if role == "multi":
                selected.sort(key=lambda i: i["cluster"])
            if len(selected) < count:
                raise ValueError(f"Not enough {role} identities")
            subjects.extend({**i, "uuid": uuid4()} for i in selected[:count])
        subjects.extend(
            {"id": f"unauth-{i}", "role": "unauthenticated", "uuid": uuid4()}
            for i in range(30)
        )
        event, admin = uuid4(), uuid4()
        await db.executemany(
            "INSERT INTO auth.users (id) VALUES ($1)",
            [(i["uuid"],) for i in subjects] + [(admin,)],
        )
        await db.execute(
            "INSERT INTO fairdrop.administrators (user_id) VALUES ($1)", admin
        )
        capacity = max(1, args.humans // 5)
        await db.execute(
            """INSERT INTO fairdrop.events
            (id,name,capacity,status,registration_opens_at,registration_closes_at)
            VALUES ($1,'Local security benchmark',$2,'OPEN',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour')""",
            event,
            capacity,
        )
        key = ec.generate_private_key(ec.SECP256R1())
        jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(key.public_key()))
        jwk.update(kid="local-loadtest", alg="ES256", use="sig")
        url = f"http://127.0.0.1:{args.api_port}"
        process = multiprocessing.Process(
            target=serve,
            args=(
                f"postgresql+asyncpg://fairdrop_api@127.0.0.1:{args.db_port}/{name}",
                args.pool_size,
                args.api_port,
                jwk,
                True,
                args.redis_url,
                name,
            ),
        )
        process.start()
        for i in subjects + [{"uuid": admin}]:
            i["token"] = jwt.encode(
                {
                    "sub": str(i["uuid"]),
                    "iss": f"{url}/auth/v1",
                    "aud": "authenticated",
                    "role": "authenticated",
                    "exp": int(time.time()) + 3600,
                },
                key,
                algorithm="ES256",
                headers={"kid": "local-loadtest"},
            )
            if i["uuid"] == admin:
                admin_headers = {"Authorization": f"Bearer {i['token']}"}
        semaphore = asyncio.Semaphore(args.concurrency)
        async with httpx.AsyncClient(
            base_url=url,
            trust_env=False,
            timeout=60,
            limits=httpx.Limits(max_connections=args.concurrency),
        ) as client:
            for _ in range(150):
                if not process.is_alive():
                    raise RuntimeError("API subprocess failed")
                try:
                    if (await client.get("/health/ready")).status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.1)
            else:
                raise RuntimeError("API startup timeout")
            path = f"/api/v1/events/{event}"
            warm = await client.get(
                f"{path}/me",
                headers={"Authorization": f"Bearer {subjects[0]['token']}"},
            )
            warm.raise_for_status()

            async def request(i, endpoint, method="GET", body=None):
                async with semaphore:
                    tick = time.perf_counter()
                    headers = {"Authorization": f"Bearer {i['token']}"}
                    if i["role"] == "unauthenticated":
                        headers = (
                            {}
                            if int(i["id"].split("-")[1]) % 2
                            else {"Authorization": "Bearer forged"}
                        )
                    try:
                        response = await client.request(
                            method,
                            path
                            + (
                                "/register"
                                if endpoint == "register"
                                else "/confirm"
                                if endpoint == "confirm"
                                else "/me"
                            ),
                            headers=headers,
                            json=body,
                        )
                        data = response.json()
                        status, code = response.status_code, data.get("code", "")
                    except httpx.HTTPError as exc:
                        status, code = 0, type(exc).__name__
                    row = {
                        "role": i["role"],
                        "id": i["id"],
                        "endpoint": endpoint,
                        "status": status,
                        "code": code,
                        "ms": round((time.perf_counter() - tick) * 1000, 2),
                        "retry_after": response.headers.get("Retry-After") if status else None,
                    }
                    rows.append(row)
                    return status

            async def journey(i):
                body = {
                    "security_token": "forged" if i["role"] == "speed" else "sim.solved",
                    "device_fp": i.get("device_fp", "unauthenticated-device"),
                }
                if i["role"] == "dup":
                    await asyncio.gather(
                        *(request(i, "register", "POST", body) for _ in range(5))
                    )
                else:
                    await request(i, "register", "POST", body)
                if i["role"] == "flood":
                    if args.sustained_seconds:
                        deadline = time.perf_counter() + args.sustained_seconds
                        while time.perf_counter() < deadline:
                            await request(i, "status")
                            await asyncio.sleep(0.05)
                    else:
                        await asyncio.gather(
                            *(request(i, "status") for _ in range(args.flood_requests))
                        )
                elif i["role"] in ("speed", "unauthenticated"):
                    await request(i, "status")
                    await request(i, "confirm", "POST")
                else:
                    await request(i, "status")

            random.Random(args.seed).shuffle(subjects)
            tick = time.perf_counter()
            await asyncio.gather(*(journey(i) for i in subjects))
            elapsed = time.perf_counter() - tick
            mixed_requests = len(rows)
            print(
                f"Mixed traffic complete: {len(rows)} requests in {elapsed:.2f}s",
                flush=True,
            )
            for action in ("close", "draw"):
                response = await client.post(
                    f"/api/v1/admin/events/{event}/{action}", headers=admin_headers
                )
                response.raise_for_status()
            offered = {
                r["user_id"]
                for r in await db.fetch(
                    "SELECT user_id FROM fairdrop.registrations WHERE event_id=$1 AND status='OFFERED'",
                    event,
                )
            }
            await asyncio.gather(
                *(
                    request(i, "confirm", "POST")
                    for i in subjects
                    if i["uuid"] in offered
                )
            )
        actual = {
            r["user_id"]
            for r in await db.fetch(
                "SELECT user_id FROM fairdrop.registrations WHERE event_id=$1", event
            )
        }
        checks = {
            "tickets_by_role": dict(
                Counter(
                    r["role"]
                    for r in rows
                    if r["endpoint"] == "confirm" and 200 <= r["status"] < 300
                )
            ),
            "registration_rows": len(actual),
            "human_rows": sum(
                i["uuid"] in actual for i in subjects if i["role"] == "legit"
            ),
            "invalid_challenge_bot_rows": sum(
                i["uuid"] in actual for i in subjects if i["role"] == "speed"
            ),
            "unauthenticated_bot_rows": sum(
                i["uuid"] in actual for i in subjects if i["role"] == "unauthenticated"
            ),
            "duplicate_bot_rows": sum(
                i["uuid"] in actual for i in subjects if i["role"] == "dup"
            ),
            "capacity": capacity,
            "confirmed_tickets": await db.fetchval(
                "SELECT count(*) FROM fairdrop.reservations WHERE event_id=$1 AND status='CONFIRMED'",
                event,
            ),
        }
        metrics = summarize(rows)
        bots = [r for r in rows if r["role"] != "legit"]
        blocked = sum(r["code"] in DEFENSE_CODES or r["status"] == 429 for r in bots)
        findings = [
            "Missing/forged authentication and forged challenge decisions are measured separately from valid-challenge bots.",
            f"Authenticated flood polling: {metrics['flood']['request_block_pct']}% blocked; Redis protection {'enabled' if args.redis_url else 'disabled'}.",
            f"Valid-challenge multi-account bots: {metrics['multi']['registration_accept_pct']}% registered; device signals supplied to the backend.",
            "All HTTP clients share localhost, exercising shared-network humans with distinct device signals.",
            f"Duplicate retries produced {checks['duplicate_bot_rows']} database entries for 10 accounts; idempotency prevents duplicate entries, not bot access.",
            f"Confirmed tickets: {checks['confirmed_tickets']} of capacity {capacity}. Ticket winners depend on the randomized draw.",
            f"Confirmed tickets by scenario: {checks['tickets_by_role']}.",
        ]
        report = {
            "started_utc": started,
            "verdict": "Redis rate and device/network protection" if args.redis_url else "Baseline: abuse protection disabled",
            "bot_requests": len(bots),
            "bot_blocked_requests": blocked,
            "bot_request_block_pct": round(100 * blocked / len(bots), 2),
            "roles": metrics,
            "database_checks": checks,
            "findings": findings,
            "config": {
                **{k: v for k, v in vars(args).items() if k != "redis_url"},
                "redis_protection": bool(args.redis_url),
                "database": name,
                "postgres": await db.fetchval("SELECT version()"),
                "python": platform.python_version(),
                "platform": platform.platform(),
                "api_workers": 1,
                "environment": "test",
                "env_files_loaded": False,
                "development_bypass": False,
                "challenge": "simulated Siteverify transport; real TurnstileVerifier",
                "auth": "ES256; local JWKS",
                "mixed_seconds": round(elapsed, 3),
                "mixed_requests": mixed_requests,
                "mixed_rps": round(mixed_requests / elapsed, 2),
                "identity_sha256": hashlib.sha256(
                    (LOCAL / "data/identities.jsonl").read_bytes()
                ).hexdigest(),
                "migrations": [p.name for p in migrations],
            },
        }
        output = (
            LOCAL / "results" / f"local-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"
        )
        write_report(output, report)
        (output / "requests.jsonl").write_text(
            "".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8"
        )
        print(f"Report: {output / 'report.html'}", flush=True)
        print(
            json.dumps(
                {
                    k: report[k]
                    for k in ("verdict", "bot_request_block_pct", "database_checks")
                },
                indent=2,
            )
        )
    finally:
        if process:
            process.terminate()
            process.join(timeout=10)
        await db.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--humans", type=int, default=1000)
    parser.add_argument("--concurrency", type=int, default=50)
    parser.add_argument("--flood-requests", type=int, default=100)
    parser.add_argument("--pool-size", type=int, choices=range(1, 51), default=5)
    parser.add_argument("--db-port", type=int, default=55432)
    parser.add_argument("--api-port", type=int, default=18000)
    parser.add_argument("--seed", type=int, default=1337)
    parser.add_argument("--redis-url", help="Local Redis URL; omit to run baseline without protection")
    parser.add_argument("--sustained-seconds", type=float, default=0)
    args = parser.parse_args()
    if min(args.humans, args.concurrency, args.flood_requests) < 1 or args.sustained_seconds < 0:
        parser.error("counts must be positive")
    if args.redis_url:
        from urllib.parse import urlparse
        if urlparse(args.redis_url).hostname not in ("localhost", "127.0.0.1"):
            parser.error("benchmark Redis must be on loopback")
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", args.api_port))
    asyncio.run(run(args))


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
