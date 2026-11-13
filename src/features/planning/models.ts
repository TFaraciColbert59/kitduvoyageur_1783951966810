/**
 * Lot R04 — Modèles du domaine de planification multi-jours.
 * Couvre K1.13, K2.29, K2.30, K2.31, K2.32, calendrier/météo/fenêtres optimales et partage P01.
 */

export type SportKind = 'hiking' | 'trekking' | 'trail' | 'cycling' | 'gravel' | 'bikepacking' | 'mountaineering';

export type RouteTheme =
  | 'alpine'
  | 'coastal'
  | 'forest'
  | 'ridge'
  | 'heritage'
  | 'lake'
  | 'desert'
  | 'glacier'
  | 'general';

export type ShareAudience = 'private' | 'friends' | 'tribu' | 'public';

export interface GpxTrackPoint {
  lat: number;
  lon: number;
  eleM: number | null;
}

export type LodgingType = 'refuge' | 'hut' | 'camp' | 'gite' | 'hotel' | 'bivouac';

export interface LodgingAnchor {
  id: string;
  name: string;
  type: LodgingType;
  lat: number;
  lon: number;
  eleM: number | null;
  /** Mois d'ouverture (1..12), null si inconnu ou ouvert toute l'année. */
  openMonths?: number[] | null;
  /** Capacité d'accueil, null si inconnue. */
  capacity?: number | null;
}

/** Capacités hors-ligne déclarées séparément (contrat C-ROUTE / recherche 04). */
export interface StageOfflineCapabilities {
  mapReady: boolean;
  traceReady: boolean;
  guidanceReady: boolean;
  searchReady: boolean;
  rerouteReady: boolean;
}

export interface StageRevision {
  stageId: string;
  dayNumber: number;
  revision: number;
  startPointIndex: number;
  endPointIndex: number;
  startCoord: GpxTrackPoint;
  endCoord: GpxTrackPoint;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  estimatedHours: number;
  endLodging: LodgingAnchor | null;
  points: GpxTrackPoint[];
  offline: StageOfflineCapabilities;
  standaloneLaunchable: boolean;
}

export interface ContinuousRoute {
  id: string;
  title: string;
  countryCode: string;
  sport: SportKind;
  theme: RouteTheme;
  /** Fuseau horaire IANA explicite (ex: "Europe/Paris", "Asia/Tokyo"). */
  timezone: string;
  points: GpxTrackPoint[];
  ownerId: string;
  audience: ShareAudience;
  revision: number;
}

export interface MultiDayPlan {
  id: string;
  sourceRouteId: string;
  title: string;
  countryCode: string;
  sport: SportKind;
  theme: RouteTheme;
  /** Fuseau horaire IANA explicite obligatoire. */
  timezone: string;
  daysCount: number;
  revision: number;
  ownerId: string;
  audience: ShareAudience;
  /** Politique P01 : consentement explicite au partage public/communautaire. */
  publicShareConsented: boolean;
  stages: StageRevision[];
  createdAtIso: string;
  updatedAtIso: string;
}

/* ---------- K1.13 : Recherche multi-jours ---------- */

export interface ParsedPlanCriteria {
  countryCode: string | null;
  minDays: number | null;
  maxDays: number | null;
  theme: RouteTheme | null;
  textTerms: string[];
}

export interface PlanSearchQuery {
  rawQuery: string;
  /** Surcharges explicites lorsque l'utilisateur corrige les critères compris. */
  correctedCriteria?: Partial<ParsedPlanCriteria>;
  sportFilter?: SportKind | null;
  scrollOffset?: number;
}

export interface ViewerContextP01 {
  viewerId: string | null;
  friendIds: string[];
  tribuIds: string[];
  blockedUserIds: string[];
}

export interface PlanSearchResult {
  query: PlanSearchQuery;
  understoodCriteria: ParsedPlanCriteria;
  items: MultiDayPlan[];
  excludedPrivateCount: number;
}

/* ---------- K2.30 & K2.31 : Ajustement des bornes et refuges ---------- */

export interface StageImpactSummary {
  dayNumber: number;
  previousDistanceKm: number;
  nextDistanceKm: number;
  previousElevationGainM: number;
  nextElevationGainM: number;
  previousEndCoord: GpxTrackPoint;
  nextEndCoord: GpxTrackPoint;
  previousStartCoord: GpxTrackPoint;
  nextStartCoord: GpxTrackPoint;
  previousRevision: number;
  nextRevision: number;
}

export interface StageBoundaryPreview {
  planId: string;
  expectedPlanRevision: number;
  currentPlanRevision: number;
  revisionConflict: boolean;
  dayN: StageImpactSummary;
  dayNext: StageImpactSummary | null;
  lodgingAnchor: LodgingAnchor | null;
}

/* ---------- K2.32 : Navigation par étape ---------- */

