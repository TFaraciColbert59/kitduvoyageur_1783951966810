BEGIN;
SELECT plan(7);

-- A-214 — hygiène des grants anon.

SELECT is(
  (SELECT count(*)::int FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
     AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  0,
  '1. Aucune fonction de trigger applicative exécutable par anon (extensions exclues)'
);

SELECT is(
  (SELECT count(*)::int FROM (
     VALUES ('is_conv_admin'), ('is_conv_owner'), ('is_group_organizer'),
            ('count_trajectoire_at_scale'),
            ('get_latest_trajectoire'), ('get_latest_trajectory_plan')
   ) AS t(name)
   WHERE has_function_privilege('anon', ('public.' || t.name)::regproc, 'EXECUTE')),
  0,
  '2. Aucun prédicat interne exécutable par anon'
);

-- Contrat final documenté (hotfix 20261014080000) : trois prédicats restent
-- ouverts à anon car des policies de LECTURE PUBLIQUE (voyages partagés,
-- groupes publics) les évaluent — PostgreSQL exige EXECUTE pour la rôle
-- évaluant l'expression.
SELECT is(
  (SELECT count(*)::int FROM (
     VALUES ('can_read_trip'), ('can_edit_trip'), ('is_group_member')
   ) AS t(name)
   WHERE has_function_privilege('anon', ('public.' || t.name)::regproc, 'EXECUTE')),
  3,
  '2b. Les trois prédicats des policies publiques restent ouverts à anon (documenté)'
);

SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.get_latest_trajectoire(uuid)'::regprocedure),
  false,
  '3. get_latest_trajectoire est SECURITY INVOKER'
);

SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.get_latest_trajectory_plan(uuid)'::regprocedure),
  false,
  '4. get_latest_trajectory_plan est SECURITY INVOKER'
);

-- Les policies authentifiées conservent leurs dépendances.
SELECT ok(
  has_function_privilege('authenticated', 'public.is_conv_admin(uuid, uuid)', 'EXECUTE'),
  '5. authenticated conserve l''exécution des prédicats de policies'
);

-- Les usages publics réels restent ouverts à anon.
SELECT ok(
  has_function_privilege('anon', 'public.is_group_public(uuid)', 'EXECUTE'),
  '6. is_group_public reste accessible à anon (policies publiques)'
);

SELECT * FROM finish();
ROLLBACK;
