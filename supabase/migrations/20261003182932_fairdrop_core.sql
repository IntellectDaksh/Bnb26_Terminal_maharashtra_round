-- Allocation data is private. Apply as the Supabase migration owner, not a browser role.
CREATE SCHEMA fairdrop;
REVOKE ALL ON SCHEMA fairdrop FROM PUBLIC, anon, authenticated;

CREATE TYPE fairdrop.event_status AS ENUM ('DRAFT','OPEN','DRAWING','LIVE','FINISHED','CANCELLED');
CREATE TYPE fairdrop.registration_status AS ENUM ('ELIGIBLE','QUEUED','OFFERED','CONFIRMED','EXPIRED');
CREATE TYPE fairdrop.reservation_status AS ENUM ('OFFERED','CONFIRMED','EXPIRED');

CREATE TABLE fairdrop.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status fairdrop.event_status NOT NULL DEFAULT 'DRAFT',
    registration_opens_at TIMESTAMPTZ NOT NULL,
    registration_closes_at TIMESTAMPTZ NOT NULL,
    next_queue_position INTEGER NOT NULL DEFAULT 1 CHECK (next_queue_position > 0),
    draw_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (registration_closes_at > registration_opens_at),
    CHECK (status NOT IN ('LIVE','FINISHED') OR draw_completed_at IS NOT NULL)
);
-- Allow draft configuration, but only one allocating/open event at a time.
CREATE UNIQUE INDEX one_active_event ON fairdrop.events ((true))
    WHERE status IN ('OPEN','DRAWING','LIVE');

CREATE TABLE fairdrop.registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES fairdrop.events(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    status fairdrop.registration_status NOT NULL DEFAULT 'ELIGIBLE',
    queue_position INTEGER CHECK (queue_position > 0),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (event_id, user_id),
    UNIQUE (event_id, queue_position),
    UNIQUE (event_id, id),
    CHECK ((status = 'ELIGIBLE' AND queue_position IS NULL)
        OR (status <> 'ELIGIBLE' AND queue_position IS NOT NULL))
);
CREATE INDEX registrations_admission ON fairdrop.registrations (event_id, queue_position)
    WHERE status = 'QUEUED';
CREATE INDEX registrations_user ON fairdrop.registrations (user_id);

CREATE TABLE fairdrop.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES fairdrop.events(id),
    registration_id UUID NOT NULL UNIQUE,
    status fairdrop.reservation_status NOT NULL DEFAULT 'OFFERED',
    offered_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    FOREIGN KEY (event_id, registration_id) REFERENCES fairdrop.registrations(event_id, id),
    CHECK (expires_at > offered_at),
    CHECK ((status = 'CONFIRMED' AND confirmed_at IS NOT NULL
            AND confirmed_at >= offered_at AND confirmed_at < expires_at)
        OR (status <> 'CONFIRMED' AND confirmed_at IS NULL))
);
CREATE INDEX reservations_due ON fairdrop.reservations (event_id, expires_at)
    WHERE status = 'OFFERED';
CREATE INDEX reservations_inventory ON fairdrop.reservations (event_id, status);

CREATE TABLE fairdrop.administrators (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Prevent accidental reranking, including clearing a position after it was assigned.
CREATE FUNCTION fairdrop.preserve_queue_position() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF OLD.queue_position IS NOT NULL AND NEW.queue_position IS DISTINCT FROM OLD.queue_position THEN
        RAISE EXCEPTION 'Assigned queue positions are immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Registration ownership is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER preserve_queue_position BEFORE UPDATE ON fairdrop.registrations
    FOR EACH ROW EXECUTE FUNCTION fairdrop.preserve_queue_position();
REVOKE ALL ON FUNCTION fairdrop.preserve_queue_position() FROM PUBLIC, anon, authenticated;

-- RLS is defense in depth. Browser roles receive neither grants nor policies.
ALTER TABLE fairdrop.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fairdrop.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fairdrop.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fairdrop.administrators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA fairdrop FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA fairdrop REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA fairdrop REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Dedicated application access group. Provision a password-bearing login separately.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fairdrop_backend') THEN
        CREATE ROLE fairdrop_backend NOLOGIN;
    END IF;
END $$;
GRANT USAGE ON SCHEMA fairdrop TO fairdrop_backend;
GRANT SELECT, INSERT, UPDATE ON fairdrop.events, fairdrop.registrations, fairdrop.reservations
    TO fairdrop_backend;
GRANT SELECT ON fairdrop.administrators TO fairdrop_backend;
CREATE POLICY backend_events ON fairdrop.events TO fairdrop_backend USING (true) WITH CHECK (true);
CREATE POLICY backend_registrations ON fairdrop.registrations TO fairdrop_backend
    USING (true) WITH CHECK (true);
CREATE POLICY backend_reservations ON fairdrop.reservations TO fairdrop_backend
    USING (true) WITH CHECK (true);
CREATE POLICY backend_admin_read ON fairdrop.administrators FOR SELECT
    TO fairdrop_backend USING (true);
