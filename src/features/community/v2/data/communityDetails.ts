/**
 * Communauté v2 — lectures RLS directes et services du tiroir Explorer.
 *
 * Le contrat RPC ne prévoit pas de RPC de « détail » (club, sortie) ni
 * d'extras de tuile (trace de couverture, badge GPS). Ces informations sont
 * donc lues **directement** dans les tables, sous RLS, en lot et bornées :
 * - jamais plus de 30 lignes par requête, jamais les 5 000 likes de la v1 ;
 * - aucune écriture de compteur (`members_count`, `current_participants`) ;
 * - un échec de lecture optionnelle (trace, météo, amis) ne casse pas la tuile.
 *
 * Les coordonnées `geography` sortent de PostgREST en EWKB hexadécimal : elles
 * sont décodées ici par `parseGeoPoint` (pur, testé), sans nouvelle RPC.
 */

import type { AvatarVM, ClubJoinRequestVM, EventCardVM, GeoPoint } from '../shared/types';
import { daysBetweenIso, todayIso } from '../shared/format';
import {
  getDataClient,
  normalizeRpcError,
  type DataClientLike,
  type NumericLike,
  type SupabaseResult,
} from './communityFeedRpc';
import {
  mapAvatar,
  mapEventDetailRow,
  normalizeRouteTrace,
  type CarnetExtras,
} from './communityFeedMappers';

// ── Décodage d'un point PostGIS (EWKB hexadécimal ou GeoJSON) ──────────────

function hexToBytes(value: string): Uint8Array | null {
  const clean = value.trim().replace(/^\\x/i, '').replace(/^0x/i, '');
  if (clean.length < 42 || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) return null;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Décode un point géographique renvoyé par PostgREST :
 * - `geography(Point,4326)` → chaîne EWKB hexadécimale (`0101000020E6100000…`) ;
 * - éventuellement un objet GeoJSON `{type:'Point', coordinates:[lng,lat]}`.
 * Renvoie `null` pour tout autre type (ligne, polygone, valeur nulle).
 */
export function parseGeoPoint(value: unknown): GeoPoint | null {
  if (value == null) return null;
  if (typeof value === 'object') {
    const candidate = value as { type?: unknown; coordinates?: unknown };
    if (candidate.type === 'Point' && Array.isArray(candidate.coordinates)) {
      const [lng, lat] = candidate.coordinates as unknown[];
      const x = typeof lng === 'number' ? lng : Number(lng);
      const y = typeof lat === 'number' ? lat : Number(lat);
      return validPoint(y, x);
    }
    return null;
  }
  if (typeof value !== 'string') return null;
  const bytes = hexToBytes(value);
  if (!bytes) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 5) return null;
  const littleEndian = bytes[0] === 1;
  const rawType = view.getUint32(1, littleEndian);
  // EWKB (PostGIS) : le type porte des drapeaux de dimension/SRID sur les bits
  // hauts, la base reste dans l'octet bas. WKB ISO (1001 = PointZ) : le type
  // est un multiple de 1000 sans drapeau.
  const hasZ = (rawType & 0x80000000) !== 0;
  const hasM = (rawType & 0x40000000) !== 0;
  const hasSridFlag = (rawType & 0x20000000) !== 0;
  const isEwkb = hasZ || hasM || hasSridFlag;
  const baseType = isEwkb ? rawType & 0xff : rawType % 1000;
  if (baseType !== 1) return null;
  const offset = hasSridFlag ? 9 : 5;
  if (bytes.length < offset + 16) return null;
  const x = view.getFloat64(offset, littleEndian);
  const y = view.getFloat64(offset + 8, littleEndian);
  return validPoint(y, x);
}

function validPoint(lat: number, lng: number): GeoPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// ── Profils publics (batch, borné) ────────────────────────────────────────

interface PublicProfileRow {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
}

/** Profils publics indexés par id ; un échec renvoie une table vide (dégradation douce). */
export async function fetchProfilesByIds(
  ids: ReadonlyArray<string | null | undefined>,
  client: DataClientLike = getDataClient(),
): Promise<Record<string, PublicProfileRow>> {
  const wanted = Array.from(new Set(ids.filter((id): id is string => Boolean(id)))).slice(0, 50);
  if (wanted.length === 0) return {};
  const { data, error } = await client
    .from('public_profiles')
    .select('id, full_name, handle, avatar_url')
    .in('id', wanted);
  if (error || !Array.isArray(data)) return {};
  const map: Record<string, PublicProfileRow> = {};
  for (const row of data as PublicProfileRow[]) {
    if (row?.id) map[row.id] = row;
  }
  return map;
}

