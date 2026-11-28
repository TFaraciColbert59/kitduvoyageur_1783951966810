import type { ActivityProfileSpec } from './activityProfileSpec.types';
import { V1_ACTIVITY_PROFILES } from './v1Profiles.seed';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function mergeSpec(base: ActivityProfileSpec, patch: DeepPartial<ActivityProfileSpec>): ActivityProfileSpec {
  return {
    ...base,
    ...patch,
    rolloutWave: patch.rolloutWave ?? 'V2_SPECIALIZED',
    identity: {
      ...base.identity,
      ...patch.identity,
      mappings: {
        ...base.identity.mappings,
        ...(patch.identity?.mappings ?? {}),
      },
    },
    acquisition: {
      ...base.acquisition,
      ...patch.acquisition,
      barometer: {
        ...base.acquisition.barometer,
        ...(patch.acquisition?.barometer ?? {}),
      },
      bleServices: {
        ...base.acquisition.bleServices,
        ...(patch.acquisition?.bleServices ?? {}),
      },
    },
    algorithms: {
      ...base.algorithms,
      ...patch.algorithms,
      gapMinetti: {
        ...base.algorithms.gapMinetti,
        ...(patch.algorithms?.gapMinetti ?? {}),
      },
      autoPause: {
        ...base.algorithms.autoPause,
        ...(patch.algorithms?.autoPause ?? {}),
      },
      antiCheat: {
        ...base.algorithms.antiCheat,
        ...(patch.algorithms?.antiCheat ?? {}),
      },
    },
    ui: {
      ...base.ui,
      ...patch.ui,
      dynamicIsland: {
        ...base.ui.dynamicIsland,
        ...(patch.ui?.dynamicIsland ?? {}),
      },
      voiceAnnouncementIntervalKmOrMin: {
        ...base.ui.voiceAnnouncementIntervalKmOrMin,
        ...(patch.ui?.voiceAnnouncementIntervalKmOrMin ?? {}),
      },
    },
    environment: {
      ...base.environment,
      ...patch.environment,
    },
    gearAndEpi: {
      ...base.gearAndEpi,
      ...patch.gearAndEpi,
    },
    privacyAndCompliance: {
      ...base.privacyAndCompliance,
      ...patch.privacyAndCompliance,
    },
  };
}

const bySlug = (slug: string): ActivityProfileSpec => {
  const found = V1_ACTIVITY_PROFILES.find((p) => p.identity.slugId === slug);
  if (!found) throw new Error(`Missing V1 base profile: ${slug}`);
  return found;
};

const BASE_RUN = bySlug('running');
const BASE_TRAIL = bySlug('trail_running');
const BASE_HIKE = bySlug('hiking');
const BASE_WALK = bySlug('walking');
const BASE_ALPI = bySlug('mountaineering');
const BASE_SKI = bySlug('ski_touring');
const BASE_BIKE = bySlug('road_cycling');
const BASE_MTB = bySlug('mtb_xc_trail');
const BASE_MANUAL = bySlug('manual_generic_import');

const REHAB_PRIVACY = {
  defaultVisibility: 'private' as const,
  epzMode: 'none_indoor' as const,
  epzRadiusMinM: 0,
  epzRadiusDefaultM: 0,
  heatmapEligibleDefault: false,
  rgpdArt9SensitiveHealth: true,
  aiInsightAllowedDefault: false,
  retentionPolicyDays: 365,
};

/**
 * Lot 10 — Vague V2 Spécialisée (29 profils canoniques).
 * Tous les profils `rehab_physio_*` appliquent les garde-fous RGPD Art. 9 stricts
 * (visibilité `private`, IA tierce bloquée, classements désactivés).
 */
