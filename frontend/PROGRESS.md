# Progress

## Done
- Phase 0-1: Next 16.3 (App Router, `proxy.ts` not middleware), Tailwind 4 tokens, UI primitives, contracts (zod), live/mock API, realtime adapter, server clock, journey reconcile, Supabase SSR + Google, Turnstile.
- Phase 2-4: landing, register, waiting room, reserve countdown, confirmed ticket, end states, dev scenario panel (`?scenario=`).
- Phase 5: admin overview/controls, comparison (FIFO vs protected, CSV/PNG export), bots + simulator trigger, allocation + integrity, audit log.
- v2 UI revamp (light editorial, photography, QR ticket, admin sidebar: Dashboard/Queue/Traffic/Reservations/Security/Settings). 11 unit + 20 e2e passing.

## Decisions
- Mock backend derives queue movement from timestamps in localStorage, so refresh/tabs agree.
- Auth falls back to a local demo identity when Supabase env is missing.
- Jain index = fairness across human speed cohorts; 0 when no human wins.

## Blockers / open
- Real backend not available: default mode is mock.
- Vercel: live at https://fair-drop-sooty.vercel.app (mock mode). `.npmrc` legacy-peer-deps needed for install.
