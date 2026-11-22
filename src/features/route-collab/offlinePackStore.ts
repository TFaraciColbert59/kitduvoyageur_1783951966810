import { stableHash } from './engine';
import type {
  ApplyOperationResult,
  CollaborativeKitItem,
  DeparturePackManifest,
  RouteOperationInput,
  RouteRevisionSnapshot,
  RouteWorkspaceState,
} from './types';

export interface StoredDeparturePack {
  readonly manifest: DeparturePackManifest;
  readonly revision: RouteRevisionSnapshot;
  readonly verifiedAt: string;
  readonly complete: boolean;
}

export interface PendingOfflineOperation {
  readonly opId: string;
  readonly workspaceId: string;
  readonly baseSeq: number;
  readonly operation: RouteOperationInput;
  readonly expectedVersions: Readonly<Record<string, number>>;
  readonly queuedAt: string;
  readonly status: 'pending' | 'replaying' | 'conflict' | 'rejected';
  readonly errorMessage?: string | null;
}

export interface ActiveActivitySessionLink {
  readonly sessionId: string;
  readonly workspaceId: string;
  readonly revisionId: string;
  readonly revisionNo: number;
  readonly kitSnapshot: readonly CollaborativeKitItem[];
  readonly startedAt: string;
  readonly pendingUpgradeRevisionNo?: number | null;
}

export interface CarnetReturnRecord {
  readonly carnetId: string;
  readonly workspaceId: string;
  readonly plannedRevisionId: string;
  readonly plannedRevisionNo: number;
  readonly kitSnapshot: readonly CollaborativeKitItem[];
  readonly recordedDistanceKm: number;
  readonly recordedAscentM: number | null;
  readonly recordedCoords: readonly [number, number][];
  readonly completedAt: string;
}

interface DeviceOfflineBucket {
  /** Dernier pack complet et vérifié localement par workspaceId. */
  verifiedPacks: Record<string, StoredDeparturePack>;
  /** Téléchargement en cours (jamais promu tant que non vérifié). */
  stagingPacks: Record<string, { manifest: DeparturePackManifest; receivedChunks: number; totalChunks: number }>;
  /** File persistante d'opérations locales hors ligne. */
  pendingQueue: PendingOfflineOperation[];
  /** Lien de séance d'activité active. */
  activeActivity: ActiveActivitySessionLink | null;
  /** Comptes rendus figés au retour. */
  carnetRecords: Record<string, CarnetReturnRecord>;
}

const STORAGE_KEY = 'lkdv:route-collab:offline:v1';

const memoryFallback = new Map<string, string>();

function readBucket(userId: string): DeviceOfflineBucket {
  const key = `${STORAGE_KEY}:${userId}`;
  try {
    const raw =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(key)
        : memoryFallback.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeviceOfflineBucket>;
      return {
        verifiedPacks: parsed.verifiedPacks ?? {},
        stagingPacks: parsed.stagingPacks ?? {},
        pendingQueue: Array.isArray(parsed.pendingQueue) ? parsed.pendingQueue : [],
        activeActivity: parsed.activeActivity ?? null,
        carnetRecords: parsed.carnetRecords ?? {},
      };
    }
  } catch {
    /* ignore */
  }
  return {
    verifiedPacks: {},
    stagingPacks: {},
    pendingQueue: [],
    activeActivity: null,
    carnetRecords: {},
  };
}

function writeBucket(userId: string, bucket: DeviceOfflineBucket): void {
  const key = `${STORAGE_KEY}:${userId}`;
  const raw = JSON.stringify(bucket);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, raw);
    } else {
      memoryFallback.set(key, raw);
    }
  } catch {
    memoryFallback.set(key, raw);
  }
}

export function verifyPackChecksum(manifest: DeparturePackManifest, revision: RouteRevisionSnapshot): boolean {
  const payload = {
    revId: revision.id,
    points: revision.points,
    sections: revision.sections,
    stages: revision.stages,
    kitSnapshot: revision.kitSnapshot,
  };
  return stableHash(payload) === manifest.checksum;
}

