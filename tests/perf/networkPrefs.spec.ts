import { describe, it, expect } from 'vitest';
import {
  evaluatePrefetchPolicy,
  type ConnectionLike,
} from '@/lib/perf/networkPrefs';

const connection = (overrides: ConnectionLike): ConnectionLike => ({ ...overrides });

describe('PERF — politique de prefetch réseau (P0)', () => {
  it('API absente ⇒ comportement actuel conservé (fail-open)', () => {
    expect(evaluatePrefetchPolicy(null)).toMatchObject({ allow: true, allowData: true });
    expect(evaluatePrefetchPolicy(undefined)).toMatchObject({ allow: true, allowData: true });
    expect(evaluatePrefetchPolicy(connection({}))).toMatchObject({ allow: true, allowData: true });
  });

  it('saveData ⇒ aucun prefetch (routes ni données)', () => {
    const verdict = evaluatePrefetchPolicy(connection({ saveData: true, effectiveType: '4g' }));
    expect(verdict.allow).toBe(false);
    expect(verdict.allowData).toBe(false);
    expect(verdict.reason).toBe('save-data');
  });

  it('2G / slow-2g ⇒ aucun prefetch', () => {
    for (const effectiveType of ['slow-2g', '2g']) {
      const verdict = evaluatePrefetchPolicy(connection({ effectiveType }));
      expect(verdict.allow).toBe(false);
      expect(verdict.allowData).toBe(false);
      expect(verdict.reason).toBe('slow-network');
    }
  });

  it('3G ⇒ prefetch de routes autorisé, prefetch de DONNÉES refusé', () => {
    const verdict = evaluatePrefetchPolicy(connection({ effectiveType: '3g' }));
    expect(verdict.allow).toBe(true);
    expect(verdict.allowData).toBe(false);
    expect(verdict.reason).toBe('reduced-data');
  });

  it('4G ⇒ prefetch complet', () => {
    const verdict = evaluatePrefetchPolicy(connection({ effectiveType: '4g' }));
    expect(verdict.allow).toBe(true);
    expect(verdict.allowData).toBe(true);
    expect(verdict.reason).toBe('ok');
  });
});
