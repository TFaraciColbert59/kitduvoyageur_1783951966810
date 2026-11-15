import { describe, expect, it, vi } from 'vitest';
import {
  buildDeviceSyncReferences,
  computeLiveDelta,
  FavoriteSegmentSyncService,
  formatDeviceLiveDisplay,
  interpolateGhostDistanceAtTime,
  interpolateGhostElapsedMs,
  LiveSegmentEngine,
  sanitizeSegmentForLive,
  type DeviceCapability,
  type GeoPoint,
  type GhostProfile,
  type LiveSegmentDefinition,
  type PrivacyContext,
} from '../index';

// ~111.32m per 0.001 deg of latitude at equator/mid-lat; we build an exact 1000m northbound trace
// at lon = 2.0, lat from 48.000000 to ~48.008993 (step ~250m)
const METERS_PER_DEG_LAT = 111_194.9266;
function latAtNorthMeters(meters: number): number {
  return 48.0 + meters / METERS_PER_DEG_LAT;
}

function makePoint(
  northMeters: number,
  eastMeters: number,
  tSec: number,
  opts: Partial<GeoPoint> = {},
): GeoPoint {
  const cosLat = Math.cos((48.0 * Math.PI) / 180);
  const lat = 48.0 + northMeters / METERS_PER_DEG_LAT;
  const lon = 2.0 + eastMeters / (METERS_PER_DEG_LAT * cosLat);
  const ts = 1_700_000_000_000 + tSec * 1000;
  return {
    lat,
    lon,
    accuracyM: 5,
    timestampMs: ts,
    monotonicMs: tSec * 1000,
    ...opts,
  };
}

const DEFAULT_PRIVACY: PrivacyContext = {
  viewerId: 'user-1',
  optedInLiveSegments: true,
  blockedUserIds: new Set(['blocked-user']),
  allowedPeerIds: new Set(['friend-1']),
};

function makeSegment(overrides: Partial<LiveSegmentDefinition> = {}): LiveSegmentDefinition {
  const prGhost: GhostProfile = {
    kind: 'pr',
    label: 'Mon PR',
    totalTimeMs: 200_000, // 200s -> 5 m/s
    checkpoints: [
      { distanceM: 0, elapsedMs: 0 },
      { distanceM: 500, elapsedMs: 100_000 },
      { distanceM: 1000, elapsedMs: 200_000 },
    ],
    ownerId: 'user-1',
    isPublic: false,
    isOptedIn: true,
  };

  const komGhost: GhostProfile = {
    kind: 'kom',
    label: 'KOM (Alex)',
    totalTimeMs: 180_000, // 180s
    checkpoints: [
      { distanceM: 0, elapsedMs: 0 },
      { distanceM: 500, elapsedMs: 90_000 },
      { distanceM: 1000, elapsedMs: 180_000 },
    ],
    ownerId: 'kom-holder',
    isPublic: true,
    isOptedIn: true,
  };

  return {
    id: 'seg-col-1',
    version: 3,
    name: 'Côte du Nord',
    sport: 'cycling',
    direction: 'forward',
    points: [
      { lat: latAtNorthMeters(0), lon: 2.0, cumulativeDistanceM: 0 },
      { lat: latAtNorthMeters(250), lon: 2.0, cumulativeDistanceM: 250 },
      { lat: latAtNorthMeters(500), lon: 2.0, cumulativeDistanceM: 500 },
      { lat: latAtNorthMeters(750), lon: 2.0, cumulativeDistanceM: 750 },
      { lat: latAtNorthMeters(1000), lon: 2.0, cumulativeDistanceM: 1000 },
    ],
    totalDistanceM: 1000,
    elevationGainM: 45,
    isPrivate: false,
    ownerId: 'creator-1',
    isStarred: true,
    ghostProfiles: [prGhost, komGhost],
    ...overrides,
  };
}

