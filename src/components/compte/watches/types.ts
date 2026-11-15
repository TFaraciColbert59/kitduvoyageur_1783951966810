/**
 * Lot D03-UI — types de la surface « Montres » du Compte.
 *
 * Les objets métier viennent tous de `src/features/watches` (contrat livré) :
 * l'UI ne redéfinit ni un point GPS, ni un paquet, ni une trame Live Sync.
 */

import type {
  D03FicheId,
  ReconciledPhoneSession,
  WatchCapabilityKey,
  WatchCapabilityMatrix,
  WatchCompatibilityMatrixEntry,
  WatchDeviceProfile,
  WatchFieldLayoutConfig,
  WatchLiveSyncFrame,
  WatchNativeTargetDiagnostic,
  WatchNavigationFieldKey,
  WatchOfflinePackRecord,
  WatchPlatform,
  WatchRoutePoiInput,
} from '@/features/watches';

export type WatchTab = 'status' | 'sessions' | 'packs' | 'live';

export interface WatchStatusResponse {
  status: WatchNativeTargetDiagnostic['status'];
  diagnostic: WatchNativeTargetDiagnostic;
  matrix: readonly WatchCompatibilityMatrixEntry[];
  ficheIds: readonly D03FicheId[];
  capabilities: WatchCapabilityMatrix;
  devices: Array<{
    profile: WatchDeviceProfile;
    capabilities: WatchCapabilityMatrix;
  }>;
  persistence: 'process_memory';
  runtime?: {
    status: WatchNativeTargetDiagnostic['status'];
    persistence: 'process_memory';
    usersInRegistry: number;
  };
}

export interface WatchDevicesResponse {
  devices: WatchDeviceProfile[];
}

export interface WatchDeviceRegistrationResponse {
  profile: WatchDeviceProfile;
  capabilities: WatchCapabilityMatrix;
}

export interface WatchSessionsResponse {
  sessions: ReconciledPhoneSession[];
  total: number;
  pending: number;
  finished: number;
}

export interface WatchSessionIngestResponse {
  ack: {
    watchSessionId: string;
    ackedThroughSeq: number;
    ackedEventSeq: number;
    summaryAcked: boolean;
    canonicalClientSessionId: string;
    ackedAtUtcMs: number;
  };
  session: ReconciledPhoneSession;
  replayed: boolean;
}

export interface WatchPacksResponse {
  packs: WatchOfflinePackRecord[];
  availableStorageBytes: number;
}

export interface WatchPackResponse {
  pack: WatchOfflinePackRecord;
}

export interface WatchLiveSyncStateResponse {
  sessionId: string;
  sourceOwner: 'phone' | 'watch';
  sourceGeneration: number;
  fieldKeys: WatchNavigationFieldKey[];
}

export interface WatchFieldLayoutValidation {
  valid: boolean;
  normalizedPages: WatchNavigationFieldKey[][];
  errors: string[];
}

export interface WatchFrameResponse {
  frame: WatchLiveSyncFrame;
}

export interface WatchHandoffResponse {
  handoff: {
    sessionId: string;
    fromSource: 'phone' | 'watch';
    toSource: 'phone' | 'watch';
    lastAcceptedSeq: number;
    newSourceGeneration: number;
    handedOffAtUtcMs: number;
  };
}

export interface WatchApplyFrameResponse {
  accepted: boolean;
  frame: WatchLiveSyncFrame;
}

export interface UiNotice {
  tone: 'ok' | 'error' | 'warning' | 'info';
  text: string;
}

export interface WatchCapabilityDescriptor {
  key: WatchCapabilityKey;
  label: string;
  description: string;
}

export interface WatchPlatformDescriptor {
  platform: WatchPlatform;
  label: string;
}

export type { WatchFieldLayoutConfig, WatchRoutePoiInput };
