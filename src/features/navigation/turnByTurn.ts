/**
 * Lot N01 — Moteur de guidage virage par virage (K4.02, S3.11).
 *
 * Responsabilités :
 * - Extraire les manœuvres (`RouteManeuver`) d'une géométrie GeoJSON / `RouteLine[]`
 *   ou normaliser des manœuvres pré-calculées (Valhalla / paquet hors-ligne).
 * - Projeter la position GPS sur le tracé (`projectPositionOnRoute`) avec calcul
 *   de l'abscisse curviligne `alongTrackM`, de la distance restante, de l'écart
 *   latéral `crossTrackM` et du cap tangent.
 * - Détecter le déplacement à contresens (`reverseDirection`) sans faux positif
 *   lié au bruit GPS stationnaire.
 * - Produire l'état de guidage (`TurnByTurnState`) et les instructions vocales
 *   sans aucune dépendance réseau (fonctionne en mode avion dès que la géométrie
 *   ou les manœuvres du parcours sont chargées).
 */

import {
  EARTH_RADIUS_M,
  bearingDegrees,
  haversineM,
  isValidLngLat,
  routeLines,
  trackRevision,
  type LngLat,
  type RouteLine,
} from '../explorer-v2/geo/track';
import type {
  AnnouncementStage,
  ManeuverKind,
  NavigationUnits,
  RouteManeuver,
  RouteProgressSnapshot,
  TurnByTurnState,
} from './types';
import {
  formatNavigationDistance,
  formatSpokenDistance,
  shortestAngleDeltaDeg,
} from './unitsAndOrientation';

/** Seuil d'angle minimal (en degrés) pour qualifier un changement de direction. */
export const MIN_TURN_ANGLE_DEG = 22;
/** Distance minimale entre deux manœuvres générées pour éviter les micro-zigzags (m). */
export const MIN_MANEUVER_SPACING_M = 25;
/** Distance d'annonce anticipée d'une manœuvre (m). */
export const PRE_ANNOUNCE_DISTANCE_M = 180;
/** Distance d'approche d'une manœuvre (m). */
export const APPROACHING_DISTANCE_M = 70;
/** Distance d'exécution immédiate d'une manœuvre (m). */
export const IMMINENT_DISTANCE_M = 22;
/** Recul cumulé minimal le long du tracé pour déclarer un contresens (m). */
export const REVERSE_DIRECTION_THRESHOLD_M = 35;

export interface ExtractManeuversOptions {
  minTurnAngleDeg?: number;
  minSpacingM?: number;
  revision?: string;
}

/** Qualifie le type de virage à partir de l'angle signé (-180° à +180°, positif = droite). */
export function classifyTurnAngle(turnAngleDeg: number): ManeuverKind {
  const abs = Math.abs(turnAngleDeg);
  if (abs >= 150) return 'u-turn';
  if (turnAngleDeg > 0) {
    if (abs >= 105) return 'sharp-right';
    if (abs >= 45) return 'turn-right';
    if (abs >= MIN_TURN_ANGLE_DEG) return 'slight-right';
    return 'straight';
  }
  if (abs >= 105) return 'sharp-left';
  if (abs >= 45) return 'turn-left';
  if (abs >= MIN_TURN_ANGLE_DEG) return 'slight-left';
  return 'straight';
}

/** Libellé d'action court (français) pour un type de manœuvre. */
export function maneuverActionLabel(kind: ManeuverKind, streetName?: string | null): string {
  const suffix = streetName && streetName.trim().length > 0 ? ` sur ${streetName.trim()}` : '';
  switch (kind) {
    case 'depart':
      return `Prendre le départ${suffix}`;
    case 'straight':
      return `Continuer tout droit${suffix}`;
    case 'slight-left':
      return `Obliquer légèrement à gauche${suffix}`;
    case 'turn-left':
      return `Tourner à gauche${suffix}`;
    case 'sharp-left':
      return `Tourner fortement à gauche${suffix}`;
    case 'slight-right':
      return `Obliquer légèrement à droite${suffix}`;
    case 'turn-right':
      return `Tourner à droite${suffix}`;
    case 'sharp-right':
      return `Tourner fortement à droite${suffix}`;
    case 'u-turn':
      return `Faire demi-tour${suffix}`;
    case 'waypoint':
      return streetName ? `Point de passage : ${streetName.trim()}` : 'Point de passage';
    case 'arrive':
      return `Arrivée à destination${suffix}`;
  }
}

