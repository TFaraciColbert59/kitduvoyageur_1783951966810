/**
 * Lot D03-UI — service serveur des montres Apple Watch / Wear OS.
 *
 * Le service ne réimplémente aucune règle du contrat : il délègue au
 * `WatchSessionReconciler`, au `WatchOfflinePackManager` et au
 * `WatchLiveSyncEngine` livrés dans `src/features/watches`. Il ajoute
 * uniquement l'isolation par utilisateur, la validation d'appartenance des
 * lots et des réponses explicites (aucun succès simulé).
 */

import {
  D03_FICHE_IDS,
  getSupportedWatchMatrix,
  inspectWatchNativeTargets,
  resolveWatchPlatformCapabilities,
  type WatchCapabilityMatrix,
  type WatchDeviceProfile,
  type WatchFieldLayoutConfig,
  type WatchLiveMetricsInput,
  type WatchLiveSyncFrame,
  type WatchNativeAvailabilityStatus,
  type WatchNextManeuver,
  type WatchOfflinePackChunk,
  type WatchOfflinePackManifest,
  type WatchPlatform,
  type WatchRoutePoiInput,
  type WatchSessionAckEnvelope,
  type WatchSessionBatchEnvelope,
} from '@/features/watches';
import {
  LAYOUT_ENGINE_KEY,
  getLayoutEngine,
  getLiveSyncEngine,
  getUserWatchState,
  watchStoreSize,
} from './store';
import {
  WatchNotFoundError,
  WatchRevisionConflictError,
  type WatchLiveSyncStateResult,
  type WatchPackListResult,
  type WatchSessionIngestResult,
  type WatchSessionListResult,
  type WatchStatusResult,
} from './types';
import type {
  WatchDeviceProfileInput,
  WatchFieldLayoutInput,
  WatchLiveMetricsInputSchema,
  WatchOfflinePackChunkInput,
  WatchOfflinePackManifestInput,
  WatchRoutePoiInputSchema,
  WatchSessionBatchInput,
} from './validation';

export interface WatchStatusOptions {
  xcodeWatchKitTargetPresent?: boolean;
  wearOsGradleModulePresent?: boolean;
  runtimeBridgeInjected?: boolean;
  platform?: WatchPlatform;
  deviceId?: string;
  nowIso?: string;
}

export interface WatchStatusDependencies {
  inspect?: typeof inspectWatchNativeTargets;
  matrix?: typeof getSupportedWatchMatrix;
  resolveCapabilities?: typeof resolveWatchPlatformCapabilities;
}

export interface WatchLiveFrameInput {
  sessionId: string;
  routeId: string | null;
  metrics: WatchLiveMetricsInput;
  pois?: readonly WatchRoutePoiInput[];
  nextManeuver?: WatchNextManeuver | null;
  nowUtcMs?: number;
}

function asCapabilityMatrix(value: WatchCapabilityMatrix): WatchCapabilityMatrix {
  return { ...value };
}

/**
 * Diagnostic réel, matrice de compatibilité et capacités effectives.
 * Par défaut, `inspectWatchNativeTargets()` renvoie `native_target_unavailable`
 * tant que les cibles WatchKit / Gradle `:wear` ne sont pas compilées.
 */
export function getWatchStatus(
  userId: string,
  options: WatchStatusOptions = {},
  dependencies: WatchStatusDependencies = {},
): WatchStatusResult {
  const inspect = dependencies.inspect ?? inspectWatchNativeTargets;
  const matrixFor = dependencies.matrix ?? getSupportedWatchMatrix;
  const resolve = dependencies.resolveCapabilities ?? resolveWatchPlatformCapabilities;

  const diagnostic = inspect({
    xcodeWatchKitTargetPresent: options.xcodeWatchKitTargetPresent,
    wearOsGradleModulePresent: options.wearOsGradleModulePresent,
    runtimeBridgeInjected: options.runtimeBridgeInjected,
    nowIso: options.nowIso,
  });
  const state = getUserWatchState(userId);

  const devices = Array.from(state.devices.values()).map((profile) => ({
    profile,
    capabilities: asCapabilityMatrix(resolve(profile, diagnostic)),
  }));

  const selected =
    (options.deviceId ? state.devices.get(options.deviceId) : undefined) ??
    (options.deviceId ? undefined : devices[0]?.profile);
  const capabilities = asCapabilityMatrix(resolve(selected ?? null, diagnostic));

  return {
    status: diagnostic.status,
    diagnostic,
    matrix: matrixFor(options.platform),
    ficheIds: [...D03_FICHE_IDS],
    capabilities,
    devices,
    persistence: 'process_memory',
  };
}

