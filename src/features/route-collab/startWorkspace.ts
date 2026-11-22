/**
 * Constructeurs purs de l'état de départ de l'atelier d'itinéraire : carte vide, lieu confirmé,
 * tracé importé (GPX / Explorer / sortie passée). Rien n'est inventé : pas de lieu, d'altitude ni de
 * durée supposés ; une valeur absente reste `null` (« inconnue »).
 */
import { orderKeyBetween } from './engine';
import { haversineM } from './mapGeometry';
import type { RouteRoutingOptions, RouteSport } from '@/features/adventure-prep/routeProfiles';
import { defaultSpeedKmHForSport } from '@/features/adventure-prep/routeRevision';
import type {
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  CollaborativeStage,
  RouteShapeMode,
  RouteSourceOrigin,
  RouteWorkspaceState,
} from './types';

export const DEFAULT_WORKSPACE_TITLE = 'Nouvel itinéraire';
export const COMPAS_DRAFT_ORIGIN_TITLE_PREFIX = 'Tracé du Compas';

export interface BlankWorkspaceParams {
  readonly id: string;
  readonly tripId: string;
  readonly title?: string;
  readonly sport?: RouteSport;
  readonly routingOptions?: RouteRoutingOptions;
  readonly userId: string;
  readonly userName: string;
  readonly nowIso: string;
  readonly sourceOrigin?: RouteSourceOrigin;
}

/** Atelier sans point : rien à dessiner tant que la personne n'a pas choisi un départ. */
export function createBlankWorkspace(p: BlankWorkspaceParams): RouteWorkspaceState {
  return {
    id: p.id,
    tripId: p.tripId,
    title: p.title?.trim() || DEFAULT_WORKSPACE_TITLE,
    status: 'draft',
    sport: p.sport ?? 'marche',
    shapeMode: 'one_way',
    routingOptions: p.routingOptions ?? {},
    headSeq: 0,
    reviewedSeq: null,
    publishedRevisionId: null,
    publishedRevisionNo: null,
    sourceOrigin: p.sourceOrigin ?? { kind: 'blank', importedAt: p.nowIso },
    shareLink: null,
    points: [],
    sections: [],
    stages: [],
    variants: [],
    proposals: [],
    comments: [],
    kitItems: [],
    members: [{ userId: p.userId, displayName: p.userName, role: 'owner' }],
    revisions: [],
    packs: [],
    participantPacks: [],
    updatedAt: p.nowIso,
  };
}

/** Clés d'ordre successives, compatibles avec `orderKeyBetween` (insertion ultérieure sans renuméroter). */
export function orderKeys(count: number): string[] {
  const keys: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < count; i += 1) {
    const k = orderKeyBetween(prev, null);
    keys.push(k);
    prev = k;
  }
  return keys;
}

/**
 * Étapes réparties sur les points (même règle que l'opération `split_days`) : `days` jours au plus,
 * jamais plus que de tronçons. Sans deux points, aucune étape.
 */
export function stagesForPoints(
  workspaceId: string,
  ordered: readonly Pick<CollaborativeRoutePoint, 'id'>[],
  days: number | null,
  opts: { timezone?: string; departureTimeLocal?: string } = {},
): CollaborativeStage[] {
  if (ordered.length < 2) return [];
  const count = Math.max(1, Math.min(days != null && Number.isFinite(days) ? Math.round(days) : 1, ordered.length - 1, 20));
  const stages: CollaborativeStage[] = [];
  for (let d = 0; d < count; d += 1) {
    const startIdx = Math.floor((d * (ordered.length - 1)) / count);
    const endIdx = d === count - 1 ? ordered.length - 1 : Math.floor(((d + 1) * (ordered.length - 1)) / count);
    stages.push({
      id: `stage-${d + 1}`,
      workspaceId,
      orderKey: String(d + 1).padStart(3, '0'),
      dayNumber: d + 1,
      title: `Jour ${d + 1}`,
      dateIso: null,
      departureTimeLocal: opts.departureTimeLocal ?? '08:30',
      timezone: opts.timezone ?? 'Europe/Paris',
      startPointId: ordered[startIdx].id,
      endPointId: ordered[endIdx].id,
      overnightPlace: null,
      notes: '',
      waterObservations: [],
      weatherSlice: null,
      hazards: [],
      entityVersion: 1,
    });
  }
  return stages;
}

/** Un seul point (le lieu confirmé) : la carte s'y centre, aucun tronçon n'est inventé. */
export function workspaceWithStartPlace(
  base: RouteWorkspaceState,
  place: { name: string; lat: number; lon: number; country?: string | null },
  nowIso: string,
): RouteWorkspaceState {
  const pt: CollaborativeRoutePoint = {
    id: `pt-start-${Math.abs(Math.round(place.lat * 1e4))}-${Math.abs(Math.round(place.lon * 1e4))}`,
    workspaceId: base.id,
    kind: 'start',
    orderKey: 'A',
    lat: place.lat,
    lon: place.lon,
    name: place.name,
    semanticKind: 'waypoint',
    note: place.country ? `${place.name}, ${place.country}` : null,
    entityVersion: 1,
  };
  return { ...base, points: [pt], sections: [], stages: [], headSeq: base.headSeq + 1, updatedAt: nowIso };
}

