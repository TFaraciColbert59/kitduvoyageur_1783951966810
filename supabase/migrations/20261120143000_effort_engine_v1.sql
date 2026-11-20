-- ==============================================================================
-- LOT P3 — PERSISTANCE SUPABASE, RLS & SHADOW MODE (Effort Engine V1)
-- Migration : 20261120143000_effort_engine_v1.sql
--
-- Schéma strictement additif et rétrocompatible (aucun renommage de table) :
--   1. public.user_physiology (RLS ENABLE + FORCE, policies select/insert/update/
--      delete_own alignées sur (SELECT auth.uid()) = user_id, conformes au
--      correctif PostgreSQL 17.6 RLS ON CONFLICT).
--   2. public.effort_scores (RLS ENABLE + FORCE, lecture select_own, écriture
--      service_role uniquement avec ON CONFLICT (snapshot_hash) DO NOTHING pour
--      garantir l'immutabilité Contrat C).
--   3. Colonne additive posterior jsonb sur public.user_performance_profiles.
--   4. Colonnes additives scope et member_user_id sur public.route_predictions +
--      table public.group_prediction_members (RLS strict : lisible uniquement
--      par member_user_id = (SELECT auth.uid()) ou service_role).
--   5. Extension rétrocompatible de public.adventure_data_consents.purpose
--      (conservation de 'personal_performance' déjà présent en base + ajout de
--      'personal_scoring', 'wearable_sync', 'group_simulation',
--      'anonymized_calibration', 'collective_aggregation', 'terrain_contribution')
--      et mise à jour rétrocompatible de public.has_active_consent().
--   6. Insertion idempotente des 2 feature flags shadow à enabled = false :
--      effort_score_v1_shadow, group_prediction_v2_shadow.
-- ==============================================================================

-- ── 0. Fonction helper updated_at (idempotente) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.adventure_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ── 1. Paramètres physiologiques privés (public.user_physiology) ──────────────
CREATE TABLE IF NOT EXISTS public.user_physiology (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric CHECK (weight_kg > 20 AND weight_kg <= 250),
  sex text CHECK (sex IN ('female', 'male', 'other', 'unspecified')),
  birth_year integer CHECK (birth_year >= 1900 AND birth_year <= 2026),
  declared_level text,
  hr_rest integer CHECK (hr_rest >= 25 AND hr_rest <= 130),
  hr_max integer CHECK (hr_max >= 100 AND hr_max <= 240),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_physiology_hr_order CHECK (
    hr_rest IS NULL OR hr_max IS NULL OR hr_rest < hr_max
  )
);

COMMENT ON TABLE public.user_physiology IS
  'Paramètres physiologiques privés du moteur bioénergétique (masse corporelle, '
  'sexe déclaratif, année de naissance, FC repos/max). Strictement isolée de '
  'user_profiles et des vues publiques. RLS ENABLE + FORCE, propriétaire seul.';

ALTER TABLE public.user_physiology ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_physiology FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own" ON public.user_physiology;
CREATE POLICY "select_own"
  ON public.user_physiology FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "insert_own" ON public.user_physiology;
CREATE POLICY "insert_own"
  ON public.user_physiology FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "update_own" ON public.user_physiology;
CREATE POLICY "update_own"
  ON public.user_physiology FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "delete_own" ON public.user_physiology;
CREATE POLICY "delete_own"
  ON public.user_physiology FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "all_service" ON public.user_physiology;
CREATE POLICY "all_service"
  ON public.user_physiology FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_user_physiology_updated_at ON public.user_physiology;
CREATE TRIGGER trg_user_physiology_updated_at
  BEFORE UPDATE ON public.user_physiology
  FOR EACH ROW EXECUTE FUNCTION public.adventure_touch_updated_at();

REVOKE ALL ON TABLE public.user_physiology FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.user_physiology FROM anon;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_physiology TO authenticated;
GRANT ALL ON TABLE public.user_physiology TO service_role;

-- ── 2. Scores d'effort bioénergétiques immuables (public.effort_scores) ───────
CREATE TABLE IF NOT EXISTS public.effort_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hike_session_id uuid REFERENCES public.hike_sessions(id) ON DELETE SET NULL,
  score_version text NOT NULL,
  snapshot_hash text NOT NULL UNIQUE,
  iea numeric NOT NULL CHECK (iea >= 0 AND iea <= 100),
  erp numeric NOT NULL CHECK (erp >= 0 AND erp <= 100),
  e_flat_km numeric NOT NULL CHECK (e_flat_km >= 0),
  raw_dose numeric NOT NULL CHECK (raw_dose >= 0),
  technicite smallint NOT NULL CHECK (technicite BETWEEN 1 AND 5),
  risque jsonb NOT NULL DEFAULT '{}'::jsonb,
  multipliers jsonb NOT NULL DEFAULT '{}'::jsonb,
  shapley jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_level text NOT NULL CHECK (data_level IN ('socle', 'cardio', 'complet')),
  interval_p10 numeric NOT NULL,
  interval_p50 numeric NOT NULL,
  interval_p90 numeric NOT NULL,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_shadow boolean NOT NULL DEFAULT true,
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT effort_scores_interval_order CHECK (
    interval_p10 >= 0
    AND interval_p10 <= interval_p50
    AND interval_p50 <= interval_p90
  )
);

