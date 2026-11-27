import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/api/serviceClient';
import { pgrest, rpc } from '@/lib/explorer-v2/pgrest';
import { getCountryCoordinates } from '@/lib/countryCoordinates';
import {
  buildApiMeta,
  clampBbox,
  emptyFeatureCollection,
  fuzzLocation250mHmac,
  sanitizeHttpsUrl,
  type ExplorerApiMeta,
  type GeoJsonFeatureCollection,
  type GeoJsonPointFeature,
} from '@/lib/explorer/edgeCache';

export const dynamic = 'force-dynamic';

const VALID_KINDS = ['carnets', 'clubs', 'stories', 'events', 'friends', 'bottles'] as const;
export type SocialMapKind = (typeof VALID_KINDS)[number];
const VALID_KIND_SET = new Set<string>(VALID_KINDS);

const querySchema = z.object({
  south: z.coerce.number().min(-90).max(90),
  west: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  kinds: z.string().trim().max(120).optional(),
  iso: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
});

function sanitizeMediaUrl(raw: string | null | undefined): string | null {
  const https = sanitizeHttpsUrl(raw);
  if (https) return https;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\/(api\/|images\/|assets\/|uploads\/|storage\/)[^\s"'<>]+$/.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

export interface SocialMapPayload {
  carnets: GeoJsonFeatureCollection;
  clubs: GeoJsonFeatureCollection;
  stories: GeoJsonFeatureCollection;
  events: GeoJsonFeatureCollection;
  friends: GeoJsonFeatureCollection;
  bottles: GeoJsonFeatureCollection;
  counts: {
    carnets: number;
    clubs: number;
    stories: number;
    events: number;
    friends: number;
    bottles: number;
  };
  meta: ExplorerApiMeta;
}

function parseKinds(raw: string | undefined): Set<SocialMapKind> {
  if (!raw) return new Set<SocialMapKind>(['carnets', 'clubs', 'stories']);
  const out = new Set<SocialMapKind>();
  for (const token of raw.split(',')) {
    const clean = token.trim().toLowerCase();
    if (VALID_KIND_SET.has(clean)) {
      out.add(clean as SocialMapKind);
    }
  }
  return out.size > 0 ? out : new Set<SocialMapKind>(['carnets', 'clubs', 'stories']);
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function extractPointFromUnknown(value: unknown): [number, number] | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (obj.type === 'Point' && Array.isArray(obj.coordinates) && obj.coordinates.length >= 2) {
    const lng = asFiniteNumber(obj.coordinates[0]);
    const lat = asFiniteNumber(obj.coordinates[1]);
    if (lng !== null && lat !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lng, lat];
    }
  }
  const lat = asFiniteNumber(obj.lat ?? obj.latitude);
  const lng = asFiniteNumber(obj.lng ?? obj.lon ?? obj.longitude);
  if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return [lng, lat];
  }
  return null;
}

function viewportPadDeg(
  south: number,
  west: number,
  north: number,
  east: number,
): { padLat: number; padLng: number } {
  const latSpan = Math.max(0.004, Math.abs(north - south));
  const lngSpan = Math.max(0.004, Math.abs(east - west));
  return {
    padLat: Math.min(0.35, Math.max(0.01, latSpan * 0.15)),
    padLng: Math.min(0.45, Math.max(0.012, lngSpan * 0.15)),
  };
}

function inBbox(
  lat: number,
  lng: number,
  south: number,
  west: number,
  north: number,
  east: number,
  marginDeg = 0,
): boolean {
  return (
    lat >= south - marginDeg &&
    lat <= north + marginDeg &&
    lng >= west - marginDeg &&
    lng <= east + marginDeg
  );
}

function inViewportWithPad(
  lat: number,
  lng: number,
  south: number,
  west: number,
  north: number,
  east: number,
): boolean {
  const { padLat, padLng } = viewportPadDeg(south, west, north, east);
  return (
    lat >= south - padLat &&
    lat <= north + padLat &&
    lng >= west - padLng &&
    lng <= east + padLng
  );
}

interface PublicCarnetRow {
  id: string;
  title: string | null;
  destination: string | null;
  cover_image: string | null;
  start_date: string | null;
  nb_nuits: number | null;
  likes_count: number | null;
  country_iso: string | null;
  start_geom?: unknown;
}

interface PublicClubRow {
  id: string;
  slug: string | null;
  name: string | null;
  category: string | null;
  emoji: string | null;
  cover_image: string | null;
  privacy: string | null;
  members_count: number | null;
  location_label: string | null;
  country_iso: string | null;
  is_verified: boolean | null;
}

interface PublicEventRow {
  id: string;
  club_id: string | null;
  title: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  starts_at: string | null;
  event_date: string | null;
  visibility: string | null;
  surface_type: string | null;
}

