BEGIN;
SELECT plan(7);

-- F-009 — la vue legacy `groupes` ne doit plus inventer de métriques.

SELECT is(
  position('Alps' in pg_get_viewdef('public.groupes'::regclass, true)),
  0,
  '1. Plus de destination constante « Alps »'
);
SELECT is(
  position('18000' in pg_get_viewdef('public.groupes'::regclass, true)),
  0,
  '2. Plus de budget constant 18 000'
);
SELECT is(
  position('27.4' in pg_get_viewdef('public.groupes'::regclass, true)),
  0,
  '3. Plus de distance constante 27,4 km'
);
SELECT is(
  position('1620' in pg_get_viewdef('public.groupes'::regclass, true)),
  0,
  '4. Plus de dénivelé constant 1 620 m'
);

-- Fixture : une tribu réelle ; la vue doit exposer ses valeurs réelles et NULL
-- partout où crews ne stocke rien.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('f0090000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'crew_owner@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f0090000-0000-4000-8000-000000000001', 'Capitaine Crew', 'crew_owner@test.local')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.crews (id, name, slug, visibility, max_members, created_by, description) VALUES
  ('f009c000-0000-4000-8000-000000000001', 'Crew Test Réelle', 'crew-test-reelle', 'public', 42, 'f0090000-0000-4000-8000-000000000001', 'Description réelle')
ON CONFLICT (id) DO NOTHING;

SELECT is(
  (SELECT nom FROM public.groupes WHERE id = 'f009c000-0000-4000-8000-000000000001'),
  'Crew Test Réelle',
  '5. Le nom exposé est la valeur réelle de la tribu'
);
SELECT is(
  (SELECT places_max FROM public.groupes WHERE id = 'f009c000-0000-4000-8000-000000000001'),
  42,
  '6. La capacité exposée est la valeur réelle'
);
SELECT is(
  (SELECT progression_pct FROM public.groupes WHERE id = 'f009c000-0000-4000-8000-000000000001'),
  NULL,
  '7. Aucune progression inventée (NULL)'
);

SELECT * FROM finish();
ROLLBACK;
