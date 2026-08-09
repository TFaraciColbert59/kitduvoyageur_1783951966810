/**
 * RouteGeom — Calculs géométriques réels sur une géométrie de randonnée PostGIS.
 *
 * Aucune donnée inventée : tout est dérivé de la géométrie source et des
 * coordonnées GPS réelles (haversine / distance point-à-segment).
 */

export interface RouteSegment {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  /** Longueur du segment en mètres (haversine). */
  segLenM: number;
  /** Distance cumulée depuis le début de la route jusqu'au début du segment. */
  cumLenM: number;
}

export interface ClosestOnRoute {
  distanceM: number;
  progressFrac: number;
  closestLat: number;
  closestLon: number;
  bearingDeg: number;
}

export interface RoutePoiInput {
  id?: string | number;
  name: string;
  category?: string | null;
  lat: number | string;
  lng: number | string;
}

export interface RoutePoi {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  /** Distance perpendiculaire au tracé (m). */
  distanceM: number;
  /** Fraction de progression le long du tracé (0..1). */
  progressFrac: number;
}

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function isValidCoord(lat: unknown, lng: unknown): lat is number {
  if (lat == null || lng == null) return false;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (Number.isNaN(nLat) || Number.isNaN(nLng)) return false;
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return false;
  return nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180;
}

/** Distance haversine en mètres. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Parcourt un GeoJSON LineString/MultiLineString et renvoie les segments valides. */
export function flattenSegments(geojson: unknown): RouteSegment[] {
  if (!geojson || typeof geojson !== 'object') return [];
  const g = geojson as { type?: string; coordinates?: unknown };
  if (g.type !== 'LineString' && g.type !== 'MultiLineString') return [];
  const coords = g.coordinates;
  if (!Array.isArray(coords)) return [];

  const lines: unknown[][] =
    g.type === 'MultiLineString' ? (coords as unknown[][]) : [coords as unknown[]];

  const segments: RouteSegment[] = [];
  let cumLenM = 0;

  for (const line of lines) {
    if (!Array.isArray(line) || line.length < 2) continue;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i] as number[];
      const b = line[i + 1] as number[];
      if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) continue;
      const lng1 = Number(a[0]);
      const lat1 = Number(a[1]);
      const lng2 = Number(b[0]);
      const lat2 = Number(b[1]);
      if (!isValidCoord(lat1, lng1) || !isValidCoord(lat2, lng2)) continue;
      const segLenM = haversineMeters(lat1, lng1, lat2, lng2);
      segments.push({ startLat: lat1, startLng: lng1, endLat: lat2, endLng: lng2, segLenM, cumLenM });
      cumLenM += segLenM;
    }
  }
  return segments;
}

export function totalLengthM(segments: RouteSegment[]): number {
  const last = segments[segments.length - 1];
  return last ? last.cumLenM + last.segLenM : 0;
}

/**
 * Distance perpendiculaire (m) d'un point à un segment sphérique (approx planaire,
 * valable pour des segments GPS courts) + point le plus proche projeté.
 */
function pointToSegment(
  lat: number,
  lng: number,
  seg: RouteSegment
): { distanceM: number; projLat: number; projLng: number; alongM: number } {
  const x1 = toRad(seg.startLng) * Math.cos(toRad(seg.startLat));
  const y1 = toRad(seg.startLat);
  const x2 = toRad(seg.endLng) * Math.cos(toRad(seg.endLat));
  const y2 = toRad(seg.endLat);
  const xp = toRad(lng) * Math.cos(toRad(lat));
  const yp = toRad(lat);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 0 ? ((xp - x1) * dx + (yp - y1) * dy) / lenSq : 0;
  const clamped = Math.max(0, Math.min(1, t));
  const projX = x1 + clamped * dx;
  const projY = y1 + clamped * dy;
  const projLng = (projX * 180) / Math.PI / Math.max(1e-9, Math.cos(projY));
  const projLat = (projY * 180) / Math.PI;

  const distanceM = haversineMeters(lat, lng, projLat, projLng);
  const alongM = clamped * seg.segLenM;
  return { distanceM, projLat, projLng, alongM };
}

/**
 * Point le plus proche de la route (géométrie) pour une position GPS donnée.
 * Retourne distance réelle, fraction de progression le long du tracé et cap
 * (bearing) depuis la position vers le chemin de retour.
 */
