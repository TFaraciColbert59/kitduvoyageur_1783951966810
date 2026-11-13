/**
 * Lot D01 — Connecteurs partenaires, OAuth/webhooks/idempotence, synchronisation
 * itinéraires & activités (Garmin, Wahoo, COROS, Suunto, Polar, Hammerhead,
 * Bosch, Apple Watch, Samsung Health, Zwift, Peloton, TrainerRoad, Rouvy, Strava).
 *
 * Références couvertes :
 * - K6.06 : Garmin Connect (synchroniser parcours et activités)
 * - K6.07 : App Garmin Connect IQ et fond de carte LKDV
 * - K6.08 : Garmin Up Ahead, waypoints, ascensions et guidage
 * - K6.12 : Live Sync vers Garmin, Wahoo, Bosch et Apple Watch
 * - K6.13 : Hammerhead (synchroniser les repères personnalisés)
 * - K6.14 : Synchroniser avec d'autres GPS et montres (distinction envoi parcours vs import activité)
 * - S3.23 : Synchronisation d'itinéraires et waypoints vers Garmin, COROS, Polar, Suunto, Samsung Health
 * - S6.04 : Synchronisation GPS Garmin, Wahoo, COROS, Suunto, Polar (cloud ou flux FIT, historique et doublons)
 * - S6.05 : Plateformes indoor Zwift, Peloton, TrainerRoad, Rouvy (préservation type d'effort et séries)
 * - S6.27 : Connexion à Strava depuis une app partenaire (OAuth, révocation, visibilité propriétaire stricte)
 * - S6.16 (P01) : Respect des consentements granulaires et révocables avant toute synchronisation
 */

export const PARTNER_PROVIDER_IDS = [
  'garmin',
  'garmin_connect_iq',
  'wahoo',
  'coros',
  'suunto',
  'polar',
  'hammerhead',
  'bosch',
  'apple_watch',
  'samsung_health',
  'zwift',
  'peloton',
  'trainerroad',
  'rouvy',
  'strava',
] as const;

export type PartnerProviderId = (typeof PARTNER_PROVIDER_IDS)[number];

export type ConnectorCategory =
  | 'gps_wearable'
  | 'bike_computer'
  | 'ebike_watch'
  | 'indoor_platform'
  | 'social_partner'
  | 'embedded_app'
  | 'health_platform';

/**
 * État réel d'un connecteur partenaire (invariant fail-closed :
 * jamais simulé comme 'configured' si les credentials sont absents).
 */
export type ConnectorAvailabilityStatus =
  | 'configured'
  | 'credentials_missing'
  | 'revoked'
  | 'unavailable';

/**
 * État fin par capacité (cf. recherche 08 — Matrice de connexion).
 */
export type CapabilitySupportState =
  | 'available'
  | 'unsupported'
  | 'consent_required'
  | 'credentials_missing'
  | 'indeterminate'
  | 'error';

export type ManualFallbackFormat = 'fit' | 'gpx' | 'tcx';

/**
 * Finalités de consentement P01 (compatibles avec src/features/adventure-intelligence/server/consents.ts
 * et src/features/compte/domain/consentSettings.ts).
 */
export type ConnectorConsentPurpose =
  | 'personal_performance'
  | 'collective_terrain'
  | 'live_location'
  | 'group_location'
  | 'external_readiness';

export type ConnectorUsageScope =
  | 'activity_import'
  | 'route_export'
  | 'waypoint_export'
  | 'live_sync'
  | 'connect_iq_map'
  | 'health_metrics';

export interface ProviderConsentGrant {
  providerId: PartnerProviderId;
  connected: boolean;
  allowedScopes: readonly ConnectorUsageScope[];
  grantedAt: string | null;
  revokedAt: string | null;
}

export interface ConnectorConsentSnapshot {
  userId: string;
  policyVersion: string;
  /** Finalités globales accordées (P01 S6.16). `external_readiness` est désactivé en Phase 1. */
  purposes: Readonly<Partial<Record<ConnectorConsentPurpose, boolean>>>;
  /** Consentements et liaisons par fournisseur partenaire. */
  providers: Readonly<Partial<Record<PartnerProviderId, ProviderConsentGrant>>>;
}

