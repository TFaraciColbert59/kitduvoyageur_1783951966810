/**
 * Explorer v2 — types de la machine d'état (02_ARCHITECTURE.md §3).
 */

import type { SummarySavedState } from '../activity/finishOutcome';
import type { SearchViewport } from '../searchArea';

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
  | 'strength'
  | 'live'
  | 'sos'
  | 'summary'
  | 'zoneSettings'
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

/**
 * Fonds de carte proposés par l'Explorer.
 *
 * `national` n'est sélectionnable que si un fond officiel du pays a passé le
 * statut `verified` du registre `map/nationalTopo.ts` ; sinon le tiroir ne
 * l'expose pas.
 */
export type MapBaseStyle = 'relief' | 'satellite' | 'plan' | 'national';

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
 * Split kilométrique ou tour manuel, mesuré à partir des intervalles GPS
 * réellement acceptés. `movingS` exclut les pauses et les trous GPS.
 */
export interface ActivitySplit {
  kind: 'km' | 'mi' | 'lap';
  /** Rang 1-based dans sa découpe (km 1, tour 1…). */
  index: number;
  /** Distance mesurée affectée au segment (m). */
  distanceM: number;
  /** Temps en mouvement affecté au segment (s). */
  movingS: number;
  /** Vrai quand le segment est fermé (seuil km atteint ou tour clôturé). */
  completed: boolean;
}

/**
 * Provenance d'une mesure de série. `mixed` n'est jamais produit par un
 * capteur : il signale qu'une même série a reçu des valeurs de plusieurs
 * sources et ne doit donc pas être présentée comme homogène.
 */
export type MetricSource = 'gps' | 'sensor' | 'import' | 'derived' | 'mixed';

/**
 * Qualité d'une mesure de série. Aucune valeur `estimated` n'est fabriquée par
 * LKDV : elle ne peut venir que d'une source qui la déclare comme telle.
 */
export type MetricQuality = 'measured' | 'derived' | 'estimated';

/**
 * Provenance admise pour une puissance. Les watts ne viennent que d'un
 * capteur (BLE, HealthKit/Health Connect) ou d'un import (FIT/TCX). Le GPS ne
 * mesure pas de puissance et LKDV n'en calcule ni n'en déduit aucune.
 */
export type PowerMetricSource = Extract<MetricSource, 'sensor' | 'import'>;

/**
 * Qualité admise pour une puissance. Une valeur fournie par la source est
 * soit mesurée, soit estimée par cette source ; `derived` est interdit pour
 * la puissance, car il désignerait un calcul LKDV.
 */
export type PowerMetricQuality = Extract<MetricQuality, 'measured' | 'estimated'>;

/** Métriques pouvant être représentées dans une série temporelle. */
export type MetricKey =
  | 'elevation'
  | 'speed'
  | 'pace'
  | 'heartRate'
  | 'cadence'
  | 'strokeRate'
  | 'power'
  | 'temperature'
  | 'calories'
  | 'steps';

/** Un point daté d'une série. `value` est toujours dans l'unité canonique. */
export interface MetricSample {
  /** Instant de mesure, sur l'échelle corrigée du tracker quand elle existe. */
  t: number;
  value: number;
  source: MetricSource;
  quality: MetricQuality;
}

/**
 * Agrégats calculés sur **toutes** les valeurs reçues, y compris celles qui ne
 * sont pas conservées dans `samples` (échantillonnage d'affichage). Ils ne
 * remplacent jamais une mesure absente : `count` vaut 0 pour une série vide.
 */
export interface MetricSeriesStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  first: number;
  last: number;
  firstT: number;
  lastT: number;
  /**
   * Somme pondérée par le temps écoulé depuis l’échantillon précédent, et
   * durée réellement couverte. Un trou supérieur au plafond du moteur n’est
   * pas ponté : la moyenne retombe alors sur la moyenne simple des valeurs.
   */
  weightedSum: number;
  weightedDurationS: number;
}

/**
 * Série temporelle d'une métrique réellement fournie par une source. Les
 * valeurs absentes ne sont ni interpolées ni remplacées par zéro : elles ne
 * produisent simplement aucun point.
 */
