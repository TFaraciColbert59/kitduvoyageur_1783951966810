-- ============================================================================
-- A11 — Conservation : correction à la source des matviews (Lot 4).
--
-- Constat (Étape 0-B / pgTAP conservation, quarantaine) :
--   1. `kit_trust_scores` produisait PLUSIEURS lignes par kit : le LATERAL
--      endurance (`es`) était corrélé par `ON true` sans `WHERE s.kit_id = k.id`,
--      donc chaque kit était multiplié par le nombre de kits ayant des sessions
--      (produit cartésien). Conséquence : `CREATE UNIQUE INDEX
--      kit_trust_scores_kit_id_key` impossible → REFRESH non concurrent en échec.
--   2. La sémantique endurance était fausse pour tous les kits (sessions/km/
--      saisons du mauvais kit recopiés).
--
-- Correctif structurel (idempotent, additif post-baseline) :
--   • DROP/CREATE des 3 matviews avec agrégation explicite `GROUP BY k.id`
--     et laterals réellement corrélés (`WHERE s.kit_id = k.id`) : une ligne
--     par kit est garantie par construction, plus aucun produit cartésien.
--   • Paires de conservation dédupliquées (DISTINCT parent/item_key/child,
--     EXISTS côté enfant) : total_pairs = nb de forks externes × items du parent,
--     sans inflation si un kit contient plusieurs fois le même item_key.
--   • Index uniques recréés (requis par REFRESH CONCURRENTLY) + grants.
--
-- Sémantique retenue (conforme à la suite) :
--   • forks externes = `child.user_id IS DISTINCT FROM parent.user_id`
--     (auto-forks exclus) ;
--   • `kept` = l'enfant possède AU MOINS un item de même item_key ;
--   • propagation = descendants réels (`ancestors @> ARRAY[k.id]`), auto-forks
--     exclus, un user_id compté une fois, seuls les forks avec session comptés,
--     décroissance 1/pow(age_h + 2, 1.5) ;
--   • endurance = sessions/verdicts du kit lui-même uniquement ;
--   • plancher de crédibilité = `sessions_count >= 5`.
--
-- NE REMPLACE PAS `refresh_kit_conservation()` (migration 20260911390000) :
-- avec des matviews désormais sans doublon, le refresh et la (re)création
-- best-effort de l'index unique réussissent sans warning.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Conservation par item (global, découverte)
-- ----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.kit_item_survival;
CREATE MATERIALIZED VIEW public.kit_item_survival AS
SELECT
  pairs.item_key,
  min(pairs.product_id::text)::uuid                AS product_id,
  count(*) FILTER (WHERE pairs.kept)               AS kept_count,
  count(*) FILTER (WHERE NOT pairs.kept)           AS dropped_count,
  count(*)                                         AS total_pairs
FROM (
  SELECT
    edges.parent_id,
    edges.child_id,
    pi.item_key,
    pi.product_id,
    EXISTS (
      SELECT 1
      FROM public.materiel_kit_items ci
      WHERE ci.kit_id = edges.child_id
        AND ci.item_key = pi.item_key
    ) AS kept
  FROM (
    -- Paires (parent, enfant) en VRAIE filiation : auto-forks exclus.
    SELECT
      parent.id      AS parent_id,
      child.id       AS child_id
    FROM public.materiel_kits parent
    JOIN public.materiel_kits child ON child.forked_from = parent.id
    WHERE child.user_id IS DISTINCT FROM parent.user_id
  ) edges
  JOIN (
    -- Un item = un item_key par kit (pas de doublon de paire).
    SELECT DISTINCT kit_id, item_key, product_id
    FROM public.materiel_kit_items
  ) pi ON pi.kit_id = edges.parent_id
) pairs
GROUP BY pairs.item_key;

CREATE UNIQUE INDEX IF NOT EXISTS kit_item_survival_item_key_key
  ON public.kit_item_survival (item_key);

