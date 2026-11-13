/**
 * Lot D02 (S6.03, S6.06, S6.07) — Contrats TypeScript capteurs BLE & Santé.
 *
 * Invariants :
 * - Aucune donnée capteur simulée ni fréquence cardiaque/puissance inventée.
 * - Tout accès Santé exige un consentement granulaire P01 (S6.16) explicite.
 * - Sur web sans pont natif, l'état retourné est explicitement `native_bridge_unavailable`.
 */

export type HealthPlatform = 'ios' | 'android' | 'web';

export type HealthProvider = 'apple_healthkit' | 'android_health_connect';

/**
 * Scopes granulaires P01 (S6.16) pour la synchronisation Santé.
 * Chaque permission est accordée ou révoquée indépendamment.
 */
export type HealthConsentScope =
  | 'workouts_read'
  | 'workouts_write'
  | 'heart_rate_read'
  | 'heart_rate_write'
  | 'cadence_read'
  | 'power_read'
  | 'distance_read'
  | 'calories_write';

export interface HealthConsentGrant {
  scope: HealthConsentScope;
  granted: boolean;
  updatedAtMs: number;
  policyVersion: string;
  source: 'user_prompt' | 'settings' | 'system_revoked';
}

export interface HealthConsentState {
  policyVersion: string;
  grants: Record<HealthConsentScope, HealthConsentGrant>;
}

export type HealthBridgeStatus =
  | 'available'
  | 'native_bridge_unavailable'
  | 'permission_required'
  | 'permission_denied';

export interface HealthBridgeAvailability {
  platform: HealthPlatform;
  provider: HealthProvider | null;
  status: HealthBridgeStatus;
  reason?: string;
}

export interface HealthWorkoutRecord {
  /** Identifiant interne LKDV si la séance provient de LKDV. */
  lkdvSessionId?: string;
  /** Identifiant externe HealthKit (UUID) ou Health Connect (recordId). */
  externalId?: string;
  provider: HealthProvider;
  sport: string;
  startedAtMs: number;
  endedAtMs: number;
  distanceM: number | null;
  elevationGainM: number | null;
  activeCaloriesKcal: number | null;
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  avgPowerWatts: number | null;
  avgCadenceRpm: number | null;
  /** Empreinte canonique pour déduplication inter-sources. */
  fingerprint?: string;
}

export interface HealthWorkoutWriteInput {
  lkdvSessionId: string;
  sport: string;
  startedAtMs: number;
  endedAtMs: number;
  distanceM: number | null;
  elevationGainM: number | null;
  activeCaloriesKcal: number | null;
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  avgPowerWatts: number | null;
  avgCadenceRpm: number | null;
}

export type HealthSyncResult<T> =
  | {
      ok: true;
      status: 'available';
      provider: HealthProvider;
      data: T;
    }
  | {
      ok: false;
      status: 'native_bridge_unavailable' | 'consent_missing' | 'permission_denied' | 'bridge_error';
      missingScopes?: HealthConsentScope[];
      reason: string;
    };

export interface HealthWorkoutWriteResult {
  externalId: string;
  deduplicated: boolean;
}

export interface HealthWorkoutReadResult {
  workouts: HealthWorkoutRecord[];
  deduplicatedCount: number;
}

/**
 * Contrat d'adaptateur natif (iOS HealthKit / Android Health Connect).
 * Implémenté côté Capacitor natif ; sur web, retourne `native_bridge_unavailable`.
 */
export interface NativeHealthBridgeAdapter {
  readonly platform: HealthPlatform;
  readonly provider: HealthProvider | null;
  getAvailability(): Promise<HealthBridgeAvailability>;
  requestNativePermissions(scopes: HealthConsentScope[]): Promise<{
    granted: HealthConsentScope[];
    denied: HealthConsentScope[];
    unavailable?: boolean;
  }>;
  readWorkouts(params: {
    sinceMs: number;
    untilMs: number;
  }): Promise<HealthSyncResult<HealthWorkoutRecord[]>>;
  writeWorkout(
    workout: HealthWorkoutWriteInput,
    existingExternalIds: ReadonlySet<string>,
  ): Promise<HealthSyncResult<HealthWorkoutWriteResult>>;
}

// ============================================================================
// BLE GATT (S6.06, S6.07)
// ============================================================================

