import { beforeEach, describe, expect, it } from 'vitest';
import {
  WatchOfflineSessionQueue,
  type WatchOfflinePackChunk,
  type WatchOfflinePackManifest,
  type WatchSessionBatchEnvelope,
} from '@/features/watches';
import {
  applyWatchLiveFrame,
  buildWatchLiveFrame,
  getWatchLiveSyncState,
  getWatchStatus,
  handoffWatchSource,
  ingestWatchPackChunk,
  ingestWatchSessionBatch,
  listWatchPacks,
  listWatchSessions,
  registerWatchDevice,
  resetWatchStore,
  setWatchFieldLayout,
  stageWatchPack,
  verifyWatchPack,
  getUserWatchState,
} from '../index';

const USER = 'user-watch-1';
const NOW = 1_700_000_000_000;

function manifest(overrides: Partial<WatchOfflinePackManifest> = {}): WatchOfflinePackManifest {
  const resources: WatchOfflinePackManifest['resources'] = [
    { resourceId: 'route', kind: 'route_geometry', requiredForFullMap: true, sizeBytes: 100, sha256: 'r' },
    { resourceId: 'maneuvers', kind: 'maneuvers', requiredForFullMap: true, sizeBytes: 100, sha256: 'm' },
    { resourceId: 'style', kind: 'style_json', requiredForFullMap: true, sizeBytes: 100, sha256: 's' },
    { resourceId: 'tiles', kind: 'vector_tiles', requiredForFullMap: true, sizeBytes: 100, sha256: 't' },
    { resourceId: 'glyphs', kind: 'glyphs', requiredForFullMap: true, sizeBytes: 100, sha256: 'g' },
    { resourceId: 'sprites', kind: 'sprites', requiredForFullMap: true, sizeBytes: 100, sha256: 'p' },
    { resourceId: 'pois', kind: 'pois', requiredForFullMap: false, sizeBytes: 100, sha256: 'o' },
  ];
  return {
    packId: 'pack-1',
    routeId: 'route-1',
    routeRevision: 1,
    ownerUserId: USER,
    provider: 'OpenStreetMap',
    OfflineLicenseAllowed: true,
    styleVersion: 'lkv-v1',
    bounds: { west: 5.6, south: 45.1, east: 5.9, north: 45.3 },
    minZoom: 8,
    maxZoom: 14,
    totalBytes: resources.length * 100,
    checksumSha256: 'checksum-ok',
    resources,
    createdAtUtcMs: NOW,
    ...overrides,
  };
}

function chunksFor(
  packManifest: WatchOfflinePackManifest,
  options: { skip?: string[]; totalChunks?: number } = {},
): WatchOfflinePackChunk[] {
  const skipped = new Set(options.skip ?? []);
  const covered = packManifest.resources.filter((resource) => !skipped.has(resource.resourceId));
  const totalChunks = options.totalChunks ?? covered.length;
  return covered.map((resource, index) => ({
    packId: packManifest.packId,
    routeRevision: packManifest.routeRevision,
    chunkIndex: index,
    totalChunks,
    byteLength: resource.sizeBytes,
    resourceIdsCovered: [resource.resourceId],
    chunkChecksum: `chunk-${index}`,
  }));
}

function makeSessionBatches(pointCount: number): WatchSessionBatchEnvelope[] {
  const queue = new WatchOfflineSessionQueue();
  const started = queue.startOrResumeSession({
    watchSessionId: '550e8400-e29b-41d4-a716-446655440000',
    deviceId: 'watch-1',
    platform: 'apple_watch',
    sport: 'rando',
    routePackId: 'pack-1',
    startedAtUtcMs: NOW,
    monotonicMs: 10_000,
    bootId: 'boot-1',
  });
  for (let index = 0; index < pointCount; index += 1) {
    queue.appendPoint(started.session.watchSessionId, {
      recordedAtUtcMs: NOW + (index + 1) * 1000,
      monotonicMs: 10_000 + (index + 1) * 1000,
      bootId: 'boot-1',
      lat: 45.18 + index * 0.001,
      lng: 5.72 + index * 0.001,
      eleM: 1200 + index * 10,
      heartRateBpm: 140,
    });
  }
  queue.finishSession(
    started.session.watchSessionId,
    NOW + (pointCount + 1) * 1000,
    10_000 + (pointCount + 1) * 1000,
    'boot-1',
  );
  return queue.buildPendingBatches(started.session.watchSessionId, {
    maxPointsPerBatch: 2,
    nowUtcMs: NOW + 99_000,
  });
}

beforeEach(() => {
  resetWatchStore();
});

