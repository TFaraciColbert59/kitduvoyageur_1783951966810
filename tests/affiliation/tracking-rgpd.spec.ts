import { describe, expect, it, afterEach, vi } from 'vitest';
import { hashSessionForRgpd } from '@/features/affiliation/engine/affiliateEngine';

describe('suivi des clics d’affiliation (RGPD)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('le haché ne contient ni l’adresse IP ni l’agent', () => {
    const h = hashSessionForRgpd('203.0.113.7', 'Mozilla/5.0', 's');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('203');
  });

  it('le sel vient de l’environnement quand il est posé', () => {
    vi.stubEnv('AFFILIATE_HASH_SALT', 'sel-a');
    const a = hashSessionForRgpd('1.2.3.4', 'ua');
    vi.stubEnv('AFFILIATE_HASH_SALT', 'sel-b');
    const b = hashSessionForRgpd('1.2.3.4', 'ua');
    expect(a).not.toBe(b);
    expect(a).toBe(hashSessionForRgpd('1.2.3.4', 'ua', 'sel-a'));
  });
});
