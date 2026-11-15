/**
 * Lot D03 — Applications Apple Watch & Wear OS / Galaxy Watch
 * Références : K6.09, K6.10, K6.11, S6.01, S6.02
 *
 * Contrat TypeScript complet pour :
 * - le diagnostic des cibles natives WatchKit / Wear OS (`native_target_unavailable`)
 *   et la matrice de compatibilité matérielle/OS ;
 * - l'enregistrement GPS autonome sur montre, la gestion des horloges (UTC vs
 *   monotone par `bootId`), la reprise après redémarrage et la file locale de
 *   sorties hors ligne idempotente ;
 * - le rapprochement (reconciliation) sans perte ni doublon côté téléphone
 *   après coupure Bluetooth / réseau ;
 * - les paquets de cartes et d'itinéraires hors ligne sur montre (manifeste,
 *   capacités explicites, reprise par blocs, remplacement atomique) ;
 * - le protocole compagnon Live Sync, les champs personnalisés et les POI à venir.
 */

export const D03_FICHE_IDS = ['K6.09', 'K6.10', 'K6.11', 'S6.01', 'S6.02'] as const;
export type D03FicheId = (typeof D03_FICHE_IDS)[number];

export type WatchPlatform = 'apple_watch' | 'wear_os' | 'galaxy_watch';

export type WatchTransportChannel = 'watch_connectivity' | 'wear_data_layer';

export type WatchNativeAvailabilityStatus =
  | 'available'
  | 'native_target_unavailable'
  | 'companion_app_not_installed'
  | 'watch_not_paired'
  | 'companion_disconnected'
  | 'unsupported_os_version'
  | 'permission_required';

export type WatchCapabilityKey =
  | 'autonomous_gps_recording'
  | 'offline_map_pack'
  | 'turn_by_turn_guidance'
  | 'live_sync_fields'
  | 'upcoming_pois'
  | 'offline_session_queue'
  | 'workout_session_recovery'
  | 'heart_rate_sensor';

/**
 * État explicite d'une capacité sur la montre (Recherche 08).
 * Note : sur iOS/watchOS, HealthKit ne révèle pas le refus de lecture
 * (`indeterminate` au lieu d'un faux `denied`).
 */
export type WatchCapabilityState =
  | 'available'
  | 'native_target_unavailable'
  | 'unsupported'
  | 'consent_required'
  | 'indeterminate'
  | 'degraded'
  | 'error';

export interface WatchPermissionSnapshot {
  locationWhenInUse: 'granted' | 'denied' | 'prompt';
  locationAlwaysOrWorkout: 'granted' | 'denied' | 'prompt';
  healthWorkoutWrite: 'granted' | 'denied' | 'prompt';
  /**
   * Sur Apple HealthKit, la lecture ne distingue pas un refus d'une absence
   * de données : l'état doit pouvoir rester `indeterminate`.
   */
  healthMetricsRead: 'granted' | 'denied' | 'indeterminate' | 'prompt';
}

export interface WatchDeviceProfile {
  deviceId: string;
  platform: WatchPlatform;
  modelName: string;
  osVersion: string;
  hasBuiltInGps: boolean;
  storageAvailableBytes: number;
  batteryPercent: number | null;
  pairedPhonePlatform: 'ios' | 'android' | 'web';
  permissions: WatchPermissionSnapshot;
}

export interface WatchCompatibilityMatrixEntry {
  platform: WatchPlatform;
  vendor: 'Apple' | 'Google / Wear OS' | 'Samsung';
  modelsSupported: readonly string[];
  minOsVersion: string;
  transportChannel: WatchTransportChannel;
  nativeApis: readonly string[];
  ficheRefs: readonly D03FicheId[];
}

export interface MissingNativeTargetDetail {
  platform: WatchPlatform;
  expectedProjectPath: string;
  expectedTargetType: string;
  presentInRepo: boolean;
  missingComponents: readonly string[];
}

export interface WatchNativeTargetDiagnostic {
  status: WatchNativeAvailabilityStatus;
  checkedAtIso: string;
  xcodeWatchKitTargetPresent: boolean;
  wearOsGradleModulePresent: boolean;
  runtimeBridgeInjected: boolean;
  missingTargets: readonly MissingNativeTargetDetail[];
  summary: string;
}

export type WatchCapabilityMatrix = Record<WatchCapabilityKey, WatchCapabilityState>;

