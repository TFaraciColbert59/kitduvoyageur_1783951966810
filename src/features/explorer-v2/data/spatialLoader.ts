/**
 * Explorer v2 — Smart Spatial Loading, Buffer Coverage, Cache Ring & Loading State Machine.
 *
 * Eliminates pan/zoom flicker, redundant network fetches, and sudden POI wipes:
 * - Zoom-adaptive spatial grid quantization (`quantizePlaceQuery`)
 * - 1.45× viewport buffer coverage check (`expandBounds`, `isBoundsCovered`)
 * - Spatial Cache Ring (`mergeSpatialPois`, `mergeSpatialRoutes`) keeping visible items
 *   smoothly populated across pans instead of wiping on every move
 * - Zoom & active-category adaptive 3D LOD (`lod3DBudgetForZoom`, `categoryPriorityBonus`)
 * - Unified anti-flicker loading state hook (`useExplorerLoadingState`) driving the
 *   Option B top-right SVG ring indicator
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PoiItem } from './hooks';
import type { MapBbox } from './unifiedLayersHooks';

export interface SpatialCoverageBox extends MapBbox {
  zoomBucket: number;
}

export type ExplorerLoadingPhase = 'idle' | 'loading' | 'ready' | 'error';

export interface ExplorerLoadingSignals {
  mapTilesLoading?: boolean;
  placeFetching?: boolean;
  layersFetching?: boolean;
  glbPendingCount?: number;
  hasError?: boolean;
  isMoving?: boolean;
}

export interface ExplorerLoadingSummary {
  phase: ExplorerLoadingPhase;
  activeSources: string[];
  label: string;
}

/**
 * Maps continuous MapLibre zoom into stable coarse buckets so micro-zooms
 * inside the same band never bust query caches.
 */
export function zoomBucketFor(zoom: number): number {
  const z = Number.isFinite(zoom) ? zoom : 11;
  if (z < 5.5) return 4;
  if (z < 8.5) return 7;
  if (z < 11) return 10;
  if (z < 13) return 12;
  if (z < 15) return 14;
  return 16;
}

/**
 * Quantizes (lat, lng, zoom) onto a zoom-adaptive spatial cell grid.
 * Prevents micro-pans (~100–400 m) from triggering redundant `/api/explorer/v2/place` fetches.
 */
export function quantizePlaceQuery(
  lat: number,
  lng: number,
  zoom: number,
): { lat: number; lng: number; zoomBucket: number; key: string } {
  const safeLat = Number.isFinite(lat) ? Math.max(-85, Math.min(85, lat)) : 48.85;
  const safeLng = Number.isFinite(lng) ? Math.max(-180, Math.min(180, lng)) : 2.35;
  const zoomBucket = zoomBucketFor(zoom);

  // Cell step in degrees scales with zoom level (~1.1 km at z>=13, ~4 km at z=11, ~18 km at z=8)
  const stepDeg =
    zoomBucket >= 14
      ? 0.01
      : zoomBucket >= 12
        ? 0.02
        : zoomBucket >= 10
          ? 0.05
          : zoomBucket >= 7
            ? 0.2
            : 0.8;

  const qLat = Math.round(safeLat / stepDeg) * stepDeg;
  const qLng = Math.round(safeLng / stepDeg) * stepDeg;
  const decimals = stepDeg < 0.02 ? 3 : stepDeg < 0.1 ? 2 : 1;
  const fLat = Number(qLat.toFixed(decimals));
  const fLng = Number(qLng.toFixed(decimals));

  return {
    lat: Object.is(fLat, -0) ? 0 : fLat,
    lng: Object.is(fLng, -0) ? 0 : fLng,
    zoomBucket,
    key: `${fLat.toFixed(decimals)},${fLng.toFixed(decimals)}@${zoomBucket}`,
  };
}

/**
 * Expands a bounding box by `factor` (default 1.45×) around its center to create
 * a spatial over-fetch buffer so gentle pans inside the same valley incur 0 network calls.
 */
export function expandBounds(bbox: MapBbox, factor = 1.45): MapBbox {
  const f = Math.max(1, Math.min(3, factor));
  const latSpan = Math.max(0.01, Math.abs(bbox.north - bbox.south));
  const lngSpan = Math.max(0.01, Math.abs(bbox.east - bbox.west));
  const padLat = (latSpan * (f - 1)) / 2;
  const padLng = (lngSpan * (f - 1)) / 2;
  return {
    south: Math.max(-85, bbox.south - padLat),
    north: Math.min(85, bbox.north + padLat),
    west: Math.max(-180, bbox.west - padLng),
    east: Math.min(180, bbox.east + padLng),
  };
}

