-- Anti-triangulation adversarial (données synthétiques, aucune donnée réelle) :
-- seuil k-anonyme contraignant, aucun élargissement silencieux, alias scopé,
-- journal d'accès. Flag local activé uniquement dans cette transaction.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(10);
UPDATE public.feature_flags SET enabled = true WHERE id = 'local_leaderboard_active';

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT ('cccccccc-0000-4000-8000-00000000000' || i)::uuid, 'authenticated','authenticated',
       'adv-' || i || '@test.local','x','{}','{}',now(),now()
FROM generate_series(1, 8) AS i
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_season_progress (user_id, season_id, season_points)
SELECT ('cccccccc-0000-4000-8000-00000000000' || i)::uuid, 'season_2026_s1', i * 10
FROM generate_series(1, 8) AS i
ON CONFLICT (user_id, season_id) DO NOTHING;

-- Centre (u1, 45.0000) : u2..u4 ≈ 111-333 m, u5 ≈ 890 m (tous < 1000 m) ;
-- u6 ≈ 1224 m, u7 ≈ 1335 m, u8 ≈ 2226 m (tous exclus au rayon de 1000 m).
INSERT INTO public.user_territory_private (user_id, lat, lng, accuracy_m, consent_at, locked_until) VALUES
  ('cccccccc-0000-4000-8000-000000000001', 45.0000, 6.0000, 10, now(), now() + interval '1 day'),
  ('cccccccc-0000-4000-8000-000000000002', 45.0010, 6.0000, 10, now(), now() + interval '1 day'),
  ('cccccccc-0000-4000-8000-000000000003', 45.0020, 6.0000, 10, now(), now() + interval '1 day'),
  ('cccccccc-0000-4000-8000-000000000004', 45.0030, 6.0000, 10, now(), now() + interval '1 day'),
  ('cccccccc-0000-4000-8000-000000000005', 45.0080, 6.0000, 10, now(), now() + interval '1 day'),
  ('cccccccc-0000-4000-8000-000000000006', 45.0110, 6.0000, 10, now(), now() + interval '1 day'),
  ('cccccccc-0000-4000-8000-000000000007', 45.0120, 6.0000, 10, now(), now() + interval '1 day'),
  ('cccccccc-0000-4000-8000-000000000008', 45.0200, 6.0000, 10, now(), now() + interval '1 day')
ON CONFLICT (user_id) DO NOTHING;

SELECT is(
  (public.get_leaderboard('cccccccc-0000-4000-8000-000000000001','local',50))->>'total_participants',
  '5',
  '1. 5 consentis sous 1000 m (les deux à 1000+ m exclus)'
);
SELECT is(
  jsonb_array_length(public.get_leaderboard('cccccccc-0000-4000-8000-000000000001','local',50)->'rows'),
  5,
  '2. au seuil : lignes visibles'
);

-- Sous le seuil : on retire deux proches → 3 participants → masquage total.
DELETE FROM public.user_territory_private
WHERE user_id IN ('cccccccc-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000004');
SELECT is(
  (public.get_leaderboard('cccccccc-0000-4000-8000-000000000001','local',50))->>'total_participants',
  '3',
  '3. groupe retombé à 3 participants'
);
SELECT is(
  jsonb_array_length(public.get_leaderboard('cccccccc-0000-4000-8000-000000000001','local',50)->'rows'),
  0,
  '4. sous le seuil : AUCUNE ligne restituée (k-anonymat contraignant)'
);
SELECT is(
  (public.get_leaderboard('cccccccc-0000-4000-8000-000000000001','local',50))->>'rank',
  NULL,
  '5. sous le seuil : aucun rang divulgué'
);

-- Aucun élargissement silencieux : le centre se déplace, le rayon reste 1000 m.
-- u6/u7 entrent réellement dans le rayon, u8 (2226 m) reste exclu.
UPDATE public.user_territory_private SET lat = 45.0040, lng = 6.0000
WHERE user_id = 'cccccccc-0000-4000-8000-000000000001';
SELECT is(
  (public.get_leaderboard('cccccccc-0000-4000-8000-000000000001','local',50))->>'total_participants',
  '5',
  '6. rayon fixe : u2/u5/u6/u7 comptés, u8 (2226 m) toujours exclu'
);

-- Payload : aucune coordonnée, distance ou UUID.
SELECT is(
  (SELECT count(*)::int FROM jsonb_array_elements(
     public.get_leaderboard('cccccccc-0000-4000-8000-000000000001','local',50)->'rows') r
   WHERE r ? 'lat' OR r ? 'lng' OR r ? 'distance' OR r ? 'user_id' OR r ? 'accuracy_m'),
  0,
  '7. aucune clé sensible dans les lignes local'
);
SELECT is(
  strpos(public.get_leaderboard('cccccccc-0000-4000-8000-000000000001','local',50)::text, 'cccccccc-'),
  0,
  '8. aucun UUID synthétique dans le payload'
);

-- Alias scopé : local ≠ ville pour le même utilisateur.
INSERT INTO public.user_territory (user_id, country_code, region_code, city_code, city_name, source)
VALUES ('cccccccc-0000-4000-8000-000000000001','FR','84','38185','Grenoble','manual')
ON CONFLICT (user_id) DO NOTHING;
SELECT public.refresh_leaderboard_for_user('cccccccc-0000-4000-8000-000000000001','season_2026_s1');
SELECT isnt(
  (SELECT alias FROM public.progression_leaderboard_agg WHERE user_id='cccccccc-0000-4000-8000-000000000001' AND scope_type='city'),
  public.leaderboard_alias('cccccccc-0000-4000-8000-000000000001','local','','season_2026_s1'),
  '9. alias local non corrélable avec l''alias ville'
);

-- Journal d'accès : chaque consultation locale est tracée.
SELECT ok(
  (SELECT count(*) FROM public.leaderboard_access_log
   WHERE user_id = 'cccccccc-0000-4000-8000-000000000001') >= 6,
  '10. consultations locales journalisées'
);
SELECT * FROM finish();
ROLLBACK;