export interface MetricSeries {
  key: MetricKey;
  label: string;
  /** Unité canonique de `samples`/`stats` (m, m/s, s/km, bpm, spm, W, °C, kcal, pas). */
  unit: string;
  /** Échantillons destinés à l'affichage, éventuellement décimés. */
  samples: MetricSample[];
  stats: MetricSeriesStats;
  source: MetricSource;
  quality: MetricQuality;
}

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

/**
 * État de la géométrie réelle d'un itinéraire, figée au démarrage de la
 * séance. `loading` couvre la requête `get_route_geojson` ; `unavailable`
 * signifie qu'aucune trace exploitable n'existe (route de secours sans
 * géométrie, 404, réseau coupé). Le hors-trace est alors explicitement
 * désactivé, jamais silencieusement mort.
 */
export type TrailGeometryStatus = 'loading' | 'ready' | 'unavailable';

export interface TrailRouteSnapshot {
  /** Identifiant de l'itinéraire choisi ; jamais remplacé en cours de séance. */
  id: string;
  name: string | null;
  /** Géométrie **complète** (`get_route_geojson`), jamais la version simplifiée. */
  geojson: unknown | null;
  status: TrailGeometryStatus;
}

export interface ActivityState {
  sport: Sport;
  /** Variante choisie ; absente pour les scènes et les anciens appels. */
  selection?: SportSelection;
  /**
   * Itinéraire figé à la séance. Absent = aucune trace choisie (suivi libre) ;
   * présent avec `status: 'unavailable'` = hors-trace demandé mais impossible.
   * Les anciennes entrées, qui n'ont pas ce champ, restent valides.
   */
  route?: TrailRouteSnapshot;
  /**
   * Identifiant serveur, renseigné après le démarrage persistant. Il reste
   * `null` hors ligne tant que la séance n'a pas été créée côté serveur.
   */
  sessionId: string | null;
  /**
   * Identité stable générée avant le premier point (S1.02/K6.15). Elle survit
   * au rechargement et permet au serveur de retrouver la même séance sans en
   * créer une seconde et de raccorder les séries de mesures aux points déjà
   * conservés. Absente pour les scènes de recette et les anciens appels
   * directs `startActivity(sport, sessionId)`.
   */
  clientSessionId?: string | null;
  startedAt: number;
  /** Pause manuelle : le suivi GPS est suspendu. */
  paused: boolean;
  /**
   * Pause automatique à l'arrêt, distincte de `paused`. Les fixes continuent
   * d'arriver pour détecter la reprise ; aucune métrique n'est accumulée.
   */
  autoPaused?: boolean;
  offRoute: boolean;
  /**
   * Distance courante à la trace quand le hors-trace est évalué. Distincte de
   * `distanceM` (distance parcourue) : c'est elle que la bannière affiche.
   */
  offRouteM?: number;
  /**
   * Cap **monde** de retour vers la trace, en degrés (0 = nord, 90 = est).
   * Il oriente la flèche du bandeau hors-trace après soustraction de la
   * rotation réelle de la carte (`screenBearingDeg`) ; absent tant qu'aucune
   * mesure n'existe.
   */
  offRouteBearing?: number | null;
  distanceM: number;
  elevGainM: number;
  movingS: number;
  /**
   * Splits kilométriques mesurés. Absent sur les scènes et les séances
   * antérieures à l'ajout : l'interface affiche alors explicitement que la
   * découpe n'est pas disponible, sans recalculer une allure globale.
   */
  splits?: ActivitySplit[];
  /** Splits par mile, tenus en parallèle pour les unités impériales. */
  mileSplits?: ActivitySplit[];
  /** Tours manuels mesurés (même contrat que `splits`). */
  laps?: ActivitySplit[];
  /**
   * Séries de mesures réellement produites pendant la séance. Absent sur les
   * scènes et les bilans antérieurs : l'interface n'affiche alors aucune
   * valeur, jamais un zéro de remplissage.
   */
  metricSeries?: MetricSeries[];
}

/**
 * Carnet musculation local (S2.32).
 *
 * Une série n’existe que si l’utilisateur a réellement saisi ses répétitions.
 * `load` vaut `null` quand aucune charge n’est renseignée : le poids du corps
 * n’est jamais déduit d’un profil ni interpolé. Le volume n’est donc calculé
 * que pour les séries qui portent une charge explicite.
 */
