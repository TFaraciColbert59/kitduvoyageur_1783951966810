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
  | { type: 'bearing'; northUp: boolean }
  | { type: 'none' };

export type Profile = 'solo' | 'famille' | 'enfants' | 'senior' | 'pmr' | 'sportif' | null;

export type SportEnvironment = 'outdoor' | 'indoor';

/**
 * Métriques du catalogue de sports. Le tracker actuel n’en alimente qu’une
 * partie (distance, durée, D+, vitesse/allure) ; les autres restent déclarées
 * et ne doivent pas être présentées comme mesurées.
 */
export type SportMetricKey =
  | 'distance'
  | 'duration'
  | 'elevation'
  | 'speed'
  | 'pace'
  | 'cadence'
  | 'power'
  | 'heartRate'
  | 'strokeRate'
  | 'verticalDrop'
  | 'grade'
  | 'laps';

/**
 * Variante locale choisie dans le drawer (S1.02). Elle conserve le `sport`
 * historique pour le tracker et la persistance ; les champs de variante sont
 * un enrichissement en mémoire, pas un nouveau contrat serveur.
 */
export interface SportSelection {
  sport: Sport;
  variantId: string;
  variantLabel: string;
  catalogSlug: string | null;
  environment: SportEnvironment;
  metrics: readonly SportMetricKey[];
}

/** Demande de départ en attente du compte à rebours 3·2·1. */
export interface PendingStart {
  sport: Sport;
  selection?: SportSelection;
}

export interface ActivityState {
  sport: Sport;
  /** Variante choisie ; absente pour les scènes et les anciens appels. */
  selection?: SportSelection;
  sessionId: string | null;
  startedAt: number;
  /** Pause manuelle : le suivi GPS est suspendu. */
  paused: boolean;
  /**
   * Pause automatique à l'arrêt, distincte de `paused`. Les fixes continuent
   * d'arriver pour détecter la reprise ; aucune métrique n'est accumulée.
   */
  autoPaused?: boolean;
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
  mini: number;
  selection?: Selection;
  activity?: ActivityState;
  /** Dernière sortie terminée, affichée dans l'écran Bilan. */
  summary?: (ActivityState & { endedAt: number }) | null;
  /** Résultat de l'enregistrement du bilan. */
  summarySaved?: 'pending' | 'saved' | 'local' | 'unauthenticated' | 'failed';
  camera: CameraIntent;
  profile: Profile;
  easyMode: boolean;
  theme: 'light' | 'dark';
  /** Réglage de préparation : pause automatique à l'arrêt, désactivable. */
  autoPauseEnabled?: boolean;
  online: boolean;
  locationPermission: 'granted' | 'denied' | 'prompt';
  orbitPaused: boolean;
  /** Nord en haut (boussole) ; sinon cap en haut. */
  northUp: boolean;
  /** Unités d'affichage : métriques, ou impériales pour US/LR/MM. */
  units: 'metric' | 'imperial';
  reveal: boolean;
  background: boolean;
  toast?: ToastMessage;
  /** Centre courant de la carte, tenu à jour pour les requêtes de données. */
  center: [number, number];
  zoom: number;
  /** Fond de carte : relief 3D, satellite ou plan vectoriel. */
  mapBaseStyle?: 'relief' | 'satellite' | 'plan';
  /** Visibilité des calques de données. */
  layerVisibility?: Record<string, boolean>;
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
