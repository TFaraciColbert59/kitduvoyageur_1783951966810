-- Rollback du lot C Communauté v2 (20261108130003) :
-- colonnes de sortie, statut de participation, trigger event_date.
-- Règle 06 § 3.5 : toute colonne supprimée est refusée si elle contient des
-- données. Pour une colonne NOT NULL à défaut (waitlist_enabled, status,
-- safety_checklist), « contient des données » = une valeur différente du défaut.

-- ── Trigger additif ────────────────────────────────────────────────────────
drop trigger if exists trg_events_event_date_from_starts_at on public.events;
drop function if exists public.lkdv_event_date_from_starts_at();

-- ── Contrôles de données ───────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.events where starts_at is not null or ends_at is not null) then
    raise exception 'Rollback lot C refusé : events.starts_at / ends_at contiennent des données.';
  end if;
  if exists (
    select 1 from public.events
     where level is not null
        or distance_km is not null
        or elevation_gain_m is not null
        or meeting_point is not null
        or safety_notes is not null
        or recurrence is not null
        or activity is not null
        or club_id is not null
        or kit_id is not null
  ) then
    raise exception 'Rollback lot C refusé : les colonnes de métadonnées de sortie contiennent des données.';
  end if;
  if exists (select 1 from public.events where waitlist_enabled is true) then
    raise exception 'Rollback lot C refusé : events.waitlist_enabled a été utilisé (liste d''attente réelle).';
  end if;
  if exists (select 1 from public.events where cardinality(coalesce(safety_checklist, '{}'::text[])) > 0) then
    raise exception 'Rollback lot C refusé : events.safety_checklist contient des données.';
  end if;
  if exists (select 1 from public.event_participants where status is distinct from 'confirmed') then
    raise exception 'Rollback lot C refusé : event_participants.status contient des inscriptions en liste d''attente.';
  end if;
end
$$;

-- ── Index puis colonnes ────────────────────────────────────────────────────
drop index if exists public.idx_event_participants_event_status;
drop index if exists public.idx_events_effective_start;
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
