-- ============================================================================
-- Compas — conservation des données et revue SECURITY DEFINER (PLAN-100 1.1,
-- 2.4, 2.10).
-- ----------------------------------------------------------------------------
-- Éprouvé :
--   * `purge_retention_small_tables` : efface ce qui est expiré ou trop ancien,
--     garde le reste, n'est exécutable ni par anon ni par authenticated ;
--   * `cap_shared_caches` : au-delà du plafond, les entrées qui expirent le plus
--     tôt partent d'abord ; fermée aux clients ;
--   * invariant : toute fonction SECURITY DEFINER du schéma public a un
--     search_path verrouillé, et aucune n'est ouverte à PUBLIC si elle porte
--     le nom d'une purge.
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(26);

-- ----------------------------------------------------------------------------
-- 1 — Forme de la fonction de purge
-- ----------------------------------------------------------------------------
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'purge_retention_small_tables' AND p.prosecdef
  ),
  '1. purge_retention_small_tables existe et est SECURITY DEFINER'
);
SELECT ok(
  (SELECT bool_or(c LIKE 'search_path=%')
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace,
          LATERAL unnest(coalesce(p.proconfig, '{}'::text[])) c
    WHERE n.nspname = 'public' AND p.proname = 'purge_retention_small_tables'),
  '2. purge_retention_small_tables verrouille son search_path'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.purge_retention_small_tables(integer, integer, integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.purge_retention_small_tables(integer, integer, integer)', 'EXECUTE'),
  '3. ni anon ni authenticated ne peuvent lancer la purge'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.cap_shared_caches(integer, integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.cap_shared_caches(integer, integer)', 'EXECUTE'),
  '4. ni anon ni authenticated ne peuvent lancer le plafonnement des caches'
);

-- ----------------------------------------------------------------------------
-- 2 — Fixtures : une ligne à effacer et une à garder dans chaque table
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('c4a60000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'retention@test.local', 'x', '{}', '{}', now(), now());

INSERT INTO public.ai_response_cache (cache_key, feature, response, expires_at)
VALUES
  ('test:ret:expire', 'general', '{"t":"vieux"}', now() - interval '1 hour'),
  ('test:ret:valide', 'general', '{"t":"frais"}', now() + interval '1 day');

INSERT INTO public.ai_usage_daily (user_id, day)
VALUES
  ('c4a60000-0000-4000-8000-0000000000a1', (now() at time zone 'utc')::date - 200),
  ('c4a60000-0000-4000-8000-0000000000a1', (now() at time zone 'utc')::date);

INSERT INTO public.ai_jobs (id, user_id, feature, payload, status, created_at)
VALUES
  ('c4a60000-0000-4000-8000-0000000000c1', 'c4a60000-0000-4000-8000-0000000000a1', 'test', '{}', 'done', now() - interval '200 days'),
  ('c4a60000-0000-4000-8000-0000000000c2', 'c4a60000-0000-4000-8000-0000000000a1', 'test', '{}', 'pending', now() - interval '200 days'),
  ('c4a60000-0000-4000-8000-0000000000c3', 'c4a60000-0000-4000-8000-0000000000a1', 'test', '{}', 'done', now());

INSERT INTO public.api_credit_days (service, day, used)
VALUES
  ('test-retention', (now() at time zone 'utc')::date - 200, 5),
  ('test-retention', (now() at time zone 'utc')::date, 5);

INSERT INTO public.rate_limit_windows (key, window_start, window_ms, hits)
VALUES
  ('test:ret:close', now() - interval '3 days', 60000, 1),
  ('test:ret:ouverte', now(), 60000, 1);

INSERT INTO public.ops_daily_reports (day, db_bytes, geo_cache_rows, route_cache_rows, rate_limit_rows, anonymous_users, preparations_ok, preparations_failed)
VALUES
  ('2020-01-01', 1, 0, 0, 0, 0, 0, 0),
  ((now() at time zone 'utc')::date - 1, 1, 0, 0, 0, 0, 0, 0)
ON CONFLICT (day) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3 — La purge efface l'ancien et garde le récent
-- ----------------------------------------------------------------------------
SELECT lives_ok(
  $$ SELECT public.purge_retention_small_tables() $$,
  '5. la purge s''exécute sans erreur'
);
SELECT is((SELECT count(*)::int FROM public.ai_response_cache WHERE cache_key = 'test:ret:expire'), 0,
  '6. réponse IA expirée effacée');
SELECT is((SELECT count(*)::int FROM public.ai_response_cache WHERE cache_key = 'test:ret:valide'), 1,
  '7. réponse IA valide gardée');
SELECT is((SELECT count(*)::int FROM public.ai_usage_daily WHERE user_id = 'c4a60000-0000-4000-8000-0000000000a1'), 1,
  '8. compteur IA de plus de 90 jours effacé, celui du jour gardé');
SELECT is((SELECT count(*)::int FROM public.ai_jobs WHERE id = 'c4a60000-0000-4000-8000-0000000000c1'), 0,
  '9. tâche IA terminée depuis plus de 90 jours effacée');
SELECT is((SELECT count(*)::int FROM public.ai_jobs WHERE id = 'c4a60000-0000-4000-8000-0000000000c2'), 1,
  '10. tâche IA encore en attente gardée même ancienne');
SELECT is((SELECT count(*)::int FROM public.ai_jobs WHERE id = 'c4a60000-0000-4000-8000-0000000000c3'), 1,
  '11. tâche IA récente gardée');
SELECT is((SELECT count(*)::int FROM public.api_credit_days WHERE service = 'test-retention'), 1,
  '12. crédits de plus de 90 jours effacés, ceux du jour gardés');
SELECT is((SELECT count(*)::int FROM public.rate_limit_windows WHERE key = 'test:ret:close'), 0,
  '13. fenêtre de limite close depuis plus d''un jour effacée');
SELECT is((SELECT count(*)::int FROM public.rate_limit_windows WHERE key = 'test:ret:ouverte'), 1,
  '14. fenêtre de limite ouverte gardée');
SELECT is((SELECT count(*)::int FROM public.ops_daily_reports WHERE day = '2020-01-01'), 0,
  '15. rapport quotidien de plus de 400 jours effacé');
SELECT is((SELECT count(*)::int FROM public.ops_daily_reports WHERE day = (now() at time zone 'utc')::date - 1), 1,
  '16. rapport quotidien récent gardé');
SELECT is(
  (SELECT (public.purge_retention_small_tables() ->> 'ai_response_cache')::int),
  0,
  '17. une seconde purge n''a plus rien à effacer (idempotente)'
);

-- ----------------------------------------------------------------------------
-- 4 — Plafond des caches : les entrées qui expirent le plus tôt partent d'abord
-- ----------------------------------------------------------------------------
INSERT INTO public.route_cache (cache_key, route_mode, provider, payload, expires_at)
VALUES
  ('test:cap:a', 'hiking', 'geoapify', '{"legs":[]}', now() + interval '36500 days'),
  ('test:cap:b', 'hiking', 'geoapify', '{"legs":[]}', now() + interval '2 days'),
  ('test:cap:c', 'hiking', 'geoapify', '{"legs":[]}', now() + interval '1 day');
INSERT INTO public.geo_cache (cache_key, kind, payload, expires_at)
VALUES
  ('test:cap:a', 'place', '{}', now() + interval '36500 days'),
  ('test:cap:b', 'place', '{}', now() + interval '2 days'),
  ('test:cap:c', 'place', '{}', now() + interval '1 day');

SELECT lives_ok($$ SELECT public.cap_shared_caches(1, 1) $$, '18. le plafonnement s''exécute');
SELECT is((SELECT string_agg(cache_key, ',' ORDER BY cache_key) FROM public.route_cache WHERE cache_key LIKE 'test:cap:%'),
  'test:cap:a', '19. trajets : seule l''entrée qui expire le plus tard reste sous un plafond de 1');
SELECT is((SELECT string_agg(cache_key, ',' ORDER BY cache_key) FROM public.geo_cache WHERE cache_key LIKE 'test:cap:%'),
  'test:cap:a', '20. lieux : seule l''entrée qui expire le plus tard reste sous un plafond de 1');
SELECT is((SELECT (public.cap_shared_caches(1000, 25000) ->> 'route_cache')::int), 0,
  '21. sous le plafond, rien n''est effacé');

-- ----------------------------------------------------------------------------
-- 5 — Un client connecté ne peut lancer aucune purge
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c4a60000-0000-4000-8000-0000000000a1';
SELECT throws_ok($$ SELECT public.purge_retention_small_tables() $$, '42501',
  'permission denied for function purge_retention_small_tables',
  '22. authenticated : purge refusée');
SELECT throws_ok($$ SELECT public.cap_shared_caches(1, 1) $$, '42501',
  'permission denied for function cap_shared_caches',
  '23. authenticated : plafonnement refusé');
RESET ROLE;

-- ----------------------------------------------------------------------------
-- 6 — Invariants SECURITY DEFINER sur toute la base
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.proname)
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c WHERE c LIKE 'search_path=%')),
  NULL,
  '24. aucune fonction SECURITY DEFINER de public sans search_path verrouillé'
);
SELECT is(
  (SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.proname)
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN ('purge_geo_cache', 'purge_route_cache', 'cap_shared_caches', 'purge_hub_telemetry',
                        'purge_expired_trash_kits', 'purge_ops_preparation_events', 'purge_retention_small_tables')
      AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
  NULL,
  '25. aucune fonction de purge SECURITY DEFINER n''est ouverte à anon ou authenticated'
);
SELECT is(
  (SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.proname)
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN ('rate_limit_consume', 'take_api_credits', 'ops_daily_report', 'purge_anonymous_users', 'purge_app_errors')
      AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
  NULL,
  '26. compteurs, rapport et purges du Compas : réservés au serveur'
);

SELECT * FROM finish();
ROLLBACK;
