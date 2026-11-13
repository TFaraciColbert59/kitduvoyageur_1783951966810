-- ═══════════════════════════════════════════════════════════════════════════
-- LKDV Control — M12 : canaux privés admin:*, équipe seulement.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL search_path = public;
SELECT plan(4);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('d7000000-0000-4000-8000-000000000001','authenticated','authenticated','crm_rt@test.local','x','{}','{}',now(),now()),
  ('d7000000-0000-4000-8000-000000000002','authenticated','authenticated','crm_rt_membre@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, email, full_name) VALUES
  ('d7000000-0000-4000-8000-000000000001','crm_rt@test.local','RT Test'),
  ('d7000000-0000-4000-8000-000000000002','crm_rt_membre@test.local','RT Membre')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.admin_roles (user_id, role) VALUES ('d7000000-0000-4000-8000-000000000001','super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

SELECT is((SELECT count(*) FROM pg_policies
            WHERE schemaname = 'realtime' AND tablename = 'messages'
              AND policyname = 'crm_staff_receive_admin_topics'), 1::bigint,
  'la policy des canaux admin:* existe');

SELECT is((SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
            WHERE t.tgname = 'crm_rt_post_reports' AND NOT t.tgisinternal), 1::bigint,
  'le déclencheur temps réel est posé sur les signalements de publication');

SELECT is((SELECT count(*) FROM pg_trigger t WHERE t.tgname = 'crm_rt_audit_log' AND NOT t.tgisinternal), 1::bigint,
  'le déclencheur temps réel est posé sur le journal');

-- Un membre ordinaire n'a aucun accès au canal admin:*.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"d7000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
SELECT is((SELECT count(*) FROM realtime.messages
            WHERE realtime.topic() = 'admin:post_reports'), 0::bigint,
  'un membre ordinaire ne lit aucun message des canaux admin:*');

SELECT * FROM finish();
ROLLBACK;