/** Aplatit les lignes d'un tracé en sommets valides avec leur abscisse curviligne. */
export interface FlattenedRouteVertex {
  position: [number, number];
  alongTrackM: number;
  lineIndex: number;
  vertexIndex: number;
}

export function flattenRouteVertices(lines: readonly RouteLine[]): FlattenedRouteVertex[] {
  const vertices: FlattenedRouteVertex[] = [];
  let cumulativeM = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    const line = lines[lineIdx];
    let prev: LngLat | null = null;
    for (let vIdx = 0; vIdx < line.length; vIdx += 1) {
      const pt = line[vIdx];
      if (!isValidLngLat(pt)) continue;
      if (prev) {
        const seg = haversineM(prev, pt);
        if (Number.isFinite(seg) && seg > 0) {
          cumulativeM += seg;
        }
      } else if (vertices.length > 0) {
        const lastVertex = vertices[vertices.length - 1].position;
        const jump = haversineM(lastVertex, pt);
        if (Number.isFinite(jump) && jump > 0) {
          cumulativeM += jump;
        }
      }
      vertices.push({
        position: [pt[0], pt[1]],
        alongTrackM: cumulativeM,
        lineIndex: lineIdx,
        vertexIndex: vIdx,
      });
      prev = pt;
    }
  }
  return vertices;
}

/**
 * Extrait de manière déterministe les manœuvres d'un tracé (`RouteLine[]` ou GeoJSON).
 * Génère toujours une manœuvre `depart` au début et `arrive` à la fin si la trace
 * compte au moins 2 sommets distincts.
 */
export function extractRouteManeuvers(
  routeInput: readonly RouteLine[] | unknown,
  options: ExtractManeuversOptions = {},
): RouteManeuver[] {
  const lines: readonly RouteLine[] =
    Array.isArray(routeInput) &&
    routeInput.length > 0 &&
    Array.isArray(routeInput[0]) &&
    Array.isArray((routeInput[0] as unknown[])[0])
      ? (routeInput as readonly RouteLine[])
      : routeLines(routeInput);

  const vertices = flattenRouteVertices(lines);
  if (vertices.length < 2) return [];

  const minAngle = options.minTurnAngleDeg ?? MIN_TURN_ANGLE_DEG;
  const minSpacingM = options.minSpacingM ?? MIN_MANEUVER_SPACING_M;
  const rev =
    options.revision ??
    trackRevision(vertices.map((v) => v.position));

  const maneuvers: RouteManeuver[] = [];
  const first = vertices[0];
  const second = vertices[1];
  const initialBearing = bearingDegrees(first.position, second.position);

  maneuvers.push({
    id: `${rev}:m:0`,
    index: 0,
    kind: 'depart',
    position: first.position,
    alongTrackM: 0,
    bearingBeforeDeg: Number.isFinite(initialBearing) ? initialBearing : 0,
    bearingAfterDeg: Number.isFinite(initialBearing) ? initialBearing : 0,
    turnAngleDeg: 0,
    rawInstruction: maneuverActionLabel('depart'),
  });

  let lastManeuverAlongM = 0;

  for (let i = 1; i < vertices.length - 1; i += 1) {
    const prev = vertices[i - 1];
    const curr = vertices[i];
    const next = vertices[i + 1];

    const segInM = curr.alongTrackM - prev.alongTrackM;
    const segOutM = next.alongTrackM - curr.alongTrackM;
    if (segInM < 3 || segOutM < 3) continue;
    if (curr.alongTrackM - lastManeuverAlongM < minSpacingM) continue;

    const bearingBefore = bearingDegrees(prev.position, curr.position);
    const bearingAfter = bearingDegrees(curr.position, next.position);
    if (!Number.isFinite(bearingBefore) || !Number.isFinite(bearingAfter)) continue;

    const turnAngle = shortestAngleDeltaDeg(bearingBefore, bearingAfter);
    if (Math.abs(turnAngle) < minAngle) continue;

    const kind = classifyTurnAngle(turnAngle);
    if (kind === 'straight') continue;

    const idx = maneuvers.length;
    maneuvers.push({
      id: `${rev}:m:${idx}`,
      index: idx,
      kind,
      position: curr.position,
      alongTrackM: Math.round(curr.alongTrackM * 10) / 10,
      bearingBeforeDeg: Math.round(bearingBefore),
      bearingAfterDeg: Math.round(bearingAfter),
      turnAngleDeg: Math.round(turnAngle),
      rawInstruction: maneuverActionLabel(kind),
    });
    lastManeuverAlongM = curr.alongTrackM;
  }

  const last = vertices[vertices.length - 1];
  const beforeLast = vertices[vertices.length - 2];
  const finalBearing = bearingDegrees(beforeLast.position, last.position);
  const arriveIdx = maneuvers.length;
  maneuvers.push({
    id: `${rev}:m:${arriveIdx}`,
    index: arriveIdx,
    kind: 'arrive',
    position: last.position,
    alongTrackM: Math.round(last.alongTrackM * 10) / 10,
    bearingBeforeDeg: Number.isFinite(finalBearing) ? Math.round(finalBearing) : 0,
    bearingAfterDeg: Number.isFinite(finalBearing) ? Math.round(finalBearing) : 0,
    turnAngleDeg: 0,
    rawInstruction: maneuverActionLabel('arrive'),
  });

  return maneuvers;
}

