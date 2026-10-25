-- ============================================================================
-- P3 — Classements territoriaux (spec §4)
--
-- Agrégats par scope, file de rafraîchissement idempotente (dédup par
-- utilisateur+saison), pagination keyset, filtre 1 km sous flag et
-- anti-triangulation. Aucune coordonnée, distance, UUID ou nom réel dans les
-- payloads : les lignes ne portent qu'un alias stable (pseudonyme dérivé).
--
-- Le flag `local_leaderboard_active` est seedé OFF dans la table réelle
-- `public.feature_flags` (migrations 20260909140000 et 20260911200000 ;
-- consommée par src/features/adventure-intelligence/server/featureFlags.ts).
-- ============================================================================

-- 1) Agrégats de classement — lecture/écriture serveur uniquement.
CREATE TABLE IF NOT EXISTS public.progression_leaderboard_agg (
  season_id     TEXT NOT NULL,
  scope_type    TEXT NOT NULL CHECK (scope_type IN ('city','region','country','world','local')),
  scope_id      TEXT NOT NULL DEFAULT '',
  user_id       UUID NOT NULL,
  alias         TEXT,
  level         INTEGER,
  level_title   TEXT,
  season_points INTEGER,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, scope_type, scope_id, user_id)
);

CREATE INDEX IF NOT EXISTS progression_leaderboard_agg_rank_idx
  ON public.progression_leaderboard_agg (season_id, scope_type, scope_id, season_points DESC, user_id ASC);

ALTER TABLE public.progression_leaderboard_agg ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_leaderboard_agg FROM PUBLIC;
REVOKE ALL ON TABLE public.progression_leaderboard_agg FROM anon, authenticated;
GRANT ALL ON TABLE public.progression_leaderboard_agg TO service_role;

COMMENT ON TABLE public.progression_leaderboard_agg IS
  'P3 — agrégats de classement par saison/scope. Jamais exposés aux clients : '
  'seuls les RPC service_role renvoient alias, niveau, points et rang.';

-- 2) File de rafraîchissement dédupliquée : UNIQUE (user_id, season_id).
CREATE TABLE IF NOT EXISTS public.leaderboard_refresh_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  season_id    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','processed','failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT leaderboard_refresh_queue_user_season_key UNIQUE (user_id, season_id)
);

CREATE INDEX IF NOT EXISTS leaderboard_refresh_queue_status_idx
  ON public.leaderboard_refresh_queue (status, created_at);

ALTER TABLE public.leaderboard_refresh_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.leaderboard_refresh_queue FROM PUBLIC;
REVOKE ALL ON TABLE public.leaderboard_refresh_queue FROM anon, authenticated;
GRANT ALL ON TABLE public.leaderboard_refresh_queue TO service_role;

-- 3) Journal d'accès au classement 1 km (anti-triangulation) et journal des
--    changements de rattachement privé (corrections plafonnées).
CREATE TABLE IF NOT EXISTS public.leaderboard_access_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leaderboard_access_log_user_idx
  ON public.leaderboard_access_log (user_id, created_at DESC);

ALTER TABLE public.leaderboard_access_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.leaderboard_access_log FROM PUBLIC;
REVOKE ALL ON TABLE public.leaderboard_access_log FROM anon, authenticated;
GRANT ALL ON TABLE public.leaderboard_access_log TO service_role;

CREATE TABLE IF NOT EXISTS public.territory_change_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL,
  old_lat    DOUBLE PRECISION,
  old_lng    DOUBLE PRECISION,
  new_lat    DOUBLE PRECISION,
  new_lng    DOUBLE PRECISION,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS territory_change_log_user_idx
  ON public.territory_change_log (user_id, created_at DESC);

ALTER TABLE public.territory_change_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.territory_change_log FROM PUBLIC;
REVOKE ALL ON TABLE public.territory_change_log FROM anon, authenticated;
GRANT ALL ON TABLE public.territory_change_log TO service_role;

-- Index géographique d'aide au ST_DWithin (1000 m) sur les points consentis.
CREATE INDEX IF NOT EXISTS user_territory_private_geog_idx
  ON public.user_territory_private
  USING gist ((ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography));

-- 4) Flag 1 km — OFF par défaut, table réelle `feature_flags`.
INSERT INTO public.feature_flags (id, enabled) VALUES ('local_leaderboard_active', false)
ON CONFLICT (id) DO UPDATE SET enabled = false;

