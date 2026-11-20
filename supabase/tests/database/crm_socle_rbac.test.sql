-- ═══════════════════════════════════════════════════════════════════════════
-- LKDV Control — M01/M02 : socle d'accès (aal1, non-équipe, matrice de droits)
-- Exécution : pgTAP, dans une transaction annulée (ROLLBACK).
-- Aucune donnée réelle : comptes de test marqués crm_*.
-- ════════════════════════════════════════════===============================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(16);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('d0000000-0000-4000-8000-000000000001','authenticated','authenticated','crm_sa@test.local','x','{}','{}',now(),now()),
  ('d0000000-0000-4000-8000-000000000002','authenticated','authenticated','crm_resp@test.local','x','{}','{}',now(),now()),
  ('d0000000-0000-4000-8000-000000000003','authenticated','authenticated','crm_membre@test.local','x','{}','{}',now(),now()),
  ('d0000000-0000-4000-8000-000000000004','authenticated','authenticated','crm_agent@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, email, full_name, created_at)
VALUES
  ('d0000000-0000-4000-8000-000000000001','crm_sa@test.local','SA Test',now()),
  ('d0000000-0000-4000-8000-000000000002','crm_resp@test.local','Responsable Test',now()),
  ('d0000000-0000-4000-8000-000000000003','crm_membre@test.local','Membre Test',now()),
  ('d0000000-0000-4000-8000-000000000004','crm_agent@test.local','Agent Test',now())
ON CONFLICT (id) DO NOTHING;

-- Le super admin de test (rôle admin_roles) + colonne dérivée.
INSERT INTO public.admin_roles (user_id, role) VALUES ('d0000000-0000-4000-8000-000000000001','super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
UPDATE public.user_profiles SET role = 'admin' WHERE id = 'd0000000-0000-4000-8000-000000000001';

INSERT INTO admin.staff_memberships (user_id, pole_code, role)
VALUES
  ('d0000000-0000-4000-8000-000000000002','CONF','responsable'),
  ('d0000000-0000-4000-8000-000000000003','CONF','membre')
ON CONFLICT (user_id, pole_code) DO UPDATE SET role = excluded.role, revoked_at = null;

INSERT INTO admin.agents (name, auth_user_id, pole_code, objective, tools, status)
VALUES ('agent_confiance_test','d0000000-0000-4000-8000-000000000004','CONF','test',
        ARRAY['post_hide','member_view_360'], 'active')
ON CONFLICT (name) DO UPDATE SET auth_user_id = excluded.auth_user_id, status = 'active';

-- 1. Session sans MFA : refusée.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
SELECT throws_ok('SELECT admin.assert_staff()', '42501', NULL,
  'aal1 : le socle refuse une session sans double authentification');

-- 2. aal1 : aucune lecture d''écran.
SELECT throws_ok('SELECT admin.inbox()', '42501', NULL,
  'aal1 : la file est refusée');

-- 3. aal2 : le super admin lit la file.
SET LOCAL "request.jwt.claims" = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
SELECT isnt(admin.my_role(), NULL, 'aal2 : le super admin a un rôle');

-- 4. Non-équipe : refusée, même avec aal2.
SET LOCAL "request.jwt.claims" = '{"sub":"d0000000-0000-4000-8000-000000000099","role":"authenticated","aal":"aal2"}';
SELECT is(admin.my_role(), NULL, 'un membre ordinaire n''a aucun rôle d''équipe');
SELECT throws_ok('SELECT admin.inbox()', '42501', NULL, 'non-équipe : file refusée');
SELECT is(admin.is_staff(), false, 'non-équipe : is_staff() faux');

-- 5. Matrice de droits : responsable CONF.
SELECT is(admin.can('d0000000-0000-4000-8000-000000000002','post_hide'), true,
  'responsable CONF : peut masquer une publication (son pôle)');
SELECT is(admin.can('d0000000-0000-4000-8000-000000000002','order_refund'), false,
  'responsable CONF : ne peut pas rembourser (pôle Commerce)');
SELECT is(admin.can('d0000000-0000-4000-8000-000000000002','member_set_staff_role'), false,
  'responsable CONF : ne peut pas changer un rôle d''équipe (super admin seulement)');

-- 6. Membre de pôle : seulement role_min = membre.
SELECT is(admin.can('d0000000-0000-4000-8000-000000000003','post_hide'), true,
  'membre CONF : peut masquer (role_min = membre)');
SELECT is(admin.can('d0000000-0000-4000-8000-000000000003','post_remove'), false,
  'membre CONF : ne peut pas retirer (role_min = responsable)');

-- 7. Hors pôle : refusé, sauf élévation.
SELECT is(admin.can('d0000000-0000-4000-8000-000000000003','order_refund'), false,
  'membre CONF : hors pôle refusé');
RESET ROLE;
INSERT INTO admin.elevations (user_id, command, reason, granted_by, expires_at)
VALUES ('d0000000-0000-4000-8000-000000000003','order_refund','renfort Commerce', 'd0000000-0000-4000-8000-000000000001', now() + interval '1 hour');
SET LOCAL ROLE authenticated;
SELECT is(admin.can('d0000000-0000-4000-8000-000000000003','order_refund'), true,
  'élévation active : le hors-pôle passe');

-- 8. Agent : allowlist uniquement, jamais hors liste.
SELECT is(admin.can('d0000000-0000-4000-8000-000000000004','post_hide'), true,
  'agent : outil de sa liste autorisé');
SELECT is(admin.can('d0000000-0000-4000-8000-000000000004','order_refund'), false,
  'agent : outil hors liste refusé');

-- 9. Agent arrêté : plus rien (écriture de fixture par le propriétaire).
RESET ROLE;
UPDATE admin.agents SET status = 'stopped' WHERE auth_user_id = 'd0000000-0000-4000-8000-000000000004';
SET LOCAL ROLE authenticated;
SELECT is(admin.can('d0000000-0000-4000-8000-000000000004','post_hide'), false,
  'agent arrêté : plus aucune commande');

SELECT * FROM finish();
ROLLBACK;
