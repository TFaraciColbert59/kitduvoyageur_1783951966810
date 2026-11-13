/**
 * Lot N01 — Unités utilisateur & Orientation de carte (K4.06 + transversal).
 *
 * Invariants :
 * - Respect strict des unités (`metric` vs `imperial`) pour toutes les
 *   distances, altitudes, vitesses, allures et annonces vocales.
 * - Compensation de l'orientation de carte (`north-up` vs `course-up`) pour
 *   les flèches de guidage et de retour sur trace.
 * - À l'arrêt (`speedMs < MIN_MOVING_SPEED_MS`), le mode `course-up` conserve
 *   le dernier cap valide au lieu de faire tourner la carte sur le bruit GPS.
 * - Un geste utilisateur sur la carte suspend la rotation/centrage automatique
 *   (`userPanned = true`) ; l'action explicite « Recentrer » restaure l'état
 *   et le contexte du drawer parent sans aucune requête réseau.
 */

import { bearingLabel, screenBearingDeg } from '../explorer-v2/activity/offRoute';
import { MILE_DISTANCE_M } from '../explorer-v2/activity/splits';
import { MIN_MOVING_SPEED_MS } from '../explorer-v2/activity/tracker';
import type { MapOrientationMode, MapOrientationState, NavigationUnits } from './types';

export const FEET_PER_METER = 3.280839895;
export const YARDS_PER_METER = 1.093613298;

/** Normalise un angle en degrés dans [0, 360[. */
export function normalizeBearingDeg(deg: number | null | undefined): number | null {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return null;
  return ((deg % 360) + 360) % 360;
}

/** Différence angulaire signée la plus courte de `fromDeg` vers `toDeg` dans [-180, +180]. */
export function shortestAngleDeltaDeg(fromDeg: number, toDeg: number): number {
  const a = normalizeBearingDeg(fromDeg) ?? 0;
  const b = normalizeBearingDeg(toDeg) ?? 0;
  let delta = b - a;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

/**
 * Formate une distance (en mètres) selon les unités utilisateur (`metric` | `imperial`).
 * Renvoie `'—'` si la valeur est absente ou non finie (jamais `'0 m'` inventé).
 */
export function formatNavigationDistance(
  distanceM: number | null | undefined,
  units: NavigationUnits = 'metric',
): string {
  if (typeof distanceM !== 'number' || !Number.isFinite(distanceM) || distanceM < 0) {
    return '—';
  }
  if (units === 'imperial') {
    const miles = distanceM / MILE_DISTANCE_M;
    if (miles >= 0.1) {
      return miles >= 10 ? `${miles.toFixed(1)} mi` : `${miles.toFixed(2)} mi`;
    }
    const feet = Math.round(distanceM * FEET_PER_METER);
    return `${feet} ft`;
  }
  if (distanceM >= 1000) {
    const km = distanceM / 1000;
    return km >= 10 ? `${km.toFixed(1)} km` : `${km.toFixed(2)} km`;
  }
  return `${Math.round(distanceM)} m`;
}

/**
 * Formate une distance courte pour une instruction vocale (arrondie à 5/10 m ou 10/50 ft)
 * afin d'éviter des annonces artificiellement précises (« dans 143 mètres » -> « dans 140 mètres »).
 */
export function formatSpokenDistance(
  distanceM: number | null | undefined,
  units: NavigationUnits = 'metric',
): string {
  if (typeof distanceM !== 'number' || !Number.isFinite(distanceM) || distanceM < 0) {
    return '';
  }
  if (units === 'imperial') {
    const miles = distanceM / MILE_DISTANCE_M;
    if (miles >= 0.25) {
      const roundedMi = Math.round(miles * 10) / 10;
      return `${roundedMi} mile${roundedMi > 1 ? 's' : ''}`;
    }
    const rawFeet = distanceM * FEET_PER_METER;
    const roundedFeet = rawFeet >= 100 ? Math.round(rawFeet / 50) * 50 : Math.max(10, Math.round(rawFeet / 10) * 10);
    return `${roundedFeet} pieds`;
  }
  if (distanceM >= 1000) {
    const km = Math.round((distanceM / 1000) * 10) / 10;
    return `${String(km).replace('.', ',')} kilomètre${km >= 2 ? 's' : ''}`;
  }
  const roundedM =
    distanceM >= 100
      ? Math.round(distanceM / 10) * 10
      : distanceM >= 25
        ? Math.round(distanceM / 5) * 5
        : Math.max(5, Math.round(distanceM));
  return `${roundedM} mètres`;
}

/** Formate un dénivelé ou une altitude (en mètres) selon les unités utilisateur. */
export function formatNavigationElevation(
  elevationM: number | null | undefined,
  units: NavigationUnits = 'metric',
  withSign = false,
): string {
  if (typeof elevationM !== 'number' || !Number.isFinite(elevationM)) {
    return '—';
  }
  const value = units === 'imperial' ? Math.round(elevationM * FEET_PER_METER) : Math.round(elevationM);
  const unit = units === 'imperial' ? 'ft' : 'm';
  const prefix = withSign && value > 0 ? '+' : '';
  return `${prefix}${value} ${unit}`;
}

/** Formate une durée en secondes (`HH:MM:SS` ou `MM:SS`). */
export function formatNavigationDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }
  const totalS = Math.floor(seconds);
  const hrs = Math.floor(totalS / 3600);
  const mins = Math.floor((totalS % 3600) / 60);
  const secs = totalS % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/** Formate une vitesse (m/s) en km/h ou mph. */
