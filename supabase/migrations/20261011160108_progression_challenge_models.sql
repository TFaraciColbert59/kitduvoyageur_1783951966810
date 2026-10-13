-- ============================================================================
-- T12 (données) — Liaison défi historique → modèle versionné de mission.
--
-- Constat d'application (2026-10-11) : `progression_challenges` contient
-- exactement 8 lignes (chal_exp_01…chal_entr_02) ; les « 26 anciens défis »
-- du dossier de conception n'existent plus dans cette table. AUCUNE
-- suppression n'est faite ici — les associations historiques
-- (`user_progression.current_challenge_id`) restent intactes.
--
-- La liaison ne publie QUE les défis dont le producteur est disponible
-- (modèles de `src/features/progression/domain/missionCatalog.ts`). Les défis
-- sans producteur restent conservés mais explicitement NON publiés, avec la
-- raison exacte (aucune promesse de gain).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.progression_challenge_models (
  challenge_id text PRIMARY KEY REFERENCES public.progression_challenges(id),
  model_id text,
  provenance text NOT NULL DEFAULT 'canonical_v2' CHECK (provenance IN ('canonical_v2', 'legacy_kept')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  reason text,
  linked_at timestamptz NOT NULL DEFAULT now(),
  CHECK (model_id IS NOT NULL OR reason IS NOT NULL)
);

ALTER TABLE public.progression_challenge_models ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_challenge_models FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.progression_challenge_models TO service_role;

-- Publier uniquement ce qui est prouvable ; le reste est conservé, non publié.
-- La jointure sur `progression_challenges` évite toute erreur de clé étrangère
-- si une base locale ne porte pas encore les défis : aucune ligne inventée.
INSERT INTO public.progression_challenge_models (challenge_id, model_id, provenance, version, reason)
SELECT v.challenge_id, v.model_id, v.provenance, v.version, v.reason
FROM (VALUES
  ('chal_exp_01',  'mission_discovery_first_activity', 'canonical_v2', 1, NULL::text),
  ('chal_prep_02', 'mission_prep_departure_checks',    'canonical_v2', 1, NULL::text),
  ('chal_prep_01', 'mission_prep_kit_debrief',         'canonical_v2', 1, NULL::text),
  ('chal_part_01', 'mission_community_carnet',         'canonical_v2', 1, NULL::text),
  ('chal_part_02', 'mission_community_review',         'canonical_v2', 1, NULL::text),
  ('chal_exp_02',  NULL::text, 'legacy_kept', 1, 'Produit « sommets » ambigu, non rattachable à un producteur vérifié en l''état.'),
  ('chal_entr_01', NULL::text, 'legacy_kept', 1, 'T25 — réponse acceptée non implémentée ; défi conservé, non publié.'),
  ('chal_entr_02', NULL::text, 'legacy_kept', 1, 'T32 — prêt réel non implémenté ; défi conservé, non publié.')
) AS v(challenge_id, model_id, provenance, version, reason)
JOIN public.progression_challenges c ON c.id = v.challenge_id
ON CONFLICT (challenge_id) DO UPDATE
  SET model_id = EXCLUDED.model_id,
      provenance = EXCLUDED.provenance,
      version = EXCLUDED.version,
      reason = EXCLUDED.reason,
      linked_at = now();
