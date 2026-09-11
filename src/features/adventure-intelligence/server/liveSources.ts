/**
 * A13 (S4) — Sources vivantes du plan : Terrain Live, eau/refuges OSM.
 *
 * Chaque source est déterministe et vérifiable :
 * - `liveConditions` : prévisions officielles déjà calculées (adaptateur météo)
 *   + signalements Terrain Live autour de la route via `a5_terrain_reports_near`
 *   (points échantillonnés bornés, rayon borné, dédoublonnage par id) ;
 * - `foodAndWater` : points d'eau et refuges réels de `trail_pois` via
 *   `get_trail_pois_bbox` (bbox de la route élargie d'une marge fixe),
 *   provenance `official` (OSM) ;
 * - `regulations` / `documents` : aucune source déterministe n'existe dans le
 *   dépôt ⇒ sections `null` + avertissements dédiés (jamais inventées).
 *
 * Aucune valeur n'est jamais fabriquée : une source absente ou en échec laisse
 * la section `null` avec un warning explicite. Client injecté : testable sans
 * réseau, zéro dépendance Supabase dans les fonctions.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { makeConfidence } from '../domain/confidence';
import type { EngineWarning, Assumption } from '../domain/engine';
import type { PlanValue } from '../domain/adventurePlan';
import type { DataProvenance } from '../domain/provenance';
import type { TerrainLiveReport } from '@/features/terrain-live/lib/terrainDisplay';
import {
  createSupabaseTerrainReportsClient,
  listNearbyTerrainReports,
} from './terrainReports';
import {
  documentsAdapter,
  regulationsAdapter,
} from './adapters/skippedAdapters';

/** Rayon demandé autour de chaque point route échantillonné (mètres). */
export const TERRAIN_ROUTE_RADIUS_M = 3000;
/** Borne haute du rayon Terrain Live (mètres). */
export const TERRAIN_ROUTE_MAX_RADIUS_M = 5000;
/** Borne basse du rayon Terrain Live (mètres). */
export const TERRAIN_ROUTE_MIN_RADIUS_M = 250;
/** Nombre maximal de points route interrogés (bounded, déterministe). */
export const TERRAIN_ROUTE_SAMPLE_POINTS = 5;
/** Nombre maximal de POI lus sur la bbox route. */
export const TRAIL_POI_LIMIT = 150;
/** Marge appliquée à la bbox route avant lecture des POI (degrés ~110 m). */
export const TRAIL_POI_BBOX_MARGIN_DEG = 0.001;

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export interface RouteBbox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Ligne de `get_trail_pois_bbox` (lecture OSM publique). */
export interface TrailPoiRow {
  id: number;
  name: string | null;
  category: string | null;
  description: string | null;
  lat: number;
  lng: number;
  tags: Record<string, unknown> | null;
}

export interface TerrainNearbyQuery {
  lat: number;
  lng: number;
  radiusM: number;
}

/** Client de données injecté — lecture seule, chaque méthode bornée. */
export interface LiveSourcesClient {
  listTerrainReportsNear(query: TerrainNearbyQuery): Promise<TerrainLiveReport[]>;
  listTrailPoisBbox(bbox: RouteBbox, limit: number): Promise<TrailPoiRow[]>;
}

export const LIVE_CONDITIONS_NO_SOURCE_WARNING: EngineWarning = {
  code: 'live_conditions_no_source',
  message:
    'Aucune condition vivante disponible (ni météo officielle ni signalement Terrain Live) — section liveConditions laissée vide (aucune donnée inventée).',
  severity: 'warning',
};

export const FOOD_WATER_NO_SOURCE_WARNING: EngineWarning = {
  code: 'food_water_no_source',
  message:
    'Aucun point d’eau ni refuge OSM trouvé sur la bbox de la route — section foodAndWater laissée vide (aucune donnée inventée).',
  severity: 'warning',
};

export const TERRAIN_LIVE_UNAVAILABLE_WARNING: EngineWarning = {
  code: 'terrain_live_unavailable',
  message:
    'Signalements Terrain Live indisponibles autour de la route (lecture en échec) — aucune condition inventée.',
  severity: 'warning',
};

export const TERRAIN_LIVE_PARTIAL_WARNING: EngineWarning = {
  code: 'terrain_live_partial',
  message:
    'Signalements Terrain Live lus partiellement autour de la route (certains points en échec) — seuls les signalements réellement reçus sont inclus.',
  severity: 'info',
};

