import type { ActivityProfileSpec } from './activityProfileSpec.types';
import { V1_ACTIVITY_PROFILES } from './v1Profiles.seed';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function mergeV3(base: ActivityProfileSpec, patch: DeepPartial<ActivityProfileSpec>): ActivityProfileSpec {
  return {
    ...base,
    ...patch,
    rolloutWave: 'V3_HARDWARE_PRO',
    identity: {
      ...base.identity,
      ...patch.identity,
      mappings: { ...base.identity.mappings, ...(patch.identity?.mappings ?? {}) },
    },
    acquisition: {
      ...base.acquisition,
      ...patch.acquisition,
      barometer: { ...base.acquisition.barometer, ...(patch.acquisition?.barometer ?? {}) },
      bleServices: { ...base.acquisition.bleServices, ...(patch.acquisition?.bleServices ?? {}) },
    },
    algorithms: {
      ...base.algorithms,
      ...patch.algorithms,
      gapMinetti: { ...base.algorithms.gapMinetti, ...(patch.algorithms?.gapMinetti ?? {}) },
      autoPause: { ...base.algorithms.autoPause, ...(patch.algorithms?.autoPause ?? {}) },
      antiCheat: { ...base.algorithms.antiCheat, ...(patch.algorithms?.antiCheat ?? {}) },
    },
    ui: {
      ...base.ui,
      ...patch.ui,
      dynamicIsland: { ...base.ui.dynamicIsland, ...(patch.ui?.dynamicIsland ?? {}) },
      voiceAnnouncementIntervalKmOrMin: {
        ...base.ui.voiceAnnouncementIntervalKmOrMin,
        ...(patch.ui?.voiceAnnouncementIntervalKmOrMin ?? {}),
      },
    },
    environment: { ...base.environment, ...patch.environment },
    gearAndEpi: { ...base.gearAndEpi, ...patch.gearAndEpi },
    privacyAndCompliance: { ...base.privacyAndCompliance, ...patch.privacyAndCompliance },
  };
}

const bySlug = (slug: string): ActivityProfileSpec => {
  const found = V1_ACTIVITY_PROFILES.find((p) => p.identity.slugId === slug);
  if (!found) throw new Error(`Missing V1 base profile: ${slug}`);
  return found;
};

const BASE_HIKE = bySlug('hiking');
const BASE_ALPI = bySlug('mountaineering');
const BASE_MANUAL = bySlug('manual_generic_import');

/**
 * Lot 11 — Vague V3 Hardware Pro (7 profils canoniques complétant les 49 activités).
 * - Voile, Surf, Kite/Wind/Wing (nœuds + CROSS 196 + marées SHOM REFMAR)
 * - Parapente / Hike & Fly (baro haute fréquence + espace aérien NOTAM + ParachecK FFVL)
 * - Plongée / Apnée (garde-fou matériel Apple Watch Ultra / ordinateur de plongée obligatoire)
 * - Rameur Indoor (FTMS 0x1826 + allure /500m) & Aviron Outdoor (/500m + CROSS 196).
 */
