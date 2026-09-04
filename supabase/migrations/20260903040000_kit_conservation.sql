-- ============================================================================
-- 20260903040000_kit_conservation.sql
-- Chantier « Lignées de kits » — Lot 4 : le moteur de jugement.
--   • kit_item_survival (par item_key, global) — conservation à travers les
--     générations (auto-forks exclus) ; alimente la découverte « ce qui revient
--     du terrain ».
--   • kit_item_survival_by_kit (par parent) — conservation des items d'UN kit ;
--     alimente le KitSheet (Lot 5).
--   • kit_trust_scores (par kit) — deux axes DISTINCTS (propagation, endurance),
--     jamais fondus en une note unique ; garde-fous : indépendance au prix,
--     plancher de crédibilité (has_min_sessions), anti-fraude (auto-forks
--     exclus, un user_id compté une seule fois par lignée, forks sans session
--     terrain non comptés).
--   • refresh_kit_conservation() — REFRESH CONCURRENTLY (nécessite les index
--     uniques) ; exposée à service_role ; appelée par la route cron protégée.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Conservation par item (global, découverte)
-- ----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.kit_item_survival;
CREATE MATERIALIZED VIEW public.kit_item_survival AS
SELECT
  pairs.item_key,
  min(pairs.product_id::text)::uuid                AS product_id,
  count(*) FILTER (WHERE pairs.kept)             AS kept_count,
  count(*) FILTER (WHERE NOT pairs.kept)         AS dropped_count,
  count(*)                                       AS total_pairs
FROM (
  SELECT
    pi.item_key,
    pi.product_id,
    (ci.kit_id IS NOT NULL) AS kept
  FROM (
    -- Paires (parent, enfant) en VRAIE filiation : auto-forks exclus
    -- (enfant.user_id <> parent.user_id).
    SELECT
      parent.id      AS parent_id,
      child.id       AS child_id
    FROM public.materiel_kits parent
    JOIN public.materiel_kits child ON child.forked_from = parent.id
    WHERE child.user_id IS DISTINCT FROM parent.user_id
  ) edges
  JOIN public.materiel_kit_items pi ON pi.kit_id = edges.parent_id
  LEFT JOIN public.materiel_kit_items ci
    ON ci.kit_id = edges.child_id AND ci.item_key = pi.item_key
) pairs
GROUP BY pairs.item_key;

CREATE UNIQUE INDEX IF NOT EXISTS kit_item_survival_item_key_key
  ON public.kit_item_survival (item_key);

-- ----------------------------------------------------------------------------
-- 2) Conservation par kit (KitSheet) — mêmes paires, mais groupées par parent
-- ----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.kit_item_survival_by_kit;
CREATE MATERIALIZED VIEW public.kit_item_survival_by_kit AS
SELECT
  pairs.parent_id                                AS kit_id,
  pairs.item_key,
  min(pairs.product_id::text)::uuid                AS product_id,
  count(*) FILTER (WHERE pairs.kept)             AS kept_count,
  count(*) FILTER (WHERE NOT pairs.kept)         AS dropped_count,
  count(*)                                       AS total_pairs
FROM (
  SELECT
    edges.parent_id,
    pi.item_key,
    pi.product_id,
    (ci.kit_id IS NOT NULL) AS kept
  FROM (
    SELECT
      parent.id      AS parent_id,
      child.id       AS child_id
    FROM public.materiel_kits parent
    JOIN public.materiel_kits child ON child.forked_from = parent.id
    WHERE child.user_id IS DISTINCT FROM parent.user_id
  ) edges
  JOIN public.materiel_kit_items pi ON pi.kit_id = edges.parent_id
  LEFT JOIN public.materiel_kit_items ci
    ON ci.kit_id = edges.child_id AND ci.item_key = pi.item_key
) pairs
GROUP BY pairs.parent_id, pairs.item_key;

CREATE UNIQUE INDEX IF NOT EXISTS kit_item_survival_by_kit_key
  ON public.kit_item_survival_by_kit (kit_id, item_key);

-- ----------------------------------------------------------------------------
-- 3) Scores de confiance par kit — deux axes distincts (jamais une note unique)
--    Garde-fous :
--      • aucun terme monétaire (indépendance au prix) ;
--      • auto-forks exclus ; un même user_id compté une seule fois par lignée ;
--      • forks SANS session terrain dans la descendance non comptés ;
--      • plancher de crédibilité exposé via has_min_sessions (>= 5).
-- ----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.kit_trust_scores;
CREATE MATERIALIZED VIEW public.kit_trust_scores AS
SELECT
  k.id                                                AS kit_id,
  k.lineage_root_id,
  k.origin,
  -- ── Axe PROPAGATION (descendants réels de CE kit, auto-forks exclus) ──
  COALESCE(ls.fork_users_unique, 0)                   AS fork_users_unique,
  COALESCE(ls.lineage_depth, 0)                       AS lineage_depth,
  COALESCE(ls.propagation_score, 0)                   AS propagation_score,
  -- ── Axe ENDURANCE ──────────────────────────────────────────────────
  COALESCE(es.sessions_count, 0)                      AS sessions_count,
  COALESCE(es.total_km, 0)                            AS total_km,
  COALESCE(es.season_count, 0)                        AS season_count,
  COALESCE(es.region_count, 0)                        AS region_count,
  COALESCE(es.essential_count, 0)                     AS essential_count,
  COALESCE(es.never_used_count, 0)                    AS never_used_count,
  COALESCE(es.essential_ratio, 0)                     AS essential_ratio,
  COALESCE(es.endurance_score, 0)                     AS endurance_score,
  -- ── Plancher de crédibilité ────────────────────────────────────────
  (COALESCE(es.sessions_count, 0) >= 5)               AS has_min_sessions