/**
 * Démarre le téléchargement d'un pack dans une zone de staging.
 * Si le téléchargement échoue ou est interrompu (mode avion / fermeture),
 * le dernier pack complet vérifié (`verifiedPacks[workspaceId]`) reste intact.
 */
export function stagePackDownload(
  userId: string,
  manifest: DeparturePackManifest,
  receivedChunks = 1,
  totalChunks = 2,
): void {
  const bucket = readBucket(userId);
  bucket.stagingPacks[manifest.workspaceId] = { manifest, receivedChunks, totalChunks };
  writeBucket(userId, bucket);
}

/**
 * Finalise et vérifie localement le pack avant de le promouvoir comme « prêt ».
 */
export function commitVerifiedPack(
  userId: string,
  manifest: DeparturePackManifest,
  revision: RouteRevisionSnapshot,
  nowIso: string,
): { ok: true; pack: StoredDeparturePack } | { ok: false; reason: string } {
  if (!verifyPackChecksum(manifest, revision)) {
    return { ok: false, reason: 'Empreinte du pack invalide : téléchargement corrompu.' };
  }
  const bucket = readBucket(userId);
  const pack: StoredDeparturePack = {
    manifest,
    revision,
    verifiedAt: nowIso,
    complete: true,
  };
  bucket.verifiedPacks[manifest.workspaceId] = pack;
  delete bucket.stagingPacks[manifest.workspaceId];
  writeBucket(userId, bucket);
  return { ok: true, pack };
}

export function getLastVerifiedPack(userId: string, workspaceId: string): StoredDeparturePack | null {
  const bucket = readBucket(userId);
  const pack = bucket.verifiedPacks[workspaceId] ?? null;
  if (!pack || !pack.complete) return null;
  if (!verifyPackChecksum(pack.manifest, pack.revision)) return null;
  return pack;
}

export function getStagedPack(userId: string, workspaceId: string) {
  return readBucket(userId).stagingPacks[workspaceId] ?? null;
}

export function enqueueOfflineOperation(
  userId: string,
  op: Omit<PendingOfflineOperation, 'status'>,
): PendingOfflineOperation[] {
  const bucket = readBucket(userId);
  if (!bucket.pendingQueue.some((item) => item.opId === op.opId)) {
    bucket.pendingQueue.push({ ...op, status: 'pending' });
    writeBucket(userId, bucket);
  }
  return bucket.pendingQueue;
}

export function listOfflineQueue(userId: string, workspaceId?: string): PendingOfflineOperation[] {
  const queue = readBucket(userId).pendingQueue;
  return workspaceId ? queue.filter((q) => q.workspaceId === workspaceId) : queue;
}

export async function replayOfflineQueue(
  userId: string,
  workspaceId: string,
  executor: (op: PendingOfflineOperation) => Promise<ApplyOperationResult>,
): Promise<{
  appliedCount: number;
  conflicts: PendingOfflineOperation[];
  rejected: PendingOfflineOperation[];
  remaining: PendingOfflineOperation[];
}> {
  const bucket = readBucket(userId);
  const targetOps = bucket.pendingQueue.filter((q) => q.workspaceId === workspaceId);
  const otherOps = bucket.pendingQueue.filter((q) => q.workspaceId !== workspaceId);

  let appliedCount = 0;
  const conflicts: PendingOfflineOperation[] = [];
  const rejected: PendingOfflineOperation[] = [];
  const nextForWorkspace: PendingOfflineOperation[] = [];

  for (const op of targetOps) {
    const res = await executor(op);
    if (res.status === 'accepted' || res.status === 'already_applied') {
      appliedCount += 1;
    } else if (res.status === 'conflict') {
      const updated: PendingOfflineOperation = {
        ...op,
        status: 'conflict',
        errorMessage: res.conflicts.map((c) => c.message).join(' · '),
      };
      conflicts.push(updated);
      nextForWorkspace.push(updated);
    } else if (res.status === 'denied') {
      const updated: PendingOfflineOperation = {
        ...op,
        status: 'rejected',
        errorMessage: res.reason,
      };
      rejected.push(updated);
      nextForWorkspace.push(updated);
    }
  }

  bucket.pendingQueue = [...otherOps, ...nextForWorkspace];
  writeBucket(userId, bucket);
  return { appliedCount, conflicts, rejected, remaining: nextForWorkspace };
}

