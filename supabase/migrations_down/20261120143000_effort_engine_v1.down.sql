-- ==============================================================================
-- ROLLBACK LOT P3 — PERSISTANCE SUPABASE, RLS & SHADOW MODE (Effort Engine V1)
-- Migration down : 20261120143000_effort_engine_v1.down.sql
--
-- Annule proprement les ajouts de 20261120143000_effort_engine_v1.sql sans
-- jamais détruire les données préexistantes (notamment les consentements
-- 'personal_performance' et les lignes route_predictions solo existantes).
-- ==============================================================================

-- 1. Retrait des 2 feature flags shadow P3
DELETE FROM public.feature_flags
WHERE id IN ('effort_score_v1_shadow', 'group_prediction_v2_shadow');

-- 2. Restauration de public.has_active_consent (définition A10)
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
  SELECT COALESCE((
    SELECT (c.granted AND c.revoked_at IS NULL)
    FROM public.adventure_data_consents c
    WHERE c.user_id = p_user_id
      AND c.purpose = p_purpose
    ORDER BY c.policy_version DESC
    LIMIT 1
  ), false);
$fn$;

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

-- 3. Nettoyage des nouvelles finalités éventuelles avant restauration du CHECK A1
DELETE FROM public.adventure_data_consents
WHERE purpose IN (
  'personal_scoring',
  'wearable_sync',
  'group_simulation',
  'anonymized_calibration',
  'collective_aggregation',
  'terrain_contribution'
);

ALTER TABLE public.adventure_data_consents
  DROP CONSTRAINT IF EXISTS adventure_data_consents_purpose_check;

ALTER TABLE public.adventure_data_consents
  ADD CONSTRAINT adventure_data_consents_purpose_check CHECK (
    purpose IN (
      'personal_performance',
      'collective_terrain',
      'live_location',
      'group_location',
      'external_readiness'
    )
  );

-- 4. Suppression de la table group_prediction_members et restauration route_predictions
DROP TABLE IF EXISTS public.group_prediction_members CASCADE;

DROP POLICY IF EXISTS "route_predictions_select_own" ON public.route_predictions;
CREATE POLICY "route_predictions_select_own"
  ON public.route_predictions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP INDEX IF EXISTS public.idx_route_predictions_member_user;

DELETE FROM public.route_predictions
WHERE scope = 'member';

ALTER TABLE public.route_predictions
  DROP COLUMN IF EXISTS member_user_id,
  DROP COLUMN IF EXISTS scope;

-- 5. Retrait de la colonne posterior sur public.user_performance_profiles
ALTER TABLE public.user_performance_profiles
  DROP COLUMN IF EXISTS posterior;

-- 6. Suppression de la RPC et des tables effort_scores et user_physiology
DROP FUNCTION IF EXISTS public.persist_effort_score_shadow(jsonb);
DROP TABLE IF EXISTS public.effort_scores CASCADE;
DROP TABLE IF EXISTS public.user_physiology CASCADE;
