import type {
  ReconciledPhoneSession,
  WatchDeviceProfile,
  WatchOfflinePackManifest,
  WatchOfflinePackRecord,
  WatchSessionBatchEnvelope,
} from '@/features/watches';
import {
  inspectWatchNativeTargets,
  resolveWatchPlatformCapabilities,
} from '@/features/watches';
import type { WatchApi } from '../api';
import type { WatchStatusResponse } from '../types';

const NOW = 1_700_000_000_000;

export function makeStatus(
  overrides: Partial<WatchStatusResponse> = {},
): WatchStatusResponse {
  const diagnostic = inspectWatchNativeTargets({ nowIso: '2026-11-13T10:00:00.000Z' });
  return {
    status: diagnostic.status,
    diagnostic,
    matrix: [
      {
        platform: 'apple_watch',
        vendor: 'Apple',
        modelsSupported: ['Apple Watch Ultra 2'],
        minOsVersion: '10.0',
        transportChannel: 'watch_connectivity',
        nativeApis: ['WatchConnectivity', 'HealthKit'],
        ficheRefs: ['K6.09', 'K6.10', 'S6.01'],
      },
      {
        platform: 'wear_os',
        vendor: 'Google / Wear OS',
        modelsSupported: ['Pixel Watch 3'],
        minOsVersion: '3.5',
        transportChannel: 'wear_data_layer',
        nativeApis: ['Wear DataLayer'],
        ficheRefs: ['K6.11', 'S6.02'],
      },
      {
        platform: 'galaxy_watch',
        vendor: 'Samsung',
        modelsSupported: ['Galaxy Watch 7'],
        minOsVersion: '4.0',
        transportChannel: 'wear_data_layer',
        nativeApis: ['Wear DataLayer'],
        ficheRefs: ['K6.11', 'S6.02'],
      },
    ],
    ficheIds: ['K6.09', 'K6.10', 'K6.11', 'S6.01', 'S6.02'],
    capabilities: resolveWatchPlatformCapabilities(null, diagnostic),
    devices: [],
    persistence: 'process_memory',
    ...overrides,
  };
}

export function makeDevice(overrides: Partial<WatchDeviceProfile> = {}): WatchDeviceProfile {
  return {
    deviceId: 'watch-1',
    platform: 'apple_watch',
    modelName: 'Apple Watch Ultra 2',
    osVersion: '11.1',
    hasBuiltInGps: true,
    storageAvailableBytes: 64 * 1024 * 1024,
    batteryPercent: 80,
    pairedPhonePlatform: 'ios',
    permissions: {
      locationWhenInUse: 'granted',
      locationAlwaysOrWorkout: 'granted',
      healthWorkoutWrite: 'granted',
      healthMetricsRead: 'indeterminate',
    },
    ...overrides,
  };
}

export function makeSession(
  overrides: Partial<ReconciledPhoneSession> = {},
): ReconciledPhoneSession {
  return {
    clientSessionId: '550e8400-e29b-41d4-a716-446655440000',
    watchSessionId: '550e8400-e29b-41d4-a716-446655440000',
    deviceId: 'watch-1',
    platform: 'apple_watch',
    sport: 'rando',
    routePackId: 'pack-1',
    status: 'finished',
    startedAtUtcMs: NOW,
    endedAtUtcMs: NOW + 3600_000,
    elapsedMs: 3600_000,
    movingMs: 3300_000,
    distanceM: 8420,
    elevGainM: 612,
    elevLossM: 590,
    lastContiguousPointSeq: 42,
    lastEventSeq: 3,
    points: [],
    events: [],
    batchesReceivedCount: 5,
    duplicatePointsIgnored: 0,
    duplicateEventsIgnored: 0,
    summarySaved: true,
    updatedAtUtcMs: NOW + 3600_000,
    ...overrides,
  };
}

export function makeManifest(
  overrides: Partial<WatchOfflinePackManifest> = {},
): WatchOfflinePackManifest {
  return {
    packId: 'pack-1',
    routeId: 'vercors-boucle',
    routeRevision: 3,
    ownerUserId: 'user-1',
    provider: 'OpenStreetMap',
    OfflineLicenseAllowed: true,
    styleVersion: 'lkv-v1',
    bounds: { west: 5.6, south: 45.1, east: 5.9, north: 45.3 },
    minZoom: 8,
    maxZoom: 14,
    totalBytes: 12 * 1024 * 1024,
    checksumSha256: 'checksum-ok',
    resources: [
      {
        resourceId: 'route',
        kind: 'route_geometry',
        requiredForFullMap: true,
        sizeBytes: 1000,
        sha256: 'r',
      },
      {
        resourceId: 'tiles',
        kind: 'vector_tiles',
        requiredForFullMap: true,
        sizeBytes: 1000,
        sha256: 't',
      },
      {
        resourceId: 'style',
        kind: 'style_json',
        requiredForFullMap: true,
        sizeBytes: 1000,
        sha256: 's',
      },
      {
        resourceId: 'glyphs',
        kind: 'glyphs',
        requiredForFullMap: true,
        sizeBytes: 1000,
        sha256: 'g',
      },
    ],
    createdAtUtcMs: NOW,
    ...overrides,
  };
}

