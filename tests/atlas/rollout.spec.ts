import { describe, it, expect } from 'vitest';
import { resolveUnifiedMapEnabled } from '@/lib/atlas/rollout';

describe('ATLAS — gating du moteur unifié (Phase 7)', () => {
  it('flag global actif ⇒ moteur unifié', () => {
    expect(resolveUnifiedMapEnabled({ flagEnabled: true, atlasParam: null })).toBe(true);
  });

  it('flag inactif sans switch interne ⇒ moteur legacy (rollback instantané)', () => {
    expect(resolveUnifiedMapEnabled({ flagEnabled: false, atlasParam: null })).toBe(false);
    expect(resolveUnifiedMapEnabled({ flagEnabled: false, atlasParam: '0' })).toBe(false);
    expect(resolveUnifiedMapEnabled({ flagEnabled: false, atlasParam: 'x' })).toBe(false);
  });

  it('switch interne ?atlas=1 ⇒ moteur unifié même flag off (tests/équipe)', () => {
    expect(resolveUnifiedMapEnabled({ flagEnabled: false, atlasParam: '1' })).toBe(true);
  });

  it('un flag non booléen ne l’active jamais (fail-safe false)', () => {
    expect(
      resolveUnifiedMapEnabled({
        flagEnabled: undefined as unknown as boolean,
        atlasParam: null,
      })
    ).toBe(false);
  });
});
