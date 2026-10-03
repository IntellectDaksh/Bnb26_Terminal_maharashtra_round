# Fair Drop backend

Python 3.12+, FastAPI, SQLAlchemy asyncio, asyncpg, Supabase PostgreSQL.
`uv.lock` locks development/runtime dependencies. `requirements.lock` exports the runtime
dependencies and hashes for the Docker image.

## Setup

From `backend/`, run `uv sync --locked` and copy `.env.example` to `.env`.
Configure `DATABASE_URL` with the **asyncpg** prefix and a direct or session-pooler Supabase
connection. Use a percent-encoded database password. TLS certificate verification is on by
default; `DATABASE_SSL=false` is only for local PostgreSQL.
If the project uses Supabase's own CA, download it from Database Settings → SSL configuration,
save it under `certs/`, and set `DATABASE_SSL_CA_FILE=certs/supabase-ca.crt`. Hostname and CA
verification remain enabled. The Docker image also includes the `certs/` directory.

The Supabase project must use standard PostgreSQL. Keep `fairdrop` out of the Data API's
exposed schemas. Apply every SQL migration in `../supabase/migrations/` using the Supabase
CLI migration workflow or Dashboard SQL editor, as the migration owner. Application startup
does not create or change tables. Never create `auth.users` yourself on Supabase.

Configure `SUPABASE_URL` to the project origin. ES256 and RS256 access tokens are verified
with the project's JWKS, including issuer, audience, expiry, authenticated role and UUID
subject. JWKS lookup runs outside the event loop and caches keys for five minutes. Legacy
HS256 tokens are verified through the project's Auth server and require a publishable API key.
No JWT shared secret is needed.

In Supabase Auth, enable Google with your own Google OAuth client ID and secret. Add
`https://PROJECT_REF.supabase.co/auth/v1/callback` to Google's authorized redirects and
the frontend's `/auth/callback` URL to Supabase's redirect allow-list. Configure the same
project's public URL/key in `frontend/.env.local`. Real Google authentication requires these
external credentials; tests use signed test tokens or a dependency override.

## Security integration

For Cloudflare Turnstile, set `TURNSTILE_SECRET_KEY` in `backend/.env` and the matching
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` in `frontend/.env.local`. The backend posts challenge
tokens to Cloudflare Siteverify and requires the `register` action. Optionally set
`TURNSTILE_EXPECTED_HOSTNAME` to `localhost` or your deployed hostname for an exact match.
Allow that hostname in the Cloudflare widget settings. Expired or rejected challenges must
be completed again. A configured Turnstile secret takes priority over the external service
and always verifies tokens, even if the development bypass flag was previously enabled.
Restart the API and frontend after changing environment files. For containers, rebuild the
API with `docker compose up --build -d api`.

Without a Turnstile secret, the external verification integration remains available.
The security team's verification service receives a server-to-server POST:

```json
{"token":"browser challenge token","user_id":"trusted UUID","event_id":"event UUID"}
```

The request includes `Authorization: Bearer <SECURITY_VERIFICATION_SECRET>`.
The response must be HTTP 200 with **boolean** `allowed`, and matching `user_id` and
`event_id`. Tokens must be reusable for safe registration retries, or the external verifier must
cache its decision for the same user/event. Abuse controls below supplement this challenge check.
No configured verifier means registration fails closed with `security_unavailable`.

For explicit local experiments only, set `SECURITY_ALLOW_DEVELOPMENT=true`. Production
configuration rejects that bypass, plaintext database connections, and missing/HTTP security
verification URLs. Configure allowed frontend origins via `CORS_ORIGINS` (JSON array).

### Redis abuse protection

Set `ABUSE_PROTECTION_ENABLED=true`, `REDIS_URL` and a random `ABUSE_KEY_SECRET`
of at least 32 characters. All API workers must share these values. Production refuses
disabled protection. Docker Compose supplies an internal Redis service and enables the
guard; set the secret in `backend/.env`. Redis is not exposed on a host port in that stack.
For hosted Redis, use its authenticated `rediss://` URL. Keep Redis private and durable:
restarting an empty Redis resets the abuse budgets.

Atomic token buckets apply across events to the verified account, separately for registration
(3 immediate attempts, 1 token/20 seconds), status (5 immediate polls, 1 token/2 seconds), and
confirmation (3 immediate attempts, 1 token/2 seconds). Thirty rejected requests in a
60-second window trigger a fixed 60-second cooldown for that account and endpoint. Rejections
return `429` with integer `Retry-After`; Redis outages return `503` with `Retry-After: 5`
before SQL or challenge verification. Readiness checks Redis as well as PostgreSQL.
These controls run after authentication and before database connection checkout.

When protection is enabled, registration also requires `device_fp` (8–128 characters).
The live frontend persists a random browser identifier across account switches and respects
server cooldowns during both actions and automatic polling. After a solved challenge, atomic
sets count distinct accounts per event: default cap 2 for the same device/network pair and 6
for a device across networks, with a 24-hour window. Repeated accounts consume no extra
slots. Counts reflect challenge-approved attempts, including attempts whose later SQL
transaction fails. Redis keys contain HMAC digests rather than raw device/IP/user values.
There is no IP-only registration cap: distinct devices on a shared network remain eligible.
Thresholds are configurable in `.env.example`; shared-device households may require tuning.

