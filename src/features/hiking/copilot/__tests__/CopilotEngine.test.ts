import assert from 'node:assert';
import { CopilotEngine, HikeContextSummary } from '../CopilotEngine';

export function runAllCopilotEngineTests(): { success: boolean; passed: number; failed: number } {
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

  console.log('🧪 Executing CopilotEngine Unit Tests...');

  runTest('Generate answer for remaining distance', () => {
    const ctx: HikeContextSummary = {
      distanceKm: 6.8,
      remainingDistanceKm: 7.4,
      durationSeconds: 7200,
      paceMinPerKm: 16,
    };
    const ans = CopilotEngine.generateAnswer('Combien il me reste ?', ctx);
    assert.ok(ans.includes('7.4 km'));
    assert.ok(ans.includes('min'));
  });

  runTest('Generate answer for water point lookup', () => {
    const ctx: HikeContextSummary = {
      distanceKm: 5.0,
      durationSeconds: 3600,
      paceMinPerKm: 15,
      nextPoi: { id: 'w1', name: 'Source de la Cascade', category: 'water', lat: 45.0, lon: 6.0, distance_m: 450, bearing_deg: 90, distanceRemainingM: 450 },
    };
    const ans = CopilotEngine.generateAnswer('Où est le prochain point d\'eau ?', ctx);
    assert.ok(ans.includes('Source de la Cascade'));
    assert.ok(ans.includes('450 m'));
  });

  runTest('Proactive suggestion on weather alert', () => {
    const ctx: HikeContextSummary = {
      distanceKm: 10.0,
      durationSeconds: 7200,
      paceMinPerKm: 15,
      weather: { tempC: 12, condition: 'Orage ⚡', windKmH: 45, precipitationProbability: 80, isAlert: true, alertMessage: 'Risque d\'orage imminent', fetchedAt: new Date().toISOString() },
    };
    const suggestion = CopilotEngine.getProactiveSuggestion(ctx);
    assert.ok(suggestion !== null);
    assert.ok(suggestion!.includes('Risque d\'orage imminent'));
  });

  const success = failed === 0;
  console.log(`🏁 Copilot Test Summary: ${passed} Passed, ${failed} Failed.`);
  return { success, passed, failed };
}

// Auto-run if invoked directly via node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('CopilotEngine.test')) {
  runAllCopilotEngineTests();
}
