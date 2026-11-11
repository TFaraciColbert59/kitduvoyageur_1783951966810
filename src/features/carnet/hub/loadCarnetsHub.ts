import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { fetchPublicProfilesWith, type PublicProfile } from '@/lib/queries/publicProfilesCore';
import {
  isoCountry,
  mapAvatar,
  nonEmptyText,
  normalizeRouteTrace,
} from '@/features/community/v2/data/communityFeedMappers';
import { carnetJourney } from './phase';
import type { CarnetHubItem, CarnetsHubData, HubPerson } from './types';

/**
 * Carnets de bord — hub `/carnets` : chargeur serveur.
 *
 * La RPC `community_carnets_feed` n'existe pas en production : le hub lit donc
 * les **tables** directement, avec le client serveur à cookies (`createClient`)
 * — la RLS voit la session, jamais de clé de service. Bornes de lecture :
 * - ~60 carnets publics triés `updated_at` desc ;
 * - mes carnets (y compris privés : la RLS les rend à leur auteur) ;
 * - les carnets des personnes suivies (`user_follows.follower_id = lecteur`).
 *
 * Erreurs partielles tolérées : sans couverture de repli, sans voyageurs ou
 * sans j'aime du lecteur, la carte s'affiche quand même. Seule la lecture
 * principale (les carnets) peut basculer l'écran en état d'erreur.
 */

const PUBLIC_LIMIT = 60;
const FOLLOWED_LIMIT = 40;
const MINE_LIMIT = 24;
const FOLLOWED_MAX = 200;
const MOMENTS_LIMIT = 300;
const COLLABORATORS_LIMIT = 400;
const TRAVELERS_SHOWN = 3;
const COVER_PHOTOS_MAX = 3;

/** Colonnes lues sur `carnets` (contrat du lot L1). */
const CARNET_COLUMNS = [
  'id',
  'author_id',
  'title',
  'destination',
  'cover_image',
  'start_date',
  'end_date',
  'visibility',
  'country_iso',
  'live_sharing',
  'map_points',
  'distance_km',
  'denivele_m',
  'nb_nuits',
  'nb_voyageurs',
  'likes_count',
  'comments_count',
  'verified',
  'created_at',
  'updated_at',
].join(', ');

/**
 * Jeu de colonnes de repli quand `live_sharing` n'est pas encore appliquée en
 * base (même tolérance que la fiche Carnet : PostgREST renvoie `42703`).
 */
const CARNET_COLUMNS_WITHOUT_LIVE = [
  'id',
  'author_id',
  'title',
  'destination',
  'cover_image',
  'start_date',
  'end_date',
  'visibility',
  'country_iso',
  'map_points',
  'distance_km',
  'denivele_m',
  'nb_nuits',
  'nb_voyageurs',
  'likes_count',
  'comments_count',
  'verified',
  'created_at',
  'updated_at',
].join(', ');

// ── Client minimal (structurellement compatible avec le client Supabase) ─────

export interface HubQueryErrorLike {
  code?: string | null;
  message?: string | null;
}

export interface HubQueryResultLike<T = unknown> {
  data: T[] | null;
  error: HubQueryErrorLike | null;
}

export interface HubQueryLike<T = unknown> extends PromiseLike<HubQueryResultLike<T>> {
  select: (columns?: string) => HubQueryLike<T>;
  eq: (column: string, value: unknown) => HubQueryLike<T>;
  in: (column: string, values: ReadonlyArray<unknown>) => HubQueryLike<T>;
  not: (column: string, operator: string, value: unknown) => HubQueryLike<T>;
  order: (column: string, options?: { ascending?: boolean }) => HubQueryLike<T>;
  limit: (count: number) => HubQueryLike<T>;
}

export interface HubAuthLike {
  getUser: () => PromiseLike<{ data: { user: { id?: string | null } | null } | null }>;
}

export interface HubClientLike {
  from: (table: string) => HubQueryLike<unknown>;
  auth: HubAuthLike;
}

