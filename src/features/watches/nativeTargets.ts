/**
 * Diagnostic du périmètre natif Apple Watch (WatchKit / WatchConnectivity) et
 * Wear OS / Galaxy Watch (Gradle `:wear` / Wear DataLayer / Health Services),
 * matrice de compatibilité matérielle et résolution explicite des capacités.
 *
 * Invariant D03 :
 * - Si aucune cible Xcode WatchKit (`com.apple.product-type.application.watchapp2`)
 *   ni module Gradle Wear OS (`:wear`) n'est présent dans le dépôt ou injecté
 *   au runtime, l'état renvoyé est explicitement `native_target_unavailable`
 *   (fail-closed, aucune simulation silencieuse de montre connectée).
 */

import type {
  MissingNativeTargetDetail,
  WatchCapabilityKey,
  WatchCapabilityMatrix,
  WatchCompatibilityMatrixEntry,
  WatchDeviceProfile,
  WatchNativeTargetDiagnostic,
  WatchPlatform,
} from './types';

export const NATIVE_WATCH_PERIMETER_REPORT: ReadonlyArray<MissingNativeTargetDetail> = [
  {
    platform: 'apple_watch',
    expectedProjectPath: 'ios/App/App.xcodeproj (cible WatchKit App + Extension)',
    expectedTargetType: 'com.apple.product-type.application.watchapp2',
    presentInRepo: false,
    missingComponents: [
      'Cible Xcode WatchKit (`LkdvWatchApp` / `com.apple.product-type.application.watchapp2`) absente de `ios/App/App.xcodeproj/project.pbxproj` (seule la cible iOS `App` et `LkdvLiveActivityPlugin` ActivityKit sont présentes)',
      'Plugin Capacitor iOS `LkdvWatchConnectivityPlugin.swift` (`WCSessionDelegate`, `transferUserInfo`, `transferFile`, `sendMessage`)',
      'Service watchOS autonome `HKWorkoutSession` + `HKLiveWorkoutBuilder` + `HKWorkoutRouteBuilder` pour la capture GPS/cardio hors téléphone',
      'Lecteur local de tuiles/itinéraires MapLibre Native / PMTiles sur watchOS',
    ],
  },
  {
    platform: 'wear_os',
    expectedProjectPath: 'android/wear/build.gradle (module `:wear` dans `android/settings.gradle`)',
    expectedTargetType: 'com.android.application (Wear OS)',
    presentInRepo: false,
    missingComponents: [
      'Module Gradle `:wear` absent de `android/settings.gradle` (seuls `:app` et `:capacitor-cordova-android-plugins` sont déclarés)',
      'Plugin Capacitor Android `LkdvWearDataLayerPlugin` (`Wearable.getDataClient`, `MessageClient`, `ChannelClient`)',
      'Service autonome Wear OS `ExerciseClient` (Android Health Services) + `ForegroundService` GPS hors téléphone',
      'Stockage local Room / fichiers PMTiles pour les paquets hors ligne sur Wear OS',
    ],
  },
  {
    platform: 'galaxy_watch',
    expectedProjectPath: 'android/wear/build.gradle (profil Wear OS / One UI Watch Samsung)',
    expectedTargetType: 'com.android.application (Wear OS 3.5+ / One UI Watch)',
    presentInRepo: false,
    missingComponents: [
      'Module Gradle `:wear` compatible Galaxy Watch 4/5/6/7/Ultra (Wear OS powered by Samsung)',
      'Déclaration des permissions `BODY_SENSORS`, `ACCESS_FINE_LOCATION`, `FOREGROUND_SERVICE_LOCATION` côté montre',
      'Pont DataLayer compagnon vers l’application Android LKDV',
    ],
  },
] as const;