export function closestOnRoute(geojson: unknown, lat: number, lng: number): ClosestOnRoute | null {
  const segments = flattenSegments(geojson);
  const total = totalLengthM(segments);
  if (segments.length === 0 || total <= 0) return null;

  let best: { d: number; projLat: number; projLng: number; alongM: number; segCum: number } | null = null;
  for (const seg of segments) {
    const r = pointToSegment(lat, lng, seg);
    if (!best || r.distanceM < best.d) {
      best = { d: r.distanceM, projLat: r.projLat, projLng: r.projLng, alongM: r.alongM, segCum: seg.cumLenM };
    }
  }
  if (!best) return null;

  const progressFrac = Math.max(0, Math.min(1, (best.segCum + best.alongM) / total));
  const bearingDeg = initialBearingDeg(lat, lng, best.projLat, best.projLng);
  return {
    distanceM: best.d,
    progressFrac,
    closestLat: best.projLat,
    closestLon: best.projLng,
    bearingDeg,
  };
}

export function initialBearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = toRad(lng2 - lng1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** Premier point valide d'une géométrie (point de départ réel de la route). */
export function routeStartPoint(geojson: unknown): { lat: number; lng: number } | null {
  if (!geojson || typeof geojson !== 'object') return null;
  const g = geojson as { type?: string; coordinates?: unknown };
  if (g.type !== 'LineString' && g.type !== 'MultiLineString') return null;
  const coords = g.coordinates;
  if (!Array.isArray(coords)) return null;
  const firstLine = g.type === 'MultiLineString' ? (coords[0] as number[][]) : (coords as number[][]);
  if (!Array.isArray(firstLine) || firstLine.length === 0) return null;
  const first = firstLine[0];
  if (!Array.isArray(first) || first.length < 2) return null;
  const lng = Number(first[0]);
  const lat = Number(first[1]);
  if (!isValidCoord(lat, lng)) return null;
  return { lat, lng };
}

/**
 * Bearing de la route (géométrie réelle) au point de progression donné :
 * direction du segment (ou du segment suivant) sur lequel se trouve le hiker.
 * Retourne null si la géométrie est invalide ou à la toute fin du tracé.
 */
export function routeBearingAt(geojson: unknown, progressFrac: number | null | undefined): number | null {
  if (progressFrac == null || !Number.isFinite(progressFrac) || progressFrac < 0 || progressFrac >= 1) return null;
  const segments = flattenSegments(geojson);
  const total = totalLengthM(segments);
  if (segments.length === 0 || total <= 0) return null;

  const targetM = total * progressFrac;

  // Segment contenant targetM ; si pile à la fin, on avance d'un segment.
  let idx = segments.findIndex((s) => s.cumLenM <= targetM && s.cumLenM + s.segLenM >= targetM);
  if (idx < 0) {
    idx = segments.findIndex((s) => s.cumLenM > targetM);
  }
  if (idx < 0) idx = segments.length - 1;
  const seg = segments[idx];
  if (!seg || seg.segLenM <= 0) return null;
  return initialBearingDeg(seg.startLat, seg.startLng, seg.endLat, seg.endLng);
}

/**
 * Associe de vrais POI à une route : garde uniquement ceux à moins de
 * maxDistanceM du tracé, triés selon la fraction de progression le long du tracé.
 */
export function computeRoutePois(geojson: unknown, pois: RoutePoiInput[], maxDistanceM = 750): RoutePoi[] {
  const segments = flattenSegments(geojson);
  const total = totalLengthM(segments);
  if (segments.length === 0 || total <= 0) return [];

  const result: RoutePoi[] = [];
  for (const poi of pois) {
    const lat = Number(poi.lat);
    const lng = Number(poi.lng);
    if (!isValidCoord(lat, lng)) continue;

    let best: { d: number; alongM: number; segCum: number } | null = null;
    for (const seg of segments) {
      const r = pointToSegment(lat, lng, seg);
      if (!best || r.distanceM < best.d) {
        best = { d: r.distanceM, alongM: r.alongM, segCum: seg.cumLenM };
      }
    }
    if (!best || best.d > maxDistanceM) continue;

    result.push({
      id: String(poi.id ?? `${lat}-${lng}`),
      name: poi.name,
      category: poi.category || 'waypoint',
      lat,
      lon: lng,
      distanceM: Math.round(best.d),
      progressFrac: Math.max(0, Math.min(1, (best.segCum + best.alongM) / total)),
    });
  }

  result.sort((a, b) => a.progressFrac - b.progressFrac);
  return result;
}

export type TurnType =
  | 'tout_droit'
  | 'leger_droite'
  | 'droite'
  | 'serre_droite'
  | 'leger_gauche'
  | 'gauche'
  | 'serre_gauche';

export interface RouteTurnEvent {
  id: string;
  turnType: TurnType;
  angleDeg: number;
  progressFrac: number;
  distanceMFromStart: number;
  lat: number;
  lng: number;
  instructionText: string;
}

/**
  * Détecte les virages significatifs le long d'une géométrie de randonnée.
  * Réalise un échantillonnage/lissage pour éviter les faux virages dus aux bruits GPS/micro-segments.
  */
export function detectRouteTurns(geojson: unknown, minAngleDeg = 20, windowM = 25): RouteTurnEvent[] {
  const segments = flattenSegments(geojson);
  const total = totalLengthM(segments);
  if (segments.length === 0 || total <= 0) return [];

  // Echantillonner la route tous les ~15m pour lisser les micro-variations
  const sampleStepM = 15;
  const numSamples = Math.floor(total / sampleStepM);
  if (numSamples < 3) return [];

  const points: { lat: number; lng: number; cumM: number; frac: number }[] = [];
  for (let i = 0; i <= numSamples; i++) {
    const targetM = Math.min(total, i * sampleStepM);
    let idx = segments.findIndex((s) => s.cumLenM <= targetM && s.cumLenM + s.segLenM >= targetM);
    if (idx < 0) idx = segments.length - 1;
    const seg = segments[idx];
    if (!seg || seg.segLenM <= 0) continue;
    const t = (targetM - seg.cumLenM) / seg.segLenM;
    const lat = seg.startLat + (seg.endLat - seg.startLat) * t;
    const lng = seg.startLng + (seg.endLng - seg.startLng) * t;
    points.push({ lat, lng, cumM: targetM, frac: targetM / total });
  }

  const turns: RouteTurnEvent[] = [];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const bearingBefore = initialBearingDeg(prev.lat, prev.lng, curr.lat, curr.lng);
    const bearingAfter = initialBearingDeg(curr.lat, curr.lng, next.lat, next.lng);

    // Ecart d'angle dans [-180, 180]
    const delta = (((bearingAfter - bearingBefore + 540) % 360) - 180);

    if (Math.abs(delta) < minAngleDeg) continue;

    let turnType: TurnType = 'tout_droit';
    let text = 'Continuez tout droit';

    if (delta >= 15 && delta < 45) {
      turnType = 'leger_droite';
      text = 'Légèrement à droite';
    } else if (delta >= 45 && delta < 120) {
      turnType = 'droite';
      text = 'Tournez à droite';
    } else if (delta >= 120) {
      turnType = 'serre_droite';
      text = 'Virage serré à droite';
    } else if (delta <= -15 && delta > -45) {
      turnType = 'leger_gauche';
      text = 'Légèrement à gauche';
    } else if (delta <= -45 && delta > -120) {
      turnType = 'gauche';
      text = 'Tournez à gauche';
    } else if (delta <= -120) {
      turnType = 'serre_gauche';
      text = 'Virage serré à gauche';
    }

    // Eviter de doublonner avec un virage immédiatement précédent (< 35m)
    const lastTurn = turns[turns.length - 1];
    if (lastTurn && curr.cumM - lastTurn.distanceMFromStart < 35) {
      if (Math.abs(delta) > Math.abs(lastTurn.angleDeg)) {
        turns[turns.length - 1] = {
          id: `turn-${Math.round(curr.cumM)}`,
          turnType,
          angleDeg: Math.round(delta),
          progressFrac: curr.frac,
          distanceMFromStart: Math.round(curr.cumM),
          lat: curr.lat,
          lng: curr.lng,
          instructionText: text,
        };
      }
      continue;
    }

    turns.push({
      id: `turn-${Math.round(curr.cumM)}`,
      turnType,
      angleDeg: Math.round(delta),
      progressFrac: curr.frac,
      distanceMFromStart: Math.round(curr.cumM),
      lat: curr.lat,
      lng: curr.lng,
      instructionText: text,
    });
  }

  return turns;
}

