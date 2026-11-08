-- Rollback du lot C Communauté v2 (20261108130003) :
-- colonnes de sortie, statut de participation, trigger event_date.
-- Règle 06 § 3.5 : toute colonne supprimée est refusée si elle contient des
-- données. Pour une colonne NOT NULL à défaut (waitlist_enabled, status,
-- safety_checklist), « contient des données » = une valeur différente du défaut.

-- ── Trigger additif ────────────────────────────────────────────────────────
drop trigger if exists trg_events_event_date_from_starts_at on public.events;
drop function if exists public.lkdv_event_date_from_starts_at();

-- ── Contrôles de données ───────────────────────────────────────────────────
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
    ('events', 'starts_at', 'starts_at is not null'),
    ('events', 'ends_at', 'ends_at is not null'),
    ('events', 'level', 'level is not null'),
    ('events', 'distance_km', 'distance_km is not null'),
    ('events', 'elevation_gain_m', 'elevation_gain_m is not null'),
    ('events', 'meeting_point', 'meeting_point is not null'),
    ('events', 'safety_notes', 'safety_notes is not null'),
    ('events', 'recurrence', 'recurrence is not null'),
    ('events', 'activity', 'activity is not null'),
    ('events', 'club_id', 'club_id is not null'),
    ('events', 'kit_id', 'kit_id is not null'),
    ('events', 'waitlist_enabled', 'waitlist_enabled is true'),
    ('events', 'safety_checklist', 'cardinality(coalesce(safety_checklist, ''{}''::text[])) > 0'),
    ('event_participants', 'status', 'status is distinct from ''confirmed''')
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
drop index if exists public.idx_event_participants_event_status;
drop index if exists public.idx_events_kit_id;
drop index if exists public.idx_events_club_id;
drop index if exists public.idx_events_starts_at;

alter table public.event_participants drop column if exists status;

alter table public.events
  drop column if exists kit_id,
  drop column if exists club_id,
  drop column if exists activity,
  drop column if exists recurrence,
  drop column if exists safety_checklist,
  drop column if exists safety_notes,
  drop column if exists waitlist_enabled,
  drop column if exists meeting_point,
  drop column if exists elevation_gain_m,
  drop column if exists distance_km,
  drop column if exists level,
  drop column if exists ends_at,
  drop column if exists starts_at;
