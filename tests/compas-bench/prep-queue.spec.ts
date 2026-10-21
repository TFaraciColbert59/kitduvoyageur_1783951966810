import { describe, expect, it } from 'vitest';
import { waitFor } from '../e2e-compas-full/_lib/quota';

/** Phase 7 — la file des préparations du banc respecte 6 / 10 min / personne. */
const W = 10 * 60_000;
const at = (key: string, minutesAgo: number, now: number) => ({ key, at: now - minutesAgo * 60_000 });

describe('file des préparations', () => {
  const now = 1_000_000_000;

  it('laisse passer tant que la personne a moins de 6 lancements dans la fenêtre', () => {
    const entries = [1, 2, 3, 4, 5].map((m) => at('a', m, now));
    expect(waitFor(entries, 'a', now, 6, 99, W)).toBe(0);
  });

  it('au 7e, attend que le plus ancien des 6 sorte de la fenêtre (plus une marge)', () => {
    const entries = [9, 8, 7, 6, 5, 4].map((m) => at('a', m, now));
    expect(waitFor(entries, 'a', now, 6, 99, W)).toBe(60_000 + 5_000);
  });

  it('une autre personne n’attend pas ; le plafond du banc, tous comptes réunis, s’applique', () => {
    const entries = [9, 8, 7, 6, 5, 4].map((m) => at('a', m, now));
    expect(waitFor(entries, 'b', now, 6, 99, W)).toBe(0);
    expect(waitFor(entries, 'b', now, 6, 6, W)).toBe(65_000);
  });

  it('oublie les lancements sortis de la fenêtre', () => {
    const entries = [30, 25, 20, 15, 12, 11].map((m) => at('a', m, now));
    expect(waitFor(entries, 'a', now, 6, 99, W)).toBe(0);
  });
});