export const V2_ACTIVITY_PROFILES: readonly ActivityProfileSpec[] = [
  // 1. Ultra-Trail (> 8 h, continuité Live Activity)
  mergeSpec(BASE_TRAIL, {
    identity: {
      slugId: 'ultra_trail',
      legacyVariantId: 'trail-ultra',
      legacySlugAliases: ['trail-ultra', 'ultra-trail', 'ultra'],
      labelFr: 'Ultra-Trail (> 50 km)',
      shortLabelFr: 'Ultra',
      mappings: { stravaSportType: 'TrailRun', garminFitSubSport: 3 },
    },
    acquisition: {
      distanceFilterStandardM: 6,
      distanceFilterEcoM: 20,
      sampleIntervalEcoMs: 10000,
      offlineTilePreloadRadiusKm: 35,
    },
    ui: {
      dynamicIsland: {
        compactLeadingMetric: 'distance',
        compactTrailingMetric: 'elev_gain',
        expanded4Metrics: ['distance', 'elev_gain', 'moving_time', 'pace_gap'],
        intents: ['toggle_pause', 'add_waypoint'],
        staleTimeoutS: 180,
      },
    },
  }),

  // 2. Marche Nordique
  mergeSpec(BASE_WALK, {
    identity: {
      slugId: 'nordic_walking',
      legacyVariantId: 'marche-nordique',
      legacySlugAliases: ['marche-nordique', 'nordic-walking'],
      labelFr: 'Marche Nordique',
      shortLabelFr: 'Nordique',
      mappings: { stravaSportType: 'Walk', garminFitSport: 11, garminFitSubSport: 27 },
    },
    algorithms: { primarySpeedUnit: 'km_per_h', metFallback: 4.8 },
  }),

  // 3. Escalade falaise / grande voie (EPI EN 892)
  mergeSpec(BASE_ALPI, {
    identity: {
      slugId: 'rock_climbing_outdoor',
      legacySport: 'escalade',
      legacyVariantId: 'escalade-falaise',
      legacySlugAliases: ['escalade-falaise', 'escalade-grande-voie', 'escalade'],
      labelFr: 'Escalade Falaise & Grande Voie',
      shortLabelFr: 'Escalade',
      mappings: { healthKitActivityType: 'climbing', stravaSportType: 'RockClimbing', garminFitSport: 31 },
    },
    algorithms: { primarySpeedUnit: 'duration_only', autoPause: { defaultEnabled: false, lockDisabledBySafety: true } },
    gearAndEpi: {
      gearCategoryCodes: ['epi_rope_en892', 'harness', 'climbing_shoes'],
      wearUnit: 'falls_and_years',
      defaultWearThresholds: [
        { componentKey: 'epi_rope_en892', warnAt: 8, criticalAt: 10, unit: 'years', normRef: 'EN 892' },
      ],
      epiControlMandatory: true,
    },
  }),

  // 4. Bloc (Bouldering)
  mergeSpec(BASE_MANUAL, {
    identity: {
      slugId: 'bouldering',
      legacySport: 'escalade',
      legacyVariantId: 'escalade-bloc',
      legacySlugAliases: ['escalade-bloc', 'bloc', 'bouldering'],
      familyId: 'alpinism_vertical',
      labelFr: 'Escalade Bloc',
      shortLabelFr: 'Bloc',
      environment: 'hybrid',
      mappings: { healthKitActivityType: 'climbing', healthKitLocationType: 'indoor', stravaSportType: 'RockClimbing', garminFitSport: 31, garminFitSubSport: 68 },
    },
    acquisition: { pipeline: 'indoor_no_gps', gpsRequired: false },
    algorithms: { primarySpeedUnit: 'duration_only', loadModelPrimary: 'foster_srpe', metFallback: 6.0 },
  }),

  // 5. Via Ferrata (EPI EN 958 + garde-fou cotation lettre D)
  mergeSpec(BASE_ALPI, {
    identity: {
      slugId: 'via_ferrata',
      legacySport: 'escalade',
      legacyVariantId: 'via-ferrata',
      legacySlugAliases: ['via-ferrata'],
      labelFr: 'Via Ferrata (Cotation F–ED)',
      shortLabelFr: 'Via Ferrata',
      mappings: { healthKitActivityType: 'climbing', stravaSportType: 'RockClimbing', garminFitSport: 31 },
    },
    algorithms: { primarySpeedUnit: 'm_per_h_vam', autoPause: { defaultEnabled: false, lockDisabledBySafety: true } },
    gearAndEpi: {
      gearCategoryCodes: ['epi_via_ferrata_en958', 'helmet', 'harness'],
      wearUnit: 'falls_and_years',
      defaultWearThresholds: [
        { componentKey: 'epi_via_ferrata_en958', warnAt: 8, criticalAt: 10, unit: 'years', normRef: 'EN 958' },
      ],
      epiControlMandatory: true,
    },
  }),

  // 6. Canyoning (FFME)
  mergeSpec(BASE_ALPI, {
    identity: {
      slugId: 'canyoning',
      legacySport: 'escalade',
      legacyVariantId: 'canyoning',
      legacySlugAliases: ['canyoning'],
      labelFr: 'Canyoning (FFME v/a/e)',
      shortLabelFr: 'Canyon',
      environment: 'water',
      mappings: { healthKitActivityType: 'waterSports', stravaSportType: 'Workout', garminFitSport: 17 },
    },
    algorithms: { primarySpeedUnit: 'duration_only', autoPause: { defaultEnabled: false, lockDisabledBySafety: true } },
    gearAndEpi: {
      gearCategoryCodes: ['epi_rope_en892', 'wetsuit', 'helmet'],
      wearUnit: 'falls_and_years',
      defaultWearThresholds: [{ componentKey: 'epi_rope_en892', warnAt: 5, criticalAt: 10, unit: 'years', normRef: 'EN 1891' }],
      epiControlMandatory: true,
    },
  }),

  // 7. Spéléologie (FFS — sous terre sans GPS)
  mergeSpec(BASE_MANUAL, {
    identity: {
      slugId: 'speleologie',
      legacySport: 'escalade',
      legacyVariantId: 'speleologie',
      legacySlugAliases: ['speleologie', 'speleo'],
      familyId: 'alpinism_vertical',
      labelFr: 'Spéléologie (FFS)',
      shortLabelFr: 'Spéléo',
      environment: 'hybrid',
      mappings: { healthKitActivityType: 'climbing', healthKitLocationType: 'unknown', stravaSportType: 'Workout', garminFitSport: 31 },
    },
    acquisition: { pipeline: 'indoor_no_gps', gpsRequired: false, barometer: { enabled: true, hysteresisM: 2, demRecalibrationIntervalS: 0, demMaxDriftDeltaM: 20 } },
    algorithms: { primarySpeedUnit: 'duration_only', loadModelPrimary: 'foster_srpe' },
    gearAndEpi: { gearCategoryCodes: ['epi_rope_en892', 'headlamp'], wearUnit: 'falls_and_years', defaultWearThresholds: [], epiControlMandatory: true },
  }),

  // 8. Course d'Orientation
  mergeSpec(BASE_TRAIL, {
    identity: {
      slugId: 'course_orientation',
      legacySport: 'trail',
      legacyVariantId: 'course-orientation',
      legacySlugAliases: ['course-orientation', 'orientation'],
      labelFr: "Course d'Orientation (CO)",
      shortLabelFr: 'Orientation',
      mappings: { stravaSportType: 'TrailRun', garminFitSubSport: 3 },
    },
  }),

  // 9. Ski Alpin (Détection remontées mécaniques + vue ski_runs_lifts)
  mergeSpec(BASE_SKI, {
    identity: {
      slugId: 'alpine_ski',
      legacyVariantId: 'ski-alpin',
      legacySlugAliases: ['ski-alpin', 'ski_alpin', 'ski'],
      labelFr: 'Ski Alpin (Piste & Hors-Piste)',
      shortLabelFr: 'Ski Alpin',
      mappings: {
        healthKitActivityType: 'downhillSkiing',
        healthKitMetadataKeys: ['HKMetadataKeyAlpineSlopeGrade', 'HKMetadataKeyElevationDescended'],
        stravaSportType: 'AlpineSki',
        garminFitSport: 13,
      },
    },
    algorithms: {
      primarySpeedUnit: 'km_per_h',
      antiCheat: { leaderboardEligible: true, maxSustainedSpeedKmh: 115, maxInstantSpeedKmh: 140, maxVamMH: 2500, vehicleAutoCropEnabled: false, motorAssistIsolatedCategory: false, liftDetectionEnabled: true },
    },
    ui: {
      availableViews: ['ski_runs_lifts', 'map_3kpi', 'cockpit_grid', 'elevation_profile'],
      defaultView: 'ski_runs_lifts',
    },
  }),

  // 10. Snowboard
  mergeSpec(BASE_SKI, {
    identity: {
      slugId: 'snowboard',
      legacyVariantId: 'snowboard',
      legacySlugAliases: ['snowboard'],
      labelFr: 'Snowboard',
      shortLabelFr: 'Snowboard',
      mappings: { healthKitActivityType: 'snowboarding', stravaSportType: 'Snowboard', garminFitSport: 14 },
    },
    algorithms: {
      primarySpeedUnit: 'km_per_h',
      antiCheat: { leaderboardEligible: true, maxSustainedSpeedKmh: 105, maxInstantSpeedKmh: 130, maxVamMH: 2500, vehicleAutoCropEnabled: false, motorAssistIsolatedCategory: false, liftDetectionEnabled: true },
    },
    ui: {
      availableViews: ['ski_runs_lifts', 'map_3kpi', 'cockpit_grid'],
      defaultView: 'ski_runs_lifts',
    },
  }),

  // 11. Splitboard
  mergeSpec(BASE_SKI, {
    identity: {
      slugId: 'splitboard',
      legacyVariantId: 'splitboard',
      legacySlugAliases: ['splitboard'],
      labelFr: 'Splitboard',
      shortLabelFr: 'Splitboard',
      mappings: { healthKitActivityType: 'snowboarding', stravaSportType: 'BackcountrySki', garminFitSport: 14, garminFitSubSport: 37 },
    },
  }),

  // 12. Ski de Fond (Classique & Skating)
  mergeSpec(BASE_SKI, {
    identity: {
      slugId: 'nordic_ski',
      legacyVariantId: 'ski-fond',
      legacySlugAliases: ['ski-fond', 'ski_fond', 'nordic_ski_classic', 'nordic_ski_skating'],
      labelFr: 'Ski de Fond (Classique / Skating)',
      shortLabelFr: 'Ski Fond',
      mappings: { healthKitActivityType: 'crossCountrySkiing', stravaSportType: 'NordicSki', garminFitSport: 12 },
    },
    algorithms: { primarySpeedUnit: 'km_per_h' },
  }),

  // 13. VTT Enduro / DH (Remontées + heures suspension Fox/RockShox)
  mergeSpec(BASE_MTB, {
    identity: {
      slugId: 'mtb_enduro_dh',
      legacyVariantId: 'vtt-enduro',
      legacySlugAliases: ['vtt-enduro', 'vtt-dh', 'enduro', 'dh'],
      labelFr: 'VTT Enduro & Descente (DH)',
      shortLabelFr: 'Enduro DH',
      mappings: { stravaSportType: 'MountainBikeRide', garminFitSport: 2, garminFitSubSport: 8 },
    },
    algorithms: {
      antiCheat: { leaderboardEligible: true, maxSustainedSpeedKmh: 75, maxInstantSpeedKmh: 95, maxVamMH: 2500, vehicleAutoCropEnabled: false, motorAssistIsolatedCategory: false, liftDetectionEnabled: true },
    },
    gearAndEpi: {
      gearCategoryCodes: ['fork_fox', 'fork_rockshox', 'bike_chain'],
      wearUnit: 'hours',
      defaultWearThresholds: [
        { componentKey: 'fork_fox', warnAt: 100, criticalAt: 125, unit: 'hours', normRef: null },
        { componentKey: 'fork_rockshox', warnAt: 160, criticalAt: 200, unit: 'hours', normRef: null },
      ],
      epiControlMandatory: false,
    },
  }),

  // 14. VAE Route / Trekking (Isolé classements musculaires)
  mergeSpec(BASE_BIKE, {
    identity: {
      slugId: 'ebike_road_trek',
      legacyVariantId: 'vae-route',
      legacySlugAliases: ['vae-route', 'vae', 'ebike'],
      labelFr: 'Vélo à Assistance Électrique (VAE)',
      shortLabelFr: 'VAE',
      mappings: { stravaSportType: 'EBikeRide', garminFitSport: 2, garminFitSubSport: 28 },
    },
    algorithms: {
      antiCheat: { leaderboardEligible: true, maxSustainedSpeedKmh: 55, maxInstantSpeedKmh: 80, maxVamMH: 2500, vehicleAutoCropEnabled: false, motorAssistIsolatedCategory: true, liftDetectionEnabled: false },
    },
  }),

  // 15. VTTAE (eMTB — Isolé classements musculaires)
  mergeSpec(BASE_MTB, {
    identity: {
      slugId: 'emtb',
      legacyVariantId: 'vtt-ae',
      legacySlugAliases: ['vtt-ae', 'vttae', 'emtb'],
      labelFr: 'VTT Assistance Électrique (VTTAE)',
      shortLabelFr: 'VTTAE',
      mappings: { stravaSportType: 'EMountainBikeRide', garminFitSport: 2, garminFitSubSport: 28 },
    },
    algorithms: {
      antiCheat: { leaderboardEligible: true, maxSustainedSpeedKmh: 50, maxInstantSpeedKmh: 75, maxVamMH: 2500, vehicleAutoCropEnabled: false, motorAssistIsolatedCategory: true, liftDetectionEnabled: false },
    },
  }),

  // 16. Natation Piscine (SWOLF + /100m + vue pool_laps_swolf)
  mergeSpec(BASE_MANUAL, {
    identity: {
      slugId: 'swim_pool',
      legacySport: 'kayak',
      legacyVariantId: 'natation-piscine',
      legacySlugAliases: ['natation-piscine', 'natation', 'piscine'],
      familyId: 'swimming_aquatic',
      labelFr: 'Natation Piscine (25 m / 50 m)',
      shortLabelFr: 'Piscine',
      environment: 'indoor',
      mappings: {
        healthKitActivityType: 'swimming',
        healthKitLocationType: 'indoor',
        healthKitMetadataKeys: ['HKMetadataKeySwimmingLocationType', 'HKMetadataKeyLapLength', 'HKMetadataKeySWOLFScore'],
        healthConnectExerciseType: 'EXERCISE_TYPE_SWIMMING_POOL',
        garminFitSport: 5,
        garminFitSubSport: 17,
        stravaSportType: 'Swim',
        komootSportKey: null,
      },
    },
    acquisition: { pipeline: 'indoor_no_gps', gpsRequired: false },
    algorithms: { primarySpeedUnit: 'min_per_100m', loadModelPrimary: 'foster_srpe', metFallback: 8.0 },
    ui: {
      availableViews: ['pool_laps_swolf', 'cockpit_grid'],
      defaultView: 'pool_laps_swolf',
      mapCapsule3Kpis: ['distance', 'pace_100m', 'swolf'],
      cockpitGridFields: ['distance', 'duration', 'pace_or_speed', 'heart_rate'],
      dynamicIsland: {
        compactLeadingMetric: 'distance',
        compactTrailingMetric: 'pace_100m',
        expanded4Metrics: ['distance', 'duration', 'pace_100m', 'swolf'],
        intents: ['toggle_pause', 'mark_lap_split'],
        staleTimeoutS: 120,
      },
    },
    environment: { defaultMapStyle: 'none_indoor', weatherEndpoints: [], emergencyProtocol: 'indoor_basic' },
  }),

  // 17. Natation Eau Libre (CROSS 196 + GPS Eau)
  mergeSpec(BASE_HIKE, {
    identity: {
      slugId: 'swim_open_water',
      legacySport: 'kayak',
      legacyVariantId: 'natation-eau-libre',
      legacySlugAliases: ['natation-eau-libre', 'eau-libre'],
      familyId: 'swimming_aquatic',
      labelFr: 'Natation Eau Libre',
      shortLabelFr: 'Eau Libre',
      environment: 'water',
      mappings: {
        healthKitActivityType: 'swimming',
        healthKitLocationType: 'outdoor',
        healthKitMetadataKeys: ['HKMetadataKeySwimmingLocationType'],
        healthConnectExerciseType: 'EXERCISE_TYPE_SWIMMING_OPEN_WATER',
        garminFitSport: 5,
        garminFitSubSport: 18,
        stravaSportType: 'Swim',
        komootSportKey: null,
      },
    },
    acquisition: { pipeline: 'gps_water', gpsRequired: true, barometer: { enabled: false, hysteresisM: 0, demRecalibrationIntervalS: 0, demMaxDriftDeltaM: 0 } },
    algorithms: { primarySpeedUnit: 'min_per_100m', elevationGainAlgorithm: 'none', metFallback: 9.0 },
    environment: { defaultMapStyle: 'marine_nautical', weatherEndpoints: ['open_meteo_marine', 'shom_refmar'], emergencyProtocol: 'maritime_cross_196' },
  }),

  // 18. Kayak Mer & Lac
  mergeSpec(BASE_HIKE, {
    identity: {
      slugId: 'kayak_sea_lake',
      legacySport: 'kayak',
      legacyVariantId: 'kayak-mer',
      legacySlugAliases: ['kayak-mer', 'kayak'],
      familyId: 'nautical_wind_glide',
      labelFr: 'Kayak Mer & Lac',
      shortLabelFr: 'Kayak Mer',
      environment: 'water',
      mappings: { healthKitActivityType: 'paddleSports', stravaSportType: 'Kayaking', garminFitSport: 41 },
    },
    acquisition: { pipeline: 'gps_water', barometer: { enabled: false, hysteresisM: 0, demRecalibrationIntervalS: 0, demMaxDriftDeltaM: 0 } },
    algorithms: { primarySpeedUnit: 'knots', secondarySpeedUnit: 'km_per_h', elevationGainAlgorithm: 'none' },
    environment: { defaultMapStyle: 'marine_nautical', weatherEndpoints: ['open_meteo_marine', 'shom_refmar'], emergencyProtocol: 'maritime_cross_196' },
  }),

  // 19. Kayak Eau Vive / Rafting
  mergeSpec(BASE_HIKE, {
    identity: {
      slugId: 'kayak_whitewater',
      legacySport: 'kayak',
      legacyVariantId: 'kayak-riviere',
      legacySlugAliases: ['kayak-riviere', 'rafting'],
      familyId: 'nautical_wind_glide',
      labelFr: 'Kayak Eau Vive & Rafting',
      shortLabelFr: 'Eau Vive',
      environment: 'water',
      mappings: { healthKitActivityType: 'paddleSports', stravaSportType: 'Kayaking', garminFitSport: 41 },
    },
    acquisition: { pipeline: 'gps_water' },
    algorithms: { primarySpeedUnit: 'km_per_h', elevationGainAlgorithm: 'dem_only' },
    environment: { defaultMapStyle: 'ign_topo_outdoor', weatherEndpoints: ['open_meteo_hourly', 'vigilance_mf'], emergencyProtocol: 'standard_112_114' },
  }),

  // 20. Stand-Up Paddle (SUP)
  mergeSpec(BASE_HIKE, {
    identity: {
      slugId: 'stand_up_paddle',
      legacySport: 'kayak',
      legacyVariantId: 'stand-up-paddle',
      legacySlugAliases: ['stand-up-paddle', 'sup'],
      familyId: 'nautical_wind_glide',
      labelFr: 'Stand-Up Paddle (SUP)',
      shortLabelFr: 'SUP',
      environment: 'water',
      mappings: { healthKitActivityType: 'paddleSports', stravaSportType: 'StandUpPaddling', garminFitSport: 37 },
    },
    acquisition: { pipeline: 'gps_water', barometer: { enabled: false, hysteresisM: 0, demRecalibrationIntervalS: 0, demMaxDriftDeltaM: 0 } },
    algorithms: { primarySpeedUnit: 'km_per_h', elevationGainAlgorithm: 'none' },
    environment: { defaultMapStyle: 'marine_nautical', weatherEndpoints: ['open_meteo_marine', 'shom_refmar'], emergencyProtocol: 'maritime_cross_196' },
  }),

  // 21. Tapis de Course (FTMS 0x1826 + Indoor)
  mergeSpec(BASE_RUN, {
    identity: {
      slugId: 'treadmill_running',
      legacyVariantId: 'course-tapis',
      legacySlugAliases: ['course-tapis', 'tapis', 'treadmill'],
      familyId: 'indoor_strength_cardio',
      labelFr: 'Course sur Tapis (FTMS)',
      shortLabelFr: 'Tapis',
      environment: 'indoor',
      mappings: {
        healthKitActivityType: 'running',
        healthKitLocationType: 'indoor',
        healthKitMetadataKeys: ['HKMetadataKeyIndoorWorkout'],
        stravaSportType: 'Run',
        garminFitSport: 1,
        garminFitSubSport: 1,
      },
    },
    acquisition: {
      pipeline: 'indoor_no_gps',
      gpsRequired: false,
      bleServices: { recommended: ['0x1826', '0x180D'], optional: ['0x1814'], autoReconnectTimeoutS: 20 },
    },
    environment: { defaultMapStyle: 'none_indoor', weatherEndpoints: [], emergencyProtocol: 'indoor_basic' },
    privacyAndCompliance: { epzMode: 'none_indoor', epzRadiusMinM: 0, epzRadiusDefaultM: 0, heatmapEligibleDefault: false },
  }),

  // 22. Home-Trainer / Vélo Indoor (FTMS 0x1826 ERG + Watts)
  mergeSpec(BASE_BIKE, {
    identity: {
      slugId: 'indoor_cycling',
      legacyVariantId: 'velo-home-trainer',
      legacySlugAliases: ['velo-home-trainer', 'velo-virtuel', 'home-trainer', 'zwift'],
      familyId: 'indoor_strength_cardio',
      labelFr: 'Vélo Home-Trainer (FTMS ERG)',
      shortLabelFr: 'Home-Trainer',
      environment: 'indoor',
      mappings: {
        healthKitActivityType: 'cycling',
        healthKitLocationType: 'indoor',
        healthKitMetadataKeys: ['HKMetadataKeyIndoorWorkout'],
        stravaSportType: 'VirtualRide',
        garminFitSport: 2,
        garminFitSubSport: 6,
      },
    },
    acquisition: {
      pipeline: 'indoor_no_gps',
      gpsRequired: false,
      bleServices: { recommended: ['0x1826', '0x1818', '0x180D'], optional: ['0x1816'], autoReconnectTimeoutS: 20 },
    },
    algorithms: { primarySpeedUnit: 'watts', secondarySpeedUnit: 'km_per_h', loadModelPrimary: 'coggan_tss_power' },
    environment: { defaultMapStyle: 'none_indoor', weatherEndpoints: [], emergencyProtocol: 'indoor_basic' },
    privacyAndCompliance: { epzMode: 'none_indoor', epzRadiusMinM: 0, epzRadiusDefaultM: 0, heatmapEligibleDefault: false },
  }),

  // 23. Musculation & Force (Logger Hevy + Tonnage)
  mergeSpec(BASE_MANUAL, {
    identity: {
      slugId: 'strength_weights',
      legacySport: 'famille',
      legacyVariantId: 'musculation',
      legacySlugAliases: ['musculation', 'musculation-fonctionnelle', 'crossfit-hyrox', 'force'],
      familyId: 'indoor_strength_cardio',
      labelFr: 'Musculation & Force (Séries / Tonnage)',
      shortLabelFr: 'Muscu',
      environment: 'indoor',
      mappings: {
        healthKitActivityType: 'traditionalStrengthTraining',
        healthKitLocationType: 'indoor',
        healthKitMetadataKeys: ['HKMetadataKeyIndoorWorkout'],
        healthConnectExerciseType: 'EXERCISE_TYPE_WEIGHTLIFTING',
        garminFitSport: 10,
        garminFitSubSport: 20,
        stravaSportType: 'WeightTraining',
        komootSportKey: null,
      },
    },
    acquisition: { pipeline: 'indoor_no_gps', gpsRequired: false, bleServices: { recommended: ['0x180D'], optional: [], autoReconnectTimeoutS: 15 } },
    algorithms: { primarySpeedUnit: 'reps_tonnage', loadModelPrimary: 'volume_load_tonnage', metFallback: 5.0 },
    ui: {
      availableViews: ['strength_logger_hevy', 'cockpit_grid'],
      defaultView: 'strength_logger_hevy',
      dynamicIsland: {
        compactLeadingMetric: 'duration',
        compactTrailingMetric: 'sets_done',
        expanded4Metrics: ['duration', 'sets_done', 'tonnage_kg', 'rest_timer'],
        intents: ['log_strength_set', 'toggle_pause'],
        staleTimeoutS: 180,
      },
    },
    environment: { defaultMapStyle: 'none_indoor', weatherEndpoints: [], emergencyProtocol: 'indoor_basic' },
  }),

  // 24. HIIT / Cardio Indoor
  mergeSpec(BASE_MANUAL, {
    identity: {
      slugId: 'hiit_cardio',
      legacySport: 'famille',
      legacyVariantId: 'hiit-interval',
      legacySlugAliases: ['hiit-interval', 'elliptique-stepper', 'corde-a-sauter', 'hiit'],
      familyId: 'indoor_strength_cardio',
      labelFr: 'HIIT & Cardio Indoor',
      shortLabelFr: 'HIIT',
      environment: 'indoor',
      mappings: {
        healthKitActivityType: 'highIntensityIntervalTraining',
        healthKitLocationType: 'indoor',
        healthKitMetadataKeys: ['HKMetadataKeyIndoorWorkout'],
        stravaSportType: 'HIIT',
        garminFitSport: 62,
      },
    },
    acquisition: { pipeline: 'indoor_no_gps', gpsRequired: false },
    algorithms: { primarySpeedUnit: 'duration_only', loadModelPrimary: 'banister_trimp_hr', metFallback: 8.5 },
    environment: { defaultMapStyle: 'none_indoor', weatherEndpoints: [], emergencyProtocol: 'indoor_basic' },
  }),

  // 25. Yoga / Pilates / Mobilité
  mergeSpec(BASE_MANUAL, {
    identity: {
      slugId: 'yoga_pilates',
      legacySport: 'famille',
      legacyVariantId: 'yoga',
      legacySlugAliases: ['yoga', 'pilates-barre', 'mobilite-etirements', 'pilates'],
      familyId: 'rehab_wellness',
      labelFr: 'Yoga, Pilates & Mobilité',
      shortLabelFr: 'Yoga',
      environment: 'indoor',
      mappings: { healthKitActivityType: 'yoga', healthKitLocationType: 'indoor', stravaSportType: 'Yoga', garminFitSport: 10, garminFitSubSport: 43 },
    },
    acquisition: { pipeline: 'indoor_no_gps', gpsRequired: false },
    algorithms: { primarySpeedUnit: 'duration_only', loadModelPrimary: 'foster_srpe', metFallback: 2.8 },
    environment: { defaultMapStyle: 'none_indoor', weatherEndpoints: [], emergencyProtocol: 'indoor_basic' },
  }),

  // 26. Rééducation Kiné / Mobilité (RGPD ART. 9 STRICT)
  mergeSpec(BASE_MANUAL, {
    identity: {
      slugId: 'rehab_physio_mobility',
      legacySport: 'famille',
      legacyVariantId: 'rehab-mobilite',
      legacySlugAliases: ['rehab-mobilite', 'rehab-velo-doux', 'rehab-aquatique', 'rehab_physio_bike', 'rehab_physio_aqua'],
      familyId: 'rehab_wellness',
      labelFr: 'Rééducation & Kiné (Confidentiel Art. 9)',
      shortLabelFr: 'Réhab',
      environment: 'indoor',
      mappings: {
        healthKitActivityType: 'flexibility',
        healthKitLocationType: 'indoor',
        healthKitMetadataKeys: ['HKMetadataKeyIndoorWorkout'],
        healthConnectExerciseType: 'EXERCISE_TYPE_STRETCHING',
        garminFitSport: 10,
        garminFitSubSport: 0,
        stravaSportType: 'Workout',
        komootSportKey: null,
      },
    },
    acquisition: { pipeline: 'indoor_no_gps', gpsRequired: false },
    algorithms: {
      primarySpeedUnit: 'duration_only',
      loadModelPrimary: 'none_excluded',
      loadModelFallback: 'none_excluded',
      antiCheat: { leaderboardEligible: false, maxSustainedSpeedKmh: 0, maxInstantSpeedKmh: 0, maxVamMH: 0, vehicleAutoCropEnabled: false, motorAssistIsolatedCategory: false, liftDetectionEnabled: false },
      metFallback: 2.3,
    },
    ui: {
      preflightChecks: ['pain_baseline_check'],
      summarySpecialActions: ['log_pain_mobility_art9'],
    },
    environment: { defaultMapStyle: 'none_indoor', weatherEndpoints: [], emergencyProtocol: 'indoor_basic', pokedexPromptEnabled: false },
    privacyAndCompliance: REHAB_PRIVACY,
  }),

  // 27. Rééducation Marche Douce (RGPD ART. 9 STRICT)
  mergeSpec(BASE_WALK, {
    identity: {
      slugId: 'rehab_physio_walk',
      legacyVariantId: 'rehab-marche',
      legacySlugAliases: ['rehab-marche'],
      familyId: 'rehab_wellness',
      labelFr: 'Reprise Marche Rééducation (Art. 9)',
      shortLabelFr: 'Réhab Marche',
      mappings: { stravaSportType: 'Walk' },
    },
    algorithms: {
      loadModelPrimary: 'none_excluded',
      loadModelFallback: 'none_excluded',
      antiCheat: { leaderboardEligible: false, maxSustainedSpeedKmh: 12, maxInstantSpeedKmh: 15, maxVamMH: 800, vehicleAutoCropEnabled: false, motorAssistIsolatedCategory: false, liftDetectionEnabled: false },
      metFallback: 2.5,
    },
    ui: {
      preflightChecks: ['gps_lock', 'pain_baseline_check'],
      summarySpecialActions: ['log_pain_mobility_art9'],
    },
    privacyAndCompliance: {
      ...REHAB_PRIVACY,
      epzMode: 'single_home',
      epzRadiusMinM: 300,
      epzRadiusDefaultM: 500,
    },
  }),

  // 28. Fauteuil / Handbike (Accessibilité)
  mergeSpec(BASE_BIKE, {
    identity: {
      slugId: 'wheelchair_handbike',
      legacyVariantId: 'fauteuil-handbike',
      legacySlugAliases: ['fauteuil-handbike', 'handbike', 'wheelchair'],
      familyId: 'cycling_mobility',
      labelFr: 'Fauteuil Sport & Handbike',
      shortLabelFr: 'Handbike',
      mappings: { healthKitActivityType: 'wheelchairRunPace', stravaSportType: 'Handcycle', garminFitSport: 2, garminFitSubSport: 12 },
    },
  }),

  // 29. Multisport / Triathlon / Raid Enchaînement (vue multisport_legs)
  mergeSpec(BASE_TRAIL, {
    identity: {
      slugId: 'multisport_enchainement',
      legacySport: 'trail',
      legacyVariantId: 'triathlon-duathlon',
      legacySlugAliases: ['triathlon-duathlon', 'raid-multisport-aventure', 'triathlon', 'multisport'],
      familyId: 'multisport_transverse',
      labelFr: 'Multisport / Triathlon / Raid',
      shortLabelFr: 'Multisport',
      mappings: { healthKitActivityType: 'swimBikeRun', stravaSportType: 'Workout', garminFitSport: 18 },
    },
    acquisition: { pipeline: 'hybrid_sensor' },
    ui: {
      availableViews: ['multisport_legs', 'map_3kpi', 'cockpit_grid', 'elevation_profile'],
      defaultView: 'multisport_legs',
      dynamicIsland: {
        compactLeadingMetric: 'distance',
        compactTrailingMetric: 'leg_index',
        expanded4Metrics: ['distance', 'moving_time', 'leg_index', 'hr_bpm'],
        intents: ['mark_transition', 'toggle_pause'],
        staleTimeoutS: 90,
      },
    },
  }),
];
