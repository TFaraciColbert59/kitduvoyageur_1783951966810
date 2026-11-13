-- Rollback du lot G02 — supprime les objets ajoutés par
-- 20261113120000_clubs_g02_ui_api.sql. Les colonnes ajoutées aux tables
-- existantes sont retirées en dernier (perte des valeurs G02 uniquement).
begin;

drop table if exists public.club_activity_matches cascade;
drop table if exists public.club_challenge_progress cascade;
drop table if exists public.club_recorded_activity_invites cascade;
drop table if exists public.club_invites cascade;
drop table if exists public.club_event_route_sync cascade;
drop table if exists public.club_event_route_revisions cascade;
drop table if exists public.club_event_attendance cascade;
drop table if exists public.club_event_registrations cascade;
drop table if exists public.club_content_reports cascade;
drop table if exists public.club_channel_messages cascade;
drop table if exists public.club_channels cascade;

drop function if exists public.lkdv_redeem_club_invite(text);
drop function if exists public.lkdv_get_club_invite(text);
drop function if exists public.lkdv_club_week_activities(uuid, timestamptz, timestamptz);

drop policy if exists clubs_g02_moderator_update on public.clubs;
drop policy if exists club_members_g02_moderator_insert on public.club_members;
drop policy if exists club_members_g02_moderator_update on public.club_members;
drop policy if exists club_members_g02_moderator_delete on public.club_members;
drop policy if exists club_join_requests_g02_moderator_update on public.club_join_requests;
drop policy if exists club_events_g02_moderator_update on public.club_events;

drop function if exists public.lkdv_is_club_member(uuid, text[]);
drop function if exists public.lkdv_is_club_moderator(uuid);

alter table public.club_challenges
  drop column if exists created_by,
  drop column if exists badge_icon,
  drop column if exists badge_title,
  drop column if exists ends_at,
  drop column if exists starts_at,
  drop column if exists target_value,
  drop column if exists metric,
  drop column if exists sport,
  drop column if exists scope;

alter table public.club_events
  drop column if exists co_host_club_ids,
  drop column if exists route_revision,
  drop column if exists route_id,
  drop column if exists registration_url,
  drop column if exists pace_groups,
  drop column if exists waitlist_enabled,
  drop column if exists lng,
  drop column if exists lat,
  drop column if exists meeting_point,
  drop column if exists visibility,
  drop column if exists format,
  drop column if exists sport,
  drop column if exists ends_at,
  drop column if exists starts_at;

alter table public.club_members
  drop column if exists verified_sports,
  drop column if exists is_pro_athlete,
  drop column if exists leaderboard_opt_in,
  drop column if exists muted_until;

alter table public.clubs
  drop column if exists verification_sports,
  drop column if exists verification_badge_label,
  drop column if exists verified_at,
  drop column if exists verification_status,
  drop column if exists sports,
  drop column if exists primary_sport;

commit;
