# Fair Drop — Backend PRD (Developer 1)

**Developer:** Anshul Roy  
**Role:** Backend and Database  
**Version:** 1.1 — Functional MVP  
**Stack:** Python, FastAPI, Supabase PostgreSQL  
**Deployment:** DigitalOcean Droplet  
**Status:** Ready for implementation

---

# 1. Project Objective

Develop the core backend for Fair Drop, a ticket-allocation platform designed to reduce the advantages automated clients obtain from registration speed, request volume and repeated attempts.

The backend must support authenticated registration, a one-time randomized queue, FIFO admission and secure ticket reservations.

Our immediate objective is to build a complete, functioning backend and verify its correctness with a small number of users.

The eventual competition scenario involves 50,000 participants competing for 500 tickets. Large-scale load testing is postponed until the core implementation is complete.

## 1.1 MVP Success Criteria

The backend must successfully perform this sequence:

1. Users authenticate through Google OAuth.
2. Authenticated users register for the event.
3. Registration closes.
4. The backend randomly assigns queue positions exactly once.
5. Participants receive ticket offers according to their assigned positions.
6. Participants have three minutes to confirm their reservations.
7. Expired reservations release their inventory.
8. The next eligible participants receive the released tickets.
9. Confirmed tickets never exceed event capacity.

Refreshing, disconnecting or signing back in must not alter a participant's original queue position.

## 1.2 Scope

The MVP supports:

- One active event.
- Configurable event capacity, with 500 tickets as the competition scenario.
- One ticket per authenticated account.
- A fixed preregistration window.
- One-time randomized queue generation.
- FIFO ticket admission.
- Three-minute reservation windows.
- Automatic expiration and inventory recovery.
- Persistent registration and reservation state.
- Administrative controls for starting registration and initiating the draw.

The application will use event IDs internally, but building a complete multi-event management platform is unnecessary.

## 1.3 Out of Scope

The following are excluded from this implementation:

- Large-scale load testing.
- Synthetic traffic generation.
- Configuring the traffic-generator Droplet.
- Custom bot-detection algorithms.
- FIFO-versus-hybrid performance comparisons.
- Performance benchmarking for 50,000 concurrent users.
- Advanced monitoring dashboards.
- Payment gateway integration.
- Seat selection and ticket transfers.

Basic correctness and concurrency tests remain mandatory.

---

# 2. System Architecture

## 2.1 Backend Technology

| Component | Technology |
|---|---|
| Programming language | Python |
| API framework | FastAPI |
| Database | Supabase PostgreSQL |
| ORM | SQLAlchemy |
| Database driver | asyncpg |
| Schema validation | Pydantic |
| Authentication verification | Supabase Auth token verification |
| Migrations | Supabase SQL migrations |
| Testing | Pytest |
| Containerization | Docker |
| Hosting | DigitalOcean |

## 2.2 Backend Responsibilities

The backend is responsible for authentication verification, participant registration, event-state management, queue generation, admission, reservations and database consistency.

Supabase PostgreSQL is the authoritative source of application state.

The backend communicates with external authentication and security components through defined interfaces, but implementing those components is outside this PRD.

## 2.3 Architectural Principles

1. Never trust queue positions or reservation details supplied by the client.
2. Verify authentication before executing protected operations.
3. Use database transactions for operations affecting event eligibility or ticket inventory.
4. Store queue positions permanently.
5. Make registration, drawing, confirmation and expiration safe to retry.
6. Never rely exclusively on application memory for allocation state.
7. Keep business logic separate from HTTP routes and database configuration.

---

# 3. Database Design

Create the application tables in a dedicated private PostgreSQL schema named `fairdrop`.

Use Supabase's existing `auth.users` table for authenticated identities.

## 3.1 Events

**Table:** `fairdrop.events`

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | Event name |
| capacity | INTEGER | Maximum number of tickets |
| status | ENUM | Current event state |
| registration_opens_at | TIMESTAMPTZ | Registration opening |
| registration_closes_at | TIMESTAMPTZ | Registration deadline |
| next_queue_position | INTEGER | Next participant awaiting an offer |
| draw_completed_at | TIMESTAMPTZ | Completed draw timestamp |
| created_at | TIMESTAMPTZ | Creation timestamp |