export const V3_ACTIVITY_PROFILES: readonly ActivityProfileSpec[] = [
  // 1. Voile (Sailing)
  mergeV3(BASE_HIKE, {
    identity: {
      slugId: 'sailing',
      legacySport: 'kayak',
      legacyVariantId: 'voile',
      legacySlugAliases: ['voile', 'sailing', 'deriveur', 'habitable'],
      familyId: 'nautical_wind_glide',
      labelFr: 'Voile (Dériveur & Habitable)',
      shortLabelFr: 'Voile',
      environment: 'water',
      mappings: { healthKitActivityType: 'sailing', stravaSportType: 'Sail', garminFitSport: 32 },
    },
    acquisition: { pipeline: 'gps_water', barometer: { enabled: false, hysteresisM: 0, demRecalibrationIntervalS: 0, demMaxDriftDeltaM: 0 } },
    algorithms: { primarySpeedUnit: 'knots', secondarySpeedUnit: 'km_per_h', elevationGainAlgorithm: 'none', metFallback: 3.5 },
    ui: { preflightChecks: ['gps_lock', 'tides_marine', 'weather_wind', 'beacon_prompt'] },
    environment: { defaultMapStyle: 'marine_nautical', weatherEndpoints: ['open_meteo_marine', 'shom_refmar'], emergencyProtocol: 'maritime_cross_196' },
  }),

  // 2. Surf & Bodyboard
  mergeV3(BASE_HIKE, {
    identity: {
      slugId: 'surf_bodyboard',
      legacySport: 'kayak',
      legacyVariantId: 'surf-bodyboard',
      legacySlugAliases: ['surf-bodyboard', 'surf', 'bodyboard'],
      familyId: 'nautical_wind_glide',
      labelFr: 'Surf & Bodyboard',
      shortLabelFr: 'Surf',
      environment: 'water',
      mappings: { healthKitActivityType: 'surfingSports', stravaSportType: 'Surfing', garminFitSport: 38 },
    },
    acquisition: { pipeline: 'gps_water', barometer: { enabled: false, hysteresisM: 0, demRecalibrationIntervalS: 0, demMaxDriftDeltaM: 0 } },
    algorithms: { primarySpeedUnit: 'knots', secondarySpeedUnit: 'km_per_h', elevationGainAlgorithm: 'none', metFallback: 4.5 },
    ui: { preflightChecks: ['gps_lock', 'tides_marine', 'weather_wind'] },
    environment: { defaultMapStyle: 'marine_nautical', weatherEndpoints: ['open_meteo_marine', 'shom_refmar'], emergencyProtocol: 'maritime_cross_196' },
  }),

  // 3. Kitesurf / Windsurf / Wingfoil
  mergeV3(BASE_HIKE, {
    identity: {
      slugId: 'kite_wind_wing',
      legacySport: 'kayak',
      legacyVariantId: 'kitesurf-windsurf-wing',
      legacySlugAliases: ['kitesurf-windsurf-wing', 'kitesurf', 'windsurf', 'wingfoil'],
      familyId: 'nautical_wind_glide',
      labelFr: 'Kitesurf, Windsurf & Wingfoil',
      shortLabelFr: 'Kite / Wing',
      environment: 'water',
      mappings: { healthKitActivityType: 'surfingSports', stravaSportType: 'Kitesurf', garminFitSport: 44 },
    },
    acquisition: { pipeline: 'gps_water', barometer: { enabled: false, hysteresisM: 0, demRecalibrationIntervalS: 0, demMaxDriftDeltaM: 0 } },
    algorithms: {
      primarySpeedUnit: 'knots',
      secondarySpeedUnit: 'km_per_h',
      elevationGainAlgorithm: 'none',
      antiCheat: { leaderboardEligible: true, maxSustainedSpeedKmh: 85, maxInstantSpeedKmh: 110, maxVamMH: 500, vehicleAutoCropEnabled: false, motorAssistIsolatedCategory: false, liftDetectionEnabled: false },
      metFallback: 6.5,
    },
    ui: { preflightChecks: ['gps_lock', 'tides_marine', 'weather_wind', 'beacon_prompt'] },
    environment: { defaultMapStyle: 'marine_nautical', weatherEndpoints: ['open_meteo_marine', 'shom_refmar'], emergencyProtocol: 'maritime_cross_196' },
  }),

  // 4. Parapente & Hike & Fly (ParachecK FFVL + NOTAM + Vario)
  mergeV3(BASE_ALPI, {
    identity: {
      slugId: 'paragliding_hike_fly',
      legacySport: 'escalade',
      legacyVariantId: 'parapente-vol-libre',
      legacySlugAliases: ['parapente-vol-libre', 'parapente', 'hike-and-fly'],
      familyId: 'nautical_wind_glide',
      labelFr: 'Parapente & Hike & Fly (FFVL)',
      shortLabelFr: 'Parapente',
      environment: 'air',
      mappings: { healthKitActivityType: 'other', stravaSportType: 'Workout', garminFitSport: 43 },
    },
    acquisition: {
      pipeline: 'gps_baro_alpine',
      clActivityType: 'airborne',
      barometer: { enabled: true, hysteresisM: 1.0, demRecalibrationIntervalS: 60, demMaxDriftDeltaM: 15 },
    },
    algorithms: {
      primarySpeedUnit: 'km_per_h',
      secondarySpeedUnit: 'm_per_h_vam',
      autoPause: { defaultEnabled: false, lockDisabledBySafety: true, speedThresholdMs: 0, triggerDelayS: 0, resumeDelayS: 0 },
      antiCheat: { leaderboardEligible: false, maxSustainedSpeedKmh: 120, maxInstantSpeedKmh: 160, maxVamMH: 4000, vehicleAutoCropEnabled: false, motorAssistIsolatedCategory: false, liftDetectionEnabled: false },
      metFallback: 3.5,
    },
    ui: { preflightChecks: ['gps_lock', 'baro_cal', 'airspace_notam', 'weather_wind', 'beacon_prompt'] },
    gearAndEpi: {
      gearCategoryCodes: ['paraglider_wing_ffvl', 'reserve_parachute_paracheck', 'harness'],
      wearUnit: 'hours',
      defaultWearThresholds: [
        { componentKey: 'reserve_parachute_paracheck', warnAt: 10, criticalAt: 12, unit: 'months', normRef: 'FFVL ParachecK' },
      ],
      epiControlMandatory: true,
    },
  }),

  // 5. Plongée & Apnée (Garde-fou Hardware Apple Watch Ultra / Ordi Plongée — jamais téléphone nu)
  mergeV3(BASE_MANUAL, {
    identity: {
      slugId: 'diving_freediving',
      legacySport: 'kayak',
      legacyVariantId: 'plongee-apnee',
      legacySlugAliases: ['plongee-apnee', 'plongee', 'apnee', 'diving', 'freediving'],
      familyId: 'swimming_aquatic',
      labelFr: 'Plongée & Apnée (Import Montre / Ordi)',
      shortLabelFr: 'Plongée',
      environment: 'water',
      mappings: { healthKitActivityType: 'underwaterDiving', healthKitLocationType: 'outdoor', stravaSportType: 'Workout', garminFitSport: 53 },
    },
    acquisition: { pipeline: 'manual_import', gpsRequired: false },
    algorithms: {
      primarySpeedUnit: 'duration_only',
      loadModelPrimary: 'foster_srpe',
      antiCheat: { leaderboardEligible: false, maxSustainedSpeedKmh: 0, maxInstantSpeedKmh: 0, maxVamMH: 0, vehicleAutoCropEnabled: false, motorAssistIsolatedCategory: false, liftDetectionEnabled: false },
      metFallback: 5.5,
    },
    environment: { defaultMapStyle: 'marine_nautical', weatherEndpoints: ['open_meteo_marine', 'shom_refmar'], emergencyProtocol: 'maritime_cross_196' },
    gearAndEpi: {
      gearCategoryCodes: ['dive_computer_en13319', 'regulator', 'bcd'],
      wearUnit: 'cycles',
      defaultWearThresholds: [
        { componentKey: 'regulator', warnAt: 80, criticalAt: 100, unit: 'cycles', normRef: 'EN 250' },
      ],
      epiControlMandatory: true,
    },
  }),

  // 6. Rameur Indoor (Concept2 / FTMS 0x1826 + /500m)
  mergeV3(BASE_MANUAL, {
    identity: {
      slugId: 'indoor_rowing',
      legacySport: 'kayak',
      legacyVariantId: 'rameur-indoor',
      legacySlugAliases: ['rameur-indoor', 'rameur', 'ergometre', 'concept2'],
      familyId: 'indoor_strength_cardio',
      labelFr: 'Rameur Indoor (FTMS /500 m)',
      shortLabelFr: 'Rameur',
      environment: 'indoor',
      mappings: {
        healthKitActivityType: 'rowing',
        healthKitLocationType: 'indoor',
        healthKitMetadataKeys: ['HKMetadataKeyIndoorWorkout'],
        stravaSportType: 'Rowing',
        garminFitSport: 15,
        garminFitSubSport: 14,
      },
    },
    acquisition: {
      pipeline: 'indoor_no_gps',
      gpsRequired: false,
      bleServices: { recommended: ['0x1826', '0x180D'], optional: [], autoReconnectTimeoutS: 20 },
    },
    algorithms: { primarySpeedUnit: 'min_per_500m', secondarySpeedUnit: 'watts', loadModelPrimary: 'banister_trimp_hr', metFallback: 8.5 },
    environment: { defaultMapStyle: 'none_indoor', weatherEndpoints: [], emergencyProtocol: 'indoor_basic' },
  }),

  // 7. Aviron Outdoor (Eau + /500m)
  mergeV3(BASE_HIKE, {
    identity: {
      slugId: 'rowing_outdoor',
      legacySport: 'kayak',
      legacyVariantId: 'aviron',
      legacySlugAliases: ['aviron', 'rowing'],
      familyId: 'nautical_wind_glide',
      labelFr: 'Aviron Outdoor (/500 m)',
      shortLabelFr: 'Aviron',
      environment: 'water',
      mappings: { healthKitActivityType: 'rowing', healthKitLocationType: 'outdoor', stravaSportType: 'Rowing', garminFitSport: 15 },
    },
    acquisition: { pipeline: 'gps_water', barometer: { enabled: false, hysteresisM: 0, demRecalibrationIntervalS: 0, demMaxDriftDeltaM: 0 } },
    algorithms: { primarySpeedUnit: 'min_per_500m', secondarySpeedUnit: 'km_per_h', elevationGainAlgorithm: 'none', metFallback: 8.5 },
    environment: { defaultMapStyle: 'marine_nautical', weatherEndpoints: ['open_meteo_hourly'], emergencyProtocol: 'standard_112_114' },
  }),
];
