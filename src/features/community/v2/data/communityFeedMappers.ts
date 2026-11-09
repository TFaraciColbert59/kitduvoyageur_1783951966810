/**
 * Communauté v2 — mappers purs « ligne RPC → VM de tuile ».
 *
 * Toutes les formes de sortie viennent de `shared/types.ts` (`CarnetCardVM`,
 * `ClubCardVM`, `EventCardVM`, `SearchHitVM`). Aucune dépendance React, aucun
 * accès réseau, aucune locale implicite : ce module est testé unitairement et
 * sert de seule frontière entre la couche données et les composants.
 *
 * Règles (RPC-CONTRACTS § 5) :
 * - le serveur trie et pagine : on ne retrie jamais ici ;
 * - les compteurs serveur (`likes_count`, `spots_left`, `my_status`,
 *   `distance_km`…) ne sont jamais recalculés ;
 * - un champ absent devient une valeur neutre sûre (`null`, `''`, `[]`), jamais
 *   une donnée inventée.
 */

import type {
  AvatarVM,
  CarnetCardVM,
  ClubCardVM,
  ClubPrivacy,
  EventCardVM,
  EventRegistration,
  MemberStatus,
  SearchHitVM,
  TrendingItemVM,
  TypeKind,
  Visibility,
  AgendaCounts,
} from '../shared/types';
import {
  formatDateFull,
  formatTime,
  initialsFromName,
  parisIsoDate,
  todayIso,
  tripDays,
} from '../shared/format';
import type {
  AgendaFeedRow,
  CarnetFeedRow,
  ClubFeedRow,
  EventFeedRow,
  FeedCursor,
  FeedPeopleJson,
  NumericLike,
  SearchFeedRow,
  TrendingFeedRow,
} from './communityFeedRpc';

/** Valeur neutre `spotsLeft` quand la capacité est illimitée (`max_participants = 0`). */
export const UNLIMITED_SPOTS = 9999;

