# Fair Drop frontend: task status

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Next.js setup + Google OAuth | Done (code) · **Pending config** | Supabase SSR + `/auth/callback` + `proxy.ts`. Needs Supabase project keys + Google provider enabled. Falls back to a demo account until then. |
| 2 | Event landing page + registration UI | Done | Home, catalog with search/filters, 7 sample events, event detail with booking card, 4-step registration. |
| 3 | Cloudflare Turnstile in registration | Done (code) · **Pending keys** | Widget + server-side verify route; uses Cloudflare test keys until real site/secret keys are set. |
| 4 | Waiting room with live queue positions | Done | Position, progress, measured ETA, paused state, live updates (SSE/polling adapter). |
| 5 | Refresh / reconnect / session restore | Done | `/me` decides the screen; "Position restored"; reconnect banner; jittered backoff; double-tab safe. Covered by e2e. |
| 6 | Reservation, countdown, confirmation | Done | Server-clock countdown, idempotent confirm, expiry handling, confirmation + printable ticket with QR + calendar. |
| 7 | Admin dashboard to manage the event | Done | Per-event switcher, phase controls with confirmations, audit log, role gate. |
| 8 | Live traffic, bot activity, allocations | Done (mock data) | Dashboard, Traffic simulator console, Security feed, Reservations + integrity check. Real numbers need backend. |
| 9 | FIFO vs protected comparison charts | Done (simulated) | Deterministic model in `lib/sim`, presets, CSV/PNG export. Swap for simulator team's real results via `/admin/events/:id/comparison`. |
| 10 | Integrate backend APIs + deploy to Vercel | Deployed · **Backend pending** | Live at https://fair-drop-sooty.vercel.app in mock mode. Set `NEXT_PUBLIC_API_MODE=live` + base URL when backend is up. |

## Pending (needs other teams or credentials)
- Backend implementing the endpoints in `INTEGRATION.md` (event-scoped).
- Supabase project + Google OAuth client + admin role on admin users.
- Real Turnstile site/secret keys.
- Simulator team's real load-test results for the comparison page.
- Attendees list page (no backend contract yet).
- Stricter CSP with nonces.
