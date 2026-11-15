import {
  DEVICE_MODEL_CATALOG,
  PARTNER_CONNECTOR_DEFINITIONS,
  type ConnectorCapabilitiesMatrix,
  type ConnectorCategory,
  type ConnectorConsentPurpose,
  type ConnectorUsageScope,
  type PartnerProviderId,
  type ResolvedPartnerConnectorState,
  type SyncJobKind,
  type SyncJobStatus,
  type SyncQueueJob,
} from '@/features/connectors';
import type {
  ConnectorCapabilityView,
  ConnectorCardView,
  ConnectorCatalogGroupView,
  ConnectorCatalogSummary,
  ConnectorSyncJobView,
  ConnectorSyncQueueSummary,
  ConnectorTone,
  RouteSendTargetView,
} from './types';

export const CONNECTOR_CATEGORY_LABELS: Readonly<Record<ConnectorCategory, string>> = {
  gps_wearable: 'GPS & montres',
  bike_computer: 'Compteurs vélo',
  ebike_watch: 'VTT & montres connectées',
  embedded_app: 'App embarquée',
  indoor_platform: 'Plateformes indoor',
  health_platform: 'Santé',
  social_partner: 'Partenaire social',
};

export const CONNECTOR_CATEGORY_ORDER: readonly ConnectorCategory[] = [
  'gps_wearable',
  'bike_computer',
  'embedded_app',
  'ebike_watch',
  'health_platform',
  'indoor_platform',
  'social_partner',
];

export const CONNECTOR_USAGE_LABELS: Readonly<Record<ConnectorUsageScope, string>> = {
  activity_import: 'Import d’activités',
  route_export: 'Envoi d’itinéraires',
  waypoint_export: 'Waypoints & repères',
  live_sync: 'Live Sync en séance',
  connect_iq_map: 'Fond de carte Connect IQ',
  health_metrics: 'Données de santé',
};

export const CONNECTOR_PURPOSE_LABELS: Readonly<Record<ConnectorConsentPurpose, string>> = {
  personal_performance: 'Performance personnelle',
  collective_terrain: 'Terrain partagé',
  live_location: 'Position en direct',
  group_location: 'Position du groupe',
  external_readiness: 'Données de santé (désactivé)',
};

export const CAPABILITY_LABELS: Readonly<
  Record<keyof Omit<ConnectorCapabilitiesMatrix, 'manualFallbackFormats'>, string>
> = {
  activityImport: 'Import d’activités',
  routeExport: 'Envoi d’itinéraires',
  waypointExport: 'Waypoints / Up Ahead',
  upAheadClimbGuidance: 'Up Ahead & ascensions',
  liveSyncInSession: 'Live Sync en séance',
  embeddedMapApp: 'App Connect IQ / fond de carte',
  indoorSeriesPreservation: 'Séries indoor préservées',
  historicalBackfill: 'Historique',
};

export const CAPABILITY_ORDER: readonly (keyof Omit<
  ConnectorCapabilitiesMatrix,
  'manualFallbackFormats'
>)[] = [
  'activityImport',
  'routeExport',
  'waypointExport',
  'upAheadClimbGuidance',
  'liveSyncInSession',
  'embeddedMapApp',
  'indoorSeriesPreservation',
  'historicalBackfill',
];

export const SYNC_JOB_KIND_LABELS: Readonly<Record<SyncJobKind, string>> = {
  route_push: 'Envoi d’itinéraire',
  waypoint_push: 'Envoi de waypoints',
  activity_import: 'Import d’activité',
  live_sync_route: 'Live Sync',
};

export const SYNC_JOB_STATUS_LABELS: Readonly<Record<SyncJobStatus, string>> = {
  queued: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  failed_retryable: 'Échec — nouvelle tentative prévue',
  failed_terminal: 'Échec définitif',
  blocked_credentials_missing: 'Bloqué — credentials absents',
  blocked_consent_revoked: 'Bloqué — consentement manquant',
  superseded_by_newer_revision: 'Remplacé par une révision plus récente',
  cancelled: 'Annulé',
};

const CAPABILITY_STATE_LABELS: Readonly<Record<ConnectorCapabilityView['state'], string>> = {
  available: 'Disponible',
  unsupported: 'Non pris en charge',
  consent_required: 'Consentement requis',
  credentials_missing: 'Credentials absents',
  indeterminate: 'À vérifier',
  error: 'Erreur',
};

