-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Communauté v2 — lot F : stories (rognage vidéo, lien carnet, alt)
-- Phase 1 (ajouts purs : colonnes nullables + index).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat prod (2026-11-08) : `post_stories` ne porte ni les bornes de rognage
-- (le trim de l'éditeur est décoratif), ni le lien vers un carnet, ni le texte
-- alternatif. Le visualiseur lira `trim_start_ms`/`trim_end_ms` pour la lecture
-- vidéo et n'affichera le lien carnet qu'aux lecteurs qui peuvent voir ce
-- carnet (la visibilité de `carnets` reste celle de la RLS existante).
--
-- Aucune modification des policies Storage ni de `can_view_story`.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.post_stories
  add column if not exists trim_start_ms integer
    check (trim_start_ms is null or trim_start_ms >= 0),
  add column if not exists trim_end_ms integer
    check (trim_end_ms is null or trim_end_ms > coalesce(trim_start_ms, 0)),
  add column if not exists linked_carnet_id uuid
    references public.carnets(id) on delete set null,
  add column if not exists linked_carnet_day integer
    check (linked_carnet_day is null or linked_carnet_day between 1 and 60),
  add column if not exists alt_text text
    check (alt_text is null or char_length(alt_text) <= 200);

create index if not exists idx_post_stories_linked_carnet
  on public.post_stories (linked_carnet_id);

comment on column public.post_stories.trim_start_ms is
  'Communauté v2 — début de la portion vidéo conservée (ms), lu par le visualiseur de stories.';
comment on column public.post_stories.trim_end_ms is
  'Communauté v2 — fin de la portion vidéo conservée (ms), strictement supérieure à trim_start_ms.';
comment on column public.post_stories.linked_carnet_id is
  'Communauté v2 — carnet associé à la story ; le lien n''est affiché qu''aux lecteurs ayant accès au carnet (RLS carnets + can_view_story).';
comment on column public.post_stories.linked_carnet_day is
  'Communauté v2 — jour du carnet visé par la story (1 à 60).';
comment on column public.post_stories.alt_text is
  'Communauté v2 — texte alternatif du média de story (≤ 200).';