export function formatNavigationSpeed(
  speedMs: number | null | undefined,
  units: NavigationUnits = 'metric',
): { value: string; unit: string; full: string } {
  if (typeof speedMs !== 'number' || !Number.isFinite(speedMs) || speedMs < 0) {
    const unit = units === 'imperial' ? 'mph' : 'km/h';
    return { value: '—', unit, full: '—' };
  }
  if (units === 'imperial') {
    const mph = (speedMs * 3600) / MILE_DISTANCE_M;
    const val = mph.toFixed(1);
    return { value: val, unit: 'mph', full: `${val} mph` };
  }
  const kmh = speedMs * 3.6;
  const val = kmh.toFixed(1);
  return { value: val, unit: 'km/h', full: `${val} km/h` };
}

/** Formate une allure à partir de la vitesse (m/s) ou de secondes/km en `min/km` ou `min/mi`. */
export function formatNavigationPaceFromSpeed(
  speedMs: number | null | undefined,
  units: NavigationUnits = 'metric',
): { value: string; unit: string; full: string } {
  const unit = units === 'imperial' ? '/mi' : '/km';
  if (typeof speedMs !== 'number' || !Number.isFinite(speedMs) || speedMs < MIN_MOVING_SPEED_MS) {
    return { value: '—', unit, full: '—' };
  }
  const unitDistanceM = units === 'imperial' ? MILE_DISTANCE_M : 1000;
  const secondsPerUnit = unitDistanceM / speedMs;
  if (!Number.isFinite(secondsPerUnit) || secondsPerUnit <= 0 || secondsPerUnit > 7200) {
    return { value: '—', unit, full: '—' };
  }
  const totalSec = Math.round(secondsPerUnit);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const val = `${mins}:${String(secs).padStart(2, '0')}`;
  return { value: val, unit, full: `${val} ${unit}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.06 — Machine d'état d'orientation de la carte (Nord fixe vs Sens de marche)
// ─────────────────────────────────────────────────────────────────────────────

export function createInitialOrientationState(
  northUp = false,
  initialCourseDeg = 0,
): MapOrientationState {
  const normalizedCourse = normalizeBearingDeg(initialCourseDeg) ?? 0;
  const mode: MapOrientationMode = northUp ? 'north-up' : 'course-up';
  return {
    mode,
    cameraBearingDeg: mode === 'north-up' ? 0 : normalizedCourse,
    lastValidCourseDeg: normalizedCourse,
    userPanned: false,
    returnSheetContext: null,
  };
}

export interface OrientationUpdateInput {
  /** Cap issu du GPS ou du mouvement (degrés, 0 = nord). */
  gpsHeadingDeg?: number | null;
  /** Cap tangent au tracé au point projeté (degrés, 0 = nord). */
  routeBearingDeg?: number | null;
  /** Vitesse courante (m/s) pour savoir si le cap GPS est fiable. */
  speedMs?: number | null;
}

/**
 * Met à jour le cap caméra selon le mode d'orientation (`north-up` ou `course-up`).
 *
 * - En `north-up`, `cameraBearingDeg` vaut toujours `0`.
 * - En `course-up`, si l'utilisateur est en mouvement (`speedMs >= MIN_MOVING_SPEED_MS`),
 *   le cap GPS prime ; sinon le cap du segment de trace ou le dernier cap valide
 *   est conservé pour éviter les rotations parasites à l'arrêt.
 * - Si `userPanned` est vrai, le cap caméra n'est pas écrasé tant que l'utilisateur
 *   n'a pas demandé un recentrage.
 */
export function updateOrientationFromMovement(
  state: MapOrientationState,
  input: OrientationUpdateInput,
): MapOrientationState {
  const speed = typeof input.speedMs === 'number' && Number.isFinite(input.speedMs) ? input.speedMs : 0;
  const moving = speed >= MIN_MOVING_SPEED_MS;
  const gpsBearing = normalizeBearingDeg(input.gpsHeadingDeg);
  const routeBearing = normalizeBearingDeg(input.routeBearingDeg);

  let nextCourse = state.lastValidCourseDeg;
  if (moving && gpsBearing !== null) {
    nextCourse = gpsBearing;
  } else if (routeBearing !== null && state.lastValidCourseDeg === 0 && gpsBearing === null) {
    nextCourse = routeBearing;
  } else if (moving && routeBearing !== null) {
    nextCourse = routeBearing;
  }

  if (state.userPanned) {
    return {
      ...state,
      lastValidCourseDeg: nextCourse,
    };
  }

  return {
    ...state,
    lastValidCourseDeg: nextCourse,
    cameraBearingDeg: state.mode === 'north-up' ? 0 : nextCourse,
  };
}

/**
 * Change le mode d'orientation (`north-up` <-> `course-up`) depuis le sous-drawer `⋯` (K4.06).
 * Ne déclenche aucune requête serveur ; met immédiatement à jour `cameraBearingDeg`.
 */
export function setMapOrientationMode(
  state: MapOrientationState,
  mode: MapOrientationMode,
): MapOrientationState {
  return {
    ...state,
    mode,
    cameraBearingDeg: mode === 'north-up' ? 0 : state.lastValidCourseDeg,
    userPanned: false,
  };
}

/** Enregistre l'ouverture du sous-drawer d'orientation en mémorisant le contexte parent (K4.06). */
export function openOrientationSubDrawer(
  state: MapOrientationState,
  parentContext: { sheet: string; detent: string; tab: number },
): MapOrientationState {
  return {
    ...state,
    returnSheetContext: { ...parentContext },
  };
}

/** Ferme le sous-drawer et restitue le contexte du drawer parent (K4.06). */
export function closeOrientationSubDrawer(state: MapOrientationState): {
  state: MapOrientationState;
  restoredContext: { sheet: string; detent: string; tab: number } | null;
} {
  return {
    state: { ...state, returnSheetContext: null },
    restoredContext: state.returnSheetContext ? { ...state.returnSheetContext } : null,
  };
}

/** Signale que l'utilisateur a déplacé ou tourné la carte manuellement. */
export function markUserMapPan(
  state: MapOrientationState,
  currentMapBearingDeg?: number | null,
): MapOrientationState {
  const actualBearing = normalizeBearingDeg(currentMapBearingDeg);
  return {
    ...state,
    userPanned: true,
    cameraBearingDeg: actualBearing ?? state.cameraBearingDeg,
  };
}

/**
 * Recentre la caméra après une interaction manuelle (K4.06) :
 * réactive le suivi et réapplique l'orientation persistée (`north-up` ou `course-up`).
 */
export function recenterNavigationCamera(state: MapOrientationState): MapOrientationState {
  return {
    ...state,
    userPanned: false,
    cameraBearingDeg: state.mode === 'north-up' ? 0 : state.lastValidCourseDeg,
  };
}

/**
 * Calcule l'angle écran d'une flèche directionnelle (manœuvre ou retour sur trace)
 * en tenant compte de l'orientation courante de la carte (`cameraBearingDeg`).
 */
export function compensateDirectionForScreen(
  worldBearingDeg: number | null | undefined,
  orientationState: Pick<MapOrientationState, 'cameraBearingDeg'> | number | null | undefined,
): number | null {
  const mapBearing =
    typeof orientationState === 'number'
      ? orientationState
      : orientationState?.cameraBearingDeg ?? 0;
  return screenBearingDeg(worldBearingDeg, mapBearing);
}

export { bearingLabel };
