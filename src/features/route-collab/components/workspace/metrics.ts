import type {
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  CollaborativeStage,
} from '../../types';

export function computeStageMetrics(
  stage: CollaborativeStage,
  orderedPts: readonly CollaborativeRoutePoint[],
  sections: readonly CollaborativeRouteSection[]
): { distanceKm: number; ascentM: number | null; durationMin: number | null } {
  const startIdx = orderedPts.findIndex((p) => p.id === stage.startPointId);
  const endIdx = orderedPts.findIndex((p) => p.id === stage.endPointId);
  if (startIdx < 0 || endIdx <= startIdx) {
    return { distanceKm: 0, ascentM: null, durationMin: null };
  }
  const pointIds = new Set(orderedPts.slice(startIdx, endIdx + 1).map((p) => p.id));
  let dist = 0;
  let asc = 0;
  let hasAsc = false;
  let dur = 0;
  let hasDur = false;
  for (const s of sections) {
    if (pointIds.has(s.fromPointId) && pointIds.has(s.toPointId)) {
      dist += s.distanceKm;
      if (s.ascentM != null) {
        asc += s.ascentM;
        hasAsc = true;
      }
      if (s.durationMin != null) {
        dur += s.durationMin;
        hasDur = true;
      }
    }
  }
  return {
    distanceKm: Number(dist.toFixed(2)),
    ascentM: hasAsc ? Math.round(asc) : null,
    durationMin: hasDur ? Math.round(dur) : null,
  };
}
