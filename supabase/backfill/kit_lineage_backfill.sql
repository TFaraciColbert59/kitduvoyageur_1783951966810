-- ============================================================================
-- kit_lineage_backfill.sql — Backfill NON DESTRUCTIF de la filiation (Lot 1.3)
--
-- ⚠️ EXÉCUTION OBLIGATOIRE D'ABORD SUR UNE COPIE / BRANCHE SUPABASE.
--    Ne jamais lancer directement sur production sans validation (GATE 1).
--
-- Idempotent : chaque passe ne touche que les lignes encore non traitées.
-- Une seule transaction (BEGIN/COMMIT) — toute erreur annule tout.
--
-- Ordre :
--   1. Raciner tous les kits existants (lineage_root_id = id, génération 0).
--   2. Reconstitution BEST-EFFORT des forks passés depuis
--      materiel_kit_history (action='forked', payload->>'source_kit_id'),
--      passe par passe (racine → feuilles, le trigger dérive à chaque UPDATE).
--   3. origin='configurateur' pour les kits déjà référencés par kit_reports.
--   4. Appariement product_id sur les articles (shop_products) : uniquement si
--      le nom est EXACT et UNIQUE — on ne devine jamais.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Raciner les kits sans filiation connue
-- ----------------------------------------------------------------------------
UPDATE public.materiel_kits
SET lineage_root_id = id,
    generation      = 0,
    ancestors       = '{}'::uuid[]
WHERE lineage_root_id IS NULL
   OR generation IS NULL;

DO $$
DECLARE
  v_total bigint;
BEGIN
  SELECT count(*) INTO v_total FROM public.materiel_kits;
  RAISE NOTICE '[backfill.1] kits au total : % (racinés : % non traités)', v_total,
    (SELECT count(*) FROM public.materiel_kits WHERE lineage_root_id IS NULL OR generation IS NULL);
END $$;

-- ----------------------------------------------------------------------------
-- 2) Reconstitution des forks depuis l'historique (best-effort, anti-cycle,
--    profondeur max 60 passes pour laisser le trigger dériver proprement)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_sources bigint := 0;
  v_updated bigint := -1;
  v_pass    int     := 0;
BEGIN
  -- Kit parents candidats (avec leur identifiant) issus de l'historique
  CREATE TEMP TABLE tmp_lineage_forks ON COMMIT DROP AS
  SELECT DISTINCT
         h.kit_id                                                          AS child_id,
         (h.payload->>'source_kit_id')::uuid                               AS parent_id
  FROM public.materiel_kit_history h
  WHERE h.action = 'forked'
    AND h.payload ? 'source_kit_id'
    AND (h.payload->>'source_kit_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND h.kit_id <> (h.payload->>'source_kit_id')::uuid; -- jamais soi-même

  SELECT count(*) INTO v_sources FROM tmp_lineage_forks;
  RAISE NOTICE '[backfill.2] paires de fork candidates : %', v_sources;

  -- Passe par passe : l'UPDATE of forked_from déclenche handle_kit_lineage ;
  -- on ne traite qu'un kit dont le parent est déjà résolu (ancestors non vides
  -- ou déjà racine). La boucle converge en <= profondeur max + 1 passes.
  WHILE v_updated <> 0 AND v_pass < 61 LOOP
    v_pass := v_pass + 1;

    WITH to_update AS (
      SELECT f.child_id, f.parent_id, k.lineage_root_id, k.generation, k.ancestors
      FROM tmp_lineage_forks f
      JOIN public.materiel_kits k ON k.id = f.parent_id
      WHERE f.child_id IN (SELECT id FROM public.materiel_kits WHERE forked_from IS NULL)
        AND (k.ancestors IS NOT NULL OR k.id = k.lineage_root_id)
    ),
    applied AS (
      UPDATE public.materiel_kits m
      SET forked_from = t.parent_id,
          origin      = 'fork'
      FROM to_update t
      WHERE m.id = t.child_id
      RETURNING m.id
    )
    SELECT count(*) INTO v_updated FROM applied;

    IF v_pass = 1 OR v_updated > 0 THEN
      RAISE NOTICE '[backfill.2] passe % : % kit(s) rattaché(s)', v_pass, v_updated;
    END IF;
  END LOOP;

  -- Kits forké dont le parent n'existe plus (supprimé) : on ne devine pas,
  -- origin reste 'manuel', pas de filiation. Comptés pour le rapport.
  RAISE NOTICE '[backfill.2] forks non rattachés (parent disparu) : %',
    (SELECT count(*) FROM tmp_lineage_forks f
     LEFT JOIN public.materiel_kits k ON k.id = f.parent_id
     WHERE k.id IS NULL);
END $$;

-- ----------------------------------------------------------------------------
-- 3) Origin configurateur pour les kits adoptés depuis le configurateur
-- ----------------------------------------------------------------------------
UPDATE public.materiel_kits m
SET origin = 'configurateur'
WHERE origin = 'manuel'
  AND EXISTS (
    SELECT 1 FROM public.kit_reports r WHERE r.kit_id = m.id
  );

DO $$
BEGIN
  RAISE NOTICE '[backfill.3] kits marqués "configurateur" : %',
    (SELECT count(*) FROM public.materiel_kits WHERE origin = 'configurateur');
END $$;

-- ----------------------------------------------------------------------------
-- 4) Appariement product_id (shop_products) — exact ET unique uniquement
-- ----------------------------------------------------------------------------
WITH uniq AS (
  SELECT id, lower(trim(name)) AS key
  FROM public.shop_products
  WHERE name IS NOT NULL
    AND (is_active IS NULL OR is_active = true)
    AND available = true
    AND deleted_at IS NULL
),
counted AS (
  SELECT key FROM uniq GROUP BY key HAVING count(*) = 1
)
UPDATE public.materiel_kit_items m
SET product_id = u.id
FROM uniq u
JOIN counted c ON c.key = u.key
WHERE m.product_id IS NULL
  AND lower(trim(m.name)) = u.key;

DO $$
DECLARE
  v_matched  bigint;
  v_unmatched bigint;
BEGIN
  SELECT count(*) INTO v_matched
  FROM public.materiel_kit_items WHERE product_id IS NOT NULL;
  SELECT count(*) INTO v_unmatched
  FROM public.materiel_kit_items WHERE product_id IS NULL;
  RAISE NOTICE '[backfill.4] items appariés au catalogue : % (non appariés : %)',
    v_matched, v_unmatched;
  RAISE NOTICE '[backfill] TERMINÉ — vérifier les NOTICE avant COMMIT/ROLLBACK';
END $$;

-- À exécuter avec un wrapper : COMMIT après inspection du rapport.
-- (le COMMIT est mis en commentaire pour forcer la revue explicite)
-- COMMIT;
ROLLBACK;