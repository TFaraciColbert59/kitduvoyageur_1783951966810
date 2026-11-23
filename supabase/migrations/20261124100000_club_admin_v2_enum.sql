-- ============================================================================
-- Club Admin V2 (Part 1/2) — Extension de l'enum public.club_capability
-- Isolé dans sa propre migration pour éviter l'erreur Postgres 55P04
-- ("unsafe use of new value of enum type" dans une même transaction).
-- ============================================================================

ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'club.manage_billing_settings';
ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'members.view_audit_log';
ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'moderation.resolve_reports';
ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'salons.create';
ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'salons.edit_settings';
ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'salons.archive_or_delete';
ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'salons.post_announcements';
ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'events.manage_registrations';
ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'volunteers.manage_shifts';
ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'challenges.manage';
ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'budget.view';
ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'budget.propose_expense';
ALTER TYPE public.club_capability ADD VALUE IF NOT EXISTS 'budget.approve_and_manage';
