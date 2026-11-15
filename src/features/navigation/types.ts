/**
 * Lot N01 — Contrat TypeScript complet pour le guidage, la navigation virage
 * par virage, le recalcul hors-itinéraire, les alertes waypoints/POI, les
 * cartes montée/descente, le changement de parcours en direct, les champs
 * personnalisables, le guidage vocal/TTS et l'écran verrouillé / Live Activities.
 *
 * Références couvertes :
 * - K4.02 : Navigation vocale virage par virage (y compris hors ligne)
 * - K4.03 : Démarrer depuis sa position ou rejoindre le départ
 * - K4.05 : Recalcul automatique en ligne après déviation & retour hors ligne
 * - K4.06 : Orientation nord fixe ou sens de déplacement & recentrage
 * - K4.07 : À venir : POI, lieux et Highlights avec distance restante
 * - K4.08 : Alertes audio et visuelles aux waypoints
 * - K4.09 : Cartes de montée et descente pendant le suivi
 * - K4.10 : Modifier ou changer le parcours pendant l'enregistrement (zéro fuite d'état)
 * - K4.11 : Champs personnalisables, zoom et écran maintenu
 * - K4.12 : Écran verrouillé : statistiques et prochaine instruction (iOS + parité Android)
 * - S1.06 : Activités en direct sur iOS (ActivityKit + Dynamic Island)
 * - S1.07 : Annonces audio pendant l'effort (distance, temps, allure/vitesse par sport)
 * - S3.11 : Guidage audio virage par virage mains libres
 * - S3.12 : Itinéraire routier jusqu'au point de départ (applications tierces)
 */

import type { GpsFix } from '../explorer-v2/activity/tracker';
import type { ElevationPoint, LngLat, RouteLine } from '../explorer-v2/geo/track';
import type { LiveActivityStart, LiveActivityState } from '../explorer-v2/native/liveActivity';
import type {
  ActivitySplit,
  PoiKind,
  Sport,
  SportMetricKey,
  SportSelection,
  TrailGeometryStatus,
} from '../explorer-v2/state/types';

export type {
  ActivitySplit,
  ElevationPoint,
  GpsFix,
  LiveActivityStart,
  LiveActivityState,
  LngLat,
  PoiKind,
  RouteLine,
  Sport,
  SportMetricKey,
  SportSelection,
  TrailGeometryStatus,
};

/** Système d'unités utilisateur. */
export type NavigationUnits = 'metric' | 'imperial';

// ─────────────────────────────────────────────────────────────────────────────
// K4.02 & S3.11 — Guidage virage par virage
// ─────────────────────────────────────────────────────────────────────────────

export type ManeuverKind =
  | 'depart'
  | 'straight'
  | 'slight-left'
  | 'turn-left'
  | 'sharp-left'
  | 'slight-right'
  | 'turn-right'
  | 'sharp-right'
  | 'u-turn'
  | 'waypoint'
  | 'arrive';

export interface RouteManeuver {
  /** Identifiant déterministe lié à la révision du tracé. */
  id: string;
  /** Rang 0-based dans la séquence de manœuvres du tracé. */
  index: number;
  kind: ManeuverKind;
  /** Position géographique [lng, lat] du point de manœuvre. */
  position: [number, number];
  /** Distance cumulée depuis le départ du tracé (m). */
  alongTrackM: number;
  /** Cap entrant avant le virage (0–360°, 0 = nord). */
  bearingBeforeDeg: number;
  /** Cap sortant après le virage (0–360°, 0 = nord). */
  bearingAfterDeg: number;
  /** Angle signé de changement de cap (-180° à +180°, positif = droite). */
  turnAngleDeg: number;
  /** Nom de rue/sentier optionnel s'il provient d'un moteur de routage. */
  streetName?: string | null;
  /** Instruction pré-formulée par le routeur, sinon générée localement. */
  rawInstruction?: string | null;
}

export type AnnouncementStage =
  | 'none'
  | 'pre-announce'
  | 'approaching'
  | 'imminent'
  | 'passed';

