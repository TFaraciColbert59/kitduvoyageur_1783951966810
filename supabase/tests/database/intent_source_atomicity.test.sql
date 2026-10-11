BEGIN;
SELECT plan(25);

-- Fixtures : deux comptes synthétiques + les prérequis minimaux.
INSERT INTO auth.users(id,email,aud,role,raw_user_meta_data) VALUES
  ('dddddddd-0000-4000-8000-000000000001','intent-owner@test.invalid','authenticated','authenticated','{}'),
  ('dddddddd-0000-4000-8000-000000000002','intent-other@test.invalid','authenticated','authenticated','{}');

INSERT INTO public.trips(id,user_id,title,slug,status) VALUES
  ('eeeeeeee-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','Intent trip','intent-trip-1','planned');

INSERT INTO public.trip_checklist_items(id,trip_id,label,done) VALUES
  ('eeeeeeee-0000-4000-8000-000000000011','eeeeeeee-0000-4000-8000-000000000001','Contrôle A',false),
  ('eeeeeeee-0000-4000-8000-000000000012','eeeeeeee-0000-4000-8000-000000000001','Contrôle B',false);

INSERT INTO public.hike_sessions(id,user_id,started_at,ended_at,distance_km,duration_seconds,processing_status) VALUES
  ('ffffffff-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001',now()-interval '3 hours',now()-interval '1 hour',12.5,7200,'pending');

INSERT INTO public.carnets(id,author_id,visibility,title) VALUES
  ('99999999-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','private','Carnet privé');

-- 1. Aucun capteur ne crée d'intention sans transition finale.
SELECT is((SELECT count(*)::int FROM public.progression_award_intents), 0, 'aucune intention sans transition');

-- 2. Session traitée → intention unique, source et date métier portées.
UPDATE public.hike_sessions SET processing_status='processed' WHERE id='ffffffff-0000-4000-8000-000000000001';
SELECT is((SELECT count(*)::int FROM public.progression_award_intents WHERE action_type='hike_session_processed'), 1, 'session traitée → une intention');
SELECT is((SELECT user_id FROM public.progression_award_intents WHERE action_type='hike_session_processed'), 'dddddddd-0000-4000-8000-000000000001'::uuid, 'intention portée par le propriétaire');
SELECT is((SELECT business_effective_at FROM public.progression_award_intents WHERE action_type='hike_session_processed'), (SELECT ended_at FROM public.hike_sessions WHERE id='ffffffff-0000-4000-8000-000000000001'), 'date métier = fin de session');

-- 3. Même transition rejouée → toujours une seule intention (idempotence).
UPDATE public.hike_sessions SET processing_status='pending' WHERE id='ffffffff-0000-4000-8000-000000000001';
UPDATE public.hike_sessions SET processing_status='processed' WHERE id='ffffffff-0000-4000-8000-000000000001';
SELECT is((SELECT count(*)::int FROM public.progression_award_intents WHERE action_type='hike_session_processed'), 1, 'aller-retour → aucune intention double');

-- 4. Atomicité : une transition annulée ne laisse pas d'intention.
-- (Savepoint : pgTAP exécute ce fichier dans une transaction englobante.)
SAVEPOINT intent_atomicity;
UPDATE public.hike_sessions SET processing_status='pending' WHERE id='ffffffff-0000-4000-8000-000000000001';
ROLLBACK TO SAVEPOINT intent_atomicity;
SELECT is((SELECT count(*)::int FROM public.progression_award_intents WHERE action_type='hike_session_processed'), 1, 'rollback de la source annule l''intention (aucune nouvelle)');

-- 5. Carnet : privé = rien, publié = une intention.
SELECT is((SELECT count(*)::int FROM public.progression_award_intents WHERE action_type='carnet_published'), 0, 'carnet privé → rien');
UPDATE public.carnets SET visibility='public' WHERE id='99999999-0000-4000-8000-000000000001';
SELECT is((SELECT count(*)::int FROM public.progression_award_intents WHERE action_type='carnet_published'), 1, 'carnet publié → une intention');

-- 6. Checklist (voyage encore en préparation) : incomplète = rien ; complète = une intention.
-- Le trigger de seed peut ajouter des items de gabarit : on normalise d'abord.
UPDATE public.trip_checklist_items SET done=false, done_at=NULL WHERE trip_id='eeeeeeee-0000-4000-8000-000000000001';
SELECT is((SELECT count(*)::int FROM public.progression_award_intents WHERE action_type='checklist_completed'), 0, 'checklist incomplète → rien');
UPDATE public.trip_checklist_items SET done=true, done_at=now()-interval '2 hours'
 WHERE trip_id='eeeeeeee-0000-4000-8000-000000000001' AND id <> 'eeeeeeee-0000-4000-8000-000000000012';
