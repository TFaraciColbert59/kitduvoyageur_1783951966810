-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Communauté v2 — lot C : sorties, vraies colonnes, heure, liste d'attente (colonnes)
-- Phase 1 (ajouts purs : colonnes, index, trigger additif).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat prod (2026-11-08) : `events` ne porte que `event_date` (date, sans
-- heure) et les métadonnées du formulaire v1 sont concaténées dans
-- `description` ; `event_participants` n'a aucun statut (pas de liste d'attente).
--
-- Ce lot ajoute les colonnes réelles (aucune recopie des anciennes sorties : les
-- champs vides sont simplement masqués par l'UI V2) et le statut d'inscription.
-- `event_date` reste renseignée — c'est elle que lit tout le code v1 : un
-- trigger additif la dérive de `starts_at` quand elle est absente, et l'heure
-- de référence Europe/Paris est utilisée pour la conversion date/heure.
--
-- Les réécritures de `join_event`, `leave_event`, `guard_event_participant_insert`,
-- `guard_event_participant_identity` et `sync_event_participants_count` (vraie
-- liste d'attente : promotion du premier en attente, compteur = confirmés
-- seulement) sont en **phase 2** (20261108130007), après revue.
--
-- Ordre des lots : ce fichier est appliqué après 130001/130002 dont les feed
-- lisent `events.starts_at`, `events.level`, `events.club_id`,
-- `event_participants.status`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Colonnes de sortie ──────────────────────────────────────────────────
alter table public.events
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists level text check (level is null or level in ('facile', 'moyen', 'difficile')),
  add column if not exists distance_km numeric check (distance_km is null or distance_km between 0 and 500),
  add column if not exists elevation_gain_m integer check (elevation_gain_m is null or elevation_gain_m between 0 and 20000),
  add column if not exists meeting_point text check (meeting_point is null or char_length(meeting_point) <= 200),
  add column if not exists waitlist_enabled boolean not null default false,
  add column if not exists safety_notes text check (safety_notes is null or char_length(safety_notes) <= 500),
  add column if not exists safety_checklist text[] not null default '{}',
  add column if not exists recurrence text check (recurrence is null or recurrence in ('weekly', 'monthly')),
  add column if not exists activity text check (activity is null or char_length(activity) <= 60),
  add column if not exists club_id uuid references public.clubs(id) on delete set null,
  add column if not exists kit_id uuid references public.materiel_kits(id) on delete set null;

create index if not exists idx_events_starts_at on public.events (starts_at);
create index if not exists idx_events_club_id on public.events (club_id);
create index if not exists idx_events_kit_id on public.events (kit_id);
-- Tri chronologique des feeds : starts_at prime, event_date sert de repli.
create index if not exists idx_events_effective_start
  on public.events ((coalesce(starts_at, event_date::timestamptz)));

-- ── 2. Statut d'inscription (liste d'attente) ──────────────────────────────
-- Toutes les lignes existantes deviennent 'confirmed' (défaut) : la phase 1
-- seule reste donc strictement équivalente au comportement actuel.
alter table public.event_participants
  add column if not exists status text not null default 'confirmed'
  check (status in ('confirmed', 'waitlist'));

create index if not exists idx_event_participants_event_status
  on public.event_participants (event_id, status);

-- ── 3. `event_date` maintenue (= date locale de `starts_at`) ───────────────
create or replace function public.lkdv_event_date_from_starts_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.starts_at is not null and new.event_date is null then
    new.event_date := (new.starts_at at time zone 'Europe/Paris')::date;
  end if;

  if new.starts_at is not null and new.ends_at is not null and new.ends_at < new.starts_at then
    raise exception 'La fin de la sortie ne peut pas précéder son début.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.lkdv_event_date_from_starts_at() is
  'Communauté v2 — lot C : garantit que events.event_date (colonne NOT NULL lue par tout le code v1) reste renseignée quand seul starts_at est fourni, et refuse une fin antérieure au début.';

revoke all on function public.lkdv_event_date_from_starts_at() from public;
revoke all on function public.lkdv_event_date_from_starts_at() from anon, authenticated;

drop trigger if exists trg_events_event_date_from_starts_at on public.events;
create trigger trg_events_event_date_from_starts_at
  before insert or update on public.events
  for each row
  execute function public.lkdv_event_date_from_starts_at();

comment on column public.events.starts_at is
  'Communauté v2 — date et heure de départ de la sortie (NULL pour les sorties historiques qui n''avaient que event_date).';
comment on column public.events.event_date is
  'Date de la sortie, lue par tout le code v1 ; dérivée de starts_at (Europe/Paris) par trg_events_event_date_from_starts_at quand elle n''est pas fournie.';
comment on column public.events.waitlist_enabled is
  'Communauté v2 — liste d''attente activée par l''organisateur (phase 2 : join_event/leave_event).';
comment on column public.event_participants.status is
  'Communauté v2 — confirmed (compté dans current_participants) ou waitlist (liste d''attente, promu par leave_event en phase 2).';
