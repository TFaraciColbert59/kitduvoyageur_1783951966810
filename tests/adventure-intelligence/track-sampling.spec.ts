import { describe, it, expect } from 'vitest';
import {
  MATCH_SAMPLING_DEFAULTS,
  expandSampleCandidates,
  selectMatchingPoints,
} from '@/features/adventure-intelligence/domain/trackSampling';

function line(count: number, stepDeg = 0.00001): { lat: number; lng: number }[] {
  return Array.from({ length: count }, (_, index) => ({ lat: 44 + index * stepDeg, lng: 6 }));
}

describe('A10 — Échantillonnage map-matching (TEST-A10-BATCH)', () => {
  it('TEST-A10-BATCH-01: pas régulier borné, premier et dernier conservés', () => {
    const points = line(10_000);
    const sample = selectMatchingPoints(points);

    expect(sample.points.length).toBeGreaterThan(0);
    expect(sample.points.length).toBeLessThanOrEqual(MATCH_SAMPLING_DEFAULTS.maxPoints);
    expect(sample.stride).toBeGreaterThan(1);
    expect(sample.points[0]).toBe(points[0]);
    expect(sample.points[sample.points.length - 1]).toBe(points[points.length - 1]);
    expect(sample.indices[0]).toBe(0);
    expect(sample.indices[sample.indices.length - 1]).toBe(points.length - 1);

    const capped = selectMatchingPoints(points, { maxPoints: 50 });
    expect(capped.points.length).toBeLessThanOrEqual(50);
    expect(capped.points[0]).toBe(points[0]);
    expect(capped.points[capped.points.length - 1]).toBe(points[points.length - 1]);

    const short = selectMatchingPoints(line(4, 0.0003));
    expect(short.indices).toEqual([0, 1, 2, 3]);
  });

  it('TEST-A10-BATCH-01b: les candidats échantillonnés sont étendus à toute la trace', () => {
    const points = line(6, 0.0003);
    const sample = selectMatchingPoints(points);
    const candidates = sample.points.map((_, index) => [{ id: index }]);
    const expanded = expandSampleCandidates(sample, candidates, points.length);

    expect(expanded).toHaveLength(points.length);
    expect(expanded[0]).toEqual([{ id: 0 }]);
    expect(expanded[points.length - 1]).toEqual([{ id: sample.points.length - 1 }]);
    for (const entry of expanded) {
      expect(Array.isArray(entry)).toBe(true);
    }
  });
});