const CAPABILITY_TONES: Readonly<Record<ConnectorCapabilityView['state'], ConnectorTone>> = {
  available: 'positive',
  unsupported: 'neutral',
  consent_required: 'pending',
  credentials_missing: 'warning',
  indeterminate: 'neutral',
  error: 'warning',
};

export function capabilityStateLabel(state: ConnectorCapabilityView['state']): string {
  return CAPABILITY_STATE_LABELS[state];
}

export function connectorStatusTone(
  status: ResolvedPartnerConnectorState['status'],
  connected: boolean
): ConnectorTone {
  if (connected) return 'positive';
  if (status === 'credentials_missing' || status === 'unavailable') return 'warning';
  if (status === 'revoked') return 'neutral';
  return 'pending';
}

export function connectorStatusLabel(
  status: ResolvedPartnerConnectorState['status'],
  connected: boolean
): string {
  if (status === 'credentials_missing') return 'Indisponible — credentials absents';
  if (status === 'unavailable') return 'Service indisponible';
  if (status === 'revoked') return 'Connexion révoquée';
  if (connected) return 'Connecté';
  return 'Configuré — autorisation OAuth requise';
}

function buildCapabilities(capabilities: ConnectorCapabilitiesMatrix): ConnectorCapabilityView[] {
  return CAPABILITY_ORDER.filter((key) => capabilities[key] !== 'unsupported').map((key) => ({
    key,
    label: CAPABILITY_LABELS[key],
    state: capabilities[key],
    stateLabel: capabilityStateLabel(capabilities[key]),
    tone: CAPABILITY_TONES[capabilities[key]],
  }));
}

/**
 * Transforme l'état réel résolu par le registre D01 en modèle d'affichage.
 * Aucune capacité n'est inventée : « indisponible » reste « indisponible ».
 */
export function buildConnectorCard(
  state: ResolvedPartnerConnectorState,
  options?: { oauthLinked?: boolean; grantedPurposes?: readonly ConnectorConsentPurpose[] }
): ConnectorCardView {
  const def = state.definition;
  const oauthAvailable = Boolean(def.oauthAuthorizeUrl);
  const oauthLinked = options?.oauthLinked ?? state.connected;
  const credentialHint =
    state.missingEnvVars.length > 0
      ? `Credentials serveur absents : ${state.missingEnvVars.join(', ')}. Aucun jeton n’est simulé.`
      : null;
  const consentPending = oauthLinked && !state.connected && state.status === 'configured';
  const statusLabel = consentPending
    ? 'Lié — consentement requis'
    : connectorStatusLabel(state.status, state.connected);
  const statusReason = consentPending
    ? `Connexion ${def.label} autorisée, mais la finalité RGPD requise (${def.requiredPurposes.join(', ')}) n’est pas accordée. Aucune synchronisation n’est lancée avant ce consentement.`
    : state.statusReason;

  return {
    id: def.id,
    label: def.label,
    category: def.category,
    categoryLabel: CONNECTOR_CATEGORY_LABELS[def.category],
    fiches: def.fiches,
    status: state.status,
    statusLabel,
    statusTone: connectorStatusTone(state.status, state.connected),
    statusReason,
    connected: state.connected,
    oauthLinked,
    revocable: state.revocable || oauthLinked,
    oauthAvailable,
    canStartOAuth:
      oauthAvailable &&
      state.status !== 'credentials_missing' &&
      state.status !== 'unavailable' &&
      !oauthLinked,
    missingEnvVars: state.missingEnvVars,
    credentialHint,
    requiredPurposes: def.requiredPurposes,
    grantedPurposes: options?.grantedPurposes ?? [],
    supportedUsages: def.supportedUsages,
    usageLabels: def.supportedUsages.map((usage) => CONNECTOR_USAGE_LABELS[usage]),
    capabilities: buildCapabilities(state.capabilities),
    manualFallbackFormats: state.capabilities.manualFallbackFormats,
    visibilityRestriction: def.visibilityRestriction,
    privacyNotice:
      def.visibilityRestriction === 'owner_only_no_public_or_ai'
        ? 'Données visibles par toi seul : jamais dans le fil public, les classements ou l’entraînement IA.'
        : null,
    lastSyncedAt: state.lastSyncedAt,
    drawerSurface: def.drawerSurface,
  };
}