function avatarFromProfile(
  userId: string | null | undefined,
  profiles: Record<string, PublicProfileRow>,
): AvatarVM {
  const profile = userId ? profiles[userId] : undefined;
  return mapAvatar({ id: userId, name: profile?.full_name, handle: profile?.handle, avatar: profile?.avatar_url });
}

// ── Extras de tuile Carnet (trace + badge GPS, absents de la RPC) ─────────

interface CarnetExtrasRow {
  id: string;
  verified: boolean | null;
  map_points: unknown;
}

/** `map_points` peut être l'objet `{trace, days}` ou directement un tableau de points. */
export function routeTraceFromMapPoints(mapPoints: unknown): unknown {
  if (Array.isArray(mapPoints)) return mapPoints;
  if (mapPoints && typeof mapPoints === 'object') {
    return (mapPoints as { trace?: unknown }).trace ?? null;
  }
  return null;
}

/**
 * Lecture en lot des extras d'une page de carnets (≤ 30 ids, une requête).
 * Renvoie `{}` en cas d'échec : la tuile s'affiche alors sans trace ni badge.
 */
export async function fetchCarnetExtras(
  ids: ReadonlyArray<string>,
  client: DataClientLike = getDataClient(),
): Promise<Record<string, CarnetExtras>> {
  const wanted = Array.from(new Set(ids.filter(Boolean))).slice(0, 30);
  if (wanted.length === 0) return {};
  const { data, error } = await client
    .from('carnets')
    .select('id, verified, map_points')
    .in('id', wanted);
  if (error || !Array.isArray(data)) return {};
  const out: Record<string, CarnetExtras> = {};
  for (const row of data as CarnetExtrasRow[]) {
    if (!row?.id) continue;
    out[row.id] = {
      verifiedGps: Boolean(row.verified),
      routeTrace: normalizeTraceForExtras(row.map_points),
    };
  }
  return out;
}

function normalizeTraceForExtras(mapPoints: unknown): CarnetExtras['routeTrace'] {
  // La normalisation pure vit dans les mappers (testée séparément).
  return normalizeRouteTrace(routeTraceFromMapPoints(mapPoints));
}

// ── Détail d'un club (lectures RLS bornées) ───────────────────────────────

export interface ClubDetailSourceRow {
  id: string;
  slug: string | null;
  name: string | null;
  description: string | null;
  category: string | null;
  activities: string[] | null;
  privacy: string | null;
  cover_image: string | null;
  cover_color: string | null;
  emoji: string | null;
  members_count: NumericLike;
  rules: string | null;
  join_questions: unknown;
  location_label: string | null;
  zone_geom: unknown;
  is_verified: boolean | null;
}

interface ClubMemberRow {
  user_id: string;
  role: string | null;
  status: string | null;
}

interface ClubMemberSourceRow extends ClubMemberRow {
  joined_at?: string | null;
}

export interface ClubDetailExtras {
  club: ClubDetailSourceRow;
  point: GeoPoint | null;
  rules: string | null;
  joinQuestions: string[];
  activities: string[];
  members: AvatarVM[];
  membersTotal: number;
  /** Amis du lecteur parmi les membres affichés (Club#10). */
  friends: AvatarVM[];
  viewerRole: 'admin' | 'moderator' | 'member' | 'none';
  nextEvents: EventCardVM[];
  posts: Array<{ id: string; excerpt: string; createdAt: string | null }>;
}

interface EventRowLike {
  id: string;
  title?: string | null;
  activity?: string | null;
  type?: string | null;
  organizer_id?: string | null;
  event_date?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  location?: string | null;
  meeting_point?: string | null;
  level?: string | null;
  distance_km?: NumericLike;
  elevation_gain_m?: NumericLike;
  max_participants?: NumericLike;
  current_participants?: NumericLike;
  waitlist_enabled?: boolean | null;
  status?: string | null;
  cover_image?: string | null;
  duration?: string | null;
}

function normalizeJoinQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 3);
}

