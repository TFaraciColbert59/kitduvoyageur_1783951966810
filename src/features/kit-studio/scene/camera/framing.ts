/**
 * src/features/kit-studio/scene/camera/framing.ts
 * Pure camera framing & collision-avoidance geometry math (Lot L5-1 / C-10 / C-11).
 * ZERO imports from React, Three.js, or DOM.
 */

import type { BoundingBoxM, CameraPose, Vec3Tuple } from './intents';

export const MAX_ELEVATION_RAD = Math.PI / 3; // +60°
export const MIN_ELEVATION_RAD = -Math.PI / 3; // -60° (additionally clamped above ground y >= 0.04m)
export const MIN_GROUND_CLEARANCE_M = 0.04;

export const DEFAULT_BAG_BBOX: BoundingBoxM = {
  w: 0.36,
  h: 0.68,
  d: 0.28,
};

/**
 * C-11: Distance minimale garantissant que la caméra ne traverse jamais la géométrie du sac.
 * Basée sur la demi-diagonale englobante + marge optique du near-plane.
 */
export function computeMinSafeDistanceM(bbox: BoundingBoxM = DEFAULT_BAG_BBOX): number {
  const w = Math.max(0.1, bbox.w);
  const h = Math.max(0.1, bbox.h);
  const d = Math.max(0.1, bbox.d);
  const halfDiagonal = Math.hypot(w, h, d) * 0.5;
  return Number((halfDiagonal + 0.22).toFixed(4));
}

export function computeMaxSafeDistanceM(bbox: BoundingBoxM = DEFAULT_BAG_BBOX): number {
  const minSafe = computeMinSafeDistanceM(bbox);
  return Number(Math.max(2.6, minSafe * 3.6).toFixed(4));
}

/**
 * Calcule la position cartésienne [x, y, z] de la caméra à partir de sa pose sphérique.
 */
export function sphericalPoseToPosition(pose: CameraPose): Vec3Tuple {
  const cosElev = Math.cos(pose.elevationRad);
  const x = pose.target[0] + pose.distanceM * cosElev * Math.sin(pose.azimuthRad);
  const y = pose.target[1] + pose.distanceM * Math.sin(pose.elevationRad);
  const z = pose.target[2] + pose.distanceM * cosElev * Math.cos(pose.azimuthRad);
  return [x, y, z];
}

/**
 * C-10 & C-11: Borne la distance, l'élévation (±60°), l'horizon (roll = 0),
 * et interdit à la caméra de descendre sous le plan du sol (y < MIN_GROUND_CLEARANCE_M).
 */
export function clampCameraPose(
  raw: Omit<CameraPose, 'rollRad'> & { rollRad?: number },
  bbox: BoundingBoxM = DEFAULT_BAG_BBOX
): CameraPose {
  const minDist = computeMinSafeDistanceM(bbox);
  const maxDist = computeMaxSafeDistanceM(bbox);
  const distanceM = Math.min(maxDist, Math.max(minDist, Number.isFinite(raw.distanceM) ? raw.distanceM : minDist));

  // Élévation minimale pour rester au-dessus du sol : target.y + d * sin(elev) >= MIN_GROUND_CLEARANCE_M
  const targetY = raw.target[1];
  const sinFloor = Math.max(-1, Math.min(1, (MIN_GROUND_CLEARANCE_M - targetY) / distanceM));
  const floorElevationRad = Math.asin(sinFloor);

  const minElev = Math.max(MIN_ELEVATION_RAD, floorElevationRad);
  const rawElev = Number.isFinite(raw.elevationRad) ? raw.elevationRad : 0.24;
  const elevationRad = Math.min(MAX_ELEVATION_RAD, Math.max(minElev, rawElev));

  // Normalise l'azimut dans [-PI, PI]
  let azimuthRad = Number.isFinite(raw.azimuthRad) ? raw.azimuthRad : 0;
  while (azimuthRad > Math.PI) azimuthRad -= Math.PI * 2;
  while (azimuthRad < -Math.PI) azimuthRad += Math.PI * 2;

  return {
    target: [raw.target[0], raw.target[1], raw.target[2]],
    azimuthRad,
    elevationRad,
    distanceM,
    rollRad: 0,
  };
}

