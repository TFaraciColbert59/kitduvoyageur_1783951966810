-- Métadonnées de création indépendantes du snapshot carnet.
-- Le trigger snapshot_community_post_carnet ne touche pas cette colonne.
alter table if exists public.community_posts
  add column if not exists creation_meta jsonb;

comment on column public.community_posts.creation_meta is
  'Options de création (commentaires, likes, planification, sondage, sortie) — additives, hors snapshot carnet.';
