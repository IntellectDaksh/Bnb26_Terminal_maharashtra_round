CREATE INDEX reservations_registration_event ON fairdrop.reservations (event_id, registration_id);

-- Credentials are provisioned outside migrations; no password is committed to source control.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fairdrop_api') THEN
        CREATE ROLE fairdrop_api LOGIN INHERIT;
    END IF;
END $$;
GRANT fairdrop_backend TO fairdrop_api;
