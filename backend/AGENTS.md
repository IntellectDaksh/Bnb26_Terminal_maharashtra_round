# Backend

- The backend PRD in `../docs/BACKEND_PRD.md` is authoritative for allocation behavior.
- Use SQL migrations in `../supabase/migrations/`; do not call ORM create_all in the API.
- Service entry points own their transaction. Internal admission/expiry helpers do not commit.
- Every allocation writer locks the event row first, then reads `clock_timestamp()`.
- Use verified Supabase subjects and database administrator membership, never client identity.
- Never add an expiration scheduler to the FastAPI process.
- Run ruff and unit tests. Run integration tests against an isolated PostgreSQL `_test` database.
- Keep runtime lockfiles synchronized with `uv.lock`.
