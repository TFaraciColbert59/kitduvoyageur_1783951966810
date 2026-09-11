-- ==============================================================================
-- A1 — M9 : durcissement des privilèges (fonctions SECURITY DEFINER + grants)
-- Contexte : Supabase applique des default privileges qui accordent EXECUTE et
-- DML à anon/authenticated. RLS protège les tables, mais PAS les fonctions.
-- Ce fichier rend le modèle de sécurité déterministe pour tout le domaine A1.
-- ==============================================================================

-- ── 1. Fonctions de traitement : service_role uniquement ─────────────────────
DO $$
DECLARE
  r record;
  v_has_anon boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon');
  v_has_auth boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'claim_pending_adventure_events',
        'a1_sync_terrain_report_counts',
        'claim_pending_ai_jobs'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public', r.sig);
    IF v_has_anon THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    END IF;
    IF v_has_auth THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.claim_pending_adventure_events(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_pending_ai_jobs(integer) TO service_role;

-- ── 2. Grants explicites sur les tables du domaine (RLS reste la barrière) ───
-- Consentements : propriétaire uniquement.
GRANT SELECT, INSERT, UPDATE ON public.adventure_data_consents TO authenticated;
GRANT ALL ON public.adventure_data_consents TO service_role;

-- Features terrain : lecture publique non sensible.
GRANT SELECT ON public.trail_segment_features TO anon, authenticated;
GRANT ALL ON public.trail_segment_features TO service_role;

-- Données privées niveau 2 : propriétaire en lecture.
GRANT SELECT ON public.session_segment_passages TO authenticated;
GRANT ALL ON public.session_segment_passages TO service_role;

GRANT SELECT ON public.performance_observations TO authenticated;
GRANT ALL ON public.performance_observations TO service_role;

GRANT SELECT ON public.user_performance_profiles TO authenticated;
GRANT ALL ON public.user_performance_profiles TO service_role;

GRANT SELECT ON public.user_performance_profile_versions TO authenticated;
GRANT ALL ON public.user_performance_profile_versions TO service_role;

-- Intelligence collective : lecture filtrée par seuil (policy RLS).
GRANT SELECT ON public.segment_condition_buckets TO anon, authenticated;
GRANT ALL ON public.segment_condition_buckets TO service_role;

GRANT SELECT ON public.segment_collective_aggregates TO anon, authenticated;
GRANT ALL ON public.segment_collective_aggregates TO service_role;

-- Terrain Live : contribution propriétaire, lecture via vue publique.
GRANT SELECT, INSERT, UPDATE ON public.terrain_reports TO authenticated;
GRANT ALL ON public.terrain_reports TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.terrain_report_confirmations TO authenticated;
GRANT ALL ON public.terrain_report_confirmations TO service_role;

GRANT SELECT ON public.terrain_events TO anon, authenticated;
GRANT ALL ON public.terrain_events TO service_role;

-- AdventurePlan : accès propriétaire + collaborateurs (policy RLS).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventure_plans TO authenticated;
GRANT ALL ON public.adventure_plans TO service_role;

GRANT SELECT ON public.adventure_plan_versions TO authenticated;
GRANT ALL ON public.adventure_plan_versions TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.adventure_plan_decisions TO authenticated;
GRANT ALL ON public.adventure_plan_decisions TO service_role;

GRANT SELECT ON public.adventure_engine_runs TO authenticated;
GRANT ALL ON public.adventure_engine_runs TO service_role;

-- Prédictions personnelles : propriétaire en lecture.
GRANT SELECT ON public.segment_predictions TO authenticated;
GRANT ALL ON public.segment_predictions TO service_role;

GRANT SELECT ON public.route_predictions TO authenticated;
GRANT ALL ON public.route_predictions TO service_role;

-- Événements de domaine : l'acteur peut lire/émettre, le claim est service-only.
GRANT SELECT, INSERT ON public.adventure_domain_events TO authenticated;
GRANT ALL ON public.adventure_domain_events TO service_role;
