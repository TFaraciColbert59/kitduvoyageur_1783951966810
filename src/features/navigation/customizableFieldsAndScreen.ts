/**
 * Lot N01 — Champs personnalisables, zoom et écran maintenu (K4.11).
 *
 * Responsabilités :
 * - Permettre à l'utilisateur de choisir et réordonner les métriques affichées
 *   pendant la sortie (`CustomizableMetricKey`), avec des valeurs par défaut
 *   adaptées à chaque sport.
 * - Invariant : aucune métrique capteur absente (`heartRate`, `power`, `cadence`,
 *   `strokeRate`, etc.) n'est inventée ; elle expose `available: false` et
 *   `unavailableReason: 'sensor_not_connected'`.
 * - Gérer le zoom automatique selon la vitesse (`followZoomForSpeed`) et le
 *   débrayage manuel temporaire (`manualZoomOverride`).
 * - Gérer le maintien de l'écran allumé (`ScreenWakeLockController` via Wake Lock API
 *   ou pont injectable) sans erreur sur les plateformes non supportées.
 */

import { MIN_MOVING_SPEED_MS } from '../explorer-v2/activity/tracker';
import { followZoomForSpeed } from '../explorer-v2/map/camera';
import {
  SPORT_METRIC_LABEL,
  TRACKER_METRICS,
  rhythmMetric,
} from '../explorer-v2/sheet/sportSelection';
import type { Level, Sport, SportSelection } from '../explorer-v2/state/types';
import type {
  CustomFieldValue,
  CustomizableMetricKey,
  NavigationDisplayPreferences,
  NavigationUnits,
  WakeLockState,
} from './types';
import {
  formatNavigationDistance,
  formatNavigationDuration,
  formatNavigationElevation,
  formatNavigationPaceFromSpeed,
  formatNavigationSpeed,
} from './unitsAndOrientation';

export const MIN_CUSTOM_FIELDS = 1;
export const MAX_CUSTOM_FIELDS = 6;

export const CUSTOM_METRIC_LABELS: Readonly<Record<CustomizableMetricKey, string>> = {
  ...SPORT_METRIC_LABEL,
  remainingDistance: 'distance restante',
  eta: 'arrivée estimée',
  altitude: 'altitude',
  averageSpeed: 'vitesse moyenne',
  averagePace: 'allure moyenne',
};

/** Métriques calculables sans capteur externe (GPS + trace optionnelle). */
export const SUPPORTED_GPS_DERIVED_METRICS: ReadonlySet<CustomizableMetricKey> =
  new Set<CustomizableMetricKey>([
    ...TRACKER_METRICS,
    'laps',
    'remainingDistance',
    'eta',
    'altitude',
    'averageSpeed',
    'averagePace',
  ]);

/** Champs par défaut pour chaque sport (4 emplacements principaux). */
export function getDefaultFieldsForSport(
  sport: Sport,
  selection?: SportSelection,
): CustomizableMetricKey[] {
  const rhythm = rhythmMetric(sport, selection);
  switch (sport) {
    case 'course':
    case 'trail':
      return ['distance', 'duration', rhythm, 'elevation'];
    case 'velo':
      return ['distance', 'speed', 'duration', 'elevation'];
    case 'kayak':
      return ['distance', 'speed', 'duration', 'remainingDistance'];
    case 'ski':
    case 'escalade':
    case 'rando':
    case 'famille':
    case 'bivouac':
    default:
      return ['distance', 'duration', 'elevation', 'remainingDistance'];
  }
}

export function createInitialDisplayPreferences(
  sport: Sport,
  selection?: SportSelection,
): NavigationDisplayPreferences {
  return {
    sport,
    fields: getDefaultFieldsForSport(sport, selection),
    autoZoomEnabled: true,
    manualZoomOverride: null,
    keepScreenAwake: true,
  };
}

/**
 * Met à jour la sélection de champs personnalisés en dédupliquant et en bornant
 * entre `MIN_CUSTOM_FIELDS` et `MAX_CUSTOM_FIELDS`.
 */
export function updateCustomFields(
  prefs: NavigationDisplayPreferences,
  requestedFields: readonly CustomizableMetricKey[],
): NavigationDisplayPreferences {
  const unique: CustomizableMetricKey[] = [];
  for (const key of requestedFields) {
    if (!(key in CUSTOM_METRIC_LABELS)) continue;
    if (!unique.includes(key)) {
      unique.push(key);
    }
    if (unique.length >= MAX_CUSTOM_FIELDS) break;
  }
  if (unique.length < MIN_CUSTOM_FIELDS) {
    return prefs;
  }
  return {
    ...prefs,
    fields: unique,
  };
}

export interface LiveMetricsSnapshotForFields {
  distanceM: number;
  movingS: number;
  elevGainM: number;
  currentSpeedMs?: number | null;
  currentAltitudeM?: number | null;
  remainingRouteDistanceM?: number | null;
  completedLapsCount?: number | null;
  units?: NavigationUnits;
}

