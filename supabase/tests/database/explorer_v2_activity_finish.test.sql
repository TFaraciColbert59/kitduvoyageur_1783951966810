-- ============================================================================
-- Explorer v2 — fin de séance idempotente (20261111120000 + 20261112120000)
--
-- Prouve, sur PostgreSQL réel, les points que les tests statiques ne peuvent
-- pas couvrir :
--   • la clé d'idempotence est liée à la séance (clé réutilisée ⇒ conflict) ;
--   • deux clés différentes pour la même séance ne créent qu'un résumé et la
--     seconde relit celui de la première ;
--   • une séance déjà finie sans résumé connu répond already_finished et
--     n'écrit aucun `applied` sans résumé ;
--   • une ligne historique sans lien (`activity_session_id` NULL) mais avec un
--     résumé non nul est retrouvée par une autre clé ;
--   • une fin directe lie le résumé à la séance et reste retrouvable ;
--   • un client ne peut pas forger une ligne `activity.finish` ;
--   • une séance historique hors taxonomie reste fermable et sa variante est
--     recopiée dans le résumé.
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(26);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('a1f10000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'finish_a@test.local', 'x', '{}', '{}', now(), now()),
  ('a1f10000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'finish_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.activity_sessions (id, user_id, sport, variant_id, status, started_at) VALUES
  ('a1f20000-0000-4000-8000-000000000001', 'a1f10000-0000-4000-8000-000000000001', 'rando', 'rando-journee', 'live', now() - interval '1 hour'),
  ('a1f20000-0000-4000-8000-000000000002', 'a1f10000-0000-4000-8000-000000000001', 'rando', 'rando-journee', 'live', now() - interval '1 hour'),
  ('a1f20000-0000-4000-8000-000000000003', 'a1f10000-0000-4000-8000-000000000001', 'rando', 'rando-journee', 'finished', now() - interval '2 hours'),
  ('a1f20000-0000-4000-8000-000000000005', 'a1f10000-0000-4000-8000-000000000001', 'rando', 'rando-journee', 'live', now() - interval '1 hour'),
  ('a1f20000-0000-4000-8000-000000000006', 'a1f10000-0000-4000-8000-000000000001', 'rando', 'rando-journee', 'finished', now() - interval '4 hours'),
  ('a1f20000-0000-4000-8000-000000000007', 'a1f10000-0000-4000-8000-000000000001', 'rando', 'rando-journee', 'live', now() - interval '1 hour');

-- Résumé historique de la séance 6, sans lien `activity_session_id` : c'est
-- l'état que la migration ne doit ni réécrire ni perdre.
INSERT INTO public.hike_sessions (id, user_id, started_at, ended_at, distance_km, duration_seconds, processing_status, visibility) VALUES
  ('a1f30000-0000-4000-8000-000000000006', 'a1f10000-0000-4000-8000-000000000001', now() - interval '4 hours', now() - interval '3 hours', 1.2, 3600, 'pending', 'private');

-- Ligne historique de l'ancienne version : `result.sessionId` présent, résumé
-- inconnu. Elle ne doit jamais produire un `duplicate` trompeur.
INSERT INTO public.offline_sync_operations (user_id, idempotency_key, store, kind, status, result, activity_session_id) VALUES
  ('a1f10000-0000-4000-8000-000000000001', 'historical-finish-key', 'explorer', 'activity.finish', 'applied',
   '{"summaryId": null, "sessionId": "a1f20000-0000-4000-8000-000000000003"}'::jsonb, NULL),
-- Ligne historique avec un résumé non nul et une autre clé : le résumé doit
-- être retrouvé malgré `activity_session_id` NULL.
  ('a1f10000-0000-4000-8000-000000000001', 'historical-summary-key', 'explorer', 'activity.finish', 'applied',
   '{"summaryId": "a1f30000-0000-4000-8000-000000000006", "sessionId": "a1f20000-0000-4000-8000-000000000006"}'::jsonb, NULL);

-- ── Droits ──────────────────────────────────────────────────────────────────
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.finish_activity_session_idempotent(uuid,text)',
    'execute'
  ),
  '1. authenticated peut exécuter la fin idempotente'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.finish_activity_session_idempotent(uuid,text)',
    'execute'
  ),
  '2. anon ne peut pas exécuter la fin idempotente'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.explorer_sport_variants', 'select'),
  '3. authenticated lit la table de référence'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.explorer_sport_variants', 'insert'),
  '4. authenticated ne peut pas écrire la table de référence'
);

