import type { CollaborativeRouteSection, CollaborativeStage, SurfaceSegment } from '../types';
import { legsStats, orderedLegs, stageLegs, type OrderedLeg, type RouteGraph } from './shared';

export type SurfaceClass = 'goudron' | 'piste' | 'sentier' | 'inconnu';

export interface SurfaceBreakdown {
  readonly totalKm: number;
  readonly km: Readonly<Record<SurfaceClass, number>>;
  /** Part de la longueur, 0 à 100 (1 décimale) ; `null` si la longueur est nulle. */
  readonly pct: Readonly<Record<SurfaceClass, number>> | null;
  readonly method: string;
}

export interface StageSurfaceBreakdown extends SurfaceBreakdown {
  readonly stageId: string;
  readonly dayNumber: number;
}

export const SURFACE_METHOD =
  'Part de la longueur de chaque tronçon couverte par les segments de surface renseignés ; le reste est « inconnu »';

const CLASS_OF: Record<SurfaceSegment['surface'], SurfaceClass> = {
  paved: 'goudron',
  unpaved: 'piste',
  trail: 'sentier',
  rock: 'sentier',
  unknown: 'inconnu',
};

function sectionKm(section: CollaborativeRouteSection): Record<SurfaceClass, number> {
  const out: Record<SurfaceClass, number> = { goudron: 0, piste: 0, sentier: 0, inconnu: 0 };
  const segs = section.surfaceSegments
    .map((s) => ({ ...s, fromRatio: Math.max(0, s.fromRatio), toRatio: Math.min(1, s.toRatio) }))
    .filter((s) => Number.isFinite(s.fromRatio) && Number.isFinite(s.toRatio) && s.toRatio > s.fromRatio)
    .sort((a, b) => a.fromRatio - b.fromRatio);
  let cursor = 0;
  for (const s of segs) {
    const from = Math.max(cursor, s.fromRatio);
    if (s.toRatio <= from) continue;
    out[CLASS_OF[s.surface]] += (s.toRatio - from) * section.distanceKm;
    cursor = s.toRatio;
  }
  out.inconnu += Math.max(0, 1 - cursor) * section.distanceKm;
  return out;
}

function breakdownOf(legs: readonly OrderedLeg[]): SurfaceBreakdown {
  const km: Record<SurfaceClass, number> = { goudron: 0, piste: 0, sentier: 0, inconnu: 0 };
  for (const leg of legs) {
    if (!leg.section) continue;
    const k = sectionKm(leg.section);
    (Object.keys(km) as SurfaceClass[]).forEach((c) => {
      km[c] += k[c];
    });
  }
  const total = legsStats(legs).distanceKm;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const rounded = { goudron: r(km.goudron), piste: r(km.piste), sentier: r(km.sentier), inconnu: r(km.inconnu) };
  const pct =
    total > 0
      ? {
          goudron: Math.round((km.goudron / total) * 1000) / 10,
          piste: Math.round((km.piste / total) * 1000) / 10,
          sentier: Math.round((km.sentier / total) * 1000) / 10,
          inconnu: Math.round((km.inconnu / total) * 1000) / 10,
        }
      : null;
  return { totalKm: total, km: rounded, pct, method: SURFACE_METHOD };
}

export function surfaceBreakdownForStage(graph: RouteGraph, stage: CollaborativeStage): StageSurfaceBreakdown {
  return { stageId: stage.id, dayNumber: stage.dayNumber, ...breakdownOf(stageLegs(graph, stage)) };
}

export function surfaceBreakdown(graph: RouteGraph & { readonly stages: readonly CollaborativeStage[] }): {
  readonly overall: SurfaceBreakdown;
  readonly perStage: readonly StageSurfaceBreakdown[];
} {
  return {
    overall: breakdownOf(orderedLegs(graph)),
    perStage: graph.stages
      .slice()
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((s) => surfaceBreakdownForStage(graph, s)),
  };
}