export function computeOverviewFraming(bbox: BoundingBoxM = DEFAULT_BAG_BBOX): CameraPose {
  const minSafe = computeMinSafeDistanceM(bbox);
  const maxDim = Math.max(bbox.w, bbox.h, bbox.d);
  return clampCameraPose(
    {
      target: [0, bbox.h * 0.5, 0],
      azimuthRad: 0.36,
      elevationRad: 0.22,
      distanceM: Math.max(minSafe * 1.45, maxDim * 1.9),
    },
    bbox
  );
}

export function computePartFraming(
  bbox: BoundingBoxM,
  partId: string,
  anchor?: Vec3Tuple,
  normal?: Vec3Tuple
): CameraPose {
  const minSafe = computeMinSafeDistanceM(bbox);
  let target: Vec3Tuple = anchor ?? [0, bbox.h * 0.52, 0];
  let azimuthRad = 0.25;
  let elevationRad = 0.2;

  if (normal) {
    azimuthRad = Math.atan2(normal[0], normal[2] || 0.0001);
    elevationRad = Math.asin(Math.max(-0.8, Math.min(0.8, normal[1])));
  } else if (partId.includes('lid')) {
    target = [0, bbox.h * 0.92, 0];
    azimuthRad = 0.18;
    elevationRad = 0.62;
  } else if (partId.includes('side-pocket-l') || partId.includes('strap-l')) {
    target = [-bbox.w * 0.35, bbox.h * 0.45, 0];
    azimuthRad = -Math.PI * 0.48;
    elevationRad = 0.16;
  } else if (partId.includes('side-pocket-r') || partId.includes('strap-r')) {
    target = [bbox.w * 0.35, bbox.h * 0.45, 0];
    azimuthRad = Math.PI * 0.48;
    elevationRad = 0.16;
  } else if (partId.includes('shoulder') || partId.includes('hip-belt')) {
    target = [0, bbox.h * 0.42, -bbox.d * 0.25];
    azimuthRad = Math.PI * 0.88;
    elevationRad = 0.18;
  } else if (partId.includes('front-pocket')) {
    target = [0, bbox.h * 0.34, bbox.d * 0.25];
    azimuthRad = 0.1;
    elevationRad = 0.14;
  }

  return clampCameraPose(
    {
      target,
      azimuthRad,
      elevationRad,
      distanceM: minSafe * 1.12,
    },
    bbox
  );
}

export function computeOpeningFraming(bbox: BoundingBoxM = DEFAULT_BAG_BBOX): CameraPose {
  const minSafe = computeMinSafeDistanceM(bbox);
  return clampCameraPose(
    {
      target: [0, bbox.h * 0.82, 0],
      azimuthRad: 0.12,
      elevationRad: 0.78,
      distanceM: minSafe * 1.25,
    },
    bbox
  );
}

export function interpolatePose(from: CameraPose, to: CameraPose, tRaw: number): CameraPose {
  const t = Math.max(0, Math.min(1, tRaw));
  // Ease out cubic
  const ease = 1 - Math.pow(1 - t, 3);

  // Shortest angular path for azimuth
  let deltaAz = to.azimuthRad - from.azimuthRad;
  while (deltaAz > Math.PI) deltaAz -= Math.PI * 2;
  while (deltaAz < -Math.PI) deltaAz += Math.PI * 2;

  return {
    target: [
      from.target[0] + (to.target[0] - from.target[0]) * ease,
      from.target[1] + (to.target[1] - from.target[1]) * ease,
      from.target[2] + (to.target[2] - from.target[2]) * ease,
    ],
    azimuthRad: from.azimuthRad + deltaAz * ease,
    elevationRad: from.elevationRad + (to.elevationRad - from.elevationRad) * ease,
    distanceM: from.distanceM + (to.distanceM - from.distanceM) * ease,
    rollRad: 0,
  };
}
