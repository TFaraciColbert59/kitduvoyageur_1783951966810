-- ═══════════════════════════════════════════════════════════════════════════
-- LKDV Control — M01 : le journal d'audit est en ajout seul.
-- Les écritures de fixture passent par le propriétaire (comme les fonctions
-- admin.*) ; les contrôles d'altération portent sur le déclencheur lui-même.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL search_path = public;
SELECT plan(6);

INSERT INTO auth.users (id, email, last_sign_in_at) VALUES ('d1000000-0000-4000-8000-000000000001','crm_journal@test.local',now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, email, full_name) VALUES ('d1000000-0000-4000-8000-000000000001','crm_journal@test.local','Journal Test')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.admin_roles (user_id, role) VALUES ('d1000000-0000-4000-8000-000000000001','super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- Une ligne de journal (le propriétaire écrit, comme le fait admin.log).
INSERT INTO admin.audit_log (actor_id, actor_kind, actor_role, action, target_type, target_id, reason_text)
VALUES ('d1000000-0000-4000-8000-000000000001','human','super_admin','test_action','member',
        'd1000000-0000-4000-8000-000000000001','motif de test');

SELECT is((SELECT count(*) FROM admin.audit_log WHERE action = 'test_action'), 1::bigint,
  'la ligne de journal est écrite');

SELECT throws_ok(
  $$UPDATE admin.audit_log SET reason_text = 'falsifié' WHERE action = 'test_action'$$,
  '42501', NULL, 'UPDATE du journal refusé par le déclencheur');
SELECT throws_ok(
  $$DELETE FROM admin.audit_log WHERE action = 'test_action'$$,
  '42501', NULL, 'DELETE du journal refusé par le déclencheur');
SELECT throws_ok('TRUNCATE admin.audit_log', '42501', NULL,
  'TRUNCATE du journal refusé par le déclencheur');

-- Un membre d''équipe ne peut pas écrire au journal directement : l''écriture
-- passe uniquement par les fonctions du moteur.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
SELECT throws_ok(
  $$SELECT admin.log('test_action','member','x')$$,
  '42501', NULL, 'admin.log n''est pas exécutable par authenticated');
RESET ROLE;

SELECT is((SELECT reason_text FROM admin.audit_log WHERE action = 'test_action'), 'motif de test',
  'le journal est intact après les tentatives');

SELECT * FROM finish();
ROLLBACK;
