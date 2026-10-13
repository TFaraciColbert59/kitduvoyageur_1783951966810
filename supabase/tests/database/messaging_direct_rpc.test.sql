BEGIN;
SELECT plan(10);

-- ----------------------------------------------------------------------------
-- F-002 — Création de discussion directe via la RPC réelle
-- Le test appelle le chemin d'entrée utilisateur (RPC), pas une insertion
-- SQL directe : c'est précisément ce chemin qui était cassé (name NOT NULL).
-- Table temporaire pour capturer les IDs : l'ordre d'évaluation des
-- sous-requêtes SQL n'est pas garanti, on matérialise chaque appel.
-- ----------------------------------------------------------------------------

CREATE TEMP TABLE _f002_ab (id uuid);
CREATE TEMP TABLE _f002_ca (id uuid);
GRANT SELECT, INSERT ON _f002_ab TO authenticated;
GRANT SELECT, INSERT ON _f002_ca TO authenticated;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('a0020000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'dm_a@test.local', 'x', '{}', '{}', now(), now()),
  ('a0020000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'dm_b@test.local', 'x', '{}', '{}', now(), now()),
  ('a0020000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'dm_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('a0020000-0000-4000-8000-000000000001', 'Alice DM', 'dm_a@test.local'),
  ('a0020000-0000-4000-8000-000000000002', 'Bruno DM', 'dm_b@test.local'),
  ('a0020000-0000-4000-8000-000000000003', 'Chloé DM', 'dm_c@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1. A crée la discussion directe avec B via la RPC réelle.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a0020000-0000-4000-8000-000000000001';

INSERT INTO _f002_ab SELECT public.get_or_create_direct_conversation('a0020000-0000-4000-8000-000000000002');

SELECT is(
  (SELECT id::text FROM _f002_ab),
  (SELECT id::text FROM public.conversations
    WHERE type = 'direct'
      AND direct_pair_key = LEAST('a0020000-0000-4000-8000-000000000001', 'a0020000-0000-4000-8000-000000000002')
        || ':' || GREATEST('a0020000-0000-4000-8000-000000000001', 'a0020000-0000-4000-8000-000000000002')),
  '1. La RPC réelle crée la conversation directe A-B (sans erreur NOT NULL)'
);

-- 2. name renseigné (contrat du schéma NOT NULL).
SELECT isnt(
  (SELECT name FROM public.conversations
    WHERE direct_pair_key = LEAST('a0020000-0000-4000-8000-000000000001', 'a0020000-0000-4000-8000-000000000002')
      || ':' || GREATEST('a0020000-0000-4000-8000-000000000001', 'a0020000-0000-4000-8000-000000000002')),
  NULL,
  '2. name de la conversation directe est renseigné'
);

-- 3. Exactement deux adhésions.
SELECT is(
  (SELECT count(*)::int FROM public.conversation_members cm
    JOIN public.conversations c ON c.id = cm.conversation_id
   WHERE c.direct_pair_key = LEAST('a0020000-0000-4000-8000-000000000001', 'a0020000-0000-4000-8000-000000000002')
        || ':' || GREATEST('a0020000-0000-4000-8000-000000000001', 'a0020000-0000-4000-8000-000000000002')),
  2,
  '3. Exactement deux adhésions créées (créateur + cible)'
);

-- 4. Rôles : owner + member.
SELECT is(
  (SELECT string_agg(cm.role, ',' ORDER BY cm.role) FROM public.conversation_members cm
    JOIN public.conversations c ON c.id = cm.conversation_id
   WHERE c.direct_pair_key = LEAST('a0020000-0000-4000-8000-000000000001', 'a0020000-0000-4000-8000-000000000002')
        || ':' || GREATEST('a0020000-0000-4000-8000-000000000001', 'a0020000-0000-4000-8000-000000000002')),
  'member,owner',
  '4. Rôles owner et member attribués'
);

-- 5. members_count = 2 (défaut du schéma).
SELECT is(
  (SELECT members_count FROM public.conversations
    WHERE direct_pair_key = LEAST('a0020000-0000-4000-8000-000000000001', 'a0020000-0000-4000-8000-000000000002')
      || ':' || GREATEST('a0020000-0000-4000-8000-000000000001', 'a0020000-0000-4000-8000-000000000002')),
  2,
  '5. members_count = 2'
);

-- 6. Second appel (A) → même discussion (idempotence).
INSERT INTO _f002_ab SELECT public.get_or_create_direct_conversation('a0020000-0000-4000-8000-000000000002');
SELECT is(
  (SELECT count(DISTINCT id)::int FROM _f002_ab),
  1,
  '6. Un second appel renvoie la même discussion'
);

-- 7. Appel par B (cible) → même discussion (paire symétrique).
SET LOCAL "request.jwt.claim.sub" = 'a0020000-0000-4000-8000-000000000002';
INSERT INTO _f002_ab SELECT public.get_or_create_direct_conversation('a0020000-0000-4000-8000-000000000001');
SELECT is(
  (SELECT count(DISTINCT id)::int FROM _f002_ab),
  1,
  '7. B obtient la même discussion en appelant la RPC (paire symétrique)'
);

-- 8. Une autre paire crée une autre discussion.
SET LOCAL "request.jwt.claim.sub" = 'a0020000-0000-4000-8000-000000000003';
INSERT INTO _f002_ca SELECT public.get_or_create_direct_conversation('a0020000-0000-4000-8000-000000000001');
SELECT isnt(
  (SELECT id::text FROM _f002_ca),
  (SELECT id::text FROM _f002_ab LIMIT 1),
  '8. La paire C-A crée une discussion distincte de A-B'
);

-- 9. Clé de paire C-A canonique.
SELECT is(
  (SELECT count(*)::int FROM public.conversations
    WHERE direct_pair_key = LEAST('a0020000-0000-4000-8000-000000000001', 'a0020000-0000-4000-8000-000000000003')
      || ':' || GREATEST('a0020000-0000-4000-8000-000000000001', 'a0020000-0000-4000-8000-000000000003')),
  1,
  '9. direct_pair_key canonique (least:greatest) pour C-A'
);

-- 10. Pas de discussion dupliquée après trois appels (vue superuser : la RLS
--     ne laisse voir à C que ses propres discussions).
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.conversations WHERE type = 'direct'),
  2,
  '10. Aucune duplication : trois appels → deux discussions distinctes'
);

SELECT * FROM finish();
ROLLBACK;
