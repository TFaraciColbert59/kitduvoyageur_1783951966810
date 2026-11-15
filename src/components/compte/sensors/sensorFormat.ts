import type {
  BatteryStatus,
  BleServiceKind,
  HealthBridgeStatus,
  QualifiedTelemetrySnapshot,
  SensorConnectionState,
  TelemetryMetricKey,
  TelemetryQualification,
} from '@/features/sensors';

export interface SensorMetricDefinition {
  key: TelemetryMetricKey;
  label: string;
  shortLabel: string;
  unit: string;
}

/** Ordre d'affichage stable : cardio, vélo, course. */
export const SENSOR_METRICS: readonly SensorMetricDefinition[] = [
  { key: 'heartRateBpm', label: 'Fréquence cardiaque', shortLabel: 'Cardio', unit: 'bpm' },
  { key: 'cyclingSpeedMs', label: 'Vitesse vélo', shortLabel: 'Vitesse vélo', unit: 'km/h' },
  { key: 'cyclingCadenceRpm', label: 'Cadence vélo', shortLabel: 'Cadence vélo', unit: 'rpm' },
  { key: 'cyclingPowerWatts', label: 'Puissance', shortLabel: 'Puissance', unit: 'W' },
  { key: 'runningSpeedMs', label: 'Vitesse course', shortLabel: 'Vitesse course', unit: 'km/h' },
  { key: 'runningCadenceSpm', label: 'Cadence course', shortLabel: 'Cadence course', unit: 'spm' },
  { key: 'strideLengthM', label: 'Longueur de foulée', shortLabel: 'Foulée', unit: 'm' },
];

const numberFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const decimalFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formate une mesure réelle ; `null` devient toujours un tiret, jamais 0. */
export function formatMetricValue(key: TelemetryMetricKey, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';

  switch (key) {
    case 'heartRateBpm':
      return `${Math.round(value)} bpm`;
    case 'cyclingSpeedMs':
    case 'runningSpeedMs':
      return `${numberFormatter.format(value * 3.6)} km/h`;
    case 'cyclingCadenceRpm':
      return `${Math.round(value)} rpm`;
    case 'runningCadenceSpm':
      return `${Math.round(value)} spm`;
    case 'cyclingPowerWatts':
      return `${Math.round(value)} W`;
    case 'strideLengthM':
      return `${decimalFormatter.format(value)} m`;
  }
}

export function qualificationLabel(qualification: TelemetryQualification): string {
  switch (qualification) {
    case 'measured':
      return 'Mesuré';
    case 'stale':
      return 'Périmé';
    case 'unavailable':
      return 'Indisponible';
  }
}

export function sensorStateLabel(state: SensorConnectionState): string {
  switch (state) {
    case 'idle':
      return 'Non connecté';
    case 'scanning':
      return 'Recherche';
    case 'connecting':
      return 'Connexion';
    case 'connected':
      return 'Connecté';
    case 'reconnecting':
      return 'Reconnexion';
    case 'disconnected':
      return 'Déconnecté';
    case 'unavailable':
      return 'Bluetooth indisponible';
    case 'permission_denied':
      return 'Permission refusée';
    case 'error':
      return 'Erreur';
  }
}

export function batteryStatusLabel(status: BatteryStatus): string {
  switch (status) {
    case 'unknown':
      return 'Batterie inconnue';
    case 'normal':
      return 'Batterie normale';
    case 'low':
      return 'Batterie faible';
    case 'critical':
      return 'Batterie critique';
  }
}

export function bleServiceLabel(service: BleServiceKind): string {
  switch (service) {
    case 'heart_rate':
      return 'Cardio';
    case 'cycling_sc':
      return 'Vélo vitesse/cadence';
    case 'cycling_power':
      return 'Puissance vélo';
    case 'running_sc':
      return 'Course';
  }
}

export function healthBridgeStatusLabel(status: HealthBridgeStatus): string {
  switch (status) {
    case 'available':
      return 'Disponible';
    case 'native_bridge_unavailable':
      return 'Pont natif indisponible';
    case 'permission_required':
      return 'Autorisation requise';
    case 'permission_denied':
      return 'Autorisation refusée';
  }
}

export function formatBatteryPercent(percent: number | null): string {
  return percent === null || !Number.isFinite(percent) ? '—' : `${Math.round(percent)} %`;
}

export function formatRssi(rssi: number | null): string {
  return rssi === null || !Number.isFinite(rssi) ? '—' : `${Math.round(rssi)} dBm`;
}

export function formatDeviceId(deviceId: string): string {
  if (deviceId.length <= 16) return deviceId;
  return `${deviceId.slice(0, 8)}…${deviceId.slice(-4)}`;
}

export function formatReconnectDelay(delayMs: number | null): string {
  if (delayMs === null || !Number.isFinite(delayMs)) return '—';
  if (delayMs < 1000) return `${Math.round(delayMs)} ms`;
  return `${Math.round(delayMs / 1000)} s`;
}

/** Âge d'une mesure réelle, sans jamais extrapoler sa fraîcheur. */
export function formatMeasurementAge(updatedAtMs: number | null, nowMs: number): string {
  if (updatedAtMs === null || !Number.isFinite(updatedAtMs)) return 'jamais';
  const ageMs = Math.max(0, nowMs - updatedAtMs);
  if (ageMs < 1000) return "à l'instant";
  if (ageMs < 60_000) return `il y a ${Math.floor(ageMs / 1000)} s`;
  if (ageMs < 3_600_000) return `il y a ${Math.floor(ageMs / 60_000)} min`;
  if (ageMs < 86_400_000) return `il y a ${Math.floor(ageMs / 3_600_000)} h`;
  return `il y a ${Math.floor(ageMs / 86_400_000)} j`;
}

export function hasAnyMeasuredMetric(snapshot: QualifiedTelemetrySnapshot): boolean {
  return SENSOR_METRICS.some(({ key }) => snapshot[key].qualification !== 'unavailable');
}
