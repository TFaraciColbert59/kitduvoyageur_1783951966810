'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  isSearchableViewport,
  viewportQueryParams,
  type SearchViewport,
} from '../searchArea';
import type { SearchRoute, Sport } from '../state/types';
import { readZone, type ZoneRecord } from '../offline/zone';
import { quantizePlaceQuery } from './spatialLoader';
import type { PoiDetailPayload } from '@/app/api/explorer/v2/poi-detail/route';
import type { RouteDetailPayload } from '@/app/api/explorer/v2/route-detail/route';

export type { PoiDetailPayload, RouteDetailPayload };

export type Position = [number, number];

export interface GeoFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

export interface GeoCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

export interface CountryFeatureProperties {
  iso_a2: string;
  name: string;
  name_en?: string;
  continent?: string | null;
}

export interface RegionFeatureProperties {
  name: string;
  group: string;
  iso_a2: string;
  code?: string | null;
}

export interface PoiItem {
  id: string;
  kind: string;
  subtype: string;
  name: string;
  lat: number;
  lon: number;
  ele_m: number | null;
  potable: boolean | null;
  capacity: number | null;
  imageUrl?: string | null;
}

export interface RouteItem {
  id: number;
  name: string | null;
  distance_km: number | null;
  network: string | null;
  ref: string | null;
  /**
   * Géométrie d'affichage simplifiée. `null` pour les routes de secours sans
   * tracé : le hors-trace doit alors afficher un état indisponible, jamais
   * mesurer une distance sur une géométrie absente.
   */
  geojson: unknown | null;
  /**
   * Route sans géométrie exploitable. Le hors-trace doit rester indisponible
   * au lieu d'aller chercher une géométrie homonyme ; aucun nom de
   * démonstration n'est créé pour combler une zone vide.
   */
  unavailable?: boolean;
}

export interface PlaceResponse {
  place: {
    regionName: string | null;
    placeName?: string | null;
    countryCode?: string | null;
    elevationM?: number | null;
    counts: { routes: number; water: number; refuges: number; reports: number };
  } | null;
  pois: PoiItem[];
  routes: RouteItem[];
  window: { dLat: number; dLng: number };
}

export interface CountryDetails {
  iso_a2: string;
  name: string;
  continent: string | null;
  capital: string | null;
  currency_code: string | null;
  currency_name: string | null;
  phone_code: string | null;
  timezone: string | null;
  languages: string[] | null;
  area_km2: number | null;
  practical: {
    emergency_numbers: Record<string, string> | null;
    plug_types: string[] | null;
    driving_side: string | null;
    units: string | null;
  } | null;
}

export interface WeatherHour {
  time: string;
  temperature_c: number | null;
  wind_ms: number | null;
  symbol: string | null;
  /** Précipitations (mm) sur l'heure — canonique. */
  precip_mm?: number | null;
  /** Alias historique lu en repli, jamais écrit. */
  precipitation_mm?: number | null;
}

export interface WeatherResponse {
  source: 'met-no';
  attribution: string;
  hours: WeatherHour[];
}

/** Centre d'une géométrie (moyenne des anneaux extérieurs, suffisant pour viser). */
export function geometryCenter(geometry: GeoFeature['geometry']): Position | null {
  if (!geometry) return null;
  const rawCoords = geometry.coordinates as unknown;
  if (geometry.type === 'Polygon' && Array.isArray(rawCoords) && Array.isArray(rawCoords[0])) {
    const ring = rawCoords[0] as unknown as Position[];
    let sx = 0;
    let sy = 0;
    for (const pt of ring) {
      if (Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
        sx += pt[0];
        sy += pt[1];
      }
    }
    return ring.length > 0 ? [sx / ring.length, sy / ring.length] : null;
  }
  if (geometry.type === 'MultiPolygon' && Array.isArray(rawCoords)) {
    let largest: Position[] = [];
    for (const poly of rawCoords as unknown as Position[][][]) {
      const ring = poly?.[0];
      if (Array.isArray(ring) && ring.length > largest.length) {
        largest = ring;
      }
    }
    if (largest.length > 0) {
      let sx = 0;
      let sy = 0;
      for (const pt of largest) {
        sx += pt[0];
        sy += pt[1];
      }
      return [sx / largest.length, sy / largest.length];
    }
  }
  const coords = geometry.coordinates as unknown;
  const points: Position[] = [];
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      points.push([value[0], value[1]]);
      return;
    }
    for (const child of value) walk(child);
  };
  walk(coords);
  if (points.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  return [sx / points.length, sy / points.length];
}

