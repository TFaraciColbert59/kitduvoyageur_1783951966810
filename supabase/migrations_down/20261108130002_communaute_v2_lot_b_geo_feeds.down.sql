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
-- Contrôles de données AVANT suppression. Le bloc est rejouable : chaque
-- colonne n'est contrôlée que si elle existe encore (un second passage ne
-- casse rien), et le rollback s'arrête si une seule contient des données.
do $$
declare
  v_check record;
  v_count bigint;
begin
  for v_check in
    select * from (values
    ('carnets', 'start_geom', 'start_geom is not null'),
    ('clubs', 'zone_geom', 'zone_geom is not null'),
    ('clubs', 'zone_radius_km', 'zone_radius_km is not null'),
    ('events', 'location_geom', 'location_geom is not null'),
    ('events', 'meeting_geom', 'meeting_geom is not null')
    ) as t(table_name, column_name, condition)
  loop
    if exists (
      select 1 from information_schema.columns ic
       where ic.table_schema = 'public'
         and ic.table_name = v_check.table_name
         and ic.column_name = v_check.column_name
    ) then
      execute format('select count(*) from public.%I where %s', v_check.table_name, v_check.condition)
        into v_count;
      if v_count > 0 then
        raise exception 'Rollback refusé : public.%.% contient % valeur(s). Ne rien supprimer après le premier usage réel (06 § 3.5).',
          v_check.table_name, v_check.column_name, v_count;
      end if;
    end if;
  end loop;
end $$;

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
