import type {
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  CollaborativeStage,
} from '../../types';

export function computeStageMetrics(
  stage: CollaborativeStage,
  orderedPts: readonly CollaborativeRoutePoint[],
  sections: readonly CollaborativeRouteSection[]
): { distanceKm: number; distanceKnown: boolean; ascentM: number | null; durationMin: number | null } {
  const startIdx = orderedPts.findIndex((p) => p.id === stage.startPointId);
  const endIdx = orderedPts.findIndex((p) => p.id === stage.endPointId);
  if (startIdx < 0 || endIdx <= startIdx) {
    return { distanceKm: 0, distanceKnown: false, ascentM: null, durationMin: null };
  }
  const pointIds = new Set(orderedPts.slice(startIdx, endIdx + 1).map((p) => p.id));
  let dist = 0;
  let hasDist = false;
  let asc = 0;
  let hasAsc = false;
  let dur = 0;
  let hasDur = false;
  for (const s of sections) {
    if (pointIds.has(s.fromPointId) && pointIds.has(s.toPointId)) {
      dist += s.distanceKm;
      hasDist = true;
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
    // Aucun tronçon ne relie les points de l'étape : la distance est inconnue, pas nulle (4.5).
    distanceKnown: hasDist,
    ascentM: hasAsc ? Math.round(asc) : null,
    durationMin: hasDur ? Math.round(dur) : null,
  };
}

/** « 12,4 km » ou « Inconnue » : la distance d'une étape sans tronçon n'est jamais écrite 0 km (4.5). */
export function formatStageKm(m: { distanceKm: number; distanceKnown: boolean }): string {
  return m.distanceKnown ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(m.distanceKm)} km` : 'Inconnue';
}