interface PublicStoryRow {
  id: string;
  author_id: string | null;
  club_id: string | null;
  image_url: string | null;
  storage_path: string | null;
  caption: string | null;
  media_type: string | null;
  created_at: string | null;
  expires_at: string | null;
  composition: Record<string, unknown> | null;
}

interface PublicBottleRow {
  id: string;
  name: string | null;
  description: string | null;
  destination?: string | null;
  place_label?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  country_iso: string | null;
  departure_date: string | null;
  return_date: string | null;
  max_members: number | null;
  min_trust_score: number | null;
  mixite: string | null;
  owner_id: string | null;
  created_at: string | null;
}

/**
 * Metropolitan-safe centroids for countries whose multi-polygon DB centroids
 * can be pulled outside the mainland by overseas territories (e.g. FR -> northern Spain).
 */
const SAFE_COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  FR: [2.2137, 46.2276],
  ES: [-3.7492, 40.4637],
  PT: [-8.2245, 39.3999],
  IT: [12.5674, 42.5042],
  CH: [8.2275, 46.8182],
  DE: [10.4515, 51.1657],
  BE: [4.4699, 50.5039],
  NL: [5.2913, 52.1326],
  GB: [-2.5479, 54.0934],
  NO: [8.4689, 60.472],
  DK: [9.5018, 56.2639],
  AT: [14.5501, 47.5162],
};

/** Safe continental bounding boxes for fallback centroid clamping (minLng, minLat, maxLng, maxLat). */
const SAFE_COUNTRY_BOUNDS: Record<string, readonly [number, number, number, number]> = {
  FR: [-4.2, 43.2, 7.5, 50.8],
  ES: [-9.0, 36.2, 3.0, 43.4],
  PT: [-9.3, 37.1, -6.3, 42.0],
  IT: [7.0, 38.0, 17.8, 46.5],
  CH: [6.0, 45.9, 10.4, 47.7],
  DE: [6.0, 47.5, 14.8, 54.6],
  BE: [2.7, 49.6, 6.2, 51.4],
  NL: [3.5, 50.8, 7.1, 53.4],
  GB: [-5.5, 50.2, 1.6, 58.4],
};

interface CountryCentroidRow {
  iso_a2: string;
  lat: number | string | null;
  lng: number | string | null;
}

interface GroupPublicCardStatRow {
  group_id: string;
  active_members?: number | string | null;
}

async function loadCentroidByIso(): Promise<Map<string, [number, number]>> {
  const centroidRows = await pgrest<CountryCentroidRow[]>('country_centroids?select=iso_a2,lat,lng', {
    revalidate: 3600,
  }).catch(() => [] as CountryCentroidRow[]);

  const centroidByIso = new Map<string, [number, number]>();
  for (const row of centroidRows ?? []) {
    const iso = typeof row.iso_a2 === 'string' ? row.iso_a2.trim().toUpperCase() : '';
    const lat = asFiniteNumber(row.lat);
    const lng = asFiniteNumber(row.lng);
    if (iso && lat !== null && lng !== null) {
      centroidByIso.set(iso, [lng, lat]);
    }
  }
  return centroidByIso;
}

function resolveIsoPoint(
  isoRaw: string | null | undefined,
  seedId: string,
  centroidByIso: Map<string, [number, number]>,
  fallbackCenter: [number, number],
): [number, number] {
  const iso = typeof isoRaw === 'string' ? isoRaw.trim().toUpperCase() : '';
  const dbCentroid = iso ? centroidByIso.get(iso) : undefined;
  const fallbackCentroid = iso && !dbCentroid ? getCountryCoordinates(iso) : null;
  const baseLng = dbCentroid ? dbCentroid[0] : (fallbackCentroid?.lng ?? fallbackCenter[0]);
  const baseLat = dbCentroid ? dbCentroid[1] : (fallbackCentroid?.lat ?? fallbackCenter[1]);
  const [dLng, dLat] = deterministicBottleOffset(seedId);
  return [
    Math.max(-180, Math.min(180, baseLng + dLng)),
    Math.max(-85, Math.min(85, baseLat + dLat)),
  ];
}

