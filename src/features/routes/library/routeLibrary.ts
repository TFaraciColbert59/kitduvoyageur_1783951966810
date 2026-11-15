import { haversineKm } from '@/features/adventure-prep/engine/routing';
import { isRouteSport, type RouteRoutingOptions, type RouteSport } from '@/features/adventure-prep/routeProfiles';
import {
  createRouteDraft,
  limitRoutePoints,
  lineStringFromPoints,
  normalizeRoutePoints,
  readLineString,
  routeGeometryDistanceKm,
  type RouteDraft,
  type RouteGeometry,
  type RouteRevisionPoint,
  type RouteSection,
  type RouteShapeMode,
} from '@/features/adventure-prep/routeRevision';

export type SavedRouteSourceType = 'created' | 'copied' | 'converted_outing';

export interface SavedRouteItem {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly sourceType: SavedRouteSourceType;
  readonly sourceId?: string | null;
  readonly draft: RouteDraft;
  readonly routingOptions?: RouteRoutingOptions;
  readonly shapeMode?: RouteShapeMode;
  readonly speedKmH?: number;
  readonly lineHidden?: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const ROUTE_LIBRARY_STORAGE_KEY = 'lkdv.routes.library.v1';

function safeUuid(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadSavedRoutes(storage?: Storage | null): SavedRouteItem[] {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!target) return [];
  try {
    const raw = target.getItem(ROUTE_LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedRouteItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        Boolean(item.draft) &&
        Array.isArray(item.draft.points)
    );
  } catch {
    return [];
  }
}

export function persistSavedRoutes(items: readonly SavedRouteItem[], storage?: Storage | null): boolean {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!target) return false;
  try {
    target.setItem(ROUTE_LIBRARY_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function saveRouteToLibrary(
  item: Omit<SavedRouteItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  storage?: Storage | null,
  nowIso: string = new Date().toISOString()
): SavedRouteItem[] {
  const current = loadSavedRoutes(storage);
  const existing = item.id ? current.find((entry) => entry.id === item.id) : undefined;
  const saved: SavedRouteItem = {
    ...item,
    id: item.id ?? safeUuid('route'),
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
  const next = existing
    ? current.map((entry) => (entry.id === saved.id ? saved : entry))
    : [saved, ...current];
  persistSavedRoutes(next, storage);
  return next;
}

export function renameSavedRoute(
  id: string,
  name: string,
  storage?: Storage | null,
  nowIso: string = new Date().toISOString()
): SavedRouteItem[] {
  const trimmed = name.trim();
  if (!trimmed) return loadSavedRoutes(storage);
  const next = loadSavedRoutes(storage).map((entry) =>
    entry.id === id ? { ...entry, name: trimmed.slice(0, 120), updatedAt: nowIso } : entry
  );
  persistSavedRoutes(next, storage);
  return next;
}

export function deleteSavedRoute(id: string, storage?: Storage | null): SavedRouteItem[] {
  const next = loadSavedRoutes(storage).filter((entry) => entry.id !== id);
  persistSavedRoutes(next, storage);
  return next;
}

/**
 * K2.28 : crée une copie modifiable d'un parcours existant (catalogue Explorer
 * ou parcours personnel) en échantillonnant ses points de contrôle <= 12.
 */
export function copyRouteToDraft(input: {
  sourceId: string;
  name?: string | null;
  sport?: RouteSport;
  geojson: unknown;
  distanceKm?: number | null;
  nowIso?: string;
}): { name: string; draft: RouteDraft } | null {
  const geometry = readLineString(input.geojson);
  if (!geometry || geometry.coordinates.length < 2) return null;
  const sport: RouteSport = input.sport && isRouteSport(input.sport) ? input.sport : 'marche';
  const rawPoints = geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
  const points = limitRoutePoints(normalizeRoutePoints(rawPoints));
  if (points.length < 2) return null;
  const baseName = (input.name ?? '').trim() || `Itinéraire ${input.sourceId}`;
  const copyName = baseName.endsWith('(copie)') ? baseName : `${baseName} (copie)`;
  const distanceKm =
    typeof input.distanceKm === 'number' && Number.isFinite(input.distanceKm)
      ? input.distanceKm
      : routeGeometryDistanceKm(geometry);
  const draft = createRouteDraft({
    tripId: `copy-${input.sourceId}`,
    sport,
    points,
    geometry,
    distanceKm,
    durationMin: null,
    provider: 'catalog-copy',
    now: input.nowIso,
  });
  return { name: copyName, draft };
}

function sportFromOuting(sportRaw: string | null | undefined): RouteSport {
  const s = (sportRaw ?? '').toLowerCase();
  if (s.includes('gravel')) return 'gravel';
  if (s.includes('vtt') || s.includes('mtb')) return 'vtt';
  if (s.includes('velo') || s.includes('bike') || s.includes('cycl') || s.includes('route')) return 'route';
  if (s.includes('enduro') || s.includes('moto')) return 'enduro';
  return 'marche';
}

/**
 * S3.08 : convertit une activité / sortie enregistrée en itinéraire modifiable
 * dans la bibliothèque personnelle.
 */
export function convertOutingToRoute(input: {
  outingId: string;
  title?: string | null;
  sport?: string | null;
  points: ReadonlyArray<{ lat: number; lng: number }>;
  durationS?: number | null;
  nowIso?: string;
}): SavedRouteItem | null {
  const coords: Array<[number, number]> = input.points
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => [p.lng, p.lat]);
  if (coords.length < 2) return null;

  const geometry: RouteGeometry = { type: 'LineString', coordinates: coords };
  const routeSport = sportFromOuting(input.sport);
  const waypoints = limitRoutePoints(
    normalizeRoutePoints(coords.map(([lon, lat]) => ({ lat, lon })))
  );
  if (waypoints.length < 2) return null;

  let distanceKm = 0;
  for (let i = 1; i < coords.length; i += 1) {
    distanceKm += haversineKm(
      { lat: coords[i - 1][1], lon: coords[i - 1][0] },
      { lat: coords[i][1], lon: coords[i][0] }
    );
  }
  const durationMin =
    typeof input.durationS === 'number' && Number.isFinite(input.durationS) && input.durationS > 0
      ? Math.round(input.durationS / 60)
      : null;

  const now = input.nowIso ?? new Date().toISOString();
  const section: RouteSection = {
    id: 'outing-1',
    mode: 'manual',
    fromIndex: 0,
    toIndex: waypoints.length - 1,
    geometry,
    distanceKm,
    durationMin,
    provider: 'recorded-outing',
  };
  const draft = createRouteDraft({
    tripId: `outing-${input.outingId}`,
    sport: routeSport,
    points: waypoints,
    geometry,
    sections: waypoints.length === 2 ? [section] : undefined,
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMin,
    provider: 'recorded-outing',
    now,
  });

  const cleanTitle = (input.title ?? '').trim() || `Sortie du ${now.slice(0, 10)}`;
  return {
    id: safeUuid('from-outing'),
    name: `${cleanTitle} · parcours`,
    sourceType: 'converted_outing',
    sourceId: input.outingId,
    draft,
    createdAt: now,
    updatedAt: now,
  };
}

/** Utilitaire d'affichage d'aperçu pour une révision éditée. */
export function fallbackGeometryForWaypoints(points: readonly RouteRevisionPoint[]): RouteGeometry {
  return lineStringFromPoints(points);
}
