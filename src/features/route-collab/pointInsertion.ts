/**
 * Pose d'un point sur la carte (2.2, 2.3, 2.4) : où il s'insère, quelles opérations de l'atelier le réalisent.
 * Un point posé près du tracé s'insère dans le tronçon voisin, pas en fin de liste. Sur un tronçon gardé tel
 * quel (GPX importé, tracé à la main), la géométrie est coupée au point au lieu d'être remplacée par une droite.
 * « Fin d'étape » déplace la limite entre deux journées avec les seules opérations existantes.
 */
import { activePointsOf } from './pointOrder';
import { findInsertionTarget, splitPolylineAt, type InsertionTarget } from './mapGeometry';
import type {
  CollaborativeRoutePoint,
  CollaborativeStage,
  RouteOperationInput,
  RouteWorkspaceState,
} from './types';

export type PointRole = 'waypoint' | 'stop' | 'stage_end' | 'landmark';

export const POINT_ROLES: ReadonlyArray<{ id: PointRole; label: string; hint: string }> = [
  { id: 'waypoint', label: 'Point de passage', hint: 'Le tracé passe ici.' },
  { id: 'stop', label: 'Arrêt', hint: 'Pause, repas ou ravitaillement.' },
  { id: 'stage_end', label: 'Fin d’étape', hint: 'Termine la journée ici.' },
  { id: 'landmark', label: 'Repère', hint: 'Un lieu à retrouver, nommé.' },
];

export interface PlanRequest {
  readonly pointId: string;
  readonly role: PointRole;
  readonly lat: number;
  readonly lon: number;
  /** Rayon (m) autour du tracé dans lequel le point s'insère dans le tronçon voisin. */
  readonly thresholdM: number;
  readonly name?: string;
}

export type InsertionPlan =
  | {
      readonly ok: true;
      readonly pointId: string;
      readonly afterPointId: string | null;
      /** Position retenue (ramenée sur le tracé quand le tronçon est gardé tel quel). */
      readonly lat: number;
      readonly lon: number;
      readonly target: InsertionTarget | null;
      /** Opérations à jouer dans l'ordre. */
      readonly ops: RouteOperationInput[];
      /** Les tronçons voisins sont calculés : à recoller au réseau après coup. */
      readonly needsRouting: boolean;
    }
  | { readonly ok: false; readonly reason: string };

type Ws = Pick<RouteWorkspaceState, 'points' | 'sections' | 'stages'>;

function nameFor(role: PointRole, ordered: readonly CollaborativeRoutePoint[], stages: readonly CollaborativeStage[]): string {
  switch (role) {
    case 'stop':
      return `Arrêt ${ordered.filter((p) => p.kind === 'stop').length + 1}`;
    case 'stage_end':
      return `Fin d’étape ${stages.length + 1}`;
    case 'landmark':
      return `Repère ${ordered.filter((p) => p.semanticKind === 'custom').length + 1}`;
    default:
      return `Passage ${ordered.length + 1}`;
  }
}

/** Opérations qui font du point `pointId` la fin de la journée qui le contient. */
export function planStageBoundary(
  ordered: readonly Pick<CollaborativeRoutePoint, 'id'>[],
  stages: readonly CollaborativeStage[],
  pointId: string,
): RouteOperationInput[] | null {
  const idx = (id: string) => ordered.findIndex((p) => p.id === id);
  const at = idx(pointId);
  if (at < 0) return null;
  const sorted = stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  if (sorted.length === 0) {
    const first = ordered[0];
    return first ? [{ type: 'split_days', targetDays: 2 }, { type: 'move_day_boundary', stageId: 'stage-1', newEndPointId: pointId }] : null;
  }
  const k = sorted.findIndex((s) => {
    const a = idx(s.startPointId);
    const b = idx(s.endPointId);
    return a >= 0 && b >= a && at > a && at < b;
  });
  if (k < 0) return null;
  const ops: RouteOperationInput[] = [];
  if (k < sorted.length - 1) {
    ops.push({ type: 'move_day_boundary', stageId: sorted[k].id, newEndPointId: pointId });
    return ops;
  }
  // Dernière journée : `split_days` en crée une de plus mais répartit tout également ; on remet ensuite
  // chaque limite d'avant, puis la nouvelle au point demandé.
  ops.push({ type: 'split_days', targetDays: sorted.length + 1 });
  for (let j = 0; j < sorted.length - 1; j += 1) {
    ops.push({ type: 'move_day_boundary', stageId: sorted[j].id, newEndPointId: sorted[j].endPointId });
  }
  ops.push({ type: 'move_day_boundary', stageId: sorted[sorted.length - 1].id, newEndPointId: pointId });
  return ops;
}