async function loadPublicCarnets(
  south: number,
  west: number,
  north: number,
  east: number,
  centroidByIso: Map<string, [number, number]>,
  _isoFilter?: string | null,
): Promise<GeoJsonFeatureCollection> {
  /*
   * S6.15 — Liste publique : jamais sélectionner ni exposer `distance_km`
   * ou `denivele_m` (métriques potentiellement masquées par politique par
   * sortie). Fail-closed : les champs métriques restent `null`.
   */
  const rows = await pgrest<PublicCarnetRow[]>(
    'carnets?select=id,title,destination,cover_image,start_date,nb_nuits,likes_count,country_iso,start_geom' +
      '&visibility=eq.public&order=created_at.desc&limit=80',
    { revalidate: 120 },
  );

  const bboxCenter: [number, number] = [(west + east) / 2, (south + north) / 2];
  const inArea: GeoJsonPointFeature[] = [];

  for (const row of rows ?? []) {
    if (!row.id) continue;
    const rowIso = typeof row.country_iso === 'string' ? row.country_iso.trim().toUpperCase() : null;
    const geomPt = extractPointFromUnknown(row.start_geom);
    const hasExactCoords = Boolean(geomPt);
    const pt = geomPt ?? (rowIso ? resolveIsoPoint(rowIso, `carnet-${row.id}`, centroidByIso, bboxCenter) : null);
    if (!pt) continue;
    const [lng, lat] = pt;

    // Only include carnets actually inside the viewed zone (exact coordinates or wide-zoom country match)
    const matchesViewport = hasExactCoords
      ? inViewportWithPad(lat, lng, south, west, north, east)
      : Math.abs(north - south) >= 2.5 && inViewportWithPad(lat, lng, south, west, north, east);

    if (!matchesViewport) continue;

    inArea.push({
      type: 'Feature',
      id: row.id,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: row.id,
        kind: 'carnet',
        title: row.title ?? 'Carnet de voyage',
        destination: row.destination ?? null,
        coverImage: sanitizeMediaUrl(row.cover_image),
        startDate: row.start_date ?? null,
        nbNuits: row.nb_nuits ?? null,
        likesCount: row.likes_count ?? 0,
        countryIso: rowIso,
        distanceKm: null,
        deniveleM: null,
        inArea: true,
        hasExactCoords,
      },
    });
  }
  return { type: 'FeatureCollection', features: inArea };
}

async function loadPublicClubsAndEvents(
  south: number,
  west: number,
  north: number,
  east: number,
  wantClubs: boolean,
  wantEvents: boolean,
  centroidByIso: Map<string, [number, number]>,
  _isoFilter?: string | null,
): Promise<{ clubs: GeoJsonFeatureCollection; events: GeoJsonFeatureCollection }> {
  const { padLat, padLng } = viewportPadDeg(south, west, north, east);
  const [clubRows, eventRows] = await Promise.all([
    wantClubs
      ? pgrest<PublicClubRow[]>(
          'clubs?select=id,slug,name,category,emoji,cover_image,privacy,members_count,location_label,country_iso,is_verified' +
            '&privacy=in.(open,public)&order=members_count.desc&limit=100',
          { revalidate: 120 },
        ).catch(() => [] as PublicClubRow[])
      : Promise.resolve([] as PublicClubRow[]),
    pgrest<PublicEventRow[]>(
      `club_events?select=id,club_id,title,location,lat,lng,starts_at,event_date,visibility,surface_type` +
        `&visibility=eq.public&lat=gte.${Math.max(-90, south - padLat).toFixed(5)}&lat=lte.${Math.min(90, north + padLat).toFixed(5)}` +
        `&lng=gte.${Math.max(-180, west - padLng).toFixed(5)}&lng=lte.${Math.min(180, east + padLng).toFixed(5)}&order=starts_at.asc.nullslast&limit=80`,
      { revalidate: 120 },
    ).catch(() => [] as PublicEventRow[]),
  ]);

  const publicClubById = new Map<string, PublicClubRow>();
  for (const club of clubRows) {
    if (club.id && (club.privacy === 'open' || club.privacy === 'public')) {
      publicClubById.set(club.id, club);
    }
  }

  const bboxCenter: [number, number] = [(west + east) / 2, (south + north) / 2];
  const clubFeatures: GeoJsonPointFeature[] = [];
  const seenClubs = new Set<string>();
  const eventFeatures: GeoJsonPointFeature[] = [];

  for (const ev of eventRows) {
    const lat = asFiniteNumber(ev.lat);
    const lng = asFiniteNumber(ev.lng);
    if (lat === null || lng === null || !inViewportWithPad(lat, lng, south, west, north, east)) {
      continue;
    }

    if (wantEvents) {
      eventFeatures.push({
        type: 'Feature',
        id: ev.id,
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          id: ev.id,
          kind: 'event',
          clubId: ev.club_id ?? null,
          title: ev.title ?? 'Sortie club',
          location: ev.location ?? null,
          startsAt: ev.starts_at ?? ev.event_date ?? null,
          surfaceType: ev.surface_type ?? null,
        },
      });
    }

    if (wantClubs && ev.club_id && !seenClubs.has(ev.club_id)) {
      const club = publicClubById.get(ev.club_id);
      if (club) {
        seenClubs.add(ev.club_id);
        clubFeatures.push({
          type: 'Feature',
          id: club.id,
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {
            id: club.id,
            kind: 'club',
            slug: club.slug ?? club.id,
            name: club.name ?? 'Club',
            category: club.category ?? null,
            emoji: club.emoji ?? null,
            coverImage: sanitizeMediaUrl(club.cover_image),
            membersCount: club.members_count ?? 0,
            locationLabel: club.location_label ?? ev.location ?? null,
            countryIso: club.country_iso ?? null,
            isVerified: Boolean(club.is_verified),
            inArea: true,
            hasExactCoords: true,
          },
        });
      }
    }
  }

  // At country/wide overview zoom (>= 2.5° span), also surface verified country clubs whose centroid lies in viewport
  if (wantClubs && Math.abs(north - south) >= 2.5) {
    for (const club of publicClubById.values()) {
      if (seenClubs.has(club.id)) continue;
      const clubIso =
        typeof club.country_iso === 'string' ? club.country_iso.trim().toUpperCase() : null;
      if (!clubIso) continue;
      const [lng, lat] = resolveIsoPoint(clubIso, `club-${club.id}`, centroidByIso, bboxCenter);
      if (!inViewportWithPad(lat, lng, south, west, north, east)) continue;
      seenClubs.add(club.id);
      clubFeatures.push({
        type: 'Feature',
        id: club.id,
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          id: club.id,
          kind: 'club',
          slug: club.slug ?? club.id,
          name: club.name ?? 'Club',
          category: club.category ?? null,
          emoji: club.emoji ?? null,
          coverImage: sanitizeMediaUrl(club.cover_image),
          membersCount: club.members_count ?? 0,
          locationLabel: club.location_label ?? null,
          countryIso: clubIso,
          isVerified: Boolean(club.is_verified),
          inArea: true,
          hasExactCoords: false,
        },
      });
    }
  }

  return {
    clubs: {
      type: 'FeatureCollection',
      features: clubFeatures,
    },
    events: { type: 'FeatureCollection', features: eventFeatures },
  };
}

