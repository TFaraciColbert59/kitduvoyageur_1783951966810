/**
 * Les cinq départs du premier écran (1.3), côté données : carte vide, lieu lu dans une phrase, GPX (et KML,
 * TCX, GeoJSON), tracé de l'Explorer, sortie passée. Purs ; l'écran ne fait que choisir et afficher.
 */
import type { RouteSport } from '@/features/adventure-prep/routeProfiles';
import type { ParsedTrack } from './insights/formats';
import type { TripEntry } from './entry';
import {
  DEFAULT_WORKSPACE_TITLE,
  createBlankWorkspace,
  workspaceWithStartPlace,
  workspaceWithTrack,
} from './startWorkspace';
import type { RouteShapeMode, RouteWorkspaceState } from './types';

/** Même plafond que l'import GPX du moteur. */
export const MAX_IMPORT_POINTS = 20_000;
export const MAX_IMPORT_GPX_CHARS = 2_000_000;
export const UNATTACHED_TRIP_ID = 'trip-compas-active';

export interface StartContext {
  readonly trip: TripEntry | null;
  readonly userId: string;
  readonly userName: string;
  readonly nowIso: string;
  /** Suffixe d'identifiant, fourni par l'appelant (aléa côté client). */
  readonly idSeed: string;
}

export function workspaceIdFor(ctx: Pick<StartContext, 'trip' | 'idSeed'>): string {
  return ctx.trip ? `ws-trip-${ctx.trip.tripId}` : `ws-local-${ctx.idSeed}`;
}

/** Atelier vide, déjà rattaché au voyage et au profil de routage hérités ; aucun point. */
export function startBlank(ctx: StartContext, over: { sport?: RouteSport; title?: string; shapeMode?: RouteShapeMode } = {}): RouteWorkspaceState {
  const base = createBlankWorkspace({
    id: workspaceIdFor(ctx),
    tripId: ctx.trip?.tripId ?? UNATTACHED_TRIP_ID,
    title: over.title ?? ctx.trip?.title ?? DEFAULT_WORKSPACE_TITLE,
    sport: over.sport ?? ctx.trip?.sport ?? 'marche',
    userId: ctx.userId,
    userName: ctx.userName,
    nowIso: ctx.nowIso,
  });
  return over.shapeMode ? { ...base, shapeMode: over.shapeMode } : base;
}

export function startFromPlace(
  ctx: StartContext,
  place: { name: string; lat: number; lon: number; country?: string | null },
  over: { sport?: RouteSport; shapeMode?: RouteShapeMode } = {},
): RouteWorkspaceState {
  return workspaceWithStartPlace(startBlank(ctx, { sport: over.sport, shapeMode: over.shapeMode }), place, ctx.nowIso);
}

/** Réduit un tracé trop long en gardant premier et dernier points (pas régulier). */
export function limitTrackPoints<T>(items: readonly T[], max: number = MAX_IMPORT_POINTS): { items: T[]; reduced: boolean } {
  if (items.length <= max) return { items: items.slice(), reduced: false };
  const out: T[] = [];
  for (let i = 0; i < max; i += 1) out.push(items[Math.round((i / (max - 1)) * (items.length - 1))]);
  return { items: out, reduced: true };
}

export type ImportResult =
  | { readonly ok: true; readonly workspace: RouteWorkspaceState; readonly reduced: boolean; readonly pointCount: number }
  | { readonly ok: false; readonly error: string };

/** GPX / KML / TCX / GeoJSON : le tracé garde sa géométrie (`imported_preserved`), jamais recollé au réseau d'office. */
export function startFromParsedTrack(
  ctx: StartContext,
  parsed: ParsedTrack,
  file: { name: string; text?: string },
  over: { sport?: RouteSport } = {},
): ImportResult {
  if (parsed.points.length < 2) return { ok: false, error: 'Le fichier contient moins de deux points exploitables.' };
  const limited = limitTrackPoints(parsed.points);
  const coords = limited.items.map((p) => [p.lon, p.lat] as [number, number]);
  const withEle = limited.items.filter((p) => typeof p.ele === 'number').length;
  const title = (parsed.name?.trim() || file.name.replace(/\.[a-z0-9]+$/i, '')).slice(0, 120);
  const base = startBlank(ctx, { sport: over.sport, title: undefined });
  const ws = workspaceWithTrack(
    base,
    {
      coords,
      elevations: withEle >= 2 ? limited.items.map((p) => (typeof p.ele === 'number' ? p.ele : null)) : null,
      title,
      origin: {
        kind: 'gpx_import',
        sourceTitle: file.name.slice(0, 160),
        importedAt: ctx.nowIso,
        attribution: 'Import utilisateur',
        originalGpxXml: parsed.format === 'gpx' && file.text && file.text.length <= MAX_IMPORT_GPX_CHARS ? file.text : null,
      },
      provider: 'import-gpx',
      keepGeometry: true,
    },
    ctx.nowIso,
  );
  if (!ws) return { ok: false, error: 'Tracé illisible.' };
  return { ok: true, workspace: ws, reduced: limited.reduced, pointCount: coords.length };
}

export interface CatalogTrack {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly coordinates: ReadonlyArray<readonly [number, number]>;
}

/** Tracé de l'Explorer ou sortie passée (`/api/routes/history`) : même géométrie gardée, provenance distincte. */
export function startFromCatalogTrack(
  ctx: StartContext,
  track: CatalogTrack,
  as: 'explorer' | 'activity',
  over: { sport?: RouteSport } = {},
): ImportResult {
  const limited = limitTrackPoints(track.coordinates);
  const ws = workspaceWithTrack(
    startBlank(ctx, { sport: over.sport }),
    {
      coords: limited.items,
      title: track.title.slice(0, 120),
      origin:
        as === 'explorer'
          ? { kind: 'explorer_route', sourceId: track.id, sourceTitle: track.title, importedAt: ctx.nowIso, attribution: 'Explorer LKDV' }
          : { kind: 'activity_replay', sourceId: track.id, sourceTitle: track.title, importedAt: ctx.nowIso, attribution: 'Ma sortie' },
      provider: as === 'explorer' ? 'explorer-catalog' : `import-${track.kind}`,
      keepGeometry: true,
    },
    ctx.nowIso,
  );
  if (!ws) return { ok: false, error: 'Ce tracé contient moins de deux points.' };
  return { ok: true, workspace: ws, reduced: limited.reduced, pointCount: limited.items.length };
}

/** Tracé laissé par l'Explorer dans la session (`lkdv:compas:explorerImport:v1`) : validé, sinon ignoré. */
export const EXPLORER_IMPORT_KEY = 'lkdv:compas:explorerImport:v1';

export function readExplorerImport(raw: string | null): CatalogTrack | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { routeId?: unknown; title?: unknown; geojson?: { coordinates?: unknown } };
    const c = parsed.geojson?.coordinates;
    if (!Array.isArray(c) || c.length < 2) return null;
    const coords: Array<[number, number]> = [];
    for (const p of c) {
      if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number' && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90) coords.push([p[0], p[1]]);
    }
    if (coords.length < 2) return null;
    return {
      id: typeof parsed.routeId === 'string' || typeof parsed.routeId === 'number' ? String(parsed.routeId) : 'explorer-import',
      kind: 'randonnee',
      title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Tracé de l’Explorer',
      coordinates: coords,
    };
  } catch {
    return null;
  }
}
