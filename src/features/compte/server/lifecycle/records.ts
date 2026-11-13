/**
 * Lot A02 — adaptateurs de lecture : tables sources → contrat unifié, puis
 * application de la surcouche de cycle de vie.
 *
 * Invariants :
 *  - aucune donnée n'est inventée : une valeur absente reste `null` ;
 *  - `activity_sessions` clôturées sont liées à leur résumé `hike_sessions`
 *    par `activity_session_id` : le résumé lié n'est pas compté deux fois ;
 *  - la trace brute d'origine n'est jamais écrasée, elle est seulement lue ;
 *  - une surcouche A02 est autoritaire pour l'activité qu'elle porte.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mergeUnifiedActivityHistory,
  normalizeExplorerActivitySession,
  normalizeLegacyHikeSession,
  type LifecycleActivityRecord,
  type LifecyclePoint,
} from '@/features/activity/lifecycle';
import type { LifecycleOverlayRow } from './types';

const MAX_SOURCE_ROWS = 500;
const POINTS_PAGE_SIZE = 1000;
const MAX_POINTS = 50_000;

/** Colonnes réellement présentes sur `hike_sessions` (aucune supposition). */
export const HIKE_SESSION_COLUMNS = [
  'id',
  'user_id',
  'route_id',
  'title',
  'started_at',
  'ended_at',
  'distance_km',
  'duration_seconds',
  'elevation_gain_m',
  'max_altitude_m',
  'positions_timed',
  'positions_geojson',
  'visibility',
  'kit_id',
  'notes',
  'variant_id',
  'activity_session_id',
].join(',');

/** Colonnes réellement présentes sur `activity_sessions`. */
export const ACTIVITY_SESSION_COLUMNS = [
  'id',
  'user_id',
  'sport',
  'variant_id',
  'route_id',
  'status',
  'started_at',
  'ended_at',
  'distance_m',
  'elev_gain_m',
  'moving_s',
  'share_level',
  'client_session_id',
  'created_at',
  'updated_at',
].join(',');

type HikeRow = {
  id: string;
  user_id: string;
  route_id: number | string | null;
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
  notes: string | null;
  variant_id: string | null;
  activity_session_id: string | null;
};