// ---------------------------------------------------------------------------
// K6.09 / K6.11 / S6.01 / S6.02 — Séance autonome, horloges & file hors ligne
// ---------------------------------------------------------------------------

export type WatchSessionStatus =
  | 'prepared'
  | 'recording'
  | 'paused'
  | 'finalizing'
  | 'finished';

export type WatchSyncState =
  | 'pending_local'
  | 'transferring'
  | 'partially_acked'
  | 'synced'
  | 'conflict'
  | 'failed_retryable';

export interface WatchGpsPointInput {
  recordedAtUtcMs: number;
  /** Temps monotone depuis le démarrage courant de la montre (ms). */
  monotonicMs?: number | null;
  bootId: string;
  lat: number;
  lng: number;
  eleM?: number | null;
  accuracyM?: number | null;
  speedMps?: number | null;
  heartRateBpm?: number | null;
  drawn?: boolean;
}

export interface WatchGpsPoint {
  /** Clé déterministe : `${watchSessionId}:${seqPadded}` */
  key: string;
  watchSessionId: string;
  /** Séquence strictement croissante (1..N) au sein de `watchSessionId`. */
  seq: number;
  recordedAtUtcMs: number;
  monotonicMs: number | null;
  bootId: string;
  lat: number;
  lng: number;
  eleM: number | null;
  accuracyM: number | null;
  speedMps: number | null;
  heartRateBpm: number | null;
  drawn: boolean;
  /** Vrai après une pause, un redémarrage ou une bascule de source. */
  breakBefore: boolean;
}

export type WatchLifecycleEventType =
  | 'pause'
  | 'resume'
  | 'reboot_detected'
  | 'clock_jump_detected'
  | 'permission_revoked'
  | 'handoff_to_phone'
  | 'handoff_to_watch';

export interface WatchPauseEvent {
  seq: number;
  type: WatchLifecycleEventType;
  atUtcMs: number;
  monotonicMs: number | null;
  bootId: string;
  reason?: string;
}

export interface WatchClockAnomaly {
  atUtcMs: number;
  previousUtcMs: number;
  deltaUtcMs: number;
  monotonicDeltaMs: number | null;
  bootId: string;
}

export interface WatchAutonomousSession {
  /**
   * Identifiant UUID v4 figé avant le premier point.
   * Sert de `clientSessionId` canonique lors du rapprochement téléphone/serveur
   * pour garantir l'unicité de la sortie.
   */
  watchSessionId: string;
  deviceId: string;
  platform: WatchPlatform;
  sport: string;
  routePackId: string | null;
  status: WatchSessionStatus;
  syncState: WatchSyncState;
  /** Incrémenté à chaque redémarrage de montre ou bascule de source. */
  sourceGeneration: number;
  currentBootId: string;
  startedAtUtcMs: number;
  endedAtUtcMs: number | null;
  lastTimestampUtcMs: number;
  lastMonotonicMs: number | null;
  elapsedMs: number;
  movingMs: number;
  distanceM: number;
  elevGainM: number;
  elevLossM: number;
  lastPointSeq: number;
  ackedThroughSeq: number;
  lastEventSeq: number;
  ackedEventSeq: number;
  summaryAcked: boolean;
  points: WatchGpsPoint[];
  events: WatchPauseEvent[];
  clockAnomalies: WatchClockAnomaly[];
  updatedAtUtcMs: number;
}

export interface WatchSessionSummaryPayload {
  watchSessionId: string;
  deviceId: string;
  platform: WatchPlatform;
  sport: string;
  routePackId: string | null;
  startedAtUtcMs: number;
  endedAtUtcMs: number;
  elapsedMs: number;
  movingMs: number;
  distanceM: number;
  elevGainM: number;
  elevLossM: number;
  totalPoints: number;
  totalEvents: number;
  sourceGeneration: number;
  idempotencyKey: string;
}

export interface WatchSessionBatchEnvelope {
  batchId: string;
  watchSessionId: string;
  deviceId: string;
  platform: WatchPlatform;
  sport: string;
  routePackId: string | null;
  sourceGeneration: number;
  fromSeq: number;
  toSeq: number;
  points: WatchGpsPoint[];
  events: WatchPauseEvent[];
  summary: WatchSessionSummaryPayload | null;
  sentAtUtcMs: number;
}

