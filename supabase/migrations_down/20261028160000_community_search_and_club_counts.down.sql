-- Retour arrière : retire le déclencheur du compteur et les index de recherche (l'extension pg_trgm reste installée).
DROP TRIGGER IF EXISTS trg_sync_club_members_count ON public.club_members;
DROP FUNCTION IF EXISTS public.sync_club_members_count();
DROP INDEX IF EXISTS public.idx_events_title_trgm;
DROP INDEX IF EXISTS public.idx_clubs_name_trgm;
DROP INDEX IF EXISTS public.idx_carnets_title_trgm;
DROP INDEX IF EXISTS public.idx_community_posts_content_trgm;