/**
 * Projette une position `[lng, lat]` sur les lignes du tracé et calcule la
 * progression curviligne (`alongTrackM`, `remainingDistanceM`, `crossTrackM`).
 *
 * Si `previousAlongTrackM` est fourni, un léger bonus de continuité évite de
 * sauter sur la branche retour d'une boucle tant que l'écart géométrique est
 * équivalent (< 15 m).
 */
export function projectPositionOnRoute(
  point: LngLat,
  lines: readonly RouteLine[],
  previousAlongTrackM?: number | null,
): RouteProgressSnapshot | null {
  if (!isValidLngLat(point) || lines.length === 0) return null;

  const lat0 = (point[1] * Math.PI) / 180;
  const metresPerDegLat = (EARTH_RADIUS_M * Math.PI) / 180;
  const metresPerDegLng = metresPerDegLat * Math.cos(lat0);

  let totalLengthM = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const d = haversineM(line[i - 1], line[i]);
      if (Number.isFinite(d)) totalLengthM += d;
    }
  }
  if (totalLengthM <= 0) return null;

  let bestScore = Number.POSITIVE_INFINITY;
  let bestCrossTrackM = Number.POSITIVE_INFINITY;
  let bestAlongM = 0;
  let bestPoint: [number, number] = [point[0], point[1]];
  let bestLineIdx = 0;
  let bestSegIdx = 0;
  let bestSegBearing = 0;

  let cumulativeBeforeSegM = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    const line = lines[lineIdx];
    for (let segIdx = 1; segIdx < line.length; segIdx += 1) {
      const a = line[segIdx - 1];
      const b = line[segIdx];
      if (!isValidLngLat(a) || !isValidLngLat(b)) continue;

      const segLengthM = haversineM(a, b);
      if (!Number.isFinite(segLengthM) || segLengthM <= 0) continue;

      const ax = (a[0] - point[0]) * metresPerDegLng;
      const ay = (a[1] - point[1]) * metresPerDegLat;
      const bx = (b[0] - point[0]) * metresPerDegLng;
      const by = (b[1] - point[1]) * metresPerDegLat;
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      const t = lenSq > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq)) : 0;
      const crossTrackM = Math.hypot(ax + t * dx, ay + t * dy);
      const candidateAlongM = cumulativeBeforeSegM + t * segLengthM;

      // Pénalité douce de discontinuité sur les boucles/lacets si `previousAlongTrackM` est connu
      let continuityPenalty = 0;
      if (typeof previousAlongTrackM === 'number' && Number.isFinite(previousAlongTrackM)) {
        const jumpM = Math.abs(candidateAlongM - previousAlongTrackM);
        if (jumpM > 250) {
          continuityPenalty = Math.min(12, jumpM * 0.01);
        }
      }

      const score = crossTrackM + continuityPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestCrossTrackM = crossTrackM;
        bestAlongM = candidateAlongM;
        bestPoint = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        bestLineIdx = lineIdx;
        bestSegIdx = segIdx - 1;
        bestSegBearing = bearingDegrees(a, b);
      }

      cumulativeBeforeSegM += segLengthM;
    }
  }

  if (!Number.isFinite(bestCrossTrackM)) return null;

  const returnBearing =
    bestCrossTrackM < 0.5 ? bestSegBearing : bearingDegrees(point, bestPoint);

  return {
    alongTrackM: Math.max(0, Math.min(totalLengthM, bestAlongM)),
    remainingDistanceM: Math.max(0, totalLengthM - bestAlongM),
    crossTrackM: bestCrossTrackM,
    pointOnRoute: bestPoint,
    lineIndex: bestLineIdx,
    segmentIndex: bestSegIdx,
    segmentBearingDeg: Number.isFinite(bestSegBearing) ? bestSegBearing : 0,
    returnBearingDeg: Number.isFinite(returnBearing) ? returnBearing : 0,
  };
}