export const WATCH_COMPATIBILITY_MATRIX: ReadonlyArray<WatchCompatibilityMatrixEntry> = [
  {
    platform: 'apple_watch',
    vendor: 'Apple',
    modelsSupported: [
      'Apple Watch Series 6+',
      'Apple Watch SE (2e gén.)',
      'Apple Watch Ultra / Ultra 2',
    ],
    minOsVersion: '10.0',
    transportChannel: 'watch_connectivity',
    nativeApis: [
      'WatchConnectivity (WCSession)',
      'HealthKit (HKWorkoutSession, HKWorkoutRouteBuilder)',
      'CoreLocation (CLLocationManager)',
    ],
    ficheRefs: ['K6.09', 'K6.10', 'S6.01'],
  },
  {
    platform: 'wear_os',
    vendor: 'Google / Wear OS',
    modelsSupported: [
      'Pixel Watch / Pixel Watch 2 / Pixel Watch 3',
      'Suunto 7 / Montres Wear OS 3.5+',
      'OnePlus Watch 2 / Xiaomi Watch 2 Pro',
    ],
    minOsVersion: '3.5',
    transportChannel: 'wear_data_layer',
    nativeApis: [
      'Play Services Wearable DataLayer (DataClient, MessageClient, ChannelClient)',
      'Health Services ExerciseClient',
      'FusedLocationProviderClient',
    ],
    ficheRefs: ['K6.11', 'S6.02'],
  },
  {
    platform: 'galaxy_watch',
    vendor: 'Samsung',
    modelsSupported: [
      'Galaxy Watch 4 / 4 Classic',
      'Galaxy Watch 5 / 5 Pro',
      'Galaxy Watch 6 / 6 Classic',
      'Galaxy Watch 7 / Galaxy Watch Ultra',
    ],
    minOsVersion: '4.0',
    transportChannel: 'wear_data_layer',
    nativeApis: [
      'Play Services Wearable DataLayer',
      'Health Services ExerciseClient (One UI Watch)',
      'Samsung / Android Dual-Frequency GNSS',
    ],
    ficheRefs: ['K6.11', 'S6.02'],
  },
] as const;

export interface InspectWatchNativeTargetsOptions {
  xcodeWatchKitTargetPresent?: boolean;
  wearOsGradleModulePresent?: boolean;
  runtimeBridgeInjected?: boolean;
  nowIso?: string;
}

/**
 * Inspecte l'état des cibles natives Apple Watch / Wear OS.
 * Par défaut (état réel du dépôt LKDV à la révision courante), aucune cible
 * WatchKit ni module Gradle `:wear` n'est compilé dans le dépôt : renvoie
 * explicitement `status: 'native_target_unavailable'`.
 */
export function inspectWatchNativeTargets(
  options: InspectWatchNativeTargetsOptions = {},
): WatchNativeTargetDiagnostic {
  const xcodeWatchKitTargetPresent = options.xcodeWatchKitTargetPresent === true;
  const wearOsGradleModulePresent = options.wearOsGradleModulePresent === true;
  const runtimeBridgeInjected = options.runtimeBridgeInjected === true;
  const checkedAtIso = options.nowIso ?? new Date().toISOString();

  const missingTargets = NATIVE_WATCH_PERIMETER_REPORT.filter((entry) => {
    if (entry.platform === 'apple_watch') return !xcodeWatchKitTargetPresent;
    return !wearOsGradleModulePresent;
  }).map((entry) => ({
    ...entry,
    presentInRepo:
      entry.platform === 'apple_watch' ? xcodeWatchKitTargetPresent : wearOsGradleModulePresent,
  }));

  const hasAnyNativeTarget =
    (xcodeWatchKitTargetPresent || wearOsGradleModulePresent) && runtimeBridgeInjected;

  if (!hasAnyNativeTarget) {
    return {
      status: 'native_target_unavailable',
      checkedAtIso,
      xcodeWatchKitTargetPresent,
      wearOsGradleModulePresent,
      runtimeBridgeInjected,
      missingTargets,
      summary:
        'Aucune cible native Xcode WatchKit (`watchapp2`) ni module Gradle Wear OS (`:wear`) active : ' +
        'le contrat TypeScript, le protocole compagnon et la file hors ligne sont opérationnels, ' +
        'mais la surface matérielle remonte explicitement `native_target_unavailable`.',
    };
  }

  return {
    status: 'available',
    checkedAtIso,
    xcodeWatchKitTargetPresent,
    wearOsGradleModulePresent,
    runtimeBridgeInjected,
    missingTargets,
    summary: 'Pont compagnon natif montre disponible.',
  };
}

export function getSupportedWatchMatrix(
  platform?: WatchPlatform,
): ReadonlyArray<WatchCompatibilityMatrixEntry> {
  if (!platform) return WATCH_COMPATIBILITY_MATRIX;
  return WATCH_COMPATIBILITY_MATRIX.filter((entry) => entry.platform === platform);
}

/**
 * Compare deux versions `major.minor` (ex. `"10.2"` >= `"10.0"`).
 */
