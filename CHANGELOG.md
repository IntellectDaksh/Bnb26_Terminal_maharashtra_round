# Changelog

All notable changes to the **Fair Drop** frontend and admin system are documented in this file.

## [v2.0.0] - 2026-10-03

### Visual & Design System Overhaul (Zinc + Emerald Modern Glass)
- **Palette & Tokens**:
  - Migrated base palette to `bg-zinc-50` with high-contrast `bg-zinc-900`/`bg-zinc-950` dark sections.
  - Introduced signature **Emerald** accent palette (`#059669` / `emerald-600` primary, `emerald-50` subtle wash, `emerald-950/20` ambient glows).
  - Adopted frosted glassmorphism `.glass-panel` (`rgba(255, 255, 255, 0.85)` with `backdrop-filter: blur(12px)` and `border-zinc-200/50`).
  - Standardized `.form-input` controls with smooth focus transitions and emerald glow rings (`ring-emerald-500/15`).
- **Typography**:
  - Standardized on **Inter** sans-serif typography across all participant and admin pages.
  - Implemented tight display tracking (`tracking-tight`), uppercase tracking-widest eyebrow tags, and tabular lining numerals (`.num`) for clocks, timers, and queue positions.
- **Global Chrome**:
  - Replaced legacy header with a floating pill navigation bar (`glass-panel rounded-full`) featuring brand indicator, quick session management, and pill action CTAs.
  - Added a modern dark footer (`bg-zinc-900 text-zinc-400 py-16`) with platform links, problem statement credentials, and legal notes.
  - Modernized the bottom-right floating Demo Scenario Switcher for rapid multi-phase previews.

### Public & Discovery Screens
- **Landing Page (`/`)**:
  - Full-width hero section with atmospheric emerald ambient glows, bold typography (*"Tickets without the race."*), live admission batch highlight chips, and dual CTAs.
  - Dynamic **Live Drops** section highlighting ongoing events with pulsing emerald dots and real-time seat gauges.
  - 4-step architectural breakdown (*Register*, *Freeze*, *Draw*, *Your Turn*) with custom SVG iconography and clear anti-bot guarantees.
  - Dark-contrast **Anti-Bot Defense Engine** section (`bg-zinc-900`) detailing Cloudflare Turnstile human challenge, cryptographic shuffle, identity deduplication, and zero latency advantage.
  - Interactive FAQ accordion for attendee confidence.
- **Events Catalog (`/events`)**:
  - Added category pill filters (*All*, *Hackathons*, *Concerts*, *Films*, *Conferences*, *Comedy*, *Workshops*, *Sports*).
  - Floating search input using `.form-input` and responsive `EventCard` grid with live progress meters and empty state handling.
- **Event Detail (`/events/[id]`)**:
  - Redesigned two-column layout with event overview, schedule, rules, and a sticky `.glass-panel` booking card that dynamically routes users to their exact stage.
- **My Tickets Dashboard (`/my-tickets`)**:
  - Added segmented view for Active Queues, Pending Reservations, and Confirmed Passes with live status chips.

### Participant Drop State Machine
- **Registration (`/events/:id/register`)**:
  - 4-step visual stepper (`Sign In` → `Details` → `Human Check` → `Enter Drop`).
  - Google OAuth sign-in with verified state badge.
  - Form fields using `.form-input` and Cloudflare Turnstile challenge container.
  - High-impact emerald CTA button with idempotent submission protection.
- **Waiting Room / Queue (`/events/:id/queue`)**:
  - Central glass waiting room card with large tabular position readout (`.num text-7xl font-bold`).
  - Live progress bar tracking admitted attendees vs total in queue.
  - Adaptive ETA indicator (*"~4 min"*, *"You're next"*, or *"Line paused"*).
  - Real-time SSE connection heartbeat dot and "Position restored" badge on reconnection.
  - Reassurance cards explaining cryptographic fairness and batch admission mechanics.
- **Reservation Window (`/events/:id/reservation`)**:
  - Authoritative server-synchronized countdown timer with emerald styling that pulses urgent red when under 60 seconds (`ms < 60_000`).
  - Seat summary hold card and single-click idempotent confirm button.
- **Confirmed Pass & Printable Ticket (`/events/:id/confirmed` & `/ticket`)**:
  - Luxury digital pass with perforated notch edges, clean borders, verified emerald status badge, and live QR code (`qrcode.react`).
  - Action toolbar with `.ics` calendar invite download and print stylesheet support.
- **Status Screens (`/events/:id/status`)**:
  - Reassuring, clear communication for `EXPIRED`, `SOLD_OUT`, and `INELIGIBLE` states with direct button to browse other drops.

### Admin Operations & Telemetry Console
- **Navigation & Layout (`/admin/layout.tsx`)**:
  - Dark-zinc sidebar (`bg-zinc-950 text-zinc-300`) with emerald active indicators, dropdown event switcher, and quick link to public drops.
- **Live Dashboard (`/admin`)**:
  - Telemetry cards for Request Rates (Human, Suspicious, Blocked RPS), active sessions, latency percentiles ($P_{50}, P_{95}, P_{99}$), and rate-limit statistics.
  - Traffic source Donut chart and cumulative allocation capacity timeline.
  - Database integrity check badge verifying `0 duplicate allocations · 0 oversold`.
- **Fairness & Queue Comparison (`/admin/queue`)**:
  - FIFO vs Protected strategy comparison charts.
  - Custom SVG semi-circle **Jain's Fairness Index gauge** with score readout.
  - Cohort win-rate bars (Slow, Average, Fast humans vs Bots).
  - Time-to-allocation histogram with CSV and PNG canvas export tools.
- **Traffic Telemetry & Load Generator (`/admin/traffic`)**:
  - Load generator controls (*Normal*, *High Traffic*, *Adversarial* 60s bursts).
  - Real-time stream of incoming request rates, allowed vs blocked area charts, and latency trends.
- **Reservations & Integrity (`/admin/reservations`)**:
  - Batch allocation conversion progress and active hold expiration monitor.
- **Security & Bot Defense (`/admin/security`)**:
  - Real-time bot attempt audit log feed with filter buttons and Turnstile pass rate metrics.
- **Drop Lifecycle Settings (`/admin/settings`)**:
  - Phase advance controls (*Open*, *Close*, *Draw*, *Admit*, *Pause*, *Reset*) protected by modal confirmation dialogs.
  - Inline simulator quick-trigger controls and tamper-evident audit ledger.

### Verification & Quality
- **Contracts**: All Zod schemas (`lib/contracts/index.ts`) fully preserved.
- **Type Safety**: `tsc --noEmit` verified with 0 errors.
- **Unit Tests**: 100% of tests passing in Vitest (`tests/journey.test.ts` and `tests/sim.test.ts`).
- **Turbopack Dev Server**: All 14 routes compile cleanly and return `HTTP 200`.
