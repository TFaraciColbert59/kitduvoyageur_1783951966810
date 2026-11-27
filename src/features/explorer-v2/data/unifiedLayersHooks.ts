'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { ExplorerApiMeta, GeoJsonFeatureCollection } from '@/lib/explorer/edgeCache';
import {
  expandBounds,
  isBoundsCovered,
  zoomBucketFor,
  type SpatialCoverageBox,
} from './spatialLoader';
import type { HazardAlertItem, HazardsPayload } from '@/app/api/explorer/v2/hazards/route';
import type { RadarFrame, RadarManifestPayload } from '@/app/api/explorer/v2/radar/route';
import type { AirspacePayload } from '@/app/api/explorer/v2/airspace/route';
import type {
  PokedexNearPayload,
  PokedexSpeciesItem,
} from '@/app/api/explorer/v2/pokedex/near/route';
import type {
  SocialMapKind,
  SocialMapPayload,
} from '@/app/api/explorer/v2/social/map/route';
import type {
  TerritorialEncyclopediaEntry,
  TerritorialEncyclopediaPayload,
  TerritoryScale,
} from '@/app/api/explorer/v2/territory/encyclopedia/route';
import { explorerAbortRegistry, type ExplorerAbortGroup } from './abortRegistry';

export type {
  ExplorerApiMeta,
  GeoJsonFeatureCollection,
  HazardAlertItem,
  HazardsPayload,
  RadarFrame,
  RadarManifestPayload,
  AirspacePayload,
  PokedexNearPayload,
  PokedexSpeciesItem,
  SocialMapKind,
  SocialMapPayload,
  TerritorialEncyclopediaEntry,
  TerritorialEncyclopediaPayload,
  TerritoryScale,
};

export type ExplorerHudMode = 'EXPLORE' | 'PLAN' | 'GPS_ACTIVE' | 'SOS' | 'OFFLINE';

export interface MapBbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface MapPoint {
  lat: number;
  lng: number;
}

export interface UnifiedLayerGateOptions {
  enabled?: boolean;
  zoom?: number;
  mode?: ExplorerHudMode;
  debounceMs?: number;
  paused?: boolean;
}

export type LayerGateInput = boolean | UnifiedLayerGateOptions | undefined;

export interface TerritorialEncyclopediaParams {
  scale: TerritoryScale;
  id?: string;
  name?: string;
  lat?: number;
  lng?: number;
  iso?: string;
}

function roundClientCoord(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  const v = Math.round(n * factor) / factor;
  return Object.is(v, -0) ? 0 : v;
}

export function quantizeClientBbox(
  bbox: MapBbox | null | undefined,
  decimals = 2,
): (MapBbox & { key: string }) | null {
  if (!bbox) return null;
  const { south, west, north, east } = bbox;
  if (![south, west, north, east].every(Number.isFinite)) return null;
  const factor = 10 ** decimals;
  const s = Math.max(-90, Math.min(90, Math.floor(Math.min(south, north) * factor) / factor));
  const n = Math.max(-90, Math.min(90, Math.ceil(Math.max(south, north) * factor) / factor));
  const w = Math.max(-180, Math.min(180, Math.floor(Math.min(west, east) * factor) / factor));
  const e = Math.max(-180, Math.min(180, Math.ceil(Math.max(west, east) * factor) / factor));
  return {
    south: Number(s.toFixed(decimals)),
    west: Number(w.toFixed(decimals)),
    north: Number(n.toFixed(decimals)),
    east: Number(e.toFixed(decimals)),
    key: `${s.toFixed(decimals)},${w.toFixed(decimals)},${n.toFixed(decimals)},${e.toFixed(decimals)}`,
  };
}

export function quantizeClientPoint(
  center: MapPoint | null | undefined,
  decimals = 2,
): (MapPoint & { key: string }) | null {
  if (!center) return null;
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return null;
  const lat = Math.max(-90, Math.min(90, roundClientCoord(center.lat, decimals)));
  const lng = Math.max(-180, Math.min(180, roundClientCoord(center.lng, decimals)));
  return {
    lat,
    lng,
    key: `${lat.toFixed(decimals)},${lng.toFixed(decimals)}`,
  };
}

/**
 * Pure gating resolver shared by all unified data hooks (and unit tests):
 * - Respects explicit `enabled === false`
 * - Disables non-safety layers when `mode === 'GPS_ACTIVE'` or `'OFFLINE'`
 * - Enforces `minZoom` when `zoom` is provided
 */