/**
 * Returns true if `viewport` is still completely contained inside an already-loaded
 * spatial buffer box at a compatible zoom bucket.
 */
export function isBoundsCovered(
  viewport: MapBbox | null | undefined,
  loaded: SpatialCoverageBox | null | undefined,
  zoomBucket: number,
): boolean {
  if (!viewport || !loaded) return false;
  if (Math.abs(loaded.zoomBucket - zoomBucket) > 2) return false;
  const loadedLatSpan = loaded.north - loaded.south;
  const viewLatSpan = viewport.north - viewport.south;
  // If user zoomed way in (>3.5× smaller span), refresh for higher local detail
  if (viewLatSpan > 0 && loadedLatSpan / viewLatSpan > 3.5) return false;
  return (
    viewport.south >= loaded.south &&
    viewport.north <= loaded.north &&
    viewport.west >= loaded.west &&
    viewport.east <= loaded.east
  );
}

/**
 * Checks whether a geographic coordinate (lat, lng) lies inside the currently viewed
 * map viewport (plus a small proportional edge cushion so items right on the screen
 * border do not flicker while panning).
 * Never inflates a tight local view into a distant 20–30 km search area.
 */
export function isPointInViewport(
  lat: number,
  lng: number,
  bbox: MapBbox | null | undefined,
  options?: { padRatio?: number; minPadDeg?: number },
): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (!bbox) return true;
  const padRatio = options?.padRatio ?? 0.12;
  const minPadDeg = options?.minPadDeg ?? 0.004; // ~450 m edge cushion at street zoom
  const latSpan = Math.max(0.002, Math.abs(bbox.north - bbox.south));
  const lngSpan = Math.max(0.002, Math.abs(bbox.east - bbox.west));
  const padLat = Math.max(minPadDeg, latSpan * padRatio);
  const padLng = Math.max(minPadDeg, lngSpan * padRatio);
  return (
    lat >= bbox.south - padLat &&
    lat <= bbox.north + padLat &&
    lng >= bbox.west - padLng &&
    lng <= bbox.east + padLng
  );
}

/**
 * Checks whether a GeoJSON geometry (route LineString / MultiLineString / Feature)
 * intersects the currently viewed map viewport (with proportional edge cushion).
 */
export function isGeoJsonInViewport(
  geojson: unknown,
  bbox: MapBbox | null | undefined,
  options?: { padRatio?: number; minPadDeg?: number },
): boolean {
  if (!bbox) return true;
  if (!geojson || typeof geojson !== 'object') return false;
  const padRatio = options?.padRatio ?? 0.14;
  const minPadDeg = options?.minPadDeg ?? 0.005;
  const latSpan = Math.max(0.002, Math.abs(bbox.north - bbox.south));
  const lngSpan = Math.max(0.002, Math.abs(bbox.east - bbox.west));
  const south = bbox.south - Math.max(minPadDeg, latSpan * padRatio);
  const north = bbox.north + Math.max(minPadDeg, latSpan * padRatio);
  const west = bbox.west - Math.max(minPadDeg, lngSpan * padRatio);
  const east = bbox.east + Math.max(minPadDeg, lngSpan * padRatio);

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let foundAny = false;

  const visit = (node: unknown): boolean => {
    if (!node) return false;
    if (Array.isArray(node)) {
      if (
        node.length >= 2 &&
        typeof node[0] === 'number' &&
        typeof node[1] === 'number' &&
        Number.isFinite(node[0]) &&
        Number.isFinite(node[1])
      ) {
        const lng = node[0];
        const lat = node[1];
        foundAny = true;
        if (lat >= south && lat <= north && lng >= west && lng <= east) {
          return true;
        }
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        return false;
      }
      // Stride through huge coordinate arrays while always checking endpoints
      const step = node.length > 64 ? Math.ceil(node.length / 48) : 1;
      for (let i = 0; i < node.length; i += step) {
        if (visit(node[i])) return true;
      }
      if (step > 1 && node.length > 0 && visit(node[node.length - 1])) return true;
      return false;
    }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (obj.type === 'Feature') return visit(obj.geometry);
      if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
        for (const f of obj.features) {
          if (visit(f)) return true;
        }
        return false;
      }
      if (obj.coordinates) return visit(obj.coordinates);
    }
    return false;
  };

  if (visit(geojson)) return true;
  if (!foundAny) return false;
  // Also accept long trails whose bounding box crosses the viewport even if vertices sit outside
  return !(maxLat < south || minLat > north || maxLng < west || minLng > east);
}

