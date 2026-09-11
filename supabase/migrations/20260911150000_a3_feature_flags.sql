-- ==============================================================================
-- A3 — Feature flags Phase 3 : Profil Terrain et prédictions personnelles
-- Insertion idempotente uniquement ; les deux flags restent désactivés par
-- défaut (ADR-AI-008, fallback sûr). Aucun autre changement.
-- ==============================================================================

INSERT INTO public.feature_flags(id, enabled) VALUES
  ('performance_profile_v2', false),
  ('route_prediction_v2', false)
ON CONFLICT (id) DO NOTHING;