export const BLE_GATT_SERVICES = {
  HEART_RATE: 0x180d,
  RUNNING_SPEED_AND_CADENCE: 0x1814,
  CYCLING_SPEED_AND_CADENCE: 0x1816,
  CYCLING_POWER: 0x1818,
  BATTERY: 0x180f,
} as const;

export const BLE_GATT_CHARACTERISTICS = {
  HEART_RATE_MEASUREMENT: 0x2a37,
  RSC_MEASUREMENT: 0x2a53,
  CSC_MEASUREMENT: 0x2a5b,
  CYCLING_POWER_MEASUREMENT: 0x2a63,
  BATTERY_LEVEL: 0x2a19,
} as const;

export type BleServiceKind = 'heart_rate' | 'cycling_sc' | 'cycling_power' | 'running_sc';

export type SensorContactStatus = 'not_supported' | 'no_contact' | 'contact_detected';

export interface DecodedHeartRateFrame {
  kind: 'heart_rate';
  heartRateBpm: number;
  contactStatus: SensorContactStatus;
  energyExpendedKj: number | null;
  rrIntervalsMs: number[];
}

export interface DecodedCscFrame {
  kind: 'cycling_sc';
  cumulativeWheelRevolutions: number | null;
  lastWheelEventTime1024s: number | null;
  cumulativeCrankRevolutions: number | null;
  lastCrankEventTime1024s: number | null;
}

export interface ComputedCscMetrics {
  speedMs: number | null;
  cadenceRpm: number | null;
}

export interface DecodedCyclingPowerFrame {
  kind: 'cycling_power';
  instantaneousPowerWatts: number;
  pedalPowerBalancePercent: number | null;
  accumulatedTorqueNm: number | null;
  cumulativeWheelRevolutions: number | null;
  lastWheelEventTime1024s: number | null;
  cumulativeCrankRevolutions: number | null;
  lastCrankEventTime1024s: number | null;
}

export interface DecodedRscFrame {
  kind: 'running_sc';
  instantaneousSpeedMs: number;
  instantaneousCadenceSpm: number;
  strideLengthM: number | null;
  totalDistanceM: number | null;
  isRunning: boolean;
}

export type DecodedBleFrame =
  | DecodedHeartRateFrame
  | DecodedCscFrame
  | DecodedCyclingPowerFrame
  | DecodedRscFrame;

// ============================================================================
// Machine d'états capteurs (appairage / reconnexion / batterie)
// ============================================================================

export type SensorConnectionState =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'unavailable'
  | 'permission_denied'
  | 'error';

export type BatteryStatus = 'unknown' | 'normal' | 'low' | 'critical';

export interface BleSensorDevice {
  deviceId: string;
  name: string;
  services: BleServiceKind[];
  state: SensorConnectionState;
  rssi: number | null;
  batteryPercent: number | null;
  batteryStatus: BatteryStatus;
  reconnectAttempt: number;
  nextReconnectDelayMs: number | null;
  lastConnectedAtMs: number | null;
  lastSeenAtMs: number | null;
  lastError: string | null;
  paired: boolean;
}

export interface SensorReconnectPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
}

// ============================================================================
// Télémétrie qualifiée (aucune valeur inventée)
// ============================================================================

export type TelemetryMetricKey =
  | 'heartRateBpm'
  | 'cyclingSpeedMs'
  | 'cyclingCadenceRpm'
  | 'cyclingPowerWatts'
  | 'runningSpeedMs'
  | 'runningCadenceSpm'
  | 'strideLengthM';

export type TelemetryQualification = 'measured' | 'stale' | 'unavailable';

export interface QualifiedMetricValue {
  value: number | null;
  qualification: TelemetryQualification;
  sourceDeviceId: string | null;
  updatedAtMs: number | null;
}

export interface QualifiedTelemetrySnapshot {
  capturedAtMs: number;
  heartRateBpm: QualifiedMetricValue;
  cyclingSpeedMs: QualifiedMetricValue;
  cyclingCadenceRpm: QualifiedMetricValue;
  cyclingPowerWatts: QualifiedMetricValue;
  runningSpeedMs: QualifiedMetricValue;
  runningCadenceSpm: QualifiedMetricValue;
  strideLengthM: QualifiedMetricValue;
}

export interface QualifiedTelemetrySummary {
  sampleCount: number;
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  avgPowerWatts: number | null;
  maxPowerWatts: number | null;
  avgCadenceRpm: number | null;
  avgSpeedMs: number | null;
}
