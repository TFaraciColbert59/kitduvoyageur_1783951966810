import type { ActivityProfileSpec } from '../specs/activityProfileSpec.types';
import type { ActivitySourceOrigin } from '../events/activityEventBus';
import { haversineDistanceM } from '../privacy/epzEngine';

export interface IntegrityTrackPoint {
  lat: number;
  lng: number;
  ele?: number | null;
  t: number; // ms
}

export type IntegrityFlag =
  | 'ebike_isolated'
  | 'mechanical_lift_detected'
  | 'motorized_vehicle_detected'
  | 'speed_ceiling_exceeded'
  | 'vam_ceiling_exceeded'
  | 'unverified_provenance';

export interface IntegrityEvaluationResult {
  eligibleForMuscularLeaderboards: boolean;
  leaderboardCategory: 'muscular' | 'electric_assisted' | 'excluded';
  flags: IntegrityFlag[];
  suggestedAutoCropIndex: number | null;
  liftAscentExcludedM: number;
  maxSustainedSpeedKmh: number;
  peakVamMh: number;
}

const ELECTRIC_SLUGS = new Set(['ebike_road_trek', 'emtb']);

function getSpeedCeilingKmh(profile: ActivityProfileSpec): number {
  if (profile.algorithms.antiCheat.maxSustainedSpeedKmh > 0) {
    return profile.algorithms.antiCheat.maxSustainedSpeedKmh;
  }
  switch (profile.identity.familyId) {
    case 'running_trail':
      return 27;
    case 'hiking_trekking':
      return 18;
    case 'alpinism_vertical':
      return 20;
    case 'cycling_mobility':
      return 95;
    case 'swimming_aquatic':
      return 10;
    case 'nautical_wind_glide':
      return 65;
    case 'snow_winter':
      return 115;
    default:
      return 60;
  }
}

/**
 * Lot 09 — Moteur Anti-Triche & Provenance Sportive :
 * - Isole strictement `eBike`/`eMTB` des classements musculaires.
 * - Détecte les remontées mécaniques (> 3,5 m/s en montée soutenue) pour soustraire le D+ mécanique.
 * - Détecte l'oubli d'arrêt en voiture (> 38 km/h soutenu sur sport pédestre) et propose `suggestedAutoCropIndex`.
 * - Applique les plafonds vitesse / VAM par famille et filtre la provenance (`manual` / `gpx_import`).
 */
export function evaluateActivityIntegrity(
  profile: ActivityProfileSpec,
  points: ReadonlyArray<IntegrityTrackPoint>,
  options: {
    sourceOrigin: ActivitySourceOrigin;
    isElectricAssisted?: boolean;
  },
): IntegrityEvaluationResult {
  const flags = new Set<IntegrityFlag>();
  const isElectric = Boolean(
    options.isElectricAssisted || ELECTRIC_SLUGS.has(profile.identity.slugId),
  );
  if (isElectric) {
    flags.add('ebike_isolated');
  }

  if (options.sourceOrigin === 'manual' || options.sourceOrigin === 'gpx_import') {
    flags.add('unverified_provenance');
  }

  const speedCeilingKmh = getSpeedCeilingKmh(profile);
  const isFootFamily =
    profile.identity.familyId === 'running_trail' ||
    profile.identity.familyId === 'hiking_trekking' ||
    profile.identity.familyId === 'alpinism_vertical';
  const isSnowOrBike =
    profile.algorithms.antiCheat.liftDetectionEnabled ||
    profile.identity.familyId === 'snow_winter' ||
    profile.identity.slugId === 'mtb_enduro_dh';

  let maxSustainedSpeedKmh = 0;
  let peakVamMh = 0;
  let liftAscentExcludedM = 0;
  let suggestedAutoCropIndex: number | null = null;
  let consecutiveVehicleSegments = 0;
  let consecutiveLiftSegments = 0;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const dtS = (curr.t - prev.t) / 1000;
    if (dtS < 1 || dtS > 120) continue;

    const distM = haversineDistanceM(prev.lat, prev.lng, curr.lat, curr.lng);
    const speedMs = distM / dtS;
    const speedKmh = speedMs * 3.6;

    if (speedKmh > maxSustainedSpeedKmh && dtS >= 3) {
      maxSustainedSpeedKmh = speedKmh;
    }

    const dEle =
      typeof prev.ele === 'number' && typeof curr.ele === 'number' ? curr.ele - prev.ele : 0;

    if (dEle > 0 && dtS >= 10) {
      const vam = (dEle / dtS) * 3600;
      if (vam > peakVamMh) peakVamMh = vam;
    }

    // 1. Remontée mécanique (ski alpin / enduro DH) : montée soutenue > 3.5 m/s + gain positif
    if (isSnowOrBike && speedMs > 3.5 && dEle > 2) {
      consecutiveLiftSegments += 1;
      if (consecutiveLiftSegments >= 3) {
        flags.add('mechanical_lift_detected');
        liftAscentExcludedM += dEle;
      }
    } else {
      consecutiveLiftSegments = 0;
    }

    // 2. Oubli d'arrêt en voiture sur sport pédestre (> 38 km/h soutenu)
    if (isFootFamily && speedKmh > 38) {
      consecutiveVehicleSegments += 1;
      if (consecutiveVehicleSegments >= 3) {
        flags.add('motorized_vehicle_detected');
        if (suggestedAutoCropIndex === null) {
          suggestedAutoCropIndex = Math.max(0, i - 3);
        }
      }
    } else {
      consecutiveVehicleSegments = 0;
    }
  }

  if (maxSustainedSpeedKmh > speedCeilingKmh) {
    flags.add('speed_ceiling_exceeded');
  }
  if (isFootFamily && peakVamMh > 2400 && !flags.has('mechanical_lift_detected')) {
    flags.add('vam_ceiling_exceeded');
  }

  const flagList = Array.from(flags);
  const hardExcluded =
    flags.has('motorized_vehicle_detected') ||
    flags.has('speed_ceiling_exceeded') ||
    flags.has('vam_ceiling_exceeded') ||
    flags.has('unverified_provenance');

  const leaderboardCategory: 'muscular' | 'electric_assisted' | 'excluded' = hardExcluded
    ? 'excluded'
    : isElectric
      ? 'electric_assisted'
      : 'muscular';

  return {
    eligibleForMuscularLeaderboards: leaderboardCategory === 'muscular',
    leaderboardCategory,
    flags: flagList,
    suggestedAutoCropIndex,
    liftAscentExcludedM: Math.round(liftAscentExcludedM),
    maxSustainedSpeedKmh: Number(maxSustainedSpeedKmh.toFixed(1)),
    peakVamMh: Math.round(peakVamMh),
  };
}