/**
 * Détecte si l'utilisateur parcourt le tracé à contresens sur une fenêtre de
 * progressions (`alongTrackM`).
 * Exige au moins 3 échantillons consécutifs décroissants et un recul net >= `thresholdM`
 * alors que l'utilisateur est proche de la trace (`crossTrackM <= 40 m`).
 */
export function detectReverseDirection(
  alongHistory: ReadonlyArray<{ alongTrackM: number; crossTrackM: number }>,
  thresholdM: number = REVERSE_DIRECTION_THRESHOLD_M,
): boolean {
  if (alongHistory.length < 3) return false;
  const tail = alongHistory.slice(-4);
  for (const sample of tail) {
    if (sample.crossTrackM > 40) return false;
  }
  let strictlyDecreasingSteps = 0;
  for (let i = 1; i < tail.length; i += 1) {
    if (tail[i].alongTrackM < tail[i - 1].alongTrackM - 2) {
      strictlyDecreasingSteps += 1;
    } else if (tail[i].alongTrackM > tail[i - 1].alongTrackM + 2) {
      return false;
    }
  }
  const netDelta = tail[tail.length - 1].alongTrackM - tail[0].alongTrackM;
  return strictlyDecreasingSteps >= 2 && netDelta <= -Math.abs(thresholdM);
}

/** Détermine le palier d'annonce en fonction de la distance à la prochaine manœuvre. */
export function resolveAnnouncementStage(distanceToManeuverM: number | null): AnnouncementStage {
  if (distanceToManeuverM === null || !Number.isFinite(distanceToManeuverM)) return 'none';
  if (distanceToManeuverM < -10) return 'passed';
  if (distanceToManeuverM <= IMMINENT_DISTANCE_M) return 'imminent';
  if (distanceToManeuverM <= APPROACHING_DISTANCE_M) return 'approaching';
  if (distanceToManeuverM <= PRE_ANNOUNCE_DISTANCE_M) return 'pre-announce';
  return 'none';
}

/** Construit la phrase vocale (TTS) adaptée au palier d'annonce et aux unités. */
export function buildSpokenManeuverInstruction(
  maneuver: RouteManeuver,
  distanceToManeuverM: number,
  stage: AnnouncementStage,
  units: NavigationUnits = 'metric',
): string {
  const action = maneuver.rawInstruction || maneuverActionLabel(maneuver.kind, maneuver.streetName);
  if (maneuver.kind === 'arrive' && stage === 'imminent') {
    return 'Vous êtes arrivé à destination.';
  }
  if (stage === 'imminent') {
    return `${action} maintenant.`;
  }
  const spokenDist = formatSpokenDistance(distanceToManeuverM, units);
  return `Dans ${spokenDist}, ${action.charAt(0).toLowerCase()}${action.slice(1)}.`;
}

export function createInitialTurnByTurnState(
  lines: readonly RouteLine[],
  preloadedManeuvers?: readonly RouteManeuver[],
  routeRevisionOverride?: string,
): TurnByTurnState {
  const vertices = flattenRouteVertices(lines);
  const revision =
    routeRevisionOverride ??
    (vertices.length > 0 ? trackRevision(vertices.map((v) => v.position)) : 'empty');
  const maneuvers =
    preloadedManeuvers && preloadedManeuvers.length > 0
      ? [...preloadedManeuvers]
      : extractRouteManeuvers(lines, { revision });

  const firstManeuver = maneuvers.find((m) => m.kind !== 'depart') ?? maneuvers[0] ?? null;
  const secondManeuver =
    firstManeuver ? maneuvers.find((m) => m.index > firstManeuver.index) ?? null : null;

  return {
    routeRevision: revision,
    maneuvers,
    progress: null,
    nextManeuver: firstManeuver,
    secondaryManeuver: secondManeuver,
    distanceToNextM: firstManeuver ? firstManeuver.alongTrackM : null,
    formattedDistanceToNext: firstManeuver
      ? formatNavigationDistance(firstManeuver.alongTrackM, 'metric')
      : null,
    stage: 'none',
    primaryInstruction: firstManeuver
      ? firstManeuver.rawInstruction || maneuverActionLabel(firstManeuver.kind, firstManeuver.streetName)
      : 'Aucun guidage actif',
    spokenInstruction: null,
    shouldSpeak: false,
    reverseDirection: false,
    offlineReady: maneuvers.length > 0,
    announcedKeys: new Set<string>(),
  };
}

