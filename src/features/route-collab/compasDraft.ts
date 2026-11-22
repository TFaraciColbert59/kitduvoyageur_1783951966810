/**
 * Reprise du tracé du Compas (1.2) : `trips.metadata.compas.routeDraft` (une `RouteRevision` de l'éditeur
 * du Compas) devient le point de départ de l'atelier d'itinéraire. Conversion pure et sans perte de
 * géométrie : les tronçons calculés restent calculés, les tronçons à la main restent « manuels ».
 * Altitude, dénivelé et surfaces que le brouillon ne porte pas restent `null` (« inconnus »).
 */
import { computeRoutingFingerprint } from './engine';
import { projectOnPolyline } from './mapGeometry';
import {
  COMPAS_DRAFT_ORIGIN_TITLE_PREFIX,
  createBlankWorkspace,
  orderKeys,
  shapeModeOf,
  stagesForPoints,
} from './startWorkspace';
import type { RouteRevision, RouteRevisionPoint, RouteSection } from '@/features/adventure-prep/routeRevision';
import type {
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  RouteWorkspaceState,
} from './types';

export interface DraftEntities {
  readonly points: CollaborativeRoutePoint[];
  readonly sections: CollaborativeRouteSection[];
}

const KIND: Record<RouteRevisionPoint['kind'], CollaborativeRoutePoint['kind']> = {
  start: 'start',
  via: 'via',
  end: 'finish',
};

/**
 * Un ancien brouillon sans `sections` ne porte que la ligne entière : on la coupe aux points, en avançant
 * toujours (un point ne peut pas revenir avant le précédent).
 */
export function splitGeometryByPoints(
  coordinates: ReadonlyArray<readonly [number, number]>,
  points: ReadonlyArray<Pick<RouteRevisionPoint, 'lat' | 'lon'>>,
): Array<Array<[number, number]>> {
  const cuts: Array<{ index: number; point: [number, number] }> = [{ index: 0, point: [coordinates[0][0], coordinates[0][1]] }];
  let from = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const tail = coordinates.slice(from);
    const proj = projectOnPolyline(tail, [points[i].lon, points[i].lat]);
    const idx = proj ? from + proj.index + (proj.t >= 0.5 ? 1 : 0) : from;
    const clamped = Math.min(Math.max(idx, from), coordinates.length - 1);
    cuts.push({ index: clamped, point: [coordinates[clamped][0], coordinates[clamped][1]] });
    from = clamped;
  }
  cuts.push({ index: coordinates.length - 1, point: [coordinates[coordinates.length - 1][0], coordinates[coordinates.length - 1][1]] });
  const out: Array<Array<[number, number]>> = [];
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const seg = coordinates.slice(cuts[i].index, cuts[i + 1].index + 1).map((c) => [c[0], c[1]] as [number, number]);
    out.push(seg.length >= 2 ? seg : [cuts[i].point, cuts[i + 1].point]);
  }
  return out;
}

function lengthKm(coords: ReadonlyArray<readonly [number, number]>): number {
  let m = 0;
  const kx = (lat: number) => Math.cos((lat * Math.PI) / 180) * 111_320;
  for (let i = 1; i < coords.length; i += 1) {
    m += Math.hypot((coords[i][0] - coords[i - 1][0]) * kx(coords[i][1]), (coords[i][1] - coords[i - 1][1]) * 110_540);
  }
  return Number((m / 1000).toFixed(2));
}

export function routeDraftToEntities(draft: RouteRevision, workspaceId: string): DraftEntities {
  const keys = orderKeys(draft.points.length);
  const points: CollaborativeRoutePoint[] = draft.points.map((p, i) => ({
    id: p.id,
    workspaceId,
    kind: KIND[p.kind],
    orderKey: keys[i],
    lat: p.lat,
    lon: p.lon,
    name: p.name ?? null,
    semanticKind: p.semanticKind ?? 'waypoint',
    note: p.note ?? null,
    entityVersion: 1,
  }));

  const covered =
    draft.sections.length === draft.points.length - 1 &&
    draft.sections.every((s, i) => s.fromIndex === i && s.toIndex === i + 1);
  const rows: Array<Pick<RouteSection, 'mode' | 'geometry' | 'distanceKm' | 'durationMin' | 'provider'>> = covered
    ? draft.sections
    : splitGeometryByPoints(draft.geometry.coordinates, draft.points).map((coords) => ({
        mode: 'routed' as const,
        geometry: { type: 'LineString' as const, coordinates: coords },
        distanceKm: lengthKm(coords),
        durationMin: null,
        provider: draft.provider,
      }));

  const sections: CollaborativeRouteSection[] = rows.map((row, i) => {
    const from = points[i];
    const to = points[i + 1];
    const manual = row.mode === 'manual';
    return {
      id: `sec-draft-${from.id}-${to.id}`,
      workspaceId,
      fromPointId: from.id,
      toPointId: to.id,
      mode: manual ? 'manual' : 'routed',
      geometry: { type: 'LineString', coordinates: row.geometry.coordinates.map((c) => [c[0], c[1]] as [number, number]) },
      distanceKm: row.distanceKm,
      durationMin: row.durationMin,
      ascentM: null,
      descentM: null,
      surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'unknown', source: null }],
      routingInputHash: manual ? null : computeRoutingFingerprint({ from, to, sport: draft.sport, options: {} }),
      provenance: {
        provider: manual ? null : (row.provider ?? draft.provider),
        calculatedAt: draft.savedAt || null,
        profile: draft.sport,
        confidence: manual || !(row.provider ?? draft.provider) ? 'estimated' : 'verified',
      },
      warnings: manual ? ['Tronçon tracé à la main : non vérifié sur le réseau.'] : [],
      entityVersion: 1,
    };
  });
  return { points, sections };
}

export interface WorkspaceFromDraftParams {
  readonly draft: RouteRevision;
  readonly workspaceId: string;
  readonly tripId: string;
  readonly title: string | null;
  readonly userId: string;
  readonly userName: string;
  readonly nowIso: string;
  /** Jours du voyage (lecture unique `tripContext`), `null` si inconnus : une seule étape alors. */
  readonly days?: number | null;
  readonly timezone?: string;
}

export function buildWorkspaceFromRouteDraft(p: WorkspaceFromDraftParams): RouteWorkspaceState {
  const base = createBlankWorkspace({
    id: p.workspaceId,
    tripId: p.tripId,
    title: p.title ?? undefined,
    sport: p.draft.sport,
    userId: p.userId,
    userName: p.userName,
    nowIso: p.nowIso,
    sourceOrigin: {
      kind: 'blank',
      sourceId: p.draft.id,
      sourceTitle: `${COMPAS_DRAFT_ORIGIN_TITLE_PREFIX} · version ${p.draft.version}`,
      attribution: 'Compas LKDV',
      importedAt: p.draft.savedAt || p.nowIso,
    },
  });
  const { points, sections } = routeDraftToEntities(p.draft, p.workspaceId);
  return {
    ...base,
    shapeMode: shapeModeOf(points),
    points,
    sections,
    stages: stagesForPoints(p.workspaceId, points, p.days ?? null, { timezone: p.timezone }),
  };
}
