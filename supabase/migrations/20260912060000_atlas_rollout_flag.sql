-- CHANTIER ATLAS — Phase 7 — Rollout mondial progressif.
--
-- Étend le système de flags EXISTANT (table feature_flags + cohortes) plutôt que
-- d'inventer un mécanisme parallèle. Le moteur unifié de /explorer passe derrière
-- `explorer_unified_map_enabled` : off = moteur legacy (rollback instantané).
--
-- Paliers prévus (opérés par mise à jour de la cohorte, sans redéploiement) :
--   interne (allowlist) → 5 % → 25 % → 100 % (flag global enabled=true).
-- État initial volontairement sûr : flag global false, cohorte 0 %.
--
-- `current_feature_flags()` est rendu lisible par les visiteurs anonymes : le
-- SSR de /explorer doit connaître le flag sans session (données non sensibles).

INSERT INTO public.feature_flags (id, enabled, scope)
VALUES ('explorer_unified_map_enabled', false, 'global')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.feature_flag_cohorts (flag_id, percentage)
VALUES ('explorer_unified_map_enabled', 0)
ON CONFLICT (flag_id) DO NOTHING;

GRANT EXECUTE ON FUNCTION public.current_feature_flags() TO anon;
