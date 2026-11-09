-- ═══════════════════════════════════════════════════════════════════════════
-- LKDV Control — M04/M13 : demandes à deux personnes.
--   * auto-validation refusée hors mode solo ;
--   * empreinte modifiée → refus ;
--   * un agent ne valide jamais ;
--   * expiration 72 h.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL search_path = public;
SELECT plan(9);

-- Un agent ne peut pas lire admin.requests (policy équipe) : l'identifiant de
-- la demande est donc capturé ici, en propriétaire, et réutilisé en littéral.
CREATE TEMPORARY TABLE crm_req (id uuid, conf text) ON COMMIT DROP;
GRANT ALL ON crm_req TO authenticated, anon;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('d2000000-0000-4000-8000-000000000001','authenticated','authenticated','crm_sa2@test.local','x','{}','{}',now(),now()),
  ('d2000000-0000-4000-8000-000000000002','authenticated','authenticated','crm_sa3@test.local','x','{}','{}',now(),now()),
  ('d2000000-0000-4000-8000-000000000003','authenticated','authenticated','crm_agent2@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, email, full_name) VALUES
  ('d2000000-0000-4000-8000-000000000001','crm_sa2@test.local','SA Deux'),
  ('d2000000-0000-4000-8000-000000000002','crm_sa3@test.local','SA Trois'),
  ('d2000000-0000-4000-8000-000000000003','crm_agent2@test.local','Agent Deux')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.admin_roles (user_id, role) VALUES
  ('d2000000-0000-4000-8000-000000000001','super_admin'),
  ('d2000000-0000-4000-8000-000000000002','super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
INSERT INTO admin.agents (name, auth_user_id, pole_code, objective, tools, status)
VALUES ('agent_validation_test','d2000000-0000-4000-8000-000000000003','MEMB','test',ARRAY['member_view_360'],'active')
ON CONFLICT (name) DO UPDATE SET auth_user_id = excluded.auth_user_id;

-- Deux comptes d'équipe actifs : le mode solo est coupé.
SELECT is(admin.solo_mode(), false, 'deux comptes d''équipe : le mode solo est coupé');

-- 1. Une commande à deux personnes crée une demande, sans effet.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"d2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
SELECT is((admin.run_command('member_ban','{"target_id":"d2000000-0000-4000-8000-000000000002","reason_code":"spam"}') ->> 'ok')::boolean,
  true, 'member_ban crée une demande');
RESET ROLE;
INSERT INTO crm_req
SELECT r.id, left(r.fingerprint, 8) FROM admin.requests r WHERE r.command = 'member_ban' ORDER BY r.created_at DESC LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM crm_req), 1::bigint, 'la demande est en attente et son identifiant est capturé');

-- 2. L''auteur ne peut pas valider sa propre demande.
SELECT throws_ok(
  format('SELECT admin.approve_request(%L, %L)',
         (SELECT id FROM crm_req), (SELECT conf FROM crm_req)),
  '42501', NULL, 'auto-validation refusée hors mode solo');

-- 3. Une mauvaise confirmation est refusée.
SET LOCAL "request.jwt.claims" = '{"sub":"d2000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
SELECT throws_ok(
  format('SELECT admin.approve_request(%L, %L)',
         (SELECT id FROM crm_req), 'xxxxxxxx'),
  'P0001', NULL, 'empreinte de confirmation fausse : refus');

-- 4. Empreinte modifiée : refus.
RESET ROLE;
UPDATE admin.requests SET params = '{"target_id":"d2000000-0000-4000-8000-000000000099","reason_code":"spam"}'::jsonb
 WHERE command = 'member_ban';
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  format('SELECT admin.approve_request(%L, %L)',
         (SELECT id FROM crm_req), (SELECT conf FROM crm_req)),
  'P0001', NULL, 'paramètres modifiés après création : refus (fingerprint_mismatch)');

-- 5. Un agent ne valide jamais, même avec la bonne confirmation.
SET LOCAL "request.jwt.claims" = '{"sub":"d2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
RESET ROLE;
-- PostgreSQL évalue les SET sur l'ancienne ligne : l'empreinte doit être
-- recalculée explicitement sur les paramètres restaurés.
UPDATE admin.requests
   SET params = '{"target_id":"d2000000-0000-4000-8000-000000000002","reason_code":"spam"}'::jsonb,
       fingerprint = admin.request_fingerprint('member_ban',
         '{"target_id":"d2000000-0000-4000-8000-000000000002","reason_code":"spam"}'::jsonb)
 WHERE command = 'member_ban';
UPDATE crm_req SET conf = (SELECT left(fingerprint, 8) FROM admin.requests WHERE command = 'member_ban' ORDER BY created_at DESC LIMIT 1);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"d2000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}';
SELECT throws_ok(
  format('SELECT admin.approve_request(%L, %L)',
         (SELECT id FROM crm_req), (SELECT conf FROM crm_req)),
  '42501', NULL, 'un agent ne valide jamais une demande');

-- 6. Expiration : une demande échue ne s''approuve plus.
SET LOCAL "request.jwt.claims" = '{"sub":"d2000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
RESET ROLE;
UPDATE admin.requests SET expires_at = now() - interval '1 minute' WHERE command = 'member_ban';
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  format('SELECT admin.approve_request(%L, %L)',
         (SELECT id FROM crm_req), (SELECT conf FROM crm_req)),
  'P0001', NULL, 'demande expirée : refus');

-- 7. Un second humain valide : l''effet est appliqué et journalisé.
RESET ROLE;
UPDATE admin.requests SET expires_at = now() + interval '1 hour' WHERE command = 'member_ban';
SET LOCAL ROLE authenticated;
SELECT is((admin.approve_request((SELECT id FROM crm_req), (SELECT conf FROM crm_req)) ->> 'status'),
  'executed', 'un autre humain valide : la demande est exécutée');
SELECT is((SELECT account_status FROM public.user_profiles WHERE id = 'd2000000-0000-4000-8000-000000000002'),
  'banned', 'le bannissement est appliqué');
SELECT is((SELECT count(*) FROM admin.audit_log WHERE action = 'member_ban' AND second_approver_id IS NOT NULL),
  1::bigint, 'le journal porte l''approbateur');

SELECT * FROM finish();
ROLLBACK;
