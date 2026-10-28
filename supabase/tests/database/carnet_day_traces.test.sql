-- ============================================================================
-- Carnet par jours — table carnet_day_traces (RLS et contraintes)
--   • lecture : carnet public lisible par tous, carnet privé réservé à l'auteur
--   • écriture : l'auteur du carnet seulement ; un tiers est refusé
--   • contraintes : jour 1..30, un seul tracé par (carnet, jour), tableaux bornés
--   • suppression du carnet ⇒ cascade
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(9);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('c0de0000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'cdt_author@test.local', 'x', '{}', '{}', now(), now()),
  ('c0de0000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'cdt_other@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carnets (id, author_id, title, destination, visibility)
VALUES
  ('c0de0000-0000-4000-8000-0000000000a1', 'c0de0000-0000-4000-8000-000000000001', 'Public', 'Vercors', 'public'),
  ('c0de0000-0000-4000-8000-0000000000a2', 'c0de0000-0000-4000-8000-000000000001', 'Privé', 'Vercors', 'private');

INSERT INTO public.carnet_day_traces (carnet_id, jour_numero, coords, waypoints, snapped, distance_km)
VALUES
  ('c0de0000-0000-4000-8000-0000000000a1', 1, '[[6.0,45.0],[6.1,45.1]]', '[[6.0,45.0],[6.1,45.1]]', true, 12.5),
  ('c0de0000-0000-4000-8000-0000000000a2', 1, '[[6.0,45.0],[6.1,45.1]]', '[[6.0,45.0],[6.1,45.1]]', false, 3.0);

-- Lecture en tant que tiers authentifié
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c0de0000-0000-4000-8000-000000000002","role":"authenticated"}', true);

SELECT is((SELECT count(*)::int FROM public.carnet_day_traces WHERE carnet_id = 'c0de0000-0000-4000-8000-0000000000a1'), 1, 'CDT-01 un tiers lit le tracé d''un carnet public');
SELECT is((SELECT count(*)::int FROM public.carnet_day_traces WHERE carnet_id = 'c0de0000-0000-4000-8000-0000000000a2'), 0, 'CDT-02 un tiers ne lit pas le tracé d''un carnet privé');
SELECT throws_ok(
  $$INSERT INTO public.carnet_day_traces (carnet_id, jour_numero) VALUES ('c0de0000-0000-4000-8000-0000000000a1', 2)$$,
  '42501', NULL, 'CDT-03 un tiers ne peut pas écrire dans le carnet d''un autre');

-- Écriture en tant qu'auteur
SELECT set_config('request.jwt.claims', '{"sub":"c0de0000-0000-4000-8000-000000000001","role":"authenticated"}', true);

SELECT is((SELECT count(*)::int FROM public.carnet_day_traces WHERE carnet_id = 'c0de0000-0000-4000-8000-0000000000a2'), 1, 'CDT-04 l''auteur lit le tracé de son carnet privé');
SELECT lives_ok(
  $$INSERT INTO public.carnet_day_traces (carnet_id, jour_numero, coords) VALUES ('c0de0000-0000-4000-8000-0000000000a1', 2, '[[6.1,45.1],[6.2,45.2]]')$$,
  'CDT-05 l''auteur ajoute le tracé du jour 2');
SELECT throws_ok(
  $$INSERT INTO public.carnet_day_traces (carnet_id, jour_numero) VALUES ('c0de0000-0000-4000-8000-0000000000a1', 2)$$,
  '23505', NULL, 'CDT-06 un seul tracé par (carnet, jour)');
SELECT throws_ok(
  $$INSERT INTO public.carnet_day_traces (carnet_id, jour_numero) VALUES ('c0de0000-0000-4000-8000-0000000000a1', 31)$$,
  '23514', NULL, 'CDT-07 le jour doit être compris entre 1 et 30');
SELECT throws_ok(
  $$INSERT INTO public.carnet_day_traces (carnet_id, jour_numero, waypoints) VALUES ('c0de0000-0000-4000-8000-0000000000a1', 3, '[[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]]')$$,
  '23514', NULL, 'CDT-08 au plus 12 points d''appui');

RESET ROLE;
DELETE FROM public.carnets WHERE id = 'c0de0000-0000-4000-8000-0000000000a1';
SELECT is((SELECT count(*)::int FROM public.carnet_day_traces WHERE carnet_id = 'c0de0000-0000-4000-8000-0000000000a1'), 0, 'CDT-09 supprimer le carnet supprime ses tracés');

SELECT * FROM finish();
ROLLBACK;
