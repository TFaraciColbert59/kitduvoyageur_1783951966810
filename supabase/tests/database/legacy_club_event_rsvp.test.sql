BEGIN;
SELECT plan(15);

INSERT INTO auth.users (id, email) VALUES
  ('84ca902a-16af-4463-a0ad-30432ff5a001', 'legacy-rsvp-owner@example.test'),
  ('84ca902a-16af-4463-a0ad-30432ff5a002', 'legacy-rsvp-member@example.test'),
  ('84ca902a-16af-4463-a0ad-30432ff5a003', 'legacy-rsvp-cancelled@example.test'),
  ('84ca902a-16af-4463-a0ad-30432ff5a004', 'legacy-rsvp-outsider@example.test');

INSERT INTO public.clubs (id, slug, name, privacy, created_by) VALUES
  ('84ca902a-16af-4463-a0ad-30432ff5b001', 'legacy-rsvp-compat', 'Club de recette', 'open',
   '84ca902a-16af-4463-a0ad-30432ff5a001');
INSERT INTO public.club_members (club_id, user_id, role, status)
VALUES ('84ca902a-16af-4463-a0ad-30432ff5b001', '84ca902a-16af-4463-a0ad-30432ff5a001', 'admin', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.club_events (id, club_id, title, event_date, starts_at, ends_at) VALUES
  ('84ca902a-16af-4463-a0ad-30432ff5c001', '84ca902a-16af-4463-a0ad-30432ff5b001',
    'Sortie passée', now() - interval '3 days', NULL, NULL),
  ('84ca902a-16af-4463-a0ad-30432ff5c002', '84ca902a-16af-4463-a0ad-30432ff5b001',
    'Sortie à venir', now() + interval '3 days', NULL, NULL),
  ('84ca902a-16af-4463-a0ad-30432ff5c003', '84ca902a-16af-4463-a0ad-30432ff5b001',
    'Autre sortie passée', now() - interval '3 days', NULL, NULL),
  ('84ca902a-16af-4463-a0ad-30432ff5c004', '84ca902a-16af-4463-a0ad-30432ff5b001',
    'Horaire encore ouvert', now() + interval '3 days', now() - interval '3 days', NULL);

INSERT INTO public.club_event_participants (event_id, user_id) VALUES
  ('84ca902a-16af-4463-a0ad-30432ff5c001', '84ca902a-16af-4463-a0ad-30432ff5a002'),
  ('84ca902a-16af-4463-a0ad-30432ff5c001', '84ca902a-16af-4463-a0ad-30432ff5a003'),
  ('84ca902a-16af-4463-a0ad-30432ff5c002', '84ca902a-16af-4463-a0ad-30432ff5a002'),
  ('84ca902a-16af-4463-a0ad-30432ff5c003', '84ca902a-16af-4463-a0ad-30432ff5a002'),
  ('84ca902a-16af-4463-a0ad-30432ff5c004', '84ca902a-16af-4463-a0ad-30432ff5a002');

INSERT INTO public.club_event_registrations (event_id, user_id, status) VALUES
  ('84ca902a-16af-4463-a0ad-30432ff5c001', '84ca902a-16af-4463-a0ad-30432ff5a003', 'cancelled');

\ir ../../migrations/20261119193057_import_legacy_club_event_rsvp.sql
\ir ../../migrations/20261119193057_import_legacy_club_event_rsvp.sql

SELECT is((SELECT count(*) FROM public.club_event_registrations
  WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c001'), 2::bigint,
  'Le rapprochement est idempotent');
SELECT is((SELECT status FROM public.club_event_registrations
  WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c001' AND user_id = '84ca902a-16af-4463-a0ad-30432ff5a002'),
  'registered', 'Le RSVP passé devient une inscription');
SELECT ok((SELECT registered_at = imported_legacy_rsvp_at FROM public.club_event_registrations
  WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c001' AND user_id = '84ca902a-16af-4463-a0ad-30432ff5a002'),
  'La date d’origine est conservée');
SELECT is((SELECT status FROM public.club_event_registrations
  WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c001' AND user_id = '84ca902a-16af-4463-a0ad-30432ff5a003'),
  'cancelled', 'Une annulation canonique ne ressuscite pas');
SELECT is((SELECT count(*) FROM public.club_event_attendance WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c001'),
  0::bigint, 'Un RSVP ne crée aucune présence');
SELECT is((SELECT count(*) FROM public.club_event_registrations WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c004'),
  0::bigint, 'Une date future encore utilisée par le parcours historique empêche la copie');
SELECT ok(NOT has_table_privilege('anon', 'public.club_event_registrations_effective', 'SELECT'),
  'La nouvelle vue ne rend pas les inscriptions publiques');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '84ca902a-16af-4463-a0ad-30432ff5a002', true);
SELECT is((SELECT count(*) FROM public.club_event_registrations WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c002'),
  0::bigint, 'Le RSVP futur reste dans le registre historique');
SELECT is((SELECT status FROM public.club_event_registrations_effective WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c002'),
  'registered', 'Le membre voit son RSVP futur depuis la vue');
SELECT public.transact_club_event_registration('84ca902a-16af-4463-a0ad-30432ff5c002', false);
SELECT is((SELECT status FROM public.club_event_registrations_effective WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c002'),
  'cancelled', 'La désinscription explicite masque le RSVP futur');
SELECT set_config('request.jwt.claim.sub', '84ca902a-16af-4463-a0ad-30432ff5a004', true);
SELECT is((SELECT count(*) FROM public.club_event_registrations_effective WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c004'),
  0::bigint, 'Un tiers ne voit pas un RSVP qui ne lui appartient pas');
SELECT set_config('request.jwt.claim.sub', '84ca902a-16af-4463-a0ad-30432ff5a001', true);
SELECT is((SELECT count(*) FROM public.club_event_registrations_effective WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c004'),
  1::bigint, 'Le gestionnaire peut voir le RSVP de son club');

RESET ROLE;
UPDATE public.club_event_registrations SET status = 'cancelled', updated_at = now()
WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c003';
-- Revenir sur les migrations qui dépendent de la vue avant de la retirer.
\ir ../../migrations_down/20261119205238_decide_club_event_route.down.sql
\ir ../../migrations_down/20261119204829_publish_club_event_route.down.sql
\ir ../../migrations_down/20261119202544_cancel_club_event.down.sql
\ir ../../migrations_down/20261119195142_link_events_to_canonical_trips.down.sql
\ir ../../migrations_down/20261119193057_import_legacy_club_event_rsvp.down.sql
SELECT is((SELECT count(*) FROM public.club_event_registrations WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c001'),
  1::bigint, 'Le retour arrière retire la copie inchangée');
SELECT is((SELECT status FROM public.club_event_registrations WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c003'),
  'cancelled', 'Le retour arrière conserve une annulation postérieure à l’import');
SELECT is((SELECT count(*) FROM public.club_event_participants WHERE event_id = '84ca902a-16af-4463-a0ad-30432ff5c001'),
  2::bigint, 'Le retour arrière conserve les RSVP d’origine');
SELECT * FROM finish();
ROLLBACK;
