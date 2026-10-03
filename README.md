# Fair Drop (frontend + admin)

GDG On Campus CRCE, Bit N Build, problem statement 3: selling 500 seats to 50,000 people without letting bots win.

```
npm install
cp .env.example .env.local   # works as-is in mock mode
npm run dev                  # http://localhost:3000
```

- Participant flow: `/` → `/register` → `/waiting-room` → `/reserve` → `/confirmed` (`/status` for end states). Mock scenario panel bottom-right, or `?scenario=queued|admitted|expiring|expired|confirmed|sold_out|rate_limited|offline|demo_timeline…`.
- Admin: `/admin` (demo admin button in mock mode).
- Tests: `npx vitest run` (unit), `npx playwright test` (e2e, starts dev server on :3100).

Backend teams: read `INTEGRATION.md`. Design notes: `DESIGN.md`.

| Path | What |
|---|---|
| `lib/contracts` | zod schemas for every request/response |
| `lib/api` | `live.ts`, `mock.ts`, `index.ts` (mode switch) |
| `lib/realtime` | SSE / polling transport |
| `lib/state` | journey routing + provider |
| `lib/sim` | FIFO vs protected allocation model |
| `app/(participant)`, `app/admin` | screens |
