import { haversineKm } from '@/features/adventure-prep/engine/routing';
import type {
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  CollaborativeStage,
} from '../types';

/** Ce dont les calculs ont besoin : points et tronçons (un état d'atelier ou une révision). */
export interface RouteGraph {
  readonly points: readonly CollaborativeRoutePoint[];
  readonly sections: readonly CollaborativeRouteSection[];
}

export interface OrderedLeg {
  readonly from: CollaborativeRoutePoint;
  readonly to: CollaborativeRoutePoint;
  /** `null` : aucun tronçon ne relie ces deux points (raccord manquant). */
  readonly section: CollaborativeRouteSection | null;
}

export function orderedActivePoints(graph: RouteGraph): CollaborativeRoutePoint[] {
  return graph.points
    .filter((p) => !p.deletedAt)
    .slice()
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : a.id.localeCompare(b.id)));
}

export function orderedLegs(graph: RouteGraph): OrderedLeg[] {
  const points = orderedActivePoints(graph);
  const byPair = new Map<string, CollaborativeRouteSection>();
  for (const s of graph.sections) byPair.set(`${s.fromPointId}>${s.toPointId}`, s);
  const legs: OrderedLeg[] = [];
  for (let i = 1; i < points.length; i += 1) {
    legs.push({
      from: points[i - 1],
      to: points[i],
      section: byPair.get(`${points[i - 1].id}>${points[i].id}`) ?? null,
    });
  }
  return legs;
}

/** Tronçons d'une étape : de son point de départ à son point d'arrivée, dans l'ordre des points. */
export function stageLegs(graph: RouteGraph, stage: CollaborativeStage): OrderedLeg[] {
  const legs = orderedLegs(graph);
  const start = legs.findIndex((l) => l.from.id === stage.startPointId);
  let end = -1;
  legs.forEach((l, i) => {
    if (l.to.id === stage.endPointId) end = i;
  });
  if (start < 0 || end < start) return [];
  return legs.slice(start, end + 1);
}

export interface LegsStats {
  readonly distanceKm: number;
  readonly ascentM: number | null;
  readonly descentM: number | null;
  readonly durationMin: number | null;
  readonly missingSections: number;
  readonly legCount: number;
}

export function legsStats(legs: readonly OrderedLeg[]): LegsStats {
  let distanceKm = 0;
  let ascent: number | null = legs.length > 0 ? 0 : null;
  let descent: number | null = legs.length > 0 ? 0 : null;
  let duration: number | null = legs.length > 0 ? 0 : null;
  let missing = 0;
  for (const leg of legs) {
    const s = leg.section;
    if (!s) {
      missing += 1;
      ascent = null;
      descent = null;
      duration = null;
      continue;
    }
    distanceKm += s.distanceKm;
    ascent = ascent === null || s.ascentM == null ? null : ascent + s.ascentM;
    descent = descent === null || s.descentM == null ? null : descent + s.descentM;
    duration = duration === null || s.durationMin == null ? null : duration + s.durationMin;
  }
  return {
    distanceKm: Math.round(distanceKm * 1000) / 1000,
    ascentM: ascent,
    descentM: descent,
    durationMin: duration,
    missingSections: missing,
    legCount: legs.length,
  };
}

export interface TrackVertex {
  readonly lat: number;
  readonly lon: number;
  /** Distance cumulée (km), recalée sur la distance annoncée de chaque tronçon. */
  readonly km: number;
  /** D+ cumulé sur les tronçons dont le D+ est connu. */
  readonly ascentM: number;
  /** Distance cumulée (km) parcourue sur des tronçons dont le D+ est inconnu. */
  readonly unknownAscentKm: number;
}

function polylineLengthKm(coords: readonly [number, number][]): number {
  let km = 0;
  for (let i = 1; i < coords.length; i += 1) {
    km += haversineKm({ lat: coords[i - 1][1], lon: coords[i - 1][0] }, { lat: coords[i][1], lon: coords[i][0] });
  }
  return km;
}