export interface WatchSessionAckEnvelope {
  watchSessionId: string;
  ackedThroughSeq: number;
  ackedEventSeq: number;
  summaryAcked: boolean;
  canonicalClientSessionId: string;
  ackedAtUtcMs: number;
}

export interface ReconciledPhoneSession {
  /** Identique à `watchSessionId` pour réutiliser le contrat A01 sans doublon. */
  clientSessionId: string;
  watchSessionId: string;
  deviceId: string;
  platform: WatchPlatform;
  sport: string;
  routePackId: string | null;
  status: 'active' | 'finished';
  startedAtUtcMs: number;
  endedAtUtcMs: number | null;
  elapsedMs: number;
  movingMs: number;
  distanceM: number;
  elevGainM: number;
  elevLossM: number;
  lastContiguousPointSeq: number;
  lastEventSeq: number;
  points: WatchGpsPoint[];
  events: WatchPauseEvent[];
  batchesReceivedCount: number;
  duplicatePointsIgnored: number;
  duplicateEventsIgnored: number;
  summarySaved: boolean;
  updatedAtUtcMs: number;
}

// ---------------------------------------------------------------------------
// K6.09 / K6.11 — Paquets de cartes et d'itinéraires hors ligne sur montre
// ---------------------------------------------------------------------------

export type WatchOfflinePackStatus =
  | 'estimated'
  | 'queued'
  | 'transferring'
  | 'verifying'
  | 'available'
  | 'degraded'
  | 'suspended'
  | 'obsolete'
  | 'error';

export type WatchOfflinePackErrorReason =
  | 'insufficient_storage'
  | 'checksum_mismatch'
  | 'missing_required_resource'
  | 'transfer_interrupted'
  | 'provider_rights_denied'
  | 'native_target_unavailable';

/**
 * Déclaration séparée des capacités hors ligne (Recherche 04).
 */
export interface WatchOfflinePackCapabilities {
  viewRouteTrace: boolean;
  viewBaseMap: boolean;
  followTurnByTurn: boolean;
  localPlaceSearch: boolean;
  localRerouting: boolean;
  liveWeatherAndClosures: boolean;
}

export interface WatchOfflineBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface WatchOfflineResourceDescriptor {
  resourceId: string;
  kind: 'route_geometry' | 'maneuvers' | 'vector_tiles' | 'style_json' | 'glyphs' | 'sprites' | 'pois';
  requiredForFullMap: boolean;
  sizeBytes: number;
  sha256: string;
}

export interface WatchOfflinePackManifest {
  packId: string;
  routeId: string;
  routeRevision: number;
  ownerUserId: string;
  provider: string;
  OfflineLicenseAllowed: boolean;
  styleVersion: string;
  bounds: WatchOfflineBounds;
  minZoom: number;
  maxZoom: number;
  totalBytes: number;
  checksumSha256: string;
  resources: readonly WatchOfflineResourceDescriptor[];
  createdAtUtcMs: number;
}

export interface WatchOfflinePackRecord {
  manifest: WatchOfflinePackManifest;
  status: WatchOfflinePackStatus;
  capabilities: WatchOfflinePackCapabilities;
  transferredBytes: number;
  ackedChunkIndex: number;
  totalChunks: number;
  verifiedResourceIds: string[];
  missingResourceIds: string[];
  errorReason: WatchOfflinePackErrorReason | null;
  lastVerifiedAtUtcMs: number | null;
  /** Révision précédente conservée tant que la nouvelle n'est pas validée. */
  previousValidManifest: WatchOfflinePackManifest | null;
  updatedAtUtcMs: number;
}

export interface WatchOfflinePackChunk {
  packId: string;
  routeRevision: number;
  chunkIndex: number;
  totalChunks: number;
  byteLength: number;
  resourceIdsCovered: readonly string[];
  chunkChecksum: string;
}

// ---------------------------------------------------------------------------
// K6.10 / S6.01 / S6.02 — Live Sync, champs personnalisés et POI à venir
// ---------------------------------------------------------------------------

export type WatchNavigationFieldKey =
  | 'distance_total_m'
  | 'distance_remaining_m'
  | 'elevation_gain_m'
  | 'elevation_remaining_m'
  | 'moving_time_s'
  | 'elapsed_time_s'
  | 'current_speed_mps'
  | 'average_speed_mps'
  | 'pace_s_per_km'
  | 'heart_rate_bpm'
  | 'eta_utc_ms'
  | 'off_route_distance_m'
  | 'next_turn_distance_m'
  | 'battery_percent';