export function isWatchOsVersionSupported(
  platform: WatchPlatform,
  osVersion: string,
): boolean {
  const entry = WATCH_COMPATIBILITY_MATRIX.find((item) => item.platform === platform);
  if (!entry) return false;
  const parseParts = (raw: string): [number, number] | null => {
    const cleaned = raw.trim().replace(/^v/i, '');
    const match = /^(\d+)(?:\.(\d+))?/.exec(cleaned);
    if (!match) return null;
    return [Number(match[1]), Number(match[2] ?? '0')];
  };
  const current = parseParts(osVersion);
  const minimum = parseParts(entry.minOsVersion);
  if (!current || !minimum) return false;
  if (current[0] !== minimum[0]) return current[0] > minimum[0];
  return current[1] >= minimum[1];
}

const ALL_CAPABILITY_KEYS: readonly WatchCapabilityKey[] = [
  'autonomous_gps_recording',
  'offline_map_pack',
  'turn_by_turn_guidance',
  'live_sync_fields',
  'upcoming_pois',
  'offline_session_queue',
  'workout_session_recovery',
  'heart_rate_sensor',
];

/**
 * Résout la matrice de capacités réelle d'une montre en tenant compte :
 * 1. de la présence effective de la cible native (`native_target_unavailable`) ;
 * 2. de la compatibilité de version d'OS ;
 * 3. du GPS intégré et de l'espace de stockage ;
 * 4. des permissions (y compris l'opacité de lecture HealthKit sur Apple Watch,
 *    qui renvoie `indeterminate` plutôt qu'un faux refus).
 */
export function resolveWatchPlatformCapabilities(
  profile: WatchDeviceProfile | null,
  diagnostic: WatchNativeTargetDiagnostic = inspectWatchNativeTargets(),
): WatchCapabilityMatrix {
  const buildUniform = (
    state: WatchCapabilityMatrix[WatchCapabilityKey],
  ): WatchCapabilityMatrix => {
    const out = {} as WatchCapabilityMatrix;
    for (const key of ALL_CAPABILITY_KEYS) {
      out[key] = state;
    }
    return out;
  };

  if (diagnostic.status === 'native_target_unavailable' || !profile) {
    return buildUniform('native_target_unavailable');
  }

  const targetPresentForPlatform =
    profile.platform === 'apple_watch'
      ? diagnostic.xcodeWatchKitTargetPresent && diagnostic.runtimeBridgeInjected
      : diagnostic.wearOsGradleModulePresent && diagnostic.runtimeBridgeInjected;

  if (!targetPresentForPlatform) {
    return buildUniform('native_target_unavailable');
  }

  if (!isWatchOsVersionSupported(profile.platform, profile.osVersion)) {
    return buildUniform('unsupported');
  }

  const locationGranted =
    profile.permissions.locationAlwaysOrWorkout === 'granted' ||
    profile.permissions.locationWhenInUse === 'granted';
  const workoutWriteGranted = profile.permissions.healthWorkoutWrite === 'granted';

  const autonomousGpsState: WatchCapabilityMatrix['autonomous_gps_recording'] = !profile.hasBuiltInGps
    ? 'unsupported'
    : !locationGranted || !workoutWriteGranted
      ? 'consent_required'
      : 'available';

  const hasEnoughStorageForMap = profile.storageAvailableBytes >= 16 * 1024 * 1024; // 16 Mo min
  const offlineMapState: WatchCapabilityMatrix['offline_map_pack'] = hasEnoughStorageForMap
    ? 'available'
    : 'degraded';

  // Recherche 08 : sur Apple Watch, HealthKit ne permet pas de distinguer un refus
  // de lecture d'une série vide ; on propage `indeterminate` si tel est le cas.
  let heartRateState: WatchCapabilityMatrix['heart_rate_sensor'];
  if (profile.permissions.healthMetricsRead === 'granted') {
    heartRateState = 'available';
  } else if (profile.permissions.healthMetricsRead === 'indeterminate') {
    heartRateState = 'indeterminate';
  } else {
    heartRateState = 'consent_required';
  }

  return {
    autonomous_gps_recording: autonomousGpsState,
    offline_map_pack: offlineMapState,
    turn_by_turn_guidance: locationGranted ? 'available' : 'consent_required',
    live_sync_fields: 'available',
    upcoming_pois: 'available',
    offline_session_queue: 'available',
    workout_session_recovery: workoutWriteGranted ? 'available' : 'consent_required',
    heart_rate_sensor: heartRateState,
  };
}