The event must have a positive capacity and a valid registration window.

## 3.2 Registrations

**Table:** `fairdrop.registrations`

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| event_id | UUID | Associated event |
| user_id | UUID | Supabase authenticated user |
| status | ENUM | Registration state |
| queue_position | INTEGER | Original assigned position |
| registered_at | TIMESTAMPTZ | Registration timestamp |

Constraints:

- Unique `(event_id, user_id)`.
- Unique `(event_id, queue_position)` for assigned positions.
- Queue positions must be positive.
- Valid foreign keys.

The unique user/event constraint prevents duplicate registrations even when simultaneous requests reach the backend.

## 3.3 Reservations

**Table:** `fairdrop.reservations`

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| event_id | UUID | Associated event |
| registration_id | UUID | Registration receiving the offer |
| status | ENUM | Reservation state |
| offered_at | TIMESTAMPTZ | Offer creation time |
| expires_at | TIMESTAMPTZ | Authoritative expiration |
| confirmed_at | TIMESTAMPTZ | Confirmation timestamp |

Each registration may receive only one reservation.

Enforce this through a unique constraint and verify that the registration belongs to the reservation's event.

## 3.4 Administrators

**Table:** `fairdrop.administrators`

Store the approved Supabase user IDs authorized to perform administrative operations.

Do not determine administrative permissions using user-editable profile metadata.

## 3.5 Database Security

- Keep the allocation tables in a private, non-exposed schema.
- Restrict database access to authorized backend credentials.
- Never expose privileged database credentials to the browser.
- Use migrations for every schema change.
- Apply appropriate constraints and indexes before implementing the allocation engine.

---

# 4. Application State Machines

## 4.1 Event States

| State | Description |
|---|---|
| DRAFT | Event created; registration unavailable |
| OPEN | Participants can register |
| DRAWING | Registration frozen; queue generation underway |
| LIVE | Queue admission and reservations are operating |
| FINISHED | Event has completed |
| CANCELLED | Event administratively cancelled |

The normal progression is:

`DRAFT → OPEN → DRAWING → LIVE → FINISHED`

For the MVP, the draw and its state changes execute in one database transaction. Other clients must not observe a partially assigned queue.

If the transaction fails, it rolls back without publishing incomplete queue positions.

The `DRAWING` state remains part of the state model to support an asynchronous draw implementation later.

## 4.2 Participant States

| State | Description |
|---|---|
| ELIGIBLE | Registered before the deadline |
| QUEUED | Assigned a queue position |
| OFFERED | Received a temporary ticket reservation |
| CONFIRMED | Successfully confirmed a ticket |
| EXPIRED | Reservation expired |

Normal progression:

`ELIGIBLE → QUEUED → OFFERED → CONFIRMED`

Alternatively:

`ELIGIBLE → QUEUED → OFFERED → EXPIRED`

An expired participant cannot receive another offer in the MVP.

---

# 5. Functional Requirements

## FR-01: Authentication Verification

Implement backend verification of access tokens issued by Supabase Auth following Google sign-in.

Requirements:

- Validate the access token.
- Verify its signature, issuer, audience and expiration.
- Extract the trusted user ID.
- Reject invalid or expired tokens.
- Independently verify administrative permissions for administrative operations.

Use Supabase's supported token-verification mechanism for the project's signing configuration.

The backend must never trust a user ID submitted by the client.

## FR-02: Registration

Implement an authenticated event-registration endpoint.

Requirements:

- Verify that the event exists.
- Confirm that registration is open.
- Check the authoritative registration deadline.
- Accept the result of the agreed external security-verification interface.
- Create the participant's registration.
- Return the existing registration when an account is already registered.
- Prevent simultaneous duplicate registrations.
- Reject registration after the deadline.

Registration transactions must coordinate with registration closure so that a request cannot race past the cutoff.

**Expected result:** Every eligible account receives at most one registration per event.

## FR-03: Randomized Queue Generation

Implement one-time randomized queue generation.

Requirements:

1. Validate that the registration deadline has passed.
2. Atomically close registration and freeze eligible entries.
3. Retrieve the frozen registration population.
4. Generate a cryptographically secure random ordering.
5. Assign sequential queue positions starting at one.
6. Store every assigned position in PostgreSQL.
7. Initialize the admission pointer.
8. Prevent completed draws from being repeated.
9. Publish the completed queue.

For the functional MVP, this operation can run synchronously for a small participant population.

Asynchronous processing and large-draw optimization are deferred until after the core backend is functional.

**Expected result:** Every registered participant has one persistent position that cannot be changed through refreshes or repeated requests.

## FR-04: Queue Status

Implement an endpoint that retrieves the authenticated participant's state.

It must return:

- Event status.
- Participant registration status.
- Original queue position, if assigned.
- Reservation status, if applicable.
- Reservation expiration timestamp, if applicable.
- Ticket confirmation result, if applicable.

The original queue rank remains immutable.

Do not implement complicated real-time queue progression estimates during the MVP.

## FR-05: FIFO Admission

Implement admission according to the queue positions assigned during the draw.

Requirements:

- Process participants in ascending queue-position order.
- Determine available reservation capacity.
- Create reservation offers only when capacity exists.
- Persist the next queue position awaiting admission.
- Prevent duplicate offers.
- Never admit more participants than available inventory permits.

Admission occurs automatically when the draw completes and when expired reservations release capacity.

Participants do not need to have an active browser connection to receive an offer.

## FR-06: Reservation Confirmation

Implement authenticated reservation confirmation.

Requirements:

- Locate the authenticated participant's reservation.
- Verify that the reservation is active.
- Check expiration using the database clock after acquiring the necessary locks.
- Confirm the reservation transactionally.
- Record the confirmation timestamp.
- Return the existing successful confirmation if the operation is repeated.
- Reject expired reservations.

The frontend countdown does not determine actual reservation validity.

## FR-07: Automatic Expiration

Implement a separate expiration worker.

Requirements:

- Periodically identify overdue reservations.
- Acquire the required database locks.
- Expire overdue offers.
- Update affected participant states.
- Release inventory.
- Automatically admit subsequent queued participants.
- Persist all changes atomically.
- Recover overdue reservations after a worker restart.

For the MVP, run the expiration worker approximately every five seconds.

Do not run an independent expiration scheduler inside every FastAPI web worker.

## FR-08: Inventory Integrity

The following invariant must always hold:

`Confirmed tickets + active, unexpired reservations <= event capacity`

All operations changing inventory must follow a consistent transaction and locking strategy.

For the MVP, serialize inventory-changing operations using the event's PostgreSQL row lock.

Avoid independently committing partial reservation or admission operations.

---

# 6. API Specification

Use `/api/v1` for application endpoints.

## 6.1 Participant Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/events/{id}` | Retrieve event information |
| POST | `/api/v1/events/{id}/register` | Register for an event |
| GET | `/api/v1/events/{id}/me` | Retrieve personal queue status |
| POST | `/api/v1/events/{id}/confirm` | Confirm an existing reservation |

Participant-specific endpoints require valid authentication.

Registration accepts the agreed bot-verification input. The backend will call the external validation interface before attempting to create a registration.

## 6.2 Administrative Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/admin/events/{id}/open` | Open registration |
| POST | `/api/v1/admin/events/{id}/draw` | Freeze registration and generate the queue |
| GET | `/api/v1/admin/events/{id}/status` | Retrieve event status |

All administrative endpoints require server-side administrative authorization.

## 6.3 Health Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health/live` | Confirm that the API is running |
| GET | `/health/ready` | Verify that critical dependencies are available |

## 6.4 API Standards

- All responses use JSON.
- All authoritative timestamps use UTC.
- Use documented Pydantic request and response schemas.
- Generate OpenAPI documentation automatically through FastAPI.
- Use consistent HTTP status codes.
- Return stable machine-readable error codes.
- Never expose sensitive authentication or database information.

---

# 7. Backend File Structure

The following structure is the implementation blueprint.

