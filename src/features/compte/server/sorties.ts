import type { SupabaseClient } from '@supabase/supabase-js';
import { loadOutingWeather, type OutingWeather } from './weather';

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
  km: number;
  dplus: number;
  maxAlt: number | null;
  durationS: number | null;
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
  points: OutingPoint[];
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

function numeric(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

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

/**
 * Deux formats coexistent en base : `positions_timed` (échantillons horodatés
 * `{lat,lng,timestamp,elevationM}`) et `positions_geojson` (LineString).
 */
export function parsePositions(timed: unknown, geojson: unknown): OutingPoint[] {
  const points: OutingPoint[] = [];

  if (Array.isArray(timed)) {
    for (const sample of timed) {
      if (!sample || typeof sample !== 'object') continue;
      const row = sample as Record<string, unknown>;
      const lat = numericOrNull(row.lat ?? row.latitude);
      const lng = numericOrNull(row.lng ?? row.lon ?? row.longitude);
      if (lat === null || lng === null) continue;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      points.push({
        lat,
        lng,
        elevationM: numericOrNull(row.elevationM ?? row.altitude ?? row.ele),
        timestamp: typeof row.timestamp === 'string' ? row.timestamp : null,
      });
    }
  }

  if (points.length === 0 && geojson && typeof geojson === 'object') {
    const geometry = geojson as { type?: unknown; coordinates?: unknown };
    if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
      for (const coordinate of geometry.coordinates) {
        if (!Array.isArray(coordinate) || coordinate.length < 2) continue;
        const lng = numericOrNull(coordinate[0]);
        const lat = numericOrNull(coordinate[1]);
        if (lat === null || lng === null) continue;
        points.push({
          lat,
          lng,
          elevationM: coordinate.length > 2 ? numericOrNull(coordinate[2]) : null,
          timestamp: null,
        });
      }
    }
  }

  return points;
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

function storedWeather(raw: unknown): OutingWeather | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<OutingWeather>;
  if (candidate.source !== 'open-meteo' || !Array.isArray(candidate.days)) return null;
  return candidate as OutingWeather;
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
  outingId: string
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

  const gear: OutingGearItem[] = ((gearRes.data ?? []) as Array<{
    id: string;
    item_name: string;
    weight_g: number | null;
    kit_id: string | null;
  }>).map((row) => ({
    id: row.id,
    name: row.item_name,
    weightG: row.weight_g,
    kitId: row.kit_id,
  }));

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

  const points = parsePositions(session.positions_timed, session.positions_geojson);
  const coordinate = firstCoordinate(points);
  let weather = storedWeather(session.weather);
  if (!weather && coordinate) {
    weather = await loadOutingWeather(coordinate.lat, coordinate.lon, session.started_at);
  }

  const maxAlt =
    session.max_altitude_m ??
    (points.reduce<number | null>((max, point) => {
      if (point.elevationM === null) return max;
      return max === null ? point.elevationM : Math.max(max, point.elevationM);
    }, null) ?? null);

  const dateLabel = session.started_at ? session.started_at.slice(0, 10) : null;
  const title =
    session.title?.trim() ||
    route?.name?.trim() ||
    (dateLabel ? `Sortie du ${dateLabel}` : 'Sortie');

  return {
    id: session.id,
    title,
    date: dateLabel,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    massif: route?.region?.trim() || route?.name?.trim() || null,
    routeName: route?.name?.trim() || null,
    km: numeric(session.distance_km),
    dplus: numeric(session.elevation_gain_m),
    maxAlt,
    durationS: session.duration_seconds,
    status: computeStatus(session),
    visibility: normalizeVisibility(session.visibility),
    verified: points.length >= 2,
    coverUrl: photos[0]?.url ?? null,
    notes: text(session.notes),
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

/** GPX 1.1 généré depuis la trace réelle (aucun fichier stocké). */
export function buildGpx(detail: OutingDetail): string {
  const points = detail.points;
  const track = points
    .map((point) => {
      const ele = point.elevationM !== null ? `<ele>${point.elevationM}</ele>` : '';
      const time = point.timestamp ? `<time>${escapeXml(point.timestamp)}</time>` : '';
      return `<trkpt lat="${point.lat}" lon="${point.lng}">${ele}${time}</trkpt>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Le Kit du Voyageur" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(detail.title)}</name></metadata>
  <trk><name>${escapeXml(detail.title)}</name><trkseg>${track}</trkseg></trk>
</gpx>`;
}