export function groupConnectorCards(cards: readonly ConnectorCardView[]): ConnectorCatalogGroupView[] {
  return CONNECTOR_CATEGORY_ORDER.map((category) => ({
    category,
    label: CONNECTOR_CATEGORY_LABELS[category],
    connectors: cards.filter((card) => card.category === category),
  })).filter((group) => group.connectors.length > 0);
}

export function summarizeCatalog(cards: readonly ConnectorCardView[]): ConnectorCatalogSummary {
  return {
    total: cards.length,
    connected: cards.filter((card) => card.connected).length,
    available: cards.filter((card) => card.status === 'configured').length,
    credentialsMissing: cards.filter((card) => card.status === 'credentials_missing').length,
    revoked: cards.filter((card) => card.status === 'revoked').length,
    unavailable: cards.filter((card) => card.status === 'unavailable').length,
    manualFallbacks: cards.filter((card) => card.manualFallbackFormats.length > 0).length,
  };
}

export function syncJobStatusTone(status: SyncJobStatus): ConnectorTone {
  switch (status) {
    case 'completed':
      return 'positive';
    case 'queued':
    case 'in_progress':
      return 'pending';
    case 'failed_retryable':
    case 'failed_terminal':
    case 'blocked_credentials_missing':
    case 'blocked_consent_revoked':
      return 'warning';
    case 'superseded_by_newer_revision':
    case 'cancelled':
      return 'neutral';
  }
}

export function buildSyncJobView(
  job: SyncQueueJob,
  providerLabel: string
): ConnectorSyncJobView {
  return {
    jobId: job.jobId,
    providerId: job.providerId,
    providerLabel,
    kind: job.kind,
    kindLabel: SYNC_JOB_KIND_LABELS[job.kind],
    targetEntityId: job.targetEntityId,
    revision: job.revision,
    status: job.status,
    statusLabel: SYNC_JOB_STATUS_LABELS[job.status],
    statusTone: syncJobStatusTone(job.status),
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    nextRetryAt: job.nextRetryAtMs === null ? null : new Date(job.nextRetryAtMs).toISOString(),
    lastError: job.lastError,
    createdAt: new Date(job.createdAtMs).toISOString(),
    updatedAt: new Date(job.updatedAtMs).toISOString(),
  };
}

export function summarizeSyncQueue(jobs: readonly ConnectorSyncJobView[]): ConnectorSyncQueueSummary {
  return {
    total: jobs.length,
    pending: jobs.filter((job) => job.status === 'queued' || job.status === 'in_progress').length,
    completed: jobs.filter((job) => job.status === 'completed').length,
    failed: jobs.filter(
      (job) => job.status === 'failed_retryable' || job.status === 'failed_terminal'
    ).length,
    blocked: jobs.filter((job) => job.status.startsWith('blocked_')).length,
    cancelled: jobs.filter((job) => job.status === 'cancelled').length,
  };
}

/**
 * Cibles d'envoi d'itinéraire. Un connecteur sans capacité d'envoi n'apparaît pas.
 * Un connecteur sans credentials reste proposé en repli manuel, jamais comme « prêt ».
 */
export function buildRouteSendTargets(cards: readonly ConnectorCardView[]): RouteSendTargetView[] {
  return cards
    .filter((card) => card.supportedUsages.includes('route_export'))
    .map((card) => {
      const deviceCount = DEVICE_MODEL_CATALOG.filter(
        (model) => model.providerId === card.id && model.compatible && model.supportsRouteImport
      ).length;
      const canSend = card.status === 'configured' || card.status === 'credentials_missing';
      const modeLabel = !canSend
        ? card.status === 'revoked'
          ? 'Connexion révoquée'
          : 'Indisponible'
        : card.status === 'configured' && card.connected
          ? 'Envoi cloud + repli manuel'
          : `Repli manuel ${card.manualFallbackFormats.join('/').toUpperCase()}`;
      return {
        providerId: card.id,
        label: card.label,
        status: card.status,
        canSend,
        modeLabel,
        manualFallbackFormats: card.manualFallbackFormats,
        deviceCount,
      };
    });
}

/** Appareils réels associés à un fournisseur, pour le sélecteur de modèle. */
export function listCompatibleDevices(providerId: PartnerProviderId) {
  return DEVICE_MODEL_CATALOG.filter(
    (model) => model.providerId === providerId && model.compatible
  );
}

export function providerLabel(providerId: PartnerProviderId): string {
  return PARTNER_CONNECTOR_DEFINITIONS[providerId]?.label ?? providerId;
}
