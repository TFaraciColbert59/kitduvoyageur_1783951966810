import { describe, expect, it } from 'vitest';
import {
  LIVE_PIN_LIMITS,
  selectCleanLivePins,
  upsertSafetyReportPin,
  upsertSessionWaypoint,
  type TimestampedSafetyPin,
} from '../livePinRules';
import type { MapPin } from '../MapStage';

describe('Live 3D Beacon & Safety Report anti-clutter rules', () => {
  it('merges safety reports dropped within 35m instead of stacking duplicates', () => {
    const now = 1_700_000_000_000;
    const first: TimestampedSafetyPin = {
      id: 'rep-1',
      kind: 'safety_report',
      name: 'Obstacle',
      lat: 45.8326,
      lon: 6.8652,
      tone: 'bad',
      createdAtMs: now,
    };
    const res1 = upsertSafetyReportPin([], first, now);
    expect(res1.merged).toBe(false);
    expect(res1.next).toHaveLength(1);

    // 10m away -> should merge into rep-1
    const second: TimestampedSafetyPin = {
      id: 'rep-2',
      kind: 'safety_report',
      name: 'Éboulement',
      lat: 45.83268,
      lon: 6.86522,
      tone: 'bad',
      createdAtMs: now + 5000,
    };
    const res2 = upsertSafetyReportPin(res1.next, second, now + 5000);
    expect(res2.merged).toBe(true);
    expect(res2.next).toHaveLength(1);
    expect(res2.next[0].id).toBe('rep-1');
    expect(res2.next[0].name).toBe('Éboulement');
  });

  it('throttles accidental rapid double-tap waypoints and merges within 25m', () => {
    const t0 = 1_700_000_000_000;
    const first = upsertSessionWaypoint(
      [],
      { id: 'wp-1', kind: 'water', label: 'Eau', lat: 45.8, lng: 6.8 },
      t0,
    );
    expect(first.status).toBe('added');

    // Rapid tap 400ms later at same spot -> throttled
    const burst = upsertSessionWaypoint(
      first.next,
      { id: 'wp-2', kind: 'water', label: 'Eau', lat: 45.8, lng: 6.8 },
      t0 + 400,
    );
    expect(burst.status).toBe('throttled');
    expect(burst.next).toHaveLength(1);

    // 3s later at 10m away -> merges cleanly instead of stacking
    const merged = upsertSessionWaypoint(
      first.next,
      { id: 'wp-3', kind: 'danger', label: 'Danger', lat: 45.80008, lng: 6.8 },
      t0 + 3000,
    );
    expect(merged.status).toBe('merged');
    expect(merged.next).toHaveLength(1);
    expect(merged.next[0].kind).toBe('danger');
  });

  it('caps simultaneous live 3D pins cleanly (1 beacon, max 5 reports, max 6 waypoints, max 10 total)', () => {
    const beacon: MapPin = {
      id: 'live-beacon-pin',
      kind: 'live_beacon',
      name: 'Balise Live',
      lat: 45.8,
      lon: 6.8,
      tone: 'good',
    };
    const reports: MapPin[] = Array.from({ length: 9 }, (_, i) => ({
      id: `rep-${i}`,
      kind: 'safety_report',
      name: `Danger ${i}`,
      lat: 45.8 + i * 0.01,
      lon: 6.8,
      distanceKm: i * 0.5,
      tone: 'bad',
    }));
    const waypoints: MapPin[] = Array.from({ length: 8 }, (_, i) => ({
      id: `wp-${i}`,
      kind: 'viewpoint',
      name: `Repère ${i}`,
      lat: 45.9 + i * 0.01,
      lon: 6.9,
      tone: 'good',
    }));

    const selected = selectCleanLivePins({
      beaconPin: beacon,
      safetyPins: reports,
      waypointPins: waypoints,
      priorityPinId: 'rep-8',
    });

    expect(selected.length).toBeLessThanOrEqual(LIVE_PIN_LIMITS.maxTotalLive3D);
    expect(selected.filter((p) => p.kind === 'live_beacon')).toHaveLength(1);
    expect(selected.filter((p) => p.kind === 'safety_report')).toHaveLength(
      LIVE_PIN_LIMITS.maxSafetyReports,
    );
    // Priority newly dropped report is guaranteed to appear
    expect(selected.some((p) => p.id === 'rep-8')).toBe(true);
  });
});
