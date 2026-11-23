/**
 * Coupures de journée sur le profil (6.2) : fonctions pures. Chaque coupure est un kilométrage le long du tracé ;
 * déplacer une coupure change la fin d'une journée et le début de la suivante, et seulement elles. L'aperçu
 * donne tout de suite l'effet sur les deux journées (distance, D+, durée) sans toucher à l'atelier ; le geste
 * validé est l'opération `cut_stage_at` du moteur (point créé au besoin, jamais hors du tracé).
 */
import { naismithDuration, type NaismithParams } from './insights/pace';
import { orderedLegs, projectOnTrack, trackVertices, type TrackVertex } from './insights/shared';
import { activePoints } from './engine';
import { coordinateAtKm, stageKind } from './engineTrack';
import type { RouteOperationInput, RouteWorkspaceState } from './types';

export const MIN_DAY_KM = 0.3;

export interface Cut {
  /** Journée qui se termine à cette coupure. */
  readonly stageId: string;
  readonly dayNumber: number;
  readonly km: number;
  /** Bornes du déplacement : entre la coupure d'avant et celle d'après. */
  readonly minKm: number;
  readonly maxKm: number;
  readonly movable: boolean;
  /** Pourquoi la coupure ne se déplace pas (repos, étape courte). */
  readonly lockedReason: string | null;
}

export interface ProfileData {
  readonly totalKm: number;
  readonly hasElevation: boolean;
  readonly vertices: readonly TrackVertex[];
  /** Altitude par sommet (même indice), `null` quand inconnue. */
  readonly elevations: readonly (number | null)[];
  readonly cuts: readonly Cut[];
}

/** Altitude le long du tracé : points d'altitude connus des tronçons, répartis sur leurs sommets. */
function elevationsAlong(ws: Pick<RouteWorkspaceState, 'points' | 'sections'>): (number | null)[] {
  const legs = orderedLegs(ws);
  const out: (number | null)[] = [];
  for (const leg of legs) {
    const sec = leg.section;
    if (!sec) continue;
    const n = sec.geometry.coordinates.length;
    const samples = sec.elevationSamples;
    const skip = out.length > 0 ? 1 : 0; // le premier sommet est partagé avec le tronçon précédent (cf. trackVertices)
    for (let i = skip; i < n; i += 1) {
      if (samples && samples.length >= 2) out.push(samples[Math.min(samples.length - 1, Math.round((i / Math.max(1, n - 1)) * (samples.length - 1)))] ?? null);
      else if (i === 0) out.push(leg.from.eleM ?? null);
      else if (i === n - 1) out.push(leg.to.eleM ?? null);
      else out.push(null);
    }
  }
  return out;
}

export function profileData(ws: Pick<RouteWorkspaceState, 'points' | 'sections' | 'stages'>): ProfileData {
  const legs = orderedLegs(ws);
  const vertices = trackVertices(legs);
  const total = vertices.length > 0 ? vertices[vertices.length - 1].km : 0;
  let elevations = elevationsAlong(ws);
  if (elevations.length !== vertices.length) elevations = vertices.map(() => null);
  const days = ws.stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  const pts = activePoints(ws as RouteWorkspaceState);
  const byId = new Map(pts.map((p) => [p.id, p]));
  const cuts: Cut[] = [];
  for (let i = 0; i < days.length - 1; i += 1) {
    const stage = days[i];
    const next = days[i + 1];
    const end = byId.get(stage.endPointId);
    const proj = end ? projectOnTrack(vertices, end.lat, end.lon) : null;
    if (!proj) continue;
    const locked = stageKind(stage) !== 'walk' || stageKind(next) !== 'walk';
    const prevCut = cuts[cuts.length - 1];
    const startOfStage = byId.get(stage.startPointId);
    const startKm = startOfStage ? (projectOnTrack(vertices, startOfStage.lat, startOfStage.lon)?.alongKm ?? 0) : 0;
    const endOfNext = byId.get(next.endPointId);
    const endNextKm = endOfNext ? (projectOnTrack(vertices, endOfNext.lat, endOfNext.lon)?.alongKm ?? total) : total;
    cuts.push({
      stageId: stage.id,
      dayNumber: stage.dayNumber,
      km: Math.round(proj.alongKm * 100) / 100,
      minKm: Math.round(((prevCut && !prevCut.lockedReason ? Math.max(prevCut.km, startKm) : startKm) + MIN_DAY_KM) * 100) / 100,
      maxKm: Math.round((endNextKm - MIN_DAY_KM) * 100) / 100,
      movable: !locked,
      lockedReason: locked ? 'La coupure d’un jour de repos ou d’une étape courte ne se déplace pas.' : null,
    });
  }
  return {
    totalKm: total,
    hasElevation: elevations.some((e) => e != null),
    vertices,
    elevations,
    cuts,
  };
}