/**
  * Retourne le prochain virage sur le tracé en fonction de la progression actuelle.
  */
export function nextTurnOnRoute(
  geojson: unknown,
  progressFrac: number | null | undefined
): { turn: RouteTurnEvent; distanceRemainingM: number } | null {
  if (progressFrac == null || !Number.isFinite(progressFrac) || progressFrac < 0 || progressFrac >= 1) return null;
  const turns = detectRouteTurns(geojson);
  if (turns.length === 0) return null;

  const segments = flattenSegments(geojson);
  const totalM = totalLengthM(segments);
  if (totalM <= 0) return null;

  const currentDistM = progressFrac * totalM;
  const upcoming = turns.find((t) => t.distanceMFromStart > currentDistM + 5);
  if (!upcoming) return null;

  const distM = Math.round(upcoming.distanceMFromStart - currentDistM);
  return {
    turn: upcoming,
    distanceRemainingM: distM,
  };
}

export interface SlicedRouteGeoJSON {
  completedGeojson: Record<string, unknown> | null;
  remainingGeojson: Record<string, unknown> | null;
}

/**
 * Découpe dynamiquement une géométrie PostGIS (LineString/MultiLineString) en
 * deux portions GeoJSON au point exact de progression (0..1) :
 * 1. completedGeojson : la portion déjà parcourue (DÉPART -> 📍)
 * 2. remainingGeojson : la portion restant à parcourir (📍 -> ARRIVÉE)
 *
 * Utilise la géométrie réelle et les longueurs curvilignes haversine sans aucun saut.
 */
