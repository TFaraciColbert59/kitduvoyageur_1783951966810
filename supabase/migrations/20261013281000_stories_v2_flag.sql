-- Stories V2 — rollout contrôlé : flag global désactivé par défaut.
-- Cohortes disponibles via le système existant (current_feature_flags_for).
INSERT INTO public.feature_flags (id, enabled) VALUES ('stories_v2', false)
ON CONFLICT (id) DO NOTHING;
