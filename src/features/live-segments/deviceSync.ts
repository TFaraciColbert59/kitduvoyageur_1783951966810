import { sanitizeSegmentForLive, selectPreferredGhost } from './privacy';
import type {
  DeviceCapability,
  DeviceLiveDisplaySnapshot,
  DeviceSegmentReference,
  DeviceSyncResult,
  GhostTargetKind,
  LiveSegmentDefinition,
  LiveSegmentSnapshot,
  PrivacyContext,
} from './types';

export interface DeviceLiveSegmentAdapter {
  pushSegments(
    deviceId: string,
    references: readonly DeviceSegmentReference[],
  ): Promise<{ syncedIds: string[]; skippedIds: string[] }>;
}

export function computeSegmentChecksum(
  segment: LiveSegmentDefinition,
  ghostTimeMs: number | null,
): string {
  const raw = `${segment.id}:v${segment.version}:${segment.direction}:${Math.round(segment.totalDistanceM)}:${ghostTimeMs ?? 'none'}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildDeviceSyncReferences(
  segments: readonly LiveSegmentDefinition[],
  privacy: PrivacyContext,
  capability: DeviceCapability,
  preferredGhostKind?: GhostTargetKind,
): { eligible: DeviceSegmentReference[]; skippedIds: string[] } {
  const eligible: DeviceSegmentReference[] = [];
  const skippedIds: string[] = [];

  for (const seg of segments) {
    if (seg.isStarred === false) {
      skippedIds.push(seg.id);
      continue;
    }
    if (!capability.supportedSports.includes(seg.sport)) {
      skippedIds.push(seg.id);
      continue;
    }

    const sanitized = sanitizeSegmentForLive(seg, privacy);
    if (!sanitized) {
      skippedIds.push(seg.id);
      continue;
    }

    if (eligible.length >= capability.maxSyncedSegments) {
      skippedIds.push(seg.id);
      continue;
    }

    const ghost = selectPreferredGhost(sanitized, preferredGhostKind);
    eligible.push({
      segmentId: sanitized.id,
      version: sanitized.version,
      checksum: computeSegmentChecksum(sanitized, ghost?.totalTimeMs ?? null),
      name: sanitized.name,
      sport: sanitized.sport,
      direction: sanitized.direction,
      totalDistanceM: sanitized.totalDistanceM,
      elevationGainM: sanitized.elevationGainM,
      targetGhost: ghost
        ? {
            kind: ghost.kind,
            label: ghost.label,
            totalTimeMs: ghost.totalTimeMs,
          }
        : null,
    });
  }

  return { eligible, skippedIds };
}

export class FavoriteSegmentSyncService {
  private readonly pendingByDevice = new Map<string, DeviceSegmentReference[]>();

  constructor(private readonly adapter: DeviceLiveSegmentAdapter) {}

  getQueuedForDevice(deviceId: string): readonly DeviceSegmentReference[] {
    return this.pendingByDevice.get(deviceId) ?? [];
  }

  async syncFavorites(
    segments: readonly LiveSegmentDefinition[],
    privacy: PrivacyContext,
    capability: DeviceCapability,
    preferredGhostKind?: GhostTargetKind,
  ): Promise<DeviceSyncResult> {
    if (!privacy.optedInLiveSegments) {
      return {
        deviceId: capability.deviceId,
        status: 'privacy_opted_out',
        syncedSegmentIds: [],
        skippedSegmentIds: segments.map((s) => s.id),
        queuedPayloadCount: 0,
        reason: 'P01_OPT_OUT',
      };
    }

    if (!capability.supportsLiveSegments || capability.platform === 'web_unsupported') {
      return {
        deviceId: capability.deviceId,
        status: 'device_incompatible',
        syncedSegmentIds: [],
        skippedSegmentIds: segments.map((s) => s.id),
        queuedPayloadCount: 0,
        reason: 'DEVICE_NOT_CAPABLE',
      };
    }

    if (!capability.hasPermission) {
      return {
        deviceId: capability.deviceId,
        status: 'permission_denied',
        syncedSegmentIds: [],
        skippedSegmentIds: segments.map((s) => s.id),
        queuedPayloadCount: 0,
        reason: 'DEVICE_PERMISSION_DENIED',
      };
    }

    const { eligible, skippedIds } = buildDeviceSyncReferences(
      segments,
      privacy,
      capability,
      preferredGhostKind,
    );

    if (!capability.isOnline) {
      this.pendingByDevice.set(capability.deviceId, eligible);
      return {
        deviceId: capability.deviceId,
        status: 'offline_queued',
        syncedSegmentIds: [],
        skippedSegmentIds: skippedIds,
        queuedPayloadCount: eligible.length,
        reason: 'OFFLINE_QUEUED',
      };
    }

    const pushResult = await this.adapter.pushSegments(capability.deviceId, eligible);
    this.pendingByDevice.delete(capability.deviceId);

    return {
      deviceId: capability.deviceId,
      status: 'synced',
      syncedSegmentIds: pushResult.syncedIds,
      skippedSegmentIds: [...skippedIds, ...pushResult.skippedIds],
      queuedPayloadCount: 0,
    };
  }
}

export function formatDeviceLiveDisplay(
  snapshot: LiveSegmentSnapshot,
): DeviceLiveDisplaySnapshot | null {
  if (!snapshot.isVisible || !snapshot.segmentId || !snapshot.segmentName) {
    return null;
  }

  return {
    segmentId: snapshot.segmentId,
    title: snapshot.segmentName,
    directionLabel: snapshot.matchedDirection === 'reverse' ? 'REV' : 'FWD',
    remainingDistanceM: Math.max(
      0,
      Math.round(snapshot.totalDistanceM - snapshot.distanceCoveredM),
    ),
    elapsedMs: snapshot.elapsedMs,
    deltaMs: snapshot.deltaMs,
    ghostLabel: snapshot.activeGhostLabel,
    signalQuality: snapshot.signalQuality,
  };
}
