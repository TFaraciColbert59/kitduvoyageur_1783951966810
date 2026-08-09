import assert from 'node:assert';
import { TrailIntelligenceEngine, AnonymizedHikeSample } from '../TrailIntelligenceEngine';
import { HikeSession, Trail } from '../../types';

export function runAllTrailIntelligenceEngineTests(): { success: boolean; passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function runTest(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`  ✗ ${name}:`, err?.message || err);
    }
  }

  console.log('🧪 Executing TrailIntelligenceEngine Unit Tests...');

  runTest('Pii stripping & session anonymization', () => {
    const session: HikeSession = {
      id: 'session-12345',
      userId: 'user-secret-id-999',
      routeId: 'route-77',
      startedAt: '2026-08-09T08:00:00Z',
      distanceKm: 12.0,
      durationSeconds: 7200,
      positions: [
        { latitude: 45.0, longitude: 6.0, speed: 0.1, timestamp: 1000 },
        { latitude: 45.001, longitude: 6.0, accuracy: 40, timestamp: 2000 },
      ],
      poiEvents: [],
    };

    const sample = TrailIntelligenceEngine.anonymizeHikeSession(session);
    assert.strictEqual(sample.routeId, 'route-77');
    assert.ok(sample.anonymizedSessionId.startsWith('anon-'));
    assert.ok(!sample.anonymizedSessionId.includes('user-secret-id-999'));
    assert.strictEqual(sample.slowZonesCount, 1);
    assert.strictEqual(sample.gpsWeakPointsCount, 1);
  });

  runTest('Aggregated report & confidence score calculation', () => {
    const samples: AnonymizedHikeSample[] = Array.from({ length: 25 }, (_, i) => ({
      routeId: 'route-1',
      anonymizedSessionId: `anon-${i}`,
      totalDistanceKm: 10,
      durationSeconds: 9000, // 2h30 -> pace 15 min/km
      averagePaceMinPerKm: 15,
      slowZonesCount: 2,
      gpsWeakPointsCount: 0,
    }));

    const report = TrailIntelligenceEngine.processTrailTelemetry('route-1', null, samples);
    assert.strictEqual(report.sampleCount, 25);
    assert.strictEqual(report.confidenceScorePercent, 50); // 25 / 50 * 100
    assert.strictEqual(report.observedAverageDurationMinutes, 150);
    assert.strictEqual(report.observedAveragePaceMinPerKm, 15);
    assert.strictEqual(report.observedDifficulty, 'Modéré');
  });

  runTest('Generate proposal for human validation when difficulty diverges', () => {
    const officialTrail: Trail = {
      id: 'trail-1',
      name: 'Sentier du Lac',
      difficulty: 'Facile',
      duration_hours: 2,
    };

    // 12 samples indicating 4h duration and "Difficile" observed difficulty
    const samples: AnonymizedHikeSample[] = Array.from({ length: 12 }, (_, i) => ({
      routeId: 'trail-1',
      anonymizedSessionId: `anon-${i}`,
      totalDistanceKm: 12,
      durationSeconds: 14400, // 4 hours
      averagePaceMinPerKm: 20, // 20 min/km -> Difficile
      slowZonesCount: 5,
      gpsWeakPointsCount: 1,
    }));

    const report = TrailIntelligenceEngine.processTrailTelemetry('trail-1', officialTrail, samples);
    assert.strictEqual(report.observedDifficulty, 'Difficile');
    assert.ok(report.proposedCorrections.length >= 1);
    assert.strictEqual(report.proposedCorrections[0].status, 'pending_review');
  });

  const success = failed === 0;
  console.log(`🏁 Intelligence Test Summary: ${passed} Passed, ${failed} Failed.`);
  return { success, passed, failed };
}

// Auto-run if invoked directly via node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('TrailIntelligenceEngine.test')) {
  runAllTrailIntelligenceEngineTests();
}
