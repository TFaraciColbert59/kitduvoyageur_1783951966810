import type { SupabaseClient } from '@supabase/supabase-js';
import type { TraceProjectionError } from '../domain/traceProjection';
import {
  averagePaceMinPerKm,
  movingTimeSeconds,
  observedMaxAltitudeM,
  projectOutingMetrics,
  projectTraceMetrics,
  resolveOutingMetricVisibility,
  type OutingMetricVisibility,
} from '../domain/metricVisibility';
import {
  isFollowerTraceVisibility,
  projectTraceSampleSegments,
  resolveTraceMasks,
  type TraceViewer,
} from './tracePrivacy';
import {
  loadOutingWeather,
  parseStoredWeather,
  weatherForViewer,
  type OutingWeather,
} from './weather';

/**
 * Drawer Sortie — lecture et écriture des données réelles.
 *
 * Aucune valeur inventée : une sortie sans titre, sans photo ou sans météo
 * expose `null` / `[]`, et l'UI affiche son état vide. Les écritures sont
 * bornées au propriétaire par la RLS (`own_sessions`, policies filles) et par
 * un filtre `user_id` explicite côté serveur.
 */

export type OutingStatus = 'planned' | 'ongoing' | 'done';
export type OutingVisibility = 'private' | 'collective_anonymized';

export interface OutingPoint {
  lat: number;
  lng: number;
  elevationM: number | null;
  timestamp: string | null;
}

export interface OutingPhoto {
  id: string;
  url: string;
  caption: string | null;
  position: number;
}

export interface OutingParticipant {
  id: string;
  userId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  role: string;
  isOwner: boolean;
}

export interface OutingGearItem {
  id: string;
  name: string;
  weightG: number | null;
  kitId: string | null;
  photoUrl?: string | null;
  category?: string | null;
  condition?: string | null;
  inventoryStatus?: string | null;
  listingMode?: string | null;
  isLent?: boolean;
  priceCents?: number | null;
}

export interface OutingKit {
  id: string;
  name: string;
  totalWeightG: number | null;
  items: { name: string; weightG: number | null }[];
}

export interface OutingComment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; handle: string; avatarUrl: string | null };
  mine: boolean;
}

export interface OutingKudos {
  count: number;
  mine: boolean;
  users: { id: string; name: string; avatarUrl: string | null }[];
}

export interface OutingDetail {
  id: string;
  title: string;
  date: string | null;
  startedAt: string | null;
  endedAt: string | null;
  massif: string | null;
  routeName: string | null;
  /** Métriques projetées : `null` signifie masquée ou réellement absente. */
  km: number | null;
  dplus: number | null;
  maxAlt: number | null;
  durationS: number | null;
  /** Allure calculée côté serveur, jamais recalculée par le client. */
  paceMinPerKm: number | null;
  movingTimeS: number | null;
  heartRateBpm: number | null;
  powerW: number | null;
  cadenceRpm: number | null;
  caloriesKcal: number | null;
  /** Politique appliquée ; permet à l'UI de ne rien dériver d'une métrique masquée. */
  metricVisibility: OutingMetricVisibility;
  metricsMasked: boolean;
  status: OutingStatus;
  visibility: OutingVisibility;
  verified: boolean;
  coverUrl: string | null;
  notes: string;
  weather: OutingWeather | null;
  photos: OutingPhoto[];
  participants: OutingParticipant[];
  gear: OutingGearItem[];
  kit: OutingKit | null;
  missingGear: number;
  kudos: OutingKudos;
  comments: OutingComment[];
  /**
   * Trace brute du propriétaire. Vide pour un visiteur : la seule source
   * affichable/exportable est alors `traceSegments`, afin qu'un consommateur
   * qui tracerait `points` d'un seul trait ne puisse pas recoller une coupure.
   */
  points: OutingPoint[];
  /** Morceaux visibles, jamais recollés à travers un masque. */
  traceSegments: OutingPoint[][];
  traceMasked: boolean;
  traceFullyMasked: boolean;
  traceError: TraceProjectionError;
  canEdit: boolean;
}

type SessionRow = {
  id: string;
  user_id: string;
  route_id: number | null;
  title: string | null;
  started_at: string | null;
  ended_at: string | null;
  distance_km: number | string | null;
  duration_seconds: number | null;
  elevation_gain_m: number | string | null;
  max_altitude_m: number | null;
  positions_timed: unknown;
  positions_geojson: unknown;
  visibility: string | null;
  kit_id: string | null;
  weather: unknown;
  notes: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
};

