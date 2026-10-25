-- ============================================================================
-- T15 — Unifier les distinctions (définitions de badges dédupliquées).
--
-- Constat prod (2026-10-11) : 32 badges, 10 badges possédés (user_badges).
-- La plupart des noms existent en double : une ligne historique (slug vide,
-- 0 point) et une ligne « canonique » (slug `badge_<uuid>`) ; « Premier Pas »
-- existe en trois exemplaires. AUCUNE suppression : la déduplication est une
-- LIAISON (clé canonique = nom normalisé) et les possessions historiques sont
-- conservées telles quelles.
--
-- Doctrine 2.0 : un badge ne produit AUCUN crédit automatique. Les promesses
-- `points_reward` (12 lignes > 0) sont remises à zéro — ce ne sont pas des
-- droits acquis (user_badges ne porte aucun montant) et aucun code ne les
-- attribue en points.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.progression_badge_links (
  badge_id uuid PRIMARY KEY REFERENCES public.badges(id),
  canonical_key text NOT NULL,
  condition_version integer NOT NULL DEFAULT 1 CHECK (condition_version >= 1),
  provenance text NOT NULL DEFAULT 'canonical_v2' CHECK (provenance IN ('canonical_v2', 'legacy_kept')),
  linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS progression_badge_links_key_idx
  ON public.progression_badge_links (canonical_key);

ALTER TABLE public.progression_badge_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_badge_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.progression_badge_links TO service_role;

-- Clé canonique = nom normalisé (minuscules, non-alphanumériques → '-').
-- La ligne « canonique » est celle qui porte un slug ; les variantes sans slug
-- restent liées et possédées mais ne sont plus publiées séparément.
INSERT INTO public.progression_badge_links (badge_id, canonical_key, provenance)
SELECT b.id,
       regexp_replace(lower(b.name), '[^a-z0-9]+', '-', 'g'),
       CASE WHEN b.slug IS NOT NULL AND length(b.slug) > 0 THEN 'canonical_v2' ELSE 'legacy_kept' END
FROM public.badges b
ON CONFLICT (badge_id) DO UPDATE
  SET canonical_key = EXCLUDED.canonical_key,
      provenance = EXCLUDED.provenance,
      linked_at = now();

-- Aucune promesse de points pour un badge (doctrine : distinction, 0 crédit).
UPDATE public.badges SET points_reward = 0 WHERE points_reward <> 0;
