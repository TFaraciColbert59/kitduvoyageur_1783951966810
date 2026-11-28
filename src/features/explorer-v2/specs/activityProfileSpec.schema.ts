import { z } from 'zod';

const SPORT_FAMILY_ENUM = z.enum([
  'running_trail',
  'hiking_trekking',
  'cycling_mobility',
  'alpinism_vertical',
  'snow_winter',
  'swimming_aquatic',
  'nautical_wind_glide',
  'indoor_strength_cardio',
  'rehab_wellness',
  'multisport_transverse',
]);

const PIPELINE_ENUM = z.enum([
  'gps_outdoor',
  'gps_baro_alpine',
  'gps_water',
  'indoor_no_gps',
  'hybrid_sensor',
  'manual_import',
]);

const SPEED_UNIT_ENUM = z.enum([
  'min_per_km',
  'km_per_h',
  'm_per_h_vam',
  'knots',
  'min_per_100m',
  'min_per_500m',
  'watts',
  'reps_tonnage',
  'duration_only',
]);

const LOAD_MODEL_ENUM = z.enum([
  'banister_trimp_hr',
  'foster_srpe',
  'coggan_tss_power',
  'rtss_gap_pace',
  'volume_load_tonnage',
  'none_excluded',
]);

const BLE_UUID_ENUM = z.enum(['0x180D', '0x1814', '0x1816', '0x1818', '0x1826']);

const LIVE_INTENT_ENUM = z.enum([
  'toggle_pause',
  'add_waypoint',
  'mark_lap_split',
  'log_strength_set',
  'mark_transition',
  'trigger_sos_sheet',
]);

const COCKPIT_VIEW_ENUM = z.enum([
  'map_3kpi',
  'cockpit_grid',
  'elevation_profile',
  'strength_logger_hevy',
  'pool_laps_swolf',
  'ski_runs_lifts',
  'multisport_legs',
]);

