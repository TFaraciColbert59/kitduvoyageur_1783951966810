-- ═══════════════════════════════════════════════════════════════════════════
-- LKDV Control — M07 : chaque source apparaît dans la file, tri conforme
-- (urgence haute > délai le plus proche > ancienneté), détail réservé équipe.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL search_path = public;
SELECT plan(8);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('d6000000-0000-4000-8000-000000000001','authenticated','authenticated','crm_inbox@test.local','x','{}','{}',now(),now()),
  ('d6000000-0000-4000-8000-000000000002','authenticated','authenticated','crm_inbox_membre@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, email, full_name) VALUES
  ('d6000000-0000-4000-8000-000000000001','crm_inbox@test.local','File Test'),
  ('d6000000-0000-4000-8000-000000000002','crm_inbox_membre@test.local','Membre File')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.admin_roles (user_id, role) VALUES ('d6000000-0000-4000-8000-000000000001','super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- Une source de chaque famille.
INSERT INTO public.community_posts (id, author_id, content, audience)
VALUES ('d3100000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000002','[TEST CRM] cible signalement','public')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.post_reports (id, post_id, reporter_id, reason)
VALUES ('d6100000-0000-4000-8000-000000000001','d3100000-0000-4000-8000-000000000001',
        'd6000000-0000-4000-8000-000000000002','spam');
INSERT INTO public.support_tickets (id, user_id, subject, message)
VALUES ('d6100000-0000-4000-8000-000000000002','d6000000-0000-4000-8000-000000000002','[TEST CRM] ticket','message');
INSERT INTO public.sos_alerts (id, user_id, latitude, longitude, status)
VALUES ('d6100000-0000-4000-8000-000000000003','d6000000-0000-4000-8000-000000000002',45.9,6.9,'active');
INSERT INTO public.pending_contributions (id, user_id, action_type, status)
VALUES ('d6100000-0000-4000-8000-000000000004','d6000000-0000-4000-8000-000000000002','place_fix','pending');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"d6000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';

SELECT is((SELECT count(*) FROM jsonb_array_elements(admin.inbox() -> 'items')
           WHERE value ->> 'source' = 'sos'), 1::bigint, 'le SOS apparaît dans la file');
SELECT is((SELECT count(*) FROM jsonb_array_elements(admin.inbox() -> 'items')
           WHERE value ->> 'source' = 'support_ticket'), 1::bigint, 'le ticket apparaît');
SELECT is((SELECT count(*) FROM jsonb_array_elements(admin.inbox() -> 'items')
           WHERE value ->> 'source' = 'post_report'), 1::bigint, 'le signalement apparaît');
SELECT is((SELECT count(*) FROM jsonb_array_elements(admin.inbox() -> 'items')
           WHERE value ->> 'source' = 'contribution'), 1::bigint, 'la contribution apparaît');

-- Tri : le premier élément est le SOS (urgence haute).
SELECT is((admin.inbox() -> 'items' -> 0 ->> 'source'), 'sos',
  'tri EX-INBOX-02 : l''urgence haute passe en premier');
SELECT is((admin.inbox() -> 'items' -> 0 ->> 'group'), 'urgence_haute',
  'le groupe du premier élément est « urgence haute »');

-- Chaque item a une échéance et une clé.
SELECT is((SELECT count(*) FROM jsonb_array_elements(admin.inbox() -> 'items')
           WHERE value ->> 'dueAt' IS NULL OR value ->> 'key' IS NULL), 0::bigint,
  'chaque élément porte une clé et une échéance');

-- Le détail est réservé à l'équipe.
SET LOCAL "request.jwt.claims" = '{"sub":"d6000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
SELECT throws_ok(
  $$SELECT admin.inbox_item('post_report','d6100000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'le détail d''un cas est refusé à un membre ordinaire');

SELECT * FROM finish();
ROLLBACK;
