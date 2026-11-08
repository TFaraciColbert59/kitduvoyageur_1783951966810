-- Rollback du lot B Communauté v2 (20261108130002) :
-- feeds paginés, agenda, colonnes géographiques.
-- Règle 06 § 3.5 : refus si une colonne supprimée contient des données
-- (après le premier usage réel, on ne supprime rien : on restaure seulement).
-- Les colonnes géographiques sont nullables et n'ont aucune valeur par défaut :
-- leur simple existence ne suffit pas, c'est la présence de données qui bloque.

-- ── RPC de lecture ─────────────────────────────────────────────────────────
drop function if exists public.community_carnets_feed(text, text, double precision, double precision, jsonb, integer);
drop function if exists public.community_clubs_feed(text, text, text, double precision, double precision, jsonb, integer);
drop function if exists public.community_events_feed(text, date, double precision, double precision, jsonb, integer);
drop function if exists public.community_events_agenda(date, integer);
drop function if exists public.lkdv_carnet_is_live(uuid);

-- ── Contrôles de données avant suppression ─────────────────────────────────
do $$
begin
  if exists (select 1 from public.carnets where start_geom is not null) then
    raise exception 'Rollback lot B refusé : public.carnets.start_geom contient des données. Ne rien supprimer après le premier usage réel (06 § 3.5).';
  end if;
  if exists (select 1 from public.clubs where zone_geom is not null or zone_radius_km is not null) then
    raise exception 'Rollback lot B refusé : public.clubs.zone_geom / zone_radius_km contiennent des données.';
  end if;
  if exists (select 1 from public.events where location_geom is not null or meeting_geom is not null) then
    raise exception 'Rollback lot B refusé : public.events.location_geom / meeting_geom contiennent des données.';
  end if;
end
$$;

-- ── Index puis colonnes ────────────────────────────────────────────────────
drop index if exists public.idx_events_meeting_geom;
drop index if exists public.idx_events_location_geom;
drop index if exists public.idx_clubs_zone_geom;
drop index if exists public.idx_carnets_start_geom;

alter table public.clubs drop constraint if exists clubs_zone_radius_km_check;

alter table public.events drop column if exists meeting_geom;
alter table public.events drop column if exists location_geom;
alter table public.clubs drop column if exists zone_radius_km;
alter table public.clubs drop column if exists zone_geom;
alter table public.carnets drop column if exists start_geom;
