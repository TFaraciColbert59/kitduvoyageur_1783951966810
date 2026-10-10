-- ============================================================================
-- PHASE 1 — Incrément 2 : isolement des données de démonstration + rejeu
-- canonique du compte démo (spec I2).
--   a. flag `user_profiles.is_demo` + backfill (compte pinné / emails seedés,
--      jamais un admin) ;
--   b. exclusion des classements : garde `is_demo` dans
--      `refresh_leaderboard_for_user` + purge des artefacts existants ;
--   c. rejeu canonique du compte démo : si déjà canonique (15 événements
--      adossés aux tx seed + lifetime = Σ), rejeu ignoré ; sinon snapshot des
--      projections, remise à zéro, outbox seed rejouée via
--      `process_progression_outbox`, contrôle interne bloquant. Réapplication
--      sûre (une 2e passe ne détruit pas les projections canoniques).
-- Idempotente, additive, transactionnelle (rejeu dans un DO unique).
-- 20261010140000 / 20261010150000 (appliquées en prod) ne sont pas modifiées.
-- Down : migrations_down/20261010160000_phase1_demo_isolation.down.sql
-- ============================================================================

-- 1. FLAG DÉMO ----------------------------------------------------------------
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

UPDATE public.user_profiles
SET is_demo = true
WHERE NOT is_demo
  AND role <> 'admin'
  AND (
    id = 'd5451f35-db9f-4575-9114-6d3b79550bbc'
    OR email = ANY (ARRAY[
      -- 21 comptes @email.fr (source 20261009120000_invalidate_seed_credentials)
      'alice.perrin@email.fr',
      'antoine.moreau@email.fr',
      'camille.leroy@email.fr',
      'clara.fontaine@email.fr',
      'emma.fontaine@email.fr',
      'emma.henry@email.fr',
      'felix.dumont@email.fr',
      'hugo.renard@email.fr',
      'ines.chevalier@email.fr',
      'julie.simon@email.fr',
      'lea.roux@email.fr',
      'lucas.petit@email.fr',
      'manon.girard@email.fr',
      'marie.dupont@email.fr',
      'maxime.garcia@email.fr',
      'nicolas.blanc@email.fr',
      'pierre.lambert@email.fr',
      'romain.leblanc@email.fr',
      'sophie.bernard@email.fr',
      'theo.marceau@email.fr',
      'thomas.martin@email.fr',
      -- 10 variantes @kitduvoyageur.fr (mêmes personnes, seed 20260713170000)
      'antoine.moreau@kitduvoyageur.fr',
      'camille.leroy@kitduvoyageur.fr',
      'julie.simon@kitduvoyageur.fr',
      'lea.rousseau@kitduvoyageur.fr',
      'lucas.petit@kitduvoyageur.fr',
      'marie.dupont@kitduvoyageur.fr',
      'maxime.garcia@kitduvoyageur.fr',
      'pierre.lambert@kitduvoyageur.fr',
      'sophie.bernard@kitduvoyageur.fr',
      'thomas.martin@kitduvoyageur.fr'
    ]::text[])
  );