const PROFILE_COLUMNS = 'id, full_name, handle, avatar_url';

function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function normalizeVisibility(value: unknown): OutingVisibility {
  // Contrainte réelle : `private` ou `collective_anonymized` uniquement.
  // On ne prétend jamais qu'une sortie est publique si la base ne le permet pas.
  return value === 'collective_anonymized' ? 'collective_anonymized' : 'private';
}

export function computeStatus(row: Pick<SessionRow, 'started_at' | 'ended_at'>, now = Date.now()): OutingStatus {
  const start = row.started_at ? Date.parse(row.started_at) : NaN;
  const end = row.ended_at ? Date.parse(row.ended_at) : NaN;
  if (Number.isFinite(start) && start > now) return 'planned';
  if (Number.isFinite(end) && end > now) return 'ongoing';
  return 'done';
}

function pointFromCoordinate(coordinate: unknown): OutingPoint | null {
  if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
  const lng = numericOrNull(coordinate[0]);
  const lat = numericOrNull(coordinate[1]);
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    lat,
    lng,
    elevationM: coordinate.length > 2 ? numericOrNull(coordinate[2]) : null,
    timestamp: null,
  };
}

function geojsonSegments(value: unknown): OutingPoint[][] {
  if (!value || typeof value !== 'object') return [];
  const geometry = value as {
    type?: unknown;
    coordinates?: unknown;
    geometry?: unknown;
  };
  if (geometry.type === 'Feature') return geojsonSegments(geometry.geometry);

  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    const points = geometry.coordinates
      .map(pointFromCoordinate)
      .filter((point): point is OutingPoint => point !== null);
    return points.length > 0 ? [points] : [];
  }

  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates
      .map((line) => {
        if (!Array.isArray(line)) return [];
        return line
          .map(pointFromCoordinate)
          .filter((point): point is OutingPoint => point !== null);
      })
      .filter((segment) => segment.length > 0);
  }

  return [];
}

/**
 * Deux formats coexistent en base : `positions_timed` (échantillons horodatés
 * `{lat,lng,timestamp,elevationM}`) et `positions_geojson` (LineString ou
 * MultiLineString). Les morceaux d'un MultiLineString restent séparés : une
 * frontière n'est jamais recollée.
 */
export function parsePositionSegments(timed: unknown, geojson: unknown): OutingPoint[][] {
  const timedPoints: OutingPoint[] = [];

  if (Array.isArray(timed)) {
    for (const sample of timed) {
      if (!sample || typeof sample !== 'object') continue;
      const row = sample as Record<string, unknown>;
      const lat = numericOrNull(row.lat ?? row.latitude);
      const lng = numericOrNull(row.lng ?? row.lon ?? row.longitude);
      if (lat === null || lng === null) continue;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      timedPoints.push({
        lat,
        lng,
        elevationM: numericOrNull(row.elevationM ?? row.altitude ?? row.ele),
        timestamp: typeof row.timestamp === 'string' ? row.timestamp : null,
      });
    }
  }

  if (timedPoints.length > 0) return [timedPoints];
  return geojsonSegments(geojson);
}

/** Points aplatis, pour les consommateurs qui ne dessinent pas de morceaux. */
export function parsePositions(timed: unknown, geojson: unknown): OutingPoint[] {
  return parsePositionSegments(timed, geojson).flat();
}

function displayName(profile: ProfileRow | undefined, fallbackId: string) {
  return (
    profile?.full_name?.trim() ||
    profile?.handle?.trim() ||
    `Voyageur ${fallbackId.slice(0, 4)}`
  );
}

function displayHandle(profile: ProfileRow | undefined, fallbackId: string) {
  return profile?.handle?.trim() || fallbackId.slice(0, 8);
}

/**
 * Vérifie une relation de suivi réelle avant d'accorder le rôle `follower`.
 * La visibilité `friends`/`followers` seule ne prouve jamais l'autorisation.
 */
async function viewerFollowsOwner(
  supabase: SupabaseClient,
  viewerId: string,
  ownerId: string | null
): Promise<boolean> {
  if (!viewerId || !ownerId || viewerId === ownerId) return false;
  const { data } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('follower_id', viewerId)
    .eq('following_id', ownerId)
    .maybeSingle();
  return Boolean((data as { follower_id?: string | null } | null)?.follower_id);
}