export interface ConnectorConsentEvaluation {
  allowed: boolean;
  status: 'granted' | 'purpose_missing' | 'purpose_disabled_phase1' | 'provider_not_connected' | 'provider_revoked' | 'scope_not_granted';
  missingPurposes: ConnectorConsentPurpose[];
  reason: string;
}

/**
 * Capacités distinctes par connecteur (K6.14, S3.23, S6.04, S6.05).
 */
export interface ConnectorCapabilitiesMatrix {
  activityImport: CapabilitySupportState;
  routeExport: CapabilitySupportState;
  waypointExport: CapabilitySupportState;
  upAheadClimbGuidance: CapabilitySupportState;
  liveSyncInSession: CapabilitySupportState;
  embeddedMapApp: CapabilitySupportState;
  indoorSeriesPreservation: CapabilitySupportState;
  historicalBackfill: CapabilitySupportState;
  manualFallbackFormats: readonly ManualFallbackFormat[];
}

export interface PartnerConnectorDefinition {
  id: PartnerProviderId;
  label: string;
  category: ConnectorCategory;
  fiches: readonly string[];
  requiredEnvVars: readonly string[];
  webhookSecretEnvVar?: string;
  oauthAuthorizeUrl?: string;
  oauthTokenUrl?: string;
  oauthRevokeUrl?: string;
  defaultScopes: readonly string[];
  requiredPurposes: readonly ConnectorConsentPurpose[];
  supportedUsages: readonly ConnectorUsageScope[];
  staticCapabilities: Omit<ConnectorCapabilitiesMatrix, 'manualFallbackFormats'> & {
    manualFallbackFormats: readonly ManualFallbackFormat[];
  };
  /** Indique si les données importées sont soumises à une restriction de visibilité tiers (ex: Strava S6.27). */
  visibilityRestriction: 'standard_p01' | 'owner_only_no_public_or_ai';
  drawerSurface: 'compte_devices_drawer' | 'route_drawer_send_to_device' | 'route_drawer_transient_live_sync' | 'external_native_device';
}

export interface ResolvedPartnerConnectorState {
  definition: PartnerConnectorDefinition;
  status: ConnectorAvailabilityStatus;
  missingEnvVars: string[];
  capabilities: ConnectorCapabilitiesMatrix;
  connected: boolean;
  revocable: boolean;
  lastSyncedAt: string | null;
  statusReason: string;
}

export interface DeviceModelProfile {
  modelId: string;
  providerId: PartnerProviderId;
  brand: string;
  modelName: string;
  compatible: boolean;
  supportsRouteImport: boolean;
  supportsWaypoints: boolean;
  supportsUpAhead: boolean;
  supportsClimbProfile: boolean;
  supportsTurnByTurn: boolean;
  supportsLiveSync: boolean;
  supportsConnectIqApp: boolean;
  supportsCustomPois: boolean;
  maxWaypointsPerRoute: number;
  preferredFormat: ManualFallbackFormat;
  notes: string;
}

// ============================================================================
// OAuth 2.0 + PKCE + Révocation (sans secret ni token simulé)
// ============================================================================

export type ConnectorEnvReader = Readonly<Record<string, string | undefined>>;

export interface PkceChallengePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface OAuthAuthorizationRequestInput {
  providerId: PartnerProviderId;
  userId: string;
  redirectUri: string;
  state: string;
  pkce: PkceChallengePair;
  requestedScopes?: readonly string[];
  env?: ConnectorEnvReader;
}

export type OAuthAuthorizationResult =
  | {
      ok: true;
      providerId: PartnerProviderId;
      authorizationUrl: string;
      state: string;
      codeChallenge: string;
      codeChallengeMethod: 'S256';
      scopes: string[];
    }
  | {
      ok: false;
      providerId: PartnerProviderId;
      status: ConnectorAvailabilityStatus | 'invalid_request';
      missingEnvVars: string[];
      error: string;
    };

export interface OAuthTokenTransportResponse {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
  externalAthleteId: string;
  grantedScopes: string[];
}