/**
 * Computes a clean, cache-friendly search radius in km matching the currently viewed
 * map viewport half-diagonal (e.g., 2 km at village zoom → 50 km at regional zoom).
 */
export function viewportRadiusKm(
  bbox: MapBbox | null | undefined,
  minKm = 2,
  maxKm = 50,
): number {
  if (!bbox) return Math.min(maxKm, Math.max(minKm, 10));
  const midLat = (bbox.south + bbox.north) / 2;
  const dLatKm = Math.abs(bbox.north - bbox.south) * 111.32;
  const dLngKm =
    Math.abs(bbox.east - bbox.west) * 111.32 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const halfDiag = Math.hypot(dLatKm, dLngKm) / 2;
  const raw = Math.max(minKm, Math.min(maxKm, halfDiag * 1.15));
  if (raw <= 3) return Math.max(minKm, 2);
  if (raw <= 6) return Math.max(minKm, 5);
  if (raw <= 12) return Math.max(minKm, 10);
  if (raw <= 22) return Math.min(maxKm, 20);
  if (raw <= 38) return Math.min(maxKm, 35);
  return maxKm;
}

/**
 * Spatial Cache Ring for POIs: merges freshly loaded POIs by `id` while retaining
 * previously loaded nearby POIs so panning NEVER wipes the map blank.
 * Evicts only the farthest items beyond `maxItems`.
 */
export function mergeSpatialPois(
  prev: readonly PoiItem[],
  incoming: readonly PoiItem[],
  center: [number, number],
  maxItems = 140,
): PoiItem[] {
  if (incoming.length === 0) return prev.length <= maxItems ? [...prev] : prev.slice(0, maxItems);
  const byId = new Map<string, PoiItem>();
  for (const item of prev) {
    if (item && item.id) byId.set(item.id, item);
  }
  for (const item of incoming) {
    if (item && item.id) byId.set(item.id, item);
  }
  const merged = Array.from(byId.values());
  if (merged.length <= maxItems) return merged;

  const [cLng, cLat] = center;
  return merged
    .sort((a, b) => {
      const da = (a.lon - cLng) ** 2 + (a.lat - cLat) ** 2;
      const db = (b.lon - cLng) ** 2 + (b.lat - cLat) ** 2;
      return da - db;
    })
    .slice(0, maxItems);
}

/**
 * Spatial Cache Ring for routes: merges incoming routes by `id` while preserving
 * currently rendered trails across gentle pans.
 */
export function mergeSpatialRoutes<T extends { id: number | string }>(
  prev: readonly T[],
  incoming: readonly T[],
  maxItems = 45,
): T[] {
  if (incoming.length === 0) return prev.length <= maxItems ? [...prev] : prev.slice(0, maxItems);
  const byId = new Map<string, T>();
  // Place incoming first so fresh routes sit at the head when slicing
  for (const r of incoming) {
    byId.set(String(r.id), r);
  }
  for (const r of prev) {
    const key = String(r.id);
    if (!byId.has(key)) byId.set(key, r);
  }
  return Array.from(byId.values()).slice(0, maxItems);
}

const MAJOR_REGIONAL_3D_KINDS = new Set([
  'summit',
  'saddle',
  'viewpoint',
  'refuge',
  'bivouac',
  'city',
  'village',
  'carnet',
  'bottle',
  'club',
  'club_event',
  'story',
  'fire',
  'flood',
  'seismic',
  'rescue',
  'danger',
  'aircraft',
  'pokedex',
  'pokedex_flora',
  'pokedex_bird',
  'pokedex_mammal',
  'pokedex_fungi',
  'pokedex_insect',
  'pokedex_aqua',
]);

/**
 * Zoom-adaptive 3D diorama density budget so world/regional views stay calm and crisp
 * while local terrain reveals the full 34-asset catalog.
 */