export function planPointInsertion(ws: Ws, req: PlanRequest): InsertionPlan {
  const ordered = activePointsOf(ws);
  const target =
    ordered.length >= 2 ? findInsertionTarget(ordered, ws.sections, req.lat, req.lon, req.thresholdM) : null;

  if (req.role === 'stage_end' && !target) {
    return { ok: false, reason: 'Posez la fin d’étape sur le tracé ou près de lui : elle coupe une journée existante.' };
  }

  const keepGeometry = target != null && target.mode !== 'routed';
  const lat = keepGeometry ? Number(target.projection.point[1].toFixed(5)) : req.lat;
  const lon = keepGeometry ? Number(target.projection.point[0].toFixed(5)) : req.lon;
  const afterPointId = target ? target.afterPointId : (ordered[ordered.length - 1]?.id ?? null);

  const first = ordered.length === 0;
  const second = ordered.length === 1 && !target && req.role === 'waypoint';
  const kind: CollaborativeRoutePoint['kind'] = first
    ? 'start'
    : second
      ? 'finish'
      : req.role === 'stop'
        ? 'stop'
        : req.role === 'stage_end'
          ? 'stage_boundary'
          : 'via';
  const name = req.name ?? (first ? 'Départ' : second ? 'Arrivée' : nameFor(req.role, ordered, ws.stages));

  const ops: RouteOperationInput[] = [
    {
      type: 'insert_point',
      pointId: req.pointId,
      afterPointId,
      lat,
      lon,
      kind,
      name,
      semanticKind: req.role === 'landmark' ? 'custom' : 'waypoint',
    },
  ];

  if (keepGeometry && target) {
    const sec = ws.sections.find((s) => s.id === target.sectionId);
    const next = ordered[ordered.findIndex((p) => p.id === target.afterPointId) + 1];
    if (sec && next) {
      const { first: a, second: b } = splitPolylineAt(sec.geometry.coordinates, target.projection);
      ops.push(
        { type: 'set_section_mode', sectionId: `sec-${target.afterPointId}-${req.pointId}`, mode: sec.mode, geometry: { type: 'LineString', coordinates: a } },
        { type: 'set_section_mode', sectionId: `sec-${req.pointId}-${next.id}`, mode: sec.mode, geometry: { type: 'LineString', coordinates: b } },
      );
    }
  }

  if (req.role === 'stage_end') {
    const nextOrdered: Array<Pick<CollaborativeRoutePoint, 'id'>> = ordered.slice();
    const at = afterPointId ? nextOrdered.findIndex((p) => p.id === afterPointId) : nextOrdered.length - 1;
    nextOrdered.splice(at + 1, 0, { id: req.pointId });
    const stageOps = planStageBoundary(nextOrdered, ws.stages, req.pointId);
    if (!stageOps) return { ok: false, reason: 'Cette fin d’étape tombe hors de toute journée : ajustez d’abord les étapes.' };
    ops.push(...stageOps);
  }

  return { ok: true, pointId: req.pointId, afterPointId, lat, lon, target, ops, needsRouting: !keepGeometry };
}

/** Glisser une ligne (2.4) : le point déposé s'insère après le départ du tronçon glissé. */
export function planLineDrag(
  ws: Ws,
  sectionId: string,
  pointId: string,
  lat: number,
  lon: number,
): { afterPointId: string; ops: RouteOperationInput[]; newSectionIds: [string, string] } | null {
  const ordered = activePointsOf(ws);
  const sec = ws.sections.find((s) => s.id === sectionId);
  if (!sec) return null;
  const a = ordered.findIndex((p) => p.id === sec.fromPointId);
  const b = ordered.findIndex((p) => p.id === sec.toPointId);
  if (a < 0 || b !== a + 1) return null;
  return {
    afterPointId: sec.fromPointId,
    ops: [
      {
        type: 'insert_point',
        pointId,
        afterPointId: sec.fromPointId,
        lat,
        lon,
        kind: 'via',
        name: `Passage ${ordered.length + 1}`,
        semanticKind: 'waypoint',
      },
    ],
    newSectionIds: [`sec-${sec.fromPointId}-${pointId}`, `sec-${pointId}-${sec.toPointId}`],
  };
}
