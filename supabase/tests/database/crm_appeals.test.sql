-- ═══════════════════════════════════════════════════════════════════════════
-- LKDV Control — M08 : un recours est tranché par quelqu'un d'autre que le
-- décideur (hors mode solo), l'auteur du recours est la personne visée,
-- et un agent ne tranche jamais.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL search_path = public;
SELECT plan(6);

-- L'identifiant de la décision est capturé ici : un membre ordinaire ne peut
-- pas lire admin.audit_log (policy équipe), et c'est voulu.
CREATE TEMPORARY TABLE crm_ids (audit_id bigint) ON COMMIT DROP;
GRANT ALL ON crm_ids TO authenticated, anon;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('d5000000-0000-4000-8000-000000000001','authenticated','authenticated','crm_decideur@test.local','x','{}','{}',now(),now()),
  ('d5000000-0000-4000-8000-000000000002','authenticated','authenticated','crm_autre@test.local','x','{}','{}',now(),now()),
  ('d5000000-0000-4000-8000-000000000003','authenticated','authenticated','crm_membre_b@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, email, full_name) VALUES
  ('d5000000-0000-4000-8000-000000000001','crm_decideur@test.local','Décideur Test'),
  ('d5000000-0000-4000-8000-000000000002','crm_autre@test.local','Autre Test'),
  ('d5000000-0000-4000-8000-000000000003','crm_membre_b@test.local','Membre B')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.admin_roles (user_id, role) VALUES
  ('d5000000-0000-4000-8000-000000000001','super_admin'),
  ('d5000000-0000-4000-8000-000000000002','super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- Décision rendue par le décideur sur le membre B (via le moteur, journal réel).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"d5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
INSERT INTO crm_ids
SELECT (admin.run_command('member_adjust_trust',
  '{"target_id":"d5000000-0000-4000-8000-000000000003","reason_code":"spam","trust_score":10}'::jsonb) ->> 'audit_id')::bigint;
SELECT is((SELECT audit_id FROM crm_ids) > 0, true, 'décision rendue sur le membre B');


-- Le membre visé dépose un recours.
SET LOCAL "request.jwt.claims" = '{"sub":"d5000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}';
SELECT is((admin.appeal_submit((SELECT audit_id FROM crm_ids), 'je conteste cette décision') ->> 'ok')::boolean,
  true, 'la personne visée peut déposer un recours');

-- Un tiers ne peut pas déposer un recours pour autrui.
SET LOCAL "request.jwt.claims" = '{"sub":"d5000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
SELECT throws_ok(
  format('SELECT admin.appeal_submit(%L, %L)', (SELECT audit_id FROM crm_ids), 'pas mon affaire'),
  '42501', NULL, 'un tiers ne peut pas contester une décision qui ne le concerne pas');

-- Le décideur ne tranche pas son propre recours hors mode solo (ici 2 comptes).
SET LOCAL "request.jwt.claims" = '{"sub":"d5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
RESET ROLE;
UPDATE auth.users SET last_sign_in_at = now() WHERE id IN ('d5000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(admin.solo_mode(), false, 'deux comptes actifs : mode solo coupé');
SELECT throws_ok(
  format('SELECT admin.appeal_decide(%L, %L, %L)',
         (SELECT id FROM admin.appeals ORDER BY created_at DESC LIMIT 1), 'rejected', 'maintenu'),
  '42501', NULL, 'le décideur ne tranche pas son propre recours');

-- Un autre humain tranche.
SET LOCAL "request.jwt.claims" = '{"sub":"d5000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
SELECT is((admin.appeal_decide((SELECT id FROM admin.appeals ORDER BY created_at DESC LIMIT 1), 'accepted', 'réexamen favorable') ->> 'status'),
  'accepted', 'un autre humain tranche le recours');
SELECT is((SELECT status FROM admin.appeals ORDER BY created_at DESC LIMIT 1), 'accepted',
  'le recours est clos');

SELECT * FROM finish();
ROLLBACK;
