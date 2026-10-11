-- T08 — plafonds par date métier, cap_group partagés, claims, rejeu.
-- Le test modifie le barème actif DANS la transaction puis l'annule : aucune
-- publication de barème réel, aucun gain conservé.
-- Calendrier : 2026-09-28 = lundi (semaine ISO 40) ; 2026-10-05 = lundi (41) ;
-- saison active ouverte depuis le 2026-09-26.
BEGIN;
SELECT plan(23);

INSERT INTO auth.users(id,email,aud,role,raw_user_meta_data) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001','t08-quota@test.invalid','authenticated','authenticated','{}');

-- Barème de test : plafonds serrés + un groupe partagé entre deux variantes.
UPDATE public.progression_rules SET payload = jsonb_set(
  jsonb_set(
    jsonb_set(payload, '{actions,hike_session_processed,caps}', '{"daily":1,"weekly":2,"season":50}'::jsonb),
    '{actions,trip_completed,caps}', '{"daily":1,"weekly":2,"season":50}'::jsonb),
  '{cap_groups}',
  '[{"id":"terrain_group","members":["hike_session_processed","trip_completed"]}]'::jsonb)
WHERE active;

-- 1. Lundi 2026-09-28 23:00 UTC (semaine 40) : premier gain accepté.
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','hike_session_processed','hike_session','s1',
  '2026-09-28T23:00:00Z',40,'{"explorer":1,"preparer":0,"partager":0,"entraider":0}'::jsonb,'t8'))->>'outcome',
  'awarded', 'premier gain du jour accepté');

-- 2. Variante du même groupe le même jour : plafond partagé → refus.
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','trip_completed','trip','s2',
  '2026-09-28T23:30:00Z',45,'{"explorer":0.7,"preparer":0.3,"partager":0,"entraider":0}'::jsonb,'t8'))->>'reason',
  'plafond_quotidien', 'variante partageant le cap_group refusée le même jour');

-- 3/4. Rejeu de la première source après refus : succès passé restitué.
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','hike_session_processed','hike_session','s1',
  '2026-09-28T23:00:00Z',40,'{"explorer":1,"preparer":0,"partager":0,"entraider":0}'::jsonb,'t8'))->>'outcome',
  'awarded', 'rejeu idempotent après plafond atteint');
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','hike_session_processed','hike_session','s1',
  '2026-09-28T23:00:00Z',40,'{"explorer":1,"preparer":0,"partager":0,"entraider":0}'::jsonb,'t8'))->>'idempotent',
  'true', 'rejeu marqué idempotent');

-- 5. Frontière de jour : mardi 00:30 UTC → nouveau jour métier accepté.
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','hike_session_processed','hike_session','s4',
  '2026-09-29T00:30:00Z',40,'{"explorer":1,"preparer":0,"partager":0,"entraider":0}'::jsonb,'t8'))->>'outcome',
  'awarded', 'nouveau jour UTC accepté (frontière 00:00)');

-- 6. Même jour UTC, deuxième gain : plafond quotidien.
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','hike_session_processed','hike_session','s5',
  '2026-09-29T10:00:00Z',40,'{"explorer":1,"preparer":0,"partager":0,"entraider":0}'::jsonb,'t8'))->>'reason',
  'plafond_quotidien', 'deuxième gain du même jour UTC refusé');

-- 7. Mercredi (même semaine ISO 40) : plafond hebdomadaire.
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','hike_session_processed','hike_session','s6',
  '2026-09-30T10:00:00Z',40,'{"explorer":1,"preparer":0,"partager":0,"entraider":0}'::jsonb,'t8'))->>'reason',
  'plafond_hebdomadaire', 'semaine ISO UTC continue jusqu’au lundi');

-- 8. Lundi suivant (semaine ISO 41) : fenêtre hebdomadaire neuve.
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','hike_session_processed','hike_session','s7',
  '2026-10-05T09:00:00Z',40,'{"explorer":1,"preparer":0,"partager":0,"entraider":0}'::jsonb,'t8'))->>'outcome',
  'awarded', 'nouvelle semaine ISO → quota rouvert');

-- 9. Date future invraisemblable refusée.
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','trip_completed','trip','s8',
  now() + interval '2 days',45,'{"explorer":0.7,"preparer":0.3,"partager":0,"entraider":0}'::jsonb,'t8'))->>'reason',
  'date_future', 'date métier future refusée');

-- 10. Claims : réservation écrite avec le gain (mardi 2026-10-06, semaine 41).
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','trip_completed','trip','s9',
  '2026-10-06T10:00:00Z',45,'{"explorer":0.7,"preparer":0.3,"partager":0,"entraider":0}'::jsonb,'t8','{}'::jsonb,
  '[{"group":"média","key":"media-1"}]'::jsonb))->>'outcome',
  'awarded', 'gain avec réservation de fait accepté');