-- 2. EXCLUSION DES CLASSEMENTS ------------------------------------------------
-- Corps actuel de 20260920110000_hardening.sql (266-351) + garde is_demo.
CREATE OR REPLACE FUNCTION public.refresh_leaderboard_for_user(
  p_user_id UUID,
  p_season_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_level INTEGER;
  v_title TEXT;
  v_country TEXT;
  v_region TEXT;
  v_city TEXT;
BEGIN
  IF p_user_id IS NULL OR p_season_id IS NULL THEN
    RETURN;
  END IF;

  -- Données de démonstration : jamais classées (aucune ligne, tous périmètres).
  IF EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = p_user_id AND p.is_demo) THEN
    DELETE FROM public.progression_leaderboard_agg WHERE user_id = p_user_id;
    RETURN;
  END IF;

  SELECT GREATEST(0, season_points) INTO v_points
  FROM public.user_season_progress
  WHERE user_id = p_user_id AND season_id = p_season_id;

  IF NOT FOUND THEN
    DELETE FROM public.progression_leaderboard_agg
    WHERE user_id = p_user_id AND season_id = p_season_id;
    RETURN;
  END IF;

  v_points := COALESCE(v_points, 0);

  SELECT up.level, up.level_title INTO v_level, v_title
  FROM public.user_progression up
  WHERE up.user_id = p_user_id;

  IF v_level IS NULL THEN
    SELECT lv.level, lv.level_title INTO v_level, v_title
    FROM public.progression_level_for(0) lv;
  END IF;

  SELECT ut.country_code, ut.region_code, ut.city_code
    INTO v_country, v_region, v_city
  FROM public.user_territory ut
  WHERE ut.user_id = p_user_id;

  DELETE FROM public.progression_leaderboard_agg
  WHERE user_id = p_user_id
    AND season_id = p_season_id
    AND scope_type IN ('world', 'country', 'region', 'city');

  INSERT INTO public.progression_leaderboard_agg
    (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
  VALUES
    (p_season_id, 'world', '', p_user_id,
     public.leaderboard_alias(p_user_id, 'world', '', p_season_id), v_level, v_title, v_points, now());

  IF v_country IS NOT NULL AND v_country <> '' THEN
    INSERT INTO public.progression_leaderboard_agg
      (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
    VALUES
      (p_season_id, 'country', v_country, p_user_id,
       public.leaderboard_alias(p_user_id, 'country', v_country, p_season_id), v_level, v_title, v_points, now());
  END IF;

  IF v_region IS NOT NULL AND v_region <> '' THEN
    INSERT INTO public.progression_leaderboard_agg
      (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
    VALUES
      (p_season_id, 'region', v_region, p_user_id,
       public.leaderboard_alias(p_user_id, 'region', v_region, p_season_id), v_level, v_title, v_points, now());
  END IF;

  IF v_city IS NOT NULL AND v_city <> '' THEN
    INSERT INTO public.progression_leaderboard_agg
      (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
    VALUES
      (p_season_id, 'city', v_city, p_user_id,
       public.leaderboard_alias(p_user_id, 'city', v_city, p_season_id), v_level, v_title, v_points, now());
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_leaderboard_for_user(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard_for_user(uuid, text) TO service_role;

-- Purge des artefacts de classement des comptes démo (prod : écrits par le seed).
DELETE FROM public.progression_leaderboard_agg
WHERE user_id IN (SELECT id FROM public.user_profiles WHERE is_demo);

-- 3. REJEU CANONIQUE DU COMPTE DÉMO -------------------------------------------
-- Idempotent : si le démo est déjà canonique (15 événements adossés aux tx seed
-- et lifetime = Σ), le rejeu est ignoré ; sinon snapshot → purge des
-- projections → outbox seed `pending` → `process_progression_outbox` → contrôle
-- bloquant. Atomicité : tout le rejeu + le contrôle dans un DO unique (une
-- migration CLI est transactionnelle par fichier ; en application psql -f le DO
-- l'est aussi).
DO $$
DECLARE
  v_demo uuid := 'd5451f35-db9f-4575-9114-6d3b79550bbc';
  v_events integer;
  v_lifetime integer;
  v_sum integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_demo) THEN
    RAISE NOTICE 'phase1_demo_isolation: compte démo absent — rejeu canonique ignoré';
    RETURN;
  END IF;

  -- 3.1 État canonique courant : événements adossés aux tx seed + projection.
  SELECT COALESCE(SUM(t.points), 0) INTO v_sum
  FROM public.reward_transactions t
  WHERE t.user_id = v_demo
    AND t.counts_for_progression
    AND t.metadata->>'seeded_by' = 'seed_ultra_demo';

  SELECT count(*) INTO v_events
  FROM public.progression_events e
  WHERE e.user_id = v_demo
    AND e.reward_transaction_id IN (
      SELECT t.id FROM public.reward_transactions t
      WHERE t.user_id = v_demo
        AND t.counts_for_progression
        AND t.metadata->>'seeded_by' = 'seed_ultra_demo'
    );

  SELECT COALESCE((SELECT up.lifetime_points FROM public.user_progression up WHERE up.user_id = v_demo), -1)
    INTO v_lifetime;

  IF v_events = 15 AND v_lifetime = v_sum THEN
    -- Déjà canonique : rejeu ignoré. Indispensable à l'idempotence : une
    -- réapplication qui supprimerait les projections ne pourrait pas les
    -- reconstruire, car `process_progression_outbox` saute (CONTINUE) les
    -- lignes déjà adossées à un événement. Outbox seed laissée telle quelle.
    RAISE NOTICE 'phase1_demo_isolation: démo déjà canonique — rejeu ignoré (% événements, % points)', v_events, v_lifetime;
  ELSE
    -- 3.2 Snapshot des projections actuelles (idempotent : user + reason).
    INSERT INTO public.progression_legacy_snapshot (user_id, snapshot, mapping_version, reason)
    SELECT v_demo,
           jsonb_build_object(
             'user_progression',
             (SELECT to_jsonb(up) FROM public.user_progression up WHERE up.user_id = v_demo),
             'user_season_progress',
             (SELECT to_jsonb(usp) FROM public.user_season_progress usp WHERE usp.user_id = v_demo)
           ),
           'demo-canonical-incr2',
           'demo_canonical_rebuild_incr2'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.progression_legacy_snapshot s
      WHERE s.user_id = v_demo AND s.reason = 'demo_canonical_rebuild_incr2'
    );

    -- 3.3-3.4 Projections du démo remises à zéro puis outbox seed `pending`.
    DELETE FROM public.user_season_progress WHERE user_id = v_demo;
    DELETE FROM public.user_progression WHERE user_id = v_demo;

    UPDATE public.progression_outbox
    SET status = 'pending',
        attempts = 0,
        available_at = now(),
        processed_at = NULL,
        last_error = NULL,
        locked_at = NULL
    WHERE reward_transaction_id IN (
      SELECT t.id FROM public.reward_transactions t
      WHERE t.user_id = v_demo
        AND t.counts_for_progression
        AND t.metadata->>'seeded_by' = 'seed_ultra_demo'
    );

    -- 3.5 Rejeu canonique.
    PERFORM public.process_progression_outbox(200);

    -- 3.6 Contrôle interne bloquant (re-vérification après rejeu) : la
    -- migration échoue plutôt que de laisser une projection non canonique.
    SELECT count(*) INTO v_events
    FROM public.progression_events e
    WHERE e.user_id = v_demo
      AND e.reward_transaction_id IN (
        SELECT t.id FROM public.reward_transactions t
        WHERE t.user_id = v_demo
          AND t.counts_for_progression
          AND t.metadata->>'seeded_by' = 'seed_ultra_demo'
      );

    SELECT COALESCE((SELECT up.lifetime_points FROM public.user_progression up WHERE up.user_id = v_demo), -1)
      INTO v_lifetime;

    IF v_events <> 15 THEN
      RAISE EXCEPTION 'phase1_demo_isolation: % événement(s) de progression pour le démo (attendu : 15)', v_events;
    END IF;
    IF v_lifetime IS DISTINCT FROM v_sum THEN
      RAISE EXCEPTION 'phase1_demo_isolation: lifetime_points démo % ≠ Σ tx seed %', v_lifetime, v_sum;
    END IF;
  END IF;
END $$;