export interface StageLaunchPayload {
  planId: string;
  stageId: string;
  dayNumber: number;
  stageRevision: number;
  planRevision: number;
  sport: SportKind;
  timezone: string;
  startCoord: GpxTrackPoint;
  endCoord: GpxTrackPoint;
  points: GpxTrackPoint[];
  offline: StageOfflineCapabilities;
}

export type StageLaunchDecision =
  | {
      visible: true;
      launchable: true;
      payload: StageLaunchPayload;
    }
  | {
      visible: false;
      launchable: false;
      reason: 'not_found' | 'sport_mismatch' | 'forbidden_p01' | 'not_standalone';
    };

export interface NavigableStageCard {
  stageId: string;
  dayNumber: number;
  stageRevision: number;
  distanceKm: number;
  elevationGainM: number;
  estimatedHours: number;
  endLodgingName: string | null;
  canStartStage: boolean;
  offline: StageOfflineCapabilities;
}

/* ---------- Calendrier / Météo / Conditions / Fenêtres optimales ---------- */

export type WeatherProviderStatus =
  | 'available'
  | 'unavailable'
  | 'unconfigured'
  | 'rate_limited';

export type WeatherDataKind = 'observation' | 'forecast' | 'official_alert';

export type OfficialAlertSeverity = 'none' | 'moderate' | 'severe' | 'extreme';

export interface HourlyWeatherPoint {
  /** Horodatage ISO-8601 avec fuseau explicite ou Z. */
  timestampIso: string;
  kind: WeatherDataKind;
  tempC: number | null;
  precipMm: number | null;
  precipProbabilityPct: number | null;
  windKmh: number | null;
  gustKmh: number | null;
  freezingLevelM: number | null;
  alertSeverity?: OfficialAlertSeverity;
  alertTitle?: string | null;
}

export interface WeatherFeedSnapshot {
  status: WeatherProviderStatus;
  /** Nom explicite du fournisseur (ex: "open-meteo", "met-no"), null si non configuré. */
  providerName: string | null;
  timezone: string;
  fetchedAtIso: string | null;
  maxAgeMinutes: number;
  points: HourlyWeatherPoint[];
  unavailableReason?: string | null;
}

export type WeatherEvaluationStatus =
  | 'ok'
  | 'stale'
  | 'provider_unavailable'
  | 'no_data';

export interface PlanWeatherReport {
  status: WeatherEvaluationStatus;
  providerName: string | null;
  timezone: string;
  fetchedAtIso: string | null;
  freshnessMinutes: number | null;
  isStale: boolean;
  /** Explicite lorsqu'aucun fournisseur réel n'est branché ou qu'il est indisponible. */
  missingReason: string | null;
  hasOfficialAlert: boolean;
  maxAlertSeverity: OfficialAlertSeverity;
  pointsEvaluated: number;
}

export interface OptimalWindowOptions {
  minDurationHours: number;
  maxGustKmh?: number;
  maxPrecipMmPerHour?: number;
  minTempC?: number;
  maxTempC?: number;
  maxStageElevationM?: number | null;
}

export interface OptimalWindow {
  startIso: string;
  endIso: string;
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  timezone: string;
  score: number;
  maxGustKmh: number | null;
  totalPrecipMm: number | null;
  minTempC: number | null;
  maxTempC: number | null;
  reasons: string[];
}

export interface OptimalWindowResult {
  status: WeatherEvaluationStatus;
  timezone: string;
  providerName: string | null;
  missingReason: string | null;
  windows: OptimalWindow[];
}

/* ---------- Partage P01 ---------- */

export interface PlanShareRecord {
  shareId: string;
  planId: string;
  ownerId: string;
  audience: ShareAudience;
  /** Fuseau horaire explicite de validité du lien de partage. */
  timezone: string;
  createdAtIso: string;
  expiresAtIso: string | null;
  revokedAtIso: string | null;
  allowedTribeIds: string[];
  includeExactStartEndCoords: boolean;
}

export type ShareAccessDecision =
  | {
      allowed: true;
      audience: ShareAudience;
      includeExactStartEndCoords: boolean;
    }
  | {
      allowed: false;
      reason:
        | 'not_shared'
        | 'revoked'
        | 'expired'
        | 'blocked_p01'
        | 'private_p01'
        | 'audience_mismatch'
        | 'consent_missing_p01';
    };

/* ---------- Navigation / Pile de drawers (C-UI) ---------- */

export type PlanningDrawerView =
  | { kind: 'search_results'; query: PlanSearchQuery }
  | { kind: 'plan_detail'; planId: string }
  | { kind: 'split_route'; planId: string }
  | { kind: 'choose_lodging'; planId: string; dayNumber: number }
  | { kind: 'preview_boundary'; preview: StageBoundaryPreview };

export interface PlanningDrawerState {
  stack: PlanningDrawerView[];
  active: PlanningDrawerView | null;
}
