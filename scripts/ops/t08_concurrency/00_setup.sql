-- T08 — préparation de la preuve de concurrence (LOCAL uniquement).
-- Joueur de test dédié, plafond quotidien resserré à 2, un gain déjà pris :
-- les deux sessions concurrentes se disputent la DERNIÈRE place du quota.
INSERT INTO auth.users(id,email,aud,role,raw_user_meta_data)
VALUES ('a0808080-0000-4000-8000-000000000001','t08-concurrence@test.invalid','authenticated','authenticated','{}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.progression_rules SET payload = jsonb_set(
  payload, '{actions,hike_session_processed,caps}', '{"daily":2,"weekly":5,"season":50}'::jsonb)
WHERE active;

-- Un gain déjà validé aujourd'hui (1/2 du quota quotidien).
SELECT public.award_progression_gain(
  'a0808080-0000-4000-8000-000000000001','hike_session_processed','hike_session','prefill',
  now() - interval '2 hours', 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}'::jsonb, 'prefill') ->> 'outcome' AS prefill_outcome;
