import assert from 'node:assert';
import { HikeEngine } from '../HikeEngine';
import { TrackingEngine } from '../TrackingEngine';
import { GPSPosition } from '../../types';

export function runAllTrackingEngineTests(): { success: boolean; passed: number; failed: number } {
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

  console.log('🧪 Executing TrackingEngine & HikeEngine Unit Tests...');

  runTest('Haversine distance calculation (Paris -> Lyon ~390 km)', () => {
    const distKm = HikeEngine.calculateDistanceKm(48.8566, 2.3522, 45.7640, 4.8357);
    assert.ok(distKm > 385 && distKm < 400, `Expected ~390km, got ${distKm}`);
  });

  runTest('Bearing calculation (Paris -> Lyon ~155°)', () => {
    const bearing = HikeEngine.calculateBearingDeg(48.8566, 2.3522, 45.7640, 4.8357);
    assert.ok(bearing > 140 && bearing < 170, `Expected ~155°, got ${bearing}`);
  });

  runTest('Outlier filtering: rejects low accuracy (> 50m)', () => {
    const engine = new TrackingEngine();
    const badPos: GPSPosition = {
      latitude: 45.0,
      longitude: 6.0,
      accuracy: 80,
      timestamp: Date.now(),
    };
    const accepted = engine.processPosition(badPos);
    assert.strictEqual(accepted, false);
    assert.strictEqual(engine.getMetrics().validSampleCount, 0);
  });

  runTest('Outlier filtering: rejects impossible speed (> 30 km/h)', () => {
    const engine = new TrackingEngine();
    const t0 = Date.now();

    const p1: GPSPosition = { latitude: 45.0, longitude: 6.0, accuracy: 5, timestamp: t0 };
    const p2: GPSPosition = { latitude: 45.1, longitude: 6.0, accuracy: 5, timestamp: t0 + 1000 };

    engine.processPosition(p1);
    const accepted2 = engine.processPosition(p2);

    assert.strictEqual(accepted2, false);
    assert.strictEqual(engine.getMetrics().validSampleCount, 1);
  });

  runTest('Elevation gain smoothing calculation', () => {
    const positions: GPSPosition[] = [
      { latitude: 45.0, longitude: 6.0, altitude: 1000, altitudeAccuracy: 5, timestamp: 1000 },
      { latitude: 45.001, longitude: 6.0, altitude: 1005, altitudeAccuracy: 5, timestamp: 2000 },
      { latitude: 45.002, longitude: 6.0, altitude: 1012, altitudeAccuracy: 5, timestamp: 3000 },
      { latitude: 45.003, longitude: 6.0, altitude: 1020, altitudeAccuracy: 5, timestamp: 4000 },
    ];

    const gain = HikeEngine.calculateElevationGain(positions);
    assert.ok(gain !== null && gain > 0, `Expected positive elevation gain, got ${gain}`);
  });

  runTest('ETA estimation calculation for remaining distance', () => {
    const engine = new TrackingEngine();
    const t0 = Date.now();

    const p1: GPSPosition = { latitude: 45.0, longitude: 6.0, accuracy: 5, timestamp: t0 };
    const p2: GPSPosition = { latitude: 45.009, longitude: 6.0, accuracy: 5, timestamp: t0 + 12 * 60 * 1000 };

    engine.processPosition(p1);
    engine.processPosition(p2);

    const metrics = engine.getMetrics(5);
    assert.ok(metrics.estimatedEtaMinutes !== null, 'ETA should be calculated');
    assert.ok(metrics.estimatedEtaMinutes! > 30, `Expected > 30m ETA, got ${metrics.estimatedEtaMinutes}`);
  });

  const success = failed === 0;
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed.`);
  return { success, passed, failed };
}

// Auto-run if invoked directly via node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('runTrackingTests')) {
  runAllTrackingEngineTests();
}
