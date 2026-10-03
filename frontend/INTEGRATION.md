# Fair Drop frontend: integration guide

**Legacy demo reference:** The endpoint table below describes the original mock interface,
not the live FastAPI wire contract. The live adapter is already implemented. Read
`../docs/BACKEND_INTEGRATION.md` for current routes and database-based admin authorization.
`lib/api/backend-contracts.ts` validates PRD responses; `lib/contracts/index.ts` holds
presentation/demo contracts. Advanced telemetry/simulator features are available only in mock mode.

For the backend, security and simulator teams. You should never need to touch components.
**`lib/contracts/index.ts` is the source of truth.** Every response is validated with zod. If yours differs, change the schema there (one place) or tell the frontend lead the diff.

## Switching to live

```
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com/api/v1
```
`lib/api/index.ts` picks `liveApi` (`lib/api/live.ts`) instead of `mockApi`. Your backend must send CORS headers allowing the frontend origin, `Authorization`, `Content-Type`, `Idempotency-Key`, and expose `Retry-After`.

## Auth
- Every request carries `Authorization: Bearer <supabase access token>`. Verify it with the Supabase JWT secret / JWKS.
- Admin = `app_metadata.role === "admin"` in the JWT. Set it with the service key: `auth.admin.updateUserById(id, { app_metadata: { role: "admin" } })`.
- `proxy.ts` blocks `/admin` for non-admins (optimistic). **Backend must enforce the role on every `/admin/*` route.**

## Endpoints (every drop is scoped to one event)

| Method | Path | Body / query | Response schema |
|---|---|---|---|
| GET | `/events` | | `EventList {events: EventInfo[]}` |
| GET | `/events/:id` | | `EventInfo` (phase, seats, `server_time`, category, venue, price, `reservation_window_s`) |
| GET | `/events/:id/me` | | `Me` (discriminated on `status`) |
| GET | `/me/entries` | | `MyEntries {entries: {event, me}[]}` for "My tickets" |
| POST | `/events/:id/register` | `{turnstile_token, idempotency_key, full_name, organization, eligibility_confirmed: true}` + `Idempotency-Key` header | `RegisterResponse {created, me}`. Existing entry → `created:false`. Backend verifies Turnstile with siteverify. |
| POST | `/events/:id/reservations/:rid/confirm` | `{idempotency_key}` + header | `{me}`. Same key → same ticket. Expired → 409 `reservation_expired`. |
| GET | `/events/:id/stream` | SSE, Bearer header | `data: <StreamEvent JSON>` frames |
| GET | `/admin/events/:id/metrics` | | `AdminMetrics` |
| GET | `/admin/events/:id/comparison` | query = `SimParams` | `Comparison` |
| GET | `/admin/events/:id/attacks` | | `AttackSummary` |
| GET | `/admin/events/:id/allocations` | | `Allocations` |
| GET | `/admin/events/:id/audit` | | `{entries}` |
| POST | `/admin/events/:id/{open-registration\|close-registration\|generate-queue\|start-admission\|pause\|reset}` | `{}` | 2xx |
| POST | `/admin/events/:id/simulator/run` | `SimParams` (+ `traffic_profile`, `duration_s`) | `{run_id, accepted}` |
| POST | `/admin/events/:id/simulator/stop` | `{}` | 2xx |

Errors: JSON `{code, message, retry_after?}` with the right status. Handled: 401 (sign-in prompt), 403, 409 (state conflict, triggers a `/me` refresh), 429 (calm cool-down using `retry_after` or the `Retry-After` header; **no auto-retry**), 5xx, network failure.

## Routes
Site: `/` · `/events` (catalog + filters) · `/events/:id` (detail + booking card) · `/events/:id/{register,queue,reservation,confirmed,ticket,status}` · `/my-tickets`. `/events/:id/me` picks the step.
Admin: `/admin{,/queue,/traffic,/reservations,/security,/settings}?event=:id`.

## Behaviour the frontend relies on
- `/me` decides the screen on every load (`lib/state/journey.ts` → `ROUTE_FOR`). Refresh, new tab, other device all land on the same screen.
- `ADMITTED.expires_at` is authoritative. Countdown = `expires_at − (Date.now() + offset)`; offset is measured from `EventInfo.server_time` (`lib/time`). When it hits 0 the UI re-reads `/me` and expects `EXPIRED` (or `CONFIRMED`).
- `QUEUED.admitted_ahead` (optional) drives progress + ETA. Without it the UI shows position only, no ETA.
- Realtime: `lib/realtime` uses fetch-based SSE (so the Bearer header works), jittered exponential backoff (cap 30s), and polls `/me` on every disconnect. WebSocket instead? Implement `subscribe()` in that file; nothing else changes.
- Pushed `me` updates may only move the journey forward; explicit refreshes (focus, reconnect, phase change) can move it back (e.g. admin reset).

## Env vars

| Var | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_MODE` | client | `mock` (default) / `live` |
| `NEXT_PUBLIC_API_BASE_URL` | client | backend origin, live only |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | empty = local demo identity |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | client | default Cloudflare test key |
| `TURNSTILE_SECRET_KEY` | **server only** | used by `/api/turnstile` in mock mode |
| `NEXT_PUBLIC_RESERVATION_WINDOW_MS` | client | progress-bar scale only; timer uses `expires_at` |

## OAuth redirect URLs (Supabase → Auth → URL configuration)
- Site URL: production URL.
- Redirect allow-list: `http://localhost:3000/auth/callback`, `https://<prod-domain>/auth/callback`, `https://*-<team-slug>.vercel.app/auth/callback` (previews).
- Google Cloud OAuth client → Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.

## Assumptions / known gaps
- Phase list and `Me` statuses as in the brief. No separate `PAUSED` phase: pause is visible to users as a stalled line ("The line has paused").
- Eligibility failure is reported as `Me.status = INELIGIBLE` with a human-readable `reason`.
- Seat label and ticket id come from the backend; frontend displays them as-is.
- Mock mode metrics/attacks are synthetic; the FIFO vs protected numbers come from a deterministic model in `lib/sim` (unit tested), not a load test. Wire the simulator's real results into `/admin/comparison` to replace them.
- CSP uses `'unsafe-inline'` for scripts (Next bootstrap). Move to nonces in `proxy.ts` if needed.
