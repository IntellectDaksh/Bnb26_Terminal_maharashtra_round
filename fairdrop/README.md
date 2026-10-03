# Fair Drop – SecOps / Simulation (Dev 1)

## Local benchmark of the current backend (Windows)

The original Locust scenarios below target the older API contract. For the current
`backend/` API, use `sim/local_benchmark.py`. It uses identities from
`data/identities.jsonl`, concurrent HTTP traffic, the real FastAPI application,
local ES256/JWKS verification, the SQL migrations, and isolated PostgreSQL.
No application `.env` or `local.env` is loaded. Cloudflare Siteverify responses
are simulated in the benchmark subprocess; development bypass is disabled.
This measures backend enforcement of challenge decisions, not real CAPTCHA detection.
The current backend now has Redis rate and device/network controls inspired by
`security/ratelimit.py`. The original report in `results/local-20261003T213733Z/`
is preserved as the baseline. Supply `--redis-url redis://localhost:6380/0` to
enable protection for a run; omit it to reproduce the baseline behavior.

From the repository root, after starting local PostgreSQL on port 55432:

```powershell
& backend/.venv/Scripts/python.exe fairdrop/sim/local_benchmark.py
```

Default workload: 1,000 human identities; 30 forged-challenge bots; 30
unauthenticated bots; 100 accounts from 10 multi-account clusters; 10 duplicate
accounts with five concurrent registration attempts each; 10 authenticated
flood accounts with 100 polls each. Client concurrency is 50; database pool is 5;
one API worker listens on 127.0.0.1:18000. Override `--humans`, `--concurrency`,
`--flood-requests`, `--pool-size`, `--api-port`, or `--db-port` as needed.
The client shuffles identities with seed 1337; the backend draw remains random.
Device signals from the dataset are sent to the actual backend. All HTTP clients share
localhost, so the human cohort also exercises a shared network. Use `--sustained-seconds 30`
for sustained polling. Every measured request records the server's retry header.
Human journeys issue a registration and status read, then confirm only if offered.
Original five-minute arrival timing is not used in this finite burst workload.

Results go into a new timestamped `results/local-*/` folder:

- `report.html`: standalone shareable report (browser Print can save a PDF).
- `report.md`: the complete report in Markdown.
- `metrics.json`: configuration, per-scenario rates, latency, response codes, and database checks.
- `requests.jsonl`: measured request outcomes, without access tokens or secrets.

Run the matched comparison matrix (concurrency 25/50/100 and a 30-second sustained
case at 50, with and without protection):

```powershell
& backend/.venv/Scripts/python.exe fairdrop/sim/compare_security.py --redis-url redis://localhost:6380/0
```

Its new `results/comparison-*/report.md` links every underlying run and compares
bot registration, attacker ticket share, human success, human p95, registration p95,
and errors. Single random draws are descriptive; ticket-share significance requires
repeated draws. The matrix requires local PostgreSQL and real local Redis.

Each run creates a unique database ending in `_test` and retains it for inspection;
it never resets an existing application database. The local cluster must use the
benchmark owner `fairdrop_test` and allow the restricted `fairdrop_api` role on
loopback. The root `backend/.local-loadtest/` folder contains the isolated cluster
created for this experiment and is ignored by Git. The benchmark stops its API
subprocess when done; PostgreSQL remains running.

Metric regression checks, from `fairdrop/`:

```powershell
& ../backend/.venv/Scripts/python.exe -m pytest tests/test_local_benchmark.py -q
```

The older deployment instructions below are retained for reference.

## API contract (what the simulator and backend must agree on)
| Endpoint | Notes |
|---|---|
| POST /api/register `{email, device_fp, turnstile_token}` | 200/201 `{session, existing}`; 403 challenge, 423 closed, 429 limited |
| GET /api/queue/status (Bearer session) | `{state: waiting|admitted|closed|sold_out, admission_token?}` |
| POST /api/reserve `{admission_token}` | 200 `{reservation_id}` once per token (`consume_admission`) |
| POST /api/confirm `{reservation_id}` | 200 |
| GET /admin/allocations, POST /admin/close, POST /admin/reset | header `X-Admin-Token`; allocations = `[{email|id, seat}]` |

## Integration
- Backend: `app.add_middleware(Guard, limiter=Limiter(redis))`, `Depends(guard_registration)` on register, `require_session` elsewhere, `issue_admission` + `consume_admission` for queue→reserve hand-off, `encrypt_pii` for stored email. See `app_example.py`. Seat claiming must be atomic (Redis Lua or DB row lock).
- Frontend: render the Turnstile widget, send its token as `turnstile_token`; honour `Retry-After` on 429; send `device_fp`.
- Dashboard (Dev 2): read Redis (`rediss://sim:...`) keys `metrics:fair`, `metrics:fifo`, `metrics:latest`, or subscribe to channel `metrics:feed`. JSON schema = `results/<run>/metrics.json`. Report: `results/report.md`.

## Run order
1. `bash infra/provision.sh` → `setup_target.sh` → `setup_loadgen.sh` (scp `loadgen.env` + `cert.pem`).
2. `python sim/identities.py` (50,000: 42,500 legit, 500×10 multi-account, 1,500 speed, 500 flood, 500 duplicate-session).
3. Target: `systemctl start fairdrop-fair`; loadgen: `bash sim/run_sim.sh fair`. Repeat with `fairdrop-fifo` / `fifo`.
4. `python sim/analyze.py --report fair fifo`.

## Safety notes
- `ENV=test` sim shortcuts (`sim.` Turnstile tokens, `X-Sim-Client-IP`) are inert when `ENV=prod`. Production: real Turnstile keys, `TURNSTILE_HOSTNAME`, Let's Encrypt, Cloudflare real-IP config, remove admin routes from the public listener.
- The load generator targets only the VPC (firewall-enforced). Never point it at external hosts.
