-- pgTAP : controle structurel uniquement ; ne remplace pas les tests multi-utilisateurs.
BEGIN;
SELECT plan(10);
SELECT has_table('public','kit_simulation_specs','Specs presentes');
SELECT has_table('public','kit_simulation_runs','Snapshots presents');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.kit_simulation_runs'::regclass),'RLS runs active');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.kit_simulation_specs'::regclass),'RLS specs active');
SELECT ok(NOT has_table_privilege('anon','public.kit_simulation_runs','SELECT'),'Anon refuse');
SELECT ok(NOT has_table_privilege('authenticated','public.kit_simulation_runs','UPDATE'),'Snapshot non modifiable');
SELECT ok(has_table_privilege('authenticated','public.kit_simulation_runs','INSERT'),'Insertion autorisee sous RLS');
SELECT ok(has_table_privilege('authenticated','public.kit_simulation_runs','DELETE'),'Suppression personnelle sous RLS');
SELECT ok(NOT has_function_privilege('anon','public.kit_simulation_candidates(text[],integer)','EXECUTE'),'RPC anonyme refusee');
SELECT ok(has_function_privilege('authenticated','public.kit_simulation_candidates(text[],integer)','EXECUTE'),'RPC authentifiee');
SELECT * FROM finish();
ROLLBACK;