export const ActivityProfileSpecSchema = z
  .object({
    specVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    rolloutWave: z.enum(['V1_SOCLE', 'V2_SPECIALIZED', 'V3_HARDWARE_PRO']),
    identity: z.object({
      slugId: z.string().regex(/^[a-z0-9_]{3,40}$/),
      legacySport: z.enum([
        'rando',
        'trail',
        'velo',
        'course',
        'escalade',
        'ski',
        'kayak',
        'bivouac',
        'famille',
      ]),
      legacyVariantId: z.string().min(2).max(64),
      legacySlugAliases: z.array(z.string().min(1)),
      familyId: SPORT_FAMILY_ENUM,
      labelFr: z.string().min(2).max(80),
      shortLabelFr: z.string().min(2).max(16),
      sfSymbol: z.string().min(2).max(60),
      accentHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      environment: z.enum(['outdoor', 'indoor', 'hybrid', 'water', 'snow', 'air']),
      mappings: z.object({
        healthKitActivityType: z.string().min(2),
        healthKitLocationType: z.enum(['outdoor', 'indoor', 'unknown']),
        healthKitMetadataKeys: z.array(z.string()),
        healthConnectExerciseType: z.string().min(2),
        garminFitSport: z.number().int().min(0).max(255),
        garminFitSubSport: z.number().int().min(0).max(255),
        stravaSportType: z.string().min(2),
        komootSportKey: z.string().nullable(),
      }),
    }),
    acquisition: z.object({
      pipeline: PIPELINE_ENUM,
      clActivityType: z.enum(['fitness', 'otherNavigation', 'airborne', 'other']),
      gpsRequired: z.boolean(),
      gpsDesiredAccuracyM: z.union([z.literal(0), z.literal(5), z.literal(10), z.literal(25)]),
      distanceFilterStandardM: z.number().min(0).max(50),
      distanceFilterEcoM: z.number().min(0).max(100),
      sampleIntervalStandardMs: z.number().int().min(0).max(30_000),
      sampleIntervalEcoMs: z.number().int().min(0).max(60_000),
      maxHorizontalAccuracyM: z.number().min(0).max(200),
      barometer: z.object({
        enabled: z.boolean(),
        hysteresisM: z.number().min(0).max(10),
        demRecalibrationIntervalS: z.number().int().min(0).max(3600),
        demMaxDriftDeltaM: z.number().min(0).max(50),
      }),
      pedometerEnabled: z.boolean(),
      motionVehicleDetection: z.boolean(),
      bleServices: z.object({
        recommended: z.array(BLE_UUID_ENUM),
        optional: z.array(BLE_UUID_ENUM),
        autoReconnectTimeoutS: z.number().int().min(0).max(120),
      }),
      offlineTilePreloadRadiusKm: z.number().min(0).max(100),
    }),
    algorithms: z.object({
      primarySpeedUnit: SPEED_UNIT_ENUM,
      secondarySpeedUnit: SPEED_UNIT_ENUM.nullable(),
      loadModelPrimary: LOAD_MODEL_ENUM,
      loadModelFallback: LOAD_MODEL_ENUM,
      gapMinetti: z.object({
        enabled: z.boolean(),
        gradeClampMinPct: z.number().min(-60).max(0),
        gradeClampMaxPct: z.number().min(0).max(60),
        smoothingWindowM: z.number().min(0).max(500),
      }),
      elevationGainAlgorithm: z.enum(['baro_hysteresis_dem_anchor', 'dem_only', 'none']),
      autoPause: z.object({
        defaultEnabled: z.boolean(),
        lockDisabledBySafety: z.boolean(),
        speedThresholdMs: z.number().min(0).max(10),
        triggerDelayS: z.number().int().min(0).max(120),
        resumeDelayS: z.number().int().min(0).max(60),
      }),
      antiCheat: z.object({
        leaderboardEligible: z.boolean(),
        maxSustainedSpeedKmh: z.number().min(0).max(200),
        maxInstantSpeedKmh: z.number().min(0).max(300),
        maxVamMH: z.number().min(0).max(5000),
        vehicleAutoCropEnabled: z.boolean(),
        motorAssistIsolatedCategory: z.boolean(),
        liftDetectionEnabled: z.boolean(),
      }),
      metFallback: z.number().min(1).max(25),
    }),
    ui: z.object({
      preflightChecks: z.array(z.string()),
      mapCapsule3Kpis: z.tuple([z.string(), z.string(), z.string()]),
      cockpitGridFields: z.array(z.string()).min(4).max(6),
      availableViews: z.array(COCKPIT_VIEW_ENUM).min(1),
      defaultView: COCKPIT_VIEW_ENUM,
      dynamicIsland: z.object({
        compactLeadingMetric: z.string(),
        compactTrailingMetric: z.string(),
        expanded4Metrics: z.tuple([z.string(), z.string(), z.string(), z.string()]),
        intents: z.tuple([LIVE_INTENT_ENUM, LIVE_INTENT_ENUM]),
        staleTimeoutS: z.number().int().min(15).max(900),
      }),
      voiceAnnouncementIntervalKmOrMin: z.object({
        unit: z.enum(['km', 'min', 'lap', 'none']),
        step: z.number().min(0),
      }),
      summaryHighlights: z.array(z.string()).min(3).max(8),
      summarySpecialActions: z.array(z.string()),
    }),
    environment: z.object({
      defaultMapStyle: z.enum([
        'ign_topo_outdoor',
        'ign_scan25_alpine',
        'open_cycle_gravel',
        'mtb_singletrack',
        'winter_slope_30deg',
        'marine_nautical',
        'none_indoor',
      ]),
      defaultOverlays: z.array(z.string()),
      weatherEndpoints: z.array(
        z.enum([
          'open_meteo_hourly',
          'meteo_france_bra',
          'open_meteo_marine',
          'shom_refmar',
          'vigilance_mf',
        ]),
      ),
      emergencyProtocol: z.enum([
        'standard_112_114',
        'mountain_pghm_112_sat',
        'maritime_cross_196',
        'indoor_basic',
      ]),
      pokedexPromptEnabled: z.boolean(),
    }),
    gearAndEpi: z.object({
      gearCategoryCodes: z.array(z.string()),
      wearUnit: z.enum(['km', 'hours', 'cycles', 'falls_and_years', 'none']),
      defaultWearThresholds: z.array(
        z.object({
          componentKey: z.string(),
          warnAt: z.number().positive(),
          criticalAt: z.number().positive(),
          unit: z.enum(['km', 'hours', 'years', 'cycles', 'months']),
          normRef: z.string().nullable(),
        }),
      ),
      epiControlMandatory: z.boolean(),
    }),
    privacyAndCompliance: z.object({
      defaultVisibility: z.enum(['private', 'followers', 'club', 'public']),
      epzMode: z.enum(['single_home', 'dual_home_work', 'none_indoor']),
      epzRadiusMinM: z.number().int().min(0).max(5000),
      epzRadiusDefaultM: z.number().int().min(0).max(5000),
      heatmapEligibleDefault: z.boolean(),
      rgpdArt9SensitiveHealth: z.boolean(),
      aiInsightAllowedDefault: z.boolean(),
      retentionPolicyDays: z.number().int().positive().nullable(),
    }),
  })
  .superRefine((spec, ctx) => {
    if (spec.privacyAndCompliance.rgpdArt9SensitiveHealth) {
      if (spec.privacyAndCompliance.defaultVisibility !== 'private') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'RGPD Art. 9 profiles must default to private visibility',
        });
      }
      if (spec.privacyAndCompliance.aiInsightAllowedDefault) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'RGPD Art. 9 profiles must block third-party AI insight by default',
        });
      }
      if (spec.algorithms.antiCheat.leaderboardEligible) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'RGPD Art. 9 profiles cannot be leaderboard eligible',
        });
      }
    }
    if (
      (spec.identity.slugId === 'running' || spec.identity.slugId === 'trail_running') &&
      spec.algorithms.primarySpeedUnit === 'km_per_h'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Anti-km/h rule: running/trail must use min_per_km as primary unit',
      });
    }
  });