function firstCoordinate(points: OutingPoint[]): { lat: number; lon: number } | null {
  if (points.length === 0) return null;
  return { lat: points[0].lat, lon: points[0].lng };
}

async function signedPhotoUrl(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  const { data, error } = await supabase.storage
    .from('outing-media')
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function loadOutingDetail(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  options?: {
    /**
     * Politique déjà lue dans un stockage de confiance (propriétaire de la
     * ligne). Ne jamais lui passer une valeur de requête brute : la résolution
     * reste fail-closed, mais l'autorisation de la lire appartient à l'appelant.
     */
    metricPolicy?: unknown;
  }
): Promise<OutingDetail | null> {
  const { data: sessionData, error: sessionError } = await supabase
    .from('hike_sessions')
    .select(
      'id,user_id,route_id,title,started_at,ended_at,distance_km,duration_seconds,elevation_gain_m,max_altitude_m,positions_timed,positions_geojson,visibility,kit_id,weather,notes'
    )
    .eq('id', outingId)
    .maybeSingle();

  if (sessionError || !sessionData) return null;
  const session = sessionData as SessionRow;
  const canEdit = session.user_id === userId;

  const [routeRes, photoRes, participantRes, gearRes, kudosRes, commentRes] = await Promise.all([
    session.route_id
      ? supabase.from('hiking_routes').select('id,name,region').eq('id', session.route_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('hike_session_photos')
      .select('id,storage_path,caption,position')
      .eq('session_id', session.id)
      .order('position', { ascending: true }),
    supabase
      .from('hike_session_participants')
      .select('user_id,role')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('hike_session_gear')
      .select('id,item_name,weight_g,kit_id')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('hike_session_kudos')
      .select('user_id')
      .eq('session_id', session.id),
    supabase
      .from('hike_session_comments')
      .select('id,user_id,body,created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true }),
  ]);

  const route = routeRes.data as { name?: string | null; region?: string | null } | null;

  const photoRows = (photoRes.data ?? []) as Array<{
    id: string;
    storage_path: string;
    caption: string | null;
    position: number | null;
  }>;
  const photos: OutingPhoto[] = [];
  for (const row of photoRows) {
    const url = await signedPhotoUrl(supabase, row.storage_path);
    if (!url) continue;
    photos.push({
      id: row.id,
      url,
      caption: row.caption,
      position: Number(row.position ?? 0),
    });
  }

  const participantRows = (participantRes.data ?? []) as Array<{
    user_id: string;
    role: string | null;
  }>;
  const kudosRows = (kudosRes.data ?? []) as Array<{ user_id: string }>;
  const commentRows = (commentRes.data ?? []) as Array<{
    id: string;
    user_id: string;
    body: string;
    created_at: string;
  }>;

  const profileIds = [
    ...new Set([
      session.user_id,
      ...participantRows.map((row) => row.user_id),
      ...kudosRows.map((row) => row.user_id),
      ...commentRows.map((row) => row.user_id),
    ]),
  ].filter(Boolean);

  const profilesRes = profileIds.length
    ? await supabase.from('public_profiles').select(PROFILE_COLUMNS).in('id', profileIds)
    : { data: [] as ProfileRow[], error: null };
  const profiles = new Map<string, ProfileRow>(
    ((profilesRes.data ?? []) as ProfileRow[]).map((row) => [row.id, row])
  );

  const ownerRow = profiles.get(session.user_id);
  const participants: OutingParticipant[] = [];
  participants.push({
    id: `owner_${session.user_id}`,
    userId: session.user_id,
    name: displayName(ownerRow, session.user_id),
    handle: displayHandle(ownerRow, session.user_id),
    avatarUrl: ownerRow?.avatar_url ?? null,
    role: 'organisateur',
    isOwner: true,
  });
  for (const row of participantRows) {
    if (row.user_id === session.user_id) continue;
    const profile = profiles.get(row.user_id);
    participants.push({
      // La table n'a pas d'id : la clé est (session_id, user_id).
      id: row.user_id,
      userId: row.user_id,
      name: displayName(profile, row.user_id),
      handle: displayHandle(profile, row.user_id),
      avatarUrl: profile?.avatar_url ?? null,
      role: row.role === 'guest' ? 'invité' : row.role || 'invité',
      isOwner: false,
    });
  }

  const kitRes = session.kit_id
    ? await supabase
        .from('materiel_kits')
        .select('id,name,total_weight_g')
        .eq('id', session.kit_id)
        .maybeSingle()
    : { data: null, error: null };
  const kitRow = kitRes.data as { id: string; name: string | null; total_weight_g: number | null } | null;
  const kitItemsRes = session.kit_id
    ? await supabase
        .from('materiel_kit_items')
        .select('name,weight_g')
        .eq('kit_id', session.kit_id)
        .order('created_at', { ascending: true })
    : { data: [] as Array<{ name: string | null; weight_g: number | null }>, error: null };
  const kitItems = (kitItemsRes.data ?? []).map((row) => ({
    name: row.name?.trim() || 'Objet',
    weightG: row.weight_g,
  }));
  const kit: OutingKit | null = kitRow
    ? {
        id: kitRow.id,
        name: kitRow.name?.trim() || 'Kit',
        totalWeightG: kitRow.total_weight_g,
        items: kitItems,
      }
    : null;

  const gearRows = (gearRes.data ?? []) as Array<{
    id: string;
    item_name: string;
    weight_g: number | null;
    kit_id: string | null;
  }>;
  const productByName = new Map<
    string,
    {
      photo_url: string | null;
      category: string | null;
      condition: string | null;
      status: string | null;
      listing_mode: string | null;
      is_lent: boolean | null;
      price_cents: number | null;
    }
  >();
  if (canEdit && gearRows.length > 0) {
    const names = Array.from(new Set(gearRows.map((row) => row.item_name.trim()))).filter(Boolean);
    if (names.length > 0) {
      const { data: products } = await supabase
        .from('product_ownership')
        .select('name,photo_url,category,condition,status,listing_mode,is_lent,price_cents')
        .eq('user_id', userId)
        .in('name', names);
      for (const product of (products ?? []) as Array<{
        name: string;
        photo_url: string | null;
        category: string | null;
        condition: string | null;
        status: string | null;
        listing_mode: string | null;
        is_lent: boolean | null;
        price_cents: number | null;
      }>) {
        productByName.set(product.name.trim().toLowerCase(), product);
      }
    }
  }
  const gear: OutingGearItem[] = gearRows.map((row) => {
    const product = productByName.get(row.item_name.trim().toLowerCase());
    return {
      id: row.id,
      name: row.item_name,
      weightG: row.weight_g,
      kitId: row.kit_id,
      photoUrl: product?.photo_url ?? null,
      category: product?.category ?? null,
      condition: product?.condition ?? null,
      inventoryStatus: product?.status ?? null,
      listingMode: product?.listing_mode ?? null,
      isLent: product?.is_lent === true,
      priceCents: product?.price_cents ?? null,
    };
  });

  const gearNames = new Set(
    gear.map((item) => item.name.trim().toLowerCase()).filter(Boolean)
  );
  const missingGear =
    gear.length > 0 && kit
      ? kit.items.filter((item) => !gearNames.has(item.name.trim().toLowerCase())).length
      : 0;

  const kudosUsers = kudosRows
    .map((row) => {
      const profile = profiles.get(row.user_id);
      return {
        id: row.user_id,
        name: displayName(profile, row.user_id),
        avatarUrl: profile?.avatar_url ?? null,
      };
    })
    .slice(0, 24);

  const comments: OutingComment[] = commentRows.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      author: {
        id: row.user_id,
        name: displayName(profile, row.user_id),
        handle: displayHandle(profile, row.user_id),
        avatarUrl: profile?.avatar_url ?? null,
      },
      mine: row.user_id === userId,
    };
  });

  const rawSegments = parsePositionSegments(session.positions_timed, session.positions_geojson);
  const rawPoints = rawSegments.flat();
  const rawVisibility = typeof session.visibility === 'string' ? session.visibility : null;
  const visibility = normalizeVisibility(rawVisibility);
  const isOwner = canEdit;
  const isParticipant = participantRows.some((row) => row.user_id === userId);
  /*
   * Le rôle de lecture suit une autorisation réelle : propriétaire, participant
   * inscrit, ou abonné vérifié pour une visibilité `friends`/`followers`.
   * Un visiteur non abonné reste `visitor` même si la ligne prétend `friends`.
   */
  const viewer: TraceViewer = isOwner
    ? 'owner'
    : isParticipant
      ? 'participant'
      : isFollowerTraceVisibility(rawVisibility) &&
          (await viewerFollowsOwner(supabase, userId, session.user_id))
        ? 'follower'
        : 'visitor';
  const hasFullAccess = viewer === 'owner' || viewer === 'participant';
  /*
   * S6.15 — politique de métriques résolue avant toute projection. Le rôle
   * `viewer` vient d'une autorisation réelle ; la politique par défaut est
   * fail-closed et ne publie le socle agrégé que pour un partage explicite.
   * Aucune politique persistée n'est encore branchée : le point d'extension
   * `policy` est prêt, la migration reste à coordonner.
   */
  const metricVisibility = resolveOutingMetricVisibility({
    viewer,
    visibility: rawVisibility,
    policy: options?.metricPolicy,
  });
  const projection = projectTraceSampleSegments(
    rawSegments,
    resolveTraceMasks({ viewer, visibility: rawVisibility })
  );
  /*
   * Les métadonnées de trace sont retirées quand une métrique masquée
   * permettrait de les déduire (altitude, heure). Les coordonnées, elles, sont
   * déjà projetées par `tracePrivacy` : les deux masquages sont indépendants.
   */
  const traceMetricProjection = projectTraceMetrics(
    projection.segments,
    metricVisibility
  );
  const traceSegments: OutingPoint[][] = traceMetricProjection.segments.map((segment) =>
    segment.map((point) => ({
      lat: point.lat,
      lng: point.lng,
      elevationM: point.elevationM ?? null,
      timestamp: point.timestamp ?? null,
    }))
  );
  const visiblePoints = traceSegments.flat();
  /*
   * Pour un visiteur, `points` reste vide : un ancien consommateur qui ne
   * connaît pas `traceSegments` ne doit pas pouvoir retracer la trace brute.
   * Le propriétaire et les participants gardent leurs points d'origine, avec
   * les mêmes métadonnées projetées.
   */
  const projectedRawPoints =
    projectTraceMetrics([rawPoints], metricVisibility).segments[0] ?? [];
  const points = projection.masked ? [] : projectedRawPoints;

  /*
   * Météo : le propriétaire garde les coordonnées exactes. Un visiteur ne les
   * reçoit jamais, même quand la météo vient du cache stocké — et ne reçoit
   * aucune météo quand la trace est totalement masquée ou ne laisse aucun
   * point visible. Aucun appel tiers n'est fait pour un visiteur.
   */
  const coordinate = firstCoordinate(visiblePoints);
  const stored = parseStoredWeather(session.weather);
  let weather = stored;
  if (hasFullAccess) {
    if (!weather && coordinate) {
      weather = await loadOutingWeather(coordinate.lat, coordinate.lon, session.started_at);
    }
  } else {
    const canSeeStoredWeather =
      !projection.fullyMasked && visiblePoints.length > 0;
    weather = canSeeStoredWeather
      ? weatherForViewer(stored, viewer, rawVisibility)
      : null;
  }

  /*
   * Notes : le propriétaire et les participants les lisent. Un visiteur ne les
   * reçoit que pour une sortie explicitement `collective_anonymized` ; un
   * abonné d'une sortie `friends`/`followers` n'y a pas droit — le partage de
   * la trace ne vaut pas partage du carnet intime.
   */
  const notes =
    hasFullAccess || rawVisibility === 'collective_anonymized' ? text(session.notes) : '';

  /*
   * Valeurs sources calculées avant masquage : la politique décide ensuite de
   * ce qui sort. L'allure et le temps en mouvement ne sont jamais recalculés
   * côté client, sinon une métrique masquée pourrait être redérivée.
   */
  const rawDistanceKm = numericOrNull(session.distance_km);
  const rawDurationS = session.duration_seconds;
  const rawMaxAltitudeM =
    session.max_altitude_m ?? observedMaxAltitudeM(rawPoints);
  const projectedMetrics = projectOutingMetrics(
    {
      distanceKm: rawDistanceKm,
      elevationGainM: numericOrNull(session.elevation_gain_m),
      maxAltitudeM: rawMaxAltitudeM,
      durationS: rawDurationS,
      paceMinPerKm: averagePaceMinPerKm(rawDurationS, rawDistanceKm),
      movingTimeS: movingTimeSeconds(rawPoints),
      /* Aucune source FC/puissance/cadence/calories dans le schéma actuel. */
      heartRateBpm: null,
      powerW: null,
      cadenceRpm: null,
      caloriesKcal: null,
    },
    metricVisibility
  );

  const dateLabel = session.started_at ? session.started_at.slice(0, 10) : null;
  const title =
    session.title?.trim() ||
    route?.name?.trim() ||
    (dateLabel ? `Sortie du ${dateLabel}` : 'Sortie');

  return {
    id: session.id,
    title,
    date: dateLabel,
    startedAt: metricVisibility.duration ? session.started_at : null,
    endedAt: metricVisibility.duration ? session.ended_at : null,
    massif: route?.region?.trim() || route?.name?.trim() || null,
    routeName: route?.name?.trim() || null,
    km: projectedMetrics.distanceKm,
    dplus: projectedMetrics.elevationGainM,
    maxAlt: projectedMetrics.maxAltitudeM,
    durationS: projectedMetrics.durationS,
    paceMinPerKm: projectedMetrics.paceMinPerKm,
    movingTimeS: projectedMetrics.movingTimeS,
    heartRateBpm: projectedMetrics.heartRateBpm,
    powerW: projectedMetrics.powerW,
    cadenceRpm: projectedMetrics.cadenceRpm,
    caloriesKcal: projectedMetrics.caloriesKcal,
    metricVisibility,
    metricsMasked: projectedMetrics.masked,
    status: computeStatus(session),
    visibility,
    verified: traceSegments.some((segment) => segment.length >= 2),
    coverUrl: photos[0]?.url ?? null,
    notes,
    weather,
    photos,
    participants,
    gear,
    kit,
    missingGear,
    kudos: {
      count: kudosRows.length,
      mine: kudosRows.some((row) => row.user_id === userId),
      users: kudosUsers,
    },
    comments,
    points,
    traceSegments,
    traceMasked: projection.masked,
    traceFullyMasked: projection.fullyMasked,
    traceError: projection.error,
    canEdit,
  };
}

