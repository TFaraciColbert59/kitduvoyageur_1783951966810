/**
 * Communauté v2 — édition pure du tracé et des jours (FID-068).
 *
 * Les gestes de la maquette (`maquette-communaute.html` L2990-3052) sont des
 * transformations de liste, sans DOM ni réseau :
 *   - **déplacer un point** (poignée `tp-handle`) : `pts[i] = q` ;
 *   - **supprimer un segment** (bouton « Supprimer le segment N ») :
 *     `pts.splice(sel + 1, 1)` — le segment N relie les points N et N+1 ;
 *   - **glisser entre jours** (`sortable` des moments) : extraction puis
 *     insertion dans le jour cible.
 *
 * Pourquoi ici : ces gestes appartiennent au formulaire Carnet/Sortie
 * (`create/**`, hors périmètre de cette vague). Le module est pur et testé
 * pour que `TracePaneV2`/`DaysPaneV2` les consomment sans réimplémenter la
 * logique, et pour que l'undo/redo reste une pile unique (une entrée par geste
 * validé, jamais par image de pointeur).
 */

/** Point `[lng, lat]` (ordre GeoJSON, comme `TracePaneV2` et `create_carnet_v2`). */
export type TracePoint = [number, number];

export interface TraceHistory {
  past: TracePoint[][];
  present: TracePoint[];
  future: TracePoint[][];
}

/** Profondeur maximale de l'historique (un point par geste, pas par frame). */
export const TRACE_HISTORY_LIMIT = 50;

const isFinitePoint = (point: TracePoint): boolean =>
  Number.isFinite(point[0]) && Number.isFinite(point[1]);

export function createTraceHistory(points: readonly TracePoint[] = []): TraceHistory {
  return { past: [], present: points.map(([lng, lat]) => [lng, lat] as TracePoint), future: [] };
}

/** Fige un nouvel état dans l'historique (`present` devient `past`). */
export function traceCommit(history: TraceHistory, next: readonly TracePoint[]): TraceHistory {
  const present = next.map(([lng, lat]) => [lng, lat] as TracePoint);
  const unchanged =
    present.length === history.present.length &&
    present.every(
      ([lng, lat], index) =>
        history.present[index]?.[0] === lng && history.present[index]?.[1] === lat,
    );
  if (unchanged) return history;
  const past = [...history.past, history.present].slice(-TRACE_HISTORY_LIMIT);
  return { past, present, future: [] };
}

/** Annule le dernier geste ; sans historique, l'état est rendu tel quel. */
export function traceUndo(history: TraceHistory): TraceHistory {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

/** Rétablit le geste annulé ; sans avenir, l'état est rendu tel quel. */
export function traceRedo(history: TraceHistory): TraceHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present].slice(-TRACE_HISTORY_LIMIT),
    present: next,
    future: history.future.slice(1),
  };
}

/**
 * Déplace le point `index` (tout point, comme les poignées de la maquette).
 * Un point non fini ou un index hors bornes laisse la liste inchangée : le
 * geste est ignoré, jamais une coordonnée `NaN` écrite en base.
 */
export function moveTracePoint(
  points: readonly TracePoint[],
  index: number,
  point: TracePoint,
): TracePoint[] {
  if (!Number.isInteger(index) || index < 0 || index >= points.length) return [...points];
  if (!isFinitePoint(point)) return [...points];
  return points.map((current, i) => (i === index ? [point[0], point[1]] : current));
}

/**
 * Supprime le segment `segmentIndex` (entre les points `segmentIndex` et
 * `segmentIndex + 1`) en retirant le **point suivant**, exactement comme
 * `acts['n-seg-del']` (L3052). Le départ et l'arrivée survivent tant qu'ils ne
 * sont pas le point retiré ; un segment hors bornes ne touche à rien.
 */
export function deleteTraceSegment(
  points: readonly TracePoint[],
  segmentIndex: number,
): TracePoint[] {
  const removeAt = segmentIndex + 1;
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || removeAt >= points.length) {
    return [...points];
  }
  return points.filter((_, index) => index !== removeAt);
}

/** Nombre de segments sélectionnables (n points → n − 1 segments). */
export function traceSegmentCount(points: readonly TracePoint[]): number {
  return Math.max(0, points.length - 1);
}

/**
 * Glisser-déposer d'un élément entre jours (moments du carnet, `sortable`) :
 * retire `itemIndex` du jour `fromDay` puis l'insère à `toIndex` du jour
 * `toDay`. `toIndex` est borné au jour cible ; un index de départ invalide
 * laisse les jours inchangés.
 */
export function moveItemBetweenDays<T>(
  days: ReadonlyArray<ReadonlyArray<T>>,
  fromDay: number,
  itemIndex: number,
  toDay: number,
  toIndex: number,
): T[][] {
  const copy = days.map((day) => [...day]);
  if (!Number.isInteger(fromDay) || !Number.isInteger(toDay)) return copy;
  if (fromDay < 0 || fromDay >= copy.length || toDay < 0 || toDay >= copy.length) return copy;
  const source = copy[fromDay];
  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= source.length) return copy;
  const [item] = source.splice(itemIndex, 1);
  const target = copy[toDay];
  const insertAt = Math.min(Math.max(0, Math.trunc(toIndex)), target.length);
  target.splice(insertAt, 0, item as T);
  return copy;
}