async function loadPublicStories(
  south: number,
  west: number,
  north: number,
  east: number,
  blockedIds: Set<string>,
): Promise<GeoJsonFeatureCollection> {
  const nowIso = new Date().toISOString();
  const db = createServiceClient();
  if (!db) {
    return emptyFeatureCollection();
  }

  const { data, error } = await db
    .from('post_stories')
    .select(
      'id, author_id, club_id, image_url, storage_path, caption, media_type, created_at, expires_at, composition',
    )
    .eq('visibility', 'public')
    .gt('expires_at', nowIso)
    .neq('moderation_state', 'removed')
    .order('created_at', { ascending: false })
    .limit(60);

  if (error || !Array.isArray(data)) {
    return emptyFeatureCollection();
  }

  const inArea: GeoJsonPointFeature[] = [];
  for (const row of data as PublicStoryRow[]) {
    if (row.author_id && blockedIds.has(String(row.author_id))) continue;
    const rawPt = extractPointFromUnknown(row.composition);
    if (!rawPt) continue;
    const [lng, lat] = rawPt;
    if (!inViewportWithPad(lat, lng, south, west, north, east)) continue;

    const imageUrl =
      sanitizeMediaUrl(row.image_url) ??
      (row.storage_path ? `/api/stories/${encodeURIComponent(row.id)}/media` : null);

    inArea.push({
      type: 'Feature',
      id: row.id,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: row.id,
        kind: 'story',
        caption: row.caption ?? null,
        mediaType: row.media_type ?? 'image',
        imageUrl,
        createdAt: row.created_at ?? null,
        expiresAt: row.expires_at ?? null,
        inArea: true,
        hasExactCoords: true,
      },
    });
  }

  return { type: 'FeatureCollection', features: inArea };
}

function deterministicBottleOffset(id: string): [number, number] {
  // FNV-1a 32-bit hash split across two 16-bit channels -> deterministic ±0.18° offset.
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const u1 = ((hash >>> 0) & 0xffff) / 0xffff;
  const u2 = ((hash >>> 16) & 0xffff) / 0xffff;
  const dLng = (u1 * 2 - 1) * 0.18;
  const dLat = (u2 * 2 - 1) * 0.18;
  return [dLng, dLat];
}

function hasSupabaseAuthCookie(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return false;
  return /\b(?:sb-[^=;\s]+-auth-token|supabase-auth-token)\b/i.test(cookieHeader);
}

function clampFallbackPointToCountry(
  iso: string,
  lng: number,
  lat: number,
): [number, number] {
  const bounds = SAFE_COUNTRY_BOUNDS[iso];
  if (!bounds) {
    return [
      Math.max(-180, Math.min(180, lng)),
      Math.max(-85, Math.min(85, lat)),
    ];
  }
  const [minLng, minLat, maxLng, maxLat] = bounds;
  return [
    Math.max(minLng, Math.min(maxLng, lng)),
    Math.max(minLat, Math.min(maxLat, lat)),
  ];
}