export function registerWatchDevice(
  userId: string,
  input: WatchDeviceProfileInput,
): { profile: WatchDeviceProfile; capabilities: WatchCapabilityMatrix } {
  const state = getUserWatchState(userId);
  const profile: WatchDeviceProfile = {
    ...input,
    permissions: { ...input.permissions },
  };
  state.devices.set(profile.deviceId, profile);
  state.updatedAtUtcMs = Date.now();
  const diagnostic = inspectWatchNativeTargets();
  return {
    profile,
    capabilities: asCapabilityMatrix(resolveWatchPlatformCapabilities(profile, diagnostic)),
  };
}

export function listWatchDevices(userId: string): WatchDeviceProfile[] {
  return Array.from(getUserWatchState(userId).devices.values()).sort((a, b) =>
    a.modelName.localeCompare(b.modelName, 'fr'),
  );
}

export function removeWatchDevice(userId: string, deviceId: string): void {
  const state = getUserWatchState(userId);
  if (!state.devices.delete(deviceId)) {
    throw new WatchNotFoundError('Montre introuvable.');
  }
  state.updatedAtUtcMs = Date.now();
}

function assertBatchConsistency(batch: WatchSessionBatchEnvelope): void {
  if (batch.fromSeq > batch.toSeq && batch.points.length > 0) {
    throw new Error('Plage de séquences du lot incohérente.');
  }
  for (const point of batch.points) {
    if (point.watchSessionId !== batch.watchSessionId) {
      throw new Error('Un point du lot appartient à une autre séance.');
    }
    if (point.seq < batch.fromSeq || point.seq > batch.toSeq) {
      throw new Error('Un point du lot sort de la plage annoncée.');
    }
  }
  if (batch.summary && batch.summary.watchSessionId !== batch.watchSessionId) {
    throw new Error('Le résumé du lot appartient à une autre séance.');
  }
}

/**
 * Ingère un lot de façon idempotente. Un lot déjà traité renvoie exactement le
 * même accusé et la même séance, sans incrémenter les compteurs de doublons.
 */
export function ingestWatchSessionBatch(
  userId: string,
  batch: WatchSessionBatchInput,
  nowUtcMs = Date.now(),
): WatchSessionIngestResult {
  assertBatchConsistency(batch as WatchSessionBatchEnvelope);
  const state = getUserWatchState(userId);
  const previous = state.processedBatches.get(batch.batchId);
  if (previous) {
    const session = state.reconciler.getReconciledSession(batch.watchSessionId);
    if (session) return { ack: previous, session, replayed: true };
  }

  const { ack, session } = state.reconciler.ingestBatch(
    batch as WatchSessionBatchEnvelope,
    nowUtcMs,
  );
  state.processedBatches.set(batch.batchId, ack);
  state.updatedAtUtcMs = nowUtcMs;
  return { ack, session, replayed: false };
}

export function listWatchSessions(userId: string): WatchSessionListResult {
  const sessions = getUserWatchState(userId)
    .reconciler.listReconciledSessions()
    .sort((a, b) => b.updatedAtUtcMs - a.updatedAtUtcMs);
  return {
    sessions,
    total: sessions.length,
    pending: sessions.filter((session) => session.status === 'active').length,
    finished: sessions.filter((session) => session.status === 'finished').length,
  };
}

export function getWatchSession(userId: string, watchSessionId: string) {
  const session = getUserWatchState(userId).reconciler.getReconciledSession(watchSessionId);
  if (!session) throw new WatchNotFoundError('Séance montre introuvable.');
  return session;
}

export function stageWatchPack(
  userId: string,
  manifest: WatchOfflinePackManifest | WatchOfflinePackManifestInput,
  totalChunks = Math.max(1, manifest.resources.length),
  nowUtcMs = Date.now(),
): WatchPackListResult['packs'][number] {
  const state = getUserWatchState(userId);
  const pack = state.packs.stageManifest(
    manifest as unknown as WatchOfflinePackManifest,
    totalChunks,
    nowUtcMs,
  );
  state.updatedAtUtcMs = nowUtcMs;
  return pack;
}

export function ingestWatchPackChunk(
  userId: string,
  chunk: WatchOfflinePackChunk | WatchOfflinePackChunkInput,
  nowUtcMs = Date.now(),
): { ack: { packId: string; routeRevision: number; ackedChunkIndex: number }; pack: ReturnType<typeof stageWatchPack> } {
  const state = getUserWatchState(userId);
  const record = state.packs.getPack(chunk.packId);
  if (!record) throw new WatchNotFoundError('Paquet hors ligne introuvable.');
  if (record.manifest.routeRevision !== chunk.routeRevision) {
    throw new WatchRevisionConflictError(record.manifest.routeRevision, chunk.routeRevision);
  }
  const result = state.packs.ingestChunk(chunk as WatchOfflinePackChunk, nowUtcMs);
  state.updatedAtUtcMs = nowUtcMs;
  return {
    ack: {
      packId: chunk.packId,
      routeRevision: chunk.routeRevision,
      ackedChunkIndex: result.ackedChunkIndex,
    },
    pack: result.record,
  };
}