/**
 * Formate chacune des métriques choisies par l'utilisateur (`K4.11`).
 * Aucune valeur capteur non branchée n'est fabriquée (`available: false`).
 */
export function evaluateCustomFieldValues(
  fields: readonly CustomizableMetricKey[],
  metrics: LiveMetricsSnapshotForFields,
): CustomFieldValue[] {
  const units = metrics.units ?? 'metric';
  const avgSpeedMs =
    metrics.movingS > 0 && metrics.distanceM > 0 ? metrics.distanceM / metrics.movingS : null;
  const instantSpeedMs =
    typeof metrics.currentSpeedMs === 'number' && Number.isFinite(metrics.currentSpeedMs)
      ? metrics.currentSpeedMs
      : avgSpeedMs;

  return fields.map((key): CustomFieldValue => {
    const label = CUSTOM_METRIC_LABELS[key] ?? key;

    // Capteurs externes non branchés : refus explicite sans valeur inventée
    if (!SUPPORTED_GPS_DERIVED_METRICS.has(key)) {
      return {
        key,
        label,
        formattedValue: '—',
        unitLabel: '',
        available: false,
        unavailableReason: 'sensor_not_connected',
      };
    }

    switch (key) {
      case 'distance': {
        const formatted = formatNavigationDistance(metrics.distanceM, units);
        const parts = formatted.split(' ');
        return {
          key,
          label,
          formattedValue: parts[0] ?? formatted,
          unitLabel: parts[1] ?? (units === 'imperial' ? 'mi' : 'm'),
          available: true,
          unavailableReason: null,
        };
      }
      case 'duration': {
        return {
          key,
          label,
          formattedValue: formatNavigationDuration(metrics.movingS),
          unitLabel: '',
          available: true,
          unavailableReason: null,
        };
      }
      case 'elevation': {
        const formatted = formatNavigationElevation(metrics.elevGainM, units, true);
        const parts = formatted.split(' ');
        return {
          key,
          label,
          formattedValue: parts[0] ?? formatted,
          unitLabel: parts[1] ?? (units === 'imperial' ? 'ft' : 'm'),
          available: true,
          unavailableReason: null,
        };
      }
      case 'altitude': {
        if (
          typeof metrics.currentAltitudeM !== 'number' ||
          !Number.isFinite(metrics.currentAltitudeM)
        ) {
          return {
            key,
            label,
            formattedValue: '—',
            unitLabel: units === 'imperial' ? 'ft' : 'm',
            available: false,
            unavailableReason: 'no_movement_yet',
          };
        }
        const formatted = formatNavigationElevation(metrics.currentAltitudeM, units, false);
        const parts = formatted.split(' ');
        return {
          key,
          label,
          formattedValue: parts[0] ?? formatted,
          unitLabel: parts[1] ?? (units === 'imperial' ? 'ft' : 'm'),
          available: true,
          unavailableReason: null,
        };
      }
      case 'speed': {
        const s = formatNavigationSpeed(instantSpeedMs, units);
        return {
          key,
          label,
          formattedValue: s.value,
          unitLabel: s.unit,
          available: s.value !== '—',
          unavailableReason: s.value === '—' ? 'no_movement_yet' : null,
        };
      }
      case 'averageSpeed': {
        const s = formatNavigationSpeed(avgSpeedMs, units);
        return {
          key,
          label,
          formattedValue: s.value,
          unitLabel: s.unit,
          available: s.value !== '—',
          unavailableReason: s.value === '—' ? 'no_movement_yet' : null,
        };
      }
      case 'pace': {
        const p = formatNavigationPaceFromSpeed(instantSpeedMs, units);
        return {
          key,
          label,
          formattedValue: p.value,
          unitLabel: p.unit,
          available: p.value !== '—',
          unavailableReason: p.value === '—' ? 'no_movement_yet' : null,
        };
      }
      case 'averagePace': {
        const p = formatNavigationPaceFromSpeed(avgSpeedMs, units);
        return {
          key,
          label,
          formattedValue: p.value,
          unitLabel: p.unit,
          available: p.value !== '—',
          unavailableReason: p.value === '—' ? 'no_movement_yet' : null,
        };
      }
      case 'remainingDistance': {
        if (
          typeof metrics.remainingRouteDistanceM !== 'number' ||
          !Number.isFinite(metrics.remainingRouteDistanceM)
        ) {
          return {
            key,
            label,
            formattedValue: '—',
            unitLabel: units === 'imperial' ? 'mi' : 'km',
            available: false,
            unavailableReason: 'route_required',
          };
        }
        const formatted = formatNavigationDistance(metrics.remainingRouteDistanceM, units);
        const parts = formatted.split(' ');
        return {
          key,
          label,
          formattedValue: parts[0] ?? formatted,
          unitLabel: parts[1] ?? '',
          available: true,
          unavailableReason: null,
        };
      }
      case 'eta': {
        if (
          typeof metrics.remainingRouteDistanceM !== 'number' ||
          !Number.isFinite(metrics.remainingRouteDistanceM)
        ) {
          return {
            key,
            label,
            formattedValue: '—',
            unitLabel: '',
            available: false,
            unavailableReason: 'route_required',
          };
        }
        const effectiveSpeed =
          instantSpeedMs && instantSpeedMs >= MIN_MOVING_SPEED_MS ? instantSpeedMs : avgSpeedMs;
        if (!effectiveSpeed || effectiveSpeed < MIN_MOVING_SPEED_MS) {
          return {
            key,
            label,
            formattedValue: '—',
            unitLabel: '',
            available: false,
            unavailableReason: 'no_movement_yet',
          };
        }
        const remainingS = Math.round(metrics.remainingRouteDistanceM / effectiveSpeed);
        return {
          key,
          label,
          formattedValue: formatNavigationDuration(remainingS),
          unitLabel: 'restant',
          available: true,
          unavailableReason: null,
        };
      }
      case 'laps': {
        const count =
          typeof metrics.completedLapsCount === 'number' &&
          Number.isFinite(metrics.completedLapsCount)
            ? Math.max(0, Math.floor(metrics.completedLapsCount))
            : 0;
        return {
          key,
          label,
          formattedValue: String(count),
          unitLabel: count > 1 ? 'tours' : 'tour',
          available: true,
          unavailableReason: null,
        };
      }
      default:
        return {
          key,
          label,
          formattedValue: '—',
          unitLabel: '',
          available: false,
          unavailableReason: 'sensor_not_connected',
        };
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.11 — Zoom de suivi automatique ou manuel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le niveau de zoom cible en navigation :
 * - Si l'utilisateur a défini un zoom manuel (`manualZoomOverride`) ou coupé
 *   `autoZoomEnabled`, ce zoom est respecté (borné entre 2 et 19).
 * - Sinon, délègue à `followZoomForSpeed(speedMs, level)`.
 */
export function resolveNavigationZoom(
  prefs: Pick<NavigationDisplayPreferences, 'autoZoomEnabled' | 'manualZoomOverride'>,
  speedMs: number,
  level: Level = 3,
): number {
  if (!prefs.autoZoomEnabled && prefs.manualZoomOverride !== null) {
    return Math.max(2, Math.min(19, prefs.manualZoomOverride));
  }
  if (prefs.manualZoomOverride !== null) {
    return Math.max(2, Math.min(19, prefs.manualZoomOverride));
  }
  return followZoomForSpeed(Math.max(0, Number.isFinite(speedMs) ? speedMs : 0), level);
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.11 — Maintien de l'écran allumé (Screen Wake Lock)
// ─────────────────────────────────────────────────────────────────────────────

export interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
}

export interface WakeLockAdapter {
  isSupported(): boolean;
  request(): Promise<WakeLockSentinelLike>;
}

export const browserWakeLockAdapter: WakeLockAdapter = {
  isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'wakeLock' in navigator &&
      typeof (navigator as Navigator & { wakeLock?: { request?: unknown } }).wakeLock?.request ===
        'function'
    );
  },
  async request(): Promise<WakeLockSentinelLike> {
    const nav = navigator as Navigator & {
      wakeLock: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
    };
    return nav.wakeLock.request('screen');
  },
};

export class ScreenWakeLockController {
  private adapter: WakeLockAdapter;
  private sentinel: WakeLockSentinelLike | null = null;
  private enabled = false;
  private lastReason: string | null = null;

  constructor(adapter: WakeLockAdapter = browserWakeLockAdapter) {
    this.adapter = adapter;
  }

  public get state(): WakeLockState {
    const supported = this.adapter.isSupported();
    return {
      enabled: this.enabled,
      supported,
      active: Boolean(this.sentinel && !this.sentinel.released),
      reason: !supported ? 'wake_lock_unsupported' : this.lastReason,
    };
  }

  public async setKeepScreenAwake(enabled: boolean): Promise<WakeLockState> {
    this.enabled = enabled;
    if (!enabled) {
      await this.release();
      return this.state;
    }
    return this.acquire();
  }

  public async acquire(): Promise<WakeLockState> {
    if (!this.enabled) return this.state;
    if (!this.adapter.isSupported()) {
      this.lastReason = 'wake_lock_unsupported';
      return this.state;
    }
    if (this.sentinel && !this.sentinel.released) {
      this.lastReason = null;
      return this.state;
    }
    try {
      this.sentinel = await this.adapter.request();
      this.lastReason = null;
    } catch (err) {
      this.sentinel = null;
      this.lastReason = err instanceof Error ? err.message : 'wake_lock_denied';
    }
    return this.state;
  }

  public async release(): Promise<WakeLockState> {
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch {
        // Ignorer l'erreur de relâchement déjà expiré
      }
      this.sentinel = null;
    }
    this.lastReason = null;
    return this.state;
  }
}