function resolveBottleFallbackPoint(
  iso: string,
  seedId: string,
  centroidByIso: Map<string, [number, number]>,
): [number, number] | null {
  const safeCentroid = SAFE_COUNTRY_CENTROIDS[iso];
  const dbCentroid = safeCentroid ? undefined : centroidByIso.get(iso);
  const fallbackCentroid = safeCentroid || dbCentroid ? null : getCountryCoordinates(iso);

  const baseLng = safeCentroid
    ? safeCentroid[0]
    : dbCentroid
      ? dbCentroid[0]
      : (fallbackCentroid?.lng ?? null);
  const baseLat = safeCentroid
    ? safeCentroid[1]
    : dbCentroid
      ? dbCentroid[1]
      : (fallbackCentroid?.lat ?? null);

  if (baseLng === null || baseLat === null) return null;

  // Tight deterministic jitter (±0.08°) so centroid-only bottles separate cleanly without leaving the country
  const [rawDLng, rawDLat] = deterministicBottleOffset(seedId);
  const scale = 0.08 / 0.18;
  return clampFallbackPointToCountry(iso, baseLng + rawDLng * scale, baseLat + rawDLat * scale);
}

function normalizeBottleDedupKey(row: PublicBottleRow): string {
  const owner = typeof row.owner_id === 'string' ? row.owner_id.trim().toLowerCase() : '';
  const name = typeof row.name === 'string'
    ? row.name.trim().toLowerCase().replace(/\s+/g, ' ')
    : '';
  return `${owner}::${name}`;
}

async function fetchPublicBottleRows(): Promise<PublicBottleRow[]> {
  const baseQuery =
    'travel_groups?select=id,name,description,country_iso,departure_date,return_date,max_members,min_trust_score,mixite,owner_id,created_at' +
    '&visibility=eq.public&order=created_at.desc&limit=80';
  const extendedQuery =
    'travel_groups?select=id,name,description,destination,country_iso,departure_date,return_date,max_members,min_trust_score,mixite,owner_id,created_at,lat,lng,place_label' +
    '&visibility=eq.public&order=created_at.desc&limit=80';

  try {
    return await pgrest<PublicBottleRow[]>(extendedQuery, { revalidate: 120 });
  } catch (err) {
    const status =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status?: unknown }).status)
        : null;
    // Fallback cleanly if remote Postgres schema does not yet expose lat/lng/place_label
    if (status === 400 || status === 404 || status === null) {
      return await pgrest<PublicBottleRow[]>(baseQuery, { revalidate: 120 });
    }
    throw err;
  }
}

