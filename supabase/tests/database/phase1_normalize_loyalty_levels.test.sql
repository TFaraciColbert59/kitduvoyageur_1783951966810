-- Phase 1 — Incrément 5 : normalisation des niveaux de fidélité.
--   • les labels historiques non canoniques sont réalignés sur le barème
--     `legacy_loyalty_level_for` (0/500/1500/3500/7500) ;
--   • idempotence (2e appel ⇒ 0) ;
--   • privilèges : service_role uniquement.
-- Transaction annulée (ROLLBACK).
BEGIN;
SET LOCAL search_path = public;
SELECT plan(12);

-- Fixtures : 6 profils au solde connu (cas du brief + borne exacte 1500).
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaa0007-0000-4000-8000-0000000000a1','authenticated','authenticated','p1i5a@test.local','x','{}','{}',now(),now()),
  ('aaaa0007-0000-4000-8000-0000000000a2','authenticated','authenticated','p1i5b@test.local','x','{}','{}',now(),now()),
  ('aaaa0007-0000-4000-8000-0000000000a3','authenticated','authenticated','p1i5c@test.local','x','{}','{}',now(),now()),
  ('aaaa0007-0000-4000-8000-0000000000a4','authenticated','authenticated','p1i5d@test.local','x','{}','{}',now(),now()),
  ('aaaa0007-0000-4000-8000-0000000000a5','authenticated','authenticated','p1i5e@test.local','x','{}','{}',now(),now()),
  ('aaaa0007-0000-4000-8000-0000000000a6','authenticated','authenticated','p1i5f@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, loyalty_points, loyalty_level)
VALUES
  ('aaaa0007-0000-4000-8000-0000000000a1','I5 A','p1i5a@test.local', 800,  'Ambassadeur'),
  ('aaaa0007-0000-4000-8000-0000000000a2','I5 B','p1i5b@test.local', 4000, 'Découvreur'),
  ('aaaa0007-0000-4000-8000-0000000000a3','I5 C','p1i5c@test.local', 8000, 'Explorateur Elite'),
  ('aaaa0007-0000-4000-8000-0000000000a4','I5 D','p1i5d@test.local', 100,  'Aventurier'),
  ('aaaa0007-0000-4000-8000-0000000000a5','I5 E','p1i5e@test.local', 600,  'Aventurier'),
  ('aaaa0007-0000-4000-8000-0000000000a6','I5 F','p1i5f@test.local', 1500, 'Novice')
ON CONFLICT (id) DO UPDATE SET
  loyalty_points = EXCLUDED.loyalty_points,
  loyalty_level = EXCLUDED.loyalty_level;

-- Horodatage d'une ligne déjà conforme, pour prouver qu'elle n'est pas touchée.
CREATE TEMP TABLE p1_i5_ts AS
  SELECT updated_at FROM public.user_profiles WHERE id = 'aaaa0007-0000-4000-8000-0000000000a5';

-- 1. Première exécution : exactement 5 lignes corrigées (A→D + borne 1500).
SELECT is(public.phase1_normalize_loyalty_levels(), 5,
  '1. 5 niveaux historiques corrigés');

-- 2-5. Réalignement exact sur le barème.
SELECT is((SELECT loyalty_level FROM public.user_profiles WHERE id = 'aaaa0007-0000-4000-8000-0000000000a1'),
  'Aventurier', '2. 800/Ambassadeur ⇒ Aventurier');
SELECT is((SELECT loyalty_level FROM public.user_profiles WHERE id = 'aaaa0007-0000-4000-8000-0000000000a2'),
  'Guide de Montagne', '3. 4000/Découvreur ⇒ Guide de Montagne');
SELECT is((SELECT loyalty_level FROM public.user_profiles WHERE id = 'aaaa0007-0000-4000-8000-0000000000a3'),
  'Légende du Voyage', '4. 8000/Explorateur Elite ⇒ Légende du Voyage');
SELECT is((SELECT loyalty_level FROM public.user_profiles WHERE id = 'aaaa0007-0000-4000-8000-0000000000a4'),
  'Explorateur', '5. 100/Aventurier ⇒ Explorateur');
SELECT is((SELECT loyalty_level FROM public.user_profiles WHERE id = 'aaaa0007-0000-4000-8000-0000000000a6'),
  'Randonneur Expert', '6. 1500/Novice (borne exacte) ⇒ Randonneur Expert');

-- 7-8. Ligne déjà conforme : niveau ET updated_at intacts.
SELECT is((SELECT loyalty_level FROM public.user_profiles WHERE id = 'aaaa0007-0000-4000-8000-0000000000a5'),
  'Aventurier', '7. 600 déjà Aventurier : non touché');
SELECT is((SELECT updated_at FROM public.user_profiles WHERE id = 'aaaa0007-0000-4000-8000-0000000000a5'),
  (SELECT updated_at FROM p1_i5_ts), '8. updated_at inchangé pour une ligne conforme');

-- 9. Idempotence : second appel = 0 correction.
SELECT is(public.phase1_normalize_loyalty_levels(), 0,
  '9. idempotente : 2e exécution = 0 ligne corrigée');

-- 10. Toutes les fixtures sont alignées sur le barème.
SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.user_profiles
   WHERE id::text LIKE 'aaaa0007-%'
     AND loyalty_level IS DISTINCT FROM public.legacy_loyalty_level_for(GREATEST(0, COALESCE(loyalty_points, 0)))
), '10. toutes les fixtures alignées sur legacy_loyalty_level_for');

-- 11-12. Privilèges : service_role uniquement.
SELECT ok(has_function_privilege('service_role', 'public.phase1_normalize_loyalty_levels()', 'EXECUTE'),
  '11. service_role peut exécuter la fonction');
SELECT ok(NOT has_function_privilege('authenticated', 'public.phase1_normalize_loyalty_levels()', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.phase1_normalize_loyalty_levels()', 'EXECUTE'),
  '12. authenticated/anon révoqués');

SELECT * FROM finish();
ROLLBACK;
