-- Rollback de 20261105010000_lkdv_one_studio
drop function if exists public.one_place_preorder(jsonb, text, boolean);
drop table if exists public.one_preorders;
drop table if exists public.one_bag_configs;
drop table if exists public.one_owned_pieces;
drop table if exists public.one_pieces;
drop table if exists public.one_colorways;