function sectionCoords(leg: OrderedLeg): [number, number][] {
  const g = leg.section?.geometry.coordinates;
  if (g && g.length >= 2) return g;
  return [
    [leg.from.lon, leg.from.lat],
    [leg.to.lon, leg.to.lat],
  ];
}

/** Sommets du tracé de plusieurs tronçons. Un tronçon manquant n'ajoute ni distance ni sommet. */
export function trackVertices(legs: readonly OrderedLeg[]): TrackVertex[] {
  const out: TrackVertex[] = [];
  let km = 0;
  let asc = 0;
  let unk = 0;
  for (const leg of legs) {
    const s = leg.section;
    if (!s) continue;
    const coords = sectionCoords(leg);
    const len = polylineLengthKm(coords);
    const scale = len > 0 ? s.distanceKm / len : 0;
    let acc = 0;
    for (let i = 0; i < coords.length; i += 1) {
      if (i > 0) {
        acc += haversineKm({ lat: coords[i - 1][1], lon: coords[i - 1][0] }, { lat: coords[i][1], lon: coords[i][0] });
      }
      const frac = len > 0 ? acc / len : 0;
      const vertex: TrackVertex = {
        lat: coords[i][1],
        lon: coords[i][0],
        km: km + acc * scale,
        ascentM: asc + (s.ascentM != null ? s.ascentM * frac : 0),
        unknownAscentKm: unk + (s.ascentM == null ? s.distanceKm * frac : 0),
      };
      const prev = out[out.length - 1];
      if (i === 0 && prev && haversineKm(prev, vertex) < 0.02) continue;
      out.push(vertex);
    }
    km += s.distanceKm;
    if (s.ascentM != null) asc += s.ascentM;
    else unk += s.distanceKm;
  }
  return out;
}

export function polylineOf(legs: readonly OrderedLeg[]): [number, number][] {
  return trackVertices(legs).map((v) => [v.lon, v.lat]);
}

export interface TrackProjection {
  readonly offsetKm: number;
  readonly alongKm: number;
  readonly vertexIndex: number;
}

/** Projette un point sur le tracé (approximation locale équirectangulaire, suffisante à l'échelle d'un tronçon). */
export function projectOnTrack(
  vertices: readonly { lat: number; lon: number; km: number }[],
  lat: number,
  lon: number,
): TrackProjection | null {
  if (vertices.length === 0) return null;
  if (vertices.length === 1) {
    return {
      offsetKm: haversineKm({ lat, lon }, vertices[0]),
      alongKm: vertices[0].km,
      vertexIndex: 0,
    };
  }
  let best: TrackProjection | null = null;
  for (let i = 0; i < vertices.length - 1; i += 1) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const cos = Math.cos((a.lat * Math.PI) / 180);
    const bx = (b.lon - a.lon) * cos * 111.32;
    const by = (b.lat - a.lat) * 110.574;
    const px = (lon - a.lon) * cos * 111.32;
    const py = (lat - a.lat) * 110.574;
    const len2 = bx * bx + by * by;
    const t = len2 > 0 ? Math.min(1, Math.max(0, (px * bx + py * by) / len2)) : 0;
    const dx = px - t * bx;
    const dy = py - t * by;
    const offsetKm = Math.sqrt(dx * dx + dy * dy);
    if (!best || offsetKm < best.offsetKm) {
      best = { offsetKm, alongKm: a.km + t * (b.km - a.km), vertexIndex: t < 0.5 ? i : i + 1 };
    }
  }
  return best;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const NNBSP = ' ';

/** Format fr-FR avec espace fine insécable pour les milliers (indépendant des données ICU). */
export function formatInt(n: number): string {
  const rounded = Math.round(Math.abs(n));
  const digits = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  return `${n < 0 && rounded !== 0 ? '−' : ''}${digits}`;
}

export function formatDecimalFr(n: number, decimals = 1): string {
  const fixed = Math.abs(n).toFixed(decimals);
  const [i, d] = fixed.split('.');
  const intPart = i.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  const body = d && Number(d) !== 0 ? `${intPart},${d}` : intPart;
  return `${n < 0 && Number(fixed) !== 0 ? '−' : ''}${body}`;
}