export function resolveLayerGate(
  gate: LayerGateInput,
  rules: { safetyCritical: boolean; minZoom?: number },
): { enabled: boolean; debounceMs: number; mode?: ExplorerHudMode } {
  if (typeof gate === 'boolean') {
    return { enabled: gate, debounceMs: 300 };
  }
  const opts = gate ?? {};
  const explicitEnabled = opts.enabled ?? true;
  const debounceMs = opts.debounceMs ?? 300;
  const mode = opts.mode;

  if (!explicitEnabled) {
    return { enabled: false, debounceMs, mode };
  }
  if (mode === 'OFFLINE') {
    return { enabled: false, debounceMs, mode };
  }
  if (!rules.safetyCritical && mode === 'GPS_ACTIVE') {
    return { enabled: false, debounceMs, mode };
  }
  if (
    typeof rules.minZoom === 'number' &&
    typeof opts.zoom === 'number' &&
    Number.isFinite(opts.zoom) &&
    opts.zoom < rules.minZoom
  ) {
    return { enabled: false, debounceMs, mode };
  }
  return { enabled: true, debounceMs, mode };
}

function useDebouncedValue<T>(value: T, delayMs: number, paused = false): T {
  const [debounced, setDebounced] = useState<T>(value);
  const lastEmitRef = useRef<number>(0);

  useEffect(() => {
    if (paused) return;
    const now = Date.now();
    // Leading + trailing throttle: instant first fetch (0 ms), smooth streaming during pan
    if (delayMs <= 0 || now - lastEmitRef.current >= delayMs) {
      lastEmitRef.current = now;
      setDebounced(value);
      return;
    }
    const remaining = Math.max(16, delayMs - (now - lastEmitRef.current));
    const timer = setTimeout(() => {
      lastEmitRef.current = Date.now();
      setDebounced(value);
    }, remaining);
    return () => clearTimeout(timer);
  }, [value, delayMs, paused]);

  return debounced;
}

/**
 * Spatial over-fetch buffer latch:
 * - Expands the visible viewport by 1.35× before quantizing
 * - Freezes updates while user is actively dragging/pinching (`paused`)
 * - Reuses the already-fetched buffered bbox as long as the current viewport stays
 *   covered inside it (zero redundant network calls on gentle pans!)
 */
