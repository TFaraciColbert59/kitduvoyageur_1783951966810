import type { Sport } from '../state/types';

export type SportFamilyId =
  | 'running_trail'
  | 'hiking_trekking'
  | 'cycling_mobility'
  | 'alpinism_vertical'
  | 'snow_winter'
  | 'swimming_aquatic'
  | 'nautical_wind_glide'
  | 'indoor_strength_cardio'
  | 'rehab_wellness'
  | 'multisport_transverse';

export type AcquisitionPipelineId =
  | 'gps_outdoor'
  | 'gps_baro_alpine'
  | 'gps_water'
  | 'indoor_no_gps'
  | 'hybrid_sensor'
  | 'manual_import';

export type RolloutWave = 'V1_SOCLE' | 'V2_SPECIALIZED' | 'V3_HARDWARE_PRO';

export type PrimarySpeedUnit =
  | 'min_per_km'
  | 'km_per_h'
  | 'm_per_h_vam'
  | 'knots'
  | 'min_per_100m'
  | 'min_per_500m'
  | 'watts'
  | 'reps_tonnage'
  | 'duration_only';

export type LoadModelId =
  | 'banister_trimp_hr'
  | 'foster_srpe'
  | 'coggan_tss_power'
  | 'rtss_gap_pace'
  | 'volume_load_tonnage'
  | 'none_excluded';

export type BleGattServiceUuid =
  | '0x180D'
  | '0x1814'
  | '0x1816'
  | '0x1818'
  | '0x1826';

export type LiveActivityIntentId =
  | 'toggle_pause'
  | 'add_waypoint'
  | 'mark_lap_split'
  | 'log_strength_set'
  | 'mark_transition'
  | 'trigger_sos_sheet';

export type HealthKitMetadataKey =
  | 'HKMetadataKeyIndoorWorkout'
  | 'HKMetadataKeyElevationAscended'
  | 'HKMetadataKeyElevationDescended'
  | 'HKMetadataKeySwimmingLocationType'
  | 'HKMetadataKeyLapLength'
  | 'HKMetadataKeySWOLFScore'
  | 'HKMetadataKeyAlpineSlopeGrade'
  | 'HKMetadataKeyAverageMETs'
  | 'HKMetadataKeyWeatherTemperature'
  | 'HKMetadataKeyWeatherHumidity';

export type CockpitViewMode =
  | 'map_3kpi'
  | 'cockpit_grid'
  | 'elevation_profile'
  | 'strength_logger_hevy'
  | 'pool_laps_swolf'
  | 'ski_runs_lifts'
  | 'multisport_legs';

export type PreflightCheckKey =
  | 'gps_lock'
  | 'baro_cal'
  | 'kit_picker'
  | 'weather_wind'
  | 'bera_avalanche'
  | 'tides_marine'
  | 'airspace_notam'
  | 'ble_sensors'
  | 'offline_map'
  | 'beacon_prompt'
  | 'commute_privacy_check'
  | 'pain_baseline_check';

export type SummarySpecialActionKey =
  | 'attach_carnet'
  | 'assign_gear'
  | 'auto_crop_vehicle'
  | 'dem_elevation_fix'
  | 'commute_co2_card'
  | 'log_pain_mobility_art9'
  | 'export_gpx_fit';

export interface MetricValue<T = number> {
  value: T;
  unit: string;
  coverage: number; // 0..1
  confidence: 'high' | 'medium' | 'low';
  modelVersion: string;
}

export interface ActivityProfileSpec {
  specVersion: string;
  rolloutWave: RolloutWave;

  identity: {
    slugId: string;
    legacySport: Sport;
    legacyVariantId: string;
    legacySlugAliases: readonly string[];
    familyId: SportFamilyId;
    labelFr: string;
    shortLabelFr: string;
    sfSymbol: string;
    accentHex: string;
    environment: 'outdoor' | 'indoor' | 'hybrid' | 'water' | 'snow' | 'air';
    mappings: {
      healthKitActivityType: string;
      healthKitLocationType: 'outdoor' | 'indoor' | 'unknown';
      healthKitMetadataKeys: readonly HealthKitMetadataKey[];
      healthConnectExerciseType: string;
      garminFitSport: number;
      garminFitSubSport: number;
      stravaSportType: string;
      komootSportKey: string | null;
    };
  };

