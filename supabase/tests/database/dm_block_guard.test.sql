BEGIN;
SELECT plan(3);

-- A-064 — le blocage (dans un sens) refuse un NOUVEAU DM.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('a0640000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'bl_a@test.local', 'x', '{}', '{}', now(), now()),
  ('a0640000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'bl_b@test.local', 'x', '{}', '{}', now(), now()),
  ('a0640000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'bl_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('a0640000-0000-4000-8000-000000000001', 'Alix', 'bl_a@test.local'),
  ('a0640000-0000-4000-8000-000000000002', 'Benoît', 'bl_b@test.local'),
  ('a0640000-0000-4000-8000-000000000003', 'Clémence', 'bl_c@test.local')
ON CONFLICT (id) DO NOTHING;

-- B bloque A (B est le bloqueur).
INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('a0640000-0000-4000-8000-000000000002', 'a0640000-0000-4000-8000-000000000001');

-- 1. A (bloqué) ne peut pas ouvrir un DM vers B.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a0640000-0000-4000-8000-000000000001';
SELECT throws_ok(
  $$ SELECT public.get_or_create_direct_conversation('a0640000-0000-4000-8000-000000000002') $$,
  '42501', NULL,
  '1. La personne bloquée ne peut pas ouvrir un DM vers son bloqueur'
);

-- 2. B (bloqueur) ne peut pas ouvrir un DM vers A non plus.
SET LOCAL "request.jwt.claim.sub" = 'a0640000-0000-4000-8000-000000000002';
SELECT throws_ok(
  $$ SELECT public.get_or_create_direct_conversation('a0640000-0000-4000-8000-000000000001') $$,
  '42501', NULL,
  '2. Le bloqueur ne peut pas ouvrir un DM vers la personne bloquée'
);

-- 3. Sans blocage, la création nominale fonctionne toujours.
SET LOCAL "request.jwt.claim.sub" = 'a0640000-0000-4000-8000-000000000003';
SELECT ok(
  (SELECT public.get_or_create_direct_conversation('a0640000-0000-4000-8000-000000000001')) IS NOT NULL,
  '3. Sans blocage, le DM se crée normalement'
);

SELECT * FROM finish();
ROLLBACK;
