-- T12 (données) — Liaison défi → modèle de mission :
--   liaison complète sans suppression, publication limitée aux producteurs
--   disponibles, défis conservés non publiés avec raison, privilèges fermés.
BEGIN;
SELECT plan(15);

-- 1. Aucune suppression : chaque défi porte exactement une ligne de liaison.
SELECT is(
  (SELECT count(*)::int FROM public.progression_challenge_models),
  (SELECT count(*)::int FROM public.progression_challenges),
  'chaque défi porte une ligne de liaison (aucune ligne perdue)');

-- 2. Publication limitée : 5 modèles pour des producteurs disponibles.
SELECT is(
  (SELECT count(*)::int FROM public.progression_challenge_models WHERE provenance = 'canonical_v2' AND model_id IS NOT NULL),
  5, 'cinq défis publiés vers un modèle');

-- 3. Les modèles publiés sont ceux du catalogue T12, sans doublon de rattachement.
SELECT is(
  (SELECT array_agg(model_id ORDER BY model_id)::text[] FROM public.progression_challenge_models WHERE model_id IS NOT NULL),
  ARRAY['mission_community_carnet','mission_community_review','mission_discovery_first_activity','mission_prep_departure_checks','mission_prep_kit_debrief'],
  'modèles publiés = catalogue T12');

-- 4. Défis conservés non publiés : 3, avec raison explicite et sans montant promis.
SELECT is(
  (SELECT count(*)::int FROM public.progression_challenge_models WHERE provenance = 'legacy_kept'),
  3, 'trois défis conservés non publiés');
SELECT ok(
  (SELECT bool_and(model_id IS NULL AND length(coalesce(reason, '')) > 10) FROM public.progression_challenge_models WHERE provenance = 'legacy_kept'),
  'non publiés : modèle nul ET raison explicite');

-- 5. Associations historiques préservées : tout current_challenge_id existant
--    pointe toujours vers un défi réel (aucune suppression).
SELECT is(
  (SELECT count(*)::int FROM public.user_progression up
     WHERE up.current_challenge_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.progression_challenges c WHERE c.id = up.current_challenge_id)),
  0, 'aucune association orpheline après liaison');

-- 6. Versionnement présent et borné.
SELECT ok(
  (SELECT bool_and(version >= 1) FROM public.progression_challenge_models),
  'version >= 1 partout');
SELECT ok(
  (SELECT bool_and(linked_at IS NOT NULL) FROM public.progression_challenge_models),
  'horodatage de liaison présent');

-- 7. Contrainte : modèle nul ⇒ raison obligatoire (refus d'une ligne muette).
SELECT throws_ok(
  $$INSERT INTO public.progression_challenge_models (challenge_id, model_id, provenance, version) VALUES ('chal_exp_01', NULL, 'legacy_kept', 1)$$,
  '23514', NULL, 'ligne sans modèle exige une raison');

-- 8. Privilèges minimaux : clients fermés, service_role autorisé.
SELECT ok(NOT has_table_privilege('anon', 'public.progression_challenge_models', 'SELECT'), 'anon sans lecture');
SELECT ok(NOT has_table_privilege('authenticated', 'public.progression_challenge_models', 'SELECT'), 'authenticated sans lecture');
SELECT ok(has_table_privilege('service_role', 'public.progression_challenge_models', 'SELECT'), 'service_role peut lire');

-- 9. Preuve d'absence de dérive : le catalogue de défis reste de 8 lignes.
SELECT is((SELECT count(*)::int FROM public.progression_challenges), 8, 'les huit défis canoniques restent en place');
SELECT is((SELECT count(*)::int FROM public.progression_challenge_models WHERE provenance = 'canonical_v2' AND reason IS NOT NULL), 0, 'publiés sans raison parasite');
SELECT is((SELECT count(*)::int FROM public.progression_challenge_models c JOIN public.progression_challenges p ON p.id = c.challenge_id WHERE c.model_id IS NOT NULL AND p.skill IS NULL), 0, 'défis publiés portent un skill historique');

SELECT * FROM finish();
ROLLBACK;
