'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

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
}

export interface RouteItem {
  id: number;
  name: string | null;
  distance_km: number | null;
  network: string | null;
  ref: string | null;
  geojson: unknown;
}

export interface PlaceResponse {
  place: {
    regionName: string | null;
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

export interface WeatherResponse {
  source: 'met-no';
  attribution: string;
  hours: Array<{ time: string; temperature_c: number | null; wind_ms: number | null; symbol: string | null }>;
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

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

export function useCountriesGeo() {
  return useQuery({
    queryKey: ['xp', 'countries-geo'],
    queryFn: () => fetchJson<GeoCollection>('/data/explorer-v2/countries.geojson'),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

export function useRegionsGeo(iso: string | null) {
  return useQuery({
    queryKey: ['xp', 'regions-geo', iso],
    enabled: !!iso,
    queryFn: () => fetchJson<GeoCollection>(`/data/explorer-v2/regions/${iso}.geojson`),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

export function useCountryDetails(iso: string | null) {
  return useQuery({
    queryKey: ['xp', 'country', iso],
    enabled: !!iso,
    queryFn: () => fetchJson<{ countries: CountryDetails[] }>(`/api/explorer/v2/countries?iso=${iso}`),
    staleTime: 60 * 60 * 1000,
    select: (data) => data.countries[0] ?? null,
  });
}

export function usePlace(lat: number, lng: number, zoom: number, enabled = true) {
  return useQuery({
    queryKey: ['xp', 'place', lat.toFixed(3), lng.toFixed(3), Math.round(zoom)],
    enabled,
    queryFn: () => fetchJson<PlaceResponse>(`/api/explorer/v2/place?lat=${lat}&lng=${lng}&zoom=${zoom}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWeather(lat: number | null, lng: number | null) {
  return useQuery({
    queryKey: ['xp', 'weather', lat?.toFixed(2), lng?.toFixed(2)],
    enabled: lat !== null && lng !== null,
    queryFn: () => fetchJson<WeatherResponse>(`/api/explorer/v2/weather?lat=${lat}&lng=${lng}`),
    staleTime: 30 * 60 * 1000,
    retry: 1,
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
    queryKey: ['xp', 'reports', lat.toFixed(3), lng.toFixed(3)],
    enabled,
    queryFn: () =>
      fetchJson<{ reports: TerrainReport[] }>(
        `/api/explorer/v2/reports/near?lat=${lat}&lng=${lng}&radius=5000`,
      ),
    staleTime: 2 * 60 * 1000,
    select: (data) => data.reports,
  });
}

export function useContent(kind: 'carnets' | 'trips', iso: string | null) {
  return useQuery({
    queryKey: ['xp', 'content', kind, iso],
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

export interface SearchFilters {
  kinds: string[];
  maxDistanceKm: number | null;
  easy: boolean;
  family: boolean;
  withWater: boolean;
  text: string;
}

/** Recherche en langage naturel (règles déterministes, résultats BDD). */
export function useNaturalSearch(query: string, lat: number | null, lng: number | null) {
  return useQuery({
    queryKey: ['xp', 'search', query, lat?.toFixed(2), lng?.toFixed(2)],
    enabled: query.trim().length >= 2 && lat !== null && lng !== null,
    queryFn: () =>
      fetchJson<{ filters: SearchFilters; results: SearchResultItem[] }>(
        `/api/explorer/v2/search?q=${encodeURIComponent(query)}&lat=${lat}&lng=${lng}`,
      ),
    staleTime: 60 * 1000,
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
