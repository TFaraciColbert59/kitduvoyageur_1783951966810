-- Rollback de 20261109100001_carnet_moments_type : retire le type canonique et
-- les données structurées des moments. Les moments restent lisibles (type déduit
-- à la lecture) ; seules les valeurs de ces deux colonnes sont perdues.
alter table public.carnet_moments drop constraint if exists carnet_moments_moment_meta_check;
alter table public.carnet_moments drop constraint if exists carnet_moments_moment_type_check;
alter table public.carnet_moments drop column if exists moment_meta;
alter table public.carnet_moments drop column if exists moment_type;
