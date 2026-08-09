import { HikeNarrativeService } from '../HikeNarrativeService';
import { HikeSession } from '../../types';

async function runTests() {
  console.log('🧪 Executing HikeNarrativeService Unit Tests...');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✕ ${name}`);
      failed++;
    }
  }

  const mockSession: HikeSession = {
    id: 'sess-101',
    userId: 'usr-1',
    startedAt: new Date().toISOString(),
    distanceKm: 14.2,
    durationSeconds: 8280,
    elevationGainM: 420,
    positions: [],
    poiEvents: [],
  };

  const result = await HikeNarrativeService.generateNarratives(mockSession, []);

  assert(typeof result.journal === 'string' && result.journal.includes('14.2 km'), 'Generate journal narrative');
  assert(typeof result.aventure === 'string' && result.aventure.includes('420 mètres'), 'Generate epic aventure narrative');
  assert(typeof result.sportive === 'string' && result.sportive.includes('Effort physique'), 'Generate sportive analysis narrative');

  console.log(`🏁 Narrative Test Summary: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
