/**
 * Géométrie et étapes du moteur collaboratif : fonctions pures, sans dépendance au moteur d'opérations
 * (`engine.ts` les appelle, jamais l'inverse). Rien ici ne lit le réseau ni l'horloge.
 *
 * Règle commune : un tronçon coupé, fusionné ou retourné garde sa géométrie réelle ; une valeur qui doit
 * être répartie (D+, durée) l'est au prorata de la distance et passe en « estimé », jamais en « vérifié ».
 */
import { haversineKm } from '@/features/adventure-prep/engine/routing';
import type {
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  CollaborativeStage,
  SurfaceSegment,
} from './types';

export type Pos = [number, number];

/** En deçà, un lieu de coupure est confondu avec le point existant le plus proche (km). */
export const SNAP_POINT_KM = 0.03;

export function lineKm(coords: readonly Pos[]): number {
  let km = 0;
  for (let i = 1; i < coords.length; i += 1) {
    km += haversineKm(
      { lat: coords[i - 1][1], lon: coords[i - 1][0] },
      { lat: coords[i][1], lon: coords[i][0] },
    );
  }
  return km;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export type Fingerprint = (from: CollaborativeRoutePoint, to: CollaborativeRoutePoint) => string;

/* ---------- Position sur le tracé ---------- */

export interface TrackLocation {
  /** Index du tronçon dans la liste fournie. */
  readonly sectionIndex: number;
  /** Index du segment de la géométrie du tronçon (entre `coords[segIndex]` et `coords[segIndex + 1]`). */
  readonly segIndex: number;
  /** Position dans le segment, 0 à 1. */
  readonly t: number;
  readonly offsetKm: number;
  readonly point: Pos;
  /** Distance depuis le début du tronçon, le long de sa géométrie (km). */
  readonly alongSectionKm: number;
}

/** Projette (lat, lon) sur l'ensemble des tronçons ; approximation locale, suffisante à l'échelle d'un segment. */
export function locateOnSections(
  sections: readonly CollaborativeRouteSection[],
  lat: number,
  lon: number,
): TrackLocation | null {
  let best: TrackLocation | null = null;
  sections.forEach((sec, sectionIndex) => {
    const c = sec.geometry.coordinates as readonly Pos[];
    let along = 0;
    for (let i = 0; i < c.length - 1; i += 1) {
      const a = c[i];
      const b = c[i + 1];
      const segLen = haversineKm({ lat: a[1], lon: a[0] }, { lat: b[1], lon: b[0] });
      const cos = Math.cos((a[1] * Math.PI) / 180);
      const bx = (b[0] - a[0]) * cos * 111.32;
      const by = (b[1] - a[1]) * 110.574;
      const px = (lon - a[0]) * cos * 111.32;
      const py = (lat - a[1]) * 110.574;
      const len2 = bx * bx + by * by;
      const t = len2 > 0 ? Math.min(1, Math.max(0, (px * bx + py * by) / len2)) : 0;
      const dx = px - t * bx;
      const dy = py - t * by;
      const offsetKm = Math.sqrt(dx * dx + dy * dy);
      if (!best || offsetKm < best.offsetKm) {
        best = {
          sectionIndex,
          segIndex: i,
          t,
          offsetKm,
          point: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
          alongSectionKm: along + t * segLen,
        };
      }
      along += segLen;
    }
  });
  return best;
}

/** Coordonnée du tracé à `km` du départ (distance cumulée annoncée des tronçons). */
export function coordinateAtKm(
  sections: readonly CollaborativeRouteSection[],
  km: number,
): { lat: number; lon: number } | null {
  let cursor = 0;
  for (const sec of sections) {
    const c = sec.geometry.coordinates as readonly Pos[];
    if (c.length < 2) continue;
    const geomKm = lineKm(c);
    const secKm = sec.distanceKm > 0 ? sec.distanceKm : geomKm;
    if (km <= cursor + secKm || sec === sections[sections.length - 1]) {
      const local = Math.min(1, Math.max(0, secKm > 0 ? (km - cursor) / secKm : 0)) * geomKm;
      let acc = 0;
      for (let i = 0; i < c.length - 1; i += 1) {
        const seg = haversineKm({ lat: c[i][1], lon: c[i][0] }, { lat: c[i + 1][1], lon: c[i + 1][0] });
        if (acc + seg >= local || i === c.length - 2) {
          const t = seg > 0 ? Math.min(1, Math.max(0, (local - acc) / seg)) : 0;
          return { lat: c[i][1] + t * (c[i + 1][1] - c[i][1]), lon: c[i][0] + t * (c[i + 1][0] - c[i][0]) };
        }
        acc += seg;
      }
    }
    cursor += secKm;
  }
  return null;
}

/* ---------- Couper / fusionner ---------- */

function sliceSurface(segs: readonly SurfaceSegment[], from: number, to: number): SurfaceSegment[] {
  const span = to - from;
  if (span <= 0) return [];
  const out: SurfaceSegment[] = [];
  for (const s of segs) {
    const a = Math.max(from, s.fromRatio);
    const b = Math.min(to, s.toRatio);
    if (b > a) out.push({ ...s, fromRatio: (a - from) / span, toRatio: (b - from) / span });
  }
  return out;
}

function shiftSurface(segs: readonly SurfaceSegment[], offset: number, scale: number): SurfaceSegment[] {
  return segs.map((s) => ({ ...s, fromRatio: offset + s.fromRatio * scale, toRatio: offset + s.toRatio * scale }));
}

function estimated(sec: CollaborativeRouteSection): CollaborativeRouteSection['provenance'] {
  const prorated = sec.ascentM != null || sec.durationMin != null;
  return prorated && sec.provenance.confidence === 'verified'
    ? { ...sec.provenance, confidence: 'estimated' }
    : sec.provenance;
}

export type SplitResult =
  | { readonly ok: true; readonly left: CollaborativeRouteSection; readonly right: CollaborativeRouteSection }
  | { readonly ok: false; readonly reason: string };

/**
 * Coupe `sec` au point `via` (déjà placé sur sa géométrie par `locateOnSections`). Les deux moitiés
 * gardent le mode, les sommets et la provenance du tronçon d'origine.
 */
export function splitSectionAt(
  sec: CollaborativeRouteSection,
  loc: Pick<TrackLocation, 'segIndex' | 't' | 'point'>,
  from: CollaborativeRoutePoint,
  via: CollaborativeRoutePoint,
  to: CollaborativeRoutePoint,
  fingerprint: Fingerprint,
): SplitResult {
  const c = sec.geometry.coordinates as readonly Pos[];
  if (c.length < 2) return { ok: false, reason: 'Tronçon sans géométrie.' };
  const point: Pos = [via.lon, via.lat];
  const left: Pos[] = c.slice(0, loc.segIndex + 1).map((p) => [p[0], p[1]] as Pos);
  const right: Pos[] = c.slice(loc.segIndex + 1).map((p) => [p[0], p[1]] as Pos);
  const lastL = left[left.length - 1];
  if (!lastL || haversineKm({ lat: lastL[1], lon: lastL[0] }, { lat: point[1], lon: point[0] }) > 1e-6) left.push(point);
  const firstR = right[0];
  if (!firstR || haversineKm({ lat: firstR[1], lon: firstR[0] }, { lat: point[1], lon: point[0] }) > 1e-6) right.unshift(point);
  if (left.length < 2 || right.length < 2) return { ok: false, reason: 'Coupure trop proche d’une extrémité du tronçon.' };
  const lKm = lineKm(left);
  const rKm = lineKm(right);
  if (lKm < 0.005 || rKm < 0.005) return { ok: false, reason: 'Coupure trop proche d’une extrémité du tronçon.' };
  const share = lKm / (lKm + rKm);
  const n = sec.elevationSamples?.length ?? 0;
  const cutIdx = n >= 2 ? Math.round(share * (n - 1)) : 0;
  const part = (v: number | null, s: number, isLeft: boolean) =>
    v == null ? null : isLeft ? Math.round(v * s) : Math.round(v - Math.round(v * s));
  const prov = estimated(sec);
  const routed = sec.mode === 'routed';
  const mk = (isLeft: boolean): CollaborativeRouteSection => {
    const a = isLeft ? from : via;
    const b = isLeft ? via : to;
    const dist = isLeft ? round3(sec.distanceKm * share) : round3(sec.distanceKm - round3(sec.distanceKm * share));
    return {
      ...sec,
      id: `sec-${a.id}-${b.id}`,
      fromPointId: a.id,
      toPointId: b.id,
      geometry: { type: 'LineString', coordinates: isLeft ? left : right },
      distanceKm: dist,
      durationMin: part(sec.durationMin, share, isLeft),
      ascentM: part(sec.ascentM, share, isLeft),
      descentM: part(sec.descentM, share, isLeft),
      elevationSamples:
        n >= 2 ? (isLeft ? sec.elevationSamples!.slice(0, cutIdx + 1) : sec.elevationSamples!.slice(cutIdx)) : sec.elevationSamples,
      surfaceSegments: isLeft ? sliceSurface(sec.surfaceSegments, 0, share) : sliceSurface(sec.surfaceSegments, share, 1),
      routingInputHash: routed ? fingerprint(a, b) : sec.routingInputHash,
      pendingFingerprint: null,
      provenance: prov,
      warnings: sec.warnings.slice(),
      entityVersion: sec.entityVersion + 1,
    };
  };
  return { ok: true, left: mk(true), right: mk(false) };
}

export type MergeResult =
  | { readonly ok: true; readonly section: CollaborativeRouteSection }
  | { readonly ok: false; readonly reason: string };

/** Fusionne deux tronçons consécutifs (`a.to === b.from`) : la géométrie des deux est conservée telle quelle. */
export function mergeSectionPair(
  a: CollaborativeRouteSection,
  b: CollaborativeRouteSection,
  from: CollaborativeRoutePoint,
  to: CollaborativeRoutePoint,
  fingerprint: Fingerprint,
): MergeResult {
  if (a.toPointId !== b.fromPointId) return { ok: false, reason: 'Les deux tronçons ne se suivent pas.' };
  const ca = a.geometry.coordinates as readonly Pos[];
  const cb = b.geometry.coordinates as readonly Pos[];
  const coords: Pos[] = [...ca.map((p) => [p[0], p[1]] as Pos), ...cb.slice(1).map((p) => [p[0], p[1]] as Pos)];
  const mode: CollaborativeRouteSection['mode'] = a.mode === b.mode ? a.mode : 'manual';
  const total = a.distanceKm + b.distanceKm;
  const sa = total > 0 ? a.distanceKm / total : 0.5;
  const both = <T,>(x: number | null, y: number | null, f: (p: number, q: number) => T): T | null =>
    x == null || y == null ? null : f(x, y);
  const samples =
    a.elevationSamples && b.elevationSamples && a.elevationSamples.length >= 2 && b.elevationSamples.length >= 2
      ? [...a.elevationSamples, ...b.elevationSamples.slice(1)]
      : undefined;
  const sameProvenance =
    a.provenance.provider === b.provenance.provider && a.provenance.profile === b.provenance.profile;
  return {
    ok: true,
    section: {
      ...a,
      id: `sec-${from.id}-${to.id}`,
      fromPointId: from.id,
      toPointId: to.id,
      mode,
      geometry: { type: 'LineString', coordinates: coords },
      distanceKm: round3(total),
      durationMin: both(a.durationMin, b.durationMin, (p, q) => p + q),
      ascentM: both(a.ascentM, b.ascentM, (p, q) => p + q),
      descentM: both(a.descentM, b.descentM, (p, q) => p + q),
      elevationSamples: samples,
      surfaceSegments: [...shiftSurface(a.surfaceSegments, 0, sa), ...shiftSurface(b.surfaceSegments, sa, 1 - sa)],
      routingInputHash: mode === 'routed' ? fingerprint(from, to) : null,
      pendingFingerprint: null,
      provenance: sameProvenance
        ? a.provenance
        : { ...a.provenance, provider: a.provenance.provider ?? b.provenance.provider, confidence: 'estimated' },
      warnings: Array.from(new Set([...a.warnings, ...b.warnings])),
      entityVersion: Math.max(a.entityVersion, b.entityVersion) + 1,
    },
  };
}

/** Le même tracé parcouru dans l'autre sens : géométrie retournée, D+ et D− échangés. */
export function reverseSectionData(
  sec: CollaborativeRouteSection,
  from: CollaborativeRoutePoint,
  to: CollaborativeRoutePoint,
  fingerprint: Fingerprint,
  opts: { keepCalculated: boolean },
): CollaborativeRouteSection {
  const routed = sec.mode === 'routed';
  return {
    ...sec,
    id: `sec-${from.id}-${to.id}`,
    fromPointId: from.id,
    toPointId: to.id,
    geometry: { type: 'LineString', coordinates: (sec.geometry.coordinates as readonly Pos[]).map((p) => [p[0], p[1]] as Pos).reverse() },
    ascentM: sec.descentM,
    descentM: sec.ascentM,
    elevationSamples: sec.elevationSamples ? sec.elevationSamples.slice().reverse() : sec.elevationSamples,
    surfaceSegments: sec.surfaceSegments
      .map((s) => ({ ...s, fromRatio: 1 - s.toRatio, toRatio: 1 - s.fromRatio }))
      .reverse(),
    routingInputHash: routed ? fingerprint(from, to) : sec.routingInputHash,
    pendingFingerprint: null,
    // Un tronçon routé retourné attend un nouveau calcul (sens uniques, montées, descentes) :
    // sa géométrie retournée reste visible, mais n'est plus présentée comme calculée.
    provenance:
      routed && !opts.keepCalculated
        ? { ...sec.provenance, calculatedAt: null, confidence: 'estimated' }
        : sec.provenance,
    warnings:
      routed && !opts.keepCalculated ? ['Sens inversé : tronçon à recalculer'] : sec.warnings.slice(),
    entityVersion: sec.entityVersion + 1,
  };
}

/* ---------- Étapes ---------- */

/** Un tronçon routé dont le calcul n'a pas (ou plus) de résultat : à recalculer. */
export function sectionNeedsRouting(sec: Pick<CollaborativeRouteSection, 'mode' | 'provenance'>): boolean {
  return sec.mode === 'routed' && sec.provenance.calculatedAt == null;
}

export function shiftIsoDate(dateIso: string, days: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function isDefaultDayTitle(title: string): boolean {
  return /^Jour \d+$/.test(title.trim());
}

export function stageKind(stage: Pick<CollaborativeStage, 'kind'>): 'walk' | 'rest' | 'short' {
  return stage.kind ?? 'walk';
}

/** Renumérote les jours dans l'ordre, retire les étapes dont les points ne se suivent plus. */
export function normalizeStages(
  stages: readonly CollaborativeStage[],
  ordered: readonly CollaborativeRoutePoint[],
): CollaborativeStage[] {
  const index = new Map(ordered.map((p, i) => [p.id, i]));
  const kept = stages.filter((s) => {
    const a = index.get(s.startPointId);
    const b = index.get(s.endPointId);
    if (a == null || b == null) return false;
    return stageKind(s) === 'rest' ? b === a : b > a || (stageKind(s) === 'short' && b >= a);
  });
  return kept.map((s, i) => {
    const dayNumber = i + 1;
    const titleOk = !isDefaultDayTitle(s.title) || s.title.trim() === `Jour ${dayNumber}`;
    if (s.dayNumber === dayNumber && titleOk) return s;
    return {
      ...s,
      dayNumber,
      orderKey: String(dayNumber).padStart(3, '0'),
      title: isDefaultDayTitle(s.title) ? `Jour ${dayNumber}` : s.title,
      entityVersion: s.dayNumber === dayNumber ? s.entityVersion : s.entityVersion + 1,
    };
  });
}

/** Les étapes dont le début ou la fin tombait sur un point retiré se recalent sur le point voisin qui reste. */
export function repairStagesForRemovedPoints(
  stages: readonly CollaborativeStage[],
  before: readonly CollaborativeRoutePoint[],
  removed: ReadonlySet<string>,
): CollaborativeStage[] {
  const idx = new Map(before.map((p, i) => [p.id, i]));
  const surviving = (from: number, step: 1 | -1): string | null => {
    for (let i = from; i >= 0 && i < before.length; i += step) if (!removed.has(before[i].id)) return before[i].id;
    return null;
  };
  return stages.map((s) => {
    let { startPointId, endPointId } = s;
    let changed = false;
    if (removed.has(startPointId)) {
      const i = idx.get(startPointId) ?? 0;
      startPointId = surviving(i, -1) ?? surviving(i, 1) ?? startPointId;
      changed = true;
    }
    if (removed.has(endPointId)) {
      const i = idx.get(endPointId) ?? 0;
      endPointId = surviving(i, -1) ?? surviving(i, 1) ?? endPointId;
      changed = true;
    }
    return changed ? { ...s, startPointId, endPointId, entityVersion: s.entityVersion + 1 } : s;
  });
}

/** Distance à vol d'oiseau entre une nuit enregistrée et un point (km). */
export function distanceToKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  return haversineKm(a, b);
}

export { round2 };
