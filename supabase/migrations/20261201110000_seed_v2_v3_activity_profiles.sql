-- ============================================================================
-- Lot 10 & Lot 11 — Seed SQL des 36 Activités V2 Spécialisées (29) + V3 Pro (7)
-- dans `public.explorer_sport_variants` (complète le socle de 49 activités).
-- Aligné 100 % sur le schéma `20261201090000` et strictement idempotent.
-- ============================================================================

begin;

insert into public.explorer_sport_variants (
  sport, variant_id, canonical_slug, legacy_slug_aliases,
  family_id, pipeline_id, rollout_wave, spec_version,
  rgpd_art9_sensitive, leaderboard_eligible,
  fit_sport, fit_sub_sport, hk_activity_type, strava_sport_type,
  profile_spec, is_active
) values
  -- ── V2 SPECIALIZED (29) ──
  ('trail',    'trail-ultra',        'ultra_trail',             array['trail-ultra','ultra-trail','ultra'],                         'running_trail',          'gps_baro_alpine', 'V2_SPECIALIZED',  '2.0.0', false, true,  1,  3,  'running',                       'TrailRun',         '{"rollover8h":true,"primarySpeedUnit":"min_per_km"}'::jsonb, true),
  ('rando',    'marche-nordique',    'nordic_walking',          array['marche-nordique','nordic-walking'],                          'hiking_trekking',        'gps_outdoor',     'V2_SPECIALIZED',  '2.0.0', false, true,  11, 27, 'walking',                       'Walk',             '{"primarySpeedUnit":"km_per_h"}'::jsonb, true),
  ('escalade', 'escalade-falaise',   'rock_climbing_outdoor',   array['escalade-falaise','escalade-grande-voie','escalade'],        'alpinism_vertical',      'gps_baro_alpine', 'V2_SPECIALIZED',  '2.0.0', false, false, 31, 0,  'climbing',                      'RockClimbing',     '{"epi":"EN892","primarySpeedUnit":"duration_only"}'::jsonb, true),
  ('escalade', 'escalade-bloc',      'bouldering',              array['escalade-bloc','bloc','bouldering'],                         'alpinism_vertical',      'indoor_no_gps',   'V2_SPECIALIZED',  '2.0.0', false, false, 31, 68, 'climbing',                      'RockClimbing',     '{"primarySpeedUnit":"duration_only"}'::jsonb, true),
  ('escalade', 'via-ferrata',        'via_ferrata',             array['via-ferrata'],                                               'alpinism_vertical',      'gps_baro_alpine', 'V2_SPECIALIZED',  '2.0.0', false, false, 31, 0,  'climbing',                      'RockClimbing',     '{"epi":"EN958","primarySpeedUnit":"m_per_h_vam"}'::jsonb, true),
  ('escalade', 'canyoning',          'canyoning',               array['canyoning'],                                                 'alpinism_vertical',      'gps_baro_alpine', 'V2_SPECIALIZED',  '2.0.0', false, false, 17, 0,  'waterSports',                   'Workout',          '{"epi":"EN1891","ffme":true}'::jsonb, true),
  ('escalade', 'speleologie',        'speleologie',             array['speleologie','speleo'],                                      'alpinism_vertical',      'indoor_no_gps',   'V2_SPECIALIZED',  '2.0.0', false, false, 31, 0,  'climbing',                      'Workout',          '{"ffs":true}'::jsonb, true),
  ('trail',    'course-orientation', 'course_orientation',      array['course-orientation','orientation'],                          'running_trail',          'gps_baro_alpine', 'V2_SPECIALIZED',  '2.0.0', false, true,  1,  3,  'running',                       'TrailRun',         '{"primarySpeedUnit":"min_per_km"}'::jsonb, true),
  ('ski',      'ski-alpin',          'alpine_ski',              array['ski-alpin','ski_alpin'],                                     'snow_winter',            'gps_baro_alpine', 'V2_SPECIALIZED',  '2.0.0', false, true,  13, 0,  'downhillSkiing',                'AlpineSki',        '{"liftDetection":true,"view":"ski_runs_lifts"}'::jsonb, true),
  ('ski',      'snowboard',          'snowboard',               array['snowboard'],                                                 'snow_winter',            'gps_baro_alpine', 'V2_SPECIALIZED',  '2.0.0', false, true,  14, 0,  'snowboarding',                  'Snowboard',        '{"liftDetection":true,"view":"ski_runs_lifts"}'::jsonb, true),
  ('ski',      'splitboard',         'splitboard',              array['splitboard'],                                                'snow_winter',            'gps_baro_alpine', 'V2_SPECIALIZED',  '2.0.0', false, true,  14, 37, 'snowboarding',                  'BackcountrySki',   '{"skinsCycles":40}'::jsonb, true),
  ('ski',      'ski-fond',           'nordic_ski',              array['ski-fond','ski_fond','nordic_ski_classic','nordic_ski_skating'], 'snow_winter',        'gps_baro_alpine', 'V2_SPECIALIZED',  '2.0.0', false, true,  12, 0,  'crossCountrySkiing',            'NordicSki',        '{"primarySpeedUnit":"km_per_h"}'::jsonb, true),
  ('velo',     'vtt-enduro',         'mtb_enduro_dh',           array['vtt-enduro','vtt-dh','enduro','dh'],                         'cycling_mobility',       'gps_baro_alpine', 'V2_SPECIALIZED',  '2.0.0', false, true,  2,  8,  'cycling',                       'MountainBikeRide', '{"liftDetection":true,"forkFoxH":125,"forkRockshoxH":200}'::jsonb, true),
  ('velo',     'vae-route',          'ebike_road_trek',         array['vae-route','vae','ebike'],                                   'cycling_mobility',       'gps_outdoor',     'V2_SPECIALIZED',  '2.0.0', false, true,  2,  28, 'cycling',                       'EBikeRide',        '{"electricIsolated":true}'::jsonb, true),
  ('velo',     'vtt-ae',             'emtb',                    array['vtt-ae','vttae','emtb'],                                     'cycling_mobility',       'gps_baro_alpine', 'V2_SPECIALIZED',  '2.0.0', false, true,  2,  28, 'cycling',                       'EMountainBikeRide','{"electricIsolated":true}'::jsonb, true),
  ('kayak',    'natation-piscine',   'swim_pool',               array['natation-piscine','natation','piscine'],                     'swimming_aquatic',       'indoor_no_gps',   'V2_SPECIALIZED',  '2.0.0', false, true,  5,  17, 'swimming',                      'Swim',             '{"swolf":true,"primarySpeedUnit":"min_per_100m","view":"pool_laps_swolf"}'::jsonb, true),
  ('kayak',    'natation-eau-libre', 'swim_open_water',         array['natation-eau-libre','eau-libre'],                            'swimming_aquatic',       'gps_water',       'V2_SPECIALIZED',  '2.0.0', false, true,  5,  18, 'swimming',                      'Swim',             '{"cross196":true,"primarySpeedUnit":"min_per_100m"}'::jsonb, true),
  ('kayak',    'kayak-mer',          'kayak_sea_lake',          array['kayak-mer','kayak'],                                         'nautical_wind_glide',    'gps_water',       'V2_SPECIALIZED',  '2.0.0', false, true,  41, 0,  'paddleSports',                  'Kayaking',         '{"cross196":true,"primarySpeedUnit":"knots"}'::jsonb, true),
  ('kayak',    'kayak-riviere',      'kayak_whitewater',        array['kayak-riviere','rafting'],                                   'nautical_wind_glide',    'gps_water',       'V2_SPECIALIZED',  '2.0.0', false, true,  41, 0,  'paddleSports',                  'Kayaking',         '{"primarySpeedUnit":"km_per_h"}'::jsonb, true),
  ('kayak',    'stand-up-paddle',    'stand_up_paddle',         array['stand-up-paddle','sup'],                                     'nautical_wind_glide',    'gps_water',       'V2_SPECIALIZED',  '2.0.0', false, true,  37, 0,  'paddleSports',                  'StandUpPaddling',  '{"cross196":true}'::jsonb, true),
  ('course',   'course-tapis',       'treadmill_running',       array['course-tapis','tapis','treadmill'],                          'indoor_strength_cardio', 'indoor_no_gps',   'V2_SPECIALIZED',  '2.0.0', false, true,  1,  1,  'running',                       'Run',              '{"ftms":"0x1826","primarySpeedUnit":"min_per_km"}'::jsonb, true),
  ('velo',     'velo-home-trainer',  'indoor_cycling',          array['velo-home-trainer','velo-virtuel','home-trainer','zwift'],   'indoor_strength_cardio', 'indoor_no_gps',   'V2_SPECIALIZED',  '2.0.0', false, true,  2,  6,  'cycling',                       'VirtualRide',      '{"ftms":"0x1826","primarySpeedUnit":"watts"}'::jsonb, true),
  ('famille',  'musculation',        'strength_weights',        array['musculation','musculation-fonctionnelle','crossfit-hyrox'],  'indoor_strength_cardio', 'indoor_no_gps',   'V2_SPECIALIZED',  '2.0.0', false, false, 10, 20, 'traditionalStrengthTraining',   'WeightTraining',   '{"view":"strength_logger_hevy","primarySpeedUnit":"reps_tonnage"}'::jsonb, true),
  ('famille',  'hiit-interval',      'hiit_cardio',             array['hiit-interval','elliptique-stepper','corde-a-sauter','hiit'],'indoor_strength_cardio', 'indoor_no_gps',   'V2_SPECIALIZED',  '2.0.0', false, false, 62, 0,  'highIntensityIntervalTraining', 'HIIT',             '{"primarySpeedUnit":"duration_only"}'::jsonb, true),
  ('famille',  'yoga',               'yoga_pilates',            array['yoga','pilates-barre','mobilite-etirements','pilates'],      'rehab_wellness',         'indoor_no_gps',   'V2_SPECIALIZED',  '2.0.0', false, false, 10, 43, 'yoga',                          'Yoga',             '{"primarySpeedUnit":"duration_only"}'::jsonb, true),
  ('famille',  'rehab-mobilite',     'rehab_physio_mobility',   array['rehab-mobilite','rehab-velo-doux','rehab-aquatique'],        'rehab_wellness',         'indoor_no_gps',   'V2_SPECIALIZED',  '2.0.0', true,  false, 10, 0,  'flexibility',                   'Workout',          '{"rgpdArt9":true,"aiAllowed":false,"defaultVisibility":"private"}'::jsonb, true),
  ('rando',    'rehab-marche',       'rehab_physio_walk',       array['rehab-marche'],                                              'rehab_wellness',         'gps_outdoor',     'V2_SPECIALIZED',  '2.0.0', true,  false, 11, 0,  'walking',                       'Walk',             '{"rgpdArt9":true,"aiAllowed":false,"defaultVisibility":"private"}'::jsonb, true),
  ('velo',     'fauteuil-handbike',  'wheelchair_handbike',     array['fauteuil-handbike','handbike','wheelchair'],                 'cycling_mobility',       'gps_outdoor',     'V2_SPECIALIZED',  '2.0.0', false, true,  2,  12, 'wheelchairRunPace',             'Handcycle',        '{"primarySpeedUnit":"km_per_h"}'::jsonb, true),
  ('trail',    'triathlon-duathlon', 'multisport_enchainement', array['triathlon-duathlon','raid-multisport-aventure','triathlon'], 'multisport_transverse',  'hybrid_sensor',   'V2_SPECIALIZED',  '2.0.0', false, true,  18, 0,  'swimBikeRun',                   'Workout',          '{"view":"multisport_legs"}'::jsonb, true),

  -- ── V3 HARDWARE PRO (7) ──
  ('kayak',    'voile',                  'sailing',              array['voile','sailing','deriveur','habitable'],                   'nautical_wind_glide',    'gps_water',       'V3_HARDWARE_PRO', '2.0.0', false, true,  32, 0,  'sailing',                       'Sail',             '{"cross196":true,"primarySpeedUnit":"knots"}'::jsonb, true),
  ('kayak',    'surf-bodyboard',         'surf_bodyboard',       array['surf-bodyboard','surf','bodyboard'],                        'nautical_wind_glide',    'gps_water',       'V3_HARDWARE_PRO', '2.0.0', false, true,  38, 0,  'surfingSports',                 'Surfing',          '{"cross196":true,"primarySpeedUnit":"knots"}'::jsonb, true),
  ('kayak',    'kitesurf-windsurf-wing', 'kite_wind_wing',       array['kitesurf-windsurf-wing','kitesurf','windsurf','wingfoil'],  'nautical_wind_glide',    'gps_water',       'V3_HARDWARE_PRO', '2.0.0', false, true,  44, 0,  'surfingSports',                 'Kitesurf',         '{"cross196":true,"primarySpeedUnit":"knots"}'::jsonb, true),
  ('escalade', 'parapente-vol-libre',    'paragliding_hike_fly', array['parapente-vol-libre','parapente','hike-and-fly'],           'nautical_wind_glide',    'gps_baro_alpine', 'V3_HARDWARE_PRO', '2.0.0', false, false, 43, 0,  'other',                         'Workout',          '{"paracheckFfvl":true,"airspaceNotam":true}'::jsonb, true),
  ('kayak',    'plongee-apnee',          'diving_freediving',    array['plongee-apnee','plongee','apnee','diving','freediving'],    'swimming_aquatic',       'manual_import',   'V3_HARDWARE_PRO', '2.0.0', false, false, 53, 0,  'underwaterDiving',              'Workout',          '{"hardwareGuard":"dive_computer_or_watch_ultra"}'::jsonb, true),
  ('kayak',    'rameur-indoor',          'indoor_rowing',        array['rameur-indoor','rameur','ergometre','concept2'],            'indoor_strength_cardio', 'indoor_no_gps',   'V3_HARDWARE_PRO', '2.0.0', false, true,  15, 14, 'rowing',                        'Rowing',           '{"ftms":"0x1826","primarySpeedUnit":"min_per_500m"}'::jsonb, true),
  ('kayak',    'aviron',                 'rowing_outdoor',       array['aviron','rowing'],                                          'nautical_wind_glide',    'gps_water',       'V3_HARDWARE_PRO', '2.0.0', false, true,  15, 0,  'rowing',                        'Rowing',           '{"primarySpeedUnit":"min_per_500m"}'::jsonb, true)
on conflict (sport, variant_id) do update set
  canonical_slug        = excluded.canonical_slug,
  legacy_slug_aliases   = excluded.legacy_slug_aliases,
  family_id             = excluded.family_id,
  pipeline_id           = excluded.pipeline_id,
  rollout_wave          = excluded.rollout_wave,
  spec_version          = excluded.spec_version,
  rgpd_art9_sensitive   = excluded.rgpd_art9_sensitive,
  leaderboard_eligible  = excluded.leaderboard_eligible,
  fit_sport             = excluded.fit_sport,
  fit_sub_sport         = excluded.fit_sub_sport,
  hk_activity_type      = excluded.hk_activity_type,
  strava_sport_type     = excluded.strava_sport_type,
  profile_spec          = excluded.profile_spec,
  is_active             = excluded.is_active,
  updated_at            = now();

commit;