SELECT is((SELECT count(*)::int FROM public.progression_award_intents WHERE action_type='checklist_completed'), 0, 'un item restant → rien');
UPDATE public.trip_checklist_items SET done=true, done_at=now()-interval '1 hour' WHERE id='eeeeeeee-0000-4000-8000-000000000012';
SELECT is((SELECT count(*)::int FROM public.progression_award_intents WHERE action_type='checklist_completed'), 1, 'tous les items → une intention');

-- 7. Voyage terminé → intention.
UPDATE public.trips SET status='completed', updated_at=now() WHERE id='eeeeeeee-0000-4000-8000-000000000001';
SELECT is((SELECT count(*)::int FROM public.progression_award_intents WHERE action_type='trip_completed'), 1, 'voyage terminé → une intention');

-- 8. Débrief kit : session non traitée d'un autre compte = rien.
INSERT INTO public.materiel_kits(id,user_id,name) VALUES
  ('55555555-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','Kit test intents');
INSERT INTO public.kit_field_reports(id,user_id,kit_id,hike_session_id,item_key,verdict) VALUES
  ('88888888-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000002','55555555-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','item-1','utile');
SELECT is((SELECT count(*)::int FROM public.progression_award_intents WHERE action_type='kit_field_report'), 0, 'débrief d''un autre compte → rien');
INSERT INTO public.kit_field_reports(id,user_id,kit_id,hike_session_id,item_key,verdict) VALUES
  ('88888888-0000-4000-8000-000000000002','dddddddd-0000-4000-8000-000000000001','55555555-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','item-2','utile');
SELECT is((SELECT count(*)::int FROM public.progression_award_intents WHERE action_type='kit_field_report'), 1, 'débrief du propriétaire sur session traitée → une intention');
SELECT ok((SELECT available_at >= created_at + interval '19 minutes' FROM public.progression_award_intents WHERE action_type='kit_field_report'),
  'débrief : réservation différée (finalisation, pas premier item)');

-- 9. Avis de lieu → clé auteur:lieu exactement comme l'attribution.
INSERT INTO public.countries_geo(iso_a2,name) VALUES ('FR','France') ON CONFLICT (iso_a2) DO NOTHING;
INSERT INTO public.places(id,slug,name,category,country_code,latitude,longitude) VALUES
  ('66666666-0000-4000-8000-000000000001','intent-lieu-1','Lieu test intents','refuge','FR',45.1,6.1);
INSERT INTO public.place_reviews(id,author_id,place_id,rating,comment) VALUES
  ('77777777-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','66666666-0000-4000-8000-000000000001',5,'Super lieu');
SELECT is((SELECT source_id FROM public.progression_award_intents WHERE action_type='place_review'), 'dddddddd-0000-4000-8000-000000000001:66666666-0000-4000-8000-000000000001', 'clé auteur:lieu');

-- 10. Contraintes d'état et d'unicité de la table.
SELECT throws_ok($$INSERT INTO public.progression_award_intents(user_id,action_type,source_type,source_id,state) VALUES ('dddddddd-0000-4000-8000-000000000001','x','y','z','exploded')$$, '23514', NULL, 'état invalide refusé');
SELECT throws_ok($$INSERT INTO public.progression_award_intents(user_id,action_type,source_type,source_id) VALUES ('dddddddd-0000-4000-8000-000000000001','trip_completed','trip','eeeeeeee-0000-4000-8000-000000000001')$$, '23505', NULL, 'même réalisation refusée en doublon');

-- 11. Grants : les clients n'accèdent jamais aux intentions.
SELECT ok(NOT has_table_privilege('anon','public.progression_award_intents','SELECT'), 'anon sans lecture');
SELECT ok(NOT has_table_privilege('authenticated','public.progression_award_intents','SELECT'), 'authenticated sans lecture');
SELECT ok(NOT has_function_privilege('authenticated','public.enqueue_progression_award_intent(uuid,text,text,text,timestamptz,jsonb,integer)','EXECUTE'), 'client sans écriture d''intention');
SELECT ok(has_function_privilege('service_role','public.enqueue_progression_award_intent(uuid,text,text,text,timestamptz,jsonb,integer)','EXECUTE'), 'service_role peut écrire une intention');

-- 12. La fonction d'enqueue est idempotente par réalisation.
SELECT is(public.enqueue_progression_award_intent('dddddddd-0000-4000-8000-000000000001','trail_prepared','trail_prep','dddddddd-0000-4000-8000-000000000001:route-42',now()), true, 'première intention acceptée');
SELECT is(public.enqueue_progression_award_intent('dddddddd-0000-4000-8000-000000000001','trail_prepared','trail_prep','dddddddd-0000-4000-8000-000000000001:route-42',now()), false, 'rejeu refusé sans doublon');
SELECT is((SELECT count(*)::int FROM public.progression_award_intents WHERE source_type='trail_prep'), 1, 'une seule intention de préparation');

SELECT * FROM finish();
ROLLBACK;
