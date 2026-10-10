-- ============================================================================
-- Materialisation prod des correctifs F-012 + durcissement F-006 (phase 1bis).
--
-- Le ledger prod est version-only : toute correction SEMANTIQUE d'une migration
-- deja enregistree doit vivre dans une NOUVELLE migration, jamais dans l'edition
-- de l'historique. Cette migration est idempotente, additive, sans destruction.
-- ============================================================================

-- 1. set_route_cache : l'original inserait p_provider (text) dans la colonne
--    payload (jsonb) — echec de creation sur toute base. Version corrigee.
DO $$
BEGIN
  IF to_regclass('public.route_cache') IS NOT NULL THEN
    EXECUTE $fn$CREATE OR REPLACE FUNCTION public.set_route_cache(
      p_cache_key text,
      p_route_mode text,
      p_payload jsonb,
      p_provider text,
      p_ttl_seconds integer
    )
    RETURNS void
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $body$
      INSERT INTO public.route_cache
        (cache_key, route_mode, provider, payload, hit_count, created_at, expires_at)
      VALUES (
        p_cache_key, p_route_mode, p_provider, p_payload, 0, now(),
        now() + make_interval(secs => greatest(p_ttl_seconds, 60))
      )
      ON CONFLICT (cache_key) DO UPDATE SET
        route_mode = excluded.route_mode,
        provider   = excluded.provider,
        payload    = excluded.payload,
        created_at = now(),
        expires_at = now() + make_interval(secs => greatest(p_ttl_seconds, 60));
    $body$ $fn$;
    EXECUTE 'REVOKE ALL ON FUNCTION public.set_route_cache(text, text, jsonb, text, integer) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.set_route_cache(text, text, jsonb, text, integer) TO service_role';
  END IF;
END $$;

-- 2. event_expenses : retrait de la policy ALL permissive historique
--    (auth_manage_expenses), requise par le controle final de 20260911570000.
DO $$
BEGIN
  IF to_regclass('public.event_expenses') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS auth_manage_expenses ON public.event_expenses';
  END IF;
END $$;

-- 3. badge_progress_result : type composite legacy absent du depot (present en
--    prod, cf. baseline). Recreation a l'identique si absent.
DO $$
BEGIN
  IF to_regtype('public.badge_progress_result') IS NULL THEN
    EXECUTE $t$CREATE TYPE public.badge_progress_result AS (
      id uuid, name text, slug text, description text, icon text, category text,
      rarity text, points_reward integer, requirement_type text, requirement_value integer,
      current_value integer, percentage integer, is_unlocked boolean,
      earned_at timestamp with time zone
    )$t$;
  END IF;
END $$;

-- 4. group-media : politiques durcies — segment 1 valide en UUID (pas de 500
--    de cast sur un chemin inattendu) et appartenance GROUPE OU CLUB (les
--    uploads clubs utilisent clubs.id, non couvert par is_group_member).
DO $$
DECLARE
  uuid_re text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  member_expr text := 'public.is_group_member((storage.foldername(name))[1]::uuid, auth.uid())';
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;
  IF to_regprocedure('public.is_club_member(uuid,uuid)') IS NOT NULL THEN
    member_expr := member_expr || ' OR public.is_club_member((storage.foldername(name))[1]::uuid, auth.uid())';
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS group_media_select_member ON storage.objects';
  EXECUTE format(
    'CREATE POLICY group_media_select_member ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''group-media'' AND array_length(storage.foldername(name), 1) >= 1 AND (storage.foldername(name))[1] ~ %L AND (%s))',
    uuid_re,
    member_expr
  );

  EXECUTE 'DROP POLICY IF EXISTS group_media_insert_member ON storage.objects';
  EXECUTE format(
    'CREATE POLICY group_media_insert_member ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''group-media'' AND array_length(storage.foldername(name), 1) >= 1 AND (storage.foldername(name))[1] ~ %L AND (%s))',
    uuid_re,
    member_expr
  );

  EXECUTE 'DROP POLICY IF EXISTS group_media_delete_owner ON storage.objects';
  EXECUTE 'CREATE POLICY group_media_delete_owner ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''group-media'' AND owner = auth.uid())';
END $$;
