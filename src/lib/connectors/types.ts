import type {
  CapabilitySupportState,
  ConnectorCapabilitiesMatrix,
  ConnectorCategory,
  ConnectorConsentPurpose,
  ConnectorUsageScope,
  ManualFallbackFormat,
  PartnerProviderId,
  SyncJobKind,
  SyncJobStatus,
} from '@/features/connectors';

/** Ton visuel d'un état de connecteur (aucune couleur littérale côté composant). */
export type ConnectorTone = 'positive' | 'pending' | 'warning' | 'neutral';

export type ConnectorCapabilityKey = keyof Omit<ConnectorCapabilitiesMatrix, 'manualFallbackFormats'>;

export interface ConnectorCapabilityView {
  key: ConnectorCapabilityKey;
  label: string;
  state: CapabilitySupportState;
  stateLabel: string;
  tone: ConnectorTone;
}

export interface ConnectorCardView {
  id: PartnerProviderId;
  label: string;
  category: ConnectorCategory;
  categoryLabel: string;
  fiches: readonly string[];
  status: 'configured' | 'credentials_missing' | 'revoked' | 'unavailable';
  statusLabel: string;
  statusTone: ConnectorTone;
  statusReason: string;
  connected: boolean;
  oauthLinked: boolean;
  revocable: boolean;
  oauthAvailable: boolean;
  canStartOAuth: boolean;
  missingEnvVars: readonly string[];
  credentialHint: string | null;
  requiredPurposes: readonly ConnectorConsentPurpose[];
  grantedPurposes: readonly ConnectorConsentPurpose[];
  supportedUsages: readonly ConnectorUsageScope[];
  usageLabels: readonly string[];
  capabilities: readonly ConnectorCapabilityView[];
  manualFallbackFormats: readonly ManualFallbackFormat[];
  visibilityRestriction: 'standard_p01' | 'owner_only_no_public_or_ai';
  privacyNotice: string | null;
  lastSyncedAt: string | null;
  drawerSurface: string;
}

export interface ConnectorCatalogGroupView {
  category: ConnectorCategory;
  label: string;
  connectors: readonly ConnectorCardView[];
}

export interface ConnectorCatalogSummary {
  total: number;
  connected: number;
  available: number;
  credentialsMissing: number;
  revoked: number;
  unavailable: number;
  manualFallbacks: number;
}

export interface ConnectorCatalogResponse {
  generatedAt: string;
  policyVersion: string;
  connectors: readonly ConnectorCardView[];
  groups: readonly ConnectorCatalogGroupView[];
  summary: ConnectorCatalogSummary;
}

export interface ConnectorSyncJobView {
  jobId: string;
  providerId: PartnerProviderId;
  providerLabel: string;
  kind: SyncJobKind;
  kindLabel: string;
  targetEntityId: string;
  revision: number;
  status: SyncJobStatus;
  statusLabel: string;
  statusTone: ConnectorTone;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorSyncQueueSummary {
  total: number;
  pending: number;
  completed: number;
  failed: number;
  blocked: number;
  cancelled: number;
}

export interface ConnectorSyncQueueResponse {
  generatedAt: string;
  jobs: readonly ConnectorSyncJobView[];
  summary: ConnectorSyncQueueSummary;
}

export interface RouteSendTargetView {
  providerId: PartnerProviderId;
  label: string;
  status: ConnectorCardView['status'];
  canSend: boolean;
  modeLabel: string;
  manualFallbackFormats: readonly ManualFallbackFormat[];
  deviceCount: number;
}

export interface RouteDeliveryPlanView {
  providerId: PartnerProviderId;
  providerLabel: string;
  routeId: string;
  revision: number;
  deliveryMode: 'cloud_push_ready' | 'manual_file_fallback' | 'blocked_consent' | 'incompatible_device';
  deliveryLabel: string;
  exportedWaypointsCount: number;
  truncatedWaypointsCount: number;
  fallbackFormat: ManualFallbackFormat;
  reason: string;
  gpxFallbackXml: string;
  jobId: string | null;
  jobStatus: SyncJobStatus | null;
  jobStatusLabel: string | null;
}

export interface RouteSendResponse {
  plan: RouteDeliveryPlanView;
  garminCourse: unknown | null;
  hammerheadPois: unknown | null;
}

export interface ConnectorConsentResponse {
  catalog: ConnectorCatalogResponse;
}

export interface OAuthStartResponse {
  authorizationUrl: string;
  state: string;
  providerId: PartnerProviderId;
}

export interface OAuthStartFailure {
  status: 'credentials_missing' | 'unavailable' | 'invalid_request' | 'conflict';
  error: string;
  missingEnvVars: readonly string[];
}

export type OAuthStartServiceResult =
  | { ok: true; response: OAuthStartResponse }
  | { ok: false; failure: OAuthStartFailure };

export interface OAuthCompleteSuccess {
  ok: true;
  providerId: PartnerProviderId;
  redirectTo: string;
  catalog: ConnectorCatalogResponse;
}

export interface OAuthCompleteFailure {
  ok: false;
  providerId: PartnerProviderId;
  status:
    | 'unknown_state'
    | 'expired_state'
    | 'provider_mismatch'
    | 'user_mismatch'
    | 'credentials_missing'
    | 'transport_missing'
    | 'transport_error'
    | 'invalid_grant'
    | 'unavailable';
  error: string;
}

export type OAuthCompleteServiceResult = OAuthCompleteSuccess | OAuthCompleteFailure;

export interface RevokeServiceResult {
  ok: boolean;
  providerId: PartnerProviderId;
  userId: string;
  newStatus: 'revoked';
  revokedAt: string;
  cancelledPendingJobs: number;
  purgedTokenReferences: boolean;
  remoteRevocationStatus: 'revoked_remotely' | 'skipped_no_credentials' | 'remote_failed_local_enforced';
  catalog: ConnectorCatalogResponse;
}
