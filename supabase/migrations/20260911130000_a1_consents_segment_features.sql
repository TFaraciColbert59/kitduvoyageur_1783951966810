-- ==============================================================================
-- A1 — Domaine central, BDD et sécurité (Phase 1)
-- M1 : consentements par finalité + enrichissement des segments
-- Migration additive et idempotente. Aucun connecteur santé réel (Phase 1).
-- ==============================================================================

-- ── 0. Helper updated_at du domaine ──────────────────────────────────────────
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

-- ── 1. Consentements par finalité (RGPD) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.adventure_data_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  policy_version text NOT NULL DEFAULT 'a1-v1',
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adventure_data_consents_purpose_check CHECK (
    purpose IN (
      'personal_performance',
      'collective_terrain',
      'live_location',
      'group_location',
      'external_readiness'
    )
  ),
  CONSTRAINT adventure_data_consents_unique UNIQUE (user_id, purpose, policy_version),
  CONSTRAINT adventure_data_consents_external_readiness_disabled CHECK (
    purpose <> 'external_readiness' OR granted = false
  )
);

COMMENT ON TABLE public.adventure_data_consents IS
  'Consentements par finalité du domaine Adventure Intelligence. '
  'external_readiness est désactivé en Phase 1 (aucun connecteur santé réel).';

CREATE INDEX IF NOT EXISTS idx_adventure_data_consents_user
  ON public.adventure_data_consents(user_id, purpose);

ALTER TABLE public.adventure_data_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adventure_data_consents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adventure_consents_select_own" ON public.adventure_data_consents;
CREATE POLICY "adventure_consents_select_own"
  ON public.adventure_data_consents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "adventure_consents_insert_own" ON public.adventure_data_consents;
CREATE POLICY "adventure_consents_insert_own"
  ON public.adventure_data_consents FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT (purpose = 'external_readiness' AND granted = true)
  );

DROP POLICY IF EXISTS "adventure_consents_update_own" ON public.adventure_data_consents;
CREATE POLICY "adventure_consents_update_own"
  ON public.adventure_data_consents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND NOT (purpose = 'external_readiness' AND granted = true)
  );

DROP POLICY IF EXISTS "adventure_consents_all_service" ON public.adventure_data_consents;
CREATE POLICY "adventure_consents_all_service"
  ON public.adventure_data_consents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_adventure_consents_updated_at ON public.adventure_data_consents;
CREATE TRIGGER trg_adventure_consents_updated_at
  BEFORE UPDATE ON public.adventure_data_consents
  FOR EACH ROW EXECUTE FUNCTION public.adventure_touch_updated_at();

-- ── 2. Enrichissement des segments (1:1 avec trail_segments) ─────────────────
-- trail_segments reste l'unique réseau géographique (ADR-AI-002).
CREATE TABLE IF NOT EXISTS public.trail_segment_features (
  segment_id bigint PRIMARY KEY REFERENCES public.trail_segments(id) ON DELETE CASCADE,
  length_m numeric NOT NULL DEFAULT 0 CHECK (length_m >= 0),
  direction text NOT NULL DEFAULT 'both'
    CHECK (direction IN ('forward', 'reverse', 'both')),
  mean_grade_pct numeric,
  max_grade_pct numeric,
  gain_m numeric CHECK (gain_m IS NULL OR gain_m >= 0),
  loss_m numeric CHECK (loss_m IS NULL OR loss_m >= 0),
  altitude_min_m numeric,
  altitude_max_m numeric,
  surface text,
  technical_class smallint CHECK (technical_class BETWEEN 0 AND 5),
  exposure_class smallint CHECK (exposure_class BETWEEN 0 AND 5),
  isolation_class smallint CHECK (isolation_class BETWEEN 0 AND 5),
  source text NOT NULL DEFAULT 'computed',
  computed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trail_segment_features IS
  'Caractéristiques dérivées par segment (pente, D+/D-, classes 0..5). '
  'Écrite par le traitement serveur (Phase 2), lecture publique non sensible.';

ALTER TABLE public.trail_segment_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trail_segment_features_select_public" ON public.trail_segment_features;
CREATE POLICY "trail_segment_features_select_public"
  ON public.trail_segment_features FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "trail_segment_features_all_service" ON public.trail_segment_features;
CREATE POLICY "trail_segment_features_all_service"
  ON public.trail_segment_features FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_trail_segment_features_updated_at ON public.trail_segment_features;
CREATE TRIGGER trg_trail_segment_features_updated_at
  BEFORE UPDATE ON public.trail_segment_features
  FOR EACH ROW EXECUTE FUNCTION public.adventure_touch_updated_at();
