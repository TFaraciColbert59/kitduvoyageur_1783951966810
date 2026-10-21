import { HikeEngine } from '@/features/hiking/engine/HikeEngine';
import type { Carte3DTrail, Carte3DWaypoint, ElevationProfilePoint } from '../types';

/**
 * Calcul du profil altimétrique et interpolation pour la Carte 3D vivante.
 */

export interface ElevationCalculationResult {
  elevationProfile: ElevationProfilePoint[];
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  minElevationM: number;
  maxElevationM: number;
  estimatedDurationHours: number;
}

/**
 * Estimation du temps de marche selon la règle de Tobler / club alpin :
 * 4 km/h à plat + 1h pour 350m de D+ + 1h pour 800m de D-.
 */
export function estimateHikingTimeHours(
  distanceKm: number,
  elevationGainM: number,
  elevationLossM: number
): number {
  if (distanceKm <= 0) return 0;
  const timeFlatHours = distanceKm / 4.0;
  const timeClimbHours = Math.max(0, elevationGainM) / 350.0;
  const timeDescentHours = Math.max(0, elevationLossM) / 800.0;
  // Combinaison standard alpin (max(distance, dénivelé) + 0.5 * min)
  const verticalTime = timeClimbHours + timeDescentHours;
  const combined = Math.max(timeFlatHours, verticalTime) + 0.5 * Math.min(timeFlatHours, verticalTime);
  return Math.round(combined * 10) / 10;
}

/**
 * Construit un profil d'altitude lissé et dérive les métriques clés à partir des coordonnées.
 */
export function buildElevationProfile(
  coordinates: [number, number, number?][]
): ElevationCalculationResult {
  if (!coordinates || coordinates.length === 0) {
    return {
      elevationProfile: [],
      distanceKm: 0,
      elevationGainM: 0,
      elevationLossM: 0,
      minElevationM: 0,
      maxElevationM: 0,
      estimatedDurationHours: 0,
    };
  }

  if (coordinates.length === 1) {
    const singleEle = coordinates[0][2] ?? 1000;
    return {
      elevationProfile: [
        {
          distanceKm: 0,
          elevationM: Math.round(singleEle),
          slopePercent: 0,
          coord: [coordinates[0][0], coordinates[0][1]],
        },
      ],
      distanceKm: 0,
      elevationGainM: 0,
      elevationLossM: 0,
      minElevationM: Math.round(singleEle),
      maxElevationM: Math.round(singleEle),
      estimatedDurationHours: 0,
    };
  }

  const profile: ElevationProfilePoint[] = [];
  let cumulativeDistanceKm = 0;
  let gainM = 0;
  let lossM = 0;

  const firstEle = coordinates[0][2] ?? 1000;
  let minEle = firstEle;
  let maxEle = firstEle;

  profile.push({
    distanceKm: 0,
    elevationM: Math.round(firstEle),
    slopePercent: 0,
    coord: [coordinates[0][0], coordinates[0][1]],
  });

  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];

    const segDistKm = HikeEngine.calculateDistanceKm(prev[1], prev[0], curr[1], curr[0]);
    cumulativeDistanceKm += segDistKm;

    const prevAlt = prev[2] ?? 1000;
    const currAlt = curr[2] ?? prevAlt;

    const eleDelta = currAlt - prevAlt;
    if (eleDelta > 0) gainM += eleDelta;
    else lossM += Math.abs(eleDelta);

    if (currAlt < minEle) minEle = currAlt;
    if (currAlt > maxEle) maxEle = currAlt;

    const segDistM = segDistKm * 1000;
    const slope = segDistM > 0.5 ? Math.max(-100, Math.min(100, (eleDelta / segDistM) * 100)) : 0;

    profile.push({
      distanceKm: Math.round(cumulativeDistanceKm * 100) / 100,
      elevationM: Math.round(currAlt),
      slopePercent: Math.round(slope),
      coord: [curr[0], curr[1]],
    });
  }

  const totalDist = Math.round(cumulativeDistanceKm * 100) / 100;
  const totalGain = Math.round(gainM);
  const totalLoss = Math.round(lossM);

  return {
    elevationProfile: profile,
    distanceKm: totalDist,
    elevationGainM: totalGain,
    elevationLossM: totalLoss,
    minElevationM: Math.round(minEle),
    maxElevationM: Math.round(maxEle),
    estimatedDurationHours: estimateHikingTimeHours(totalDist, totalGain, totalLoss),
  };
}