export function lod3DBudgetForZoom(zoom: number): {
  maxItems: number;
  allowKind: (kind: string, selected: boolean) => boolean;
} {
  const z = Number.isFinite(zoom) ? zoom : 12;
  if (z < 5.2) {
    return {
      maxItems: 8,
      allowKind: (kind, selected) =>
        selected ||
        kind === 'bottle' ||
        kind === 'carnet' ||
        kind === 'fire' ||
        kind === 'flood' ||
        kind === 'seismic',
    };
  }
  if (z < 10.2) {
    return {
      maxItems: 16,
      allowKind: (kind, selected) => selected || MAJOR_REGIONAL_3D_KINDS.has(kind),
    };
  }
  return {
    maxItems: 32,
    allowKind: () => true,
  };
}

/**
 * Priority boost for 3D entities that match the user's currently active drawer category,
 * ensuring relevant models always win screen-space collision slots.
 */
export function categoryPriorityBonus(kind: string, activeCategory?: string | null): number {
  if (!activeCategory) return 0;
  switch (activeCategory) {
    case 'pokedex':
      return kind === 'pokedex' || kind.startsWith('pokedex_') ? 65 : -10;
    case 'safety':
      return kind === 'fire' ||
        kind === 'flood' ||
        kind === 'seismic' ||
        kind === 'danger' ||
        kind === 'rescue' ||
        kind === 'water' ||
        kind === 'spring' ||
        kind === 'refuge' ||
        kind === 'wilderness_hut' ||
        kind === 'shelter'
        ? 55
        : -8;
    case 'community':
      return kind === 'bottle' ||
        kind === 'carnet' ||
        kind === 'club' ||
        kind === 'club_event' ||
        kind === 'story' ||
        kind === 'friend'
        ? 60
        : -10;
    case 'explorer':
      return kind === 'summit' ||
        kind === 'saddle' ||
        kind === 'viewpoint' ||
        kind === 'refuge' ||
        kind === 'bivouac' ||
        kind === 'water' ||
        kind === 'spring'
        ? 18
        : 0;
    default:
      return 0;
  }
}

export const LOADING_GRACE_MS = 180;
export const LOADING_MIN_HOLD_MS = 420;
export const READY_FLASH_MS = 1100;

/**
 * Aggregates map tile activity, API queries, and 3D GLB decoding into a single
 * calm anti-flicker loading phase (`idle` → `loading` → `ready` → `idle` / `error`)
 * for the top-right Option B SVG progress ring.
 */
export function useExplorerLoadingState(signals: ExplorerLoadingSignals): ExplorerLoadingSummary {
  const {
    mapTilesLoading = false,
    placeFetching = false,
    layersFetching = false,
    glbPendingCount = 0,
    hasError = false,
    isMoving = false,
  } = signals;

  const isRawBusy =
    !isMoving &&
    (Boolean(mapTilesLoading) ||
      Boolean(placeFetching) ||
      Boolean(layersFetching) ||
      glbPendingCount > 0);

  const activeSources = useMemo(() => {
    const out: string[] = [];
    if (mapTilesLoading) out.push('Relief');
    if (placeFetching) out.push('Spots');
    if (layersFetching) out.push('Calques');
    if (glbPendingCount > 0) out.push('3D');
    return out;
  }, [mapTilesLoading, placeFetching, layersFetching, glbPendingCount]);

  const [phase, setPhase] = useState<ExplorerLoadingPhase>('idle');
  const loadingStartedAtRef = useRef<number>(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (hasError && !isRawBusy) {
      setPhase('error');
      return;
    }

    if (isRawBusy) {
      if (phase === 'loading') return;
      timer = setTimeout(() => {
        loadingStartedAtRef.current = Date.now();
        setPhase('loading');
      }, LOADING_GRACE_MS);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }

    // Transition from `loading` -> brief emerald `ready` pulse -> `idle`
    if (phase === 'loading') {
      const elapsed = Date.now() - loadingStartedAtRef.current;
      const remaining = Math.max(0, LOADING_MIN_HOLD_MS - elapsed);
      timer = setTimeout(() => {
        setPhase('ready');
      }, remaining);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }

    if (phase === 'ready') {
      timer = setTimeout(() => {
        setPhase('idle');
      }, READY_FLASH_MS);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }

    return undefined;
  }, [isRawBusy, hasError, phase]);

  const label =
    phase === 'loading'
      ? activeSources.length > 0
        ? `Chargement : ${activeSources.join(' · ')}`
        : 'Chargement de la zone…'
      : phase === 'ready'
        ? 'Zone chargée'
        : phase === 'error'
          ? 'Chargement partiel — réessayer'
          : 'Fond de carte';

  return { phase, activeSources, label };
}
