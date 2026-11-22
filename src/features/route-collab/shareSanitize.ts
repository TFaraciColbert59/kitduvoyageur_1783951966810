import type {
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  RouteWorkspaceState,
} from './types';

/**
 * Assainit un itinéraire avant de le montrer par un lien de partage lecture seule (amélioration 8.9).
 *
 * RGPD (CLAUDE.md §2) : aucune coordonnée privée ne sort par un lien partagé. La zone de départ
 * (et d'arrivée d'une boucle) est masquée dans le rayon `hidePrivateStartRadiusM` : les points du
 * rayon sont déplacés au premier point du tracé hors du rayon, et les géométries y sont coupées.
 * Les données internes (propositions, commentaires, sac, versions et packs complets, XML GPX
 * d'origine, variantes de travail) ne sont jamais exposées.
 */
export const DEFAULT_PRIVATE_START_RADIUS_M = 500;

type LonLat = [number, number];

function distanceM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function isValidCoord(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  );
}

function orderedPoints(points: readonly CollaborativeRoutePoint[]): CollaborativeRoutePoint[] {
  return points
    .filter((p) => !p.deletedAt)
    .slice()
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0));
}

function routeCoordinates(state: RouteWorkspaceState): LonLat[] {
  const byFrom = new Map<string, CollaborativeRouteSection>();
  for (const s of state.sections) byFrom.set(s.fromPointId, s);
  const coords: LonLat[] = [];
  for (const p of orderedPoints(state.points)) {
    const section = byFrom.get(p.id);
    if (!section) continue;
    for (const c of section.geometry?.coordinates ?? []) {
      if (Array.isArray(c) && isValidCoord(c[1], c[0])) coords.push([c[0], c[1]]);
    }
  }
  return coords;
}

export function sanitizeWorkspaceForShareLink(
  state: RouteWorkspaceState,
  radiusM: number = state.shareLink?.hidePrivateStartRadiusM ?? DEFAULT_PRIVATE_START_RADIUS_M,
): RouteWorkspaceState {
  const radius = Number.isFinite(radiusM) && radiusM > 0 ? radiusM : 0;
  const ordered = orderedPoints(state.points);
  const start = ordered.find((p) => p.kind === 'start') ?? ordered[0] ?? null;

  const privateCenters: { lat: number; lon: number }[] = [];
  if (start && isValidCoord(start.lat, start.lon)) privateCenters.push({ lat: start.lat, lon: start.lon });

  const inside = (lat: number, lon: number) =>
    radius > 0 && privateCenters.some((c) => distanceM(c.lat, c.lon, lat, lon) <= radius);

  const coords = routeCoordinates(state);
  const firstOutside = coords.find(([lon, lat]) => !inside(lat, lon)) ?? null;
  const lastOutside = [...coords].reverse().find(([lon, lat]) => !inside(lat, lon)) ?? null;

  const points: CollaborativeRoutePoint[] = [];
  ordered.forEach((p, index) => {
    if (!inside(p.lat, p.lon)) {
      points.push({ ...p, note: null });
      return;
    }
    const isLast = index === ordered.length - 1;
    if (p.kind === 'start' || p.kind === 'finish' || index === 0 || isLast) {
      const anchor = p.kind === 'finish' || (isLast && index !== 0) ? lastOutside : firstOutside;
      // Sans aucune coordonnée hors du rayon, le point n'est pas montré du tout.
      if (!anchor) return;
      points.push({
        ...p,
        lat: anchor[1],
        lon: anchor[0],
        eleM: null,
        name: p.kind === 'start' ? 'Départ (zone privée masquée)' : 'Arrivée (zone privée masquée)',
        note: null,
      });
    }
    // Les points intermédiaires dans la zone privée sont retirés.
  });

  const keptIds = new Set(points.map((p) => p.id));
  const sections: CollaborativeRouteSection[] = state.sections
    .filter((s) => keptIds.has(s.fromPointId) && keptIds.has(s.toPointId))
    .map((s) => {
      const all = s.geometry?.coordinates ?? [];
      const kept = all.filter((c) => Array.isArray(c) && isValidCoord(c[1], c[0]) && !inside(c[1], c[0]));
      if (kept.length === all.length) return s;
      return {
        ...s,
        geometry: { type: 'LineString' as const, coordinates: kept },
        elevationSamples: undefined,
      };
    });

  return {
    ...state,
    points,
    sections,
    variants: [],
    proposals: [],
    comments: [],
    kitItems: [],
    revisions: [],
    packs: [],
    participantPacks: [],
    shareLink: null,
    sourceOrigin: { ...state.sourceOrigin, originalGpxXml: null },
    members: state.members
      .filter((m) => !m.revokedAt)
      .map((m) => ({ userId: m.userId, displayName: m.displayName, role: m.role })),
  };
}
