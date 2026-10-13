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
     VALUES ('is_conv_admin'), ('is_conv_owner'), ('is_group_organizer'), ('count_trajectoire_at_scale'),
            ('get_latest_trajectoire'), ('get_latest_trajectory_plan')
   ) AS t(name)
   WHERE has_function_privilege('anon', ('public.' || t.name)::regproc, 'EXECUTE')),
  0,
  '2. Aucun prédicat interne exécutable par anon'
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

-- 13 oct. : can_read_trip, can_edit_trip et is_group_member sont appelés par des
-- policies `TO public` (voyages publics, groupes publics) ; les fermer à anon faisait
-- échouer toute lecture d'un visiteur (`20261014080000_anon_rls_predicates_regrant`).
-- Invariant : une policy qui s'applique à anon n'appelle aucune fonction du schéma
-- public qu'anon ne peut pas exécuter. Exception connue : is_admin() dans les policies
-- des données personnelles (notifications, préférences, push), jamais lues sans compte.
SELECT is(
  (SELECT string_agg(DISTINCT pol.tablename || '.' || pol.policyname || ' → ' || p.proname, ', ')
     FROM pg_policies pol
     JOIN pg_proc p ON p.pronamespace = 'public'::regnamespace
      AND (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) ~ ('(^|[^a-z_])' || p.proname || '\(')
    WHERE pol.schemaname = 'public'
      AND ('public' = ANY(pol.roles) OR 'anon' = ANY(pol.roles))
      AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT (p.proname = 'is_admin'
               AND pol.tablename IN ('notifications', 'notification_preferences', 'push_subscriptions'))),
  NULL,
  '7. Aucune policy ouverte à anon n''appelle une fonction qu''anon ne peut pas exécuter'
);

SELECT * FROM finish();
ROLLBACK;
