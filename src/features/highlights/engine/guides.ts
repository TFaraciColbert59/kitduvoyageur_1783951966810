import type {
  Collection,
  CollectionView,
  EditorialGuide,
  GuideSection,
  Highlight,
  ParkPerimeter,
  PoiRef,
  RouteRef,
  Viewer,
} from '../types';
import { projectHighlight, projectCollection } from '../privacy';
import { normalizeKey } from './result';
import { bboxCenter, haversineM, pointInBbox } from './geometry';

export interface GuideSource {
  id: string;
  slug: string;
  title: string;
  description: string;
  theme: string | null;
  region: string | null;
  partner?: string | null;
  updatedAt?: string;
  routes: RouteRef[];
  pois: PoiRef[];
  highlights: Highlight[];
}

function inScope(text: string | null, theme: string | null, region: string | null): boolean {
  const haystack = normalizeKey(text ?? '');
  if (region) {
    const wanted = normalizeKey(region);
    if (!haystack.includes(wanted)) return false;
  }
  if (theme) {
    const tokens = normalizeKey(theme)
      .split(/[^a-z0-9]+/i)
      .filter(Boolean);
    if (tokens.length > 0) {
      const matches = tokens.some((token) => {
        const singular = token.replace(/s$/, '');
        return haystack.includes(token) || (singular.length >= 3 && haystack.includes(singular));
      });
      if (!matches) return false;
    }
  }
  return true;
}

/**
 * K1.11 / K5.17 — assemble un guide éditorial sur un thème ou une région.
 * Seuls les objets publics entrent ; un highlight masqué est projeté par P01.
 */
export function buildEditorialGuide(
  source: GuideSource,
  viewer: Viewer,
  now = new Date().toISOString()
): EditorialGuide {
  const theme = source.theme ? normalizeKey(source.theme) : null;
  const region = source.region ? normalizeKey(source.region) : null;

  const routes = source.routes.filter((route) => {
    if (route.audience !== 'public') return false;
    return inScope(`${route.title} ${route.region ?? ''}`, theme, region);
  });
  const pois = source.pois.filter((poi) => {
    if (poi.audience !== 'public') return false;
    return inScope(`${poi.name} ${poi.region ?? ''} ${poi.category}`, theme, region);
  });
  const highlights = source.highlights
    .map((highlight) => projectHighlight(highlight, viewer))
    .filter((view): view is NonNullable<typeof view> => view != null && view.audience === 'public');

  const sections: GuideSection[] = [];
  if (routes.length > 0)
    sections.push({ id: 'routes', title: 'Parcours', routes, pois: [], highlights: [] });
  if (pois.length > 0)
    sections.push({ id: 'pois', title: 'Lieux', routes: [], pois, highlights: [] });
  if (highlights.length > 0) {
    sections.push({ id: 'highlights', title: 'Highlights', routes: [], pois: [], highlights });
  }

  return {
    id: source.id,
    slug: source.slug,
    title: source.title,
    description: source.description,
    theme: source.theme,
    region: source.region,
    partner: source.partner ?? null,
    sections,
    routeCount: routes.length,
    poiCount: pois.length,
    highlightCount: highlights.length,
    updatedAt: source.updatedAt ?? now,
  };
}

/**
 * K1.12 — depuis le drawer d'un parc, la recherche est limitée à son
 * périmètre. Aucun panneau de filtres standard : la requête suffit.
 */
export function searchParkRoutes(
  park: ParkPerimeter,
  routes: readonly RouteRef[],
  query: string,
  limit = 20
): RouteRef[] {
  const tokens = normalizeKey(query)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 2);
  const center = bboxCenter(park.bbox);

  const inside = routes.filter((route) => {
    if (route.audience !== 'public') return false;
    const points =
      route.geometry && route.geometry.length > 0
        ? route.geometry
        : route.latitude != null && route.longitude != null
          ? [{ lat: route.latitude, lng: route.longitude }]
          : [];
    if (points.length === 0) return false;
    // Un parcours qui traverse le parc est éligible même si son premier point
    // est dehors : la recherche reste bornée au périmètre.
    if (!points.some((point) => pointInBbox(point, park.bbox))) return false;
    if (tokens.length === 0) return true;
    const haystack = normalizeKey(`${route.title} ${route.region ?? ''}`);
    return tokens.every((token) => haystack.includes(token));
  });

  return inside
    .slice()
    .sort((a, b) => {
      const pointA =
        a.latitude != null && a.longitude != null
          ? { lat: a.latitude, lng: a.longitude }
          : (a.geometry?.[0] ?? center);
      const pointB =
        b.latitude != null && b.longitude != null
          ? { lat: b.latitude, lng: b.longitude }
          : (b.geometry?.[0] ?? center);
      return haversineM(center, pointA) - haversineM(center, pointB);
    })
    .slice(0, limit);
}

/** K5.17 — collections éditoriales publiques, prêtes pour les résultats. */
export function publicEditorialCollections(
  collections: readonly Collection[],
  viewer: Viewer
): CollectionView[] {
  return collections
    .filter((collection) => collection.kind === 'editorial' && collection.visibility === 'public')
    .map((collection) => projectCollection(collection, viewer))
    .filter((view): view is CollectionView => view != null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