export function verifyWatchPack(
  userId: string,
  packId: string,
  actualChecksumSha256: string,
  nowUtcMs = Date.now(),
): ReturnType<typeof stageWatchPack> {
  const state = getUserWatchState(userId);
  if (!state.packs.getPack(packId)) {
    throw new WatchNotFoundError('Paquet hors ligne introuvable.');
  }
  const pack = state.packs.verifyAndFinalizePack(packId, actualChecksumSha256, nowUtcMs);
  state.updatedAtUtcMs = nowUtcMs;
  return pack;
}

export function listWatchPacks(userId: string): WatchPackListResult {
  const state = getUserWatchState(userId);
  return {
    packs: state.packs.listPacks(),
    availableStorageBytes: state.packs.getAvailableStorageBytes(),
  };
}

export function getWatchPack(userId: string, packId: string) {
  const pack = getUserWatchState(userId).packs.getPack(packId);
  if (!pack) throw new WatchNotFoundError('Paquet hors ligne introuvable.');
  return pack;
}

export function removeWatchPack(userId: string, packId: string): void {
  const state = getUserWatchState(userId);
  if (!state.packs.removePack(packId)) {
    throw new WatchNotFoundError('Paquet hors ligne introuvable.');
  }
  state.updatedAtUtcMs = Date.now();
}

export function getWatchLiveSyncState(
  userId: string,
  sessionId: string,
): WatchLiveSyncStateResult {
  const state = getUserWatchState(userId);
  const engine = getLiveSyncEngine(state, sessionId);
  const source = engine.getSourceState();
  return {
    sessionId,
    sourceOwner: source.sourceOwner,
    sourceGeneration: source.sourceGeneration,
    fieldKeys: engine.getActiveFieldKeys(),
  };
}

export function buildWatchLiveFrame(
  userId: string,
  input: WatchLiveFrameInput,
): WatchLiveSyncFrame {
  const state = getUserWatchState(userId);
  const engine = getLiveSyncEngine(state, input.sessionId);
  if (state.fieldLayout) engine.setFieldLayout(state.fieldLayout);
  state.updatedAtUtcMs = Date.now();
  return engine.buildFrame({
    sessionId: input.sessionId,
    routeId: input.routeId,
    metrics: input.metrics,
    pois: input.pois,
    nextManeuver: input.nextManeuver ?? null,
    nowUtcMs: input.nowUtcMs,
  });
}

export function setWatchFieldLayout(
  userId: string,
  config: WatchFieldLayoutInput,
): { valid: boolean; normalizedPages: WatchFieldLayoutInput['pages']; errors: string[] } {
  const state = getUserWatchState(userId);
  const layout: WatchFieldLayoutConfig = {
    sport: config.sport,
    maxSlotsPerPage: config.maxSlotsPerPage,
    pages: config.pages,
  };
  const engine = getLayoutEngine(state);
  const result = engine.setFieldLayout(layout);
  if (result.valid) {
    state.fieldLayout = { ...layout, pages: result.normalizedPages };
    // Les moteurs de séance déjà créés doivent voir la nouvelle disposition.
    for (const [key, sessionEngine] of state.liveEngines.entries()) {
      if (key !== LAYOUT_ENGINE_KEY) sessionEngine.setFieldLayout(state.fieldLayout);
    }
  }
  state.updatedAtUtcMs = Date.now();
  return {
    valid: result.valid,
    normalizedPages: result.normalizedPages,
    errors: result.errors,
  };
}

export function handoffWatchSource(
  userId: string,
  sessionId: string,
  toSource: 'phone' | 'watch',
  lastAcceptedSeq: number,
  nowUtcMs = Date.now(),
) {
  const state = getUserWatchState(userId);
  const engine = getLiveSyncEngine(state, sessionId);
  state.updatedAtUtcMs = nowUtcMs;
  return engine.handoffSource(sessionId, toSource, lastAcceptedSeq, nowUtcMs);
}

export function applyWatchLiveFrame(userId: string, frame: WatchLiveSyncFrame) {
  const state = getUserWatchState(userId);
  const engine = getLiveSyncEngine(state, frame.sessionId);
  state.updatedAtUtcMs = Date.now();
  return engine.applyIncomingFrameOnWatch(frame);
}

export function validateWatchFieldLayout(
  userId: string,
  config: WatchFieldLayoutInput,
) {
  return setWatchFieldLayout(userId, config);
}

export function getWatchRuntimeInfo(): {
  status: WatchNativeAvailabilityStatus;
  persistence: 'process_memory';
  usersInRegistry: number;
} {
  return {
    status: inspectWatchNativeTargets().status,
    persistence: 'process_memory',
    usersInRegistry: watchStoreSize(),
  };
}

export type {
  WatchLiveMetricsInputSchema,
  WatchRoutePoiInputSchema,
};
