BEGIN;
SELECT plan(6);

-- F-028 — présence réelle par battement de cœur.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('f0280000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'pres_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f0280000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'pres_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f0280000-0000-4000-8000-000000000001', 'Pia', 'pres_a@test.local'),
  ('f0280000-0000-4000-8000-000000000002', 'Paul', 'pres_b@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1. A émet son battement (sa propre ligne uniquement).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0280000-0000-4000-8000-000000000001';
SELECT lives_ok(
  $$ INSERT INTO public.user_presence (user_id)
     VALUES ('f0280000-0000-4000-8000-000000000001') $$,
  '1. Un membre peut publier sa présence'
);

-- 2. Impossible d'écrire la ligne d'un autre.
SELECT throws_ok(
  $$ INSERT INTO public.user_presence (user_id)
     VALUES ('f0280000-0000-4000-8000-000000000002') $$,
  '42501', NULL,
  '2. Impossible de publier la présence d''autrui'
);

-- 3. L'horodatage est imposé par la base (une heure passée est écrasée).
SELECT isnt(
  (SELECT last_seen_at FROM public.user_presence
    WHERE user_id = 'f0280000-0000-4000-8000-000000000001'),
  TIMESTAMPTZ '2000-01-01 00:00:00+00',
  '3. last_seen_at initial est celui de la base'
);

UPDATE public.user_presence
   SET last_seen_at = TIMESTAMPTZ '2000-01-01 00:00:00+00'
 WHERE user_id = 'f0280000-0000-4000-8000-000000000001';
SELECT ok(
  (SELECT last_seen_at > now() - interval '1 minute'
     FROM public.user_presence
    WHERE user_id = 'f0280000-0000-4000-8000-000000000001'),
  '4. Un client ne peut pas antidater son battement (trigger)'
);

-- 4. Un autre membre authentifié lit la présence (id + horodatage seulement).
SET LOCAL "request.jwt.claim.sub" = 'f0280000-0000-4000-8000-000000000002';
SELECT is(
  (SELECT count(*)::int FROM public.user_presence
    WHERE user_id = 'f0280000-0000-4000-8000-000000000001'),
  1,
  '5. La présence est lisible par les membres authentifiés'
);

-- 5. Anonyme : aucun accès (aucun grant, refus explicite).
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT 1 FROM public.user_presence $$,
  '42501', NULL,
  '6. Un visiteur anonyme n''a aucun accès à la présence'
);

SELECT * FROM finish();
ROLLBACK;
