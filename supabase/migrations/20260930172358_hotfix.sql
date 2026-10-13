-- Hotfix appliqué historiquement en direct sur le projet (supabase_migrations).
-- Reconstruit depuis l'historique distant le 13/10/2026 — version 20260930172358.
-- Conservé tel quel : source de vérité pour la rejouabilité.
DO $$ BEGIN
  CREATE TYPE public.trajectoire_ref_kind AS ENUM ('trace_tribu', 'randonnee_perso');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.trajectoire_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trajectoire_id    uuid NOT NULL REFERENCES public.trajectoire_snapshots (id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  version           integer NOT NULL,
  engine_version    text NOT NULL,
  scale_t           double precision NOT NULL,
  zone              public.trajectoire_zone NOT NULL,
  grain             public.trajectoire_grain NOT NULL,
  hours             integer NOT NULL,
  plan              jsonb NOT NULL,
  sources_hash      text NOT NULL,
  narration         text,
  narration_origin  text NOT NULL DEFAULT 'deterministe',
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trajectoire_plans_version_chk CHECK (version >= 1),
  CONSTRAINT trajectoire_plans_t_range_chk CHECK (scale_t >= 0 AND scale_t <= 1),
  CONSTRAINT trajectoire_plans_hours_range_chk CHECK (hours >= 1 AND hours <= 720),
  CONSTRAINT trajectoire_plans_object_chk CHECK (jsonb_typeof(plan) = 'object'),
  CONSTRAINT trajectoire_plans_narration_origin_chk
    CHECK (narration IS NULL OR narration_origin IN ('modele', 'deterministe'))
);

CREATE UNIQUE INDEX IF NOT EXISTS trajectoire_plans_version_uniq
  ON public.trajectoire_plans (trajectoire_id, version);
CREATE INDEX IF NOT EXISTS trajectoire_plans_history_idx
  ON public.trajectoire_plans (trajectoire_id, version DESC);
CREATE INDEX IF NOT EXISTS trajectoire_plans_hash_idx
  ON public.trajectoire_plans (trajectoire_id, sources_hash);
CREATE INDEX IF NOT EXISTS trajectoire_plans_user_idx
  ON public.trajectoire_plans (user_id);