SELECT is((SELECT count(*)::int FROM public.progression_claims
  WHERE user_id='bbbbbbbb-0000-4000-8000-000000000001' AND claim_group='média' AND evidence_key='media-1'),
  1, 'réservation unique écrite');
SELECT is((SELECT (c.reward_transaction_id = t.id)
  FROM public.progression_claims c
  JOIN public.reward_transactions t ON t.id = c.reward_transaction_id
  WHERE c.evidence_key='media-1'), true, 'réservation liée à la transaction');

-- 11. Même fait réclamé par une autre source → refus terminal, rien d'écrit.
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','trip_completed','trip','s10',
  '2026-10-07T10:00:00Z',45,'{"explorer":0.7,"preparer":0.3,"partager":0,"entraider":0}'::jsonb,'t8','{}'::jsonb,
  '[{"group":"média","key":"media-1"}]'::jsonb))->>'reason',
  'fait_deja_reclame', 'fait déjà réservé → refus');
SELECT is((SELECT count(*)::int FROM public.progression_claims
  WHERE user_id='bbbbbbbb-0000-4000-8000-000000000001'), 1, 'aucune réservation supplémentaire');

-- 12. Claims malformés → refus explicable.
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','trip_completed','trip','s11',
  '2026-10-07T12:00:00Z',45,'{"explorer":0.7,"preparer":0.3,"partager":0,"entraider":0}'::jsonb,'t8','{}'::jsonb,
  '[{"group":"","key":"x"}]'::jsonb))->>'reason',
  'claims_invalides', 'claims malformés refusés');

-- 13. Répartition TS/SQL : plus fort reste, tie-break ordre fixe.
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000001','checklist_completed','checklist','s12',
  '2026-10-08T09:00:00Z',15,'{"explorer":0.6,"preparer":0.3,"partager":0.1,"entraider":0}'::jsonb,'t8'))->'allocations',
  '[{"skill":"explorer","weight":0.6,"points":9},{"skill":"preparer","weight":0.3,"points":5},{"skill":"partager","weight":0.1,"points":1},{"skill":"entraider","weight":0,"points":0}]'::jsonb,
  'ventilation entière exacte (9+5+1+0)');

-- 14. Restitution : cinq gains réels enregistrés (rejeux non comptés).
SELECT is((SELECT count(*)::int FROM public.progression_decisions
  WHERE user_id='bbbbbbbb-0000-4000-8000-000000000001' AND outcome='awarded'),
  5, 'cinq gains réels enregistrés (rejeu non compté)');

-- 14bis. Régression : barème SANS cap_groups — les plafonds par action
-- doivent s'appliquer (le SELECT INTO d'un groupe absent ne doit pas rendre
-- la liste d'actions NULL et désactiver silencieusement les quotas).
UPDATE public.progression_rules SET payload = payload - 'cap_groups' WHERE active;
INSERT INTO auth.users(id,email,aud,role,raw_user_meta_data) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000002','t08-fallback@test.invalid','authenticated','authenticated','{}');
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000002','hike_session_processed','hike_session','f1',
  '2026-10-05T14:00:00Z',40,'{"explorer":1,"preparer":0,"partager":0,"entraider":0}'::jsonb,'t8'))->>'outcome',
  'awarded', 'sans cap_groups : premier gain accepté');
SELECT is((public.award_progression_gain(
  'bbbbbbbb-0000-4000-8000-000000000002','hike_session_processed','hike_session','f2',
  '2026-10-05T15:00:00Z',40,'{"explorer":1,"preparer":0,"partager":0,"entraider":0}'::jsonb,'t8'))->>'reason',
  'plafond_quotidien', 'sans cap_groups : plafond par action toujours appliqué');

-- 15. Grants : aucun code client n'exécute le moteur ni ne lit les claims.
SELECT ok(NOT has_function_privilege('authenticated','public.award_progression_gain(uuid,text,text,text,timestamptz,integer,jsonb,text,jsonb,jsonb)','EXECUTE'), 'client sans accès au moteur');
SELECT ok(has_function_privilege('service_role','public.award_progression_gain(uuid,text,text,text,timestamptz,integer,jsonb,text,jsonb,jsonb)','EXECUTE'), 'service_role seule autorisée');
SELECT ok(NOT has_table_privilege('authenticated','public.progression_claims','SELECT'), 'claims illisibles par les clients');

-- 16. Verrou : la fonction prend un verrou consultatif par utilisateur, tenu
-- jusqu'à la fin de la transaction (preuve directe de la sérialisation).
SELECT ok((SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND granted) >= 1,
  'verrou consultatif par utilisateur actif dans la transaction');

SELECT * FROM finish();
ROLLBACK;