The ASGI client address is used; the guard never trusts arbitrary forwarded headers.
When deploying behind a proxy, configure uvicorn's `--forwarded-allow-ips` with only the
actual proxy addresses, and restrict direct API access. The proxy must overwrite forwarded
headers. Browser IDs are weak signals that attackers can rotate. Edge controls are still
needed for unauthenticated floods, distributed account/device rotation, and public catalog
traffic. This is abuse reduction, not a proof that an authenticated account belongs to a human.

For an explicit small live Siteverify check, run `uv run python -m loadtest.turnstile_smoke`.
It uses Cloudflare's public [testing keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/),
never loads application credentials, and writes `fairdrop/results/turnstile-live-smoke.json`.
It checks real HTTPS responses and the backend's rejection behavior. The dummy success
response lacks the required `register` action and correctly remains rejected by the backend.
This does not validate successful production widget completion; that requires your own
widget/secret pair and a real `register` token. Do not use public testing keys in production.

## Bootstrap

Use migration-owner credentials for these trusted commands. Users must already exist in
Supabase Auth; administrator grants do not depend on JWT profile metadata.

```sh
uv run python -m app.cli create-event --name "Fair Drop Demo" --capacity 2 \
  --opens-at "2026-10-04T12:00:00Z" --closes-at "2026-10-04T12:10:00Z"
uv run python -m app.cli add-admin --user-id <supabase-user-uuid>
```

The first command prints the event UUID. Supply dates appropriate for your run. The event
starts as `DRAFT`; an approved administrator calls `/api/v1/admin/events/{id}/open`.
The draw is permitted only at/after the configured deadline; it atomically publishes the queue
and starts admission. A repeated draw returns the existing event without changing any ranks.

For production, provision a dedicated login inheriting `fairdrop_backend`, set its password
outside source control, and use it for API/worker connections. The migration defines this
NOLOGIN access role with specific grants and RLS policies. The application role can read
administrator membership but cannot grant it. Do not use browser API keys as DB credentials.

## Run

```sh
uv run uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
uv run python -m app.workers.expiration_worker
```

Run the worker separately. It checks durable LIVE events immediately at startup and every
five seconds, expires overdue offers and fills released capacity in the same transaction.
Multiple accidentally started workers serialize through the event lock. No expiration
scheduler runs inside FastAPI web workers.

Each inventory transaction locks `fairdrop.events` first. `clock_timestamp()` is read after
lock acquisition (PostgreSQL's `now()` would retain the pre-wait time). Registration shares
this lock with drawing. Admission, confirmation and expiry also share it. Reservation IDs
and positions are never accepted from clients; confirmation selects by the verified subject.
Expired participants never receive a second offer. A depleted or exhausted queue finishes.

`GET /me` reports an overdue offer as EXPIRED immediately, even during the worker's polling
interval; persistence and admission happen on the next worker tick or confirmation attempt.

## Tests

```sh
uv run ruff check app tests
uv run ruff format --check app tests
uv run pytest tests/unit -q
```

Create an **isolated PostgreSQL database whose name ends in `_test`**, then:

```sh
# bash
export TEST_DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/fairdrop_test
uv run pytest -q
# PowerShell
$env:TEST_DATABASE_URL = 'postgresql+asyncpg://postgres:password@localhost:5432/fairdrop_test'
$env:TEST_REDIS_URL = 'redis://localhost:6380/0'
uv run pytest -q
```

The integration fixture **drops/recreates the fairdrop schema in this test database** and
creates a minimal auth identity fixture. It requires an owner role able to create test roles.
It refuses database names not ending in `_test`. Never point it at an application database.
Without `TEST_DATABASE_URL`, integration tests explicitly skip.
Redis integration tests use unique namespaces and skip without `TEST_REDIS_URL`.
CI runs both real PostgreSQL and Redis, including atomic limits, independent account/endpoint
budgets, cooldown recovery, multi-account races, and shared-network humans.

For a disposable test database without installing PostgreSQL locally:

```sh
docker compose -f compose.test.yaml up -d --wait
# Use postgresql+asyncpg://fairdrop_test:fairdrop_test@localhost:55432/fairdrop_test
# as TEST_DATABASE_URL, then run pytest.
docker compose -f compose.test.yaml down
```

The test container intentionally has no persistent volume. The repository CI runs both backend
and frontend checks; PostgreSQL-backed concurrency tests run on PostgreSQL 17 there.

Tests cover the five-user/two-ticket scenario, immutable ranks, registration cutoff races,
idempotent draws/confirmations, concurrent workers, FIFO replacement, confirmation waiting
past expiry, ownership, RLS/grants, API contracts, token verification and database rollback.

## Live frontend testing

Set the frontend API base to `http://127.0.0.1:8000/api/v1` and configure its public Supabase
URL/key. The frontend's `/login` uses Google OAuth and the exact allow-listed
`http://localhost:3000/auth/callback` URL. Live administrator membership is checked in
`fairdrop.administrators`; auth metadata is not used for privilege grants.
The live dashboard offers Open registration, Close registration, and Draw queue controls.
Close moves the registration deadline to database time while holding the event lock.
The draw rejects entries still open and starts FIFO offers atomically.
Participant pages poll every five seconds and use the server's three-minute expiry deadline.
Production requires Cloudflare Turnstile or the external security service.
See `../docs/BACKEND_INTEGRATION.md` for the adapter mapping.

## Containers

From the repository root:

```sh
docker compose up --build -d
```

The API and worker share the image and environment but run as separate services. Health
readiness verifies connectivity and all migrated allocation tables. Production HTTPS and
Droplet provisioning are deferred at the user's request.

After changing dependencies, update both lockfiles:

```sh
uv lock
uv export --locked --no-dev --no-emit-project -o requirements.lock
```
