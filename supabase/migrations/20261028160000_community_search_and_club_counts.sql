-- Explorer la communauté : recherche rapide et compteur de membres fiable.
--
-- 1. Index trigramme (pg_trgm) sur les colonnes interrogées par `ilike '%texte%'`
--    du drawer Explorer. Sans eux, chaque frappe balaie les quatre tables.
-- 2. `clubs.members_count` recalculé par déclencheur sur `club_members`.
--    Avant : le client faisait `UPDATE clubs SET members_count = n ± 1`, mais la
--    politique RLS ne laisse modifier un club qu'à son créateur : pour tout
--    autre membre la mise à jour échoue en silence et le compteur reste faux
--    (et un client pouvait écrire un nombre arbitraire). Le recalcul (`count(*)`
--    des membres actifs) est idempotent : il reste juste même si un ancien
--    client écrit encore.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_community_posts_content_trgm ON public.community_posts USING gin (content extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_carnets_title_trgm ON public.carnets USING gin (title extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clubs_name_trgm ON public.clubs USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON public.events USING gin (title extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.sync_club_members_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club uuid;
BEGIN
  FOR v_club IN
    SELECT DISTINCT c
    FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.club_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.club_id END
    ]) AS c
    WHERE c IS NOT NULL
  LOOP
    UPDATE public.clubs
    SET members_count = (
      SELECT count(*) FROM public.club_members WHERE club_id = v_club AND status = 'active'
    )
    WHERE id = v_club;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_club_members_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_club_members_count ON public.club_members;
CREATE TRIGGER trg_sync_club_members_count
  AFTER INSERT OR DELETE OR UPDATE OF status, club_id ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_club_members_count();