  acquisition: {
    pipeline: AcquisitionPipelineId;
    clActivityType: 'fitness' | 'otherNavigation' | 'airborne' | 'other';
    gpsRequired: boolean;
    gpsDesiredAccuracyM: 0 | 5 | 10 | 25;
    distanceFilterStandardM: number;
    distanceFilterEcoM: number;
    sampleIntervalStandardMs: number;
    sampleIntervalEcoMs: number;
    maxHorizontalAccuracyM: number;
    barometer: {
      enabled: boolean;
      hysteresisM: number;
      demRecalibrationIntervalS: number;
      demMaxDriftDeltaM: number;
    };
    pedometerEnabled: boolean;
    motionVehicleDetection: boolean;
    bleServices: {
      recommended: readonly BleGattServiceUuid[];
      optional: readonly BleGattServiceUuid[];
      autoReconnectTimeoutS: number;
    };
    offlineTilePreloadRadiusKm: number;
  };

  algorithms: {
    primarySpeedUnit: PrimarySpeedUnit;
    secondarySpeedUnit: PrimarySpeedUnit | null;
    loadModelPrimary: LoadModelId;
    loadModelFallback: LoadModelId;
    gapMinetti: {
      enabled: boolean;
      gradeClampMinPct: number;
      gradeClampMaxPct: number;
      smoothingWindowM: number;
    };
    elevationGainAlgorithm: 'baro_hysteresis_dem_anchor' | 'dem_only' | 'none';
    autoPause: {
      defaultEnabled: boolean;
      lockDisabledBySafety: boolean;
      speedThresholdMs: number;
      triggerDelayS: number;
      resumeDelayS: number;
    };
    antiCheat: {
      leaderboardEligible: boolean;
      maxSustainedSpeedKmh: number;
      maxInstantSpeedKmh: number;
      maxVamMH: number;
      vehicleAutoCropEnabled: boolean;
      motorAssistIsolatedCategory: boolean;
      liftDetectionEnabled: boolean;
    };
    metFallback: number;
  };

  ui: {
    preflightChecks: readonly PreflightCheckKey[];
    mapCapsule3Kpis: readonly [string, string, string];
    cockpitGridFields: readonly string[];
    availableViews: readonly CockpitViewMode[];
    defaultView: CockpitViewMode;
    dynamicIsland: {
      compactLeadingMetric: string;
      compactTrailingMetric: string;
      expanded4Metrics: readonly [string, string, string, string];
      intents: readonly [LiveActivityIntentId, LiveActivityIntentId];
      staleTimeoutS: number;
    };
    voiceAnnouncementIntervalKmOrMin: {
      unit: 'km' | 'min' | 'lap' | 'none';
      step: number;
    };
    summaryHighlights: readonly string[];
    summarySpecialActions: readonly SummarySpecialActionKey[];
  };

  environment: {
    defaultMapStyle:
      | 'ign_topo_outdoor'
      | 'ign_scan25_alpine'
      | 'open_cycle_gravel'
      | 'mtb_singletrack'
      | 'winter_slope_30deg'
      | 'marine_nautical'
      | 'none_indoor';
    defaultOverlays: readonly string[];
    weatherEndpoints: readonly (
      | 'open_meteo_hourly'
      | 'meteo_france_bra'
      | 'open_meteo_marine'
      | 'shom_refmar'
      | 'vigilance_mf'
    )[];
    emergencyProtocol:
      | 'standard_112_114'
      | 'mountain_pghm_112_sat'
      | 'maritime_cross_196'
      | 'indoor_basic';
    pokedexPromptEnabled: boolean;
  };

  gearAndEpi: {
    gearCategoryCodes: readonly string[];
    wearUnit: 'km' | 'hours' | 'cycles' | 'falls_and_years' | 'none';
    defaultWearThresholds: readonly {
      componentKey: string;
      warnAt: number;
      criticalAt: number;
      unit: 'km' | 'hours' | 'years' | 'cycles' | 'months';
      normRef: string | null;
    }[];
    epiControlMandatory: boolean;
  };

  privacyAndCompliance: {
    defaultVisibility: 'private' | 'followers' | 'club' | 'public';
    epzMode: 'single_home' | 'dual_home_work' | 'none_indoor';
    epzRadiusMinM: number;
    epzRadiusDefaultM: number;
    heatmapEligibleDefault: boolean;
    rgpdArt9SensitiveHealth: boolean;
    aiInsightAllowedDefault: boolean;
    retentionPolicyDays: number | null;
  };
}
