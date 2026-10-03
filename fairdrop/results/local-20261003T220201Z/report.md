# Fair Drop — local bot and human traffic report

Run: 2026-10-03T22:01:30.352368+00:00 · **Redis rate and device/network protection**

**Bot requests blocked: 80.08%** (1170/1461).
**Human registration success: 100.0%** (1000/1000).

## Scenario results

| Scenario | Requests | Defense blocks | Block % | Registered / attempted identities | p95 ms | Server/network errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dup | 62 | 20 | 32.26% | 10 / 10 | 1971.49 | 0 |
| flood | 1013 | 950 | 93.78% | 10 / 10 | 2166.25 | 0 |
| legit | 2189 | 0 | 0.0% | 1000 / 1000 | 2100.61 | 0 |
| multi | 206 | 80 | 38.83% | 20 / 100 | 2054.23 | 0 |
| speed | 90 | 30 | 33.33% | 0 / 30 | 1683.35 | 0 |
| unauthenticated | 90 | 90 | 100.0% | 0 / 30 | 1730.42 | 0 |

### Registration defense blocking by scenario

| Scenario | Identities blocked by defense % | Identity registration success % |
| --- | ---: | ---: |
| dup | 0.0% | 100.0% |
| flood | 0.0% | 100.0% |
| legit | 0.0% | 100.0% |
| multi | 80.0% | 20.0% |
| speed | 100.0% | 0.0% |
| unauthenticated | 100.0% | 0.0% |

### HTTP response breakdown

| Scenario | Status counts | Rejection reasons |
| --- | --- | --- |
| dup | {"200": 42, "429": 20} | {"rate_limited": 20} |
| flood | {"200": 63, "429": 950} | {"rate_limited": 950} |
| legit | {"200": 2189} | {} |
| multi | {"200": 126, "429": 80} | {"registration_abuse": 80} |
| speed | {"403": 30, "200": 30, "404": 30} | {"security_rejected": 30, "registration_not_found": 30} |
| unauthenticated | {"401": 90} | {"authentication_required": 45, "invalid_token": 45} |

## What the scenarios mean

- legit: authenticated identities with a simulated solved challenge; register, poll, and confirm if offered.
- speed: authenticated identities with forged challenges, plus attempts to confirm without registering.
- unauthenticated: missing or forged bearer tokens attempting registration and status reads.
- flood: authenticated, solved-challenge bots repeatedly poll the status endpoint without delays.
- multi: distinct authenticated accounts with solved challenges, grouped by a shared device/IP label.
- dup: solved-challenge bots submit five concurrent registrations for the same account.

## Findings

- Missing/forged authentication and forged challenge decisions are measured separately from valid-challenge bots.
- Authenticated flood polling: 93.78% blocked; Redis protection enabled.
- Valid-challenge multi-account bots: 20.0% registered; device signals supplied to the backend.
- All HTTP clients share localhost, exercising shared-network humans with distinct device signals.
- Duplicate retries produced 10 database entries for 10 accounts; idempotency prevents duplicate entries, not bot access.
- Confirmed tickets: 200 of capacity 200. Ticket winners depend on the randomized draw.
- Confirmed tickets by scenario: {'legit': 189, 'multi': 6, 'flood': 3, 'dup': 2}.

## Database verification

```json
{
  "tickets_by_role": {
    "legit": 189,
    "multi": 6,
    "flood": 3,
    "dup": 2
  },
  "registration_rows": 1040,
  "human_rows": 1000,
  "invalid_challenge_bot_rows": 0,
  "unauthenticated_bot_rows": 0,
  "duplicate_bot_rows": 10,
  "capacity": 200,
  "confirmed_tickets": 200
}
```

## Configuration

```json
{
  "humans": 1000,
  "concurrency": 100,
  "flood_requests": 100,
  "pool_size": 5,
  "db_port": 55432,
  "api_port": 18000,
  "seed": 1337,
  "sustained_seconds": 0.0,
  "redis_protection": true,
  "database": "fairdrop_security_adaadc9f90d94d6db5bf2ad28d539da8_test",
  "postgres": "PostgreSQL 18.6 on x86_64-windows, compiled by msvc-19.44.35228, 64-bit",
  "python": "3.12.14",
  "platform": "Windows-11-10.0.26200-SP0",
  "api_workers": 1,
  "environment": "test",
  "env_files_loaded": false,
  "development_bypass": false,
  "challenge": "simulated Siteverify transport; real TurnstileVerifier",
  "auth": "ES256; local JWKS",
  "mixed_seconds": 24.206,
  "mixed_requests": 3450,
  "mixed_rps": 142.52,
  "identity_sha256": "2d42f81bd5ed8a9638718cea093470e1ceb35e4bcdfdd087c5d437c512a7138d",
  "migrations": [
    "20261003182932_fairdrop_core.sql",
    "20261003185217_backend_login_and_reservation_index.sql"
  ]
}
```

## Scope and measurement

This tests the actual backend routes, ES256 token verification, SQL migrations, restricted application database role, registration transactions, draw and confirmation against local PostgreSQL. Cloudflare Siteverify responses are simulated: sim.solved receives success; forged challenges receive rejection. No real CAPTCHA solving, Google sign-in, browser behavior or cloud service is measured. Ground-truth bot/human labels are assigned by the generator; the app does not receive those labels.

Defense blocks count explicit authentication/challenge rejections and HTTP 429. Validation errors, business-rule conflicts, missing registrations, server errors and timeouts are not counted as bot detection. Duplicate registrations that safely return the existing entry are successful idempotent requests, not blocked bots. No ticket offer is a capacity outcome, not a human rejection.

The headline block percentage is request-weighted and specific to this workload. Identity registration success is reported separately. Requests use a bounded closed-loop client; latency excludes waiting for a client slot. API, database and generator share one host. This is a finite local functional/load benchmark, not a production capacity or general bot-detection claim.