/**
 * Détail d'un club : la fiche complète (description, règles, questions), les
 * membres actifs (≤ 12), les prochaines sorties (≤ 3), les dernières
 * publications (≤ 3) et le rôle du lecteur pour la pile « Demandes (n) ».
 */
export async function fetchClubDetail(
  clubId: string,
  viewerId: string | null,
  client: DataClientLike = getDataClient(),
): Promise<{ data: ClubDetailExtras | null; error: { code: string | null; message: string } | null }> {
  try {
    const clubResult = await client
      .from('clubs')
      .select(
        'id, slug, name, description, category, activities, privacy, cover_image, cover_color, emoji, members_count, rules, join_questions, location_label, zone_geom, is_verified',
      )
      .eq('id', clubId)
      .maybeSingle();
    if (clubResult.error || !clubResult.data) {
      return { data: null, error: normalizeRpcError(clubResult.error) ?? { code: 'not_found', message: 'Club introuvable.' } };
    }
    const club = clubResult.data as ClubDetailSourceRow;

    const [membersResult, eventsResult, postsResult, roleResult] = await Promise.all([
      client
        .from('club_members')
        .select('user_id, role, status, joined_at')
        .eq('club_id', clubId)
        .eq('status', 'active')
        .order('joined_at', { ascending: true })
        .limit(12),
      client
        .from('events')
        .select(
          'id, title, activity, type, organizer_id, event_date, starts_at, ends_at, location, meeting_point, level, distance_km, elevation_gain_m, max_participants, current_participants, waitlist_enabled, status, cover_image, duration',
        )
        .eq('club_id', clubId)
        .neq('status', 'cancelled')
        .gte('event_date', todayIso())
        .order('event_date', { ascending: true })
        .limit(3),
      client
        .from('community_posts')
        .select('id, content, title, created_at')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(3),
      viewerId
        ? client
            .from('club_members')
            .select('role, status')
            .eq('club_id', clubId)
            .eq('user_id', viewerId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const memberRows = Array.isArray(membersResult.data)
      ? (membersResult.data as ClubMemberSourceRow[])
      : [];
    const eventRows = Array.isArray(eventsResult.data) ? (eventsResult.data as EventRowLike[]) : [];
    const postRows = Array.isArray(postsResult.data)
      ? (postsResult.data as Array<{ id: string; content: string | null; title: string | null; created_at: string | null }>)
      : [];

    const roleRow = roleResult.data as ClubMemberRow | null;
    const viewerRole: ClubDetailExtras['viewerRole'] =
      roleRow?.status === 'active'
        ? roleRow.role === 'admin'
          ? 'admin'
          : roleRow.role === 'moderator'
            ? 'moderator'
            : 'member'
        : 'none';

    const memberIds = memberRows.map((row) => row.user_id);
    const organizerIds = eventRows.map((row) => row.organizer_id ?? null);
    const [profiles, followsResult, registrationsResult] = await Promise.all([
      fetchProfilesByIds([...memberIds, ...organizerIds], client),
      viewerId && memberIds.length > 0
        ? client.from('user_follows').select('following_id').eq('follower_id', viewerId).in('following_id', memberIds)
        : Promise.resolve({ data: null, error: null }),
      viewerId && eventRows.length > 0
        ? client
            .from('event_participants')
            .select('event_id, status')
            .eq('user_id', viewerId)
            .in('event_id', eventRows.map((row) => row.id))
        : Promise.resolve({ data: null, error: null }),
    ]);

    const followedIds = new Set(
      Array.isArray(followsResult.data)
        ? (followsResult.data as Array<{ following_id: string }>).map((row) => row.following_id)
        : [],
    );
    const registrations = new Map<string, 'registered' | 'waitlist'>();
    if (Array.isArray(registrationsResult.data)) {
      for (const row of registrationsResult.data as Array<{ event_id: string; status: string | null }>) {
        registrations.set(row.event_id, row.status === 'waitlist' ? 'waitlist' : 'registered');
      }
    }

    const members = memberRows.map((row) => avatarFromProfile(row.user_id, profiles));
    const friends = memberRows
      .filter((row) => followedIds.has(row.user_id))
      .map((row) => avatarFromProfile(row.user_id, profiles));

    const nextEvents = eventRows.map((row) => {
      const organizerId = row.organizer_id ?? null;
      const profile = organizerId ? profiles[organizerId] : undefined;
      return mapEventDetailRow(
        row,
        { name: profile?.full_name ?? null, avatar: profile?.avatar_url ?? null },
        registrations.get(row.id) ?? 'none',
      );
    });

    return {
      data: {
        club,
        point: parseGeoPoint(club.zone_geom),
        rules: (club.rules ?? '').trim() || null,
        joinQuestions: normalizeJoinQuestions(club.join_questions),
        activities: Array.isArray(club.activities) ? club.activities.filter(Boolean) : [],
        members,
        membersTotal: Number(club.members_count ?? members.length) || members.length,
        friends,
        viewerRole,
        nextEvents,
        posts: postRows.map((row) => ({
          id: row.id,
          excerpt: (row.title ?? '').trim() || (row.content ?? '').trim().slice(0, 120),
          createdAt: row.created_at,
        })),
      },
      error: null,
    };
  } catch (cause) {
    return {
      data: null,
      error: { code: null, message: cause instanceof Error ? cause.message : 'network_error' },
    };
  }
}

// ── Demandes d'adhésion (pile « Demandes (n) », admin/modérateur) ─────────

interface JoinRequestRow {
  id: string;
  user_id: string;
  answers: unknown;
  message: string | null;
  created_at: string | null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim());
}

/** Demandes `pending` d'un club (≤ 20), avec avatars ; réservé aux admins par RLS. */
export async function fetchClubJoinRequests(
  clubId: string,
  client: DataClientLike = getDataClient(),
): Promise<{ requests: ClubJoinRequestVM[]; error: { code: string | null; message: string } | null }> {
  try {
    const { data, error } = await client
      .from('club_join_requests')
      .select('id, user_id, answers, message, created_at')
      .eq('club_id', clubId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20);
    if (error) return { requests: [], error: normalizeRpcError(error) };
    const rows = Array.isArray(data) ? (data as JoinRequestRow[]) : [];
    const profiles = await fetchProfilesByIds(rows.map((row) => row.user_id), client);
    return {
      requests: rows.map((row) => ({
        id: row.id,
        user: avatarFromProfile(row.user_id, profiles),
        answers: stringArray(row.answers),
        message: (row.message ?? '').trim() || null,
        createdAt: row.created_at ?? '',
      })),
      error: null,
    };
  } catch (cause) {
    return {
      requests: [],
      error: { code: null, message: cause instanceof Error ? cause.message : 'network_error' },
    };
  }
}

// ── Détail d'une sortie ───────────────────────────────────────────────────

interface EventDetailSourceRow extends EventRowLike {
  description?: string | null;
  safety_notes?: string | null;
  safety_checklist?: string[] | null;
  recurrence?: string | null;
  location_geom?: unknown;
  meeting_geom?: unknown;
}

export interface EventDetailExtras {
  description: string | null;
  safetyNotes: string | null;
  safetyChecklist: string[];
  recurrence: 'weekly' | 'monthly' | null;
  locationPoint: GeoPoint | null;
  meetingPointPoint: GeoPoint | null;
  participants: AvatarVM[];
  participantsTotal: number;
  waitlistCount: number;
}

interface ParticipantRow {
  user_id: string;
  status: string | null;
}

/** Détail d'une sortie : description, sécurité, RDV géolocalisés, participants réels. */
export async function fetchEventDetail(
  eventId: string,
  client: DataClientLike = getDataClient(),
): Promise<{ data: EventDetailExtras | null; error: { code: string | null; message: string } | null }> {
  try {
    const eventResult = await client
      .from('events')
      .select(
        'description, safety_notes, safety_checklist, recurrence, location_geom, meeting_geom, current_participants, max_participants, waitlist_enabled',
      )
      .eq('id', eventId)
      .maybeSingle();
    if (eventResult.error || !eventResult.data) {
      return {
        data: null,
        error: normalizeRpcError(eventResult.error) ?? { code: 'not_found', message: 'Sortie introuvable.' },
      };
    }
    const event = eventResult.data as EventDetailSourceRow;
    const participantsResult = await client
      .from('event_participants')
      .select('user_id, status')
      .eq('event_id', eventId)
      .order('registered_at', { ascending: true })
      .limit(50);
    const rows = Array.isArray(participantsResult.data)
      ? (participantsResult.data as ParticipantRow[])
      : [];
    const confirmed = rows.filter((row) => row.status !== 'waitlist' && row.user_id);
    const waitlistCount = rows.filter((row) => row.status === 'waitlist').length;
    const profiles = await fetchProfilesByIds(confirmed.map((row) => row.user_id), client);
    const recurrence =
      event.recurrence === 'weekly' || event.recurrence === 'monthly' ? event.recurrence : null;
    return {
      data: {
        description: (event.description ?? '').trim() || null,
        safetyNotes: (event.safety_notes ?? '').trim() || null,
        safetyChecklist: stringArray(event.safety_checklist).slice(0, 10),
        recurrence,
        locationPoint: parseGeoPoint(event.location_geom),
        meetingPointPoint: parseGeoPoint(event.meeting_geom),
        participants: confirmed.slice(0, 6).map((row) => avatarFromProfile(row.user_id, profiles)),
        participantsTotal: Number(event.current_participants ?? confirmed.length) || 0,
        waitlistCount,
      },
      error: null,
    };
  } catch (cause) {
    return {
      data: null,
      error: { code: null, message: cause instanceof Error ? cause.message : 'network_error' },
    };
  }
}

// ── Météo du jour J (Sorties#8) ───────────────────────────────────────────

export interface EventWeatherVM {
  label: string;
  symbol: string;
  tempMax: number;
  tempMin: number;
}

/** La prévision n'est demandée que dans la fenêtre J-7 → J+1 (route existante). */
export function shouldFetchWeather(eventDate: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return false;
  const days = daysBetweenIso(todayIso(now), eventDate);
  return days >= 0 && days <= 7;
}

const WEATHER_SYMBOLS: ReadonlyArray<[string, string]> = [
  ['clearsky', 'Ensoleillé'],
  ['fair', 'Éclaircies'],
  ['partlycloudy', 'Éclaircies'],
  ['cloudy', 'Nuageux'],
  ['fog', 'Brouillard'],
  ['heavyrain', 'Forte pluie'],
  ['lightrain', 'Averses'],
  ['rainshowers', 'Averses'],
  ['rain', 'Pluie'],
  ['heavysnow', 'Forte neige'],
  ['lightsnow', 'Averses de neige'],
  ['snowshowers', 'Averses de neige'],
  ['snow', 'Neige'],
  ['sleet', 'Neige fondue'],
  ['thunder', 'Orage'],
];

/** Traduit un `symbol_code` MET Norway (« partlycloudy_day ») en libellé français. */
export function weatherLabel(symbol: string | null | undefined): string {
  const raw = (symbol ?? '').toLowerCase().split('_')[0] ?? '';
  for (const [key, label] of WEATHER_SYMBOLS) {
    if (raw.includes(key)) return label;
  }
  return 'Météo';
}

interface WeatherHour {
  time?: string;
  temperature_c?: number | null;
  symbol?: string | null;
}

/**
 * Prévision du jour J via la route existante `/api/explorer/v2/weather`
 * (même origine, aucune nouvelle origine CSP). Repli **silencieux** : `null`
 * si la route échoue, si la date est hors fenêtre ou si la réponse est vide.
 */
export async function fetchEventWeather(
  point: GeoPoint | null,
  eventDate: string,
  now: Date = new Date(),
): Promise<EventWeatherVM | null> {
  if (!point || !shouldFetchWeather(eventDate, now)) return null;
  try {
    const query = `?lat=${point.lat.toFixed(4)}&lng=${point.lng.toFixed(4)}`;
    const response = await fetch(`/api/explorer/v2/weather${query}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { hours?: WeatherHour[] };
    const hours = Array.isArray(payload.hours) ? payload.hours : [];
    if (hours.length === 0) return null;
    const dayHours = hours.filter((hour) => (hour.time ?? '').slice(0, 10) === eventDate);
    const sample = (dayHours.length > 0 ? dayHours : hours.slice(0, 6)).filter(
      (hour) => typeof hour.temperature_c === 'number' && Number.isFinite(hour.temperature_c),
    );
    if (sample.length === 0) return null;
    const temperatures = sample.map((hour) => hour.temperature_c as number);
    const symbol = sample.find((hour) => hour.symbol)?.symbol ?? null;
    return {
      label: weatherLabel(symbol),
      symbol: symbol ?? '',
      tempMax: Math.round(Math.max(...temperatures)),
      tempMin: Math.round(Math.min(...temperatures)),
    };
  } catch {
    return null;
  }
}

// ── Météo du jour J via `/api/weather` (FID-071) ──────────────────────────

interface WeatherDayPayload {
  date?: string;
  label?: string;
  code?: number | null;
  tMaxC?: number | null;
  tMinC?: number | null;
}

const WEATHER_DAY_TTL_MS = 30 * 60 * 1000;
const WEATHER_DAY_CACHE_MAX = 200;
const weatherDayCache = new Map<string, { at: number; value: EventWeatherVM | null }>();

/** Réserve aux tests : vide le cache mémoire des prévisions journalières. */
export function __resetEventWeatherCache(): void {
  weatherDayCache.clear();
}

/**
 * Prévision **du jour de la sortie** via la route existante `/api/weather`
 * (même origine, MET Norway côté serveur : aucune nouvelle origine CSP).
 * Contrairement à `/api/explorer/v2/weather` (12 prochaines heures, utilisée
 * par erreur pour une date future), cette route rend la journée demandée :
 * `from = to = eventDate`. Repli **silencieux** (`null`) hors fenêtre J-7, si
 * la réponse est incomplète ou si le réseau échoue. Cache mémoire 30 min par
 * couple (point arrondi, date) : les tuiles d'un même fil ne martèlent pas la
 * route, et un échec n'est pas rejoué à chaque rendu.
 */
export async function fetchEventDayWeather(
  point: GeoPoint | null,
  eventDate: string,
  now: Date = new Date(),
  fetchImpl: typeof fetch | null = null,
): Promise<EventWeatherVM | null> {
  if (!point || !shouldFetchWeather(eventDate, now)) return null;
  const key = `${point.lat.toFixed(2)},${point.lng.toFixed(2)},${eventDate}`;
  const cached = weatherDayCache.get(key);
  if (cached && Date.now() - cached.at < WEATHER_DAY_TTL_MS) return cached.value;
  const remember = (value: EventWeatherVM | null) => {
    if (weatherDayCache.size >= WEATHER_DAY_CACHE_MAX) {
      const oldest = weatherDayCache.keys().next();
      if (!oldest.done) weatherDayCache.delete(oldest.value);
    }
    weatherDayCache.set(key, { at: Date.now(), value });
    return value;
  };
  const doFetch = fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return null;
  try {
    const query = `?lat=${point.lat.toFixed(4)}&lon=${point.lng.toFixed(4)}&from=${eventDate}&to=${eventDate}`;
    const response = await doFetch(`/api/weather${query}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return remember(null);
    const payload = (await response.json()) as { status?: string; days?: WeatherDayPayload[] };
    if (payload.status !== 'ok') return remember(null);
    const days = Array.isArray(payload.days) ? payload.days : [];
    const day = days.find((entry) => entry.date === eventDate) ?? null;
    if (
      !day ||
      typeof day.tMaxC !== 'number' ||
      !Number.isFinite(day.tMaxC) ||
      typeof day.tMinC !== 'number' ||
      !Number.isFinite(day.tMinC)
    ) {
      return remember(null);
    }
    return remember({
      label: day.label || 'Météo',
      symbol: day.code != null ? String(day.code) : '',
      tempMax: Math.round(day.tMaxC),
      tempMin: Math.round(day.tMinC),
    });
  } catch {
    return null;
  }
}

/**
 * Valeur du sticker « Météo » de la Story (maquette L3328 : « 4° · Éclaircies »).
 * Exposée côté données pour que `create/story` la consomme sans dupliquer le
 * format (FID-071 : le formulaire Story n'est pas modifié dans cette vague).
 */
export function storyWeatherSticker(weather: EventWeatherVM | null): string | null {
  if (!weather) return null;
  return `${weather.tempMax}° · ${weather.label}`;
}

// ── Utilitaires de lecture tolérante ─────────────────────────────────────

/** Aplatit un résultat de lecture tableau (ligne unique ou `null`). */
export function readRows<T>(result: SupabaseResult<unknown>): T[] {
  return Array.isArray(result.data) ? (result.data as T[]) : [];
}
