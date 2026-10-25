-- H4.2 — Feature flags du hub (rejouable, cf. 8e3b7ffa).
-- Lecture : authenticated via RPC SECURITY DEFINER.
-- Écriture : service_role uniquement (aucune policy INSERT/UPDATE/DELETE).

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id            text PRIMARY KEY,
  enabled       boolean NOT NULL DEFAULT false,
  scope         text NOT NULL DEFAULT 'global',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.feature_flags(id, enabled) VALUES
  ('hub_possession_enabled', false),
  ('hub_sortie_enabled', false),
  ('hub_collectif_enabled', false),
  ('hub_all_enabled', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feature_flags'
      AND policyname = 'feature_flags_select_all_authenticated'
  ) THEN
    CREATE POLICY feature_flags_select_all_authenticated
      ON public.feature_flags
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.current_feature_flags()
RETURNS TABLE(id text, enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, enabled FROM public.feature_flags ORDER BY id;
$$;

REVOKE ALL ON FUNCTION public.current_feature_flags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_feature_flags() TO authenticated;
