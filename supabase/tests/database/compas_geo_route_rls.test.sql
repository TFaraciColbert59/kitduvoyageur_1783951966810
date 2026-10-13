-- ============================================================================
-- Compas — `geo_cache` et `route_cache` (PLAN-100 2.4) : caches partagés du
-- serveur (lieux, trajets, altitudes ; traces de routage), réservés à la clé
-- de service. Aucun client, quel que soit son rôle sur un voyage, ne doit les
-- lire ni les écrire : un utilisateur qui écrirait dans le cache empoisonnerait
-- les réponses de tous les autres (trace « mesurée » inventée, lieu faux).
-- ----------------------------------------------------------------------------
-- Éprouvé : anonyme, connecté (propriétaire de voyage, lecteur) -> refusé sur
-- les tables et sur les fonctions ; service_role -> lit, écrit, purge.
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(38);

-- ----------------------------------------------------------------------------
-- 1 — Forme : RLS active ; aucune politique de lecture ouverte
-- ----------------------------------------------------------------------------
SELECT ok(
  (SELECT bool_and(c.relrowsecurity) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('geo_cache', 'route_cache')),
  '1. RLS active sur geo_cache et route_cache'
);
SELECT is(
  (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'geo_cache'),
  0,
  '2. geo_cache : aucune politique (seule la clé de service, qui contourne la RLS, y accède)'
);
SELECT is(
  (SELECT string_agg(policyname || ':' || cmd || ':' || qual, ',' ORDER BY policyname)
     FROM pg_policies WHERE schemaname = 'public' AND tablename = 'route_cache'),
  'route_cache_select_false:SELECT:false',
  '3. route_cache : une seule politique, SELECT false'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.geo_cache', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.geo_cache', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.route_cache', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.route_cache', 'SELECT'),
  '4. anon et authenticated n''ont aucun droit de lecture sur les deux tables'
);
SELECT ok(
  has_table_privilege('service_role', 'public.geo_cache', 'SELECT,INSERT,UPDATE,DELETE')
  AND has_table_privilege('service_role', 'public.route_cache', 'SELECT,INSERT,UPDATE,DELETE'),
  '5. service_role lit et écrit les deux tables'
);

