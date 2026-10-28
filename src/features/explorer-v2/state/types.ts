/**
 * Explorer v2 — types de la machine d'état (02_ARCHITECTURE.md §3).
 */

export type Level = 0 | 1 | 2 | 3;

export type Detent = 'peek' | 'low' | 'mid' | 'full';

export type Sport =
  | 'course'
  | 'rando'
  | 'velo'
  | 'kayak'
  | 'trail'
  | 'ski'
  | 'escalade'
  | 'famille'
  | 'bivouac';

export type PoiKind =
  | 'summit'
  | 'water'
  | 'refuge'
  | 'bivouac'
  | 'viewpoint'
  | 'danger'
  | 'access'
  | 'friend'
  | 'trail';

export type SheetKind =
  | 'welcome'
  | 'noLocation'
  | 'level'
  | 'previewCountry'
  | 'search'
  | 'layers'
  | 'offline'
  | 'summit'
  | 'water'
  | 'trail'
  | 'depart'
  | 'refuge'
  | 'bivouac'
  | 'viewpoint'
  | 'danger'
  | 'access'
  | 'friend'
  | 'start'
  | 'live'
  | 'sos'
  | 'summary'
  | 'easy';

export type Selection = { kind: PoiKind; id: string };

export type CameraIntent =
  | { type: 'level'; level: Level; center: [number, number] }
  | { type: 'reveal'; center: [number, number]; zoom?: number }
  | { type: 'orbit'; center: [number, number]; pitch?: number }
  | { type: 'flyover'; routeId: string }
  | { type: 'follow' }
  | { type: 'overview'; bounds?: [[number, number], [number, number]] }
  | { type: 'none' };

export type Profile = 'solo' | 'famille' | 'enfants' | 'senior' | 'pmr' | 'sportif' | null;

export interface ActivityState {
  sport: Sport;
  sessionId: string | null;
  startedAt: number;
  paused: boolean;
  offRoute: boolean;
  distanceM: number;
  elevGainM: number;
  movingS: number;
}

export interface ToastMessage {
  title: string;
  sub?: string;
  tone?: 'neutral' | 'warn' | 'bad' | 'good';
  id: number;
}

export interface ExplorerState {
  level: Level;
  /** ISO2 du pays courant ; '' = pays de l'utilisateur (aucun pays ouvert). */
  geo: string;
  regionId?: string;
  placeId?: string;
  sheet: SheetKind;
  detent: Detent;
  tab: number;
  mini: 0 | 1;
  selection?: Selection;
  activity?: ActivityState;
  camera: CameraIntent;
  profile: Profile;
  easyMode: boolean;
  theme: 'light' | 'dark';
  online: boolean;
  locationPermission: 'granted' | 'denied' | 'prompt';
  orbitPaused: boolean;
  reveal: boolean;
  background: boolean;
  toast?: ToastMessage;
  /** Centre courant de la carte, tenu à jour pour les requêtes de données. */
  center: [number, number];
  zoom: number;
  /** Scène de test/parité (?scene=), désactivée en production. */
  scene?: string;
}

export interface CountrySummary {
  iso_a2: string;
  name: string;
  continent: string | null;
  capital: string | null;
  currency_code: string | null;
  phone_code?: string | null;
  timezone?: string | null;
  languages?: string[] | null;
  lat?: number | null;
  lng?: number | null;
}

export interface RegionSummary {
  id: string;
  name: string;
  level: number;
  country_iso_a2: string;
  population?: number | null;
  lat?: number | null;
  lng?: number | null;
}

export interface PoiSummary {
  id: string;
  kind: PoiKind;
  subtype: string;
  name: string;
  lat: number;
  lon: number;
  ele_m?: number | null;
  potable?: boolean | null;
  capacity?: number | null;
  distance_m?: number | null;
}

export interface RouteSummary {
  id: string;
  name: string;
  distance_m: number | null;
  elev_gain_m: number | null;
  difficulty: string | null;
  activity: string | null;
  bbox?: [number, number, number, number] | null;
}

export interface PlaceConditions {
  weather?: {
    temperature_c: number | null;
    wind_ms: number | null;
    symbol: string | null;
    source: 'met-no';
  } | null;
  snow_m?: number | null;
}

export interface PlaceInfo {
  name: string;
  subtitle?: string | null;
  lat: number;
  lng: number;
  countryIso?: string | null;
  regionName?: string | null;
  counts: {
    routes: number;
    water: number;
    refuges: number;
    reports: number;
    members: number;
  };
  conditions?: PlaceConditions;
}

export interface DepartureSummary {
  id: string;
  title: string;
  place: string | null;
  starts_on: string | null;
  duration_days: number | null;
  spots: number | null;
  organiser: string | null;
}

export interface MemberSummary {
  id: string;
  name: string;
  initial: string;
  last_seen: string | null;
  place: string | null;
}