export interface RouteProgressSnapshot {
  /** Distance parcourue le long de la trace de référence (m). */
  alongTrackM: number;
  /** Distance restante jusqu'à la fin de la trace (m). */
  remainingDistanceM: number;
  /** Distance perpendiculaire à la trace (m). */
  crossTrackM: number;
  /** Point projeté sur la trace [lng, lat]. */
  pointOnRoute: [number, number];
  /** Index de la polyligne et du segment courant. */
  lineIndex: number;
  segmentIndex: number;
  /** Cap du segment de trace courant (0–360°). */
  segmentBearingDeg: number;
  /** Cap de retour vers la trace depuis la position courante (0–360°). */
  returnBearingDeg: number;
}

export interface TurnByTurnState {
  routeRevision: string;
  maneuvers: readonly RouteManeuver[];
  progress: RouteProgressSnapshot | null;
  nextManeuver: RouteManeuver | null;
  secondaryManeuver: RouteManeuver | null;
  /** Distance le long du tracé jusqu'à la prochaine manœuvre (m). */
  distanceToNextM: number | null;
  /** Distance formatée selon les unités utilisateur. */
  formattedDistanceToNext: string | null;
  stage: AnnouncementStage;
  /** Libellé visuel court pour le bandeau / drawer. */
  primaryInstruction: string;
  /** Texte complet prêt pour la synthèse vocale (TTS). */
  spokenInstruction: string | null;
  /** Vrai si cette étape précise doit déclencher une annonce vocale maintenant. */
  shouldSpeak: boolean;
  /** Vrai si l'utilisateur se déplace à contresens sur la trace. */
  reverseDirection: boolean;
  /** Vrai si le guidage fonctionne sur paquet hors-ligne / sans réseau. */
  offlineReady: boolean;
  /** Clés des annonces déjà prononcées (`maneuverId:stage`) pour éviter tout bégaiement. */
  announcedKeys: ReadonlySet<string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.03 & S3.12 — Départ / Rejoindre le départ / Navigation routière externe
// ─────────────────────────────────────────────────────────────────────────────

export type DepartureProximityKind =
  | 'at_start'
  | 'on_route_ahead'
  | 'away_from_route'
  | 'location_unavailable'
  | 'route_unavailable';

export type DepartureActionKind =
  | 'start_at_origin'
  | 'start_here_on_route'
  | 'guide_to_start'
  | 'guide_to_nearest_point'
  | 'open_external_road_nav';

export interface DepartureEvaluation {
  kind: DepartureProximityKind;
  /** Distance à vol d'oiseau jusqu'au point de départ officiel (m). */
  distanceToStartM: number | null;
  /** Distance minimale jusqu'au point le plus proche du tracé (m). */
  distanceToNearestRoutePointM: number | null;
  /** Abscisse curviligne du point de reprise si l'utilisateur est sur ou près du tracé (m). */
  entryAlongTrackM: number | null;
  /** Coordonnées [lng, lat] du point de départ du tracé. */
  startPosition: [number, number] | null;
  /** Coordonnées [lng, lat] du point le plus proche sur le tracé. */
  nearestRoutePosition: [number, number] | null;
  /** Cap vers le départ (0–360°). */
  bearingToStartDeg: number | null;
  /** Cap vers le point le plus proche du tracé (0–360°). */
  bearingToNearestDeg: number | null;
  /** Actions disponibles à présenter dans le drawer « Démarrer ». */
  availableActions: readonly DepartureActionKind[];
  /** Action recommandée par défaut. */
  recommendedAction: DepartureActionKind | null;
  /** Raison explicite si aucune action de guidage n'est possible. */
  unavailableReason: string | null;
}

export type ExternalNavProvider = 'apple-maps' | 'google-maps' | 'waze' | 'geo-uri';
export type ExternalNavTravelMode = 'driving' | 'walking' | 'bicycling';

export interface ExternalNavigationTarget {
  lat: number;
  lng: number;
  label?: string | null;
  mode?: ExternalNavTravelMode;
}

export interface ExternalNavigationLink {
  provider: ExternalNavProvider;
  label: string;
  url: string;
  universal: boolean;
}

export interface ExternalNavigationBundle {
  status: 'ready' | 'unavailable';
  reason: string | null;
  target: ExternalNavigationTarget | null;
  links: readonly ExternalNavigationLink[];
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.05 — Recalcul automatique en ligne après déviation & retour hors ligne
// ─────────────────────────────────────────────────────────────────────────────

export type RerouteStatus =
  | 'on_route'
  | 'off_route_pending'
  | 'recalculating_online'
  | 'recalculated'
  | 'offline_return_only'
  | 'reroute_failed';

export type RerouteFailureReason =
  | 'offline'
  | 'provider_unavailable'
  | 'off_network'
  | 'rate_limited'
  | 'cooldown_active'
  | 'no_forward_junction'
  | 'aborted';

export interface RerouteProviderLeg {
  distanceM: number;
  durationS: number;
  geometry: readonly [number, number][];
  provider?: 'geoapify' | 'valhalla' | string;
}

export interface RerouteProviderResult {
  leg: RerouteProviderLeg | null;
  reason: 'off_network' | 'provider_unavailable' | 'rate_limited' | null;
}

export type RerouteProviderAdapter = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  sport: Sport,
  signal?: AbortSignal,
) => Promise<RerouteProviderResult>;

export interface RerouteState {
  status: RerouteStatus;
  /** Distance courante au tracé de référence (m). */
  deviationDistanceM: number;
  /** Cap monde vers le point de retour le plus proche ou la jonction (0–360°). */
  returnBearingDeg: number | null;
  /** Angle de flèche compensé par la rotation de carte (0–360°). */
  screenBearingDeg: number | null;
  /** Point de jonction visé en avant sur le tracé [lng, lat]. */
  junctionPoint: [number, number] | null;
  /** Abscisse curviligne de la jonction sur le tracé d'origine (m). */
  junctionAlongTrackM: number | null;
  /** Tracé de détour recalculé jusqu'à la jonction, si disponible en ligne. */
  detourGeometry: readonly [number, number][] | null;
  /** Tracé fusionné (détour + reste du tracé d'origine après la jonction). */
  mergedRouteGeometry: readonly [number, number][] | null;
  /** Fournisseur ayant produit le recalcul. */
  provider: string | null;
  /** Raison explicite si le recalcul connecté n'a pas pu aboutir. */
  failureReason: RerouteFailureReason | null;
  /** Horodatage du dernier appel de recalcul (ms). */
  lastAttemptAtMs: number | null;
  /** Libellé prêt à afficher dans le bandeau de sortie active. */
  bannerLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.06 — Orientation nord fixe ou sens de déplacement
// ─────────────────────────────────────────────────────────────────────────────

export type MapOrientationMode = 'north-up' | 'course-up';

export interface MapOrientationState {
  mode: MapOrientationMode;
  /** Cap appliqué à la caméra MapLibre (0 en north-up, cap suivi en course-up). */
  cameraBearingDeg: number;
  /** Dernier cap de déplacement valide mémorisé pour éviter les sauts à l'arrêt. */
  lastValidCourseDeg: number;
  /** Vrai si l'utilisateur a déplacé/tourné la carte manuellement. */
  userPanned: boolean;
  /** Contexte du drawer parent à restaurer à la fermeture du sous-drawer. */
  returnSheetContext: {
    sheet: string;
    detent: string;
    tab: number;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.07 & K4.08 — À venir (POI, lieux, Highlights) & Alertes aux waypoints
// ─────────────────────────────────────────────────────────────────────────────

export interface NavigationWaypointInput {
  id: string;
  name: string;
  kind: PoiKind | 'highlight' | 'waypoint';
  lat: number;
  lng: number;
  eleM?: number | null;
  /** Sports concernés ; si absent ou vide, pertinent pour tous les sports. */
  sports?: readonly Sport[];
  /** Droit de visibilité (ex. point privé ou restreint). Par défaut `true`. */
  authorized?: boolean;
  description?: string | null;
}

export interface ProjectedWaypoint extends NavigationWaypointInput {
  /** Abscisse curviligne sur la trace (m). */
  alongTrackM: number;
  /** Écart latéral entre le POI et la trace (m). */
  lateralOffsetM: number;
}

export interface UpcomingWaypointItem {
  waypoint: ProjectedWaypoint;
  /** Distance restante le long du tracé (m). */
  distanceRemainingM: number;
  /** Distance formatée selon les unités utilisateur (`metric` / `imperial`). */
  formattedDistance: string;
  /** Temps estimé avant atteinte (s), uniquement si une vitesse réelle est mesurée. */
  etaSeconds: number | null;
}

export type WaypointAlertStage = 'approach' | 'arrival';

export interface WaypointAlertEvent {
  id: string;
  waypointId: string;
  waypointName: string;
  waypointKind: ProjectedWaypoint['kind'];
  stage: WaypointAlertStage;
  distanceRemainingM: number;
  title: string;
  spokenMessage: string;
  triggeredAtMs: number;
  hapticPattern: 'waypoint-approach' | 'waypoint-arrival';
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.09 — Cartes de montée et descente pendant le suivi
// ─────────────────────────────────────────────────────────────────────────────

export type SlopeSegmentKind = 'climb' | 'descent';

export interface SlopeSegment {
  id: string;
  kind: SlopeSegmentKind;
  index: number;
  startDistanceM: number;
  endDistanceM: number;
  lengthM: number;
  startElevationM: number;
  endElevationM: number;
  /** Dénivelé positif cumulé sur le tronçon (m). */
  gainM: number;
  /** Dénivelé négatif cumulé sur le tronçon (m). */
  lossM: number;
  /** Pente moyenne en pourcentage (toujours positive, ex: 6.5 pour 6,5 %). */
  averageGradePct: number;
  /** Pente maximale observée sur un sous-segment (en %). */
  maxGradePct: number;
  points: readonly ElevationPoint[];
}

export type ClimbDescentCardStatus =
  | 'active_climb'
  | 'active_descent'
  | 'upcoming_climb'
  | 'upcoming_descent'
  | 'flat_or_none'
  | 'unavailable';

export interface ClimbDescentCardState {
  status: ClimbDescentCardStatus;
  segment: SlopeSegment | null;
  /** Distance avant le début du tronçon (0 si déjà engagé). */
  distanceToStartM: number | null;
  /** Progression sur le tronçon actif (0 à 1). */
  progressRatio: number;
  /** Distance restante jusqu'à la fin du tronçon (m). */
  remainingDistanceM: number | null;
  /** D+ restant (si montée) ou D− restant (si descente) en mètres. */
  remainingElevationDeltaM: number | null;
  /** Pente courante instantanée (%). */
  currentGradePct: number | null;
  /** Points du profil restant à parcourir sur ce tronçon. */
  remainingProfilePoints: readonly ElevationPoint[];
  /** Libellé formaté selon les unités utilisateur. */
  summaryLabel: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.10 — Changement ou modification de parcours en cours d'enregistrement
// ─────────────────────────────────────────────────────────────────────────────

export interface ActiveRecordingSnapshot {
  sessionId: string | null;
  clientSessionId: string | null;
  sport: Sport;
  selection?: SportSelection;
  startedAt: number;
  paused: boolean;
  autoPaused: boolean;
  distanceM: number;
  elevGainM: number;
  movingS: number;
  splits: ActivitySplit[];
  mileSplits: ActivitySplit[];
  laps: ActivitySplit[];
}

export interface NewRouteSelectionInput {
  id: string;
  name: string | null;
  geojson: unknown | null;
  status: TrailGeometryStatus;
  waypoints?: readonly NavigationWaypointInput[];
  elevationProfile?: readonly ElevationPoint[];
  preloadedManeuvers?: readonly RouteManeuver[];
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.11 — Champs personnalisables, zoom et écran maintenu
// ─────────────────────────────────────────────────────────────────────────────

export type CustomizableMetricKey =
  | SportMetricKey
  | 'remainingDistance'
  | 'eta'
  | 'altitude'
  | 'averageSpeed'
  | 'averagePace';

export interface CustomFieldValue {
  key: CustomizableMetricKey;
  label: string;
  /** Valeur formatée ou `'—'` si indisponible / capteur non branché. */
  formattedValue: string;
  unitLabel: string;
  available: boolean;
  unavailableReason: 'sensor_not_connected' | 'route_required' | 'no_movement_yet' | null;
}

export interface NavigationDisplayPreferences {
  sport: Sport;
  fields: readonly CustomizableMetricKey[];
  autoZoomEnabled: boolean;
  manualZoomOverride: number | null;
  keepScreenAwake: boolean;
}

export interface WakeLockState {
  enabled: boolean;
  supported: boolean;
  active: boolean;
  reason: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// S1.07, K4.02, K4.08, S3.11 — Contrat Audio / TTS
// ─────────────────────────────────────────────────────────────────────────────

export type AudioOutputChannel = 'all' | 'headphones_only' | 'muted';

export interface EffortAnnouncementPreferences {
  enabled: boolean;
  /** Annonce à chaque split kilométrique (ou mile en impérial). */
  onEachSplit: boolean;
  /** Intervalle temporel en secondes (ex: 300 s = 5 min), ou `null` si coupé. */
  timeIntervalS: number | null;
  announceDistance: boolean;
  announceDuration: boolean;
  announceRhythm: boolean;
  announceSplitDelta: boolean;
}

export interface AudioGuidancePreferences {
  channel: AudioOutputChannel;
  turnByTurnEnabled: boolean;
  waypointAlertsEnabled: boolean;
  offRouteAlertsEnabled: boolean;
  effortBySport: Readonly< Partial<Record<Sport, EffortAnnouncementPreferences>> >;
  lang: string;
  rate: number;
  pitch: number;
}

export type AudioEventPriority = 1 | 2 | 3 | 4; // 1 = Off-route/Safety, 2 = Turn, 3 = Waypoint, 4 = Effort

export interface QueuedAudioAnnouncement {
  id: string;
  dedupeKey: string;
  priority: AudioEventPriority;
  category: 'off-route' | 'turn-by-turn' | 'waypoint' | 'effort';
  text: string;
  createdAtMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.12 & S1.06 — Écran verrouillé iOS (Live Activities / Dynamic Island) & Android
// ─────────────────────────────────────────────────────────────────────────────

export interface LockScreenManeuverPayload {
  kind: ManeuverKind;
  iconName: string;
  instruction: string;
  distanceM: number;
  formattedDistance: string;
  bearingDeg: number | null;
}

export interface DynamicIslandPresentation {
  /** Ex: icône du sport ou flèche du prochain virage. */
  compactLeading: string;
  /** Ex: distance avant virage (« 120 m ») ou distance totale (« 8,4 km »). */
  compactTrailing: string;
  /** Vue minimale quand deux Live Activities coexistent. */
  minimal: string;
  expanded: {
    headline: string;
    subheadline: string;
    leadingStatLabel: string;
    leadingStatValue: string;
    trailingStatLabel: string;
    trailingStatValue: string;
    bottomBanner: string | null;
  };
}

export interface AndroidLockScreenNotificationPayload {
  channelId: 'lkdv_active_navigation';
  ongoing: true;
  showWhen: boolean;
  visibility: 'public';
  category: 'navigation' | 'workout';
  title: string;
  subtitle: string;
  body: string;
  actions: ReadonlyArray<{
    id: 'pause' | 'resume' | 'lap' | 'mute';
    title: string;
  }>;
}

export interface LockScreenNavigationPayload extends LiveActivityState {
  /** Identifiant client stable (ne crée jamais de seconde séance). */
  clientSessionId: string | null;
  sport: Sport;
  startedAt: number;
  autoPaused: boolean;
  units: NavigationUnits;
  formattedDistance: string;
  formattedDuration: string;
  formattedElevationGain: string;
  formattedRhythm: string;
  nextManeuver: LockScreenManeuverPayload | null;
  offRouteBanner: string | null;
  dynamicIsland: DynamicIslandPresentation;
  androidNotification: AndroidLockScreenNotificationPayload;
}