describe('D03 — service serveur montres', () => {
  it('reste fail-closed sans cible native et expose la matrice', () => {
    const status = getWatchStatus(USER, { nowIso: '2026-11-13T10:00:00.000Z' });
    expect(status.status).toBe('native_target_unavailable');
    expect(status.matrix).toHaveLength(3);
    expect(status.ficheIds).toEqual(['K6.09', 'K6.10', 'K6.11', 'S6.01', 'S6.02']);
    expect(new Set(Object.values(status.capabilities))).toEqual(
      new Set(['native_target_unavailable']),
    );
    expect(status.persistence).toBe('process_memory');
  });

  it('résout les capacités d’une montre déclarée quand le pont natif est présent', () => {
    registerWatchDevice(USER, {
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
    });

    const status = getWatchStatus(USER, {
      deviceId: 'watch-1',
      xcodeWatchKitTargetPresent: true,
      runtimeBridgeInjected: true,
    });
    expect(status.status).toBe('available');
    expect(status.capabilities.autonomous_gps_recording).toBe('available');
    expect(status.capabilities.heart_rate_sensor).toBe('indeterminate');
    expect(status.devices).toHaveLength(1);
  });

  it('ingère les lots de façon idempotente et ne crée qu’une séance canonique', () => {
    const [first, second] = makeSessionBatches(4);
    expect(first.summary).toBeNull();
    expect(second.summary).not.toBeNull();

    const outOfOrder = ingestWatchSessionBatch(USER, second, NOW + 100_000);
    expect(outOfOrder.ack.ackedThroughSeq).toBe(0);
    expect(outOfOrder.session.status).toBe('finished');

    const firstResult = ingestWatchSessionBatch(USER, first, NOW + 101_000);
    expect(firstResult.ack.ackedThroughSeq).toBe(4);
    expect(firstResult.session.points).toHaveLength(4);

    const full = ingestWatchSessionBatch(USER, second, NOW + 102_000);
    expect(full.session.points).toHaveLength(4);
    expect(full.session.status).toBe('finished');
    expect(full.session.summarySaved).toBe(true);

    const replay = ingestWatchSessionBatch(USER, second, NOW + 103_000);
    expect(replay.replayed).toBe(true);
    expect(replay.session.duplicatePointsIgnored).toBe(full.session.duplicatePointsIgnored);

    const duplicateWithNewBatchId = ingestWatchSessionBatch(
      USER,
      { ...second, batchId: `${second.batchId}:retry` },
      NOW + 104_000,
    );
    expect(duplicateWithNewBatchId.replayed).toBe(false);
    expect(duplicateWithNewBatchId.session.points).toHaveLength(4);
    expect(duplicateWithNewBatchId.session.duplicatePointsIgnored).toBe(2);

    const listed = listWatchSessions(USER);
    expect(listed.total).toBe(1);
    expect(listed.finished).toBe(1);
  });

  it('refuse un lot dont les points sortent de la plage annoncée', () => {
    const [first] = makeSessionBatches(2);
    expect(() =>
      ingestWatchSessionBatch(USER, { ...first, fromSeq: 10, toSeq: 20 }, NOW),
    ).toThrow(/sort de la plage/i);
  });

  it('transfère un paquet par blocs, vérifie le checksum et le rend disponible', () => {
    const packManifest = manifest();
    const staged = stageWatchPack(USER, packManifest, 7, NOW);
    expect(staged.status).toBe('queued');
    expect(staged.capabilities.viewBaseMap).toBe(false);

    for (const chunk of chunksFor(packManifest)) {
      const result = ingestWatchPackChunk(USER, chunk, NOW + chunk.chunkIndex);
      expect(result.ack.ackedChunkIndex).toBe(chunk.chunkIndex);
    }

    const verified = verifyWatchPack(USER, packManifest.packId, 'checksum-ok', NOW + 10);
    expect(verified.status).toBe('available');
    expect(verified.capabilities.viewRouteTrace).toBe(true);
    expect(verified.capabilities.viewBaseMap).toBe(true);
    expect(verified.capabilities.followTurnByTurn).toBe(true);
    expect(verified.capabilities.localPlaceSearch).toBe(false);
    expect(verified.capabilities.localRerouting).toBe(false);

    const listed = listWatchPacks(USER);
    expect(listed.packs).toHaveLength(1);
    expect(listed.availableStorageBytes).toBeGreaterThan(0);
  });

  it('passe un paquet en degraded si la trace est là mais que les glyphes manquent', () => {
    const packManifest = manifest();
    stageWatchPack(USER, packManifest, 6, NOW);
    for (const chunk of chunksFor(packManifest, { skip: ['glyphs'], totalChunks: 6 })) {
      ingestWatchPackChunk(USER, chunk, NOW + chunk.chunkIndex);
    }
    const verified = verifyWatchPack(USER, packManifest.packId, 'checksum-ok', NOW + 10);
    expect(verified.status).toBe('degraded');
    expect(verified.capabilities.viewRouteTrace).toBe(true);
    expect(verified.capabilities.viewBaseMap).toBe(false);
    expect(verified.missingResourceIds).toContain('glyphs');
    expect(verified.errorReason).toBe('missing_required_resource');
  });

  it('conserve la révision précédente quand l’espace manque pour la nouvelle', () => {
    const firstManifest = manifest();
    stageWatchPack(USER, firstManifest, 7, NOW);
    for (const chunk of chunksFor(firstManifest)) {
      ingestWatchPackChunk(USER, chunk, NOW + chunk.chunkIndex);
    }
    expect(verifyWatchPack(USER, firstManifest.packId, 'checksum-ok', NOW + 10).status).toBe(
      'available',
    );

    getUserWatchState(USER).packs.setAvailableStorageBytes(10);
    const replacement = manifest({
      routeRevision: 2,
      checksumSha256: 'checksum-v2',
      createdAtUtcMs: NOW + 20,
    });
    const preserved = stageWatchPack(USER, replacement, 7, NOW + 20);
    expect(preserved.status).toBe('available');
    expect(preserved.manifest.routeRevision).toBe(1);
    expect(preserved.errorReason).toBe('insufficient_storage');
    expect(preserved.previousValidManifest?.routeRevision).toBe(1);
  });

  it('rejette un bloc d’une autre révision de paquet', () => {
    const packManifest = manifest();
    stageWatchPack(USER, packManifest, 7, NOW);
    const [chunk] = chunksFor(packManifest);
    expect(() =>
      ingestWatchPackChunk(USER, { ...chunk, routeRevision: 99 }, NOW),
    ).toThrow(/révision/i);
  });

  it('construit une trame Live Sync sans inventer les capteurs absents et rejette l’obsolète', () => {
    setWatchFieldLayout(USER, {
      sport: 'rando',
      maxSlotsPerPage: 4,
      pages: [
        ['distance_total_m', 'heart_rate_bpm', 'current_speed_mps', 'battery_percent'],
      ],
    });
    const firstFrame = buildWatchLiveFrame(USER, {
      sessionId: 'session-1',
      routeId: 'route-1',
      metrics: {
        distanceM: 1200,
        elevGainM: 250,
        movingS: 600,
        elapsedS: 720,
        heartRateBpm: null,
        currentSpeedMps: null,
        batteryPercent: null,
        offRoute: false,
        paused: false,
      },
      nowUtcMs: NOW,
    });

    expect(firstFrame.frameSeq).toBe(1);
    const heartRate = firstFrame.customFields.find((field) => field.key === 'heart_rate_bpm');
    expect(heartRate).toMatchObject({ available: false, value: null, formatted: '—' });
    const speed = firstFrame.customFields.find((field) => field.key === 'current_speed_mps');
    expect(speed).toMatchObject({ available: false, value: null, formatted: '—' });
    const distance = firstFrame.customFields.find((field) => field.key === 'distance_total_m');
    expect(distance).toMatchObject({ available: true, value: 1200 });

    const secondFrame = buildWatchLiveFrame(USER, {
      sessionId: 'session-1',
      routeId: 'route-1',
      metrics: {
        distanceM: 1300,
        elevGainM: 260,
        movingS: 660,
        elapsedS: 780,
        heartRateBpm: 142,
        currentSpeedMps: 2.5,
        batteryPercent: 66,
        offRoute: false,
        paused: false,
      },
      nowUtcMs: NOW + 1000,
    });
    expect(secondFrame.frameSeq).toBe(2);
    expect(
      secondFrame.customFields.find((field) => field.key === 'heart_rate_bpm'),
    ).toMatchObject({ available: true, value: 142, formatted: '142 bpm' });

    const applied = applyWatchLiveFrame(USER, secondFrame);
    expect(applied.accepted).toBe(true);
    const stale = applyWatchLiveFrame(USER, firstFrame);
    expect(stale.accepted).toBe(false);
    expect(stale.currentFrame.frameSeq).toBe(2);

    const handoff = handoffWatchSource(USER, 'session-1', 'watch', 42, NOW + 2000);
    expect(handoff).toMatchObject({
      fromSource: 'phone',
      toSource: 'watch',
      lastAcceptedSeq: 42,
      newSourceGeneration: 2,
    });
    expect(getWatchLiveSyncState(USER, 'session-1')).toMatchObject({
      sourceOwner: 'watch',
      sourceGeneration: 2,
    });
  });

  it('applique et normalise une disposition de champs bornée', () => {
    const accepted = setWatchFieldLayout(USER, {
      sport: 'rando',
      maxSlotsPerPage: 2,
      pages: [
        ['distance_total_m', 'heart_rate_bpm', 'battery_percent'],
        ['elevation_gain_m'],
      ],
    });
    expect(accepted.valid).toBe(false);
    expect(accepted.normalizedPages[0]).toEqual(['distance_total_m', 'heart_rate_bpm']);

    const rejectedLayout = setWatchFieldLayout(USER, {
      sport: 'rando',
      maxSlotsPerPage: 2,
      pages: [[]],
    });
    expect(rejectedLayout.valid).toBe(false);
    expect(rejectedLayout.errors.join(' ')).toMatch(/vide/i);
  });
});