FROM public.materiel_kits k
LEFT JOIN LATERAL (
  -- Descendants réels de k : d.ancestors @> ARRAY[k.id] (GIN efficace).
  -- Un même user_id n'est compté qu'une fois ; seuls les descendants ayant
  -- AU MOINS une session terrain comptent ; décroissance 1/pow(age_h+2, 1.5).
  SELECT
    count(DISTINCT d.user_id)                         AS fork_users_unique,
    COALESCE(max(d.generation) - k.generation, 0)     AS lineage_depth,
    COALESCE((
      SELECT sum(t.max_decay) FROM (
        SELECT
          d2.user_id,
          max(1.0 / pow(
            EXTRACT(EPOCH FROM (now() - d2.created_at)) / 3600.0 + 2.0,
            1.5
          )) AS max_decay
        FROM public.materiel_kits d2
        JOIN public.hike_sessions s2 ON s2.kit_id = d2.id
        WHERE d2.ancestors @> ARRAY[k.id]
          AND d2.id <> k.id
          AND d2.user_id IS DISTINCT FROM k.user_id
        GROUP BY d2.user_id
      ) t
    ), 0)                                             AS propagation_score
  FROM public.materiel_kits d
  WHERE d.ancestors @> ARRAY[k.id]
    AND d.id <> k.id
    AND d.user_id IS DISTINCT FROM k.user_id
    AND EXISTS (SELECT 1 FROM public.hike_sessions s WHERE s.kit_id = d.id)
) ls ON true
LEFT JOIN LATERAL (
  -- Endurance : sessions, saisons, massifs (régions), verdicts de débriefing.
  SELECT
    count(DISTINCT s.id)                              AS sessions_count,
    COALESCE(sum(s.distance_km), 0)                   AS total_km,
    count(DISTINCT CASE EXTRACT(MONTH FROM s.started_at)
      WHEN 12 THEN 'hiver' WHEN 1 THEN 'hiver' WHEN 2 THEN 'hiver'
      WHEN 3 THEN 'printemps' WHEN 4 THEN 'printemps' WHEN 5 THEN 'printemps'
      WHEN 6 THEN 'ete' WHEN 7 THEN 'ete' WHEN 8 THEN 'ete'
      ELSE 'automne' END)                            AS season_count,
    count(DISTINCT r.region)                         AS region_count,
    count(*) FILTER (WHERE fr.verdict = 'essentiel') AS essential_count,
    count(*) FILTER (WHERE fr.verdict = 'jamais_servi') AS never_used_count,
    CASE
      WHEN count(*) FILTER (WHERE fr.verdict = 'jamais_servi') > 0
        THEN round((count(*) FILTER (WHERE fr.verdict = 'essentiel'))::numeric
                   / count(*) FILTER (WHERE fr.verdict = 'jamais_servi'), 2)
      ELSE 0
    END                                              AS essential_ratio,
    round(
      sqrt(count(DISTINCT s.id)::numeric)
      * (1.0 + 0.25 * count(DISTINCT CASE EXTRACT(MONTH FROM s.started_at)
            WHEN 12 THEN 'hiver' WHEN 1 THEN 'hiver' WHEN 2 THEN 'hiver'
            WHEN 3 THEN 'printemps' WHEN 4 THEN 'printemps' WHEN 5 THEN 'printemps'
            WHEN 6 THEN 'ete' WHEN 7 THEN 'ete' WHEN 8 THEN 'ete'
            ELSE 'automne' END))
      * (1.0 + 0.25 * count(DISTINCT r.region)),
      3
    )                                                AS endurance_score
  FROM public.hike_sessions s
  LEFT JOIN public.hiking_routes r ON r.id = s.route_id
  LEFT JOIN public.kit_field_reports fr
    ON fr.kit_id = s.kit_id AND fr.hike_session_id = s.id
  GROUP BY s.kit_id
) es ON true;

CREATE UNIQUE INDEX IF NOT EXISTS kit_trust_scores_kit_id_key
  ON public.kit_trust_scores (kit_id);

-- ----------------------------------------------------------------------------
-- 4) Grants : lecture agrégats publics (découverte, KitSheet), CONCURRENTLY
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.kit_item_survival        TO anon, authenticated;
GRANT SELECT ON public.kit_item_survival_by_kit TO authenticated;
GRANT SELECT ON public.kit_trust_scores         TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5) Refresh CONCURRENTLY — service_role uniquement (route cron protégée)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_kit_conservation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.kit_item_survival;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.kit_item_survival_by_kit;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.kit_trust_scores;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_kit_conservation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_kit_conservation() TO service_role;