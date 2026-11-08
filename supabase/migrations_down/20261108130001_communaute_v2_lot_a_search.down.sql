-- Rollback du lot A Communauté v2 (20261108130001) :
-- recherche tolérante, normalisation et index trigram.
-- Ordre : fonctions d'abord, index avant la fonction qu'ils référencent.
-- Aucune donnée utilisateur n'est supprimée (pas de colonne dans ce lot).

drop function if exists public.community_search(text, text, integer, integer, double precision, double precision, jsonb);
drop function if exists public.community_search_trending(integer);
drop function if exists public.lkdv_geo_info(text, uuid, double precision, double precision);
drop function if exists public.lkdv_has_column(text, text);

drop index if exists public.idx_carnets_title_norm_trgm;
drop index if exists public.idx_carnets_destination_norm_trgm;
drop index if exists public.idx_clubs_name_norm_trgm;
drop index if exists public.idx_events_title_norm_trgm;
drop index if exists public.idx_events_location_norm_trgm;
drop index if exists public.idx_community_posts_content_norm_trgm;
drop index if exists public.idx_user_profiles_full_name_norm_trgm;
drop index if exists public.idx_user_profiles_handle_norm_trgm;

-- L'extension pg_trgm reste installée (elle peut servir à d'autres objets).
drop function if exists public.lkdv_norm(text);