/** Réexportés pour une surface unique des avertissements sans source. */
export const REGULATIONS_NO_DETERMINISTIC_SOURCE_WARNING = regulationsAdapter.skipReason;
export const DOCUMENTS_NO_DETERMINISTIC_SOURCE_WARNING = documentsAdapter.skipReason;

function finiteCoordinate(point: { lat: number; lng: number }): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

/** Bbox réelle de la route (marge exclue) ; `null` sans point exploitable. */
export function routeBbox(
  polyline: RouteCoordinate[] | null | undefined
): RouteBbox | null {
  const points = (polyline ?? []).filter(finiteCoordinate);
  if (points.length === 0) return null;
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

/** Élargit une bbox d'une marge en degrés (clampée aux bornes terrestres). */
export function expandBbox(bbox: RouteBbox, marginDeg: number): RouteBbox {
  const margin = Number.isFinite(marginDeg) ? Math.max(0, marginDeg) : 0;
  return {
    minLat: Math.max(-90, bbox.minLat - margin),
    maxLat: Math.min(90, bbox.maxLat + margin),
    minLng: Math.max(-180, bbox.minLng - margin),
    maxLng: Math.min(180, bbox.maxLng + margin),
  };
}

/**
 * Échantillon borné des points route (premier, dernier et points régulièrement
 * espacés). Déterministe, sans point inventé : ce sont des points réels.
 */
export function sampleRoutePoints(
  polyline: RouteCoordinate[],
  max = TERRAIN_ROUTE_SAMPLE_POINTS
): RouteCoordinate[] {
  const points = polyline.filter(finiteCoordinate);
  const boundedMax = Math.max(1, Math.trunc(max));
  if (points.length <= boundedMax) return points.map((point) => ({ ...point }));

  const sampled: RouteCoordinate[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < boundedMax; index += 1) {
    const sourceIndex = Math.round((index * (points.length - 1)) / (boundedMax - 1));
    const point = points[sourceIndex];
    const key = `${point.lat}:${point.lng}`;
    if (!seen.has(key)) {
      seen.add(key);
      sampled.push({ ...point });
    }
  }
  return sampled;
}

/** Borne le rayon Terrain Live dans [MIN, MAX] ; valeur non finie ⇒ défaut. */
export function clampTerrainRadiusM(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return TERRAIN_ROUTE_RADIUS_M;
  return Math.min(
    TERRAIN_ROUTE_MAX_RADIUS_M,
    Math.max(TERRAIN_ROUTE_MIN_RADIUS_M, Math.trunc(value))
  );
}

function dedupeWarnings(warnings: EngineWarning[]): EngineWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.severity}|${warning.code}|${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface LiveConditionsInput {
  /** Section météo officielle déjà calculée (adaptateur A11), ou `null`. */
  weatherSection: PlanValue<unknown> | null;
  /** Signalements Terrain Live réels autour de la route (jamais inventés). */
  terrainReports: TerrainLiveReport[];
  now: string;
}

/**
 * Fusionne météo officielle et Terrain Live. Sans météo ni signalement :
 * `null` + warning. Sans signalement mais météo présente : section météo
 * inchangée (provenance et forme d'origine préservées).
 */
export function buildLiveConditionsSection(input: LiveConditionsInput): {
  section: PlanValue<unknown> | null;
  warnings: EngineWarning[];
} {
  const reports = input.terrainReports.filter(
    (report) =>
      Number.isFinite(report.lat) &&
      Number.isFinite(report.lng) &&
      typeof report.id === 'string' &&
      report.id.length > 0
  );

  if (reports.length === 0) {
    if (input.weatherSection) return { section: input.weatherSection, warnings: [] };
    return { section: null, warnings: [LIVE_CONDITIONS_NO_SOURCE_WARNING] };
  }

  const weather = input.weatherSection;
  const provenance: DataProvenance[] = [...(weather?.provenance ?? [])];
  provenance.push({
    source: 'community',
    sourceRef: 'a5_terrain_reports_near',
    observedAt: input.now,
    notes: `${reports.length} signalement(s) Terrain Live autour de la route.`,
  });
  const officialCount = reports.filter((report) => report.sourceType === 'official').length;
  if (officialCount > 0) {
    provenance.push({
      source: 'official',
      sourceRef: 'terrain_reports:official',
      observedAt: input.now,
      notes: `${officialCount} signalement(s) officiel(s) Terrain Live.`,
    });
  }

  const baseValue =
    weather && weather.value !== null && typeof weather.value === 'object'
      ? (weather.value as Record<string, unknown>)
      : { weather: null };
  const assumptions: Assumption[] = [
    ...(weather?.assumptions ?? []),
    {
      id: 'live_conditions_terrain_reports',
      label: 'Signalements Terrain Live communautaires',
      detail: `${reports.length} signalement(s) réels reçus de a5_terrain_reports_near, jamais complétés artificiellement.`,
    },
  ];

  return {
    section: {
      value: { ...baseValue, terrainReports: reports },
      confidence: makeConfidence({
        score: weather ? 0.65 : 0.55,
        sampleCount: reports.length + (weather?.confidence.sampleCount ?? 0),
        method: weather ? 'live-sources:weather+terrain' : 'live-sources:terrain',
        reasons: [
          `${reports.length} signalement(s) Terrain Live`,
          ...(weather ? ['Prévisions officielles Open-Meteo'] : []),
        ],
      }),
      provenance,
      assumptions,
      warnings: [...(weather?.warnings ?? [])],
      impacts: [],
      computedAt: input.now,
      validUntil: weather?.validUntil,
    },
    warnings: [],
  };
}

const WATER_CATEGORY_PATTERN = /water|spring|source|fontaine|drinking/i;
const REFUGE_CATEGORY_PATTERN = /refuge|shelter|cabane|gite|hut|alpine|wilderness/i;

function poiAltitude(tags: Record<string, unknown> | null): number | null {
  const raw = tags?.ele;
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

function poiPotable(tags: Record<string, unknown> | null): boolean | null {
  const raw = tags?.drinking_water;
  if (raw === 'yes' || raw === true) return true;
  if (raw === 'no' || raw === false) return false;
  return null;
}

export interface FoodWaterInput {
  /** Bbox de la route (marge exclue) ; `null` sans route exploitable. */
  bbox: RouteBbox | null;
  /** POI réels de `get_trail_pois_bbox` (bbox route élargie). */
  pois: TrailPoiRow[];
  now: string;
}

/**
 * Construit `foodAndWater` depuis les POI OSM eau/refuges uniquement.
 * Aucun POI hors périmètre n'est intégré ; absence ⇒ `null` + warning.
 */
export function buildFoodWaterSection(input: FoodWaterInput): {
  section: PlanValue<unknown> | null;
  warnings: EngineWarning[];
} {
  if (!input.bbox || input.pois.length === 0) {
    return { section: null, warnings: [FOOD_WATER_NO_SOURCE_WARNING] };
  }

  const waterPoints: Record<string, unknown>[] = [];
  const refuges: Record<string, unknown>[] = [];
  const seen = new Set<number>();
  for (const poi of input.pois) {
    if (!finiteCoordinate(poi) || typeof poi.id !== 'number') continue;
    if (seen.has(poi.id)) continue;
    seen.add(poi.id);
    const category = poi.category ?? '';
    if (WATER_CATEGORY_PATTERN.test(category)) {
      waterPoints.push({
        id: poi.id,
        name: poi.name,
        lat: poi.lat,
        lng: poi.lng,
        altitudeM: poiAltitude(poi.tags),
        potable: poiPotable(poi.tags),
      });
      continue;
    }
    if (REFUGE_CATEGORY_PATTERN.test(category)) {
      refuges.push({
        id: poi.id,
        name: poi.name,
        lat: poi.lat,
        lng: poi.lng,
        altitudeM: poiAltitude(poi.tags),
      });
    }
  }

  if (waterPoints.length === 0 && refuges.length === 0) {
    return { section: null, warnings: [FOOD_WATER_NO_SOURCE_WARNING] };
  }

  return {
    section: {
      value: {
        routeBbox: input.bbox,
        waterPoints,
        refuges,
        waterCount: waterPoints.length,
        refugeCount: refuges.length,
      },
      confidence: makeConfidence({
        score: 0.65,
        sampleCount: waterPoints.length + refuges.length,
        method: 'live-sources:trail-pois',
        reasons: [
          `${waterPoints.length} point(s) d’eau et ${refuges.length} refuge(s) OSM sur la bbox de route`,
        ],
      }),
      provenance: [
        {
          source: 'official',
          sourceRef: 'osm:trail_pois',
          observedAt: input.now,
          notes: 'POI OSM lus via get_trail_pois_bbox, filtrés eau/refuges.',
        },
      ],
      assumptions: [
        {
          id: 'food_water_osm_bbox',
          label: 'POI OSM sur la bbox de la route',
          detail:
            'Seuls les points d’eau et refuges réellement retournés par la RPC sont inclus.',
        },
      ],
      warnings: [],
      impacts: [],
      computedAt: input.now,
    },
    warnings: [],
  };
}

export interface ResolveLiveSourcesInput {
  polyline: RouteCoordinate[] | null;
  weatherSection: PlanValue<unknown> | null;
  fallbackFoodWater: PlanValue<unknown> | null;
  now: string;
  client: LiveSourcesClient | null;
}

export interface ResolvedLiveSources {
  liveConditions: PlanValue<unknown> | null;
  foodAndWater: PlanValue<unknown> | null;
  warnings: EngineWarning[];
}

/**
 * Interroge les sources réelles (client injecté) et assemble les sections.
 * Chaque appel est borné ; un échec partiel laisse la source absente plutôt
 * que de fabriquer une valeur.
 */
export async function resolveLiveSources(
  input: ResolveLiveSourcesInput
): Promise<ResolvedLiveSources> {
  const polyline = (input.polyline ?? []).filter(finiteCoordinate);
  const bbox = routeBbox(polyline);
  const warnings: EngineWarning[] = [];

  let terrainReports: TerrainLiveReport[] = [];
  if (input.client && polyline.length >= 2) {
    const points = sampleRoutePoints(polyline);
    const radiusM = clampTerrainRadiusM(TERRAIN_ROUTE_RADIUS_M);
    const byId = new Map<string, TerrainLiveReport>();
    let failures = 0;
    for (const point of points) {
      try {
        const nearby = await input.client.listTerrainReportsNear({ ...point, radiusM });
        for (const report of nearby) {
          if (!byId.has(report.id)) byId.set(report.id, report);
        }
      } catch {
        failures += 1;
      }
    }
    terrainReports = [...byId.values()];
    if (failures > 0) {
      warnings.push(
        failures === points.length
          ? TERRAIN_LIVE_UNAVAILABLE_WARNING
          : TERRAIN_LIVE_PARTIAL_WARNING
      );
    }
  }

  const live = buildLiveConditionsSection({
    weatherSection: input.weatherSection,
    terrainReports,
    now: input.now,
  });
  warnings.push(...live.warnings);

  let foodAndWater = input.fallbackFoodWater;
  if (input.client && bbox) {
    const queryBbox = expandBbox(bbox, TRAIL_POI_BBOX_MARGIN_DEG);
    let pois: TrailPoiRow[] = [];
    try {
      pois = await input.client.listTrailPoisBbox(queryBbox, TRAIL_POI_LIMIT);
    } catch {
      pois = [];
    }
    const built = buildFoodWaterSection({ bbox: queryBbox, pois, now: input.now });
    if (built.section) foodAndWater = built.section;
    warnings.push(...built.warnings);
  }

  return {
    liveConditions: live.section ?? input.weatherSection,
    foodAndWater,
    warnings: dedupeWarnings(warnings),
  };
}

// ── Adaptateur Supabase (service_role) ───────────────────────────────────────

/**
 * Adaptateur service_role : réutilise strictement les modules serveur A5/A1
 * existants (`a5_terrain_reports_near`, `get_trail_pois_bbox`), aucune
 * nouvelle requête ad hoc.
 */
export function createSupabaseLiveSourcesClient(client: SupabaseClient): LiveSourcesClient {
  const reportsClient = createSupabaseTerrainReportsClient(client);
  return {
    listTerrainReportsNear: (query) => listNearbyTerrainReports(query, reportsClient),
    async listTrailPoisBbox(bbox, limit) {
      const { data, error } = await client.rpc('get_trail_pois_bbox', {
        min_lng: bbox.minLng,
        min_lat: bbox.minLat,
        max_lng: bbox.maxLng,
        max_lat: bbox.maxLat,
        p_limit: limit,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[])
        .map((row) => ({
          id: Number(row.id),
          name: row.name == null ? null : String(row.name),
          category: row.category == null ? null : String(row.category),
          description: row.description == null ? null : String(row.description),
          lat: Number(row.lat),
          lng: Number(row.lng),
          tags:
            row.tags !== null && typeof row.tags === 'object'
              ? (row.tags as Record<string, unknown>)
              : null,
        }))
        .filter((row) => Number.isFinite(row.id) && finiteCoordinate(row));
    },
  };
}
