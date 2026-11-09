-- ═══════════════════════════════════════════════════════════════════════════
-- LKDV Control — M06 : un compte suspendu n'écrit plus, un compte suspendu
-- peut toujours signaler, une suspension échue réécrit, un membre ne peut pas
-- changer son propre statut.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL search_path = public;
SELECT plan(7);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('d4000000-0000-4000-8000-000000000001','authenticated','authenticated','crm_susp@test.local','x','{}','{}',now(),now()),
  ('d4000000-0000-4000-8000-000000000002','authenticated','authenticated','crm_sain@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, email, full_name) VALUES
  ('d4000000-0000-4000-8000-000000000001','crm_susp@test.local','Suspendu Test'),
  ('d4000000-0000-4000-8000-000000000002','crm_sain@test.local','Sain Test')
ON CONFLICT (id) DO NOTHING;

UPDATE public.user_profiles
   SET account_status = 'suspended', suspended_until = now() + interval '3 days', status_reason = 'test'
 WHERE id = 'd4000000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"d4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';

SELECT is(public.account_can_write(), false, 'compte suspendu : écriture refusée');

SELECT throws_ok(
  $$INSERT INTO public.community_posts (author_id, content, audience)
    VALUES ('d4000000-0000-4000-8000-000000000001','[TEST CRM] tentative suspendue','public')$$,
  '42501', NULL, 'un compte suspendu ne publie plus');

SELECT lives_ok(
  $$INSERT INTO public.post_reports (post_id, reporter_id, reason, target_type)
    VALUES ('d3100000-0000-4000-8000-000000000099','d4000000-0000-4000-8000-000000000001','spam','post')$$,
  'un compte suspendu peut toujours signaler');

-- Suspension échue : le droit d''écrire revient (fixture par le propriétaire).
RESET ROLE;
SET LOCAL "request.jwt.claims" = '{}';
UPDATE public.user_profiles SET suspended_until = now() - interval '1 minute'
 WHERE id = 'd4000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"d4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
SELECT is(public.account_can_write(), true, 'suspension échue : écriture de nouveau possible');

-- Un membre ne peut pas modifier son propre statut.
SELECT throws_ok(
  $$UPDATE public.user_profiles SET account_status = 'active', suspended_until = null
     WHERE id = 'd4000000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'un membre ne peut pas changer son propre statut de compte');

-- Banni : plus aucune écriture, même échu.
RESET ROLE;
SET LOCAL "request.jwt.claims" = '{}';
UPDATE public.user_profiles SET account_status = 'banned', suspended_until = null
 WHERE id = 'd4000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"d4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
SELECT is(public.account_can_write(), false, 'compte banni : écriture refusée');
SELECT is(public.my_account_status() ->> 'status', 'banned', 'le membre lit son propre statut');

SELECT * FROM finish();
ROLLBACK;
