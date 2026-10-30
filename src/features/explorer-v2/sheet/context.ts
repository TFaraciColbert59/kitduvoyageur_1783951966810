'use client';

import type {
  CarnetItem,
  CountryDetails,
  CountryFeatureProperties,
  TerrainReport,
  TripItem,
  PoiItem,
  PlaceResponse,
  RegionFeatureProperties,
  RouteItem,
  WeatherResponse,
  GeoCollection,
} from '../data/hooks';
import type { ExplorerStore } from '../state/store';
import type { Sport } from '../state/types';

export interface CountryEntry {
  iso: string;
  name: string;
  continent: string | null;
  center: [number, number] | null;
}

export interface RegionGroup {
  group: string;
  units: number;
  center: [number, number] | null;
}

export interface SheetContext {
  state: ExplorerStore;
  countries: CountryEntry[];
  country: CountryDetails | null;
  regionsGeo: GeoCollection | undefined;
  regionGroups: RegionGroup[];
  place: PlaceResponse | undefined;
  pois: PoiItem[];
  routes: RouteItem[];
  weather: WeatherResponse | undefined;
  carnets: CarnetItem[];
  reports: TerrainReport[];
  units: 'metric' | 'imperial';
  trips: TripItem[];
  selectedPoi: PoiItem | null;
  me: { lat: number; lng: number } | null;
  /** Démarrage avec compte à rebours (le parent décide de l'animation). */
  onStartSport?: (sport: Sport) => void;
  /** Confirmer un signalement (« présent » / « disparu »). */
  onConfirmReport?: (reportId: string, verdict: 'present' | 'gone') => void;
  locale: string;
}

export const POI_LABEL: Record<string, string> = {
  summit: 'Sommet',
  water: 'Point d’eau',
  refuge: 'Refuge',
  bivouac: 'Bivouac',
  viewpoint: 'Point de vue',
  danger: 'Danger',
  access: 'Accès',
  friend: 'Ami',
  trail: 'Randonnée',
};

export const POI_ICON: Record<string, string> = {
  summit: 'mtn',
  water: 'drop',
  refuge: 'house',
  bivouac: 'tent',
  viewpoint: 'eye',
  danger: 'alert',
  access: 'pin',
  friend: 'users',
  trail: 'route',
};

export const POI_TONE: Record<string, 'ink' | 'water' | 'warn' | 'bad' | 'good'> = {
  summit: 'ink',
  water: 'water',
  refuge: 'ink',
  bivouac: 'warn',
  viewpoint: 'good',
  danger: 'bad',
  access: 'ink',
  friend: 'good',
  trail: 'ink',
};

export const SPORT_META: Record<Sport, { label: string; icon: string }> = {
  course: { label: 'Course', icon: 'run' },
  rando: { label: 'Randonnée', icon: 'hike' },
  velo: { label: 'Vélo', icon: 'bike' },
  kayak: { label: 'Kayak', icon: 'kayak' },
  trail: { label: 'Trail', icon: 'run' },
  ski: { label: 'Ski de rando', icon: 'ski' },
  escalade: { label: 'Escalade', icon: 'climb' },
  famille: { label: 'Balade en famille', icon: 'walk' },
  bivouac: { label: 'Bivouac', icon: 'tent' },
};

export function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Miles depuis des kilomètres (unités impériales). */
export function formatImperialDistance(km: number): string {
  const miles = km * 0.621371;
  if (miles < 0.2) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1).replace('.', ',')} mi`;
}

export function formatImperialElevation(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined) return null;
  return `${new Intl.NumberFormat('en-US').format(Math.round(meters * 3.28084))} ft`;
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

export function formatElevation(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined) return null;
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(meters))} m`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function relativeDay(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd’hui";
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Point dans un anneau (ray casting) — sélection du département sous le doigt. */
export function pointInRing(point: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findRegionAt(
  geo: GeoCollection | undefined,
  point: [number, number],
): RegionFeatureProperties | null {
  if (!geo) return null;
  for (const feature of geo.features) {
    const geometry = feature.geometry;
    const props = feature.properties as unknown as RegionFeatureProperties;
    if (!geometry) continue;
    const polygons: number[][][][] =
      geometry.type === 'Polygon'
        ? [geometry.coordinates as number[][][]]
        : geometry.type === 'MultiPolygon'
          ? (geometry.coordinates as number[][][][])
          : [];
    for (const polygon of polygons) {
      if (polygon[0] && pointInRing(point, polygon[0])) return props;
    }
  }
  return null;
}

export function findCountryAt(
  geo: GeoCollection | undefined,
  point: [number, number],
): CountryFeatureProperties | null {
  if (!geo) return null;
  for (const feature of geo.features) {
    const geometry = feature.geometry;
    const props = feature.properties as unknown as CountryFeatureProperties;
    if (!geometry) continue;
    const polygons: number[][][][] =
      geometry.type === 'Polygon'
        ? [geometry.coordinates as number[][][]]
        : geometry.type === 'MultiPolygon'
          ? (geometry.coordinates as number[][][][])
          : [];
    for (const polygon of polygons) {
      if (polygon[0] && pointInRing(point, polygon[0])) return props;
    }
  }
  return null;
}
