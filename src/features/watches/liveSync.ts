/**
 * K6.10 / S6.01 / S6.02 — Live Sync entre téléphone et montre, champs de
 * navigation personnalisés et calcul des POI / repères à venir le long de
 * la trace.
 *
 * Invariants vérifiés :
 * 1. Aucune métrique capteur n'est inventée : si `heartRateBpm`, `currentSpeedMps`
 *    ou `etaUtcMs` est absent (`null`/`undefined`), le champ renvoie
 *    `available: false`, `value: null`, `formatted: '—'`.
 * 2. Numérotation monotone des trames (`frameSeq`) : la montre ignore toute
 *    trame obsolète (`frameSeq <= lastAppliedFrameSeq` pour la même génération).
 * 3. Les POI à venir (`upcomingPois`) sont triés par distance restante croissante
 *    le long de l'itinéraire, avec hystérésis de dépassement et delta d'altitude.
 * 4. La bascule de source téléphone <-> montre (`handoffSource`) incrémente
 *    explicitement `sourceGeneration` et fige `lastAcceptedSeq`.
 */

import type {
  WatchCustomFieldValue,
  WatchFieldLayoutConfig,
  WatchLiveMetricsInput,
  WatchLiveSyncFrame,
  WatchNavigationFieldKey,
  WatchNextManeuver,
  WatchRoutePoiInput,
  WatchSourceHandoffEvent,
  WatchUpcomingPoi,
} from './types';

export const DEFAULT_WATCH_FIELD_LAYOUT: WatchFieldLayoutConfig = {
  sport: 'rando',
  maxSlotsPerPage: 4,
  pages: [
    ['distance_total_m', 'elevation_gain_m', 'moving_time_s', 'heart_rate_bpm'],
    ['distance_remaining_m', 'elevation_remaining_m', 'next_turn_distance_m', 'battery_percent'],
  ],
};

function isFiniteMetric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatDurationSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatPaceSecondsPerKm(speedMps: number): { paceSPerKm: number; formatted: string } | null {
  if (!isFiniteMetric(speedMps) || speedMps <= 0.3) return null;
  const paceSPerKm = Math.round(1000 / speedMps);
  const mins = Math.floor(paceSPerKm / 60);
  const secs = paceSPerKm % 60;
  return {
    paceSPerKm,
    formatted: `${mins}'${String(secs).padStart(2, '0')}"/km`,
  };
}

/**
 * Valide et normalise la configuration des écrans de champs personnalisés montre.
 */
export function validateCustomFieldLayout(
  config: WatchFieldLayoutConfig,
): { valid: boolean; normalizedPages: WatchNavigationFieldKey[][]; errors: string[] } {
  const errors: string[] = [];
  const maxSlots = Math.min(Math.max(1, config.maxSlotsPerPage), 6);
  const normalizedPages: WatchNavigationFieldKey[][] = [];

  if (!config.pages || config.pages.length === 0) {
    errors.push('Au moins une page de champs de navigation est requise.');
    return {
      valid: false,
      normalizedPages: DEFAULT_WATCH_FIELD_LAYOUT.pages.map((p) => [...p]),
      errors,
    };
  }

  for (let pageIdx = 0; pageIdx < config.pages.length; pageIdx += 1) {
    const rawPage = config.pages[pageIdx];
    const deduped = Array.from(new Set(rawPage));
    if (deduped.length === 0) {
      errors.push(`La page ${pageIdx + 1} est vide.`);
      continue;
    }
    if (deduped.length > maxSlots) {
      errors.push(
        `La page ${pageIdx + 1} dépasse la capacité maximale (${deduped.length}/${maxSlots}).`,
      );
      normalizedPages.push(deduped.slice(0, maxSlots));
    } else {
      normalizedPages.push(deduped);
    }
  }

  return {
    valid: errors.length === 0,
    normalizedPages,
    errors,
  };
}

/**
 * Construit les valeurs de champs personnalisés sans inventer aucune donnée capteur.
 */
