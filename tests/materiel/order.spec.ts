import { describe, it, expect } from 'vitest';
import { normalizeOrder, DEFAULT_ORDER } from '@/features/materiel/store/useMaterielOrder';

describe('normalizeOrder', () => {
  it('garde un ordre valide', () => {
    expect(normalizeOrder(['forget', 'dispo', 'depart', 'kits', 'alertes']))
      .toEqual(['forget', 'dispo', 'depart', 'kits', 'alertes']);
  });
  it('ajoute les manquantes et dédoublonne', () => {
    expect(normalizeOrder(['kits', 'kits'])).toEqual(['kits', ...DEFAULT_ORDER.filter((a) => a !== 'kits')]);
  });
  it('ignore les zones inconnues', () => {
    expect(normalizeOrder(['foo', 'depart'])).toEqual(['depart', ...DEFAULT_ORDER.filter((a) => a !== 'depart')]);
  });
});
