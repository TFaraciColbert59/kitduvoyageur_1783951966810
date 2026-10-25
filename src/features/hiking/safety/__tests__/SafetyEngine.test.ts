import assert from 'node:assert';
import { describe, it, expect } from 'vitest';
import { SafetyEngine } from '../SafetyEngine';
import { GPSPosition } from '../../types';

export function runAllSafetyEngineTests(): { success: boolean; passed: number; failed: number } {
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

  console.log('🧪 Executing SafetyEngine Unit Tests...');

  runTest('Format emergency coordinates string', () => {
    const formatted = SafetyEngine.formatEmergencyCoordinates(45.12345, 6.54321, 1450);
    assert.ok(formatted.includes('N 45.12345°'));
    assert.ok(formatted.includes('E 6.54321°'));
    assert.ok(formatted.includes('Alt: 1450 m'));
  });

  runTest('Low battery warning escalation', () => {
    const engine = new SafetyEngine();
    const pos: GPSPosition = { latitude: 45.0, longitude: 6.0, timestamp: Date.now() };

    // 1. Battery at 15% -> WARNING
    const status1 = engine.evaluateSafety(pos, 15, null, false, false);
    assert.strictEqual(status1.highestSeverity, 'WARNING');

    // 2. Battery at 4% -> CRITICAL
    const status2 = engine.evaluateSafety(pos, 4, null, false, false);
    assert.strictEqual(status2.highestSeverity, 'CRITICAL');
  });

  const success = failed === 0;
  console.log(`🏁 Safety Test Summary: ${passed} Passed, ${failed} Failed.`);
  return { success, passed, failed };
}

// Auto-run if invoked directly via node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('SafetyEngine.test')) {
  runAllSafetyEngineTests();
}


// Enregistrement Vitest — suite exécutable par npm test
describe('hiking', () => {
  it('exécute la suite (runAllSafetyEngineTests)', () => {
    const result = runAllSafetyEngineTests();
    expect(result.failed).toBe(0);
  });
});