CREATE TABLE IF NOT EXISTS public.trajectoire_trace_refs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid NOT NULL REFERENCES public.trajectoire_plans (id) ON DELETE CASCADE,
  trajectoire_id  uuid NOT NULL REFERENCES public.trajectoire_snapshots (id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trace_id        text NOT NULL,
  kind            public.trajectoire_ref_kind NOT NULL,
  context         text NOT NULL,
  trace_hours     integer NOT NULL,
  scale_match     double precision NOT NULL,
  at_your_scale   boolean NOT NULL DEFAULT false,
  rank            integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trajectoire_trace_refs_hours_chk CHECK (trace_hours >= 1 AND trace_hours <= 720),
  CONSTRAINT trajectoire_trace_refs_match_chk CHECK (scale_match >= 0 AND scale_match <= 1),
  CONSTRAINT trajectoire_trace_refs_rank_chk CHECK (rank >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS trajectoire_trace_refs_uniq
  ON public.trajectoire_trace_refs (plan_id, kind, trace_id);
CREATE INDEX IF NOT EXISTS trajectoire_trace_refs_at_scale_idx
  ON public.trajectoire_trace_refs (trajectoire_id, at_your_scale DESC, rank);
CREATE INDEX IF NOT EXISTS trajectoire_trace_refs_lookup_idx
  ON public.trajectoire_trace_refs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.trajectoire_veille (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trajectoire_id  uuid NOT NULL REFERENCES public.trajectoire_snapshots (id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind            text NOT NULL,
  label           text NOT NULL,
  detail          text,
  threshold       jsonb NOT NULL DEFAULT '{}'::jsonb,
  active          boolean NOT NULL DEFAULT true,
  proposed_t      double precision,
  proposal_state  text NOT NULL DEFAULT 'pending',
  triggered_at    timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trajectoire_veille_kind_chk CHECK (kind IN ('meteo', 'prix', 'creneaux', 'dangerosite')),
  CONSTRAINT trajectoire_veille_proposal_chk CHECK (proposal_state IN ('pending', 'accepted', 'declined', 'expired')),
  CONSTRAINT trajectoire_veille_proposed_t_chk CHECK (proposed_t IS NULL OR (proposed_t >= 0 AND proposed_t <= 1)),
  CONSTRAINT trajectoire_veille_resolution_chk CHECK (resolved_at IS NULL OR triggered_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS trajectoire_veille_active_idx
  ON public.trajectoire_veille (user_id, kind, active);
CREATE INDEX IF NOT EXISTS trajectoire_veille_traj_idx
  ON public.trajectoire_veille (trajectoire_id);

DROP TRIGGER IF EXISTS trg_trajectoire_veille_updated_at ON public.trajectoire_veille;
CREATE TRIGGER trg_trajectoire_veille_updated_at
  BEFORE UPDATE ON public.trajectoire_veille
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.trajectoire_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trajectoire_trace_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trajectoire_veille ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trajectoire_plans_select_own" ON public.trajectoire_plans;
CREATE POLICY "trajectoire_plans_select_own" ON public.trajectoire_plans
  FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());
DROP POLICY IF EXISTS "trajectoire_plans_insert_own" ON public.trajectoire_plans;
CREATE POLICY "trajectoire_plans_insert_own" ON public.trajectoire_plans
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "trajectoire_trace_refs_select_own" ON public.trajectoire_trace_refs;
CREATE POLICY "trajectoire_trace_refs_select_own" ON public.trajectoire_trace_refs
  FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());
DROP POLICY IF EXISTS "trajectoire_trace_refs_insert_own" ON public.trajectoire_trace_refs;
CREATE POLICY "trajectoire_trace_refs_insert_own" ON public.trajectoire_trace_refs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "trajectoire_veille_select_own" ON public.trajectoire_veille;
CREATE POLICY "trajectoire_veille_select_own" ON public.trajectoire_veille
  FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());
DROP POLICY IF EXISTS "trajectoire_veille_insert_own" ON public.trajectoire_veille;
CREATE POLICY "trajectoire_veille_insert_own" ON public.trajectoire_veille
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
DROP POLICY IF EXISTS "trajectoire_veille_update_own" ON public.trajectoire_veille;
CREATE POLICY "trajectoire_veille_update_own" ON public.trajectoire_veille
  FOR UPDATE USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
DROP POLICY IF EXISTS "trajectoire_veille_delete_own" ON public.trajectoire_veille;
CREATE POLICY "trajectoire_veille_delete_own" ON public.trajectoire_veille
  FOR DELETE USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_latest_trajectory_plan(p_trajectoire_id uuid)
RETURNS TABLE (
  id uuid, version integer, engine_version text, scale_t double precision,
  zone public.trajectoire_zone, grain public.trajectoire_grain, hours integer,
  plan jsonb, sources_hash text, narration text, narration_origin text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.version, p.engine_version, p.scale_t, p.zone, p.grain, p.hours,
         p.plan, p.sources_hash, p.narration, p.narration_origin, p.created_at
  FROM public.trajectoire_plans p
  WHERE p.trajectoire_id = p_trajectoire_id AND p.user_id = auth.uid()
  ORDER BY p.version DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_latest_trajectory_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_latest_trajectory_plan(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.count_trajectoire_at_scale(p_trajectoire_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.trajectoire_trace_refs r
  WHERE r.trajectoire_id = p_trajectoire_id
    AND r.user_id = auth.uid()
    AND r.at_your_scale;
$$;
REVOKE ALL ON FUNCTION public.count_trajectoire_at_scale(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_trajectoire_at_scale(uuid) TO authenticated;
