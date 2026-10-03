# Fair Drop

The backend implements the functional MVP: authenticated registration, a permanent randomized
queue, FIFO offers, three-minute reservations, confirmation, and automatic inventory recovery.

| Directory | Purpose |
| --- | --- |
| `frontend/` | Existing Next.js participant/admin UI and mock implementation |
| `backend/` | FastAPI API, allocation services, independent expiration worker, tests |
| `supabase/migrations/` | Authoritative PostgreSQL schema and constraints |
| `docs/` | Backend PRD and API integration notes |

## Backend

See [backend/README.md](backend/README.md) for environment setup, database migration,
Google sign-in configuration, event/admin bootstrap, and test commands.

```sh
cd backend
uv sync --locked
# Copy .env.example to .env and configure Supabase/database/security settings.
uv run uvicorn app.main:create_app --factory --reload --port 8000
# Separate terminal/process, from backend/:
uv run python -m app.workers.expiration_worker
```

API documentation: `http://localhost:8000/docs`. All application routes use `/api/v1`.
Health: `/health/live`, `/health/ready`.

## Frontend

```sh
cd frontend
npm ci
npm run dev
```

The participant UI and live admin dashboard now use the PRD backend through a validated
adapter. Set `NEXT_PUBLIC_API_MODE=live` and `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1`.
The saved local configuration uses the test Supabase project. Sign in at `/login`.
The endpoint mapping is in [docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md).
The original simulation dashboard is available in mock mode.
Use `frontend/` as the project root for frontend hosting and tooling.

DigitalOcean deployment and large-scale benchmarking are deferred.
