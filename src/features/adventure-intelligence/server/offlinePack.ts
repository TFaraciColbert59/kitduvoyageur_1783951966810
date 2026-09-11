/**
 * A13 (S6) — Pack aventure hors-ligne (serveur, client injecté).
 *
 * Assemble le pack réel d'une aventure pour `offline_pack` :
 * - plan version courante (`adventure_plan_versions`), projeté sans aucune
 *   donnée privée d'autres membres (jamais `displayName`/`profileId`, jamais
 *   les décisions) ;
 * - géométries OSM des segments via `a13_segment_geometries` (bornées 500) ;
 * - prédictions persistées (`route_predictions`, `segment_predictions`) ;
 * - POI eau/refuges sur la bbox réelle des géométries (`get_trail_pois_bbox`) ;
 * - conditions Terrain Live autour du premier point réel de la route.
 *
 * Bornes strictes : segments ≤ 500, POI ≤ 150, signalements ≤ 50, prédictions
 * plafonnées, taille sérialisée ≤ `MAX_OFFLINE_PACK_BYTES` — au-delà, le pack
 * est tronqué explicitement (`offline_pack_truncated`), jamais silencieusement
 * ni au-delà du plafond. Client injecté : testable sans réseau.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdventurePlan } from '../domain/adventurePlan';
import {
  MAX_OFFLINE_PACK_BYTES,
  MAX_OFFLINE_PACK_POIS,
  MAX_OFFLINE_PACK_PREDICTIONS,
  MAX_OFFLINE_PACK_SEGMENTS,
  MAX_OFFLINE_PACK_TERRAIN,
  OFFLINE_PACK_GEOMETRY_MISSING_WARNING,
  OFFLINE_PACK_PLAN_NOT_FOUND_WARNING,
  OFFLINE_PACK_POI_UNAVAILABLE_WARNING,
  OFFLINE_PACK_TERRAIN_DISABLED_WARNING,
  OFFLINE_PACK_TERRAIN_UNAVAILABLE_WARNING,
  OFFLINE_PACK_TRUNCATED_WARNING,
  OFFLINE_PACK_VERSION,
  type OfflineAdventurePack,
  type OfflinePackPlanSnapshot,
} from '../domain/offlinePack';
import type { StoredAdventurePlan } from './generateAdventure';
import { getAdventurePlan } from './generateAdventure';
import {
  MAX_SEGMENT_IDS_PER_CALL,
  type SegmentGeometryRow,
} from './routePrediction';
import {
  TERRAIN_ROUTE_RADIUS_M,
  TRAIL_POI_BBOX_MARGIN_DEG,
  TRAIL_POI_LIMIT,
  createSupabaseLiveSourcesClient,
  type RouteBbox,
  type TrailPoiRow,
} from './liveSources';
import { createSupabaseTerrainReportsClient, listNearbyTerrainReports } from './terrainReports';
import type { TerrainLiveReport } from '@/features/terrain-live/lib/terrainDisplay';

export {
  MAX_OFFLINE_PACK_BYTES,
  MAX_OFFLINE_PACK_POIS,
  MAX_OFFLINE_PACK_PREDICTIONS,
  MAX_OFFLINE_PACK_SEGMENTS,
  MAX_OFFLINE_PACK_TERRAIN,
  OFFLINE_PACK_GEOMETRY_MISSING_WARNING,
  OFFLINE_PACK_PLAN_NOT_FOUND_WARNING,
  OFFLINE_PACK_POI_UNAVAILABLE_WARNING,
  OFFLINE_PACK_TERRAIN_DISABLED_WARNING,
  OFFLINE_PACK_TERRAIN_UNAVAILABLE_WARNING,
  OFFLINE_PACK_TRUNCATED_WARNING,
  OFFLINE_PACK_VERSION,
};
export type {
  OfflineAdventurePack,
  OfflinePackPlanSnapshot,
  OfflinePackPredictions,
  OfflinePackVersion,
} from '../domain/offlinePack';

export interface OfflinePackClient {
  getPlanBundle(planId: string): Promise<StoredAdventurePlan | null>;
  getSegmentGeometries(ids: number[]): Promise<SegmentGeometryRow[]>;
  listRoutePredictions(planId: string, userId: string): Promise<Record<string, unknown>[]>;
  listSegmentPredictions(userId: string, segmentIds: number[]): Promise<Record<string, unknown>[]>;
  listTrailPoisBbox(bbox: RouteBbox, limit: number): Promise<TrailPoiRow[]>;
  listTerrainReportsNear(query: {
    lat: number;
    lng: number;
    radiusM: number;
  }): Promise<TerrainLiveReport[]>;
}

export interface OfflinePackRequest {
  adventureId: string;
  userId: string;
  now?: string;
  featureFlags?: Record<string, boolean>;
}

export interface OfflinePackResult {
  pack: OfflineAdventurePack | null;
  warnings: string[];
}

/**
 * Projection publique du plan : le pack ne transporte jamais le nom, le profil
 * ni l'identité de décision d'autres membres. L'id opaque de participant est
 * conservé pour l'affichage local.
 */