describe('Live Segments S4.09 & S4.10', () => {
  it('interpolates ghost time and distance deterministically', () => {
    const ghost: GhostProfile = {
      kind: 'pr',
      label: 'PR',
      totalTimeMs: 200_000,
      checkpoints: [
        { distanceM: 0, elapsedMs: 0 },
        { distanceM: 500, elapsedMs: 90_000 },
        { distanceM: 1000, elapsedMs: 200_000 },
      ],
      isPublic: true,
      isOptedIn: true,
    };

    expect(interpolateGhostElapsedMs(ghost, 250)).toBe(45_000);
    expect(interpolateGhostElapsedMs(ghost, 750)).toBe(145_000);
    expect(interpolateGhostElapsedMs(ghost, -10)).toBe(0);
    expect(interpolateGhostElapsedMs(ghost, 1200)).toBe(200_000);

    expect(interpolateGhostDistanceAtTime(ghost, 45_000)).toBe(250);

    // Athlete at 500m in 80s (10s ahead of 90s ghost)
    const ahead = computeLiveDelta(80_000, 500, ghost, 1000);
    expect(ahead.deltaMs).toBe(-10_000);
    expect(ahead.deltaDistanceM).toBeGreaterThan(50);
    expect(ahead.projectedFinishMs).toBeLessThan(200_000);

    // Athlete at 500m in 105s (15s behind 90s ghost)
    const behind = computeLiveDelta(105_000, 500, ghost, 1000);
    expect(behind.deltaMs).toBe(15_000);
    expect(behind.deltaDistanceM).toBeLessThan(0);
  });

  it('runs full S4.09 lifecycle: approach -> start -> live delta -> finish -> withdrawal', () => {
    const seg = makeSegment();
    const engine = new LiveSegmentEngine(DEFAULT_PRIVACY, [seg]);

    // Approach at -100m
    const snap1 = engine.ingestPoint(makePoint(-100, 0, 0));
    expect(snap1.state).toBe('approaching');
    expect(snap1.isVisible).toBe(true);
    expect(snap1.alerts.map((a) => a.type)).toEqual(['approach']);

    // Start gate at 0m, t=10s
    const snap2 = engine.ingestPoint(makePoint(0, 0, 10));
    expect(snap2.state).toBe('active');
    expect(snap2.isLiveEstimate).toBe(true);
    expect(snap2.alerts.map((a) => a.type)).toEqual(['start']);

    // Intermediate points (<= 15s gap)
    engine.ingestPoint(makePoint(100, 0, 20));
    engine.ingestPoint(makePoint(200, 0, 35));
    engine.ingestPoint(makePoint(300, 0, 50));
    engine.ingestPoint(makePoint(400, 0, 65));
    engine.ingestPoint(makePoint(450, 0, 80));

    // Midpoint at 500m, t=95s (elapsed 85s vs 100s PR -> -15s ahead!)
    const snap3 = engine.ingestPoint(makePoint(500, 0, 95));
    expect(snap3.state).toBe('active');
    expect(snap3.elapsedMs).toBe(85_000);
    expect(snap3.deltaMs).toBe(-15_000);
    expect(snap3.activeGhostKind).toBe('pr');

    // Intermediate points to finish (<= 15s gap)
    engine.ingestPoint(makePoint(600, 0, 110));
    engine.ingestPoint(makePoint(700, 0, 125));
    engine.ingestPoint(makePoint(800, 0, 140));
    engine.ingestPoint(makePoint(900, 0, 155));
    engine.ingestPoint(makePoint(950, 0, 165));

    // Finish gate at 1000m, t=175s (elapsed 165s -> beats both 200s PR and 180s KOM)
    const snap4 = engine.ingestPoint(makePoint(1000, 0, 175));
    expect(snap4.state).toBe('completed');
    expect(snap4.isLiveEstimate).toBe(false);
    expect(snap4.alerts.map((a) => a.type)).toEqual(['finish']);
    expect(snap4.finalResult).not.toBeNull();
    expect(snap4.finalResult?.isValidForLeaderboard).toBe(true);
    expect(snap4.finalResult?.beatPr).toBe(true);
    expect(snap4.finalResult?.beatKom).toBe(true);

    // Withdraw banner upon resolution
    const cleared = engine.acknowledgeResolution();
    expect(cleared.state).toBe('idle');
    expect(cleared.isVisible).toBe(false);
  });

  it('enforces GPS hysteresis for approach exit and off-route / rejoin / abort', () => {
    const seg = makeSegment();
    const engine = new LiveSegmentEngine(DEFAULT_PRIVACY, [seg]);

    // Enter approach at 130m south of start
    expect(engine.ingestPoint(makePoint(-130, 0, 0)).state).toBe('approaching');
    // Move to 190m south: still approaching because exit hysteresis is 220m
    expect(engine.ingestPoint(makePoint(-190, 0, 5)).state).toBe('approaching');
    // Move to 235m south: exits to idle and hides banner
    const exited = engine.ingestPoint(makePoint(-235, 0, 10));
    expect(exited.state).toBe('idle');
    expect(exited.isVisible).toBe(false);

    // Now start segment properly
    engine.ingestPoint(makePoint(-50, 0, 20));
    expect(engine.ingestPoint(makePoint(0, 0, 25)).state).toBe('active');
    expect(engine.ingestPoint(makePoint(200, 0, 45)).state).toBe('active');

    // 2 off-route samples (45m east > 35m threshold): grace=3 keeps state active
    expect(engine.ingestPoint(makePoint(220, 45, 50)).state).toBe('active');
    expect(engine.ingestPoint(makePoint(240, 45, 55)).state).toBe('active');

    // 3rd off-route sample transitions to off_route
    const offRoute = engine.ingestPoint(makePoint(260, 45, 60));
    expect(offRoute.state).toBe('off_route');
    expect(offRoute.alerts.some((a) => a.type === 'off_route')).toBe(true);

    // Move to 28m east (inside 35m, outside 22m rejoin hysteresis): stays off_route
    expect(engine.ingestPoint(makePoint(280, 28, 65)).state).toBe('off_route');

    // Move to 15m east (<= 22m rejoin threshold): rejoins active
    const rejoined = engine.ingestPoint(makePoint(300, 15, 70));
    expect(rejoined.state).toBe('active');
    expect(rejoined.alerts.some((a) => a.type === 'rejoined')).toBe(true);

    // 6 consecutive off-route samples abort the attempt
    let lastSnap = rejoined;
    for (let i = 1; i <= 6; i++) {
      lastSnap = engine.ingestPoint(makePoint(300 + i * 20, 50, 70 + i * 5));
    }
    expect(lastSnap.state).toBe('aborted');
    expect(lastSnap.alerts.some((a) => a.type === 'aborted')).toBe(true);
  });

  it('respects segment direction and supports bidirectional reverse runs', () => {
    const forwardOnly = makeSegment({ direction: 'forward' });
    const engineFwd = new LiveSegmentEngine(DEFAULT_PRIVACY, [forwardOnly]);

    // Approach from north (finish) heading south -> must NOT trigger forward-only segment
    engineFwd.ingestPoint(makePoint(1100, 0, 0));
    const snapWrongDir = engineFwd.ingestPoint(makePoint(980, 0, 10));
    expect(snapWrongDir.state).toBe('idle');

    // Bidirectional segment approached from north heading south -> triggers reverse
    const bidir = makeSegment({ direction: 'bidirectional' });
    const engineBidir = new LiveSegmentEngine(DEFAULT_PRIVACY, [bidir]);
    engineBidir.ingestPoint(makePoint(1100, 0, 0));
    const snapRevApproach = engineBidir.ingestPoint(makePoint(1000, 0, 10));
    expect(snapRevApproach.state).toBe('active');
    expect(snapRevApproach.matchedDirection).toBe('reverse');
  });

  it('prevents false KOM on GPS loss, degraded accuracy, teleportation, and pause', () => {
    const seg = makeSegment();
    const engine = new LiveSegmentEngine(DEFAULT_PRIVACY, [seg]);

    // Degraded accuracy at start gate must not start (stays in approaching)
    engine.ingestPoint(makePoint(-50, 0, 0));
    expect(engine.ingestPoint(makePoint(0, 0, 5, { accuracyM: 55 })).state).toBe('approaching');

    // Valid start
    expect(engine.ingestPoint(makePoint(0, 0, 10)).state).toBe('active');
    engine.ingestPoint(makePoint(250, 0, 50));

    // GPS gap of 25s (> 15s maxGpsGapMs) with modest distance -> gps_lost then gps_restored
    const lostAndRestored = engine.ingestPoint(makePoint(350, 0, 75));
    expect(lostAndRestored.state).toBe('active');
    expect(lostAndRestored.alerts.map((a) => a.type)).toEqual(['gps_lost', 'gps_restored']);

    engine.ingestPoint(makePoint(500, 0, 90));
    engine.ingestPoint(makePoint(650, 0, 105));
    engine.ingestPoint(makePoint(800, 0, 120));
    engine.ingestPoint(makePoint(920, 0, 130));
    // Finish faster than KOM (130s < 180s), but must be invalidated!
    const finished = engine.ingestPoint(makePoint(1000, 0, 140));
    expect(finished.state).toBe('completed');
    expect(finished.finalResult?.isValidForLeaderboard).toBe(false);
    expect(finished.finalResult?.invalidationReason).toBe('gps_lost_during_effort');
    expect(finished.finalResult?.beatKom).toBe(false);
    expect(finished.finalResult?.beatPr).toBe(false);

    // Pause test: monotonic clock excludes paused duration, but invalidates leaderboard
    const enginePause = new LiveSegmentEngine(DEFAULT_PRIVACY, [seg]);
    enginePause.ingestPoint(makePoint(0, 0, 0));
    enginePause.ingestPoint(makePoint(150, 0, 15));
    enginePause.ingestPoint(makePoint(300, 0, 30));
    enginePause.ingestPoint(makePoint(450, 0, 45));
    enginePause.ingestPoint(makePoint(500, 0, 50));
    enginePause.pause(50_000);
    enginePause.resume(110_000); // 60s pause
    enginePause.ingestPoint(makePoint(550, 0, 120));
    enginePause.ingestPoint(makePoint(650, 0, 135));
    enginePause.ingestPoint(makePoint(750, 0, 150));
    enginePause.ingestPoint(makePoint(880, 0, 165));
    const pausedFinish = enginePause.ingestPoint(makePoint(1000, 0, 180));
    expect(pausedFinish.finalResult?.elapsedMs).toBe(120_000); // 180s - 60s pause
    expect(pausedFinish.finalResult?.isValidForLeaderboard).toBe(false);
    expect(pausedFinish.finalResult?.invalidationReason).toBe('paused_during_effort');
  });

  it('queues final efforts offline without duplication', () => {
    const seg = makeSegment();
    const engine = new LiveSegmentEngine(DEFAULT_PRIVACY, [seg], { isOnline: false });

    engine.ingestPoint(makePoint(0, 0, 0));
    engine.ingestPoint(makePoint(300, 0, 60));
    engine.ingestPoint(makePoint(650, 0, 130));
    const snap = engine.ingestPoint(makePoint(1000, 0, 195));

    expect(snap.finalResult?.queuedForSync).toBe(true);
    expect(engine.offlineQueue.size()).toBe(1);
    const flushed = engine.offlineQueue.flush();
    expect(flushed).toHaveLength(1);
    expect(engine.offlineQueue.size()).toBe(0);
  });

  it('enforces P01 and S6.19 privacy fail-closed', () => {
    const privateOther = makeSegment({ id: 'priv', isPrivate: true, ownerId: 'stranger' });
    const blockedSeg = makeSegment({ id: 'blk', ownerId: 'blocked-user' });
    const segWithGhosts = makeSegment({
      ghostProfiles: [
        {
          kind: 'kom',
          label: 'KOM OptedOut',
          totalTimeMs: 150_000,
          checkpoints: [
            { distanceM: 0, elapsedMs: 0 },
            { distanceM: 1000, elapsedMs: 150_000 },
          ],
          ownerId: 'other',
          isPublic: true,
          isOptedIn: false,
        },
        {
          kind: 'friend',
          label: 'Allowed Friend',
          totalTimeMs: 190_000,
          checkpoints: [
            { distanceM: 0, elapsedMs: 0 },
            { distanceM: 1000, elapsedMs: 190_000 },
          ],
          ownerId: 'friend-1',
          isPublic: false,
          isOptedIn: true,
        },
        {
          kind: 'friend',
          label: 'Blocked Friend',
          totalTimeMs: 170_000,
          checkpoints: [
            { distanceM: 0, elapsedMs: 0 },
            { distanceM: 1000, elapsedMs: 170_000 },
          ],
          ownerId: 'blocked-user',
          isPublic: true,
          isOptedIn: true,
        },
      ],
    });

    expect(sanitizeSegmentForLive(privateOther, DEFAULT_PRIVACY)).toBeNull();
    expect(sanitizeSegmentForLive(blockedSeg, DEFAULT_PRIVACY)).toBeNull();

    const sanitized = sanitizeSegmentForLive(segWithGhosts, DEFAULT_PRIVACY);
    expect(sanitized?.ghostProfiles).toHaveLength(1);
    expect(sanitized?.ghostProfiles[0].label).toBe('Allowed Friend');

    // Opted-out viewer gets nothing
    const optedOut: PrivacyContext = { ...DEFAULT_PRIVACY, optedInLiveSegments: false };
    expect(sanitizeSegmentForLive(segWithGhosts, optedOut)).toBeNull();
  });

  it('handles S4.10 device favorite sync, capability checks, offline queue, and watch display', async () => {
    const seg = makeSegment();
    const pushMock = vi.fn(async (_id, refs) => ({
      syncedIds: refs.map((r: { segmentId: string }) => r.segmentId),
      skippedIds: [],
    }));
    const service = new FavoriteSegmentSyncService({ pushSegments: pushMock });

    const webCap: DeviceCapability = {
      deviceId: 'web',
      deviceName: 'Browser',
      platform: 'web_unsupported',
      supportsLiveSegments: false,
      maxSyncedSegments: 0,
      supportedSports: [],
      hasPermission: false,
      isOnline: true,
    };
    const webRes = await service.syncFavorites([seg], DEFAULT_PRIVACY, webCap);
    expect(webRes.status).toBe('device_incompatible');

    const garminNoPerm: DeviceCapability = {
      deviceId: 'garmin-1',
      deviceName: 'Edge 840',
      platform: 'garmin_connect',
      supportsLiveSegments: true,
      maxSyncedSegments: 50,
      supportedSports: ['cycling'],
      hasPermission: false,
      isOnline: true,
    };
    expect((await service.syncFavorites([seg], DEFAULT_PRIVACY, garminNoPerm)).status).toBe(
      'permission_denied',
    );

    const garminOffline: DeviceCapability = {
      ...garminNoPerm,
      hasPermission: true,
      isOnline: false,
    };
    const offlineRes = await service.syncFavorites([seg], DEFAULT_PRIVACY, garminOffline);
    expect(offlineRes.status).toBe('offline_queued');
    expect(offlineRes.queuedPayloadCount).toBe(1);
    expect(service.getQueuedForDevice('garmin-1')).toHaveLength(1);

    const garminOnline: DeviceCapability = { ...garminOffline, isOnline: true };
    const onlineRes = await service.syncFavorites([seg], DEFAULT_PRIVACY, garminOnline);
    expect(onlineRes.status).toBe('synced');
    expect(onlineRes.syncedSegmentIds).toEqual(['seg-col-1']);
    expect(pushMock).toHaveBeenCalledTimes(1);

    const { eligible } = buildDeviceSyncReferences([seg], DEFAULT_PRIVACY, garminOnline);
    expect(eligible[0].checksum).toMatch(/^[0-9a-f]{8}$/);

    // Watch display formatting
    const engine = new LiveSegmentEngine(DEFAULT_PRIVACY, [seg]);
    const snap = engine.ingestPoint(makePoint(0, 0, 10));
    const display = formatDeviceLiveDisplay(snap);
    expect(display).not.toBeNull();
    expect(display?.directionLabel).toBe('FWD');
    expect(display?.remainingDistanceM).toBe(1000);
  });
});