export interface TrackImport {
  readonly coords: ReadonlyArray<readonly [number, number]>;
  /** Altitudes par coordonnée, mêmes indices ; `null` quand l'import n'en a pas. */
  readonly elevations?: ReadonlyArray<number | null> | null;
  readonly title: string;
  readonly origin: RouteSourceOrigin;
  /** Valeur de `section.provenance.provider` : sert aussi à relire la provenance (« import-gpx »…). */
  readonly provider: string;
  readonly keepGeometry: boolean;
  readonly startName?: string;
  readonly endName?: string;
}

function lengthM(coords: ReadonlyArray<readonly [number, number]>): number {
  let d = 0;
  for (let i = 1; i < coords.length; i += 1) d += haversineM(coords[i - 1], coords[i]);
  return d;
}

/**
 * Remplace le tracé de l'atelier par un tracé importé. Un GPX garde sa géométrie (`imported_preserved`) :
 * rien n'est recollé au réseau tant que la personne ne le demande pas.
 */
export function workspaceWithTrack(base: RouteWorkspaceState, track: TrackImport, nowIso: string): RouteWorkspaceState | null {
  if (track.coords.length < 2) return null;
  const coords = track.coords.map((c) => [c[0], c[1]] as [number, number]);
  const first = coords[0];
  const last = coords[coords.length - 1];
  const el = track.elevations && track.elevations.length === coords.length ? track.elevations : null;
  const stamp = Math.abs(Math.round(first[0] * 1e4 + first[1] * 1e4 + coords.length)).toString(36);
  const start: CollaborativeRoutePoint = {
    id: `pt-start-${stamp}`,
    workspaceId: base.id,
    kind: 'start',
    orderKey: 'A',
    lat: first[1],
    lon: first[0],
    eleM: el?.[0] ?? null,
    name: track.startName ?? 'Départ',
    entityVersion: 1,
  };
  const end: CollaborativeRoutePoint = {
    id: `pt-end-${stamp}`,
    workspaceId: base.id,
    kind: 'finish',
    orderKey: 'Z',
    lat: last[1],
    lon: last[0],
    eleM: el?.[el.length - 1] ?? null,
    name: track.endName ?? 'Arrivée',
    entityVersion: 1,
  };
  let ascent = 0;
  let descent = 0;
  let hasEle = false;
  if (el) {
    for (let i = 1; i < el.length; i += 1) {
      const a = el[i - 1];
      const b = el[i];
      if (a != null && b != null) {
        hasEle = true;
        if (b > a) ascent += b - a;
        else descent += a - b;
      }
    }
  }
  const distanceKm = Number((lengthM(coords) / 1000).toFixed(2));
  const speed = defaultSpeedKmHForSport(base.sport);
  const section: CollaborativeRouteSection = {
    id: `sec-${start.id}-${end.id}`,
    workspaceId: base.id,
    fromPointId: start.id,
    toPointId: end.id,
    mode: track.keepGeometry ? 'imported_preserved' : 'routed',
    geometry: { type: 'LineString', coordinates: coords },
    distanceKm,
    durationMin: Math.round((distanceKm / speed) * 60),
    ascentM: hasEle ? Math.round(ascent) : null,
    descentM: hasEle ? Math.round(descent) : null,
    elevationSamples: el && hasEle ? sampleElevations(el, 32) : undefined,
    surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'unknown', source: null }],
    routingInputHash: null,
    provenance: { provider: track.provider, calculatedAt: nowIso, profile: base.sport, confidence: 'estimated' },
    warnings: hasEle ? [] : ['Altitude absente du fichier importé : D+ et D− inconnus.'],
    entityVersion: 1,
  };
  return {
    ...base,
    title: base.title === DEFAULT_WORKSPACE_TITLE || !base.title ? track.title || base.title : base.title,
    sourceOrigin: track.origin,
    points: [start, end],
    sections: [section],
    stages: stagesForPoints(base.id, [start, end], 1),
    headSeq: base.headSeq + 1,
    updatedAt: nowIso,
  };
}

/** Réduit des altitudes par coordonnée à `n` échantillons répartis par indice (comme `buildElevationProfile`). */
export function sampleElevations(el: ReadonlyArray<number | null>, n: number): Array<number | null> {
  if (el.length <= n) return el.slice();
  const out: Array<number | null> = [];
  for (let i = 0; i < n; i += 1) out.push(el[Math.round((i / (n - 1)) * (el.length - 1))] ?? null);
  return out;
}

export function shapeModeOf(points: ReadonlyArray<Pick<CollaborativeRoutePoint, 'lat' | 'lon'>>): RouteShapeMode {
  if (points.length < 3) return 'one_way';
  const a = points[0];
  const b = points[points.length - 1];
  return haversineM([a.lon, a.lat], [b.lon, b.lat]) <= 100 ? 'loop' : 'one_way';
}
