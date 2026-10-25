-- P1 — Sécurité : écritures clientes fermées, legacy supprimé, territoire privé clos.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(6);

SELECT is((SELECT has_table_privilege('authenticated','public.user_progression','UPDATE')), false, '1. UPDATE user_progression révoqué');
SELECT is((SELECT has_table_privilege('authenticated','public.progression_events','SELECT')), false, '2. SELECT client révoqué sur progression_events');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE tablename='user_progression' AND policyname='Public read user progression'), 0, '3. policy de lecture publique supprimée');
SELECT is((SELECT to_regprocedure('public.apply_progression_points(uuid,text,text,integer,numeric,numeric,numeric,numeric,text)') IS NULL), true, '4. RPC legacy supprimée');
SELECT is((SELECT to_regclass('public.user_territory_private') IS NOT NULL), true, '5. table territoire privé créée');
SELECT is((SELECT has_table_privilege('authenticated','public.user_territory_private','SELECT')), false, '6. coordonnées privées inaccessibles au client');

SELECT * FROM finish();
ROLLBACK;
