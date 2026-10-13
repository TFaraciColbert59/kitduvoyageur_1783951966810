-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-067 + A-216 — quotas quotidiens anti-abus (base)
-- Chantier communauté (audit 2026-10-12) — P1 abus et fanout
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une identité ne peut pas produire un volume illimité de contenus, de
-- contacts ou de signalements en 24 h. Les plafonds sont volontairement
-- généreux (usage normal jamais bloqué) et refusés côté base — un client
-- modifié ne les contourne pas :
--   publications 30/j · discussions de club 20/j · commentaires 200/j
--   stories 20/j · likes 500/j · signalements 50/j · invitations 50/j.
-- Le message privé n'est PAS plafonné (volume légitime élevé).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_daily_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := TG_ARGV[0]::integer;
  v_column text := TG_ARGV[1];
  v_actor uuid;
  v_count integer;
BEGIN
  EXECUTE format('SELECT ($1).%I', v_column) INTO v_actor USING NEW;
  IF v_actor IS NULL OR v_actor <> auth.uid() THEN
    RETURN NEW; -- lignes écrites par le service/backend : hors quota client
  END IF;

  EXECUTE format(
    'SELECT count(*) FROM public.%I WHERE %I = $1 AND created_at >= now() - interval ''1 day''',
    TG_TABLE_NAME, v_column
  ) INTO v_count USING v_actor;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite quotidienne atteinte (% par jour) — réessayez demain.', v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_daily_quota() IS
  'A-067/A-216 : plafond quotidien par identité (TG_ARGV = limite, colonne d''auteur).';

-- Un trigger par surface, avec son plafond et sa colonne d'auteur.
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('community_posts', 'author_id', 30),
      ('club_topics', 'author_id', 20),
      ('post_comments', 'author_id', 200),
      ('post_stories', 'author_id', 20),
      ('post_likes', 'user_id', 500),
      ('comment_reports', 'reporter_id', 50),
      ('story_reports', 'reporter_id', 50),
      ('trip_invitations', 'invited_by', 50)
    ) AS t(table_name, author_column, daily_limit)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_daily_quota ON public.%I', target.table_name);
    EXECUTE format(
      'CREATE TRIGGER enforce_daily_quota BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_quota(%L, %L)',
      target.table_name, target.daily_limit::text, target.author_column
    );
  END LOOP;
END $$;