-- ----------------------------------------------------------------------------
-- Fixtures : un propriétaire de voyage (A) et son lecteur (V)
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('c4a50000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'cache_a@test.local', 'x', '{}', '{}', now(), now()),
  ('c4a50000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'cache_v@test.local', 'x', '{}', '{}', now(), now());
INSERT INTO public.trips (id, slug, title, user_id, visibility)
VALUES ('c4a50000-0000-4000-8000-0000000000b1', 'rls-cache-prive', 'Voyage privé P', 'c4a50000-0000-4000-8000-0000000000a1', 'private');
INSERT INTO public.trip_collaborators (trip_id, user_id, role, invited_by)
VALUES ('c4a50000-0000-4000-8000-0000000000b1', 'c4a50000-0000-4000-8000-0000000000a3', 'viewer', 'c4a50000-0000-4000-8000-0000000000a1');

-- Une entrée valide et une entrée expirée dans chaque cache (propriétaire de la base).
INSERT INTO public.geo_cache (cache_key, kind, payload, expires_at)
VALUES
  ('test:geo:valide', 'place', '{"name":"Gresse-en-Vercors"}', now() + interval '1 day'),
  ('test:geo:expire', 'place', '{"name":"Ancien"}', now() - interval '1 day');
INSERT INTO public.route_cache (cache_key, route_mode, provider, payload, expires_at)
VALUES
  ('test:route:valide', 'hiking', 'geoapify', '{"legs":[{"km":4.2}]}', now() + interval '1 day'),
  ('test:route:expire', 'hiking', 'geoapify', '{"legs":[{"km":9.9}]}', now() - interval '1 day');

-- ============================================================================
-- Anonyme
-- ============================================================================
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '';

SELECT throws_ok($$ SELECT * FROM public.geo_cache $$, '42501', 'permission denied for table geo_cache',
  '6. anonyme ne lit pas geo_cache');
SELECT throws_ok($$ INSERT INTO public.geo_cache (cache_key, kind, payload, expires_at) VALUES ('test:geo:anon', 'place', '{"name":"Faux"}', now() + interval '1 day') $$,
  '42501', 'permission denied for table geo_cache', '7. anonyme n''écrit pas dans geo_cache');
SELECT throws_ok($$ SELECT * FROM public.route_cache $$, '42501', 'permission denied for table route_cache',
  '8. anonyme ne lit pas route_cache');
SELECT throws_ok($$ INSERT INTO public.route_cache (cache_key, route_mode, payload, expires_at) VALUES ('test:route:anon', 'hiking', '{"legs":[]}', now() + interval '1 day') $$,
  '42501', 'permission denied for table route_cache', '9. anonyme n''écrit pas dans route_cache');
SELECT throws_ok($$ SELECT public.purge_geo_cache() $$, '42501', 'permission denied for function purge_geo_cache',
  '10. anonyme ne purge pas geo_cache');
SELECT throws_ok($$ SELECT public.get_route_cache('test:route:valide') $$, '42501', 'permission denied for function get_route_cache',
  '11. anonyme ne lit pas une trace par get_route_cache');
SELECT throws_ok($$ SELECT public.set_route_cache('test:route:anon', 'hiking', '{"legs":[]}'::jsonb, 'inventé', 3600) $$, '42501', 'permission denied for function set_route_cache',
  '12. anonyme n''écrit pas une trace par set_route_cache');
SELECT throws_ok($$ SELECT public.purge_route_cache() $$, '42501', 'permission denied for function purge_route_cache',
  '13. anonyme ne purge pas route_cache');

-- ============================================================================
-- Connecté, propriétaire du voyage (A) puis lecteur (V) : le rôle sur un
-- voyage n'ouvre rien sur les caches
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c4a50000-0000-4000-8000-0000000000a1';

SELECT throws_ok($$ SELECT * FROM public.geo_cache $$, '42501', 'permission denied for table geo_cache',
  '14. A (propriétaire d''un voyage) ne lit pas geo_cache');
SELECT throws_ok($$ INSERT INTO public.geo_cache (cache_key, kind, payload, expires_at) VALUES ('test:geo:a', 'place', '{"name":"Faux"}', now() + interval '1 day') $$,
  '42501', 'permission denied for table geo_cache', '15. A n''écrit pas dans geo_cache');
SELECT throws_ok($$ DELETE FROM public.geo_cache $$, '42501', 'permission denied for table geo_cache',
  '16. A ne vide pas geo_cache');
SELECT throws_ok($$ SELECT * FROM public.route_cache $$, '42501', 'permission denied for table route_cache',
  '17. A ne lit pas route_cache');
SELECT throws_ok($$ UPDATE public.route_cache SET payload = '{"legs":[{"km":0}]}' $$, '42501', 'permission denied for table route_cache',
  '18. A ne réécrit pas une trace mesurée');
SELECT throws_ok($$ SELECT public.purge_geo_cache() $$, '42501', 'permission denied for function purge_geo_cache',
  '19. A ne purge pas geo_cache');
SELECT throws_ok($$ SELECT public.set_route_cache('test:route:a', 'hiking', '{"legs":[]}'::jsonb, 'inventé', 3600) $$, '42501', 'permission denied for function set_route_cache',
  '20. A n''écrit pas une trace par set_route_cache');

SET LOCAL "request.jwt.claim.sub" = 'c4a50000-0000-4000-8000-0000000000a3';

SELECT throws_ok($$ SELECT * FROM public.geo_cache $$, '42501', 'permission denied for table geo_cache',
  '21. V (lecteur) ne lit pas geo_cache');
SELECT throws_ok($$ SELECT public.get_route_cache('test:route:valide') $$, '42501', 'permission denied for function get_route_cache',
  '22. V ne lit pas une trace par get_route_cache');
SELECT throws_ok($$ INSERT INTO public.route_cache (cache_key, route_mode, payload, expires_at) VALUES ('test:route:v', 'hiking', '{"legs":[]}', now() + interval '1 day') $$,
  '42501', 'permission denied for table route_cache', '23. V n''écrit pas dans route_cache');

-- ============================================================================
-- service_role : lit, écrit, purge
-- ============================================================================
SET LOCAL ROLE service_role;
SET LOCAL "request.jwt.claim.sub" = '';

SELECT is(
  (SELECT payload ->> 'name' FROM public.geo_cache WHERE cache_key = 'test:geo:valide'),
  'Gresse-en-Vercors',
  '24. service_role lit une entrée de geo_cache'
);
SELECT lives_ok(
  $$ INSERT INTO public.geo_cache (cache_key, kind, payload, expires_at) VALUES ('test:geo:service', 'leg', '{"km":4.2}', now() + interval '1 hour') $$,
  '25. service_role écrit dans geo_cache'
);
SELECT throws_ok(
  $$ INSERT INTO public.geo_cache (cache_key, kind, payload, expires_at) VALUES ('test:geo:mauvais', 'inconnu', '{}', now() + interval '1 hour') $$,
  '23514',
  NULL,
  '26. geo_cache refuse un genre hors liste (place, reverse, leg, elevation, stages)'
);
SELECT is(
  (SELECT public.purge_geo_cache()),
  1,
  '27. purge_geo_cache supprime les entrées expirées (une seule ici) et en rend le nombre'
);
SELECT is(
  (SELECT count(*)::int FROM public.geo_cache WHERE cache_key LIKE 'test:geo:%'),
  2,
  '28. il reste les deux entrées valides (valide, service) après la purge'
);

SELECT is(
  (SELECT public.get_route_cache('test:route:valide') -> 'legs' -> 0 ->> 'km'),
  '4.2',
  '29. get_route_cache rend la trace encore valide'
);
SELECT is(
  (SELECT hit_count FROM public.route_cache WHERE cache_key = 'test:route:valide'),
  1,
  '30. get_route_cache compte la lecture (hit_count)'
);
SELECT is(
  (SELECT public.get_route_cache('test:route:expire')),
  NULL::jsonb,
  '31. une trace expirée est rendue comme absente'
);
SELECT is_empty(
  $$ SELECT cache_key FROM public.route_cache WHERE cache_key = 'test:route:expire' $$,
  '32. get_route_cache supprime au passage la trace expirée'
);
SELECT lives_ok(
  $$ SELECT public.set_route_cache('test:route:neuve', 'cycling', '{"legs":[{"km":12.5}]}'::jsonb, 'valhalla', 0) $$,
  '33. set_route_cache écrit une trace avec son fournisseur'
);
SELECT ok(
  (SELECT expires_at > now() + interval '50 seconds' AND provider = 'valhalla'
     FROM public.route_cache WHERE cache_key = 'test:route:neuve'),
  '34. set_route_cache applique le plancher de 60 s au TTL (0 demandé) et garde le fournisseur'
);
SELECT throws_ok(
  $$ SELECT public.set_route_cache('test:route:tableau', 'cycling', '[1,2]'::jsonb, 'valhalla', 3600) $$,
  '23514',
  NULL,
  '35. set_route_cache refuse un contenu qui n''est pas un objet'
);
SELECT lives_ok(
  $$ INSERT INTO public.route_cache (cache_key, route_mode, payload, expires_at) VALUES ('test:route:vieux', 'hiking', '{"legs":[]}', now() - interval '2 days') $$,
  '36. service_role insère une trace déjà expirée (cas de la purge)'
);
SELECT ok(
  (SELECT public.purge_route_cache()) >= 1,
  '37. purge_route_cache supprime les traces expirées'
);
SELECT is_empty(
  $$ SELECT cache_key FROM public.route_cache WHERE expires_at <= now() $$,
  '38. plus aucune trace expirée ne reste dans route_cache'
);

SELECT * FROM finish();
ROLLBACK;