type ActivityRow = {
  id: string;
  user_id: string;
  sport: string;
  variant_id: string | null;
  route_id: number | string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  distance_m: number | string | null;
  elev_gain_m: number | string | null;
  moving_s: number | null;
  share_level: string | null;
  client_session_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type RouteRow = { id: number | string; name: string | null; region: string | null };

type ActivityPointRow = {
  t: string | null;
  lat: number | string;
  lng: number | string;
  ele: number | string | null;
  acc: number | string | null;
  speed: number | string | null;
};

function numeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function shareLevelVisibility(shareLevel: string | null): 'private' | 'collective_anonymized' {
  return shareLevel && shareLevel !== 'none' ? 'collective_anonymized' : 'private';
}

function activityPointToLifecycle(row: ActivityPointRow): LifecyclePoint | null {
  const lat = numeric(row.lat);
  const lng = numeric(row.lng);
  if (lat === null || lng === null) return null;
  return {
    lat,
    lng,
    elevationM: numeric(row.ele),
    timestamp: row.t,
    speedMs: numeric(row.speed),
    accuracyM: numeric(row.acc),
  };
}

async function loadRouteMap(
  supabase: SupabaseClient,
  routeIds: Array<number | string>
): Promise<Map<string, RouteRow>> {
  const unique = [...new Set(routeIds.map(String))].filter(Boolean);
  if (unique.length === 0) return new Map();
  const numericIds = unique.map(Number).filter((id) => Number.isFinite(id));
  const { data, error } = await supabase
    .from('hiking_routes')
    .select('id,name,region')
    .in('id', numericIds);
  if (error || !data) return new Map();
  return new Map(((data ?? []) as RouteRow[]).map((row) => [String(row.id), row]));
}

/** Trace paginée de `activity_points`, ordonnée et bornée. */
export async function loadActivityPoints(
  supabase: SupabaseClient,
  sessionId: string
): Promise<LifecyclePoint[]> {
  const points: LifecyclePoint[] = [];
  let offset = 0;
  while (offset < MAX_POINTS) {
    const { data, error } = await supabase
      .from('activity_points')
      .select('t,lat,lng,ele,acc,speed')
      .eq('session_id', sessionId)
      .order('t', { ascending: true })
      .range(offset, offset + POINTS_PAGE_SIZE - 1);
    if (error) break;
    const rows = (data ?? []) as ActivityPointRow[];
    for (const row of rows) {
      const point = activityPointToLifecycle(row);
      if (point) points.push(point);
    }
    if (rows.length < POINTS_PAGE_SIZE) break;
    offset += POINTS_PAGE_SIZE;
  }
  return points;
}

function normalizeHikeRow(row: HikeRow, routes: Map<string, RouteRow>, nowMs: number) {
  const route = row.route_id !== null ? routes.get(String(row.route_id)) : undefined;
  return normalizeLegacyHikeSession(
    {
      id: row.id,
      user_id: row.user_id,
      route_id: row.route_id,
      route_name: route?.name ?? null,
      massif: route?.region ?? null,
      title: row.title,
      notes: row.notes,
      started_at: row.started_at,
      ended_at: row.ended_at,
      distance_km: numeric(row.distance_km),
      duration_seconds: row.duration_seconds,
      elevation_gain_m: numeric(row.elevation_gain_m),
      max_altitude_m: row.max_altitude_m,
      positions_timed: row.positions_timed,
      positions_geojson: row.positions_geojson,
      visibility: row.visibility,
      kit_id: row.kit_id,
      variant_id: row.variant_id,
    },
    nowMs
  );
}

function normalizeActivityRow(
  row: ActivityRow,
  routes: Map<string, RouteRow>,
  nowMs: number,
  points: readonly LifecyclePoint[] = []
) {
  const route = row.route_id !== null ? routes.get(String(row.route_id)) : undefined;
  return normalizeExplorerActivitySession(
    {
      id: row.id,
      user_id: row.user_id,
      client_session_id: row.client_session_id,
      sport: row.sport,
      variant_id: row.variant_id,
      route_id: row.route_id,
      route_name: route?.name ?? null,
      massif: route?.region ?? null,
      started_at: row.started_at,
      ended_at: row.ended_at,
      visibility: shareLevelVisibility(row.share_level),
      kit_id: null,
      points,
      distance_m: numeric(row.distance_m),
      duration_seconds: row.moving_s,
      elevation_gain_m: numeric(row.elev_gain_m),
      origin: 'activity_session',
    },
    nowMs
  );
}

export interface LoadedSources {
  legacy: LifecycleActivityRecord[];
  explorer: LifecycleActivityRecord[];
}

/**
 * Charge l'historique source sans la surcouche.
 *
 * Les résumés `hike_sessions` liés à une `activity_sessions` présente dans la
 * fenêtre sont écartés : la séance Explorer porte la provenance et évite le
 * doublon. Un résumé lié dont la séance n'est pas dans la fenêtre est conservé.
 */
export async function loadSourceHistory(
  supabase: SupabaseClient,
  userId: string,
  options: { limit?: number; nowMs?: number } = {}
): Promise<LoadedSources> {
  const limit = Math.min(Math.max(options.limit ?? MAX_SOURCE_ROWS, 1), MAX_SOURCE_ROWS);
  const nowMs = options.nowMs ?? Date.now();

  const [hikeRes, activityRes] = await Promise.all([
    supabase
      .from('hike_sessions')
      .select(HIKE_SESSION_COLUMNS)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit),
    supabase
      .from('activity_sessions')
      .select(ACTIVITY_SESSION_COLUMNS)
      .eq('user_id', userId)
      .eq('status', 'finished')
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(limit),
  ]);

  const hikeRows = hikeRes.error ? [] : ((hikeRes.data ?? []) as HikeRow[]);
  const activityRows = activityRes.error ? [] : ((activityRes.data ?? []) as ActivityRow[]);
  const activityIds = new Set(activityRows.map((row) => row.id));

  const routes = await loadRouteMap(supabase, [
    ...hikeRows.map((row) => row.route_id).filter((id): id is number | string => id !== null),
    ...activityRows.map((row) => row.route_id).filter((id): id is number | string => id !== null),
  ]);

  const legacy = hikeRows
    .filter((row) => !(row.activity_session_id && activityIds.has(row.activity_session_id)))
    .map((row) => normalizeHikeRow(row, routes, nowMs));
  const explorer = activityRows.map((row) => normalizeActivityRow(row, routes, nowMs));
  return { legacy, explorer };
}