async function loadPublicBottles(
  south: number,
  west: number,
  north: number,
  east: number,
  blockedIds: Set<string>,
  centroidByIso: Map<string, [number, number]>,
  _isoFilter?: string | null,
): Promise<GeoJsonFeatureCollection> {
  const rows = await fetchPublicBottleRows();

  type CandidateBottle = {
    row: PublicBottleRow;
    iso: string;
    lng: number;
    lat: number;
    inArea: boolean;
    hasExactCoords: boolean;
  };

  // Deduplicate by normalized (owner_id + name), preferring rows with exact coordinates and newest first
  const deduped = new Map<string, CandidateBottle>();

  for (const row of rows ?? []) {
    if (!row.id) continue;
    if (row.owner_id && blockedIds.has(String(row.owner_id))) continue;

    const iso = typeof row.country_iso === 'string' ? row.country_iso.trim().toUpperCase() : '';
    const rawLat = asFiniteNumber(row.lat);
    const rawLng = asFiniteNumber(row.lng);
    const hasExactCoords =
      rawLat !== null &&
      rawLng !== null &&
      rawLat >= -90 &&
      rawLat <= 90 &&
      rawLng >= -180 &&
      rawLng <= 180 &&
      !(rawLat === 0 && rawLng === 0);

    let lng: number;
    let lat: number;

    if (hasExactCoords) {
      lng = rawLng;
      lat = rawLat;
    } else {
      if (!iso) continue;
      const fallbackPt = resolveBottleFallbackPoint(iso, String(row.id), centroidByIso);
      if (!fallbackPt) continue;
      [lng, lat] = fallbackPt;
    }

    if (!inViewportWithPad(lat, lng, south, west, north, east)) {
      continue;
    }

    const candidate: CandidateBottle = {
      row,
      iso: iso || 'FR',
      lng,
      lat,
      inArea: true,
      hasExactCoords,
    };

    const dedupKey = normalizeBottleDedupKey(row);
    const existing = deduped.get(dedupKey);
    if (!existing) {
      deduped.set(dedupKey, candidate);
    } else if (!existing.hasExactCoords && candidate.hasExactCoords) {
      deduped.set(dedupKey, candidate);
    }
  }

  const matched = Array.from(deduped.values());
  if (matched.length === 0) {
    return emptyFeatureCollection();
  }

  const ownerIds = Array.from(
    new Set(matched.map((m) => m.row.owner_id).filter((id): id is string => Boolean(id))),
  );
  const serviceDb = createServiceClient();

  const [statsRows, ownerProfilesRes] = await Promise.all([
    rpc<GroupPublicCardStatRow[]>(
      'group_public_card_stats',
      { p_group_ids: matched.map((item) => item.row.id) },
      120,
    ).catch(() => [] as GroupPublicCardStatRow[]),
    serviceDb && ownerIds.length > 0
      ? serviceDb
          .from('user_profiles')
          .select('id, full_name, avatar_url')
          .in('id', ownerIds.slice(0, 80))
          .then((r) => r.data ?? [], () => [] as Array<{ id: string; full_name: string | null; avatar_url: string | null }>)
      : Promise.resolve([] as Array<{ id: string; full_name: string | null; avatar_url: string | null }>),
  ]);

  const ownerById = new Map<string, { name: string | null; avatar: string | null }>();
  for (const prof of ownerProfilesRes) {
    if (!prof?.id) continue;
    ownerById.set(String(prof.id), {
      name: typeof prof.full_name === 'string' && prof.full_name.trim() ? prof.full_name.trim() : null,
      avatar: sanitizeMediaUrl(prof.avatar_url),
    });
  }

  const activeMembersByGroup = new Map<string, number>();
  for (const stat of statsRows ?? []) {
    if (!stat?.group_id) continue;
    const count = asFiniteNumber(stat.active_members);
    if (count !== null && count >= 0) {
      activeMembersByGroup.set(stat.group_id, Math.trunc(count));
    }
  }

  const features: GeoJsonPointFeature[] = matched.map(
    ({ row, iso, lng, lat, inArea: itemInArea, hasExactCoords }) => {
      const maxMembers =
        typeof row.max_members === 'number' && Number.isFinite(row.max_members) && row.max_members > 0
          ? row.max_members
          : 12;
      const activeMembersCount = activeMembersByGroup.get(row.id) ?? 0;
      const spotsLeft = Math.max(0, maxMembers - activeMembersCount);
      const owner = row.owner_id ? ownerById.get(String(row.owner_id)) : undefined;
      const placeLabel =
        typeof row.place_label === 'string' && row.place_label.trim()
          ? row.place_label.trim()
          : typeof row.destination === 'string' && row.destination.trim()
            ? row.destination.trim()
            : null;

      return {
        type: 'Feature',
        id: row.id,
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          id: row.id,
          kind: 'bottle',
          name: row.name ?? 'Bouteille à la mer',
          description: row.description ?? null,
          destination: placeLabel,
          countryIso: iso,
          departureDate: row.departure_date ?? null,
          returnDate: row.return_date ?? null,
          maxMembers,
          minTrustScore: row.min_trust_score ?? 50,
          mixite: row.mixite ?? null,
          ownerId: row.owner_id ?? null,
          ownerName: owner?.name ?? null,
          ownerAvatarUrl: owner?.avatar ?? null,
          activeMembersCount,
          spotsLeft,
          inArea: itemInArea,
          hasExactCoords,
        },
      };
    },
  );

  return { type: 'FeatureCollection', features };
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    south: sp.get('south'),
    west: sp.get('west'),
    north: sp.get('north'),
    east: sp.get('east'),
    kinds: sp.get('kinds') ?? undefined,
    iso: sp.get('iso') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Paramètres géographiques invalides',
        meta: buildApiMeta({
          source: 'lkdv-social-map',
          attribution: 'Le Kit du Voyageur',
          stale: false,
          warning: 'Paramètres bbox invalides',
        }),
      },
      { status: 400 },
    );
  }

  const kinds = parseKinds(parsed.data.kinds);
  const wantsFriends = kinds.has('friends');
  const wantsBottles = kinds.has('bottles');
  const clamped = clampBbox(
    parsed.data.south,
    parsed.data.west,
    parsed.data.north,
    parsed.data.east,
    40,
  );

  // Strict privacy gate: `friends` REQUIRES authenticated session and private, no-store caching.
  // When `bottles` (or `stories`) is requested with a Supabase session cookie, resolve the viewer
  // and load `user_blocks` fail-closed (503 on DB error) so blocked users never leak.
  let viewerId: string | null = null;
  const blockedIds = new Set<string>();
  let authClient: Awaited<ReturnType<typeof createClient>> | null = null;

  const empty503Payload = () =>
    NextResponse.json(
      {
        carnets: emptyFeatureCollection(),
        clubs: emptyFeatureCollection(),
        stories: emptyFeatureCollection(),
        events: emptyFeatureCollection(),
        friends: emptyFeatureCollection(),
        bottles: emptyFeatureCollection(),
        counts: { carnets: 0, clubs: 0, stories: 0, events: 0, friends: 0, bottles: 0 },
        meta: buildApiMeta({
          source: 'lkdv-social-map',
          attribution: 'Le Kit du Voyageur',
          stale: false,
          warning: 'Vérification des blocages indisponible',
        }),
      },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );

  const loadBlocksFailClosed = async (
    uid: string,
    client: Awaited<ReturnType<typeof createClient>>,
  ): Promise<boolean> => {
    try {
      const blocksDb = createServiceClient() ?? client;
      const { data: blockRows, error: blockErr } = await blocksDb
        .from('user_blocks')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`)
        .limit(500);
      if (blockErr) {
        throw blockErr;
      }
      for (const row of blockRows ?? []) {
        const blocker = String(row.blocker_id ?? '');
        const blocked = String(row.blocked_id ?? '');
        if (blocker && blocker !== uid) blockedIds.add(blocker);
        if (blocked && blocked !== uid) blockedIds.add(blocked);
      }
      return true;
    } catch {
      return false;
    }
  };

  if (wantsFriends) {
    try {
      authClient = await createClient();
      const {
        data: { user },
        error: authError,
      } = await authClient.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          {
            error: 'Authentification requise pour consulter les amis sur la carte.',
            code: 'AUTH_REQUIRED',
            meta: buildApiMeta({
              source: 'lkdv-social-map',
              attribution: 'Le Kit du Voyageur',
              stale: false,
              warning: 'Session authentifiée requise pour le calque amis',
            }),
          },
          { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
        );
      }
      viewerId = user.id;
    } catch {
      return NextResponse.json(
        {
          error: 'Authentification requise pour consulter les amis sur la carte.',
          code: 'AUTH_REQUIRED',
          meta: buildApiMeta({
            source: 'lkdv-social-map',
            attribution: 'Le Kit du Voyageur',
            stale: false,
            warning: 'Vérification de session indisponible',
          }),
        },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    // Load mutual blocks (`user_blocks`) so blocked or blocking users are strictly excluded.
    // Fail-closed: any DB/RLS error aborts the query with 503 rather than leaking a blocked user.
    const blocksOk = await loadBlocksFailClosed(viewerId, authClient);
    if (!blocksOk) {
      return empty503Payload();
    }
  } else if ((wantsBottles || kinds.has('stories')) && hasSupabaseAuthCookie(request)) {
    try {
      authClient = await createClient();
      const {
        data: { user },
        error: authError,
      } = await authClient.auth.getUser();
      if (!authError && user) {
        viewerId = user.id;
      }
    } catch {
      // Unreadable or expired cookie: treat as unauthenticated unless a verified session exists.
      viewerId = null;
    }

    if (viewerId && authClient) {
      const blocksOk = await loadBlocksFailClosed(viewerId, authClient);
      if (!blocksOk) {
        return empty503Payload();
      }
    }
  }

  const warnings: string[] = [];

  const loadFriends = async (): Promise<GeoJsonFeatureCollection> => {
    if (!wantsFriends || !viewerId || !authClient) {
      return emptyFeatureCollection();
    }

    const db = createServiceClient() ?? authClient;

    // Authorization gate: only show users with a MUTUAL follow relationship OR shared club membership.
    const [followingRes, followersRes, myClubsRes] = await Promise.all([
      authClient
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', viewerId)
        .limit(300),
      db
        .from('user_follows')
        .select('follower_id')
        .eq('following_id', viewerId)
        .limit(300),
      authClient
        .from('club_members')
        .select('club_id')
        .eq('user_id', viewerId)
        .limit(100),
    ]);

    const followingSet = new Set(
      (followingRes.data ?? []).map((r) => String(r.following_id ?? '')).filter(Boolean),
    );
    const mutualIds = new Set<string>();
    for (const r of followersRes.data ?? []) {
      const fid = String(r.follower_id ?? '');
      if (fid && followingSet.has(fid)) {
        mutualIds.add(fid);
      }
    }

    const sharedClubMemberIds = new Set<string>();
    const myClubIds = (myClubsRes.data ?? [])
      .map((r) => String(r.club_id ?? ''))
      .filter(Boolean);
    if (myClubIds.length > 0) {
      const { data: clubPeers } = await db
        .from('club_members')
        .select('user_id')
        .in('club_id', myClubIds.slice(0, 50))
        .limit(400);
      for (const peer of clubPeers ?? []) {
        const pid = String(peer.user_id ?? '');
        if (pid && pid !== viewerId) {
          sharedClubMemberIds.add(pid);
        }
      }
    }

    const authorizedSet = new Set<string>([...mutualIds, ...sharedClubMemberIds]);
    const candidateIds = Array.from(authorizedSet).filter(
      (id) => id.length > 0 && id !== viewerId && !blockedIds.has(id),
    );

    if (candidateIds.length === 0) {
      return emptyFeatureCollection();
    }

    const { data: profiles, error: profErr } = await db
      .from('user_profiles')
      .select('id, full_name, handle, avatar_url, share_club_location, last_lat, last_lng')
      .in('id', candidateIds.slice(0, 200))
      .eq('share_club_location', true);

    if (profErr || !Array.isArray(profiles)) {
      warnings.push('Positions amis temporairement indisponibles');
      return emptyFeatureCollection();
    }

    const nowMs = Date.now();
    const features: GeoJsonPointFeature[] = [];

    for (const prof of profiles) {
      const uid = String(prof.id ?? '');
      if (!uid || uid === viewerId || blockedIds.has(uid)) continue;
      if (prof.share_club_location !== true) continue;

      const lat = asFiniteNumber(prof.last_lat);
      const lng = asFiniteNumber(prof.last_lng);
      if (lat === null || lng === null) continue;

      // Keyed HMAC-SHA256 >= 250m privacy jitter rotated every hour bucket.
      // MUST run BEFORE bbox filtering to prevent a bbox binary-search oracle from leaking exact GPS.
      const fuzzed = fuzzLocation250mHmac(lat, lng, uid, nowMs);
      if (
        !inBbox(
          fuzzed.lat,
          fuzzed.lng,
          clamped.south,
          clamped.west,
          clamped.north,
          clamped.east,
          0.01,
        )
      ) {
        continue;
      }
      const displayName =
        typeof prof.full_name === 'string' && prof.full_name.trim()
          ? prof.full_name.trim()
          : 'Explorateur';

      features.push({
        type: 'Feature',
        id: uid,
        geometry: { type: 'Point', coordinates: [fuzzed.lng, fuzzed.lat] },
        properties: {
          id: uid,
          kind: 'friend',
          name: displayName,
          handle: typeof prof.handle === 'string' ? prof.handle : null,
          avatarUrl: sanitizeHttpsUrl(
            typeof prof.avatar_url === 'string' ? prof.avatar_url : null,
          ),
          fuzzy: true,
          fuzzyRadiusM: fuzzed.fuzzyRadiusM,
        },
      });
    }

    return { type: 'FeatureCollection', features };
  };

  const isoFilter = parsed.data.iso ? parsed.data.iso.toUpperCase() : null;
  const needsCentroids = kinds.has('carnets') || kinds.has('clubs') || wantsBottles;
  const centroidByIso = needsCentroids ? await loadCentroidByIso() : new Map<string, [number, number]>();

  const [carnetsRes, clubsEventsRes, storiesRes, friendsRes, bottlesRes] = await Promise.allSettled([
    kinds.has('carnets')
      ? loadPublicCarnets(
          clamped.south,
          clamped.west,
          clamped.north,
          clamped.east,
          centroidByIso,
          isoFilter,
        )
      : Promise.resolve(emptyFeatureCollection()),
    kinds.has('clubs') || kinds.has('events')
      ? loadPublicClubsAndEvents(
          clamped.south,
          clamped.west,
          clamped.north,
          clamped.east,
          kinds.has('clubs'),
          kinds.has('events'),
          centroidByIso,
          isoFilter,
        )
      : Promise.resolve({
          clubs: emptyFeatureCollection(),
          events: emptyFeatureCollection(),
        }),
    kinds.has('stories')
      ? loadPublicStories(
          clamped.south,
          clamped.west,
          clamped.north,
          clamped.east,
          blockedIds,
        )
      : Promise.resolve(emptyFeatureCollection()),
    loadFriends(),
    wantsBottles
      ? loadPublicBottles(
          clamped.south,
          clamped.west,
          clamped.north,
          clamped.east,
          blockedIds,
          centroidByIso,
          isoFilter,
        )
      : Promise.resolve(emptyFeatureCollection()),
  ]);

  const carnets =
    carnetsRes.status === 'fulfilled'
      ? carnetsRes.value
      : (warnings.push('Carnets indisponibles'), emptyFeatureCollection());
  const clubs =
    clubsEventsRes.status === 'fulfilled'
      ? clubsEventsRes.value.clubs
      : (warnings.push('Clubs indisponibles'), emptyFeatureCollection());
  const events =
    clubsEventsRes.status === 'fulfilled'
      ? clubsEventsRes.value.events
      : emptyFeatureCollection();
  const stories =
    storiesRes.status === 'fulfilled'
      ? storiesRes.value
      : (warnings.push('Stories indisponibles'), emptyFeatureCollection());
  const friends =
    friendsRes.status === 'fulfilled'
      ? friendsRes.value
      : (warnings.push('Amis indisponibles'), emptyFeatureCollection());
  const bottles =
    bottlesRes.status === 'fulfilled'
      ? bottlesRes.value
      : (warnings.push('Bouteilles indisponibles'), emptyFeatureCollection());

  const isPrivateResponse = wantsFriends || Boolean(viewerId);

  const payload: SocialMapPayload = {
    carnets,
    clubs,
    stories,
    events,
    friends,
    bottles,
    counts: {
      carnets: carnets.features.length,
      clubs: clubs.features.length,
      stories: stories.features.length,
      events: events.features.length,
      friends: friends.features.length,
      bottles: bottles.features.length,
    },
    meta: buildApiMeta({
      source: 'lkdv-social-map',
      attribution: 'Communauté Le Kit du Voyageur',
      stale: false,
      ttlMs: isPrivateResponse ? undefined : 120_000,
      warning: warnings.length > 0 ? warnings.join(' · ') : undefined,
    }),
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': isPrivateResponse
        ? 'private, no-store'
        : 'public, s-maxage=120, stale-while-revalidate=300',
    },
  });
}