export function makePack(
  overrides: Partial<WatchOfflinePackRecord> = {},
): WatchOfflinePackRecord {
  const manifest = overrides.manifest ?? makeManifest();
  return {
    manifest,
    status: 'available',
    capabilities: {
      viewRouteTrace: true,
      viewBaseMap: true,
      followTurnByTurn: true,
      localPlaceSearch: false,
      localRerouting: false,
      liveWeatherAndClosures: false,
    },
    transferredBytes: manifest.totalBytes,
    ackedChunkIndex: manifest.resources.length - 1,
    totalChunks: manifest.resources.length,
    verifiedResourceIds: manifest.resources.map((resource) => resource.resourceId),
    missingResourceIds: [],
    errorReason: null,
    lastVerifiedAtUtcMs: NOW,
    previousValidManifest: null,
    updatedAtUtcMs: NOW,
    ...overrides,
  };
}

export function makeBatch(): WatchSessionBatchEnvelope {
  return {
    batchId: 'batch-1',
    watchSessionId: '550e8400-e29b-41d4-a716-446655440000',
    deviceId: 'watch-1',
    platform: 'apple_watch',
    sport: 'rando',
    routePackId: 'pack-1',
    sourceGeneration: 1,
    fromSeq: 1,
    toSeq: 1,
    points: [
      {
        key: '550e8400-e29b-41d4-a716-446655440000:000000000001',
        watchSessionId: '550e8400-e29b-41d4-a716-446655440000',
        seq: 1,
        recordedAtUtcMs: NOW + 1000,
        monotonicMs: 11_000,
        bootId: 'boot-1',
        lat: 45.18,
        lng: 5.72,
        eleM: 1200,
        accuracyM: 5,
        speedMps: 1.2,
        heartRateBpm: 140,
        drawn: true,
        breakBefore: true,
      },
    ],
    events: [],
    summary: null,
    sentAtUtcMs: NOW + 2000,
  };
}

export function createFakeApi(overrides: Partial<WatchApi> = {}): WatchApi {
  const api: WatchApi = {
    async getStatus() {
      return makeStatus();
    },
    async listDevices() {
      return { devices: [] };
    },
    async registerDevice(profile) {
      return {
        profile,
        capabilities: resolveWatchPlatformCapabilities(
          profile,
          inspectWatchNativeTargets({
            xcodeWatchKitTargetPresent: true,
            runtimeBridgeInjected: true,
          }),
        ),
      };
    },
    async removeDevice(deviceId) {
      return { removed: true, deviceId };
    },
    async listSessions() {
      return { sessions: [makeSession()], total: 1, pending: 0, finished: 1 };
    },
    async ingestBatch() {
      return {
        ack: {
          watchSessionId: '550e8400-e29b-41d4-a716-446655440000',
          ackedThroughSeq: 1,
          ackedEventSeq: 0,
          summaryAcked: false,
          canonicalClientSessionId: '550e8400-e29b-41d4-a716-446655440000',
          ackedAtUtcMs: NOW,
        },
        session: makeSession({ status: 'active', summarySaved: false }),
        replayed: false,
      };
    },
    async listPacks() {
      return { packs: [makePack()], availableStorageBytes: 128 * 1024 * 1024 };
    },
    async stagePack(manifest) {
      return { pack: makePack({ manifest }) };
    },
    async ingestChunk(chunk) {
      return {
        ack: {
          packId: chunk.packId,
          routeRevision: chunk.routeRevision,
          ackedChunkIndex: chunk.chunkIndex,
        },
        pack: makePack(),
      };
    },
    async verifyPack() {
      return { pack: makePack() };
    },
    async removePack(packId) {
      return { removed: true, packId };
    },
    async getLiveSync(sessionId) {
      return {
        sessionId,
        sourceOwner: 'phone',
        sourceGeneration: 1,
        fieldKeys: ['distance_total_m', 'heart_rate_bpm'],
      };
    },
    async buildFrame(input) {
      return {
        frame: {
          frameSeq: 1,
          sessionId: input.sessionId,
          routeId: input.routeId,
          sourceOwner: 'phone',
          sourceGeneration: 1,
          sentAtUtcMs: NOW,
          paused: input.metrics.paused,
          offRoute: input.metrics.offRoute,
          offRouteDistanceM: null,
          nextManeuver: input.nextManeuver ?? null,
          upcomingPois: [],
          customFields: [
            {
              key: 'heart_rate_bpm',
              label: 'FC',
              unit: 'bpm',
              value: input.metrics.heartRateBpm ?? null,
              formatted:
                input.metrics.heartRateBpm == null
                  ? '—'
                  : `${Math.round(input.metrics.heartRateBpm)} bpm`,
              available: input.metrics.heartRateBpm != null,
            },
          ],
        },
      };
    },
    async setLayout(config) {
      return {
        layout: {
          valid: true,
          normalizedPages: config.pages.map((page) => [...page]),
          errors: [],
        },
      };
    },
    async validateLayout(config) {
      return {
        valid: true,
        normalizedPages: config.pages.map((page) => [...page]),
        errors: [],
      };
    },
    async handoff(input) {
      return {
        handoff: {
          sessionId: input.sessionId,
          fromSource: 'phone',
          toSource: input.toSource,
          lastAcceptedSeq: input.lastAcceptedSeq,
          newSourceGeneration: 2,
          handedOffAtUtcMs: NOW,
        },
      };
    },
    async applyFrame(frame) {
      return { accepted: true, frame };
    },
  };
  return { ...api, ...overrides };
}
