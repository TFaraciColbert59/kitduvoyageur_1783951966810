import {
  CollectionsService,
  HighlightsService,
  InMemoryHighlightsStore,
  InspirationService,
  TrailMediaService,
  buildEditorialGuide,
  type Collection,
  type GuideSource,
  type InspirationCandidate,
  type ParkPerimeter,
  type PoiRef,
  type RouteActivity,
  type RouteObservation,
  type RoutePhoto,
  type RouteRef,
  type Sport,
  type Viewer,
} from '@/features/highlights';
import { pgrest } from '@/lib/explorer-v2/pgrest';
import { createClient } from '@/lib/supabase/server';

const globalForHighlights = globalThis as unknown as {
  __lkdvHighlightsStore?: InMemoryHighlightsStore;
  __lkdvHighlightsObservations?: Map<string, RouteObservation[]>;
  __lkdvHighlightsRoutePhotos?: Map<string, RoutePhoto[]>;
};

export function getHighlightsStore(): InMemoryHighlightsStore {
  if (!globalForHighlights.__lkdvHighlightsStore) {
    globalForHighlights.__lkdvHighlightsStore = new InMemoryHighlightsStore();
  }
  return globalForHighlights.__lkdvHighlightsStore;
}

export function getHighlightsService(): HighlightsService {
  return new HighlightsService(getHighlightsStore());
}

export function getCollectionsService(): CollectionsService {
  return new CollectionsService(getHighlightsStore());
}

export function getTrailMediaService(): TrailMediaService {
  return new TrailMediaService();
}

export function getRouteObservationsMap(): Map<string, RouteObservation[]> {
  if (!globalForHighlights.__lkdvHighlightsObservations) {
    globalForHighlights.__lkdvHighlightsObservations = new Map();
  }
  return globalForHighlights.__lkdvHighlightsObservations;
}

export function getRoutePhotosMap(): Map<string, RoutePhoto[]> {
  if (!globalForHighlights.__lkdvHighlightsRoutePhotos) {
    globalForHighlights.__lkdvHighlightsRoutePhotos = new Map();
  }
  return globalForHighlights.__lkdvHighlightsRoutePhotos;
}

export async function resolveOptionalViewer(): Promise<{
  viewer: Viewer;
  displayName: string | null;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) {
      return { viewer: { id: null, relation: 'anonymous' }, displayName: null };
    }
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const displayName =
      (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
      (typeof meta.username === 'string' && meta.username.trim()) ||
      user.email?.split('@')[0] ||
      null;
    return {
      viewer: { id: user.id, relation: 'authenticated' },
      displayName,
    };
  } catch {
    return { viewer: { id: null, relation: 'anonymous' }, displayName: null };
  }
}

export function mapRawSport(raw: string | null | undefined): Sport {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('trail')) return 'trail';
  if (s.includes('mtb') || s.includes('vtt')) return 'mtb';
  if (s.includes('gravel')) return 'gravel';
  if (s.includes('road') || s.includes('bike') || s.includes('velo') || s.includes('vélo')) return 'road';
  if (s.includes('ski')) return 'ski';
  if (s.includes('hike') || s.includes('rando') || s.includes('trek') || s.includes('walk')) return 'hike';
  return 'other';
}

export interface DiscoverSnapshot {
  candidates: InspirationCandidate[];
  guides: GuideSource[];
  routes: RouteRef[];
  pois: PoiRef[];
  parks: ParkPerimeter[];
  editorialCollections: Collection[];
}