COMMENT ON TABLE public.effort_scores IS
  'Snapshots immuables du score d''effort bioénergétique (IEA, ERP, eFlatKm, '
  'rawDose, technicité 1..5, risque séparé, multiplicateurs, attribution Shapley, '
  'data_level socle/cardio/complet, intervalle P10/P50/P90, Evidence<T>). '
  'Lecture propriétaire (select_own), écriture service_role uniquement avec '
  'ON CONFLICT (snapshot_hash) DO NOTHING (Contrat C).';

CREATE INDEX IF NOT EXISTS idx_effort_scores_user_computed
  ON public.effort_scores(user_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_effort_scores_hike_session
  ON public.effort_scores(hike_session_id)
  WHERE hike_session_id IS NOT NULL;

ALTER TABLE public.effort_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.effort_scores FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own" ON public.effort_scores;
CREATE POLICY "select_own"
  ON public.effort_scores FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "all_service" ON public.effort_scores;
CREATE POLICY "all_service"
  ON public.effort_scores FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.effort_scores FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.effort_scores FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.effort_scores FROM authenticated;
  END IF;
END $$;
GRANT SELECT ON TABLE public.effort_scores TO authenticated;
GRANT ALL ON TABLE public.effort_scores TO service_role;

-- RPC d'écriture idempotente Contrat C : ON CONFLICT (snapshot_hash) DO NOTHING
CREATE OR REPLACE FUNCTION public.persist_effort_score_shadow(
  p_score jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_id uuid;
  v_hash text;
BEGIN
  IF p_score IS NULL OR jsonb_typeof(p_score) <> 'object' THEN
    RAISE EXCEPTION 'persist_effort_score_shadow: p_score jsonb obligatoire';
  END IF;

  v_hash := NULLIF(p_score->>'snapshot_hash', '');
  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'persist_effort_score_shadow: snapshot_hash obligatoire';
  END IF;

  INSERT INTO public.effort_scores (
    user_id,
    hike_session_id,
    score_version,
    snapshot_hash,
    iea,
    erp,
    e_flat_km,
    raw_dose,
    technicite,
    risque,
    multipliers,
    shapley,
    data_level,
    interval_p10,
    interval_p50,
    interval_p90,
    confidence,
    evidence,
    warnings,
    is_shadow,
    computed_at
  )
  VALUES (
    (p_score->>'user_id')::uuid,
    (NULLIF(p_score->>'hike_session_id', ''))::uuid,
    COALESCE(NULLIF(p_score->>'score_version', ''), 'effort-score-v1'),
    v_hash,
    (p_score->>'iea')::numeric,
    (p_score->>'erp')::numeric,
    (p_score->>'e_flat_km')::numeric,
    (p_score->>'raw_dose')::numeric,
    (p_score->>'technicite')::smallint,
    COALESCE(p_score->'risque', '{}'::jsonb),
    COALESCE(p_score->'multipliers', '{}'::jsonb),
    COALESCE(p_score->'shapley', '{}'::jsonb),
    COALESCE(NULLIF(p_score->>'data_level', ''), 'socle'),
    (p_score->>'interval_p10')::numeric,
    (p_score->>'interval_p50')::numeric,
    (p_score->>'interval_p90')::numeric,
    COALESCE(p_score->'confidence', '{}'::jsonb),
    COALESCE(p_score->'evidence', '[]'::jsonb),
    COALESCE(p_score->'warnings', '[]'::jsonb),
    COALESCE((p_score->>'is_shadow')::boolean, true),
    COALESCE((NULLIF(p_score->>'computed_at', ''))::timestamptz, now())
  )
  ON CONFLICT (snapshot_hash) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT e.id INTO v_id
    FROM public.effort_scores e
    WHERE e.snapshot_hash = v_hash
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$fn$;

COMMENT ON FUNCTION public.persist_effort_score_shadow(jsonb) IS
  'P3 — persistance idempotente et immuable (Contrat C : ON CONFLICT '
  '(snapshot_hash) DO NOTHING) d''un score d''effort dans public.effort_scores. '
  'SECURITY DEFINER, service_role uniquement.';

REVOKE ALL ON FUNCTION public.persist_effort_score_shadow(jsonb) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.persist_effort_score_shadow(jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.persist_effort_score_shadow(jsonb) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.persist_effort_score_shadow(jsonb) TO service_role;

-- ── 3. Colonne additive posterior sur public.user_performance_profiles ────────
ALTER TABLE public.user_performance_profiles
  ADD COLUMN IF NOT EXISTS posterior jsonb;

COMMENT ON COLUMN public.user_performance_profiles.posterior IS
  'Distribution a posteriori bayésienne RLS du profil personnel (theta, '
  'covariance P, n_solo_sessions).';

DROP POLICY IF EXISTS "performance_profiles_select_own" ON public.user_performance_profiles;
CREATE POLICY "performance_profiles_select_own"
  ON public.user_performance_profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ── 4. Prédictions de groupe & isolation membre par membre ────────────────────
ALTER TABLE public.route_predictions
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'solo'
    CHECK (scope IN ('solo', 'group', 'member')),
  ADD COLUMN IF NOT EXISTS member_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.route_predictions.scope IS
  'Portée de la prédiction : solo (individuelle), group (projection collective '
  'sans biométrie), member (prédiction personnelle d''un membre de groupe, '
  'lisible uniquement par member_user_id = auth.uid()).';

COMMENT ON COLUMN public.route_predictions.member_user_id IS
  'Identifiant du membre cible lorsque scope = ''member''. Strictement isolé '
  'par RLS : aucun autre membre ni organisateur du groupe ne peut lire la ligne.';

CREATE INDEX IF NOT EXISTS idx_route_predictions_member_user
  ON public.route_predictions(member_user_id, computed_at DESC)
  WHERE member_user_id IS NOT NULL;

DROP POLICY IF EXISTS "route_predictions_select_own" ON public.route_predictions;
CREATE POLICY "route_predictions_select_own"
  ON public.route_predictions FOR SELECT TO authenticated
  USING (
    CASE
      WHEN scope = 'member' THEN member_user_id = (SELECT auth.uid())
      ELSE user_id = (SELECT auth.uid())
        AND (member_user_id IS NULL OR member_user_id = (SELECT auth.uid()))
    END
  );

CREATE TABLE IF NOT EXISTS public.group_prediction_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_prediction_id uuid NOT NULL REFERENCES public.route_predictions(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.adventure_plans(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'regroupement' CHECK (mode IN ('compact', 'regroupement')),
  iea numeric CHECK (iea IS NULL OR (iea >= 0 AND iea <= 100)),
  erp numeric CHECK (erp IS NULL OR (erp >= 0 AND erp <= 100)),
  wait_s integer NOT NULL DEFAULT 0 CHECK (wait_s >= 0),
  cooling_risk_level text CHECK (
    cooling_risk_level IS NULL OR cooling_risk_level IN ('low', 'moderate', 'high', 'critical')
  ),
  data_level text NOT NULL DEFAULT 'socle' CHECK (data_level IN ('socle', 'cardio', 'complet')),
  member_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_prediction_members_unique UNIQUE (route_prediction_id, member_user_id)
);

COMMENT ON TABLE public.group_prediction_members IS
  'Détails individuels par membre lors d''une simulation de groupe. '
  'Confinement biométrique strict (ADR-AI-003) : RLS ENABLE + FORCE, lisible '
  'uniquement par member_user_id = (SELECT auth.uid()) ou service_role, '
  'jamais par un autre membre ou organisateur du groupe.';

CREATE INDEX IF NOT EXISTS idx_group_prediction_members_member
  ON public.group_prediction_members(member_user_id, computed_at DESC);

ALTER TABLE public.group_prediction_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_prediction_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own" ON public.group_prediction_members;
CREATE POLICY "select_own"
  ON public.group_prediction_members FOR SELECT TO authenticated
  USING (member_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "all_service" ON public.group_prediction_members;
CREATE POLICY "all_service"
  ON public.group_prediction_members FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.group_prediction_members FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.group_prediction_members FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.group_prediction_members FROM authenticated;
  END IF;
END $$;
GRANT SELECT ON TABLE public.group_prediction_members TO authenticated;
GRANT ALL ON TABLE public.group_prediction_members TO service_role;

-- ── 5. Extension rétrocompatible de public.adventure_data_consents ────────────
ALTER TABLE public.adventure_data_consents
  DROP CONSTRAINT IF EXISTS adventure_data_consents_purpose_check;

ALTER TABLE public.adventure_data_consents
  ADD CONSTRAINT adventure_data_consents_purpose_check CHECK (
    purpose IN (
      -- Finalités historiques conservées (1 ligne 'personal_performance' en prod)
      'personal_performance',
      'collective_terrain',
      'collective_aggregation',
      'terrain_contribution',
      'live_location',
      'group_location',
      'external_readiness',
      -- Nouvelles finalités granulaires Effort Engine V1
      'personal_scoring',
      'wearable_sync',
      'group_simulation',
      'anonymized_calibration'
    )
  );

DROP POLICY IF EXISTS "adventure_consents_select_own" ON public.adventure_data_consents;
CREATE POLICY "adventure_consents_select_own"
  ON public.adventure_data_consents FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "adventure_consents_insert_own" ON public.adventure_data_consents;
CREATE POLICY "adventure_consents_insert_own"
  ON public.adventure_data_consents FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND NOT (purpose = 'external_readiness' AND granted = true)
  );

DROP POLICY IF EXISTS "adventure_consents_update_own" ON public.adventure_data_consents;
CREATE POLICY "adventure_consents_update_own"
  ON public.adventure_data_consents FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND NOT (purpose = 'external_readiness' AND granted = true)
  );

-- Contrôle de consentement serveur rétrocompatible : pour le calcul personnel
-- ('personal_scoring' ou 'personal_performance'), accepte 'personal_scoring'
-- OU 'personal_performance' (priorité à la finalité exacte si elle a été
-- explicitement définie/révoquée, sinon repli sur l'autre).
CREATE OR REPLACE FUNCTION public.has_active_consent(
  p_user_id uuid,
  p_purpose text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT CASE
    WHEN p_purpose IN ('personal_scoring', 'personal_performance') THEN
      COALESCE(
        (
          SELECT (c.granted AND c.revoked_at IS NULL)
          FROM public.adventure_data_consents c
          WHERE c.user_id = p_user_id
            AND c.purpose = p_purpose
          ORDER BY c.policy_version DESC, c.updated_at DESC
          LIMIT 1
        ),
        (
          SELECT (c.granted AND c.revoked_at IS NULL)
          FROM public.adventure_data_consents c
          WHERE c.user_id = p_user_id
            AND c.purpose IN ('personal_scoring', 'personal_performance')
          ORDER BY c.policy_version DESC, c.updated_at DESC
          LIMIT 1
        ),
        false
      )
    ELSE
      COALESCE((
        SELECT (c.granted AND c.revoked_at IS NULL)
        FROM public.adventure_data_consents c
        WHERE c.user_id = p_user_id
          AND c.purpose = p_purpose
        ORDER BY c.policy_version DESC, c.updated_at DESC
        LIMIT 1
      ), false)
  END;
$fn$;

COMMENT ON FUNCTION public.has_active_consent(uuid, text) IS
  'A10/P3 — consentement courant par finalité : évalue la dernière '
  'policy_version du couple (user, purpose) avec rétrocompatibilité stricte '
  'entre ''personal_scoring'' et ''personal_performance''. SECURITY DEFINER, '
  'service_role uniquement.';

REVOKE ALL ON FUNCTION public.has_active_consent(uuid, text) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.has_active_consent(uuid, text) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.has_active_consent(uuid, text) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.has_active_consent(uuid, text) TO service_role;

-- ── 6. Feature flags shadow (désactivés par défaut, ADR-AI-008) ───────────────
INSERT INTO public.feature_flags (id, enabled) VALUES
  ('effort_score_v1_shadow', false),
  ('group_prediction_v2_shadow', false)
ON CONFLICT (id) DO NOTHING;
