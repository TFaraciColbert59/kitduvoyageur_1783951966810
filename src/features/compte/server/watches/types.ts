/**
 * Lot D03-UI — types du service serveur des montres.
 *
 * Le contrat métier reste `src/features/watches` (verrouillé) : ce module ne
 * fait que porter l'état de synchronisation d'un utilisateur (appareils,
 * paquets hors ligne, séances rapprochées et moteurs Live Sync).
 */

import type {
  ReconciledPhoneSession,
  WatchDeviceProfile,
  WatchLiveSyncFrame,
  WatchNativeAvailabilityStatus,
  WatchOfflinePackManager,
  WatchOfflinePackRecord,
  WatchSessionAckEnvelope,
  WatchSessionBatchEnvelope,
  WatchSessionReconciler,
  WatchCapabilityMatrix,
  WatchCompatibilityMatrixEntry,
  WatchNativeTargetDiagnostic,
  WatchNavigationFieldKey,
  WatchFieldLayoutConfig,
} from '@/features/watches';

/**
 * État en mémoire, isolé par utilisateur. Il n'est jamais partagé entre
 * requêtes d'utilisateurs différents et ne contient aucun identifiant secret.
 */
export interface UserWatchState {
  devices: Map<string, WatchDeviceProfile>;
  packs: WatchOfflinePackManager;
  reconciler: WatchSessionReconciler;
  /** Accusés déjà produits, pour rejouer un lot sans recompter de doublon. */
  processedBatches: Map<string, WatchSessionAckEnvelope>;
  /** Moteurs Live Sync par séance (une génération de source par séance). */
  liveEngines: Map<string, WatchLiveSyncEngineLike>;
  /** Disposition des champs, partagée par les séances d'un même utilisateur. */
  fieldLayout: WatchFieldLayoutConfig | null;
  updatedAtUtcMs: number;
}

/**
 * Sous-ensemble public du moteur Live Sync utilisé par le service. Le type
 * structurel évite de dépendre de l'implémentation concrète dans les tests.
 */
export interface WatchLiveSyncEngineLike {
  buildFrame(params: {
    sessionId: string;
    routeId: string | null;
    metrics: import('@/features/watches').WatchLiveMetricsInput;
    pois?: readonly import('@/features/watches').WatchRoutePoiInput[];
    nextManeuver?: import('@/features/watches').WatchNextManeuver | null;
    nowUtcMs?: number;
  }): WatchLiveSyncFrame;
  setFieldLayout(config: import('@/features/watches').WatchFieldLayoutConfig): {
    valid: boolean;
    normalizedPages: WatchNavigationFieldKey[][];
    errors: string[];
  };
  getActiveFieldKeys(): WatchNavigationFieldKey[];
  applyIncomingFrameOnWatch(frame: WatchLiveSyncFrame): {
    accepted: boolean;
    currentFrame: WatchLiveSyncFrame;
  };
  handoffSource(
    sessionId: string,
    toSource: 'phone' | 'watch',
    lastAcceptedSeq: number,
    nowUtcMs?: number,
  ): import('@/features/watches').WatchSourceHandoffEvent;
  getSourceState(): { sourceOwner: 'phone' | 'watch'; sourceGeneration: number };
}

export interface WatchStatusResult {
  status: WatchNativeAvailabilityStatus;
  diagnostic: WatchNativeTargetDiagnostic;
  matrix: readonly WatchCompatibilityMatrixEntry[];
  ficheIds: readonly string[];
  capabilities: WatchCapabilityMatrix;
  devices: Array<{
    profile: WatchDeviceProfile;
    capabilities: WatchCapabilityMatrix;
  }>;
  persistence: 'process_memory';
}

export interface WatchSessionListResult {
  sessions: ReconciledPhoneSession[];
  total: number;
  pending: number;
  finished: number;
}

export interface WatchPackListResult {
  packs: WatchOfflinePackRecord[];
  availableStorageBytes: number;
}

export interface WatchSessionIngestResult {
  ack: WatchSessionAckEnvelope;
  session: ReconciledPhoneSession;
  replayed: boolean;
}

export interface WatchLiveSyncStateResult {
  sessionId: string;
  sourceOwner: 'phone' | 'watch';
  sourceGeneration: number;
  fieldKeys: WatchNavigationFieldKey[];
}

export class WatchNotFoundError extends Error {
  constructor(message = 'Ressource montre introuvable.') {
    super(message);
    this.name = 'WatchNotFoundError';
  }
}

export class WatchRevisionConflictError extends Error {
  readonly expectedRevision: number;
  readonly receivedRevision: number;

  constructor(expectedRevision: number, receivedRevision: number) {
    super('La révision du paquet hors ligne ne correspond pas à celle préparée.');
    this.name = 'WatchRevisionConflictError';
    this.expectedRevision = expectedRevision;
    this.receivedRevision = receivedRevision;
  }
}

export class WatchPersistenceError extends Error {
  constructor(message = 'La synchronisation montre est momentanément indisponible.') {
    super(message);
    this.name = 'WatchPersistenceError';
  }
}

export type { WatchSessionBatchEnvelope };