export async function loadDiscoverSnapshot(): Promise<DiscoverSnapshot> {
  const store = getHighlightsStore();
  const [carnets, routesRaw, poisRaw] = await Promise.all([
    pgrest<
      Array<{
        id: string;
        title: string;
        destination: string | null;
        author_id: string | null;
        created_at: string;
        tags: string[] | null;
      }>
    >(
      'carnets?select=id,title,destination,author_id,created_at,tags&visibility=eq.public&order=created_at.desc&limit=24',
      { revalidate: 300 },
    ).catch(() => []),
    pgrest<
      Array<{
        id: number;
        name: string | null;
        network: string | null;
        country_iso: string | null;
        centroid_lat?: number | null;
        centroid_lng?: number | null;
      }>
    >(
      'geo_routes?select=id,name,network,country_iso&name=not.is.null&limit=30',
      { revalidate: 300 },
    ).catch(() => []),
    pgrest<
      Array<{
        id: string;
        name: string;
        kind: string;
        lat: number;
        lon: number;
      }>
    >(
      'geo_pois?select=id,name,kind,lat,lon&name=not.is.null&limit=40',
      { revalidate: 300 },
    ).catch(() => []),
  ]);

  const nowIso = new Date().toISOString();
  const routes: RouteRef[] = routesRaw
    .filter((r) => Boolean(r.name))
    .map((r) => ({
      id: String(r.id),
      title: r.name ?? `Itinéraire ${r.id}`,
      sport: r.network === 'icn' || r.network === 'ncn' || r.network === 'rcn' ? 'road' : 'hike',
      region: r.country_iso ? r.country_iso.toUpperCase() : null,
      audience: 'public',
      latitude: typeof r.centroid_lat === 'number' ? r.centroid_lat : null,
      longitude: typeof r.centroid_lng === 'number' ? r.centroid_lng : null,
      updatedAt: nowIso,
    }));

  const pois: PoiRef[] = poisRaw.map((p) => ({
    id: String(p.id),
    name: p.name,
    category: p.kind,
    region: null,
    audience: 'public',
    latitude: Number.isFinite(p.lat) ? p.lat : null,
    longitude: Number.isFinite(p.lon) ? p.lon : null,
    updatedAt: nowIso,
  }));

  const storeHighlights = [...store.listHighlights()];
  const storeCollections = [...store.listCollections()];

  const candidates: InspirationCandidate[] = [
    ...carnets.map((c) => ({
      id: `carnet:${c.id}`,
      type: 'collection' as const,
      title: c.title,
      sport: mapRawSport(c.tags?.[0] ?? null),
      region: c.destination ?? null,
      authorId: c.author_id ?? null,
      audience: 'public' as const,
      updatedAt: c.created_at || nowIso,
    })),
    ...routes.map((r) => ({
      id: `route:${r.id}`,
      type: 'route' as const,
      title: r.title,
      sport: r.sport,
      region: r.region,
      authorId: null,
      audience: 'public' as const,
      updatedAt: r.updatedAt,
    })),
    ...storeHighlights
      .filter((h) => h.audience === 'public' && h.status === 'published')
      .map((h) => ({
        id: h.id,
        type: 'highlight' as const,
        title: h.title,
        sport: h.sport,
        region: h.areaLabel || null,
        authorId: h.authorId,
        audience: h.audience,
        updatedAt: h.updatedAt,
      })),
  ];

  const byRegion = new Map<string, { routes: RouteRef[]; pois: PoiRef[]; titles: string[] }>();
  for (const r of routes) {
    const key = r.region || 'Découverte';
    const bucket = byRegion.get(key) ?? { routes: [], pois: [], titles: [] };
    bucket.routes.push(r);
    byRegion.set(key, bucket);
  }
  for (const c of carnets) {
    const key = (c.destination?.split(',')[0]?.trim() || 'Découverte');
    const bucket = byRegion.get(key) ?? { routes: [], pois: [], titles: [] };
    bucket.titles.push(c.title);
    byRegion.set(key, bucket);
  }

  const guides: GuideSource[] = [...byRegion.entries()].slice(0, 6).map(([region, data], idx) => ({
    id: `guide-${idx + 1}-${region.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    slug: region.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: region === 'Découverte' ? 'Itinéraires et points forts publics' : `Guide · ${region}`,
    description:
      data.titles.length > 0
        ? `Sélection réelle de carnets et traces publiques (${data.titles.slice(0, 2).join(', ')})`
        : 'Itinéraires et highlights publics recensés sur LKDV.',
    theme: 'Montagne & grand air',
    region: region === 'Découverte' ? null : region,
    partner: null,
    updatedAt: nowIso,
    routes: data.routes,
    pois: idx === 0 ? pois.slice(0, 12) : [],
    highlights: storeHighlights.filter(
      (h) => !region || region === 'Découverte' || h.areaLabel.toLowerCase().includes(region.toLowerCase()),
    ),
  }));

  if (guides.length === 0 && (storeHighlights.length > 0 || pois.length > 0)) {
    guides.push({
      id: 'guide-public-lkdv',
      slug: 'public-lkdv',
      title: 'Sélection terrain LKDV',
      description: 'Highlights et points d’intérêt publics partagés par les membres.',
      theme: 'Terrain',
      region: null,
      partner: null,
      updatedAt: nowIso,
      routes,
      pois: pois.slice(0, 12),
      highlights: storeHighlights,
    });
  }

  const editorialCollections: Collection[] = storeCollections.filter(
    (c) => c.kind === 'editorial' && c.visibility === 'public',
  );

  // Construire les périmètres de parcs uniquement si des itinéraires géolocalisés existent.
  const parks: ParkPerimeter[] = [];
  const geoRoutes = routes.filter(
    (r) => typeof r.latitude === 'number' && typeof r.longitude === 'number',
  );
  if (geoRoutes.length > 0) {
    const lats = geoRoutes.map((r) => r.latitude as number);
    const lngs = geoRoutes.map((r) => r.longitude as number);
    parks.push({
      id: 'park-viewport-routes',
      name: 'Secteur des parcours publics',
      region: geoRoutes[0]?.region ?? null,
      bbox: [
        Math.min(...lngs) - 0.5,
        Math.min(...lats) - 0.5,
        Math.max(...lngs) + 0.5,
        Math.max(...lats) + 0.5,
      ],
    });
  }

  return { candidates, guides, routes, pois, parks, editorialCollections };
}

export function createInspirationServiceFromSnapshot(snapshot: DiscoverSnapshot): InspirationService {
  return new InspirationService({
    candidates: snapshot.candidates,
    guides: snapshot.guides,
    routes: snapshot.routes,
    pois: snapshot.pois,
  });
}

export function buildGuideViews(snapshot: DiscoverSnapshot, viewer: Viewer) {
  return snapshot.guides.map((g) => buildEditorialGuide(g, viewer));
}

export type { RouteActivity };
