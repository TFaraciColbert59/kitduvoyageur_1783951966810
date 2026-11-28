-- ============================================================================
-- Lot 01 — Seed SQL des 13 Activités du Socle V1 dans `explorer_sport_variants`
-- Aligné 100 % sur `src/features/explorer-v2/specs/v1Profiles.seed.ts`.
-- Strictement idempotent (ON CONFLICT DO UPDATE).
-- ============================================================================

begin;

insert into public.explorer_sport_variants (
  sport, variant_id, canonical_slug, legacy_slug_aliases,
  family_id, pipeline_id, rollout_wave, spec_version,
  rgpd_art9_sensitive, leaderboard_eligible,
  fit_sport, fit_sub_sport, hk_activity_type, strava_sport_type, is_active
) values
  ('course',   'course-route',   'running',               array['course-route','course-5k','course-piste','course','run'],              'running_trail',         'gps_outdoor',     'V1_SOCLE', '2.0.0', false, true,  1,  0,  'running',            'Run',              true),
  ('trail',    'trail-10k',      'trail_running',         array['trail-10k','trail-court','trail-ultra','trail','ultra_trail'],         'running_trail',         'gps_baro_alpine', 'V1_SOCLE', '2.0.0', false, true,  1,  3,  'running',            'TrailRun',         true),
  ('rando',    'rando-journee',  'hiking',                array['rando-journee','rando','hike','rando-refuge'],                         'hiking_trekking',       'gps_baro_alpine', 'V1_SOCLE', '2.0.0', false, true,  17, 0,  'hiking',             'Hike',             true),
  ('bivouac',  'bivouac-1n',     'trekking_bivouac',      array['trek-itinerant','trekking-expedition','bivouac','bivouac-1n','bivouac-2n','trek'], 'hiking_trekking', 'gps_baro_alpine', 'V1_SOCLE', '2.0.0', false, true,  17, 0,  'hiking',             'Hike',             true),
  ('famille',  'famille-balade', 'walking',               array['marche-active','marche-nordique','famille-balade','famille-poussette','famille','walk'], 'hiking_trekking', 'gps_outdoor', 'V1_SOCLE', '2.0.0', false, false, 11, 0,  'walking',            'Walk',             true),
  ('escalade', 'escalade-voie',  'mountaineering',        array['alpinisme','haute-montagne','alpi'],                                   'alpinism_vertical',     'gps_baro_alpine', 'V1_SOCLE', '2.0.0', false, false, 16, 0,  'climbing',           'Hike',             true),
  ('ski',      'ski-rando',      'ski_touring',           array['ski-rando','ski-randonnee','ski','splitboard'],                        'snow_winter',           'gps_baro_alpine', 'V1_SOCLE', '2.0.0', false, true,  13, 37, 'crossCountrySkiing', 'BackcountrySki',   true),
  ('ski',      'raquettes',      'snowshoeing',           array['raquettes','snowshoe'],                                                'snow_winter',           'gps_baro_alpine', 'V1_SOCLE', '2.0.0', false, true,  35, 0,  'hiking',             'Snowshoe',         true),
  ('velo',     'velo-route',     'road_cycling',          array['velo-route','velo','ride','velo-cyclocross','velo-velomobile'],        'cycling_mobility',      'gps_outdoor',     'V1_SOCLE', '2.0.0', false, true,  2,  7,  'cycling',            'Ride',             true),
  ('velo',     'velo-gravel',    'gravel_cycling',        array['velo-gravel','gravel-bivouac','velo-bikepacking','bikepacking-3j','gravel'], 'cycling_mobility', 'gps_outdoor', 'V1_SOCLE', '2.0.0', false, true,  2,  46, 'cycling',            'GravelRide',       true),
  ('velo',     'velo-vtt',       'mtb_xc_trail',          array['velo-vtt','vtt','mtb','velo-vtt-enduro'],                              'cycling_mobility',      'gps_baro_alpine', 'V1_SOCLE', '2.0.0', false, true,  2,  8,  'cycling',            'MountainBikeRide', true),
  ('velo',     'velo-velotaf',   'bike_commute',          array['velo-velotaf','velotaf','commute'],                                    'cycling_mobility',      'gps_outdoor',     'V1_SOCLE', '2.0.0', false, false, 2,  48, 'cycling',            'Ride',             true),
  ('rando',    'manuel-import',  'manual_generic_import', array['activite-manuelle','import-externe','manual','import','other'],        'multisport_transverse', 'manual_import',   'V1_SOCLE', '2.0.0', false, false, 0,  0,  'other',              'Workout',          true)
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
  is_active             = excluded.is_active,
  updated_at            = now();

commit;