-- ── Clé liée à la séance ────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a1f10000-0000-4000-8000-000000000001';

SELECT is(
  public.finish_activity_session_idempotent(
    'a1f20000-0000-4000-8000-000000000001',
    'finish-key-one'
  ) ->> 'status',
  'applied',
  '5. la première fin applique la séance'
);

SELECT ok(
  (
    SELECT activity_session_id = 'a1f20000-0000-4000-8000-000000000001'
      FROM public.offline_sync_operations
     WHERE user_id = 'a1f10000-0000-4000-8000-000000000001'
       AND idempotency_key = 'finish-key-one'
  ),
  '6. la ligne acquittée est liée à la séance'
);

SELECT is(
  public.finish_activity_session_idempotent(
    'a1f20000-0000-4000-8000-000000000002',
    'finish-key-one'
  ) ->> 'status',
  'conflict',
  '7. la même clé pour une autre séance est un conflit'
);

SELECT is(
  (SELECT status FROM public.activity_sessions WHERE id = 'a1f20000-0000-4000-8000-000000000002'),
  'live',
  '8. la séance de la clé réutilisée reste intacte'
);

SELECT is(
  public.finish_activity_session_idempotent(
    'a1f20000-0000-4000-8000-000000000001',
    'finish-key-two'
  ) ->> 'summaryId',
  (
    SELECT result ->> 'summaryId'
      FROM public.offline_sync_operations
     WHERE user_id = 'a1f10000-0000-4000-8000-000000000001'
       AND idempotency_key = 'finish-key-one'
  ),
  '9. une seconde clé relit le résumé de la première'
);

SELECT is(
  (
    SELECT count(*)::int
      FROM public.offline_sync_operations
     WHERE user_id = 'a1f10000-0000-4000-8000-000000000001'
       AND activity_session_id = 'a1f20000-0000-4000-8000-000000000001'
       AND kind = 'activity.finish'
       AND status = 'applied'
  ),
  1,
  '10. un seul applied pour la séance'
);

SELECT is(
  public.finish_activity_session_idempotent(
    'a1f20000-0000-4000-8000-000000000003',
    'finish-key-three'
  ) ->> 'status',
  'already_finished',
  '11. une séance déjà finie sans résumé répond already_finished'
);

SELECT is(
  (
    SELECT count(*)::int
      FROM public.offline_sync_operations
     WHERE user_id = 'a1f10000-0000-4000-8000-000000000001'
       AND activity_session_id = 'a1f20000-0000-4000-8000-000000000003'
  ),
  0,
  '12. aucun applied sans résumé n''est écrit'
);

SELECT is(
  public.finish_activity_session_idempotent(
    'a1f20000-0000-4000-8000-000000000003',
    'historical-finish-key'
  ) ->> 'status',
  'already_finished',
  '13. une ligne historique sans résumé ne devient pas duplicate'
);

SELECT is(
  (
    SELECT count(*)::int
      FROM public.offline_sync_operations
     WHERE user_id = 'a1f10000-0000-4000-8000-000000000001'
       AND kind = 'activity.finish'
       AND status = 'applied'
       AND activity_session_id IS NOT NULL
       AND (result ->> 'summaryId') IS NULL
  ),
  0,
  '14. aucun nouveau applied sans summaryId'
);

-- ── Séance historique hors référentiel ──────────────────────────────────────
-- `session_replication_role = replica` permet de fabriquer une ligne antérieure
-- aux FK NOT VALID (comme la production peut en contenir). La clôture ne change
-- aucune colonne de clé : les FK ne doivent pas la refuser.
RESET ROLE;
SET LOCAL session_replication_role = replica;
INSERT INTO public.activity_sessions (id, user_id, sport, variant_id, status, started_at) VALUES
  ('a1f20000-0000-4000-8000-000000000004', 'a1f10000-0000-4000-8000-000000000001', 'marche', 'rando-legacy', 'live', now() - interval '3 hours');
SET LOCAL session_replication_role = origin;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a1f10000-0000-4000-8000-000000000001';

SELECT is(
  public.finish_activity_session_idempotent(
    'a1f20000-0000-4000-8000-000000000004',
    'finish-key-legacy'
  ) ->> 'status',
  'applied',
  '15. une séance historique hors taxonomie reste fermable'
);