-- ----------------------------------------------------------------------------
-- 2) Conservation par kit (KitSheet) — mêmes paires, groupées par parent
-- ----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.kit_item_survival_by_kit;
CREATE MATERIALIZED VIEW public.kit_item_survival_by_kit AS
SELECT
  pairs.parent_id                                  AS kit_id,
  pairs.item_key,
  min(pairs.product_id::text)::uuid                AS product_id,
  count(*) FILTER (WHERE pairs.kept)               AS kept_count,
  count(*) FILTER (WHERE NOT pairs.kept)           AS dropped_count,
  count(*)                                         AS total_pairs
FROM (
  SELECT
    edges.parent_id,
    edges.child_id,
    pi.item_key,
    pi.product_id,
    EXISTS (
      SELECT 1
      FROM public.materiel_kit_items ci
      WHERE ci.kit_id = edges.child_id
        AND ci.item_key = pi.item_key
    ) AS kept
  FROM (
    SELECT
      parent.id      AS parent_id,
      child.id       AS child_id
    FROM public.materiel_kits parent
    JOIN public.materiel_kits child ON child.forked_from = parent.id
    WHERE child.user_id IS DISTINCT FROM parent.user_id
  ) edges
  JOIN (
    SELECT DISTINCT kit_id, item_key, product_id
    FROM public.materiel_kit_items
  ) pi ON pi.kit_id = edges.parent_id
) pairs
GROUP BY pairs.parent_id, pairs.item_key;

CREATE UNIQUE INDEX IF NOT EXISTS kit_item_survival_by_kit_key
  ON public.kit_item_survival_by_kit (kit_id, item_key);

-- ----------------------------------------------------------------------------
-- 3) Scores de confiance par kit — deux axes DISTINCTS, UNE ligne par kit.
--    Les deux laterals sont corrélés au kit courant (`WHERE ... = k.id`) puis
--    agrégés explicitement par `k.id` : plus aucun produit cartésien.
-- ----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.kit_trust_scores;
CREATE MATERIALIZED VIEW public.kit_trust_scores AS
SELECT
  k.id                                                AS kit_id,
  k.lineage_root_id,
  k.origin,
  -- ── Axe PROPAGATION (descendants réels de CE kit, auto-forks exclus) ──
  max(ls.fork_users_unique)                           AS fork_users_unique,
  max(ls.lineage_depth)                               AS lineage_depth,
  max(ls.propagation_score)                           AS propagation_score,
  -- ── Axe ENDURANCE (sessions de CE kit uniquement) ──────────────────
  max(es.sessions_count)                              AS sessions_count,
  max(es.total_km)                                    AS total_km,
  max(es.season_count)                                AS season_count,
  max(es.region_count)                                AS region_count,
  max(es.essential_count)                             AS essential_count,
  max(es.never_used_count)                            AS never_used_count,
  max(es.essential_ratio)                             AS essential_ratio,
  max(es.endurance_score)                             AS endurance_score,
  -- ── Plancher de crédibilité ────────────────────────────────────────
  bool_or(COALESCE(es.sessions_count, 0) >= 5)        AS has_min_sessions
FROM public.materiel_kits k
LEFT JOIN LATERAL (
  -- Descendants réels de k : d.ancestors @> ARRAY[k.id] (GIN efficace).
  -- Un même user_id n'est compté qu'une fois ; seuls les descendants ayant
  -- AU MOINS une session terrain comptent ; décroissance 1/pow(age_h+2, 1.5).
  SELECT
    count(DISTINCT d.user_id)                         AS fork_users_unique,
    COALESCE(max(d.generation) - k.generation, 0)::integer AS lineage_depth,
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
  -- Corrélé au kit courant : sans ce WHERE, chaque groupe renvoyé par le
  -- LATERAL était joint à tous les kits (cause des doublons kit_id).
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
  WHERE s.kit_id = k.id
) es ON true
GROUP BY k.id, k.lineage_root_id, k.origin;

CREATE UNIQUE INDEX IF NOT EXISTS kit_trust_scores_kit_id_key
  ON public.kit_trust_scores (kit_id);

-- ----------------------------------------------------------------------------
-- 4) Grants : lecture agrégats publics (découverte, KitSheet)
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.kit_item_survival        TO anon, authenticated, service_role;
GRANT SELECT ON public.kit_item_survival_by_kit TO anon, authenticated, service_role;
GRANT SELECT ON public.kit_trust_scores         TO anon, authenticated, service_role;
