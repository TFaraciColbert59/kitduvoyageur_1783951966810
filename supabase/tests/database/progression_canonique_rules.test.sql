-- P1 — Règles versionnées, décisions et niveau canonique.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(5);
SELECT ok(exists(SELECT 1 FROM public.progression_rules WHERE active), '1. une version de règles active');
SELECT is((SELECT level FROM public.progression_level_for(0)), 1, '2. 0 point → niveau 1');
SELECT is((SELECT level FROM public.progression_level_for(1500)), 5, '3. 1500 → niveau 5');
SELECT is((SELECT level_title FROM public.progression_level_for(20000)), 'Gardien des Horizons', '4. 20000 → titre max');
SELECT throws_ok(
  $$INSERT INTO public.progression_decisions (idempotency_key,user_id,action_type,source_type,source_id,outcome,rules_version)
    VALUES ('k','00000000-0000-0000-0000-000000000000','x','y','z','bogus','v1')$$,
  '23514', NULL, '5. issue invalide refusée');
SELECT * FROM finish();
ROLLBACK;