export function buildLiveSyncCustomFields(
  keys: readonly WatchNavigationFieldKey[],
  metrics: WatchLiveMetricsInput,
  nextManeuver: WatchNextManeuver | null = null,
): WatchCustomFieldValue[] {
  return keys.map((key): WatchCustomFieldValue => {
    switch (key) {
      case 'distance_total_m': {
        const ok = isFiniteMetric(metrics.distanceM) && metrics.distanceM >= 0;
        return {
          key,
          label: 'Distance',
          unit: 'km',
          value: ok ? metrics.distanceM : null,
          formatted: ok ? `${(metrics.distanceM / 1000).toFixed(2)} km` : '—',
          available: ok,
        };
      }
      case 'distance_remaining_m': {
        const val = metrics.distanceRemainingM;
        const ok = isFiniteMetric(val) && val >= 0;
        return {
          key,
          label: 'Restant',
          unit: 'km',
          value: ok ? val : null,
          formatted: ok ? `${(val / 1000).toFixed(2)} km` : '—',
          available: ok,
        };
      }
      case 'elevation_gain_m': {
        const ok = isFiniteMetric(metrics.elevGainM) && metrics.elevGainM >= 0;
        return {
          key,
          label: 'D+',
          unit: 'm',
          value: ok ? Math.round(metrics.elevGainM) : null,
          formatted: ok ? `${Math.round(metrics.elevGainM)} m` : '—',
          available: ok,
        };
      }
      case 'elevation_remaining_m': {
        const val = metrics.elevRemainingM;
        const ok = isFiniteMetric(val) && val >= 0;
        return {
          key,
          label: 'D+ restant',
          unit: 'm',
          value: ok ? Math.round(val) : null,
          formatted: ok ? `${Math.round(val)} m` : '—',
          available: ok,
        };
      }
      case 'moving_time_s': {
        const ok = isFiniteMetric(metrics.movingS) && metrics.movingS >= 0;
        return {
          key,
          label: 'Temps mouv.',
          unit: 's',
          value: ok ? Math.floor(metrics.movingS) : null,
          formatted: ok ? formatDurationSeconds(metrics.movingS) : '—',
          available: ok,
        };
      }
      case 'elapsed_time_s': {
        const ok = isFiniteMetric(metrics.elapsedS) && metrics.elapsedS >= 0;
        return {
          key,
          label: 'Temps total',
          unit: 's',
          value: ok ? Math.floor(metrics.elapsedS) : null,
          formatted: ok ? formatDurationSeconds(metrics.elapsedS) : '—',
          available: ok,
        };
      }
      case 'current_speed_mps': {
        const val = metrics.currentSpeedMps;
        const ok = isFiniteMetric(val) && val >= 0;
        return {
          key,
          label: 'Vitesse',
          unit: 'km/h',
          value: ok ? val : null,
          formatted: ok ? `${(val * 3.6).toFixed(1)} km/h` : '—',
          available: ok,
        };
      }
      case 'average_speed_mps': {
        const val = metrics.averageSpeedMps;
        const ok = isFiniteMetric(val) && val >= 0;
        return {
          key,
          label: 'Moyenne',
          unit: 'km/h',
          value: ok ? val : null,
          formatted: ok ? `${(val * 3.6).toFixed(1)} km/h` : '—',
          available: ok,
        };
      }
      case 'pace_s_per_km': {
        const pace = isFiniteMetric(metrics.currentSpeedMps)
          ? formatPaceSecondsPerKm(metrics.currentSpeedMps)
          : null;
        return {
          key,
          label: 'Allure',
          unit: 's/km',
          value: pace ? pace.paceSPerKm : null,
          formatted: pace ? pace.formatted : '—',
          available: pace !== null,
        };
      }
      case 'heart_rate_bpm': {
        const val = metrics.heartRateBpm;
        const ok = isFiniteMetric(val) && val > 0;
        return {
          key,
          label: 'FC',
          unit: 'bpm',
          value: ok ? Math.round(val) : null,
          formatted: ok ? `${Math.round(val)} bpm` : '—',
          available: ok,
        };
      }
      case 'eta_utc_ms': {
        const val = metrics.etaUtcMs;
        const ok = isFiniteMetric(val) && val > 0;
        return {
          key,
          label: 'ETA',
          unit: 'timestamp',
          value: ok ? val : null,
          formatted: ok ? new Date(val).toISOString().slice(11, 16) : '—',
          available: ok,
        };
      }
      case 'off_route_distance_m': {
        const val = metrics.offRouteDistanceM;
        const ok = metrics.offRoute && isFiniteMetric(val) && val >= 0;
        return {
          key,
          label: 'Écart trace',
          unit: 'm',
          value: ok ? Math.round(val) : null,
          formatted: ok ? `${Math.round(val)} m` : '0 m',
          available: ok,
        };
      }
      case 'next_turn_distance_m': {
        const val = nextManeuver?.distanceToTurnM;
        const ok = isFiniteMetric(val) && val >= 0;
        return {
          key,
          label: 'Proch. virage',
          unit: 'm',
          value: ok ? Math.round(val) : null,
          formatted: ok ? `${Math.round(val)} m` : '—',
          available: ok,
        };
      }
      case 'battery_percent': {
        const val = metrics.batteryPercent;
        const ok = isFiniteMetric(val) && val >= 0 && val <= 100;
        return {
          key,
          label: 'Batterie',
          unit: '%',
          value: ok ? Math.round(val) : null,
          formatted: ok ? `${Math.round(val)} %` : '—',
          available: ok,
        };
      }
    }
  });
}

