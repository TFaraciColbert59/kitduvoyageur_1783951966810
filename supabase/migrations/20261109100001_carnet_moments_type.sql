-- Carnet v2 : type canonique et données structurées d'un moment.
--
-- Pourquoi : la fiche v2 distingue neuf types de moment (photo, vidéo, note
-- vocale, texte, rencontre, dépense, objet du kit, espèce, incident). Jusqu'ici
-- la base ne portait que `citation` + `image_url` : le type ne pouvait ni être
-- écrit par la feuille « Créer » ni être relu. Les moments existants gardent
-- `moment_type` NULL : la fiche en déduit le type (image -> photo, légende seule
-- -> texte), elle n'invente rien.
--
-- Additive, sans réécriture de table : deux colonnes nullables. Aucune policy
-- touchée (les droits d'écriture restent ceux de carnet_moments_participant_manage).
-- Rollback : supabase/migrations_down/20261109100001_carnet_moments_type.down.sql

alter table public.carnet_moments
  add column if not exists moment_type text,
  add column if not exists moment_meta jsonb;

alter table public.carnet_moments
  drop constraint if exists carnet_moments_moment_type_check;
alter table public.carnet_moments
  add constraint carnet_moments_moment_type_check
  check (
    moment_type is null
    or moment_type in ('photo','video','voice','text','meet','spend','kit','species','inc')
  );

-- Le JSON structuré reste petit et typé objet (montant, citation, objet…).
alter table public.carnet_moments
  drop constraint if exists carnet_moments_moment_meta_check;
alter table public.carnet_moments
  add constraint carnet_moments_moment_meta_check
  check (
    moment_meta is null
    or (jsonb_typeof(moment_meta) = 'object' and pg_column_size(moment_meta) <= 2048)
  );

comment on column public.carnet_moments.moment_type is
  'Type canonique du moment (fiche carnet v2) ; NULL = déduit à la lecture.';
comment on column public.carnet_moments.moment_meta is
  'Données structurées du type : amountEur, category, who, itemId, latin, durationLabel.';