export function sliceRouteGeoJSON(
  geojson: unknown,
  progressFrac: number | null | undefined
): SlicedRouteGeoJSON {
  if (!geojson || typeof geojson !== 'object') {
    return { completedGeojson: null, remainingGeojson: null };
  }

  const frac = progressFrac != null && Number.isFinite(progressFrac) ? Math.max(0, Math.min(1, progressFrac)) : 0;

  const segments = flattenSegments(geojson);
  const total = totalLengthM(segments);
  if (segments.length === 0 || total <= 0) {
    return { completedGeojson: null, remainingGeojson: geojson as Record<string, unknown> };
  }

  const fullGeo = geojson as Record<string, unknown>;

  if (frac <= 0.0005) {
    return { completedGeojson: null, remainingGeojson: fullGeo };
  }

  if (frac >= 0.999) {
    return { completedGeojson: fullGeo, remainingGeojson: null };
  }

  const splitM = total * frac;
  const completedCoords: [number, number][] = [];
  const remainingCoords: [number, number][] = [];

  let splitLat = 0;
  let splitLng = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segStartM = seg.cumLenM;
    const segEndM = seg.cumLenM + seg.segLenM;

    if (i === 0) {
      completedCoords.push([seg.startLng, seg.startLat]);
    }

    if (splitM >= segEndM) {
      completedCoords.push([seg.endLng, seg.endLat]);
    } else if (splitM <= segStartM) {
      if (remainingCoords.length === 0) {
        remainingCoords.push([splitLng, splitLat]);
      }
      remainingCoords.push([seg.endLng, seg.endLat]);
    } else {
      const ratio = seg.segLenM > 0 ? (splitM - segStartM) / seg.segLenM : 0;
      splitLat = seg.startLat + (seg.endLat - seg.startLat) * ratio;
      splitLng = seg.startLng + (seg.endLng - seg.startLng) * ratio;

      completedCoords.push([splitLng, splitLat]);

      remainingCoords.push([splitLng, splitLat]);
      remainingCoords.push([seg.endLng, seg.endLat]);
    }
  }

  const completedGeojson = completedCoords.length >= 2
    ? { type: 'LineString', coordinates: completedCoords }
    : null;

  const remainingGeojson = remainingCoords.length >= 2
    ? { type: 'LineString', coordinates: remainingCoords }
    : (geojson as Record<string, unknown>);

  return { completedGeojson, remainingGeojson };
}