export function sanitizeOfflinePlan(plan: AdventurePlan): OfflinePackPlanSnapshot {
  return {
    id: plan.id,
    title: plan.title ?? null,
    status: plan.status,
    currentVersion: plan.currentVersion,
    confidence: plan.confidence,
    intent: plan.intent,
    participants: (plan.participants ?? []).map((participant) => ({
      id: participant.id,
      role: participant.role,
    })),
    dates: plan.dates,
    destinations: plan.destinations,
    sections: plan.sections,
    monitoringRules: plan.monitoringRules,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

/** Ids de segments réels du plan (stratégies d'allure + segments critiques). */
export function collectOfflineSegmentIds(plan: AdventurePlan): number[] {
  const section = plan.sections.paceStrategies as { value?: unknown } | null;
  const value = section && typeof section === 'object' ? section.value : null;
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  const ids: number[] = [];

  const push = (candidate: unknown) => {
    const id = Number(candidate);
    if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
  };

  if (record) {
    if (Array.isArray(record.stepSources)) {
      for (const step of record.stepSources as unknown[]) {
        if (step && typeof step === 'object') push((step as { segmentId?: unknown }).segmentId);
      }
    }
    if (Array.isArray(record.segmentsCritical)) {
      for (const id of record.segmentsCritical as unknown[]) push(id);
    }
    const primary =
      record.primary && typeof record.primary === 'object'
        ? (record.primary as Record<string, unknown>)
        : null;
    if (primary && Array.isArray(primary.criticalSegmentIds)) {
      for (const id of primary.criticalSegmentIds as unknown[]) push(id);
    }
  }

  return ids.slice(0, MAX_OFFLINE_PACK_SEGMENTS);
}

/** Bbox réelle des géométries de segments (marge POI appliquée ensuite). */
export function bboxFromSegmentGeometries(
  geometries: readonly SegmentGeometryRow[]
): RouteBbox | null {
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let found = false;

  for (const geometry of geometries) {
    const geojson = geometry.geojson as { type?: unknown; coordinates?: unknown } | null;
    if (!geojson || geojson.type !== 'LineString' || !Array.isArray(geojson.coordinates)) continue;
    for (const coordinate of geojson.coordinates as unknown[]) {
      if (!Array.isArray(coordinate) || coordinate.length < 2) continue;
      const lng = Number(coordinate[0]);
      const lat = Number(coordinate[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      found = true;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
  }

  return found ? { minLat, maxLat, minLng, maxLng } : null;
}

/** Premier point réel d'une géométrie de segment (jamais extrapolé). */
export function firstGeometryPoint(
  geometries: readonly SegmentGeometryRow[]
): { lat: number; lng: number } | null {
  for (const geometry of geometries) {
    const geojson = geometry.geojson as { type?: unknown; coordinates?: unknown } | null;
    if (!geojson || geojson.type !== 'LineString' || !Array.isArray(geojson.coordinates)) continue;
    for (const coordinate of geojson.coordinates as unknown[]) {
      if (!Array.isArray(coordinate) || coordinate.length < 2) continue;
      const lng = Number(coordinate[0]);
      const lat = Number(coordinate[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  return null;
}

function expandBbox(bbox: RouteBbox, marginDeg: number): RouteBbox {
  return {
    minLat: bbox.minLat - marginDeg,
    maxLat: bbox.maxLat + marginDeg,
    minLng: bbox.minLng - marginDeg,
    maxLng: bbox.maxLng + marginDeg,
  };
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Assemble le pack complet. Plan absent ⇒ `pack: null` + warning, aucun appel
 * superflu. Les erreurs d'une source optionnelle (POI, Terrain Live) laissent
 * la source vide avec warning : jamais de donnée inventée.
 */
export async function buildOfflinePack(
  request: OfflinePackRequest,
  client: OfflinePackClient
): Promise<OfflinePackResult> {
  const now = request.now ?? new Date().toISOString();
  const warnings: string[] = [];

  const bundle = await client.getPlanBundle(request.adventureId);
  if (!bundle) {
    return { pack: null, warnings: [OFFLINE_PACK_PLAN_NOT_FOUND_WARNING] };
  }

  const segmentIds = collectOfflineSegmentIds(bundle.plan);
  if (segmentIds.length === 0) warnings.push(OFFLINE_PACK_GEOMETRY_MISSING_WARNING);

  const [segments, segmentPredictions, routePredictions] = await Promise.all([
    (async () => {
      const all: SegmentGeometryRow[] = [];
      for (let start = 0; start < segmentIds.length; start += MAX_SEGMENT_IDS_PER_CALL) {
        const chunk = segmentIds.slice(start, start + MAX_SEGMENT_IDS_PER_CALL);
        all.push(...(await client.getSegmentGeometries(chunk)));
      }
      return all.slice(0, MAX_OFFLINE_PACK_SEGMENTS);
    })(),
    segmentIds.length > 0
      ? client.listSegmentPredictions(request.userId, segmentIds)
      : Promise.resolve([] as Record<string, unknown>[]),
    client.listRoutePredictions(request.adventureId, request.userId),
  ]);
  if (segments.length === 0 && segmentIds.length > 0) {
    warnings.push(OFFLINE_PACK_GEOMETRY_MISSING_WARNING);
  }

  let pois: TrailPoiRow[] = [];
  const bbox = bboxFromSegmentGeometries(segments);
  if (bbox) {
    try {
      pois = (await client.listTrailPoisBbox(expandBbox(bbox, TRAIL_POI_BBOX_MARGIN_DEG), MAX_OFFLINE_PACK_POIS)).slice(
        0,
        MAX_OFFLINE_PACK_POIS
      );
    } catch {
      warnings.push(OFFLINE_PACK_POI_UNAVAILABLE_WARNING);
    }
  }

  let terrain: TerrainLiveReport[] = [];
  if (request.featureFlags?.terrain_live === true) {
    const point = firstGeometryPoint(segments);
    if (point) {
      try {
        terrain = (
          await client.listTerrainReportsNear({
            ...point,
            radiusM: TERRAIN_ROUTE_RADIUS_M,
          })
        ).slice(0, MAX_OFFLINE_PACK_TERRAIN);
      } catch {
        warnings.push(OFFLINE_PACK_TERRAIN_UNAVAILABLE_WARNING);
      }
    }
  } else {
    warnings.push(OFFLINE_PACK_TERRAIN_DISABLED_WARNING);
  }

  const working = {
    version: OFFLINE_PACK_VERSION as typeof OFFLINE_PACK_VERSION,
    adventureId: request.adventureId,
    userId: request.userId,
    generatedAt: now,
    sizeBytes: 9_999_999,
    capped: false,
    plan: sanitizeOfflinePlan(bundle.plan),
    planVersion: bundle.version
      ? {
          version: bundle.version.version,
          reason: bundle.version.reason,
          generatedBy: bundle.version.generatedBy,
          confidence: bundle.version.confidence,
          createdAt: bundle.version.createdAt,
        }
      : null,
    segments: segments.slice(),
    predictions: {
      route: routePredictions.slice(0, MAX_OFFLINE_PACK_PREDICTIONS),
      segments: segmentPredictions.slice(0, MAX_OFFLINE_PACK_SEGMENTS),
    },
    pois: pois.slice(0, MAX_OFFLINE_PACK_POIS),
    terrain: terrain.slice(0, MAX_OFFLINE_PACK_TERRAIN),
    warnings: [...warnings],
  };

  const sizeOf = () => byteLength(working);
  if (sizeOf() > MAX_OFFLINE_PACK_BYTES) {
    working.capped = true;
    working.terrain = [];
  }
  while (sizeOf() > MAX_OFFLINE_PACK_BYTES && working.pois.length > 0) {
    working.pois = working.pois.slice(0, Math.floor(working.pois.length / 2));
  }
  while (sizeOf() > MAX_OFFLINE_PACK_BYTES && working.predictions.segments.length > 0) {
    working.predictions.segments = working.predictions.segments.slice(
      0,
      Math.floor(working.predictions.segments.length / 2)
    );
  }
  while (sizeOf() > MAX_OFFLINE_PACK_BYTES && working.segments.length > 0) {
    working.segments = working.segments.slice(0, Math.floor(working.segments.length / 2));
    const kept = new Set(working.segments.map((segment) => segment.id));
    working.predictions.segments = working.predictions.segments.filter((row) =>
      kept.has(Number(row.segment_id))
    );
  }

  if (working.capped) {
    working.warnings.push(OFFLINE_PACK_TRUNCATED_WARNING);
  }
  const pack: OfflineAdventurePack = { ...working, sizeBytes: sizeOf() };
  return { pack, warnings: [...warnings] };
}

// ── Adaptateur Supabase (client de session injecté) ──────────────────────────

/**
 * Adaptateur Supabase : réutilise strictement les modules serveur existants
 * (`getAdventurePlan`, `a13_segment_geometries`, `route_predictions`,
 * `segment_predictions`, `get_trail_pois_bbox`, `a5_terrain_reports_near`).
 * Le client de session applique la RLS : l'ownership est vérifiée à la source.
 */
export function createSupabaseOfflinePackClient(
  supabase: SupabaseClient
): OfflinePackClient {
  const liveClient = createSupabaseLiveSourcesClient(supabase);
  const terrainClient = createSupabaseTerrainReportsClient(supabase);
  return {
    getPlanBundle: (planId) => getAdventurePlan(supabase, planId),

    async getSegmentGeometries(ids) {
      if (ids.length === 0) return [];
      if (ids.length > MAX_SEGMENT_IDS_PER_CALL) {
        throw new Error(
          `offline-pack: ${MAX_SEGMENT_IDS_PER_CALL} ids maximum par appel de géométries.`
        );
      }
      const { data, error } = await supabase.rpc('a13_segment_geometries', { p_ids: ids });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: Number(row.id),
        geojson: row.geojson,
        surface: row.surface == null ? null : String(row.surface),
        sacScale: row.sac_scale == null ? null : String(row.sac_scale),
        highway: row.highway == null ? null : String(row.highway),
      }));
    },

    async listRoutePredictions(planId, userId) {
      const { data, error } = await supabase
        .from('route_predictions')
        .select('*')
        .eq('plan_id', planId)
        .eq('user_id', userId)
        .order('computed_at', { ascending: false })
        .limit(MAX_OFFLINE_PACK_PREDICTIONS);
      if (error) throw new Error(error.message);
      return (data ?? []) as Record<string, unknown>[];
    },

    async listSegmentPredictions(userId, segmentIds) {
      if (segmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from('segment_predictions')
        .select(
          'segment_id, context_hash, predicted_duration_p50, predicted_duration_p90, predicted_effort, personal_difficulty, recommended_pause_s, confidence, model_version, computed_at'
        )
        .eq('user_id', userId)
        .in('segment_id', segmentIds)
        .limit(MAX_OFFLINE_PACK_SEGMENTS);
      if (error) throw new Error(error.message);
      return (data ?? []) as Record<string, unknown>[];
    },

    listTrailPoisBbox: (bbox, limit) => liveClient.listTrailPoisBbox(bbox, limit),

    listTerrainReportsNear: (query) => listNearbyTerrainReports(query, terrainClient),
  };
}