/** Convertit un numeric PostgREST (`number` ou chaîne) en nombre fini ou `null`. */
export function toNumber(value: NumericLike | boolean | undefined | null): number | null {
  if (value == null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const ISO_COUNTRY = /^[A-Z]{2}$/;

/** Code pays alpha-2 du visa carnet (FID-067) : `null` si absent ou invalide. */
export function isoCountry(value: string | null | undefined): string | null {
  const code = (value ?? '').trim().toUpperCase();
  return ISO_COUNTRY.test(code) ? code : null;
}

function cleanText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** Texte non vide ou `null` (couvre les colonnes `text default ''`). */
export function nonEmptyText(value: string | null | undefined): string | null {
  const clean = cleanText(value);
  return clean.length > 0 ? clean : null;
}

/** Avatar d'une personne : initiales calculées, nom de repli stable. */
export function mapAvatar(input: {
  id?: string | null;
  name?: string | null;
  handle?: string | null;
  avatar?: string | null;
}): AvatarVM {
  const name = cleanText(input.name) || 'Voyageur';
  return {
    id: input.id ?? '',
    name,
    handle: nonEmptyText(input.handle),
    avatarUrl: nonEmptyText(input.avatar),
    initials: initialsFromName(name),
  };
}

/** `travelers` / `friends` : avatars plafonnés à 3 par le serveur, total réel. */
export function mapFeedPeople(value: FeedPeopleJson | null | undefined): {
  avatars: AvatarVM[];
  total: number;
} {
  const rows = Array.isArray(value?.avatars) ? value.avatars : [];
  const avatars = rows
    .filter((row): row is NonNullable<typeof row> => row != null)
    .map((row) => mapAvatar({ id: row.id, name: row.name, avatar: row.avatar }));
  const total = toNumber(value?.total ?? null);
  return { avatars, total: total != null && total >= 0 ? total : avatars.length };
}

// ── Énumérations tolérantes ─────────────────────────────────────────────────

export function normalizeVisibility(value: string | null | undefined): Visibility {
  const raw = cleanText(value).toLowerCase();
  if (raw === 'friends' || raw === 'abonnies') return 'friends';
  if (raw === 'private' || raw === 'prive' || raw === 'privé') return 'private';
  return 'public';
}

export function normalizeClubPrivacy(value: string | null | undefined): ClubPrivacy {
  const raw = cleanText(value).toLowerCase();
  if (raw === 'closed') return 'closed';
  if (raw === 'secret') return 'secret';
  return 'open';
}

export function normalizeMemberStatus(value: string | null | undefined): MemberStatus {
  const raw = cleanText(value).toLowerCase();
  if (raw === 'member') return 'member';
  if (raw === 'pending') return 'pending';
  if (raw === 'admin') return 'admin';
  return 'none';
}

export function normalizeEventRegistration(value: string | null | undefined): EventRegistration {
  const raw = cleanText(value).toLowerCase();
  if (raw === 'registered' || raw === 'in') return 'registered';
  if (raw === 'waitlist' || raw === 'wait') return 'waitlist';
  return 'none';
}

export function normalizeEventLevel(
  value: string | null | undefined,
): EventCardVM['level'] {
  const raw = cleanText(value).toLowerCase();
  if (raw === 'facile') return 'facile';
  if (raw === 'moyen') return 'moyen';
  if (raw === 'difficile') return 'difficile';
  return null;
}

const ACTIVITY_LABELS: Record<string, string> = {
  rando: 'Randonnée',
  randonnee: 'Randonnée',
  randonnée: 'Randonnée',
  trail: 'Trail',
  ski: 'Ski',
  'ski-rando': 'Ski de rando',
  'ski de rando': 'Ski de rando',
  velo: 'Vélo',
  vélo: 'Vélo',
  escalade: 'Escalade',
  alpinisme: 'Alpinisme',
  autre: 'Autre',
};

/**
 * Libellé lisible d'une activité (`events.activity`/`clubs.category` brut) :
 * les slugs connus sont traduits, le reste est capitalisé tel quel.
 */
export function activityLabel(value: string | null | undefined): string {
  const raw = cleanText(value);
  if (!raw) return '';
  const known = ACTIVITY_LABELS[raw.toLowerCase()];
  if (known) return known;
  const folded = ACTIVITY_LABELS[raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()];
  if (folded) return folded;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Durée lisible d'une sortie (« 1 h 30 », « 45 min ») : colonne réelle puis calcul. */
export function eventDurationLabel(
  duration: string | null | undefined,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): string | null {
  const explicit = cleanText(duration);
  if (explicit) return explicit;
  if (!startsAt || !endsAt) return null;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** Une sortie est passée quand sa date de début est antérieure à aujourd'hui (Paris). */
export function isPastEvent(
  eventDate: string | null | undefined,
  startsAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const iso = nonEmptyText(eventDate)?.slice(0, 10) ?? parisIsoDate(startsAt);
  if (!iso) return false;
  return iso < todayIso(now);
}

/** Date calendaire `YYYY-MM-DD` : `event_date` d'abord, `starts_at` en repli. */
export function resolveEventDate(
  eventDate: string | null | undefined,
  startsAt: string | null | undefined,
): string {
  const explicit = nonEmptyText(eventDate)?.slice(0, 10);
  if (explicit && /^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  return parisIsoDate(startsAt) ?? '';
}

// ── Trace de couverture (Carnets#5/#6) ─────────────────────────────────────

/**
 * Normalise une trace `map_points.trace` (`[[lng, lat], …]`) en points SVG
 * `[x, y]` dans une boîte 0-100, **sans déformer** le parcours (même échelle
 * sur les deux axes, centré). Renvoie `null` si la trace est absente ou
 * dégénérée. Aucune coordonnée n'est conservée après cette normalisation.
 */
export function normalizeRouteTrace(trace: unknown): Array<[number, number]> | null {
  if (!Array.isArray(trace)) return null;
  const points: Array<[number, number]> = [];
  for (const entry of trace) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const lng = toNumber(entry[0] as NumericLike);
    const lat = toNumber(entry[1] as NumericLike);
    if (lng == null || lat == null) continue;
    points.push([lng, lat]);
  }
  if (points.length < 2) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX <= 0 && spanY <= 0) return null;
  const scale = spanX <= 0 || spanY <= 0 ? 1 : Math.max(spanX, spanY);
  const safeScale = scale || 1;
  return points.map(([x, y]) => {
    const nx = spanX <= 0 ? 50 : ((x - minX) / safeScale) * 100 + (100 - (spanX / safeScale) * 100) / 2;
    // L'axe SVG descend : on inverse la latitude pour un tracé naturel.
    const ny = spanY <= 0 ? 50 : ((maxY - y) / safeScale) * 100 + (100 - (spanY / safeScale) * 100) / 2;
    return [Math.round(nx * 10) / 10, Math.round(ny * 10) / 10] as [number, number];
  });
}

// ── Curseur ────────────────────────────────────────────────────────────────

/** Curseur de page suivante = `{v: sort_key, id}` de la dernière ligne. */
export function nextFeedCursor(
  rows: ReadonlyArray<{ id?: string | null; sort_key?: NumericLike }>,
  limit: number,
): FeedCursor | null {
  if (rows.length < limit) return null;
  const last = rows[rows.length - 1];
  if (!last?.id) return null;
  const v = toNumber(last.sort_key ?? null);
  if (v == null) return null;
  return { v, id: last.id };
}

/** `hasMore` : la page est pleine (RPC-CONTRACTS § 5). */
export function hasMoreRows(rows: ReadonlyArray<unknown>, limit: number): boolean {
  return rows.length >= limit;
}

// ── Carnets ────────────────────────────────────────────────────────────────

/** Complément de lecture RLS pour la tuile (absente des colonnes de la RPC). */
export interface CarnetExtras {
  verifiedGps: boolean;
  routeTrace: Array<[number, number]> | null;
}

const NO_CARNET_EXTRAS: CarnetExtras = { verifiedGps: false, routeTrace: null };

export function mapCarnetRow(row: CarnetFeedRow, extras?: CarnetExtras | null): CarnetCardVM {
  const extra = extras ?? NO_CARNET_EXTRAS;
  const author = mapAvatar({
    id: row.author_id,
    name: row.author_name,
    avatar: row.author_avatar,
  });
  const travelers = mapFeedPeople(row.travelers);
  const startDate = nonEmptyText(row.start_date)?.slice(0, 10) ?? null;
  const endDate = nonEmptyText(row.end_date)?.slice(0, 10) ?? null;
  const nights = toNumber(row.nb_nuits);
  const days = tripDays(startDate, endDate) ?? (nights != null && nights >= 0 ? nights + 1 : null);
  return {
    id: row.id,
    title: cleanText(row.title) || 'Carnet sans titre',
    destination: cleanText(row.destination),
    coverImage: nonEmptyText(row.cover_image),
    coverAlt: null,
    days,
    distanceKm: toNumber(row.route_distance_km),
    elevationGainM: toNumber(row.elevation_gain_m),
    author,
    likesCount: toNumber(row.likes_count) ?? 0,
    commentsCount: toNumber(row.comments_count) ?? 0,
    likedByMe: Boolean(row.liked_by_me),
    travelers: travelers.avatars,
    travelersTotal: travelers.total,
    isLive: Boolean(row.is_live),
    verifiedGps: extra.verifiedGps,
    startDate,
    endDate,
    visibility: normalizeVisibility(row.visibility),
    distanceKmFromMe: toNumber(row.distance_km),
    routeTrace: extra.routeTrace,
    countryIso: isoCountry(row.country_iso),
  };
}

// ── Clubs ──────────────────────────────────────────────────────────────────

export function mapClubRow(row: ClubFeedRow): ClubCardVM {
  const friends = mapFeedPeople(row.friends);
  const name = cleanText(row.name) || 'Club sans nom';
  return {
    id: row.id,
    slug: cleanText(row.slug) || row.id,
    name,
    description: '',
    category: cleanText(row.category),
    emoji: nonEmptyText(row.emoji),
    activities: Array.isArray(row.activities) ? row.activities.filter(Boolean) : [],
    privacy: normalizeClubPrivacy(row.privacy),
    coverImage: nonEmptyText(row.cover_image),
    coverColor: nonEmptyText(row.cover_color),
    crestSeed: row.id || name,
    membersCount: toNumber(row.members_count) ?? 0,
    myStatus: normalizeMemberStatus(row.my_status),
    eventsThisMonth: toNumber(row.events_this_month) ?? 0,
    lastPostAt: nonEmptyText(row.last_post_at),
    distanceKmFromMe: toNumber(row.distance_km),
    zoneLabel: nonEmptyText(row.location_label),
    friends: friends.avatars,
    friendsTotal: friends.total,
    rules: null,
    joinQuestions: [],
  };
}

// ── Sorties ────────────────────────────────────────────────────────────────

export function mapEventRow(row: EventFeedRow, now: Date = new Date()): EventCardVM {
  const eventDate = resolveEventDate(row.event_date, row.starts_at);
  const maxParticipants = toNumber(row.max_participants) ?? 0;
  const currentParticipants = toNumber(row.current_participants) ?? 0;
  const spotsLeftRaw = toNumber(row.spots_left);
  const unlimited = maxParticipants <= 0;
  const friends = mapFeedPeople(row.friends);
  return {
    id: row.id,
    title: cleanText(row.title) || 'Sortie sans titre',
    activity: activityLabel(row.activity),
    startsAt: nonEmptyText(row.starts_at),
    endsAt: nonEmptyText(row.ends_at),
    eventDate,
    location: cleanText(row.location),
    meetingPoint: nonEmptyText(row.meeting_point),
    level: normalizeEventLevel(row.level),
    distanceKm: toNumber(row.route_distance_km),
    elevationGainM: toNumber(row.elevation_gain_m),
    duration: eventDurationLabel(null, row.starts_at, row.ends_at),
    coverImage: nonEmptyText(row.cover_image),
    coverAlt: null,
    maxParticipants,
    currentParticipants,
    spotsLeft: unlimited ? UNLIMITED_SPOTS : Math.max(0, spotsLeftRaw ?? maxParticipants - currentParticipants),
    waitlistEnabled: Boolean(row.waitlist_enabled),
    myStatus: normalizeEventRegistration(row.my_status),
    organizer: mapAvatar({
      id: row.organizer_id,
      name: row.organizer_name,
      avatar: row.organizer_avatar,
    }),
    participants: friends.avatars,
    participantsTotal: currentParticipants,
    clubId: null,
    clubName: null,
    kitId: null,
    description: null,
    safetyNotes: null,
    safetyChecklist: [],
    recurrence: null,
    past: isPastEvent(eventDate, row.starts_at, now),
    distanceKmFromMe: toNumber(row.distance_km),
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
  };
}

/**
 * Présentation compacte d'une sortie lue hors RPC (détail club) : mêmes VMs,
 * champs absents remplis par les valeurs neutres documentées ci-dessus.
 */
export function mapEventDetailRow(
  row: {
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
    description?: string | null;
    safety_notes?: string | null;
    safety_checklist?: string[] | null;
    recurrence?: string | null;
    club_id?: string | null;
    club_name?: string | null;
    kit_id?: string | null;
  },
  organizer?: { name?: string | null; avatar?: string | null } | null,
  myStatus: EventRegistration = 'none',
  now: Date = new Date(),
): EventCardVM {
  const eventDate = resolveEventDate(row.event_date, row.starts_at);
  const maxParticipants = toNumber(row.max_participants ?? null) ?? 0;
  const currentParticipants = toNumber(row.current_participants ?? null) ?? 0;
  const unlimited = maxParticipants <= 0;
  const recurrence = row.recurrence === 'weekly' || row.recurrence === 'monthly' ? row.recurrence : null;
  return {
    id: row.id,
    title: cleanText(row.title) || 'Sortie sans titre',
    activity: activityLabel(row.activity ?? row.type ?? null),
    startsAt: nonEmptyText(row.starts_at),
    endsAt: nonEmptyText(row.ends_at),
    eventDate,
    location: cleanText(row.location),
    meetingPoint: nonEmptyText(row.meeting_point),
    level: normalizeEventLevel(row.level),
    distanceKm: toNumber(row.distance_km ?? null),
    elevationGainM: toNumber(row.elevation_gain_m ?? null),
    duration: eventDurationLabel(row.duration, row.starts_at, row.ends_at),
    coverImage: nonEmptyText(row.cover_image),
    coverAlt: null,
    maxParticipants,
    currentParticipants,
    spotsLeft: unlimited ? UNLIMITED_SPOTS : Math.max(0, maxParticipants - currentParticipants),
    waitlistEnabled: Boolean(row.waitlist_enabled),
    myStatus,
    organizer: mapAvatar({ id: row.organizer_id, name: organizer?.name, avatar: organizer?.avatar }),
    participants: [],
    participantsTotal: currentParticipants,
    clubId: nonEmptyText(row.club_id),
    clubName: nonEmptyText(row.club_name),
    kitId: nonEmptyText(row.kit_id),
    description: nonEmptyText(row.description),
    safetyNotes: nonEmptyText(row.safety_notes),
    safetyChecklist: Array.isArray(row.safety_checklist) ? row.safety_checklist.filter(Boolean) : [],
    recurrence,
    past: isPastEvent(eventDate, row.starts_at, now),
    distanceKmFromMe: null,
  };
}

// ── Recherche ─────────────────────────────────────────────────────────────

const SEARCH_KINDS: ReadonlyArray<TypeKind> = ['post', 'carnet', 'club', 'sortie', 'membre'];

/** Ordre d'affichage des groupes de résultats (Recherche#6). */
export const SEARCH_KIND_ORDER: ReadonlyArray<Exclude<TypeKind, 'post'>> = [
  'carnet',
  'club',
  'sortie',
  'membre',
];

/** Libellés d'en-tête de groupe (eyebrow 600 10,5 px). */
export const SEARCH_KIND_LABELS: Record<TypeKind, { group: string; singular: string }> = {
  post: { group: 'Publications', singular: 'Publication' },
  carnet: { group: 'Carnets', singular: 'Carnet' },
  club: { group: 'Clubs', singular: 'Club' },
  sortie: { group: 'Sorties', singular: 'Sortie' },
  membre: { group: 'Membres', singular: 'Membre' },
};

export function normalizeSearchKind(value: string | null | undefined): TypeKind | null {
  const raw = cleanText(value).toLowerCase();
  return (SEARCH_KINDS as ReadonlyArray<string>).includes(raw) ? (raw as TypeKind) : null;
}

function fallbackSearchHref(kind: TypeKind, id: string): string {
  if (kind === 'carnet') return `/carnets/${id}`;
  if (kind === 'club') return `/clubs/${id}`;
  if (kind === 'sortie') return `/sorties/${id}`;
  if (kind === 'membre') return `/profil/${id}`;
  return `/communaute?post=${id}`;
}

export function mapSearchHit(row: SearchFeedRow): SearchHitVM | null {
  const kind = normalizeSearchKind(row.kind);
  if (!kind || !row.id) return null;
  return {
    kind,
    id: row.id,
    title: cleanText(row.title) || SEARCH_KIND_LABELS[kind].singular,
    subtitle: cleanText(row.subtitle),
    cover: nonEmptyText(row.cover),
    href: nonEmptyText(row.href) ?? fallbackSearchHref(kind, row.id),
    score: toNumber(row.score),
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
    distanceKm: toNumber(row.distance_km),
    startsAt: nonEmptyText(row.starts_at),
    excerpt: null,
  };
}

/** Regroupe des résultats par type, dans l'ordre d'affichage documenté. */
export function groupSearchHits(
  hits: ReadonlyArray<SearchHitVM>,
): Array<{ kind: TypeKind; items: SearchHitVM[] }> {
  const order: TypeKind[] = ['post', ...SEARCH_KIND_ORDER];
  return order
    .map((kind) => ({ kind, items: hits.filter((hit) => hit.kind === kind) }))
    .filter((group) => group.items.length > 0);
}

/** Nombre de résultats d'un type (compteur d'en-tête). */
export function countSearchHits(hits: ReadonlyArray<SearchHitVM>, kind: TypeKind): number {
  return hits.filter((hit) => hit.kind === kind).length;
}

export function mapTrendingRow(row: TrendingFeedRow): TrendingItemVM | null {
  const label = cleanText(row.label);
  if (!label) return null;
  return {
    kind: cleanText(row.kind) === 'tag' ? 'term' : 'place',
    label,
    hits: toNumber(row.hits) ?? 0,
  };
}

// ── Agenda ────────────────────────────────────────────────────────────────

/** Lignes `community_events_agenda` → `AgendaCounts` indexé par date ISO. */
export function mapAgendaRows(rows: ReadonlyArray<AgendaFeedRow> | null | undefined): AgendaCounts {
  const counts: AgendaCounts = {};
  for (const row of rows ?? []) {
    const day = cleanText(row.day).slice(0, 10);
    const count = toNumber(row.events_count);
    if (!day || count == null || count < 0) continue;
    counts[day] = count;
  }
  return counts;
}

// ── Étiquettes de tuile (accessibilité/lisibilité) ─────────────────────────

/** Date + heure lisibles d'une sortie : « samedi 14 novembre · 08:00 ». */
export function eventDateTimeLabel(event: EventCardVM): string {
  if (!event.startsAt) return formatDateFull(event.eventDate ? `${event.eventDate}T12:00:00+01:00` : null);
  const time = formatTime(event.startsAt);
  return `${formatDateFull(event.startsAt)}${time ? ` · ${time}` : ''}`;
}