/** Emprise [w, s, e, n] d'une géométrie. */
export function geometryBounds(geometry: GeoFeature['geometry']): [number, number, number, number] | null {
  if (!geometry) return null;
  let w = 180;
  let s = 90;
  let e = -180;
  let n = -90;
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      const [x, y] = value as Position;
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
      return;
    }
    for (const child of value) walk(child);
  };
  walk(geometry.coordinates as unknown);
  if (w === 180) return null;
  return [w, s, e, n];
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

function useSettledValue<T>(value: T, key: string, delayMs: number, paused = false): T {
  const [settled, setSettled] = useState<T>(value);
  const lastEmitRef = useRef<number>(0);

  useEffect(() => {
    if (paused) return;
    const now = Date.now();
    // Leading + trailing throttle: first element fetch fires immediately (0 ms!),
    // while continuous pans stream cleanly at `delayMs` cadence without stalling!
    if (delayMs <= 0 || now - lastEmitRef.current >= delayMs) {
      lastEmitRef.current = now;
      setSettled(value);
      return;
    }
    const remaining = Math.max(16, delayMs - (now - lastEmitRef.current));
    const timer = setTimeout(() => {
      lastEmitRef.current = Date.now();
      setSettled(value);
    }, remaining);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delayMs, paused]);

  return settled;
}