async function assertOwner(
  supabase: SupabaseClient,
  userId: string,
  outingId: string
): Promise<SessionRow | null> {
  const { data } = await supabase
    .from('hike_sessions')
    .select('id,user_id,kit_id,title,notes,visibility')
    .eq('id', outingId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as SessionRow | null) ?? null;
}

export async function updateOuting(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  patch: { title?: string; notes?: string; visibility?: OutingVisibility }
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.slice(0, 120);
  if (patch.notes !== undefined) update.notes = patch.notes.slice(0, 2000);
  if (patch.visibility !== undefined) update.visibility = patch.visibility;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from('hike_sessions')
    .update(update)
    .eq('id', outingId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteOuting(
  supabase: SupabaseClient,
  userId: string,
  outingId: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  const { error } = await supabase
    .from('hike_sessions')
    .delete()
    .eq('id', outingId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function toggleKudos(
  supabase: SupabaseClient,
  userId: string,
  outingId: string
): Promise<{ mine: boolean; count: number }> {
  const { data: existing } = await supabase
    .from('hike_session_kudos')
    .select('user_id')
    .eq('session_id', outingId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('hike_session_kudos')
      .delete()
      .eq('session_id', outingId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('hike_session_kudos')
      .insert({ session_id: outingId, user_id: userId });
    if (error) throw error;
  }

  const { count } = await supabase
    .from('hike_session_kudos')
    .select('user_id', { count: 'exact', head: true })
    .eq('session_id', outingId);
  return { mine: !existing, count: count ?? 0 };
}

export async function addComment(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  body: string
): Promise<void> {
  const { error } = await supabase.from('hike_session_comments').insert({
    session_id: outingId,
    user_id: userId,
    body: body.slice(0, 1000),
  });
  if (error) throw error;
}

export async function deleteComment(
  supabase: SupabaseClient,
  userId: string,
  commentId: string
): Promise<void> {
  const { error } = await supabase
    .from('hike_session_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function addParticipant(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  handle: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  const cleaned = handle.trim().replace(/^@/, '');
  if (!cleaned) throw new Error('invalid_handle');

  const { data } = await supabase
    .from('public_profiles')
    .select('id')
    .ilike('handle', cleaned)
    .limit(1)
    .maybeSingle();
  const target = data as { id: string } | null;
  if (!target?.id) throw new Error('not_found');
  if (target.id === userId) throw new Error('self');

  const { error } = await supabase
    .from('hike_session_participants')
    .insert({ session_id: outingId, user_id: target.id, role: 'guest' });
  if (error && !String(error.message).toLowerCase().includes('duplicate')) throw error;
}

export async function removeParticipant(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  participantId: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  const { error } = await supabase
    .from('hike_session_participants')
    .delete()
    .eq('user_id', participantId)
    .eq('session_id', outingId);
  if (error) throw error;
}

export async function attachKitGear(
  supabase: SupabaseClient,
  userId: string,
  outingId: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  if (!owner.kit_id) throw new Error('no_kit');

  const { data: items } = await supabase
    .from('materiel_kit_items')
    .select('name,weight_g')
    .eq('kit_id', owner.kit_id);
  const rows = (items ?? [])
    .map((row: { name: string | null; weight_g: number | null }) => ({
      session_id: outingId,
      kit_id: owner.kit_id,
      item_name: row.name?.trim() || 'Objet',
      weight_g: row.weight_g,
    }))
    .filter((row) => row.item_name.length > 0);
  if (rows.length === 0) throw new Error('empty_kit');

  await supabase.from('hike_session_gear').delete().eq('session_id', outingId);
  const { error } = await supabase.from('hike_session_gear').insert(rows);
  if (error) throw error;
}

export async function removeGear(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  gearId: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  const { error } = await supabase
    .from('hike_session_gear')
    .delete()
    .eq('id', gearId)
    .eq('session_id', outingId);
  if (error) throw error;
}

export async function addPhoto(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  storagePath: string,
  caption?: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  if (!storagePath.trim()) throw new Error('invalid_path');
  const path = storagePath.trim();
  if (!path.startsWith(`${userId}/`) && !/^https?:\/\//i.test(path)) {
    throw new Error('invalid_path');
  }

  const { data: last } = await supabase
    .from('hike_session_photos')
    .select('position')
    .eq('session_id', outingId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = Number((last as { position?: number } | null)?.position ?? -1) + 1;

  const { error } = await supabase.from('hike_session_photos').insert({
    session_id: outingId,
    user_id: userId,
    storage_path: path,
    caption: caption?.slice(0, 200) || null,
    position,
  });
  if (error) throw error;
}

export async function deletePhoto(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  photoId: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  const { data } = await supabase
    .from('hike_session_photos')
    .select('storage_path')
    .eq('id', photoId)
    .eq('session_id', outingId)
    .eq('user_id', userId)
    .maybeSingle();
  const path = (data as { storage_path?: string } | null)?.storage_path;
  const { error } = await supabase
    .from('hike_session_photos')
    .delete()
    .eq('id', photoId)
    .eq('session_id', outingId)
    .eq('user_id', userId);
  if (error) throw error;
  if (path && !/^https?:\/\//i.test(path)) {
    await supabase.storage.from('outing-media').remove([path]).catch(() => undefined);
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Morceaux réellement exportables. `traceSegments` est la source prioritaire :
 * `points` n'est qu'un repli pour les anciens appels de test. Un morceau d'un
 * seul point n'est pas une trace.
 */
export function outingTraceSegments(
  detail: Pick<OutingDetail, 'traceSegments' | 'points'>
): OutingPoint[][] {
  const segments = Array.isArray(detail.traceSegments)
    ? detail.traceSegments
    : detail.traceSegments === undefined
      ? [detail.points]
      : [];
  return segments.filter((segment) => segment.length >= 2);
}

/** GPX 1.1 généré depuis la trace réelle (aucun fichier stocké). */
export function buildGpx(detail: OutingDetail): string {
  const rawSegments = outingTraceSegments(detail);
  /*
   * Défense en profondeur : le DTO est déjà projeté par `loadOutingDetail`,
   * mais un appel direct ne doit pas réintroduire une altitude ou une heure
   * masquée. Sans politique (anciens appels de test), le sérialiseur reste
   * compatible et ne projette rien.
   */
  const segments = detail.metricVisibility
    ? projectTraceMetrics(rawSegments, detail.metricVisibility).segments
    : rawSegments;
  const track = segments
    .map((segment) => {
      const points = segment
        .map((point) => {
          const ele = point.elevationM !== null ? `<ele>${point.elevationM}</ele>` : '';
          const time = point.timestamp ? `<time>${escapeXml(point.timestamp)}</time>` : '';
          return `<trkpt lat="${point.lat}" lon="${point.lng}">${ele}${time}</trkpt>`;
        })
        .join('');
      return `<trkseg>${points}</trkseg>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Le Kit du Voyageur" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(detail.title)}</name></metadata>
  <trk><name>${escapeXml(detail.title)}</name>${track}</trk>
</gpx>`;
}
