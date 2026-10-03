# Fair Drop — local bot and human traffic report

Run: 2026-10-03T22:02:03.158656+00:00 · **Baseline: abuse protection disabled**

**Bot requests blocked: 3.98%** (120/3014).
**Human registration success: 100.0%** (1000/1000).

## Scenario results

| Scenario | Requests | Defense blocks | Block % | Registered / attempted identities | p95 ms | Server/network errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dup | 63 | 0 | 0.0% | 10 / 10 | 843.88 | 0 |
| flood | 2548 | 0 | 0.0% | 10 / 10 | 46.38 | 0 |
| legit | 2174 | 0 | 0.0% | 1000 / 1000 | 912.56 | 0 |
| multi | 223 | 0 | 0.0% | 100 / 100 | 855.04 | 0 |
| speed | 90 | 30 | 33.33% | 0 / 30 | 742.72 | 0 |
| unauthenticated | 90 | 90 | 100.0% | 0 / 30 | 682.02 | 0 |

### Registration defense blocking by scenario

| Scenario | Identities blocked by defense % | Identity registration success % |
| --- | ---: | ---: |
| dup | 0.0% | 100.0% |
| flood | 0.0% | 100.0% |
| legit | 0.0% | 100.0% |
| multi | 0.0% | 100.0% |
| speed | 100.0% | 0.0% |
| unauthenticated | 100.0% | 0.0% |

### HTTP response breakdown

| Scenario | Status counts | Rejection reasons |
| --- | --- | --- |
| dup | {"200": 63} | {} |
| flood | {"200": 2548} | {} |
| legit | {"200": 2174} | {} |
| multi | {"200": 223} | {} |
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
- Authenticated flood polling: 0.0% blocked; Redis protection disabled.
- Valid-challenge multi-account bots: 100.0% registered; device signals supplied to the backend.
- All HTTP clients share localhost, exercising shared-network humans with distinct device signals.
- Duplicate retries produced 10 database entries for 10 accounts; idempotency prevents duplicate entries, not bot access.
- Confirmed tickets: 200 of capacity 200. Ticket winners depend on the randomized draw.
- Confirmed tickets by scenario: {'legit': 174, 'multi': 23, 'dup': 3}.

## Database verification

```json
{
  "tickets_by_role": {
    "legit": 174,
    "multi": 23,
    "dup": 3
  },
  "registration_rows": 1120,
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
  "concurrency": 50,
  "flood_requests": 100,
  "pool_size": 5,
  "db_port": 55432,
  "api_port": 18000,
  "seed": 1337,
  "sustained_seconds": 30.0,
  "redis_protection": false,
  "database": "fairdrop_security_65c05c40b08e416b8da9a649c611d1f9_test",
  "postgres": "PostgreSQL 18.6 on x86_64-windows, compiled by msvc-19.44.35228, 64-bit",
  "python": "3.12.14",
  "platform": "Windows-11-10.0.26200-SP0",
  "api_workers": 1,
  "environment": "test",
  "env_files_loaded": false,
  "development_bypass": false,
  "challenge": "simulated Siteverify transport; real TurnstileVerifier",
  "auth": "ES256; local JWKS",
  "mixed_seconds": 39.783,
  "mixed_requests": 4988,
  "mixed_rps": 125.38,
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