export interface LoadCarnetsHubOptions {
  /** Client injectable (tests) ; par défaut le client serveur à cookies. */
  client?: HubClientLike;
  /** Instant de référence (tests) ; par défaut maintenant. */
  now?: Date;
}

interface CarnetRow {
  id: string;
  author_id: string | null;
  title: string | null;
  destination: string | null;
  cover_image: string | null;
  start_date: string | null;
  end_date: string | null;
  country_iso: string | null;
  live_sharing?: boolean | null;
  map_points?: unknown;
  distance_km?: number | string | null;
  denivele_m?: number | string | null;
  nb_nuits?: number | string | null;
  nb_voyageurs?: number | string | null;
  likes_count?: number | string | null;
  comments_count?: number | string | null;
  verified?: boolean | null;
  updated_at?: string | null;
}

interface MomentRow {
  carnet_id: string | null;
  image_url: string | null;
}

interface CollaboratorRow {
  carnet_id: string | null;
  user_id: string | null;
}

// ── Petites conversions tolérantes ───────────────────────────────────────────

function finiteNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Entier positif ou zéro ; les colonnes `integer default 0` sont tolérées en texte. */
function nonNegativeInt(value: number | string | null | undefined): number {
  const parsed = finiteNumber(value);
  if (parsed == null || parsed <= 0) return 0;
  return Math.round(parsed);
}

function nonNegativeFloat(value: number | string | null | undefined): number {
  const parsed = finiteNumber(value);
  if (parsed == null || parsed <= 0) return 0;
  return Math.round(parsed * 10) / 10;
}

/** `map_points` peut être l'objet `{trace, days}` ou directement un tableau de points. */
function extractMapTrace(mapPoints: unknown): unknown {
  if (Array.isArray(mapPoints)) return mapPoints;
  if (mapPoints && typeof mapPoints === 'object') {
    return (mapPoints as { trace?: unknown }).trace ?? null;
  }
  return null;
}

function personFor(id: string | null | undefined, profile: PublicProfile | undefined): HubPerson {
  const avatar = mapAvatar({
    id: id ?? null,
    name: profile?.full_name,
    handle: profile?.handle,
    avatar: profile?.avatar_url,
  });
  return {
    id: avatar.id,
    name: avatar.name,
    initials: avatar.initials,
    avatarUrl: avatar.avatarUrl ?? null,
  };
}

// ── Lecture primaire des carnets ────────────────────────────────────────────

type CarnetFilterBuilder = (query: HubQueryLike<unknown>) => HubQueryLike<unknown>;

/**
 * Lit `carnets` avec un jeu de colonnes, puis rejoue la requête sans
 * `live_sharing` si la colonne manque (`42703`). `ok=false` = échec total.
 */
async function readCarnets(
  client: HubClientLike,
  build: CarnetFilterBuilder,
): Promise<{ rows: CarnetRow[]; ok: boolean }> {
  const primary = await build(client.from('carnets').select(CARNET_COLUMNS));
  if (!primary.error) return { rows: (primary.data ?? []) as CarnetRow[], ok: true };
  if (primary.error.code === '42703') {
    const fallback = await build(client.from('carnets').select(CARNET_COLUMNS_WITHOUT_LIVE));
    if (!fallback.error) return { rows: (fallback.data ?? []) as CarnetRow[], ok: true };
  }
  return { rows: [], ok: false };
}

/** Écriture auxiliaire : un échec ne fait jamais tomber le hub (erreur partielle). */
async function safeRows<T>(query: HubQueryLike<unknown>): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

