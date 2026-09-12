import { describe, it, expect } from 'vitest';
import { animationDuration } from '@/components/map/engine/camera';
import { resolveCountryName, resolveIsoA2 } from '@/components/map/engine/geo';

describe('ATLAS — caméra (Phase 4)', () => {
  it('respecte prefers-reduced-motion (durée 0) et garde la durée native sinon', () => {
    expect(animationDuration(700, true)).toBe(0);
    expect(animationDuration(700, false)).toBe(700);
    expect(animationDuration(0, false)).toBe(0);
  });
});

describe('ATLAS — résolution ISO / nom pays (couche monde)', () => {
  it('résout dans l’ordre ISO_A2 > ISO_A2_EH > WB_A2 > ADM0_A3 en excluant -99/-3', () => {
    expect(resolveIsoA2({ ISO_A2: 'FR' })).toBe('FR');
    expect(resolveIsoA2({ ISO_A2: '-99', ISO_A2_EH: 'NO' })).toBe('NO');
    expect(resolveIsoA2({ ISO_A2: '-99', WB_A2: 'BE' })).toBe('BE');
    expect(resolveIsoA2({ ISO_A2: '-99' })).toBeNull();
    expect(resolveIsoA2({ ADM0_A3: 'FRA' })).toBeNull();
    expect(resolveIsoA2(null)).toBeNull();
  });

  it('résout le nom d’affichage sans inventer', () => {
    expect(resolveCountryName({ NAME: 'France' })).toBe('France');
    expect(resolveCountryName({ NAME_EN: 'Belgium' })).toBe('Belgium');
    expect(resolveCountryName({})).toBe('');
    expect(resolveCountryName(null)).toBe('');
  });
});
