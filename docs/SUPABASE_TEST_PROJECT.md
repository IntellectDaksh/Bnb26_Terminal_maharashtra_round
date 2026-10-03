# Supabase test project

- Name: `fair-drop`
- Organization: `AnshulRoy28's Org`
- Region: Mumbai (`ap-south-1`)
- Project ref: `kigpqxgmkqdyqrqghqdu`
- Dashboard: https://supabase.com/dashboard/project/kigpqxgmkqdyqrqghqdu
- Auth/API origin: https://kigpqxgmkqdyqrqghqdu.supabase.co
- Verified session pooler: `aws-0-ap-south-1.pooler.supabase.com:5432`
- API/worker login: `fairdrop_api`, inheriting the `fairdrop_backend` access role

`backend/.env` contains the generated database password and the public Supabase key. It is
ignored by Git. `backend/certs/supabase-ca.crt` is the public Supabase Root 2021 CA; the client
verifies the server's chain and hostname. No passwords are stored in SQL migrations or docs.

Both migrations were applied to the live project. The allocation tables use RLS in the private
`fairdrop` schema; `anon` and `authenticated` have no schema access. The API role can read
admin membership but cannot grant it. Supabase security and performance advisors returned
no findings after the composite reservation foreign-key index was added.

The five-user/two-ticket acceptance scenario passed against the actual Supabase database using
temporary identity fixtures: permanent ranks, FIFO offers, three-minute windows, idempotent
confirmation, expiry and replacement, and exactly two confirmed tickets. The test forced one
offer overdue to exercise recovery without waiting three minutes. Temporary fixture users and
allocation rows were removed afterward. This verified the allocation services and database role;
it did not verify Google OAuth. The isolated PostgreSQL suite contains the concurrency/race tests.

Local API documentation is at http://127.0.0.1:8000/docs. The API and separate worker use
`backend/.env`; run the commands in `backend/README.md` to restart them.

Live frontend setup is complete:

- Google OAuth and localhost redirect configuration were completed by the user.
- `frontend/.env.local` uses live mode, the project's public URL/publishable key, and
  `http://127.0.0.1:8000/api/v1`. Both runtime env files are ignored by Git.
- Google sign-in created the verified account `royanshul5002@gmail.com`. That account
  was explicitly approved in `fairdrop.administrators`; signed admin status requests
  returned HTTP 200. No JWT metadata role is required.
- The draft test event is `c4a56c7a-a7eb-46f7-a2e5-7cc0b1f5872a`, named
  `Fair Drop Backend Test`, capacity 2. Open it from `/admin`, register participants,
  then close registration and draw. Offers last three minutes and the independent
  worker refills expired offers.
- The public event catalog, participant adapter and live allocation admin dashboard are
  implemented. Advanced demo telemetry remains available only in mock mode.

The saved backend configuration explicitly uses `SECURITY_ALLOW_DEVELOPMENT=true`.
Connect the external security-verification URL/secret and disable the bypass before
production; production settings reject this bypass. The displayed test schedule is
its registration deadline; venue/category are presentation defaults.

A repeat live acceptance run also verified the independently running worker process: it
detected the overdue offer and admitted the next participant without invoking the expiration
helper from the test script. The worker logged one expired reservation. Temporary data from
this run was also removed.

DigitalOcean deployment remains deferred as requested. This project is for testing.
