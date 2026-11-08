/**
 * Communauté v2 — couche RPC typée du tiroir Explorer.
 *
 * Source de vérité : `handoff/communaute-v2/RPC-CONTRACTS.md` § 1-2 (les
 * colonnes de retour sont dans l'ordre exact des `RETURNS TABLE`). Ce module ne
 * contient AUCUN composant et AUCUN tri : il appelle les RPC de lecture, laisse
 * le serveur trier/paginer et renvoie les lignes brutes aux mappers.
 *
 * Contraintes :
 * - `createClient` est le seul canal Supabase (`@/lib/supabase/client`), jamais
 *   d'URL ni de clé en dur ;
 * - les erreurs PostgREST sont normalisées `{ code, message }` ; les erreurs
 *   applicatives des RPC d'écriture sont au format JSON `{code,message,field?}`
 *   dans `MESSAGE` (SQLSTATE P0001) et sont décodées dans `communityMutations.ts` ;
 * - aucune donnée de démonstration : un échec renvoie `{ error }`, jamais des
 *   lignes inventées.
 */

import { createClient } from '@/lib/supabase/client';
import type {
  CarnetFilter,
  CarnetSort,
  ClubFilter,
  ClubSort,
  EventFilter,
  SearchScope,
} from '../shared/types';

// ── Client minimal (structurellement compatible avec le client Supabase) ────