export interface WatchCustomFieldValue {
  key: WatchNavigationFieldKey;
  label: string;
  unit: 'm' | 'km' | 's' | 'mps' | 'km/h' | 's/km' | 'bpm' | 'timestamp' | '%';
  /** `null` si le capteur ou la donnée source est indisponible (aucune valeur inventée). */
  value: number | null;
   formatted: string;
  available: boolean;
}

export interface WatchFieldLayoutConfig {
  sport: string;
  maxSlotsPerPage: number;
  pages: ReadonlyArray<ReadonlyArray<WatchNavigationFieldKey>>;
}

export interface WatchRoutePoiInput {
  id: string;
  name: string;
  category: 'summit' | 'water' | 'shelter' | 'danger' | 'viewpoint' | 'waypoint' | 'turn';
  lat: number;
  lng: number;
  distanceAlongRouteM: number;
  eleM?: number | null;
  maneuverInstruction?: string | null;
}

export interface WatchUpcomingPoi {
  id: string;
  name: string;
  category: WatchRoutePoiInput['category'];
  lat: number;
  lng: number;
  distanceAlongRouteM: number;
  distanceRemainingM: number;
  elevationDeltaM: number | null;
  maneuverInstruction: string | null;
}

export interface WatchNextManeuver {
  instruction: string;
  direction: 'straight' | 'slight_left' | 'left' | 'sharp_left' | 'slight_right' | 'right' | 'sharp_right' | 'uturn' | 'arrive';
  distanceToTurnM: number;
  streetOrTrailName?: string | null;
}

export interface WatchLiveMetricsInput {
  distanceM: number;
  distanceRemainingM?: number | null;
  elevGainM: number;
  elevRemainingM?: number | null;
  movingS: number;
  elapsedS: number;
  currentSpeedMps?: number | null;
  averageSpeedMps?: number | null;
  heartRateBpm?: number | null;
  currentElevationM?: number | null;
  etaUtcMs?: number | null;
  offRoute: boolean;
  offRouteDistanceM?: number | null;
  paused: boolean;
  batteryPercent?: number | null;
}

export interface WatchLiveSyncFrame {
  frameSeq: number;
  sessionId: string;
  routeId: string | null;
  sourceOwner: 'phone' | 'watch';
  sourceGeneration: number;
  sentAtUtcMs: number;
  paused: boolean;
  offRoute: boolean;
  offRouteDistanceM: number | null;
  nextManeuver: WatchNextManeuver | null;
  upcomingPois: WatchUpcomingPoi[];
  customFields: WatchCustomFieldValue[];
}

export interface WatchSourceHandoffEvent {
  sessionId: string;
  fromSource: 'phone' | 'watch';
  toSource: 'phone' | 'watch';
  lastAcceptedSeq: number;
  newSourceGeneration: number;
  handedOffAtUtcMs: number;
}

// ---------------------------------------------------------------------------
// Protocole Compagnon WatchConnectivity / Wear DataLayer
// ---------------------------------------------------------------------------

export type WatchProtocolMessage =
  | {
      type: 'session_batch';
      channel: WatchTransportChannel;
      payload: WatchSessionBatchEnvelope;
    }
  | {
      type: 'session_ack';
      channel: WatchTransportChannel;
      payload: WatchSessionAckEnvelope;
    }
  | {
      type: 'offline_pack_chunk';
      channel: WatchTransportChannel;
      payload: WatchOfflinePackChunk;
    }
  | {
      type: 'offline_pack_ack';
      channel: WatchTransportChannel;
      payload: { packId: string; routeRevision: number; ackedChunkIndex: number };
    }
  | {
      type: 'live_sync_frame';
      channel: WatchTransportChannel;
      payload: WatchLiveSyncFrame;
    }
  | {
      type: 'source_handoff';
      channel: WatchTransportChannel;
      payload: WatchSourceHandoffEvent;
    };

export interface WatchCompanionTransportAdapter {
  readonly channel: WatchTransportChannel;
  readonly platform: WatchPlatform;
  isNativeTargetAvailable(): Promise<boolean>;
  isCompanionReachable(): Promise<boolean>;
  sendMessage(message: WatchProtocolMessage): Promise<{ delivered: boolean; reason?: string }>;
  onMessage(handler: (message: WatchProtocolMessage) => void | Promise<void>): () => void;
}