/**
 * Calcule la liste ordonnée des prochains POI / repères le long de la route (K6.10).
 */
export function computeUpcomingPois(
  pois: readonly WatchRoutePoiInput[],
  progressDistanceAlongRouteM: number,
  options: {
    currentElevationM?: number | null;
    maxHorizonM?: number;
    maxCount?: number;
    passedToleranceM?: number;
  } = {},
): WatchUpcomingPoi[] {
  const maxHorizonM = options.maxHorizonM ?? 25_000;
  const maxCount = Math.max(1, options.maxCount ?? 5);
  const toleranceM = Math.max(0, options.passedToleranceM ?? 15);
  const currentEle = options.currentElevationM;

  return pois
    .filter((poi) => {
      const remaining = poi.distanceAlongRouteM - progressDistanceAlongRouteM;
      return remaining >= -toleranceM && remaining <= maxHorizonM;
    })
    .map((poi): WatchUpcomingPoi => {
      const distanceRemainingM = Math.max(
        0,
        Math.round(poi.distanceAlongRouteM - progressDistanceAlongRouteM),
      );
      const elevationDeltaM =
        isFiniteMetric(poi.eleM) && isFiniteMetric(currentEle)
          ? Math.round(poi.eleM - currentEle)
          : null;
      return {
        id: poi.id,
        name: poi.name,
        category: poi.category,
        lat: poi.lat,
        lng: poi.lng,
        distanceAlongRouteM: poi.distanceAlongRouteM,
        distanceRemainingM,
        elevationDeltaM,
        maneuverInstruction: poi.maneuverInstruction ?? null,
      };
    })
    .sort((a, b) => a.distanceRemainingM - b.distanceRemainingM)
    .slice(0, maxCount);
}

/**
 * Moteur de synchronisation temps réel (Live Sync) et de bascule de source
 * entre le téléphone et la montre.
 */
export class WatchLiveSyncEngine {
  private frameSeq = 0;
  private sourceOwner: 'phone' | 'watch' = 'phone';
  private sourceGeneration = 1;
  private lastAppliedFrameOnWatch: WatchLiveSyncFrame | null = null;
  private layout: WatchFieldLayoutConfig = DEFAULT_WATCH_FIELD_LAYOUT;