-- 5) Enfilement dédupliqué sur chaque évolution de saison de l'utilisateur.
--    Un changement arrivé pendant qu'un lot traite la ligne la repasse en
--    `pending` : la marque `processed` conditionnelle du lot ne l'écrasera pas.
CREATE OR REPLACE FUNCTION public.enqueue_leaderboard_refresh()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leaderboard_refresh_queue (user_id, season_id)
  VALUES (NEW.user_id, NEW.season_id)
  ON CONFLICT (user_id, season_id) DO UPDATE
    SET status = 'pending',
        attempts = 0,
        created_at = now(),
        processed_at = NULL
  WHERE public.leaderboard_refresh_queue.status <> 'pending';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_leaderboard_refresh() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_leaderboard_refresh() FROM anon, authenticated;

DROP TRIGGER IF EXISTS on_user_season_progress_leaderboard_refresh ON public.user_season_progress;
CREATE TRIGGER on_user_season_progress_leaderboard_refresh
  AFTER INSERT OR UPDATE ON public.user_season_progress
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_leaderboard_refresh();

-- 6) Recalcul des agrégats d'un utilisateur dans TOUS les scopes pertinents.
--    `local` n'est JAMAIS écrit ici : il est calculé à la demande.
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
  v_alias TEXT;
  v_country TEXT;
  v_region TEXT;
  v_city TEXT;
