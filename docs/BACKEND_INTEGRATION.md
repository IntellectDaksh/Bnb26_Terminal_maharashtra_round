# Backend MVP integration

The Backend PRD v1.1 governs allocation behavior. The participant UI now uses
`frontend/lib/api/live.ts`, with PRD response validation in `backend-contracts.ts`.
The original demo contracts and simulator remain separate in mock mode.

| Operation | Backend contract |
| --- | --- |
| Catalog | `GET /api/v1/events` → up to 50 recent public event snapshots |
| Public event | `GET /api/v1/events/{UUID}` → event configuration/state, counts and server time |
| Register | `POST /api/v1/events/{UUID}/register`, `{ "security_token": "..." }` → `{created, registration}` |
| Own status | `GET /api/v1/events/{UUID}/me` → `{event_id, event_status, registration, reservation, ticket_confirmed, server_time}` |
| Confirm | `POST /api/v1/events/{UUID}/confirm`, no body → `{event_id, queue_position, ticket_confirmed, reservation}` |
| Open | `POST /api/v1/admin/events/{UUID}/open` → event |
| Early close | `POST /api/v1/admin/events/{UUID}/close` → event with deadline set to database time |
| Draw/admit | `POST /api/v1/admin/events/{UUID}/draw` → event |
| Admin status | `GET /api/v1/admin/events/{UUID}/status` → counts, available capacity, event, server time |
| Admin identity | `GET /api/v1/admin/me` → verified user UUID; non-admins receive 403 |

All participant-specific and admin operations require Supabase `Authorization: Bearer ...`.
An authenticated subject can see/confirm only its own registration/reservation. Administrators
must be listed in `fairdrop.administrators`; JWT `app_metadata.role` alone does not grant access.

Registration and confirmation are idempotent by event/user and persisted reservation identity.
A separate client idempotency key is unnecessary; the `Idempotency-Key` header is permitted
by CORS but does not control allocation. Registration security validation still runs on retries.
No client user ID, queue position or reservation ID is accepted.

| Existing UI state | Backend state |
| --- | --- |
| REGISTERED | registration ELIGIBLE |
| QUEUED | registration QUEUED |
| ADMITTED | registration/reservation OFFERED |
| CONFIRMED | registration/reservation CONFIRMED |
| EXPIRED | registration/reservation EXPIRED |
| NOT_REGISTERED | registration null |

The original queue position is returned inside `registration.queue_position` throughout
the lifecycle, including OFFERED, CONFIRMED and EXPIRED. Timestamps are UTC. Reservations
contain `id`, `status`, `offered_at`, `expires_at`, `confirmed_at`; a confirmed reservation's UUID
is its persistent ticket reference. The backend does not assign physical seats or collect payment.

Event states: DRAFT → OPEN → DRAWING → LIVE → FINISHED; CANCELLED is reserved in the
state model. DRAWING and LIVE are published atomically in the synchronous MVP. OPEN may
have a future opening timestamp; registration enforces both ends of the configured window.

Stable errors use `{code, message}`: 401 `authentication_required`/`invalid_token`, 403
`admin_required`/`security_rejected`, 404 `event_not_found`/`registration_not_found`, 409
`registration_closed`/`registration_not_started`/`registration_still_open`/`invalid_event_state`/
`reservation_not_offered`/`reservation_expired`/`active_event_exists`, 422 `invalid_request`,
503 `auth_unavailable`/`security_unavailable`/`database_unavailable`/`not_ready`.

The live participant adapter polls authoritative snapshots every five seconds. My Tickets
combines the bounded public catalog with each event's authenticated own-status endpoint.
Registration sends only `security_token`; UI profile/organization inputs are not persisted
by this MVP. Ticket holder display comes from the signed-in profile; the reservation UUID
is the permanent ticket reference. UI schedule/venue/category are explicitly test presentation
defaults: the shown schedule is the registration deadline, not a production event itinerary.

For live Cloudflare verification, put `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in
`frontend/.env.local` and the matching `TURNSTILE_SECRET_KEY` in `backend/.env`.
The widget sends the `register` action and the backend verifies it through Siteverify.
`TURNSTILE_EXPECTED_HOSTNAME` optionally restricts successful responses to one hostname.
The frontend server's `TURNSTILE_SECRET_KEY` is only used by the mock verification route.

Live `/admin` displays actual database counts and Open, Close, Draw controls. Early close
locks the event before moving the deadline; it cannot reopen or redraw the allocation.
Draw both fixes the randomized queue and starts admission in one transaction.
JWT metadata does not grant admin access: the UI checks `/admin/me`, and every admin
operation independently checks database membership. Proxy refreshes sessions and checks sign-in.

SSE, slug IDs, pause/reset, simulators, traffic comparisons and synthetic metrics are
unsupported in live mode. Demo-only pages are hidden there. See `/docs` for OpenAPI schemas.