function useBufferedBbox(
  bbox: MapBbox | null,
  decimals: number,
  debounceMs: number,
  options: { zoom?: number; paused?: boolean; expandFactor?: number } = {},
): (MapBbox & { key: string }) | null {
  const { zoom = 12, paused = false, expandFactor = 1.35 } = options;
  const zoomBucket = zoomBucketFor(zoom);
  const rawKey = bbox
    ? `${bbox.south.toFixed(decimals)},${bbox.west.toFixed(decimals)},${bbox.north.toFixed(decimals)},${bbox.east.toFixed(decimals)}@${zoomBucket}`
    : null;
  const settledKey = useDebouncedValue(rawKey, debounceMs, paused);

  const loadedRef = useRef<(SpatialCoverageBox & { key: string }) | null>(null);
  const [active, setActive] = useState<(MapBbox & { key: string }) | null>(() => {
    if (!bbox) return null;
    const expanded = expandBounds(bbox, expandFactor);
    const q = quantizeClientBbox(expanded, decimals);
    if (q) loadedRef.current = { ...q, zoomBucket };
    return q;
  });

  useEffect(() => {
    if (paused || !bbox || !settledKey) return;
    if (isBoundsCovered(bbox, loadedRef.current, zoomBucket)) {
      return;
    }
    const expanded = expandBounds(bbox, expandFactor);
    const q = quantizeClientBbox(expanded, decimals);
    if (!q) return;
    if (loadedRef.current?.key === q.key) return;
    loadedRef.current = { ...q, zoomBucket };
    setActive(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledKey, paused, zoomBucket, decimals, expandFactor]);

  return active;
}

function useDebouncedPoint(
  center: MapPoint | null,
  decimals: number,
  debounceMs: number,
  paused = false,
): (MapPoint & { key: string }) | null {
  const quantized = quantizeClientPoint(center, decimals);
  const key = quantized?.key ?? null;
  const settledKey = useDebouncedValue(key, debounceMs, paused);
  const [active, setActive] = useState<(MapPoint & { key: string }) | null>(quantized);

  useEffect(() => {
    if (paused || !settledKey || !quantized) return;
    setActive((prev) => (prev?.key === quantized.key ? prev : quantized));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledKey, paused]);

  return active;
}

function useAbortNonCriticalWhenGps(mode: ExplorerHudMode | undefined): void {
  useEffect(() => {
    if (mode === 'GPS_ACTIVE') {
      explorerAbortRegistry.abortAllNonCritical('gps-active');
    }
  }, [mode]);
}

async function fetchLayerJson<T>(
  group: ExplorerAbortGroup,
  url: string,
  querySignal?: AbortSignal,
): Promise<T> {
  const signal = explorerAbortRegistry.getSignal(group, querySignal);
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Explorer BFF ${group} HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function useExplorerHazards(
  bbox: MapBbox | null,
  enabled?: boolean | (UnifiedLayerGateOptions & { country?: string }),
) {
  const gate = resolveLayerGate(enabled, { safetyCritical: true, minZoom: 1 });
  const optsObj = typeof enabled === 'object' && enabled !== null ? enabled : null;
  const country = optsObj?.country;
  const activeBbox = useBufferedBbox(bbox, 2, gate.debounceMs, {
    zoom: optsObj?.zoom,
    paused: Boolean(optsObj?.paused),
  });

  return useQuery<HazardsPayload>({
    queryKey: ['xp-v2', 'hazards', activeBbox?.key ?? null, country ?? 'auto'],
    enabled: gate.enabled && Boolean(activeBbox),
    queryFn: ({ signal }) => {
      const b = activeBbox!;
      const qs = new URLSearchParams({
        south: String(b.south),
        west: String(b.west),
        north: String(b.north),
        east: String(b.east),
      });
      if (country) qs.set('country', country);
      return fetchLayerJson<HazardsPayload>(
        'hazards',
        `/api/explorer/v2/hazards?${qs.toString()}`,
        signal,
      );
    },
    staleTime: 180_000,
    gcTime: 15 * 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

export function useRadarManifest(enabled?: LayerGateInput) {
  const gate = resolveLayerGate(enabled, { safetyCritical: true });

  return useQuery<RadarManifestPayload>({
    queryKey: ['xp-v2', 'radar-manifest'],
    enabled: gate.enabled,
    queryFn: ({ signal }) =>
      fetchLayerJson<RadarManifestPayload>(
        'radar',
        '/api/explorer/v2/radar',
        signal,
      ),
    staleTime: 300_000,
    gcTime: 30 * 60_000,
    refetchInterval: gate.enabled ? 300_000 : false,
    retry: 1,
  });
}

export function useAirspaceLive(bbox: MapBbox | null, enabled?: LayerGateInput) {
  const gate = resolveLayerGate(enabled, { safetyCritical: false, minZoom: 4 });
  useAbortNonCriticalWhenGps(gate.mode);
  const optsObj = typeof enabled === 'object' && enabled !== null ? enabled : null;
  const activeBbox = useBufferedBbox(bbox, 2, gate.debounceMs, {
    zoom: optsObj?.zoom,
    paused: Boolean(optsObj?.paused),
  });

  return useQuery<AirspacePayload>({
    queryKey: ['xp-v2', 'airspace', activeBbox?.key ?? null],
    enabled: gate.enabled && Boolean(activeBbox),
    queryFn: ({ signal }) => {
      const b = activeBbox!;
      const qs = new URLSearchParams({
        south: String(b.south),
        west: String(b.west),
        north: String(b.north),
        east: String(b.east),
      });
      return fetchLayerJson<AirspacePayload>(
        'airspace',
        `/api/explorer/v2/airspace?${qs.toString()}`,
        signal,
      );
    },
    staleTime: 15_000,
    gcTime: 2 * 60_000,
    refetchInterval: gate.enabled ? 20_000 : false,
    retry: 0,
    placeholderData: (prev) => prev,
  });
}

export function usePokedexNear(
  center: MapPoint | null,
  enabled?: boolean | (UnifiedLayerGateOptions & { radiusKm?: number; threatened?: boolean }),
) {
  const gate = resolveLayerGate(enabled, { safetyCritical: false, minZoom: 2 });
  useAbortNonCriticalWhenGps(gate.mode);

  const optsObj = typeof enabled === 'object' && enabled !== null ? enabled : null;
  const radiusKm = typeof optsObj?.radiusKm === 'number' ? optsObj.radiusKm : 15;
  const threatened = Boolean(optsObj?.threatened);
  const activePoint = useDebouncedPoint(center, 2, gate.debounceMs, Boolean(optsObj?.paused));

  return useQuery<PokedexNearPayload>({
    queryKey: ['xp-v2', 'pokedex-near', activePoint?.key ?? null, radiusKm, threatened],
    enabled: gate.enabled && Boolean(activePoint),
    queryFn: ({ signal }) => {
      const pt = activePoint!;
      const qs = new URLSearchParams({
        lat: String(pt.lat),
        lng: String(pt.lng),
        radiusKm: String(radiusKm),
        threatened: threatened ? '1' : '0',
      });
      return fetchLayerJson<PokedexNearPayload>(
        'pokedex',
        `/api/explorer/v2/pokedex/near?${qs.toString()}`,
        signal,
      );
    },
    staleTime: 6 * 60 * 60_000,
    gcTime: 12 * 60 * 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

export function useSocialMapLayers(
  bbox: MapBbox | null,
  kinds: SocialMapKind[],
  enabled?: boolean | (UnifiedLayerGateOptions & { iso?: string | null }),
) {
  const gate = resolveLayerGate(enabled, {
    safetyCritical: false,
    minZoom: 1,
  });
  useAbortNonCriticalWhenGps(gate.mode);

  const optsObj = typeof enabled === 'object' && enabled !== null ? enabled : null;
  const iso = typeof optsObj?.iso === 'string' ? optsObj.iso.trim().toUpperCase() : '';
  const activeBbox = useBufferedBbox(bbox, 2, gate.debounceMs, {
    zoom: optsObj?.zoom,
    paused: Boolean(optsObj?.paused),
  });
  const sortedKinds = [...new Set(kinds)].sort().join(',');

  return useQuery<SocialMapPayload>({
    queryKey: ['xp-v2', 'social-map', activeBbox?.key ?? null, sortedKinds, iso],
    enabled: gate.enabled && Boolean(activeBbox && sortedKinds.length > 0),
    queryFn: ({ signal }) => {
      const b = activeBbox!;
      const qs = new URLSearchParams({
        south: String(b.south),
        west: String(b.west),
        north: String(b.north),
        east: String(b.east),
        kinds: sortedKinds,
      });
      if (iso && /^[A-Z]{2}$/.test(iso)) {
        qs.set('iso', iso);
      }
      return fetchLayerJson<SocialMapPayload>(
        'social',
        `/api/explorer/v2/social/map?${qs.toString()}`,
        signal,
      );
    },
    staleTime: kinds.includes('friends') ? 30_000 : 120_000,
    gcTime: 10 * 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

export function useTerritorialEncyclopedia(
  params: TerritorialEncyclopediaParams | null,
  enabled?: LayerGateInput,
) {
  const gate = resolveLayerGate(enabled, { safetyCritical: false });
  useAbortNonCriticalWhenGps(gate.mode);

  const qLat =
    params && typeof params.lat === 'number' && Number.isFinite(params.lat)
      ? roundClientCoord(params.lat, 2)
      : undefined;
  const qLng =
    params && typeof params.lng === 'number' && Number.isFinite(params.lng)
      ? roundClientCoord(params.lng, 2)
      : undefined;

  const rawKey = params
    ? `${params.scale}|${params.iso ?? ''}|${params.id ?? ''}|${params.name ?? ''}|${qLat ?? ''},${qLng ?? ''}`
    : null;
  const debouncedKey = useDebouncedValue(rawKey, gate.debounceMs);

  return useQuery<TerritorialEncyclopediaPayload>({
    queryKey: ['xp-v2', 'territory-encyclopedia', debouncedKey],
    enabled: gate.enabled && Boolean(debouncedKey && params),
    queryFn: ({ signal }) => {
      const p = params!;
      const qs = new URLSearchParams({ scale: p.scale });
      if (p.id) qs.set('id', p.id);
      if (p.name) qs.set('name', p.name);
      if (p.iso) qs.set('iso', p.iso.toUpperCase());
      if (typeof qLat === 'number') qs.set('lat', String(qLat));
      if (typeof qLng === 'number') qs.set('lng', String(qLng));
      return fetchLayerJson<TerritorialEncyclopediaPayload>(
        'territory',
        `/api/explorer/v2/territory/encyclopedia?${qs.toString()}`,
        signal,
      );
    },
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
  });
}