export interface EvaluateTurnByTurnOptions {
  units?: NavigationUnits;
  alongHistory?: ReadonlyArray<{ alongTrackM: number; crossTrackM: number }>;
  isOffRoute?: boolean;
}

/**
 * Évalue la progression virage par virage pour une position GPS donnée.
 * Fonction pure : renvoie le nouvel état `TurnByTurnState` avec `shouldSpeak`
 * positionné à `true` une seule fois par couple `(maneuver.id, stage)`.
 */
export function evaluateTurnByTurn(
  position: LngLat,
  lines: readonly RouteLine[],
  previousState: TurnByTurnState,
  options: EvaluateTurnByTurnOptions = {},
): TurnByTurnState {
  const units = options.units ?? 'metric';
  const progress = projectPositionOnRoute(
    position,
    lines,
    previousState.progress?.alongTrackM ?? null,
  );

  if (!progress || previousState.maneuvers.length === 0) {
    return {
      ...previousState,
      progress: null,
      shouldSpeak: false,
      spokenInstruction: null,
    };
  }

  const history = [
    ...(options.alongHistory ?? []),
    { alongTrackM: progress.alongTrackM, crossTrackM: progress.crossTrackM },
  ];
  const reverseDirection = detectReverseDirection(history);

  // Si l'utilisateur est en contresens avéré, l'alerte de sens inverse prime
  if (reverseDirection) {
    const reverseKey = `${previousState.routeRevision}:reverse`;
    const alreadyAnnounced = previousState.announcedKeys.has(reverseKey);
    const nextKeys = new Set(previousState.announcedKeys);
    nextKeys.add(reverseKey);
    return {
      ...previousState,
      progress,
      reverseDirection: true,
      stage: 'none',
      primaryInstruction: 'Sens inverse détecté sur le parcours',
      spokenInstruction: 'Attention, vous progressez en sens inverse du parcours.',
      shouldSpeak: !alreadyAnnounced,
      announcedKeys: nextKeys,
    };
  }

  // Chercher la prochaine manœuvre devant `alongTrackM` (tolérance de 8 m après le point)
  const upcoming = previousState.maneuvers.filter(
    (m) => m.kind !== 'depart' && m.alongTrackM >= progress.alongTrackM - 8,
  );
  const nextManeuver = upcoming[0] ?? previousState.maneuvers[previousState.maneuvers.length - 1] ?? null;
  const secondaryManeuver = upcoming[1] ?? null;

  if (!nextManeuver) {
    return {
      ...previousState,
      progress,
      nextManeuver: null,
      secondaryManeuver: null,
      distanceToNextM: null,
      formattedDistanceToNext: null,
      stage: 'none',
      shouldSpeak: false,
      spokenInstruction: null,
      reverseDirection: false,
    };
  }

  const distanceToNextM = Math.max(0, nextManeuver.alongTrackM - progress.alongTrackM);
  const formattedDistanceToNext = formatNavigationDistance(distanceToNextM, units);
  const stage = options.isOffRoute ? 'none' : resolveAnnouncementStage(distanceToNextM);
  const actionText =
    nextManeuver.rawInstruction || maneuverActionLabel(nextManeuver.kind, nextManeuver.streetName);

  const announceableStage =
    stage === 'pre-announce' || stage === 'approaching' || stage === 'imminent';
  const announceKey = `${nextManeuver.id}:${stage}`;
  const shouldSpeak =
    announceableStage && !previousState.announcedKeys.has(announceKey) && !options.isOffRoute;

  const nextAnnouncedKeys = new Set(previousState.announcedKeys);
  if (shouldSpeak) {
    nextAnnouncedKeys.add(announceKey);
  }

  const spokenInstruction = announceableStage
    ? buildSpokenManeuverInstruction(nextManeuver, distanceToNextM, stage, units)
    : null;

  return {
    ...previousState,
    progress,
    nextManeuver,
    secondaryManeuver,
    distanceToNextM,
    formattedDistanceToNext,
    stage,
    primaryInstruction: `${actionText} · ${formattedDistanceToNext}`,
    spokenInstruction,
    shouldSpeak,
    reverseDirection: false,
    announcedKeys: nextAnnouncedKeys,
  };
}
