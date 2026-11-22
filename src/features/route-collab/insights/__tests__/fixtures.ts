import type {
  CollaborativeKitItem,
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  CollaborativeStage,
  RouteWorkspaceState,
  SurfaceSegment,
} from '../../types';

export function pt(id: string, order: string, lat: number, lon: number): CollaborativeRoutePoint {
  return { id, workspaceId: 'w', kind: 'via', orderKey: order, lat, lon, entityVersion: 1 };
}

export function section(
  id: string,
  from: CollaborativeRoutePoint,
  to: CollaborativeRoutePoint,
  over: Partial<CollaborativeRouteSection> = {},
): CollaborativeRouteSection {
  const mid: [number, number] = [(from.lon + to.lon) / 2, (from.lat + to.lat) / 2];
  return {
    id,
    workspaceId: 'w',
    fromPointId: from.id,
    toPointId: to.id,
    mode: 'routed',
    geometry: { type: 'LineString', coordinates: [[from.lon, from.lat], mid, [to.lon, to.lat]] },
    distanceKm: 10,
    durationMin: 150,
    ascentM: 600,
    descentM: 300,
    surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'trail' }] as SurfaceSegment[],
    routingInputHash: 'h',
    provenance: { provider: 'test', calculatedAt: '2026-01-01T00:00:00Z', profile: 'hike', confidence: 'verified' },
    warnings: [],
    entityVersion: 1,
    ...over,
  };
}

export function stage(
  id: string,
  day: number,
  start: string,
  end: string,
  over: Partial<CollaborativeStage> = {},
): CollaborativeStage {
  return {
    id,
    workspaceId: 'w',
    orderKey: String(day),
    dayNumber: day,
    title: `Jour ${day}`,
    dateIso: '2026-07-10',
    departureTimeLocal: '08:00',
    timezone: 'Europe/Paris',
    startPointId: start,
    endPointId: end,
    overnightPlace: null,
    notes: '',
    waterObservations: [],
    weatherSlice: null,
    hazards: [],
    entityVersion: 1,
    ...over,
  };
}

export function kit(id: string, over: Partial<CollaborativeKitItem> = {}): CollaborativeKitItem {
  return {
    id,
    name: `Objet ${id}`,
    category: 'divers',
    weightGrams: 500,
    quantity: 1,
    shared: true,
    assigneeUserId: null,
    assigneeName: null,
    dependsOn: [],
    status: 'confirmed',
    ...over,
  };
}

/** Trois points alignés vers l'est le long du parallèle ~45,9 N : A -> B -> C, 2 tronçons de 10 km. */
export function basePoints() {
  return [pt('a', 'a', 45.9, 6.0), pt('b', 'b', 45.9, 6.13), pt('c', 'c', 45.9, 6.26)];
}

export function baseWorkspace(over: Partial<RouteWorkspaceState> = {}): RouteWorkspaceState {
  const [a, b, c] = basePoints();
  return {
    id: 'w',
    tripId: 't',
    title: 'Test',
    status: 'draft',
    sport: 'hiking',
    routingOptions: {},
    headSeq: 1,
    reviewedSeq: null,
    publishedRevisionId: null,
    publishedRevisionNo: null,
    sourceOrigin: { kind: 'blank' },
    points: [a, b, c],
    sections: [section('s1', a, b), section('s2', b, c)],
    stages: [stage('g1', 1, 'a', 'b'), stage('g2', 2, 'b', 'c')],
    variants: [],
    proposals: [],
    comments: [],
    kitItems: [],
    members: [],
    revisions: [],
    packs: [],
    participantPacks: [],
    updatedAt: '2026-07-01T00:00:00Z',
    ...over,
  } as RouteWorkspaceState;
}