/**
 * Interpole la position, l'altitude, la pente et le cap le long du sentier
 * pour une progression donnée entre 0.0 et 1.0.
 */
export function interpolatePositionAtProgress(
  trail: Carte3DTrail,
  progress: number
): {
  coord: [number, number];
  elevationM: number;
  distanceKm: number;
  slopePercent: number;
  bearingDeg: number;
} {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const coords = trail.coordinates;

  if (!coords || coords.length === 0) {
    return {
      coord: [0, 0],
      elevationM: 0,
      distanceKm: 0,
      slopePercent: 0,
      bearingDeg: 0,
    };
  }

  if (coords.length === 1) {
    return {
      coord: [coords[0][0], coords[0][1]],
      elevationM: coords[0][2] ?? 1000,
      distanceKm: 0,
      slopePercent: 0,
      bearingDeg: 0,
    };
  }

  const targetDist = clampedProgress * trail.distanceKm;
  const profile = trail.elevationProfile;

  // Recherche du segment correspondant dans le profil
  let idx = 0;
  while (idx < profile.length - 1 && profile[idx + 1].distanceKm < targetDist) {
    idx++;
  }

  if (idx >= profile.length - 1) {
    const last = profile[profile.length - 1];
    const prev = profile[profile.length - 2];
    const bearing = HikeEngine.calculateBearingDeg(
      prev.coord[1],
      prev.coord[0],
      last.coord[1],
      last.coord[0]
    );
    return {
      coord: last.coord,
      elevationM: last.elevationM,
      distanceKm: last.distanceKm,
      slopePercent: last.slopePercent,
      bearingDeg: bearing,
    };
  }

  const p1 = profile[idx];
  const p2 = profile[idx + 1];

  const segRange = p2.distanceKm - p1.distanceKm;
  const segFactor = segRange > 0.0001 ? Math.max(0, Math.min(1, (targetDist - p1.distanceKm) / segRange)) : 0;

  const lng = p1.coord[0] + (p2.coord[0] - p1.coord[0]) * segFactor;
  const lat = p1.coord[1] + (p2.coord[1] - p1.coord[1]) * segFactor;
  const ele = p1.elevationM + (p2.elevationM - p1.elevationM) * segFactor;
  const slope = p1.slopePercent + (p2.slopePercent - p1.slopePercent) * segFactor;

  const bearing = HikeEngine.calculateBearingDeg(
    p1.coord[1],
    p1.coord[0],
    p2.coord[1],
    p2.coord[0]
  );

  return {
    coord: [Math.round(lng * 1000000) / 1000000, Math.round(lat * 1000000) / 1000000],
    elevationM: Math.round(ele),
    distanceKm: Math.round(targetDist * 100) / 100,
    slopePercent: Math.round(slope),
    bearingDeg: Math.round(bearing),
  };
}

/**
 * Détecte si le playhead se trouve à proximité d'un waypoint (sommet, refuge, eau, météo...).
 */
export function findNearbyWaypoint(
  waypoints: Carte3DWaypoint[],
  currentDistanceKm: number,
  thresholdKm = 0.5
): Carte3DWaypoint | null {
  if (!waypoints || waypoints.length === 0) return null;

  let closest: Carte3DWaypoint | null = null;
  let minDiff = Infinity;

  for (const wpt of waypoints) {
    const diff = Math.abs(wpt.distanceKm - currentDistanceKm);
    if (diff <= thresholdKm && diff < minDiff) {
      minDiff = diff;
      closest = wpt;
    }
  }

  return closest;
}
