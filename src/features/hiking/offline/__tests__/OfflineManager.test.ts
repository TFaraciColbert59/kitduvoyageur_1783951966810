import assert from 'node:assert';
import { OfflineManager } from '../OfflineManager';

export function runAllOfflineManagerTests(): { success: boolean; passed: number; failed: number } {
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

  console.log('🧪 Executing OfflineManager Unit Tests...');

  runTest('OfflineManager queue item addition', () => {
    const mgr = new OfflineManager();
    mgr.enqueue('hike_session', { id: 'test-session', distanceKm: 12.5 });

    assert.strictEqual(mgr.getPendingCount(), 1);
  });

  runTest('Network status subscription', () => {
    const mgr = new OfflineManager();
    let notifiedStatus = '';
    
    mgr.subscribe((status) => {
      notifiedStatus = status;
    });

    assert.ok(mgr.getStatus() != null, 'Status should be defined');
  });

  const success = failed === 0;
  console.log(`🏁 Offline Test Summary: ${passed} Passed, ${failed} Failed.`);
  return { success, passed, failed };
}

// Auto-run if invoked directly via node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('OfflineManager.test')) {
  runAllOfflineManagerTests();
}
