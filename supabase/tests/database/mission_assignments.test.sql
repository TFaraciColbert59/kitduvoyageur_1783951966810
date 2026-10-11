-- T13 — Assignations de missions : limite 3 atomique, modèles publiés
-- uniquement, remplacement/abandon sans dette, étanchéité inter-comptes.
BEGIN;
SELECT plan(17);

-- Utilisateurs de test (uuid libres : la table ne référence pas auth).
-- 'u13a' et 'u13b' via uuids fixes.
-- 1. Un modèle publié est sélectionnable.
SELECT is(
  (public.choose_progression_mission('13131313-0000-4000-8000-00000000000a'::uuid, 'mission_prep_departure_checks'))->>'ok',
  'true', 'choix d''un modèle publié accepté');

-- 2. Un modèle fermé (aucun producteur) est refusé.
SELECT is(
  (public.choose_progression_mission('13131313-0000-4000-8000-00000000000a'::uuid, 'mission_cooperation_outing'))->>'reason',
  'modele_non_publie', 'modèle non publié refusé');

-- 3. Trois actives maximum : la quatrième est refusée.
SELECT is((public.choose_progression_mission('13131313-0000-4000-8000-00000000000a'::uuid, 'mission_community_review'))->>'ok', 'true', 'deuxième mission acceptée');
SELECT is((public.choose_progression_mission('13131313-0000-4000-8000-00000000000a'::uuid, 'mission_community_carnet'))->>'ok', 'true', 'troisième mission acceptée');
SELECT is(
  (public.choose_progression_mission('13131313-0000-4000-8000-00000000000a'::uuid, 'mission_prep_kit_debrief'))->>'reason',
  'limite_atteinte', 'quatrième mission refusée (limite 3)');
SELECT is(
  (SELECT count(*)::int FROM public.progression_mission_assignments WHERE user_id = '13131313-0000-4000-8000-00000000000a'::uuid AND state = 'active'),
  3, 'exactement trois missions actives');

-- 4. Abandon sans dette : l'état change, aucune ligne XP n'apparaît.
SELECT is(
  (public.abandon_progression_mission(
    '13131313-0000-4000-8000-00000000000a'::uuid,
    (SELECT id FROM public.progression_mission_assignments WHERE user_id = '13131313-0000-4000-8000-00000000000a'::uuid AND model_id = 'mission_community_carnet' AND state = 'active')))->>'ok',
  'true', 'abandon accepté');
SELECT is(
  (public.abandon_progression_mission(
    '13131313-0000-4000-8000-00000000000a'::uuid,
    (SELECT id FROM public.progression_mission_assignments WHERE user_id = '13131313-0000-4000-8000-00000000000a'::uuid AND model_id = 'mission_community_carnet')))->>'reason',
  'assignation_introuvable', 'second abandon refusé (déjà résolue)');
SELECT is(
  (public.choose_progression_mission('13131313-0000-4000-8000-00000000000a'::uuid, 'mission_prep_kit_debrief'))->>'ok',
  'true', 'choix possible après abandon');

-- 5. Remplacement : l'ancienne passe à replaced, la nouvelle est active, le total reste 3.
SELECT is(
  (public.replace_progression_mission(
    '13131313-0000-4000-8000-00000000000a'::uuid,
    (SELECT id FROM public.progression_mission_assignments WHERE user_id = '13131313-0000-4000-8000-00000000000a'::uuid AND model_id = 'mission_prep_departure_checks' AND state = 'active'),
    'mission_discovery_first_activity'))->>'ok',
  'true', 'remplacement accepté');
SELECT is(
  (SELECT count(*)::int FROM public.progression_mission_assignments WHERE user_id = '13131313-0000-4000-8000-00000000000a'::uuid AND model_id = 'mission_prep_departure_checks' AND state = 'replaced'),
  1, 'ancienne assignation marquée remplacée');
SELECT is(
  (SELECT count(*)::int FROM public.progression_mission_assignments WHERE user_id = '13131313-0000-4000-8000-00000000000a'::uuid AND state = 'active'),
  3, 'toujours trois missions actives après remplacement');

-- 6. Étanchéité inter-comptes : A ne peut résoudre une assignation de B.
INSERT INTO public.progression_mission_assignments (user_id, model_id)
VALUES ('13131313-0000-4000-8000-00000000000b'::uuid, 'mission_community_review');
SELECT is(
  (public.abandon_progression_mission(
    '13131313-0000-4000-8000-00000000000a'::uuid,
    (SELECT id FROM public.progression_mission_assignments WHERE user_id = '13131313-0000-4000-8000-00000000000b'::uuid)))->>'reason',
  'assignation_introuvable', 'abandon inter-comptes refusé');
SELECT is(
  (public.replace_progression_mission(
    '13131313-0000-4000-8000-00000000000a'::uuid,
    (SELECT id FROM public.progression_mission_assignments WHERE user_id = '13131313-0000-4000-8000-00000000000b'::uuid),
    'mission_community_carnet'))->>'reason',
  'assignation_introuvable', 'remplacement inter-comptes refusé');
SELECT is(
  (SELECT state FROM public.progression_mission_assignments WHERE user_id = '13131313-0000-4000-8000-00000000000b'::uuid),
  'active', 'assignation de B intacte');

-- 7. Privilèges et aucune dette XP.
SELECT ok(NOT has_table_privilege('authenticated', 'public.progression_mission_assignments', 'SELECT'), 'clients sans lecture');
SELECT is(
  (SELECT count(*)::int FROM public.reward_transactions
     WHERE user_id IN ('13131313-0000-4000-8000-00000000000a'::uuid, '13131313-0000-4000-8000-00000000000b'::uuid)),
  0, 'aucune écriture XP issue des assignations');

SELECT * FROM finish();
ROLLBACK;