  constructor(initialSource: 'phone' | 'watch' = 'phone', initialGeneration = 1) {
    this.sourceOwner = initialSource;
    this.sourceGeneration = initialGeneration;
  }

  setFieldLayout(config: WatchFieldLayoutConfig): {
    valid: boolean;
    normalizedPages: WatchNavigationFieldKey[][];
    errors: string[];
  } {
    const result = validateCustomFieldLayout(config);
    this.layout = {
      ...config,
      pages: result.normalizedPages,
    };
    return result;
  }

  getActiveFieldKeys(): WatchNavigationFieldKey[] {
    const flattened = this.layout.pages.flat();
    return Array.from(new Set(flattened));
  }

  buildFrame(params: {
    sessionId: string;
    routeId: string | null;
    metrics: WatchLiveMetricsInput;
    pois?: readonly WatchRoutePoiInput[];
    nextManeuver?: WatchNextManeuver | null;
    nowUtcMs?: number;
  }): WatchLiveSyncFrame {
    this.frameSeq += 1;
    const nowUtcMs = params.nowUtcMs ?? Date.now();
    const nextManeuver = params.nextManeuver ?? null;
    const upcomingPois = computeUpcomingPois(
      params.pois ?? [],
      params.metrics.distanceM,
      { currentElevationM: params.metrics.currentElevationM },
    );
    const customFields = buildLiveSyncCustomFields(
      this.getActiveFieldKeys(),
      params.metrics,
      nextManeuver,
    );

    return {
      frameSeq: this.frameSeq,
      sessionId: params.sessionId,
      routeId: params.routeId,
      sourceOwner: this.sourceOwner,
      sourceGeneration: this.sourceGeneration,
      sentAtUtcMs: nowUtcMs,
      paused: params.metrics.paused,
      offRoute: params.metrics.offRoute,
      offRouteDistanceM:
        params.metrics.offRoute && isFiniteMetric(params.metrics.offRouteDistanceM)
          ? Math.round(params.metrics.offRouteDistanceM)
          : null,
      nextManeuver,
      upcomingPois,
      customFields,
    };
  }

  /**
   * Applique une trame reçue sur la montre en rejetant toute trame obsolète
   * (`sourceGeneration` inférieure ou `frameSeq` déjà dépassé).
   */
  applyIncomingFrameOnWatch(frame: WatchLiveSyncFrame): {
    accepted: boolean;
    currentFrame: WatchLiveSyncFrame;
  } {
    if (this.lastAppliedFrameOnWatch) {
      const prev = this.lastAppliedFrameOnWatch;
      if (frame.sourceGeneration < prev.sourceGeneration) {
        return { accepted: false, currentFrame: prev };
      }
      if (
        frame.sourceGeneration === prev.sourceGeneration &&
        frame.frameSeq <= prev.frameSeq
      ) {
        return { accepted: false, currentFrame: prev };
      }
    }

    this.lastAppliedFrameOnWatch = frame;
    return { accepted: true, currentFrame: frame };
  }

  /**
   * Bascule contrôlée de la source d'enregistrement entre téléphone et montre
   * (Recherche 01 : événement explicite avec `lastAcceptedSeq` et `newSourceGeneration`).
   */
  handoffSource(
    sessionId: string,
    toSource: 'phone' | 'watch',
    lastAcceptedSeq: number,
    nowUtcMs = Date.now(),
  ): WatchSourceHandoffEvent {
    const fromSource = this.sourceOwner;
    this.sourceOwner = toSource;
    this.sourceGeneration += 1;
    return {
      sessionId,
      fromSource,
      toSource,
      lastAcceptedSeq,
      newSourceGeneration: this.sourceGeneration,
      handedOffAtUtcMs: nowUtcMs,
    };
  }

  getSourceState(): { sourceOwner: 'phone' | 'watch'; sourceGeneration: number } {
    return {
      sourceOwner: this.sourceOwner,
      sourceGeneration: this.sourceGeneration,
    };
  }
}