BEGIN
  IF p_user_id IS NULL OR p_season_id IS NULL THEN
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
  v_alias := 'Voyageur ' || substr(md5(p_user_id::text), 1, 6);

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
    (p_season_id, 'world', '', p_user_id, v_alias, v_level, v_title, v_points, now());

  IF v_country IS NOT NULL AND v_country <> '' THEN
    INSERT INTO public.progression_leaderboard_agg
      (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
    VALUES
      (p_season_id, 'country', v_country, p_user_id, v_alias, v_level, v_title, v_points, now());
  END IF;

  IF v_region IS NOT NULL AND v_region <> '' THEN
    INSERT INTO public.progression_leaderboard_agg
      (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
    VALUES
      (p_season_id, 'region', v_region, p_user_id, v_alias, v_level, v_title, v_points, now());
  END IF;

  IF v_city IS NOT NULL AND v_city <> '' THEN
    INSERT INTO public.progression_leaderboard_agg
      (season_id, scope_type, scope_id, user_id, alias, level, level_title, season_points, updated_at)
    VALUES
      (p_season_id, 'city', v_city, p_user_id, v_alias, v_level, v_title, v_points, now());
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_leaderboard_for_user(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_leaderboard_for_user(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard_for_user(uuid, text) TO service_role;

-- 7) Consommation de la file par lot concurrent (SKIP LOCKED).
CREATE OR REPLACE FUNCTION public.refresh_leaderboard_batch(p_limit INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_processed INTEGER := 0;
  v_failed INTEGER := 0;
  v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 100), 1000));
BEGIN
  FOR v_row IN
    SELECT id, user_id, season_id, attempts
    FROM public.leaderboard_refresh_queue
    WHERE status IN ('pending', 'failed')
    ORDER BY created_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      UPDATE public.leaderboard_refresh_queue
      SET status = 'processing', attempts = v_row.attempts + 1
      WHERE id = v_row.id;

      PERFORM public.refresh_leaderboard_for_user(v_row.user_id, v_row.season_id);

      -- Ne marque traité que si le trigger n'a pas remis la ligne en attente
      -- entre-temps (une donnée plus récente reste à recalculer).
      UPDATE public.leaderboard_refresh_queue
      SET status = 'processed', processed_at = now()
      WHERE id = v_row.id AND status = 'processing';

      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.leaderboard_refresh_queue
      SET status = 'failed', processed_at = now()
      WHERE id = v_row.id AND status = 'processing';
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('processed', v_processed, 'failed', v_failed);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_leaderboard_batch(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_leaderboard_batch(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard_batch(integer) TO service_role;

-- 8) Lecture du classement par filtre. Le score (season_points) ne dépend
--    jamais du filtre : seuls le groupe comparé et le rang changent.
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_user_id UUID,
  p_filter TEXT,
  p_limit INTEGER DEFAULT 50,
  p_cursor_points INTEGER DEFAULT NULL,
  p_cursor_user UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season TEXT;
  v_min INTEGER := 5;
  v_limit INTEGER;
  v_country TEXT;
  v_region TEXT;
  v_city TEXT;
  v_scope_id TEXT;
  v_total INTEGER := 0;
  v_rank INTEGER;
  v_refreshed TIMESTAMPTZ;
  v_rows JSONB := '[]'::jsonb;
  v_local_enabled BOOLEAN := false;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_access_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'user_required');
  END IF;
  IF p_filter IS NULL OR p_filter NOT IN ('world', 'country', 'region', 'city', 'local') THEN
    RETURN jsonb_build_object('error', 'invalid_filter');
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));

  SELECT id INTO v_season
  FROM public.progression_seasons
  WHERE status = 'active'
  ORDER BY starts_at DESC
  LIMIT 1;

  SELECT COALESCE((payload->>'min_participants')::int, 5) INTO v_min
  FROM public.progression_rules
  WHERE active = true
  LIMIT 1;
  IF v_min IS NULL OR v_min < 1 THEN
    v_min := 5;
  END IF;

  -- ── Filtre local 1 km : flag OFF par défaut, calcul serveur seul. ─────────
  IF p_filter = 'local' THEN
    SELECT COALESCE(enabled, false) INTO v_local_enabled
    FROM public.feature_flags
    WHERE id = 'local_leaderboard_active';
    v_local_enabled := COALESCE(v_local_enabled, false);

    IF NOT v_local_enabled THEN
      RETURN jsonb_build_object(
        'rows', '[]'::jsonb,
        'total_participants', 0,
        'community_forming', true,
        'min_participants', v_min,
        'refreshed_at', NULL,
        'rank', NULL,
        'local_unavailable', true,
        'reason', 'flag_off'
      );
    END IF;

    SELECT count(*) INTO v_access_count
    FROM public.leaderboard_access_log
    WHERE user_id = p_user_id AND created_at > now() - interval '1 hour';

    IF v_access_count >= 30 THEN
      RETURN jsonb_build_object('error', 'rate_limited');
    END IF;

    SELECT lat, lng INTO v_lat, v_lng
    FROM public.user_territory_private
    WHERE user_id = p_user_id;

    IF v_lat IS NULL OR v_lng IS NULL THEN
      RETURN jsonb_build_object(
        'rows', '[]'::jsonb,
        'total_participants', 0,
        'community_forming', true,
        'min_participants', v_min,
        'refreshed_at', NULL,
        'rank', NULL,
        'local_unavailable', true,
        'reason', 'no_private_attachment'
      );
    END IF;

    IF v_season IS NULL THEN
      RETURN jsonb_build_object(
        'rows', '[]'::jsonb,
        'total_participants', 0,
        'community_forming', true,
        'min_participants', v_min,
        'refreshed_at', NULL,
        'rank', NULL,
        'season_unavailable', true
      );
    END IF;

    INSERT INTO public.leaderboard_access_log (user_id) VALUES (p_user_id);

    WITH candidates AS (
      SELECT
        p.user_id,
        'Voyageur ' || substr(md5(p.user_id::text), 1, 6) AS alias,
        COALESCE(up.level, 1) AS level,
        COALESCE(up.level_title, '') AS level_title,
        GREATEST(0, usp.season_points) AS season_points,
        usp.updated_at AS refreshed_at
      FROM public.user_territory_private p
      JOIN public.user_season_progress usp
        ON usp.user_id = p.user_id AND usp.season_id = v_season
      LEFT JOIN public.user_progression up ON up.user_id = p.user_id
      WHERE p.consent_at IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography,
          1000
        )
    ),
    ranked AS (
      SELECT c.*, rank() OVER (ORDER BY c.season_points DESC, c.user_id ASC) AS rank
      FROM candidates c
    ),
    page AS (
      SELECT r.*
      FROM ranked r
      WHERE p_cursor_points IS NULL
         OR p_cursor_user IS NULL
         OR r.season_points < p_cursor_points
         OR (r.season_points = p_cursor_points AND r.user_id > p_cursor_user)
      ORDER BY r.season_points DESC, r.user_id ASC
      LIMIT v_limit
    )
    SELECT
      COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
              'alias', page.alias,
              'level', page.level,
              'level_title', NULLIF(page.level_title, ''),
              'season_points', page.season_points,
              'rank', page.rank,
              'is_current_user', page.user_id = p_user_id
            ) ORDER BY page.season_points DESC, page.user_id ASC
          )
         FROM page),
        '[]'::jsonb
      ),
      (SELECT count(*)::int FROM ranked),
      (SELECT rank::int FROM ranked WHERE user_id = p_user_id),
      (SELECT max(refreshed_at) FROM ranked)
    INTO v_rows, v_total, v_rank, v_refreshed;

    RETURN jsonb_build_object(
      'rows', v_rows,
      'total_participants', COALESCE(v_total, 0),
      'community_forming', COALESCE(v_total, 0) < v_min,
      'min_participants', v_min,
      'refreshed_at', v_refreshed,
      'rank', v_rank
    );
  END IF;

  -- ── Scopes administratifs : ville, région, pays, monde. ───────────────────
  SELECT ut.country_code, ut.region_code, ut.city_code
    INTO v_country, v_region, v_city
  FROM public.user_territory ut
  WHERE ut.user_id = p_user_id;

  v_scope_id := CASE p_filter
    WHEN 'world'   THEN ''
    WHEN 'country' THEN COALESCE(v_country, '')
    WHEN 'region'  THEN COALESCE(v_region, '')
    WHEN 'city'    THEN COALESCE(v_city, '')
  END;

  IF v_season IS NULL THEN
    RETURN jsonb_build_object(
      'rows', '[]'::jsonb,
      'total_participants', 0,
      'community_forming', true,
      'min_participants', v_min,
      'refreshed_at', NULL,
      'rank', NULL,
      'season_unavailable', true
    );
  END IF;

  IF p_filter <> 'world' AND (v_scope_id IS NULL OR v_scope_id = '') THEN
    RETURN jsonb_build_object(
      'rows', '[]'::jsonb,
      'total_participants', 0,
      'community_forming', true,
      'min_participants', v_min,
      'refreshed_at', NULL,
      'rank', NULL,
      'territory_missing', true
    );
  END IF;

  WITH ranked AS (
    SELECT
      a.user_id,
      a.alias,
      a.level,
      a.level_title,
      a.season_points,
      a.updated_at,
      rank() OVER (ORDER BY a.season_points DESC, a.user_id ASC) AS rank
    FROM public.progression_leaderboard_agg a
    WHERE a.season_id = v_season
      AND a.scope_type = p_filter
      AND a.scope_id = v_scope_id
  ),
  page AS (
    SELECT r.*
    FROM ranked r
    WHERE p_cursor_points IS NULL
       OR p_cursor_user IS NULL
       OR r.season_points < p_cursor_points
       OR (r.season_points = p_cursor_points AND r.user_id > p_cursor_user)
    ORDER BY r.season_points DESC, r.user_id ASC
    LIMIT v_limit
  )
  SELECT
    COALESCE(
      (SELECT jsonb_agg(
          jsonb_build_object(
            'alias', page.alias,
            'level', page.level,
            'level_title', page.level_title,
            'season_points', page.season_points,
            'rank', page.rank,
            'is_current_user', page.user_id = p_user_id
          ) ORDER BY page.season_points DESC, page.user_id ASC
        )
       FROM page),
      '[]'::jsonb
    ),
    (SELECT count(*)::int FROM ranked),
    (SELECT rank::int FROM ranked WHERE user_id = p_user_id),
    (SELECT max(updated_at) FROM ranked)
  INTO v_rows, v_total, v_rank, v_refreshed;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total_participants', COALESCE(v_total, 0),
    'community_forming', COALESCE(v_total, 0) < v_min,
    'min_participants', v_min,
    'refreshed_at', v_refreshed,
    'rank', v_rank
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(uuid, text, integer, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_leaderboard(uuid, text, integer, integer, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(uuid, text, integer, integer, uuid) TO service_role;

COMMENT ON FUNCTION public.get_leaderboard(uuid, text, integer, integer, uuid) IS
  'P3 — classement keyset par filtre. Retourne alias, niveau, points de saison, '
  'rang et is_current_user ; jamais d''UUID, de coordonnée ni de distance.';
