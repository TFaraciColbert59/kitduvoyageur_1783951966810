import { runAllTrackingEngineTests } from './runTrackingTests';
import { describe, it, expect } from 'vitest';

// Enregistrement Vitest (npm test) — suite exécutable, assertions réelles.
describe('hiking', () => {
  it('exécute la suite TrackingEngine', () => {
    const result = runAllTrackingEngineTests();
    expect(result.failed).toBe(0);
  });
});