export interface RangeStats {
  readonly distanceKm: number;
  readonly ascentM: number | null;
  readonly durationMin: number | null;
  readonly lowerBound: boolean;
}

function interpolate(vertices: readonly TrackVertex[], km: number): { ascentM: number; unknownKm: number } {
  if (vertices.length === 0) return { ascentM: 0, unknownKm: 0 };
  if (km <= vertices[0].km) return { ascentM: vertices[0].ascentM, unknownKm: vertices[0].unknownAscentKm };
  const last = vertices[vertices.length - 1];
  if (km >= last.km) return { ascentM: last.ascentM, unknownKm: last.unknownAscentKm };
  for (let i = 1; i < vertices.length; i += 1) {
    const b = vertices[i];
    if (b.km >= km) {
      const a = vertices[i - 1];
      const t = b.km > a.km ? (km - a.km) / (b.km - a.km) : 0;
      return { ascentM: a.ascentM + t * (b.ascentM - a.ascentM), unknownKm: a.unknownAscentKm + t * (b.unknownAscentKm - a.unknownAscentKm) };
    }
  }
  return { ascentM: last.ascentM, unknownKm: last.unknownAscentKm };
}

export function rangeStats(
  vertices: readonly TrackVertex[],
  fromKm: number,
  toKm: number,
  pace: NaismithParams,
  routerMinPerKm: number | null,
): RangeStats {
  const distanceKm = Math.max(0, toKm - fromKm);
  const a = interpolate(vertices, fromKm);
  const b = interpolate(vertices, toKm);
  const ascentKnown = b.unknownKm - a.unknownKm < 1e-6;
  const ascentM = ascentKnown ? Math.max(0, b.ascentM - a.ascentM) : null;
  if (routerMinPerKm != null) {
    return { distanceKm, ascentM, durationMin: Math.round(distanceKm * routerMinPerKm), lowerBound: false };
  }
  const est = naismithDuration(distanceKm, ascentM, pace);
  return { distanceKm, ascentM: ascentM == null ? null : Math.round(ascentM), durationMin: est.minutes, lowerBound: est.isLowerBound };
}

export interface CutPreview {
  readonly km: number;
  readonly lat: number;
  readonly lon: number;
  readonly before: RangeStats;
  readonly after: RangeStats;
}

/** Aperçu immédiat : les deux journées voisines si la coupure `stageId` était à `km`. */
export function previewCut(
  ws: Pick<RouteWorkspaceState, 'points' | 'sections' | 'stages' | 'sport'>,
  stageId: string,
  km: number,
  pace: NaismithParams,
  /** Profil déjà calculé : évite de relire tout le tracé à chaque mouvement du doigt. */
  data: ProfileData = profileData(ws),
): CutPreview | null {
  const cut = data.cuts.find((c) => c.stageId === stageId);
  if (!cut || !cut.movable) return null;
  const clamped = Math.min(cut.maxKm, Math.max(cut.minKm, km));
  const days = ws.stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  const k = days.findIndex((s) => s.id === stageId);
  const pts = activePoints(ws as RouteWorkspaceState);
  const byId = new Map(pts.map((p) => [p.id, p]));
  const startKm = (() => {
    const p = byId.get(days[k].startPointId);
    return p ? (projectOnTrack(data.vertices, p.lat, p.lon)?.alongKm ?? 0) : 0;
  })();
  const endKm = (() => {
    const p = byId.get(days[k + 1].endPointId);
    return p ? (projectOnTrack(data.vertices, p.lat, p.lon)?.alongKm ?? data.totalKm) : data.totalKm;
  })();
  const totalMin = ws.sections.every((s) => s.durationMin != null) && data.totalKm > 0 ? ws.sections.reduce((a, s) => a + (s.durationMin ?? 0), 0) : null;
  const routerMinPerKm = ws.sport !== 'marche' && totalMin != null ? totalMin / data.totalKm : null;
  const where = coordinateAtKm(ws.sections, clamped);
  if (!where) return null;
  return {
    km: Math.round(clamped * 100) / 100,
    lat: where.lat,
    lon: where.lon,
    before: rangeStats(data.vertices, startKm, clamped, pace, routerMinPerKm),
    after: rangeStats(data.vertices, clamped, endKm, pace, routerMinPerKm),
  };
}

/** L'opération qui valide le déplacement (la coordonnée est celle du tracé à ce kilométrage). */
export function cutOperation(
  ws: Pick<RouteWorkspaceState, 'points' | 'sections' | 'stages' | 'sport'>,
  stageId: string,
  km: number,
  pointId: string,
  pace: NaismithParams,
): Extract<RouteOperationInput, { type: 'cut_stage_at' }> | null {
  const preview = previewCut(ws, stageId, km, pace);
  if (!preview) return null;
  return { type: 'cut_stage_at', stageId, pointId, lat: preview.lat, lon: preview.lon, name: null };
}