export type OAuthTransportAdapter = (params: {
  providerId: PartnerProviderId;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) => Promise<OAuthTokenTransportResponse>;

export type OAuthTokenExchangeResult =
  | {
      ok: true;
      providerId: PartnerProviderId;
      userId: string;
      externalAthleteId: string;
      grantedScopes: string[];
      expiresAt: string;
    }
  | {
      ok: false;
      providerId: PartnerProviderId;
      status: ConnectorAvailabilityStatus | 'transport_missing' | 'transport_error' | 'invalid_grant';
      missingEnvVars: string[];
      error: string;
    };

export interface RevokeConnectionResult {
  ok: boolean;
  providerId: PartnerProviderId;
  userId: string;
  newStatus: 'revoked';
  revokedAt: string;
  cancelledPendingJobs: number;
  purgedTokenReferences: boolean;
  remoteRevocationStatus: 'revoked_remotely' | 'skipped_no_credentials' | 'remote_failed_local_enforced';
}

// ============================================================================
// Webhooks, Idempotence & Déduplication multi-sources (K6.06, S3.23, S6.04, S6.27)
// ============================================================================

export type WebhookEventType =
  | 'activity.create'
  | 'activity.update'
  | 'activity.delete'
  | 'route.sync_ack'
  | 'athlete.deauthorize';

export interface PartnerWebhookEvent {
  providerId: PartnerProviderId;
  deliveryId: string;
  eventType: WebhookEventType;
  externalUserId: string;
  externalObjectId: string;
  occurredAt: string;
  signatureHeader?: string;
  rawPayloadHash: string;
  payload?: Record<string, unknown>;
}

export interface WebhookIngestionResult {
  accepted: boolean;
  idempotentReplay: boolean;
  idempotencyKey: string;
  status:
    | 'processed'
    | 'duplicate_ignored'
    | 'rejected_credentials_missing'
    | 'rejected_invalid_signature'
    | 'rejected_consent_revoked'
    | 'deauthorized_applied';
  enqueuedJobId: string | null;
  reason: string;
}

export interface ActivityProvenanceRecord {
  canonicalActivityId: string;
  userId: string;
  primaryProvider: PartnerProviderId | 'lkdv_local' | 'manual_file';
  linkedSources: Array<{
    providerId: PartnerProviderId | 'lkdv_local' | 'manual_file';
    externalActivityId: string;
    fileHash?: string;
    importedAt: string;
  }>;
  originApplication: 'lkdv' | PartnerProviderId | 'external_device';
  startTimeIso: string;
  durationSeconds: number;
  distanceMeters: number;
  sportType: string;
  startLatLng?: readonly [number, number] | null;
  hasGpsRoute: boolean;
  hasHeartRateSeries: boolean;
  hasPowerSeries: boolean;
  deletedLocallyAt?: string | null;
}

export interface IncomingExternalActivityCandidate {
  userId: string;
  providerId: PartnerProviderId;
  externalActivityId: string;
  originApplication?: 'lkdv' | PartnerProviderId | 'external_device';
  sourceChain?: readonly string[];
  fileHash?: string;
  startTimeIso: string;
  durationSeconds: number;
  distanceMeters: number;
  sportType: string;
  startLatLng?: readonly [number, number] | null;
  hasGpsRoute: boolean;
  hasHeartRateSeries: boolean;
  hasPowerSeries: boolean;
}

export type DeduplicationOutcome =
  | {
      decision: 'create_new';
      deduplicationKey: string;
      reason: string;
    }
  | {
      decision: 'ignore_exact_duplicate';
      deduplicationKey: string;
      canonicalActivityId: string;
      reason: string;
    }
  | {
      decision: 'link_and_enrich_existing';
      deduplicationKey: string;
      canonicalActivityId: string;
      enrichmentFields: ('gps_route' | 'heart_rate_series' | 'power_series')[];
      reason: string;
    }
  | {
      decision: 'reject_sync_loop';
      deduplicationKey: string;
      reason: string;
    }
  | {
      decision: 'reject_locally_deleted_tombstone';
      deduplicationKey: string;
      canonicalActivityId: string;
      reason: string;
    };

export type SyncJobKind = 'route_push' | 'waypoint_push' | 'activity_import' | 'live_sync_route';

export type SyncJobStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed_retryable'
  | 'failed_terminal'
  | 'blocked_credentials_missing'
  | 'blocked_consent_revoked'
  | 'superseded_by_newer_revision'
  | 'cancelled';

export interface SyncQueueJob {
  jobId: string;
  idempotencyKey: string;
  userId: string;
  providerId: PartnerProviderId;
  kind: SyncJobKind;
  targetEntityId: string;
  revision: number;
  deviceModelId?: string;
  status: SyncJobStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAtMs: number | null;
  lastError: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

// ============================================================================
// Parcourir / Waypoints / Garmin Up Ahead / Hammerhead / Live Sync
// ============================================================================

export type RouteWaypointCategory =
  | 'summit'
  | 'col_pass'
  | 'water_source'
  | 'refuge_food'
  | 'danger'
  | 'turn_left'
  | 'turn_right'
  | 'continue_straight'
  | 'first_aid'
  | 'viewpoint'
  | 'camping'
  | 'custom';

export interface CanonicalRouteWaypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevationMeters?: number;
  distanceFromStartMeters: number;
  category: RouteWaypointCategory;
  description?: string;
  approachAlertMeters?: number;
}

export interface CanonicalClimbSegment {
  id: string;
  name: string;
  startDistanceMeters: number;
  endDistanceMeters: number;
  lengthMeters: number;
  elevationGainMeters: number;
  averageGradePercent: number;
  category: 'hc' | 'cat_1' | 'cat_2' | 'cat_3' | 'cat_4' | 'unclassified';
}

export interface CanonicalTurnManeuver {
  id: string;
  distanceFromStartMeters: number;
  lat: number;
  lng: number;
  direction: 'left' | 'slight_left' | 'sharp_left' | 'right' | 'slight_right' | 'sharp_right' | 'straight' | 'uturn';
  instruction: string;
}

export interface CanonicalRouteForSync {
  routeId: string;
  revision: number;
  title: string;
  sportType: 'hiking' | 'trail_running' | 'road_cycling' | 'gravel_cycling' | 'mtb' | 'mountaineering' | 'ski_touring';
  totalDistanceMeters: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  coordinates: ReadonlyArray<readonly [number, number, number?]>; // [lat, lng, ele?]
  waypoints: readonly CanonicalRouteWaypoint[];
  climbs?: readonly CanonicalClimbSegment[];
  maneuvers?: readonly CanonicalTurnManeuver[];
}

export type GarminCoursePointType =
  | 'summit'
  | 'valley'
  | 'water'
  | 'food'
  | 'danger'
  | 'left'
  | 'right'
  | 'straight'
  | 'first_aid'
  | 'campsite'
  | 'generic';

export interface GarminUpAheadCoursePoint {
  sourceWaypointId: string;
  name: string;
  garminType: GarminCoursePointType;
  lat: number;
  lng: number;
  distanceMeters: number;
  elevationMeters: number | null;
  approachAlertMeters: number;
  notes: string;
}

export interface GarminCourseExportPayload {
  routeId: string;
  revision: number;
  courseName: string;
  garminActivityType: 'hiking' | 'trail_running' | 'road_biking' | 'gravel_cycling' | 'mountain_biking' | 'mountaineering';
  totalDistanceMeters: number;
  elevationGainMeters: number;
  trackPointCount: number;
  upAheadPoints: GarminUpAheadCoursePoint[];
  climbSegments: CanonicalClimbSegment[];
  truncatedWaypointCount: number;
  upAheadSupported: boolean;
  climbProSupported: boolean;
  turnGuidanceSupported: boolean;
  deliveryMode: 'cloud_api_ready' | 'manual_fit_fallback';
  statusReason: string;
}

export type HammerheadPoiType =
  | 'summit'
  | 'water'
  | 'food'
  | 'caution'
  | 'aid_station'
  | 'viewpoint'
  | 'camping'
  | 'custom_pin';

export interface HammerheadCustomPoi {
  id: string;
  name: string;
  hammerheadType: HammerheadPoiType;
  lat: number;
  lng: number;
  distanceAlongRouteMeters: number;
  altitudeMeters: number | null;
  description: string;
}

export interface HammerheadRouteSyncPayload {
  routeId: string;
  revision: number;
  modelId: string;
  compatible: boolean;
  customPois: HammerheadCustomPoi[];
  truncatedPoiCount: number;
  deliveryMode: 'cloud_api_ready' | 'manual_gpx_fallback' | 'incompatible_device';
  statusReason: string;
}

/**
 * K6.12 — État temporaire Live Sync dans le drawer de parcours :
 * affiché UNIQUEMENT si le transfert est actif ('transferring') ou échoue ('failed'),
 * retiré dès sa résolution ('resolved' / 'idle').
 */
export type LiveSyncTransferState = 'idle' | 'transferring' | 'failed' | 'resolved';

export interface LiveSyncBannerViewModel {
  visible: boolean;
  state: LiveSyncTransferState;
  providerId: PartnerProviderId;
  deviceModelId: string;
  routeId: string;
  revision: number;
  isMidNavigationUpdate: boolean;
  message: string | null;
  canRetry: boolean;
  mainControlsAvailable: true;
}

// ============================================================================
// Plateformes Indoor (S6.05) & Strava Partenaire (S6.27)
// ============================================================================

export type IndoorEffortType =
  | 'virtual_ride'
  | 'virtual_run'
  | 'indoor_cycling'
  | 'erg_structured_workout'
  | 'indoor_rowing'
  | 'indoor_treadmill';

export interface IndoorIntervalBlock {
  label: string;
  durationSeconds: number;
  targetPowerWatts?: number | null;
  targetCadenceRpm?: number | null;
  targetHeartRateBpm?: number | null;
}

export interface IndoorSeriesSample {
  elapsedSeconds: number;
  powerWatts?: number | null;
  cadenceRpm?: number | null;
  heartRateBpm?: number | null;
  speedKph?: number | null;
  resistanceLevel?: number | null;
}

export interface RawIndoorPlatformActivity {
  providerId: 'zwift' | 'peloton' | 'trainerroad' | 'rouvy';
  externalActivityId: string;
  userId: string;
  title: string;
  effortType: IndoorEffortType;
  virtualWorldName?: string | null;
  startTimeIso: string;
  elapsedSeconds: number;
  movingSeconds: number;
  distanceMeters?: number | null;
  elevationGainMeters?: number | null;
  samples: readonly IndoorSeriesSample[];
  intervals?: readonly IndoorIntervalBlock[];
  virtualCoordinates?: ReadonlyArray<readonly [number, number, number?]>;
}

export interface NormalizedIndoorActivity {
  providerId: 'zwift' | 'peloton' | 'trainerroad' | 'rouvy';
  externalActivityId: string;
  userId: string;
  title: string;
  effortType: IndoorEffortType;
  virtualWorldName: string | null;
  startTimeIso: string;
  elapsedSeconds: number;
  movingSeconds: number;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  availableSeries: {
    power: boolean;
    cadence: boolean;
    heartRate: boolean;
    speed: boolean;
    resistance: boolean;
  };
  summaryMetrics: {
    avgPowerWatts: number | null;
    maxPowerWatts: number | null;
    avgCadenceRpm: number | null;
    avgHeartRateBpm: number | null;
    maxHeartRateBpm: number | null;
  };
  samples: readonly IndoorSeriesSample[];
  intervals: readonly IndoorIntervalBlock[];
  /** Invariant recherche 08 : une séance indoor sans trace GPS réelle n'est jamais éligible aux segments GPS outdoor. */
  hasRealOutdoorGpsTrace: false;
  eligibleForOutdoorGpsSegments: false;
}

export type StravaSurfaceTarget =
  | 'owner_private_history'
  | 'owner_activity_detail'
  | 'public_community_feed'
  | 'club_activity_feed'
  | 'third_party_profile_view'
  | 'public_segment_leaderboard'
  | 'community_heatmap_aggregation'
  | 'ai_model_training_or_coaching';

export interface StravaImportedActivityRecord {
  internalActivityId: string;
  externalStravaActivityId: string;
  ownerUserId: string;
  title: string;
  sportType: string;
  startTimeIso: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  elevationGainMeters: number;
  summaryPolyline: string | null;
  connectorRevoked: boolean;
}

export interface StravaVisibilityDecision {
  allowed: boolean;
  surface: StravaSurfaceTarget;
  reason:
    | 'owner_authorized'
    | 'revoked_or_deauthorized'
    | 'strava_api_visibility_restricted_non_owner'
    | 'strava_api_prohibits_public_feed_or_heatmap'
    | 'strava_api_prohibits_ai_or_aggregation';
  projectedActivity: StravaImportedActivityRecord | null;
}