export function clearOfflineQueueItem(userId: string, opId: string): void {
  const bucket = readBucket(userId);
  bucket.pendingQueue = bucket.pendingQueue.filter((q) => q.opId !== opId);
  writeBucket(userId, bucket);
}

/* ---------- Activité & Carnet (Étape 4) ---------- */

export function startActivityFromRevision(
  userId: string,
  revision: RouteRevisionSnapshot,
  nowIso: string,
): ActiveActivitySessionLink {
  const bucket = readBucket(userId);
  const link: ActiveActivitySessionLink = {
    sessionId: `act-${revision.workspaceId}-${Date.now().toString(36)}`,
    workspaceId: revision.workspaceId,
    revisionId: revision.id,
    revisionNo: revision.revisionNo,
    kitSnapshot: revision.kitSnapshot,
    startedAt: nowIso,
    pendingUpgradeRevisionNo: null,
  };
  bucket.activeActivity = link;
  writeBucket(userId, bucket);
  return link;
}

export function getActiveActivityLink(userId: string): ActiveActivitySessionLink | null {
  return readBucket(userId).activeActivity;
}

export function finishActivityToCarnet(params: {
  userId: string;
  carnetId: string;
  recordedDistanceKm: number;
  recordedAscentM: number | null;
  recordedCoords: readonly [number, number][];
  nowIso: string;
}): CarnetReturnRecord | null {
  const bucket = readBucket(params.userId);
  const active = bucket.activeActivity;
  if (!active) return null;
  const record: CarnetReturnRecord = {
    carnetId: params.carnetId,
    workspaceId: active.workspaceId,
    plannedRevisionId: active.revisionId,
    plannedRevisionNo: active.revisionNo,
    kitSnapshot: active.kitSnapshot,
    recordedDistanceKm: params.recordedDistanceKm,
    recordedAscentM: params.recordedAscentM,
    recordedCoords: params.recordedCoords,
    completedAt: params.nowIso,
  };
  bucket.carnetRecords[params.carnetId] = record;
  bucket.activeActivity = null;
  writeBucket(params.userId, bucket);
  return record;
}

export function getCarnetReturnRecord(userId: string, carnetId: string): CarnetReturnRecord | null {
  return readBucket(userId).carnetRecords[carnetId] ?? null;
}

/**
 * « Reprendre cette sortie » : crée un nouveau brouillon indépendant avec sa propre
 * provenance pointant vers la sortie d'origine.
 */
export function duplicateWorkspaceWithProvenance(params: {
  sourceWorkspace: RouteWorkspaceState;
  newWorkspaceId: string;
  newTripId: string;
  ownerId: string;
  ownerName: string;
  nowIso: string;
}): RouteWorkspaceState {
  const { sourceWorkspace, newWorkspaceId, newTripId, ownerId, ownerName, nowIso } = params;
  return {
    ...sourceWorkspace,
    id: newWorkspaceId,
    tripId: newTripId,
    title: `${sourceWorkspace.title} (reprise)`,
    status: 'draft',
    headSeq: 0,
    reviewedSeq: null,
    publishedRevisionId: null,
    publishedRevisionNo: null,
    sourceOrigin: {
      kind: 'activity_replay',
      sourceId: sourceWorkspace.id,
      sourceTitle: sourceWorkspace.title,
      importedAt: nowIso,
      attribution: `Repris depuis ${sourceWorkspace.title}`,
    },
    points: sourceWorkspace.points.map((p) => ({ ...p, workspaceId: newWorkspaceId, entityVersion: 1 })),
    sections: sourceWorkspace.sections.map((s) => ({ ...s, workspaceId: newWorkspaceId, entityVersion: 1 })),
    stages: sourceWorkspace.stages.map((st) => ({ ...st, workspaceId: newWorkspaceId, entityVersion: 1 })),
    variants: [],
    proposals: [],
    comments: [],
    revisions: [],
    packs: [],
    participantPacks: [],
    members: [{ userId: ownerId, displayName: ownerName, role: 'owner' }],
    updatedAt: nowIso,
  };
}