```text
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── auth.py
│   │   ├── dependencies.py
│   │   └── errors.py
│   ├── db/
│   │   ├── connection.py
│   │   └── models.py
│   ├── schemas/
│   │   ├── events.py
│   │   ├── registrations.py
│   │   └── reservations.py
│   ├── routes/
│   │   ├── events.py
│   │   ├── registrations.py
│   │   ├── reservations.py
│   │   └── admin.py
│   ├── services/
│   │   ├── registration.py
│   │   ├── queue.py
│   │   ├── admission.py
│   │   └── reservation.py
│   ├── security/
│   │   └── interface.py
│   └── workers/
│       └── expiration_worker.py
├── tests/
│   ├── unit/
│   └── integration/
├── Dockerfile
├── pyproject.toml
└── .env.example

supabase/
└── migrations/
```

## 7.1 Core Files and Functions

**`main.py`**

- `create_app()` — Create the FastAPI application and register routes and middleware.

**`core/config.py`**

- `load_settings()` — Load and validate environment configuration.

**`core/auth.py`**

- `verify_access_token(token)` — Validate a Supabase access token and return trusted user identity.
- `require_admin(user, db)` — Verify administrative access.

**`db/connection.py`**

- `create_engine(settings)` — Initialize the PostgreSQL connection pool.
- `get_db_session()` — Provide database sessions with safe cleanup.

**`db/models.py`**

Define database models, relationships and enumerated states.

**`services/registration.py`**

- `register_user(event_id, user_id, security_result, db)` — Create or retrieve an existing registration.
- `get_registration(event_id, user_id, db)` — Retrieve registration data.

**`services/queue.py`**

- `generate_queue(event_id, db)` — Freeze registration and generate the randomized queue.
- `get_queue_status(event_id, user_id, db)` — Retrieve persistent queue state.

**`services/admission.py`**

- `calculate_available_capacity(event_id, db)` — Determine available reservation capacity.
- `admit_next(event_id, db)` — Create offers for the next eligible participants.

**`services/reservation.py`**

- `confirm_reservation(event_id, user_id, db)` — Confirm an active reservation.
- `expire_reservations(event_id, db)` — Expire overdue reservations and release capacity.

**`workers/expiration_worker.py`**

- `process_due_expirations()` — Periodically process overdue reservations and trigger subsequent admissions.

**`security/interface.py`**

Define the validation interface used to accept the external bot-protection component's decision. Its implementation is outside this PRD.

All inventory-changing service functions must use the transaction and locking strategy described in this document.

---

# 8. Development Phases

Implementation follows six phases.

## Phase 1: Backend and Database Foundation

Tasks:

1. Initialize FastAPI.
2. Create the defined project structure.
3. Configure environment variables.
4. Establish the Supabase PostgreSQL connection.
5. Configure SQLAlchemy.
6. Create database migrations.
7. Implement all required database tables and constraints.
8. Implement health-check endpoints.

**Completion condition:** FastAPI runs locally, connects to PostgreSQL and can create and retrieve test event records.

## Phase 2: Authentication and Registration

Tasks:

1. Implement Supabase access-token verification.
2. Extract authenticated user IDs.
3. Implement administrative authorization.
4. Implement registration eligibility checks.
5. Implement idempotent event registration.
6. Implement deadline enforcement.
7. Test repeated and simultaneous registrations.

**Completion condition:** An authenticated participant can register exactly once for an open event.

## Phase 3: Queue Generation

Tasks:

1. Implement event-state transitions.
2. Implement registration closure.
3. Implement secure randomization.
4. Persist queue positions.
5. Prevent repeated draws.
6. Implement personal queue-status retrieval.

**Completion condition:** A small group of test participants receives unique, permanent queue positions.

## Phase 4: Admission and Reservations

Tasks:

1. Implement available-capacity calculation.
2. Implement FIFO admission.
3. Create three-minute reservation offers.
4. Implement reservation confirmation.
5. Implement automatic expiration.
6. Release inventory after expiration.
7. Automatically admit subsequent participants.
8. Implement transactional inventory protection.

**Completion condition:** The complete registration-to-confirmation and registration-to-expiration journeys work.

## Phase 5: Integration and Correctness Testing

Tasks:

1. Verify every documented API contract.
2. Connect the agreed security-validation interface.
3. Test duplicate registration handling.
4. Test queue persistence across repeated requests.
5. Test repeated confirmation requests.
6. Test simultaneous confirmation attempts.
7. Test confirmation racing with expiration.
8. Test application and expiration-worker restarts.
9. Verify transaction rollback during simulated database errors.

**Completion condition:** All essential application flows and correctness tests pass.

This phase does not include Locust or large-scale performance testing.

## Phase 6: DigitalOcean Deployment

Tasks:

1. Create a Dockerfile.
2. Configure application and worker execution.
3. Deploy the backend to the smaller DigitalOcean Droplet.
4. Configure production environment variables.
5. Establish secure connectivity to Supabase PostgreSQL.
6. Configure HTTPS.
7. Start the expiration worker as a separately managed process.
8. Test application startup and recovery.
9. Verify the complete user journey against the deployed backend.

**Completion condition:** The backend is deployed, operational and ready for frontend integration.

---

# 9. Essential Testing Strategy

We will prioritize correctness over performance.

## 9.1 Unit Tests

Test:

- Event-state transitions.
- Queue randomization.
- Queue-position uniqueness.
- Registration eligibility rules.
- Reservation state transitions.
- Available-capacity calculations.
- Expiration eligibility.

Use deterministic, injectable randomness for tests while retaining cryptographically secure randomness in production.

## 9.2 Database Integration Tests

Test:

- Duplicate registration attempts.
- Registration racing with the draw cutoff.
- Repeated draw requests.
- Simultaneous reservation confirmations.
- Confirmation and expiration occurring concurrently.
- Duplicate offer prevention.
- Transaction rollback.
- Application and worker recovery.

Tests should run against an isolated PostgreSQL database with the actual schema and constraints.

## 9.3 Functional Acceptance Scenario

Configure one test event with five participants and two available tickets.

1. Register five authenticated test participants.
2. Close registration.
3. Randomize the five queue positions.
4. Verify all positions are unique and persisted.
5. Automatically create reservation offers for the first two participants.
6. Confirm one participant's reservation.
7. Allow the other reservation to expire.
8. Verify that the next queued participant receives an offer.
9. Confirm that participant's reservation.
10. Verify that exactly two tickets are confirmed.

Also verify that repeated registration, refreshes and repeated confirmation requests cannot manipulate this outcome.

---

# 10. Final MVP Acceptance Criteria

The backend will be considered complete when:

- FastAPI connects reliably to Supabase PostgreSQL.
- The database schema and migrations work.
- Supabase access tokens are verified correctly.
- Each authenticated account can register only once.
- Registration closure prevents late entries.
- Queue generation assigns unique positions exactly once.
- Queue positions persist across reconnects and restarts.
- Admission follows the established queue order.
- Reservations expire after three minutes.
- Expired inventory becomes available to subsequent participants.
- Repeated confirmation requests cannot allocate additional tickets.
- Concurrent operations cannot cause overselling.
- The expiration worker functions independently of the API process.
- API endpoints have documented request and response contracts.
- The complete functional acceptance scenario passes.
- The deployed backend is accessible and operational.

---

# 11. Deferred Engineering Milestone

After the functional MVP is complete, we will separately plan:

- Large-scale simulated registration.
- A 50,000-participant allocation test.
- Locust-based adversarial traffic.
- Application and database performance benchmarking.
- Queue-efficiency improvements.
- Large-draw optimization and asynchronous processing.
- Detailed traffic and performance monitoring.

These activities may identify bottlenecks that require architectural changes. We will address them using measured evidence rather than prematurely optimizing the initial implementation.

They are explicitly excluded from the current development scope.

---

# 12. Final Deliverable

A functioning, deployed FastAPI backend with Supabase PostgreSQL that supports the full ticket-allocation lifecycle:

**Authentication → Registration → Randomized queue → FIFO admission → Three-minute reservation → Confirmation or expiration.**

The backend must be secure, persistent, transactionally correct and accessible through documented APIs.

The immediate implementation objective is to successfully demonstrate this lifecycle with a small number of participants before proceeding to performance optimization or large-scale simulation.