async function loadHikeRecord(
  supabase: SupabaseClient,
  userId: string,
  activityId: string,
  nowMs: number
): Promise<LifecycleActivityRecord | null> {
  const { data, error } = await supabase
    .from('hike_sessions')
    .select(HIKE_SESSION_COLUMNS)
    .eq('id', activityId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as HikeRow;
  const routes = await loadRouteMap(supabase, row.route_id !== null ? [row.route_id] : []);
  return normalizeHikeRow(row, routes, nowMs);
}

async function loadExplorerRecord(
  supabase: SupabaseClient,
  userId: string,
  activityId: string,
  nowMs: number
): Promise<LifecycleActivityRecord | null> {
  const { data, error } = await supabase
    .from('activity_sessions')
    .select(ACTIVITY_SESSION_COLUMNS)
    .eq('id', activityId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as ActivityRow;
  const [routes, points] = await Promise.all([
    loadRouteMap(supabase, row.route_id !== null ? [row.route_id] : []),
    loadActivityPoints(supabase, row.id),
  ]);
  return normalizeActivityRow(row, routes, nowMs, points);
}

/**
 * Charge une activité source précise (hors surcouche).
 * L'identifiant d'une partie fractionnée (`…__part_n`) n'existe que dans la
 * surcouche et renvoie donc `null` ici.
 */
export async function loadSourceRecord(
  supabase: SupabaseClient,
  userId: string,
  activityId: string,
  nowMs = Date.now()
): Promise<LifecycleActivityRecord | null> {
  const legacy = await loadHikeRecord(supabase, userId, activityId, nowMs);
  if (legacy) return legacy;
  return loadExplorerRecord(supabase, userId, activityId, nowMs);
}

export function overlayToRecord(overlay: LifecycleOverlayRow): LifecycleActivityRecord {
  const record = overlay.record;
  return {
    ...record,
    lifecycleStatus: overlay.lifecycleStatus,
    deletedAt: overlay.deletedAt,
    purgeAfter: overlay.purgeAfter,
    revision: Math.max(record.revision, overlay.revision),
  };
}

/** Applique la surcouche (autoritaire) sur une base éventuellement absente. */
export function applyOverlay(
  base: LifecycleActivityRecord | null,
  overlay: LifecycleOverlayRow | null
): LifecycleActivityRecord | null {
  return overlay ? overlayToRecord(overlay) : base;
}

/** Assemble historique source + surcouche, sans doublon et trié. */
export function mergeHistoryWithOverlays(
  sources: LoadedSources,
  overlays: readonly LifecycleOverlayRow[]
): LifecycleActivityRecord[] {
  const overlayById = new Map(overlays.map((row) => [row.activityId, row]));
  const base = mergeUnifiedActivityHistory(sources.legacy, sources.explorer).filter(
    (record) => !overlayById.has(record.id)
  );
  const covered = overlays.map(overlayToRecord);
  return [...base, ...covered].sort((a, b) => {
    const aMs = a.startedAt ? Date.parse(a.startedAt) : 0;
    const bMs = b.startedAt ? Date.parse(b.startedAt) : 0;
    if (bMs !== aMs) return bMs - aMs;
    return a.id.localeCompare(b.id);
  });
}