function mergeById(...groups: CarnetRow[][]): CarnetRow[] {
  const byId = new Map<string, CarnetRow>();
  for (const group of groups) {
    for (const row of group) {
      if (!row?.id) continue;
      // Premier passage gagnant : l'ordre public (updated_at desc) fait autorité.
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

const PHASE_RANK: Record<CarnetHubItem['phase'], number> = {
  en_route: 0,
  preparation: 1,
  rentre: 2,
};

// ── Chargeur ────────────────────────────────────────────────────────────────

/**
 * Charge le hub : carnets lisibles sous RLS, auteurs, voyageurs, photos de
 * repli et j'aime du lecteur. Ne lève pas : l'échec de la lecture principale
 * ressort en `error: true` (l'écran propose « Réessayer »).
 */
export async function loadCarnetsHub(options: LoadCarnetsHubOptions = {}): Promise<CarnetsHubData> {
  const now = options.now ?? new Date();

  let client: HubClientLike;
  if (options.client) {
    client = options.client;
  } else {
    try {
      client = (await createClient()) as unknown as HubClientLike;
    } catch {
      return { viewerId: null, items: [], mineCount: 0, followedCount: 0, error: true };
    }
  }

  // 1. Lecteur (jamais bloquant : sans session, le hub reste public).
  let viewerId: string | null = null;
  try {
    const { data } = await client.auth.getUser();
    viewerId = data?.user?.id ?? null;
  } catch {
    viewerId = null;
  }

  // 2. Les carnets publics : lecture principale, seule juge de l'état d'erreur.
  const publicResult = await readCarnets(client, (query) =>
    query.eq('visibility', 'public').order('updated_at', { ascending: false }).limit(PUBLIC_LIMIT),
  );
  if (!publicResult.ok) {
    return { viewerId, items: [], mineCount: 0, followedCount: 0, error: true };
  }

  // 3. Personnes suivies (RLS : la relation est déjà bornée au lecteur).
  let followingIds: string[] = [];
  if (viewerId) {
    const follows = await safeRows<{ following_id: string | null }>(
      client
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', viewerId)
        .limit(FOLLOWED_MAX),
    );
    followingIds = follows
      .map((row) => row.following_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
  }
  const following = new Set(followingIds);

  // 4. Mes carnets (privés compris : la RLS les rend à leur auteur).
  let mineRows: CarnetRow[] = [];
  if (viewerId) {
    const result = await readCarnets(client, (query) =>
      query.eq('author_id', viewerId).order('updated_at', { ascending: false }).limit(MINE_LIMIT),
    );
    mineRows = result.rows;
  }

  // 5. Les carnets des personnes suivies.
  let followedRows: CarnetRow[] = [];
  if (followingIds.length > 0) {
    const result = await readCarnets(client, (query) =>
      query
        .in('author_id', followingIds)
        .order('updated_at', { ascending: false })
        .limit(FOLLOWED_LIMIT),
    );
    followedRows = result.rows;
  }

  const rows = mergeById(publicResult.rows, followedRows, mineRows);
  if (rows.length === 0) {
    return { viewerId, items: [], mineCount: 0, followedCount: 0, error: false };
  }
  const carnetIds = rows.map((row) => row.id);

  // 6. Photos de repli : 3 dernières images de moments par carnet.
  const moments = await safeRows<MomentRow>(
    client
      .from('carnet_moments')
      .select('carnet_id, image_url, created_at')
      .in('carnet_id', carnetIds)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(MOMENTS_LIMIT),
  );
  const coverPhotos = new Map<string, string[]>();
  for (const moment of moments) {
    const carnetId = moment.carnet_id;
    const imageUrl = nonEmptyText(moment.image_url);
    if (!carnetId || !imageUrl) continue;
    const list = coverPhotos.get(carnetId) ?? [];
    if (list.length >= COVER_PHOTOS_MAX) continue; // 3 photos de repli, pas plus
    list.push(imageUrl);
    coverPhotos.set(carnetId, list);
  }

  // 7. Voyageurs (collaborateurs) et j'aime du lecteur.
  const collaborators = await safeRows<CollaboratorRow>(
    client
      .from('carnet_collaborators')
      .select('carnet_id, user_id, role, created_at')
      .in('carnet_id', carnetIds)
      .order('created_at', { ascending: true })
      .limit(COLLABORATORS_LIMIT),
  );
  const collaboratorsByCarnet = new Map<string, string[]>();
  for (const collaborator of collaborators) {
    const carnetId = collaborator.carnet_id;
    const userId = collaborator.user_id;
    if (!carnetId || !userId) continue;
    const list = collaboratorsByCarnet.get(carnetId) ?? [];
    list.push(userId);
    collaboratorsByCarnet.set(carnetId, list);
  }

  let likedCarnetIds = new Set<string>();
  if (viewerId) {
    const likes = await safeRows<{ carnet_id: string | null }>(
      client
        .from('carnet_likes')
        .select('carnet_id')
        .eq('user_id', viewerId)
        .in('carnet_id', carnetIds),
    );
    likedCarnetIds = new Set(
      likes
        .map((like) => like.carnet_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );
  }

  // 8. Auteurs et voyageurs en une lecture (`public_profiles`, borné à 200 ids).
  const profileIds = [
    ...rows.map((row) => row.author_id),
    ...collaborators.map((collaborator) => collaborator.user_id),
  ];
  let profiles: Record<string, PublicProfile> = {};
  try {
    profiles = await fetchPublicProfilesWith(
      client as unknown as SupabaseClient,
      profileIds,
    );
  } catch {
    profiles = {};
  }

  // 9. Assemblage : une ligne = une carte, aucune donnée inventée.
  const items: CarnetHubItem[] = rows.map((row) => {
    const authorId = row.author_id ?? '';
    const author = personFor(row.author_id, authorId ? profiles[authorId] : undefined);
    const journey = carnetJourney(row.start_date, row.end_date, now);

    const travelerIds = (collaboratorsByCarnet.get(row.id) ?? []).slice(0, TRAVELERS_SHOWN);
    const travelers = travelerIds.map((userId) => personFor(userId, profiles[userId]));
    // Sans collaborateur déclaré, l'auteur est le seul voyageur visible.
    const visibleTravelers = travelers.length > 0 ? travelers : [author];

    return {
      id: row.id,
      title: nonEmptyText(row.title) ?? 'Carnet sans titre',
      destination: nonEmptyText(row.destination) ?? '',
      coverImage: nonEmptyText(row.cover_image),
      coverPhotos: coverPhotos.get(row.id) ?? [],
      routeTrace: normalizeRouteTrace(extractMapTrace(row.map_points)),
      countryIso: isoCountry(row.country_iso),
      startDate: nonEmptyText(row.start_date),
      endDate: nonEmptyText(row.end_date),
      phase: journey.phase,
      daysTotal: journey.daysTotal,
      dayCurrent: journey.dayCurrent,
      distanceKm: nonNegativeFloat(row.distance_km),
      elevationGainM: nonNegativeInt(row.denivele_m),
      nights: nonNegativeInt(row.nb_nuits),
      travelers: visibleTravelers,
      travelersTotal: Math.max(
        nonNegativeInt(row.nb_voyageurs),
        visibleTravelers.length,
        1,
      ),
      author,
      likesCount: nonNegativeInt(row.likes_count),
      commentsCount: nonNegativeInt(row.comments_count),
      likedByMe: likedCarnetIds.has(row.id),
      verifiedGps: Boolean(row.verified),
      liveSharing: Boolean(row.live_sharing),
      isMine: Boolean(viewerId) && row.author_id === viewerId,
      isFollowed: row.author_id != null && following.has(row.author_id),
    };
  });

  // En route d'abord (bande « En route maintenant »), puis les prochains départs,
  // puis les carnets rentrés — l'ordre de lecture serveur reste stable sinon.
  items.sort((a, b) => PHASE_RANK[a.phase] - PHASE_RANK[b.phase]);

  return {
    viewerId,
    items,
    mineCount: items.filter((item) => item.isMine).length,
    followedCount: items.filter((item) => item.isFollowed).length,
    error: false,
  };
}
