-- H7.1 — Télémétrie hub (rejouable). INSERT-only côté authenticated ;
-- lecture réservée service_role (dashboard admin via vue H7.4).

CREATE TABLE IF NOT EXISTS public.hub_telemetry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    uuid NOT NULL,
  event_name    text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts            timestamptz NOT NULL DEFAULT now(),
  app_version   text NOT NULL DEFAULT '0.0.0',
  CONSTRAINT event_name_format CHECK (event_name ~ '^[a-z][a-z0-9_]{2,40}$'),
  CONSTRAINT payload_size CHECK (octet_length(payload::text) < 8192)
);

CREATE INDEX IF NOT EXISTS idx_hub_telemetry_user_ts
  ON public.hub_telemetry(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_hub_telemetry_session_ts
  ON public.hub_telemetry(session_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_hub_telemetry_event_ts
  ON public.hub_telemetry(event_name, ts DESC);

ALTER TABLE public.hub_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_telemetry FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hub_telemetry'
      AND policyname = 'hub_telemetry_insert_own'
  ) THEN
    CREATE POLICY hub_telemetry_insert_own
      ON public.hub_telemetry
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
  -- Lecture admin : is_admin() existe déjà en base (utilisé par /api/admin/*).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hub_telemetry'
      AND policyname = 'hub_telemetry_select_admin'
  ) THEN
    CREATE POLICY hub_telemetry_select_admin
      ON public.hub_telemetry
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END $$;
