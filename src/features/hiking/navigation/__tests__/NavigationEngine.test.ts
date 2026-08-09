import assert from 'node:assert';
import { NavigationEngine } from '../NavigationEngine';
import { GPSPosition, POI } from '../../types';

export function runAllNavigationEngineTests(): { success: boolean; passed: number; failed: number } {
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

  console.log('🧪 Executing NavigationEngine Unit Tests...');

  runTest('Multi-level deviation: NORMAL level (< 10m)', () => {
    const engine = new NavigationEngine();
    const pos: GPSPosition = { latitude: 45.0, longitude: 6.0, timestamp: Date.now() };
    const route = [{ lat: 45.0, lon: 6.00005 }]; // ~4m away

    const status = engine.evaluateNavigation(pos, route);
    assert.strictEqual(status.deviationLevel, 'NORMAL');
    assert.strictEqual(status.isOffRoute, false);
  });

  runTest('Multi-level deviation: WATCH level (10m - 25m)', () => {
    const engine = new NavigationEngine();
    const pos: GPSPosition = { latitude: 45.0, longitude: 6.0, timestamp: Date.now() };
    const route = [{ lat: 45.0, lon: 6.0002 }]; // ~16m away

    const status = engine.evaluateNavigation(pos, route);
    assert.strictEqual(status.deviationLevel, 'WATCH');
    assert.strictEqual(status.isOffRoute, false);
  });

  runTest('Multi-level deviation: WARNING level (25m - 50m)', () => {
    const engine = new NavigationEngine();
    const pos: GPSPosition = { latitude: 45.0, longitude: 6.0, timestamp: Date.now() };
    const route = [{ lat: 45.0, lon: 6.0004 }]; // ~31m away

    const status = engine.evaluateNavigation(pos, route);
    assert.strictEqual(status.deviationLevel, 'WARNING');
    assert.ok(status.rejoinPoint !== null, 'Rejoin point should be provided in WARNING state');
  });

  runTest('Multi-level deviation: OFF_ROUTE requires debounce (2 consecutive samples > 50m)', () => {
    const engine = new NavigationEngine();
    const pos: GPSPosition = { latitude: 45.0, longitude: 6.0, timestamp: Date.now() };
    const route = [{ lat: 45.0, lon: 6.0010 }]; // ~80m away

    // 1st sample: > 50m but debounce not reached yet
    const status1 = engine.evaluateNavigation(pos, route);
    assert.strictEqual(status1.isOffRoute, false);

    // 2nd sample: debounce reached -> OFF_ROUTE
    const status2 = engine.evaluateNavigation(pos, route);
    assert.strictEqual(status2.deviationLevel, 'OFF_ROUTE');
    assert.strictEqual(status2.isOffRoute, true);
    assert.ok(status2.rejoinPoint !== null);
  });

  runTest('Waypoint arrival detection (< 30m)', () => {
    const engine = new NavigationEngine();
    const pos: GPSPosition = { latitude: 45.0, longitude: 6.0, timestamp: Date.now() };
    const waypoints: POI[] = [
      { id: '1', name: 'Refuge de la Dent du Chat', category: 'refuge', lat: 45.0001, lon: 6.0, distance_m: 11, bearing_deg: 0 }
    ];

    const status = engine.evaluateNavigation(pos, [], waypoints);
    assert.strictEqual(status.instruction.type, 'poi-reached');
    assert.ok(status.instruction.message.includes('Refuge de la Dent du Chat'));
  });

  const success = failed === 0;
  console.log(`🏁 Navigation Test Summary: ${passed} Passed, ${failed} Failed.`);
  return { success, passed, failed };
}

// Auto-run if invoked directly via node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('NavigationEngine.test')) {
  runAllNavigationEngineTests();
}