export interface RpcErrorLike {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

export interface SupabaseResult<T> {
  data: T | null;
  error: RpcErrorLike | null;
}

export interface RpcClientLike {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<SupabaseResult<unknown>>;
}

/** Chaîne PostgREST minimale (structurellement compatible avec `supabase-js`). */
export interface QueryChainLike extends PromiseLike<SupabaseResult<unknown>> {
  select: (columns?: string) => QueryChainLike;
  eq: (column: string, value: unknown) => QueryChainLike;
  neq: (column: string, value: unknown) => QueryChainLike;
  in: (column: string, values: readonly unknown[]) => QueryChainLike;
  gte: (column: string, value: unknown) => QueryChainLike;
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => QueryChainLike;
  limit: (count: number) => QueryChainLike;
  maybeSingle: () => PromiseLike<SupabaseResult<unknown>>;
  single: () => PromiseLike<SupabaseResult<unknown>>;
  insert: (values: unknown) => QueryChainLike;
  upsert: (values: unknown, options?: { onConflict?: string }) => QueryChainLike;
  delete: () => QueryChainLike;
}

/** Client de lecture/écriture du tiroir (injectable dans les tests). */
export interface DataClientLike extends RpcClientLike {
  from: (table: string) => QueryChainLike;
}

/** Client de lecture/écriture du tiroir (injectable dans les tests). */
export function getCommunityClient(): RpcClientLike {
  return createClient() as unknown as RpcClientLike;
}

/** Client complet (RPC + tables) pour les lectures RLS directes et le like. */
export function getDataClient(): DataClientLike {
  return createClient() as unknown as DataClientLike;
}

/** Normalise une erreur PostgREST en `{ code, message }` exploitable par l'UI. */
export function normalizeRpcError(error: RpcErrorLike | null | undefined): {
  code: string | null;
  message: string;
} | null {
  if (!error) return null;
  const message = (error.message ?? '').trim() || 'Le serveur est indisponible.';
  return { code: error.code ?? null, message };
}

/** Appelle une RPC et convertit toute exception réseau en résultat d'erreur. */
export async function callRpc<T>(
  fn: string,
  args: Record<string, unknown> | undefined,
  client: RpcClientLike = getCommunityClient(),
): Promise<SupabaseResult<T>> {
  try {
    const { data, error } = await client.rpc(fn, args);
    if (error) return { data: null, error };
    return { data: (data ?? null) as T | null, error: null };
  } catch (cause) {
    return {
      data: null,
      error: { message: cause instanceof Error ? cause.message : 'network_error' },
    };
  }
}

// ── Formes JSON des colonnes ───────────────────────────────────────────────

/** `travelers` / `friends` : `{ total, avatars: [{ id, name, avatar }] }`. */
export interface FeedPeopleJson {
  total?: number | string | null;
  avatars?: Array<{
    id?: string | null;
    name?: string | null;
    avatar?: string | null;
  }> | null;
}

export interface FeedCursor {
  /** `sort_key` de la dernière ligne de la page précédente. */
  v: number;
  id: string;
}

/** Colonnes numériques : PostgREST peut renvoyer un `number` ou une chaîne. */
export type NumericLike = number | string | null;

// ── Feeds (RPC-CONTRACTS § 2) ──────────────────────────────────────────────

export const FEED_PAGE_SIZE = 12;

/** `community_carnets_feed` — 22 colonnes, `sort_key` en dernier. */
export interface CarnetFeedRow {
  id: string;
  title: string | null;
  destination: string | null;
  cover_image: string | null;
  author_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  start_date: string | null;
  end_date: string | null;
  nb_nuits: NumericLike;
  route_distance_km: NumericLike;
  elevation_gain_m: NumericLike;
  likes_count: NumericLike;
  comments_count: NumericLike;
  liked_by_me: boolean | null;
  travelers: FeedPeopleJson | null;
  is_live: boolean | null;
  lat: NumericLike;
  lng: NumericLike;
  distance_km: NumericLike;
  visibility: string | null;
  sort_key: NumericLike;
}

/** `community_clubs_feed` — 21 colonnes, `sort_key` en dernier. */
export interface ClubFeedRow {
  id: string;
  slug: string | null;
  name: string | null;
  emoji: string | null;
  privacy: string | null;
  cover_image: string | null;
  cover_color: string | null;
  category: string | null;
  activities: string[] | null;
  location_label: string | null;
  members_count: NumericLike;
  is_verified: boolean | null;
  my_status: string | null;
  events_this_month: NumericLike;
  last_post_at: string | null;
  friends: FeedPeopleJson | null;
  lat: NumericLike;
  lng: NumericLike;
  distance_km: NumericLike;
  sort_key: NumericLike;
}

/** `community_events_feed` — 28 colonnes, `sort_key` en dernier. */
export interface EventFeedRow {
  id: string;
  title: string | null;
  activity: string | null;
  emoji: string | null;
  organizer_id: string | null;
  organizer_name: string | null;
  organizer_avatar: string | null;
  event_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  meeting_point: string | null;
  level: string | null;
  route_distance_km: NumericLike;
  elevation_gain_m: NumericLike;
  max_participants: NumericLike;
  current_participants: NumericLike;
  spots_left: NumericLike;
  waitlist_enabled: boolean | null;
  status: string | null;
  cover_image: string | null;
  my_status: string | null;
  friends: FeedPeopleJson | null;
  lat: NumericLike;
  lng: NumericLike;
  distance_km: NumericLike;
  sort_key: NumericLike;
}

export interface CarnetsFeedParams {
  filter: CarnetFilter;
  sort: CarnetSort;
  lat?: number | null;
  lng?: number | null;
  cursor?: FeedCursor | null;
  limit?: number;
}

export interface ClubsFeedParams {
  filter: ClubFilter;
  sort: ClubSort;
  activity?: string | null;
  lat?: number | null;
  lng?: number | null;
  cursor?: FeedCursor | null;
  limit?: number;
}

export interface EventsFeedParams {
  filter: EventFilter;
  /** Jour ISO `YYYY-MM-DD` de la bande agenda (ou `null`). */
  day?: string | null;
  lat?: number | null;
  lng?: number | null;
  cursor?: FeedCursor | null;
  limit?: number;
}

export async function fetchCarnetsPage(
  params: CarnetsFeedParams,
  client: RpcClientLike = getCommunityClient(),
): Promise<SupabaseResult<CarnetFeedRow[]>> {
  return callRpc<CarnetFeedRow[]>(
    'community_carnets_feed',
    {
      p_filter: params.filter,
      p_sort: params.sort,
      p_lat: params.lat ?? null,
      p_lng: params.lng ?? null,
      p_cursor: params.cursor ?? null,
      p_limit: params.limit ?? FEED_PAGE_SIZE,
    },
    client,
  );
}

export async function fetchClubsPage(
  params: ClubsFeedParams,
  client: RpcClientLike = getCommunityClient(),
): Promise<SupabaseResult<ClubFeedRow[]>> {
  return callRpc<ClubFeedRow[]>(
    'community_clubs_feed',
    {
      p_filter: params.filter,
      p_sort: params.sort,
      p_activity: params.activity ?? null,
      p_lat: params.lat ?? null,
      p_lng: params.lng ?? null,
      p_cursor: params.cursor ?? null,
      p_limit: params.limit ?? FEED_PAGE_SIZE,
    },
    client,
  );
}

export async function fetchEventsPage(
  params: EventsFeedParams,
  client: RpcClientLike = getCommunityClient(),
): Promise<SupabaseResult<EventFeedRow[]>> {
  return callRpc<EventFeedRow[]>(
    'community_events_feed',
    {
      p_filter: params.filter,
      p_day: params.day ?? null,
      p_lat: params.lat ?? null,
      p_lng: params.lng ?? null,
      p_cursor: params.cursor ?? null,
      p_limit: params.limit ?? FEED_PAGE_SIZE,
    },
    client,
  );
}

// ── Recherche (RPC-CONTRACTS § 1) ─────────────────────────────────────────

/** Filtres de contexte de la recherche (chips « Ce week-end », « Facile »…). */
export interface SearchFilters {
  weekend?: boolean;
  level?: 'facile' | 'moyen' | 'difficile';
  max_hours?: number;
  near?: boolean;
  max_km?: number;
}

/** `community_search` — 11 colonnes, une ligne par résultat. */
export interface SearchFeedRow {
  kind: string;
  id: string;
  title: string | null;
  subtitle: string | null;
  cover: string | null;
  href: string | null;
  score: NumericLike;
  lat: NumericLike;
  lng: NumericLike;
  distance_km: NumericLike;
  starts_at: string | null;
}

export interface CommunitySearchParams {
  q: string;
  scope: SearchScope;
  lat?: number | null;
  lng?: number | null;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

/** `p_limit` de la recherche : par branche, le plafond SQL est 30. */
export const SEARCH_BRANCH_LIMIT = 5;

export async function fetchSearchPage(
  params: CommunitySearchParams,
  client: RpcClientLike = getCommunityClient(),
): Promise<SupabaseResult<SearchFeedRow[]>> {
  return callRpc<SearchFeedRow[]>(
    'community_search',
    {
      p_q: params.q,
      p_scope: params.scope,
      p_limit: params.limit ?? SEARCH_BRANCH_LIMIT,
      p_offset: params.offset ?? 0,
      p_lat: params.lat ?? null,
      p_lng: params.lng ?? null,
      p_filters: params.filters ?? {},
    },
    client,
  );
}

export interface TrendingFeedRow {
  kind: string;
  label: string;
  hits: NumericLike;
}

/** `community_search_trending` — lieux et tags des 7 derniers jours. */
export async function fetchTrending(
  limit = 8,
  client: RpcClientLike = getCommunityClient(),
): Promise<SupabaseResult<TrendingFeedRow[]>> {
  return callRpc<TrendingFeedRow[]>('community_search_trending', { p_limit: limit }, client);
}

export interface AgendaFeedRow {
  day: string;
  events_count: NumericLike;
}

/** `community_events_agenda` — une ligne par jour de la bande agenda. */
export async function fetchAgenda(
  fromIso: string | null,
  days = 14,
  client: RpcClientLike = getCommunityClient(),
): Promise<SupabaseResult<AgendaFeedRow[]>> {
  return callRpc<AgendaFeedRow[]>(
    'community_events_agenda',
    { p_from: fromIso, p_days: days },
    client,
  );
}
