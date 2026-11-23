/**
 * Cadrage de la carte (2.8) : la carte recadre selon la hauteur réelle du tiroir pour ne jamais cacher le jour
 * ouvert. Pur : on lui donne les hauteurs mesurées, il rend marges et emprise.
 */
import { sectionDayMap, type LonLat } from './mapGeometry';
import { activePointsOf } from './pointOrder';
import type { RouteWorkspaceState } from './types';

export interface FramePadding {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

const BASE_MARGIN = 48;
/** Dégagement en haut : pilule et îlot. */
const TOP_CLEARANCE = 96;
/** Une carte qui ne montre plus rien d'utile n'aide personne : le tiroir ne mange jamais plus de 75 % de la hauteur. */
const MAX_SHEET_SHARE = 0.75;

export function framePadding(containerHeightPx: number, sheetHeightPx: number): FramePadding {
  const h = Number.isFinite(containerHeightPx) && containerHeightPx > 0 ? containerHeightPx : 0;
  const sheet = Number.isFinite(sheetHeightPx) && sheetHeightPx > 0 ? sheetHeightPx : 0;
  const wanted = Math.round(Math.min(sheet, h * MAX_SHEET_SHARE)) + BASE_MARGIN / 2;
  // Sur un écran très bas, haut + bas ne dépassent jamais 90 % de la carte (MapLibre refuse un cadre vide).
  const bottom = h > 0 ? Math.max(BASE_MARGIN / 2, Math.min(wanted, Math.round(h * 0.9) - TOP_CLEARANCE)) : wanted;
  return { top: TOP_CLEARANCE, bottom, left: BASE_MARGIN, right: BASE_MARGIN };
}

/** Décalage (px) du centre pour qu'un point soit au milieu de la partie visible, au-dessus du tiroir. */
export function focusOffsetPx(sheetHeightPx: number, containerHeightPx: number): [number, number] {
  const sheet = Math.min(Math.max(0, sheetHeightPx || 0), Math.max(0, containerHeightPx || 0) * MAX_SHEET_SHARE);
  return [0, Math.round(-sheet / 2) || 0];
}

export interface Bounds {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;
}

export function boundsOf(coords: ReadonlyArray<LonLat>): Bounds | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return Number.isFinite(minLon) ? { minLon, minLat, maxLon, maxLat } : null;
}

/** Coordonnées d'une journée : ses tronçons, à défaut ses deux bornes. Jour absent → `null`. */
export function stageCoords(ws: Pick<RouteWorkspaceState, 'points' | 'sections' | 'stages'>, stageId: string): Array<[number, number]> | null {
  const stage = ws.stages.find((s) => s.id === stageId);
  if (!stage) return null;
  const ordered = activePointsOf(ws);
  const days = sectionDayMap(ordered, ws.sections, ws.stages);
  const out: Array<[number, number]> = [];
  for (const s of ws.sections) {
    if (days.get(s.id) !== stage.dayNumber) continue;
    for (const c of s.geometry.coordinates) out.push([c[0], c[1]]);
  }
  if (out.length >= 2) return out;
  const a = ordered.find((p) => p.id === stage.startPointId);
  const b = ordered.find((p) => p.id === stage.endPointId);
  return a && b ? [[a.lon, a.lat], [b.lon, b.lat]] : null;
}

/**
 * Ce que la carte doit cadrer : le jour ouvert s'il y en a un (et si l'itinéraire a plusieurs jours), sinon
 * tout l'itinéraire. Le jour ouvert est celui du tiroir « Jour » ou de la fiche de jour.
 */
export function framingTarget(
  ws: Pick<RouteWorkspaceState, 'points' | 'sections' | 'stages'>,
  openStageId: string | null,
): { readonly kind: 'day' | 'all'; readonly coords: Array<[number, number]> } {
  if (openStageId && ws.stages.length > 1) {
    const day = stageCoords(ws, openStageId);
    if (day && day.length >= 2) return { kind: 'day', coords: day };
  }
  const all: Array<[number, number]> = [];
  for (const p of activePointsOf(ws)) all.push([p.lon, p.lat]);
  for (const s of ws.sections) for (const c of s.geometry.coordinates) all.push([c[0], c[1]]);
  return { kind: 'all', coords: all };
}
