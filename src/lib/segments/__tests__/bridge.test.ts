import { beforeEach, describe, expect, it } from 'vitest';
import { createSegmentFromActivity, detectActivitySegmentEfforts } from '@/features/segments';
import {
  getLeaderboardSegment,
  listLeaderboardEfforts,
  resetLeaderboardsStore,
} from '@/lib/leaderboards/store';
import { listLiveSegments } from '@/lib/live-segments/server/catalog';
import {
  resetSegmentsStore,
  upsertEfforts,
  upsertSegment,
} from '@/lib/segments/store';
import { listS01LiveDefinitions, syncS01ToLeaderboards } from '../bridge';

function buildStraightTrace(userId: string, activityId: string, startLat = 45.5, count = 8) {
  const baseMs = Date.parse('2026-10-10T09:00:00Z');
  const points = Array.from({ length: count }, (_, idx) => ({
    lat: startLat + idx * 0.001,
    lng: 6.0,
    ele: 500 + idx * 10,
    timestamp: new Date(baseMs + idx * 15_000).toISOString(),
  }));
  return {
    activityId,
    activityVersion: 1,
    userId,
    sport: 'cycling' as const,
    points,
    visibility: 'public' as const,
  };
}

describe('S01 -> S02 -> S03 bridge & P01 visibility exclusion', () => {
  beforeEach(() => {
    resetSegmentsStore();
    resetLeaderboardsStore();
  });

  it('synchronise un segment public S01 et ses efforts vers S02 et S03, puis exclut dès passage privé/dangereux', () => {
    const trace = buildStraightTrace('athlete-1', 'act-1');
    const created = createSegmentFromActivity({
      segmentId: 'seg-bridge-1',
      name: 'Montée test bridge',
      activity: trace,
      startPointIndex: 0,
      endPointIndex: 7,
      visibility: 'public',
      sport: 'cycling',
    });
    expect(created.ok).toBe(true);
    const segment = created.segment!;
    upsertSegment(segment);

    const detected = detectActivitySegmentEfforts(trace, [segment]);
    upsertEfforts(detected.allDetected);
    syncS01ToLeaderboards(segment.id);

    // S02 store contient le segment et l'effort
    const lbSeg = getLeaderboardSegment(segment.id);
    expect(lbSeg).not.toBeNull();
    expect(lbSeg?.isHazardous).toBe(false);
    expect(listLeaderboardEfforts(segment.id).length).toBeGreaterThanOrEqual(1);

    // S03 live catalog expose le segment S01
    expect(listS01LiveDefinitions().some((d) => d.id === segment.id)).toBe(true);
    expect(
      listLiveSegments({ lat: 45.5, lon: 6.0, radiusM: 5000 }).items.some(
        (item) => item.id === segment.id
      )
    ).toBe(true);

    // Passage en dangereux -> marqué hazardous en S02 et retiré de S03
    upsertSegment({ ...segment, hazardous: true });
    syncS01ToLeaderboards(segment.id);
    expect(getLeaderboardSegment(segment.id)?.isHazardous).toBe(true);
    expect(listS01LiveDefinitions().some((d) => d.id === segment.id)).toBe(false);

    // Passage en privé -> supprimé de S02 et S03 immédiatement (C-PRIV)
    upsertSegment({ ...segment, hazardous: false, visibility: 'private' });
    syncS01ToLeaderboards(segment.id);
    expect(getLeaderboardSegment(segment.id)).toBeNull();
    expect(listLeaderboardEfforts(segment.id)).toEqual([]);
  });
});