export function useCountriesGeo() {
  return useQuery({
    queryKey: ['xp', 'countries-geo'],
    queryFn: ({ signal }) => fetchJson<GeoCollection>('/data/explorer-v2/countries.geojson', signal),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

export function useRegionsGeo(iso: string | null) {
  const cleanIso = iso && typeof iso === 'string' && iso.trim().length === 2 ? iso.trim().toUpperCase() : null;
  return useQuery({
    queryKey: ['xp', 'regions-geo', cleanIso],
    enabled: !!cleanIso,
    queryFn: ({ signal }) => fetchJson<GeoCollection>(`/data/explorer-v2/regions/${cleanIso}.geojson`, signal),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

export function useCountryDetails(iso: string | null) {
  const cleanIso = iso && typeof iso === 'string' && iso.trim().length === 2 ? iso.trim().toUpperCase() : null;
  return useQuery({
    queryKey: ['xp', 'country', cleanIso],
    enabled: !!cleanIso,
    queryFn: ({ signal }) => fetchJson<{ countries: CountryDetails[] }>(`/api/explorer/v2/countries?iso=${cleanIso}`, signal),
    staleTime: 60 * 60 * 1000,
    select: (data) => data.countries?.[0] ?? null,
  });
}

function isOfflinePoiItem(value: unknown): value is PoiItem {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.lat === 'number' &&
    Number.isFinite(record.lat) &&
    typeof record.lon === 'number' &&
    Number.isFinite(record.lon)
  );
}

function isOfflineRouteItem(value: unknown): value is RouteItem {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'number' && Number.isFinite(record.id);
}

function buildOfflinePlaceResponse(zone: ZoneRecord | null): PlaceResponse {
  const pois: PoiItem[] = Array.isArray(zone?.pois)
    ? zone.pois.filter(isOfflinePoiItem)
    : [];
  const routes: RouteItem[] = Array.isArray(zone?.routes)
    ? zone.routes.filter(isOfflineRouteItem)
    : [];

  const water = pois.filter(
    (p) => p.kind === 'water' || p.subtype === 'drinking_water' || p.subtype === 'spring',
  ).length;
  const refuges = pois.filter(
    (p) =>
      p.kind === 'shelter' ||
      p.kind === 'refuge' ||
      p.subtype === 'alpine_hut' ||
      p.subtype === 'wilderness_hut' ||
      p.subtype === 'refuge',
  ).length;

  const bounds = zone?.bounds;
  const window =
    bounds &&
    Number.isFinite(bounds.north) &&
    Number.isFinite(bounds.south) &&
    Number.isFinite(bounds.east) &&
    Number.isFinite(bounds.west)
      ? {
          dLat: Math.max(0.01, Math.abs(bounds.north - bounds.south) / 2),
          dLng: Math.max(0.01, Math.abs(bounds.east - bounds.west) / 2),
        }
      : { dLat: 0.05, dLng: 0.05 };

  return {
    place: {
      regionName: zone ? 'Zone hors ligne' : null,
      placeName: zone ? 'Zone hors ligne' : null,
      countryCode: null,
      elevationM: null,
      counts: {
        routes: routes.length,
        water,
        refuges,
        reports: 0,
      },
    },
    pois,
    routes,
    window,
  };
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  return error instanceof Error && error.name === 'AbortError';
}

async function fetchPlaceWithOfflineFallback(
  url: string,
  signal?: AbortSignal,
): Promise<PlaceResponse> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const zone = await readZone().catch(() => null);
    return buildOfflinePlaceResponse(zone);
  }

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  } catch (error) {
    if (isAbortError(error, signal)) throw error;
    const zone = await readZone().catch(() => null);
    if (zone || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return buildOfflinePlaceResponse(zone);
    }
    throw error;
  }

  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as PlaceResponse;
}

export function usePlace(
  lat: number,
  lng: number,
  zoom: number,
  enabled = true,
  options?: { paused?: boolean; debounceMs?: number },
) {
  const quantized = quantizePlaceQuery(lat, lng, zoom);
  const settled = useSettledValue(
    quantized,
    quantized.key,
    options?.debounceMs ?? 200,
    Boolean(options?.paused),
  );

  return useQuery({
    queryKey: ['xp', 'place', settled.key],
    enabled,
    networkMode: 'always',
    queryFn: ({ signal }) =>
      fetchPlaceWithOfflineFallback(
        `/api/explorer/v2/place?lat=${settled.lat}&lng=${settled.lng}&zoom=${settled.zoomBucket}`,
        signal,
      ),
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function usePoiDetail(
  poi: {
    id: string;
    name?: string;
    kind?: string;
    subtype?: string | null;
    lat: number;
    lon: number;
    ele_m?: number | null;
    potable?: boolean | null;
    capacity?: number | null;
  } | null,
  enabled = true,
) {
  const active = Boolean(enabled && poi && Number.isFinite(poi.lat) && Number.isFinite(poi.lon));
  return useQuery({
    queryKey: ['xp', 'poi-detail', poi?.id ?? null],
    enabled: active,
    queryFn: ({ signal }) => {
      const p = poi!;
      const qs = new URLSearchParams({
        id: p.id,
        lat: String(p.lat),
        lng: String(p.lon),
      });
      if (p.name) qs.set('name', p.name);
      if (p.kind) qs.set('kind', p.kind);
      if (p.subtype) qs.set('subtype', p.subtype);
      if (typeof p.ele_m === 'number' && Number.isFinite(p.ele_m)) qs.set('ele_m', String(p.ele_m));
      if (typeof p.potable === 'boolean') qs.set('potable', String(p.potable));
      if (typeof p.capacity === 'number' && Number.isFinite(p.capacity)) {
        qs.set('capacity', String(p.capacity));
      }
      return fetchJson<PoiDetailPayload>(`/api/explorer/v2/poi-detail?${qs.toString()}`, signal);
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}

export function useRouteDetail(
  route: {
    id: number | string;
    name?: string | null;
    distance_km?: number | null;
    anchor?: [number, number] | null;
  } | null,
  enabled = true,
) {
  const active = Boolean(enabled && route && String(route.id).length > 0);
  return useQuery({
    queryKey: ['xp', 'route-detail', route ? String(route.id) : null],
    enabled: active,
    queryFn: ({ signal }) => {
      const r = route!;
      const qs = new URLSearchParams({ id: String(r.id) });
      if (r.name) qs.set('name', r.name);
      if (typeof r.distance_km === 'number' && Number.isFinite(r.distance_km)) {
        qs.set('distanceKm', String(r.distance_km));
      }
      if (r.anchor && Number.isFinite(r.anchor[0]) && Number.isFinite(r.anchor[1])) {
        qs.set('lng', String(r.anchor[0]));
        qs.set('lat', String(r.anchor[1]));
      }
      return fetchJson<RouteDetailPayload>(`/api/explorer/v2/route-detail?${qs.toString()}`, signal);
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}

export interface TerrainCoverage {
  surface: {
    available: boolean;
    table: string;
    source: string;
    licence: string;
  };
  routes: {
    available: boolean;
    table: string;
    source: string;
    licence: string;
  };
}

/**
 * Présence réelle des données de terrain (surface, itinéraires).
 *
 * Sert au tiroir Calques pour distinguer « couche disponible mais masquée »
 * de « aucune donnée importée ». Aucun contenu n'est déduit de ce comptage.
 */
export function useTerrainCoverage(enabled = true) {
  return useQuery({
    queryKey: ['xp', 'terrain-coverage'],
    enabled,
    queryFn: () => fetchJson<TerrainCoverage>('/api/explorer/v2/terrain/coverage'),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useWeather(lat: number | null, lng: number | null) {
  return useQuery({
    queryKey: ['xp', 'weather', lat?.toFixed(2), lng?.toFixed(2)],
    enabled: lat !== null && lng !== null,
    queryFn: ({ signal }) => fetchJson<WeatherResponse>(`/api/explorer/v2/weather?lat=${lat}&lng=${lng}`, signal),
    staleTime: 30 * 60 * 1000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

export interface CarnetItem {
  id: string;
  title: string;
  destination: string | null;
  cover_image: string | null;
  start_date: string | null;
  distance_km: number | null;
  denivele_m: number | null;
  nb_nuits: number | null;
  likes_count: number | null;
}

export interface TripItem {
  id: string;
  title: string;
  destination_name: string | null;
  start_date: string | null;
  end_date: string | null;
  difficulty: string | null;
  primary_activity: string | null;
  party_size: number | null;
}

/** Carnets publics et départs ouverts, réels (aucun contenu de démonstration). */
export interface TerrainReport {
  id: string;
  category: string;
  severity: string;
  passability: string;
  description: string | null;
  lat: number;
  lng: number;
  status: string;
  present_count: number;
  gone_count: number;
  report_count: number;
  distance_m: number;
  created_at: string;
}

/** Signalements terrain réels autour d'un point (RPC a5, lecture publique). */
export function useReportsNear(lat: number, lng: number, enabled = true) {
  return useQuery({
    queryKey: ['xp', 'reports', lat.toFixed(2), lng.toFixed(2)],
    enabled,
    queryFn: ({ signal }) =>
      fetchJson<{ reports: TerrainReport[] }>(
        `/api/explorer/v2/reports/near?lat=${lat}&lng=${lng}&radius=5000`,
        signal,
      ),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
    select: (data) => data.reports,
  });
}

export function useContent(kind: 'carnets' | 'trips', iso: string | null, enabled = true) {
  return useQuery({
    queryKey: ['xp', 'content', kind, iso],
    enabled,
    queryFn: () =>
      fetchJson<{ kind: string; items: Array<CarnetItem | TripItem> }>(
        `/api/explorer/v2/content?kind=${kind}${iso ? `&iso=${iso}` : ''}&limit=6`,
      ),
    staleTime: 5 * 60 * 1000,
    select: (data) => data.items,
  });
}

export interface SearchResultItem {
  id: string;
  kind: string;
  subtype: string;
  name: string;
  lat: number;
  lon: number;
  ele_m: number | null;
  potable: boolean | null;
  distanceKm: number;
  matched: boolean;
}

import type { SearchCriteriaOverrides, SearchFilters, SmartRankedRoute } from '../search/searchQueryParser';
import type { MultiDayPlan } from '@/features/planning/models';

export type { SearchFilters };

export interface SearchResponse {
  filters: SearchFilters;
  results: SearchResultItem[];
  /** Parcours réels du catalogue OSM, dans la même emprise que les repères. */
  routes?: SmartRankedRoute[];
  /** Aventures multi-jours (K1.13) si la requête vise l'itinérance. */
  adventures?: MultiDayPlan[];
  /** Emprise réellement interrogée ; `null` pour l'ancien mode « autour du centre ». */
  zone: SearchViewport | null;
  /** Vrai quand la borne de la RPC a tronqué la liste avant l'affichage. */
  truncated: boolean;
  /** Vrai quand le catalogue de parcours a été tronqué par sa borne. */
  routesTruncated?: boolean;
  /** Vrai quand la RPC de parcours a échoué : les repères restent affichés. */
  routesUnavailable?: boolean;
}

/** Erreur HTTP de recherche, avec le motif explicite renvoyé par l'API. */
export class ExplorerSearchError extends Error {
  status: number;
  reason?: string;

  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = 'ExplorerSearchError';
    this.status = status;
    this.reason = reason;
  }
}

async function fetchSearchJson(url: string): Promise<SearchResponse> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const payload = (await res.json().catch(() => null)) as
    | { error?: unknown; reason?: unknown }
    | SearchResponse
    | null;
  if (!res.ok) {
    const record =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    const reason = typeof record?.reason === 'string' ? record.reason : undefined;
    const message =
      typeof record?.error === 'string' ? record.error : `${url} → ${res.status}`;
    throw new ExplorerSearchError(message, res.status, reason);
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as SearchResponse).results)) {
    throw new ExplorerSearchError('Réponse de recherche illisible', 502);
  }
  return payload as SearchResponse;
}

/** Réponse du contrat « autour de moi » (position + sport choisi). */
export interface RouteSuggestionResponse {
  sport: Sport;
  /** Faux quand le catalogue ne couvre pas ce sport ; `routes` est alors vide. */
  supported: boolean;
  reason?: 'sport-sans-catalogue';
  radiusKm: number;
  position: { lat: number; lng: number };
  routes: SearchRoute[];
  /** Vrai quand la borne de la RPC a pu tronquer les candidats. */
  truncated: boolean;
}

async function fetchSuggestionJson(url: string): Promise<RouteSuggestionResponse> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const payload = (await res.json().catch(() => null)) as
    | { error?: unknown; reason?: unknown }
    | RouteSuggestionResponse
    | null;
  if (!res.ok) {
    const record =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    const reason = typeof record?.reason === 'string' ? record.reason : undefined;
    const message =
      typeof record?.error === 'string' ? record.error : `${url} → ${res.status}`;
    throw new ExplorerSearchError(message, res.status, reason);
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as RouteSuggestionResponse).routes)
  ) {
    throw new ExplorerSearchError('Réponse de suggestions illisible', 502);
  }
  return payload as RouteSuggestionResponse;
}

/**
 * Parcours réels autour de la position, pour le sport explicitement choisi.
 *
 * Le hook n'est actif qu'avec une position autorisée et un sport. Il ne
 * remplace ni la recherche textuelle ni son emprise : son cache et ses
 * résultats sont séparés.
 */
export function useRouteSuggestions(
  lat: number | null,
  lng: number | null,
  sport: Sport | null,
  enabled = true,
) {
  const hasPosition =
    lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
  const params = new URLSearchParams();
  if (hasPosition && lat !== null && lng !== null) {
    // Trois décimales (~100 m) suffisent pour un rayon de 15 km et évitent de
    // promener une position précise dans l'URL et les journaux serveur.
    params.set('lat', lat.toFixed(3));
    params.set('lng', lng.toFixed(3));
  }
  if (sport) params.set('sport', sport);

  return useQuery({
    queryKey: [
      'xp',
      'route-suggestions',
      hasPosition ? `${lat?.toFixed(3)}:${lng?.toFixed(3)}` : 'sans-position',
      sport ?? 'sans-sport',
    ],
    enabled: enabled && hasPosition && sport !== null,
    queryFn: () =>
      fetchSuggestionJson(`/api/explorer/v2/suggestions?${params.toString()}`),
    staleTime: 60 * 1000,
    retry: 1,
  });
}

/**
 * Recherche en langage naturel (règles déterministes, résultats BDD).
 *
 * Sans `viewport`, le moteur conserve son comportement historique : une
 * fenêtre autour du centre. Avec une emprise visible valide, la même requête
 * et les mêmes filtres sont appliqués à cette emprise.
 */
export function useNaturalSearch(
  query: string,
  lat: number | null,
  lng: number | null,
  viewport: SearchViewport | null = null,
  overrides: SearchCriteriaOverrides | null = null,
) {
  const area = viewport && isSearchableViewport(viewport) ? viewport : null;
  const blockedByViewport = viewport !== null && area === null;
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);
  const params = new URLSearchParams({ q: query });
  if (lat !== null && Number.isFinite(lat)) params.set('lat', String(lat));
  if (lng !== null && Number.isFinite(lng)) params.set('lng', String(lng));
  if (area) {
    for (const part of viewportQueryParams(area).split('&')) {
      const [key, value] = part.split('=');
      if (key && value !== undefined) params.set(key, value);
    }
  }
  if (overrides) {
    if (overrides.maxDistanceKm != null) params.set('maxDistanceKm', String(overrides.maxDistanceKm));
    if (overrides.maxDurationHours != null) params.set('maxDurationHours', String(overrides.maxDurationHours));
    if (overrides.maxElevGainM != null) params.set('maxElevGainM', String(overrides.maxElevGainM));
    if (overrides.easy !== undefined) params.set('easy', overrides.easy ? '1' : '0');
    if (overrides.family !== undefined) params.set('family', overrides.family ? '1' : '0');
    if (overrides.routeType) params.set('routeType', overrides.routeType);
    if (overrides.difficulty) params.set('difficulty', overrides.difficulty);
    if (overrides.surface) params.set('surface', overrides.surface);
    if (overrides.startAccess) params.set('startAccess', overrides.startAccess);
    if (overrides.sport) params.set('sport', overrides.sport);
  }
  const overridesKey = overrides ? JSON.stringify(overrides) : 'no-overrides';

  return useQuery({
    queryKey: [
      'xp',
      'search',
      query,
      overridesKey,
      area
        ? viewportQueryParams(area)
        : blockedByViewport
          ? 'blocked-viewport'
          : `${lat?.toFixed(2)}:${lng?.toFixed(2)}`,
    ],
    enabled:
      query.trim().length >= 2 &&
      hasCenter &&
      !blockedByViewport,
    queryFn: () => fetchSearchJson(`/api/explorer/v2/search?${params.toString()}`),
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export interface PoiPassingRoute extends SearchRoute {
  proximityM: number;
}

/** K1.04 : Parcours du catalogue passant à proximité immédiate d'un POI. */
export function usePoiRoutes(lat: number | null, lng: number | null, enabled = true) {
  const valid =
    lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
  return useQuery({
    queryKey: ['xp', 'poi-routes', valid ? `${lat!.toFixed(4)}:${lng!.toFixed(4)}` : 'none'],
    enabled: enabled && valid,
    queryFn: () =>
      fetchJson<{ routes: PoiPassingRoute[]; radiusM: number }>(
        `/api/explorer/v2/pois/routes?lat=${lat}&lng=${lng}`,
      ),
    staleTime: 2 * 60 * 1000,
  });
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function useSystemTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setTheme(mq.matches ? 'dark' : 'light');
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return theme;
}

export interface CommunityHeatmapApiResponse {
  layer: {
    cells: Array<{
      cellId: string;
      cellCenterLat: number;
      cellCenterLng: number;
      intensity: number;
      band: string;
      distinctContributorCount: number;
      passageCount: number;
    }>;
    suppressedCellCount: number;
    eligibleActivityCount: number;
    geojson: GeoCollection;
  };
}

export function useCommunityHeatmap(
  sport: string,
  window: 'global' | 'last_7_days' | 'nocturnal',
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['xp', 'heatmap-community', sport, window],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams({ sport, window });
      const res = await fetch(`/api/heatmaps/community?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`community_heatmap_${res.status}`);
      return (await res.json()) as CommunityHeatmapApiResponse;
    },
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export interface PersonalHeatmapApiResponse {
  layer: {
    cells: Array<{
      cellId: string;
      cellCenterLat: number;
      cellCenterLng: number;
      intensity: number;
      band: string;
      activityCount: number;
    }>;
    activityCount: number;
    geojson: GeoCollection;
  };
  comparison?: {
    deltaCells?: number;
    deltaActivities?: number;
  } | null;
}

export class UnauthorizedHeatmapError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedHeatmapError';
  }
}

export function usePersonalHeatmap(
  sport: string,
  period: string,
  comparePeriod: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['xp', 'heatmap-personal', sport, period, comparePeriod ?? 'none'],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams({ sport, period });
      if (comparePeriod) params.set('comparePeriod', comparePeriod);
      const res = await fetch(`/api/heatmaps/personal?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.status === 401 || res.status === 403) {
        throw new UnauthorizedHeatmapError();
      }
      if (!res.ok) throw new Error(`personal_heatmap_${res.status}`);
      return (await res.json()) as PersonalHeatmapApiResponse;
    },
    staleTime: 60 * 1000,
    retry: false,
  });
}

export interface BikePoisApiResponse {
  status: 'ok' | 'zoom_required' | 'unavailable';
  items: Array<{
    id: string;
    category: 'bike_shop' | 'bike_repair' | 'ebike_charging';
    name: string;
    lat: number;
    lon: number;
    openingHours?: string | null;
  }>;
  provider?: string | null;
}

export function useBikePois(viewport: SearchViewport | null, enabled: boolean) {
  const key = viewport
    ? `${viewport.minLat.toFixed(2)},${viewport.minLng.toFixed(2)},${viewport.maxLat.toFixed(2)},${viewport.maxLng.toFixed(2)}`
    : 'none';
  return useQuery({
    queryKey: ['xp', 'bike-pois', key],
    enabled: enabled && viewport !== null,
    queryFn: async () => {
      if (!viewport) return { status: 'zoom_required' as const, items: [] };
      const res = await fetch(`/api/explorer/v2/bike-pois?${viewportQueryParams(viewport)}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = (await res.json().catch(() => null)) as
        | (BikePoisApiResponse & { code?: string })
        | null;
      if (
        res.status === 400 &&
        (payload?.status === 'zoom_required' ||
          payload?.code === 'VIEWPORT_TOO_LARGE' ||
          payload?.code === 'BBOX_TOO_LARGE')
      ) {
        return { status: 'zoom_required' as const, items: [] };
      }
      if (!res.ok || !payload) return { status: 'unavailable' as const, items: [] };
      return payload;
    },
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });
}

export interface FiresApiResponse {
  status: string;
  source: { name: string; retrievedAt?: string; license?: string } | null;
  incidents: Array<{
    id: string;
    kind: string;
    geometry: { type: 'Point' | 'Polygon'; coordinates: unknown };
    label: string;
    observedAt?: string | null;
  }>;
  reason?: string;
}

export function useFireIncidents(viewport: SearchViewport | null, enabled: boolean) {
  const key = viewport
    ? `${viewport.minLat.toFixed(1)},${viewport.minLng.toFixed(1)},${viewport.maxLat.toFixed(1)},${viewport.maxLng.toFixed(1)}`
    : 'none';
  return useQuery({
    queryKey: ['xp', 'fires', key],
    enabled: enabled && viewport !== null,
    queryFn: async () => {
      if (!viewport) return { status: 'unavailable', source: null, incidents: [] } as FiresApiResponse;
      const res = await fetch(`/api/explorer/v2/fires?${viewportQueryParams(viewport)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return { status: 'unavailable', source: null, incidents: [] } as FiresApiResponse;
      return (await res.json()) as FiresApiResponse;
    },
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });
}

export interface SurfacesApiResponse {
  status: string;
  features: Array<{
    id: string;
    name: string | null;
    surface: string | null;
    wayType: string | null;
    category: string;
    coordinates: Array<[number, number]>;
  }>;
  analysis?: {
    status: string;
    shares: Array<{ category: string; lengthM: number; shareOfKnown: number; shareOfRoute: number }>;
  } | null;
}

export function useRouteSurfaces(viewport: SearchViewport | null, enabled: boolean) {
  const key = viewport
    ? `${viewport.minLat.toFixed(2)},${viewport.minLng.toFixed(2)},${viewport.maxLat.toFixed(2)},${viewport.maxLng.toFixed(2)}`
    : 'none';
  return useQuery({
    queryKey: ['xp', 'route-surfaces', key],
    enabled: enabled && viewport !== null,
    queryFn: async () => {
      if (!viewport) return { status: 'zoom_required', features: [], analysis: null } as SurfacesApiResponse;
      const res = await fetch(`/api/explorer/v2/surfaces?${viewportQueryParams(viewport)}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = (await res.json().catch(() => null)) as
        | (SurfacesApiResponse & { code?: string })
        | null;
      if (
        res.status === 400 &&
        (payload?.status === 'zoom_required' ||
          payload?.code === 'VIEWPORT_TOO_LARGE' ||
          payload?.code === 'BBOX_TOO_LARGE')
      ) {
        return { status: 'zoom_required', features: [], analysis: null } as SurfacesApiResponse;
      }
      if (!res.ok || !payload) return { status: 'unavailable', features: [], analysis: null } as SurfacesApiResponse;
      return payload;
    },
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });
}

export interface ExplorerHighlightsResponse {
  items: Array<{
    id: string;
    title: string;
    description: string;
    kind: string;
    targetId: string;
    location: { lat: number; lng: number } | null;
    score: number;
  }>;
}

export function useRouteHighlights(routeId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['xp', 'highlights', routeId ?? 'all'],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (routeId) params.set('targetId', routeId);
      const res = await fetch(`/api/highlights?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return { items: [] } as ExplorerHighlightsResponse;
      return (await res.json()) as ExplorerHighlightsResponse;
    },
    staleTime: 60 * 1000,
    retry: 1,
  });
}
