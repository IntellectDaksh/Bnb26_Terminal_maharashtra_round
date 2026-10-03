# Database CA certificates

For Supabase PostgreSQL, download the server CA from the project's Dashboard → Database
Settings → SSL configuration and save it here. Configure `DATABASE_SSL_CA_FILE` with the
path relative to `backend/` (for example, `certs/supabase-ca.crt`). The Docker image includes
this folder. Public CA certificates may be committed; private keys must never be committed.
