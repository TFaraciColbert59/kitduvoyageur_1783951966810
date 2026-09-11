-- ==============================================================================
-- A9 — Hardening (Phase 9)
-- M12 : flags de domaine — tout est désactivé par défaut (ADR-AI-008).
-- Seed idempotent uniquement ; la table feature_flags est créée en
-- 20260909140000_hub_feature_flags.sql. Aucune policy modifiée.
--
--   Fonctionnalités (rollout progressif) :
--     performance_profile_v2, route_prediction_v2,
--     collective_intelligence, terrain_live
--   Shadow (comparaison silencieuse sans effet utilisateur) :
--     performance_profile_v2_shadow, route_prediction_v2_shadow,
--     collective_intelligence_shadow, terrain_auto_detection_shadow
-- ==============================================================================

INSERT INTO public.feature_flags (id, enabled) VALUES
  ('performance_profile_v2', false),
  ('route_prediction_v2', false),
  ('collective_intelligence', false),
  ('terrain_live', false),
  ('performance_profile_v2_shadow', false),
  ('route_prediction_v2_shadow', false),
  ('collective_intelligence_shadow', false),
  ('terrain_auto_detection_shadow', false)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.feature_flags IS
  'Flags produit. Domaine Adventure Intelligence : rollout progressif + shadow mode '
  '(A9). Tous désactivés par défaut ; activation manuelle contrôlée.';