SELECT is(
  (
    SELECT h.variant_id
      FROM public.hike_sessions h
     WHERE h.user_id = 'a1f10000-0000-4000-8000-000000000001'
       AND h.started_at = (
         SELECT s.started_at
           FROM public.activity_sessions s
          WHERE s.id = 'a1f20000-0000-4000-8000-000000000004'
       )
  ),
  'rando-legacy',
  '16. la variante historique est recopiée dans le résumé'
);

-- ── Résumé historique retrouvé par une autre clé ────────────────────────────
SELECT is(
  public.finish_activity_session_idempotent(
    'a1f20000-0000-4000-8000-000000000006',
    'historical-summary-key-2'
  ) ->> 'status',
  'duplicate',
  '17. une autre clé retrouve la ligne historique par result.sessionId'
);

SELECT is(
  public.finish_activity_session_idempotent(
    'a1f20000-0000-4000-8000-000000000006',
    'historical-summary-key-3'
  ) ->> 'summaryId',
  'a1f30000-0000-4000-8000-000000000006',
  '18. le résumé historique non nul est renvoyé, pas un null'
);

-- ── Fin directe puis rejeu idempotent ───────────────────────────────────────
SELECT ok(
  public.finish_activity_session('a1f20000-0000-4000-8000-000000000005') IS NOT NULL,
  '19. la fin directe sans clé crée un résumé'
);

SELECT is(
  (
    SELECT h.activity_session_id
      FROM public.hike_sessions h
     WHERE h.user_id = 'a1f10000-0000-4000-8000-000000000001'
       AND h.activity_session_id = 'a1f20000-0000-4000-8000-000000000005'
  ),
  'a1f20000-0000-4000-8000-000000000005'::uuid,
  '20. le résumé est durablement lié à la séance'
);

SELECT is(
  public.finish_activity_session_idempotent(
    'a1f20000-0000-4000-8000-000000000005',
    'finish-key-five'
  ) ->> 'status',
  'already_finished',
  '21. un rejeu idempotent retrouve la fin directe'
);

SELECT is(
  public.finish_activity_session_idempotent(
    'a1f20000-0000-4000-8000-000000000005',
    'finish-key-six'
  ) ->> 'summaryId',
  (
    SELECT h.id::text
      FROM public.hike_sessions h
     WHERE h.user_id = 'a1f10000-0000-4000-8000-000000000001'
       AND h.activity_session_id = 'a1f20000-0000-4000-8000-000000000005'
  ),
  '22. le résumé de la fin directe est renvoyé'
);

-- ── Intégrité du registre ───────────────────────────────────────────────────
SELECT throws_ok(
  $$
  INSERT INTO public.offline_sync_operations (
    user_id, idempotency_key, store, kind, status, result, activity_session_id
  ) VALUES (
    'a1f10000-0000-4000-8000-000000000001',
    'forged-finish-key',
    'explorer',
    'activity.finish',
    'applied',
    '{"summaryId":"a1f30000-0000-4000-8000-000000000006","sessionId":"a1f20000-0000-4000-8000-000000000007"}'::jsonb,
    'a1f20000-0000-4000-8000-000000000007'
  )
  $$,
  '42501',
  NULL,
  '23. un client ne peut pas écrire directement un applied activity.finish'
);

SELECT is(
  (
    SELECT count(*)::int
      FROM public.offline_sync_operations
     WHERE user_id = 'a1f10000-0000-4000-8000-000000000001'
       AND idempotency_key = 'forged-finish-key'
  ),
  0,
  '24. la ligne forgée n''existe pas'
);

RESET ROLE;
SELECT ok(
  public.activity_finish_summary_owned(
    'a1f10000-0000-4000-8000-000000000001',
    'a1f20000-0000-4000-8000-000000000006',
    'a1f30000-0000-4000-8000-000000000006'
  ),
  '25. le résumé historique appartient bien à son utilisateur'
);

SELECT ok(
  NOT public.activity_finish_summary_owned(
    'a1f10000-0000-4000-8000-000000000002',
    'a1f20000-0000-4000-8000-000000000006',
    'a1f30000-0000-4000-8000-000000000006'
  ),
  '26. le résumé d''un autre utilisateur est refusé'
);

SELECT * FROM finish();
ROLLBACK;