export type StrengthLoadUnit = 'kg' | 'lb';

export interface StrengthSet {
  id: string;
  reps: number;
  /** Charge saisie dans `unit`, ou `null` si elle n’est pas renseignée. */
  load: number | null;
  unit: StrengthLoadUnit;
}

export interface StrengthExercise {
  id: string;
  name: string;
  sets: StrengthSet[];
}

/**
 * Carnet de musculation. Il vit dans le store Explorer et dans le stockage
 * local, puis se synchronise avec le contrat privé `strength_logs` quand
 * l’utilisateur est connecté. Le brouillon local reste la source de vérité de
 * l’appareil en cas de coupure réseau.
 */
export interface StrengthLog {
  version: 1;
  id: string;
  startedAt: number;
  updatedAt: number;
  exercises: StrengthExercise[];
  /**
   * Séance `activity_sessions` du même propriétaire, ou `null`/absente.
   * Le lien n'est proposé que pour une séance déjà enregistrée sur le compte ;
   * le serveur revérifie le propriétaire avant de l'accepter.
   */
  activitySessionId?: string | null;
}

export interface ToastMessage {
  title: string;
  sub?: string;
  tone?: 'neutral' | 'warn' | 'bad' | 'good';
  id: number;
}

/**
 * Parcours réel renvoyé par la recherche. Le catalogue reste `hiking_routes`
 * (lecture publique OSM) ; la recherche ne crée ni identifiant ni tracé.
 */
export interface SearchRoute {
  id: number;
  name: string | null;
  ref: string | null;
  network: string | null;
  distance_km: number | null;
  /** Distance du centre de l'emprise au centre du tracé ; `null` si inconnue. */
  distanceKm: number | null;
  /** Vrai quand la demande cite un mot du nom ou de la référence. */
  matched: boolean;
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
  /**
   * Tiroir parent d'un sous-tiroir (K3.12). Il n'est posé que par
   * `openLayers()` : le retour du menu commun restaure le tiroir, sa hauteur
   * et son onglet, sans perdre la sélection courante.
   */
  sheetParent?: {
    sheet: SheetKind;
    detent: Detent;
    tab: number;
  };
  selection?: Selection;
  /**
   * Itinéraire armé pour le prochain départ. Sa géométrie réelle est chargée
   * une fois ; `startActivity` en fait une copie figée dans `activity.route`.
   */
  trailRoute?: TrailRouteSnapshot;
  activity?: ActivityState;
  /** Dernière sortie terminée, affichée dans l'écran Bilan. */
  summary?: (ActivityState & { endedAt: number }) | null;
  /** Carnet musculation privé, local puis synchronisé avec le compte (S2.32). */
  strength?: StrengthLog;
  /** Résultat de l'enregistrement du bilan. */
  summarySaved?: SummarySavedState;
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
  /** Dernière demande saisie : conservée en fermant le tiroir pour pouvoir la relancer. */
  searchQuery?: string;
  /**
   * Sport explicitement choisi pour les suggestions « autour de moi ».
   * `null` = aucun sport choisi : aucune suggestion n'est déduite à sa place.
   */
  searchSport?: Sport | null;
  /**
   * Parcours réels de la dernière requête « autour de moi », tenus à part des
   * résultats de recherche textuelle (`searchRoutes`). Ils ne sont jamais
   * persistés et ne contiennent aucune donnée privée.
   */
  routeSuggestions?: SearchRoute[];
  /**
   * Emprise explicitement demandée par « Rechercher dans cette zone ».
   * `null` = recherche autour du centre courant, comportement historique.
   */
  searchViewport?: SearchViewport | null;
  /**
   * Emprise visible au moment où les résultats affichés ont été obtenus.
   * Elle ne sert qu'à décider si la carte a bougé depuis cette recherche.
   */
  searchReferenceViewport?: SearchViewport | null;
  /**
   * Parcours réels de la dernière recherche. Ils complètent, sans les
   * remplacer, les itinéraires déjà chargés pour le lieu courant ; ils ne sont
   * jamais persistés et ne contiennent aucune donnée privée.
   */
  searchRoutes?: SearchRoute[];
  /** Fond de carte : relief 3D, satellite, plan vectoriel ou fond national vérifié. */
  mapBaseStyle?: MapBaseStyle;
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
