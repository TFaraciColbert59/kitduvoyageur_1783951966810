import { describe, it, expect } from 'vitest';
import { PAYS_SECTIONS, getPaysSection } from '@/features/pays/registry/paysSectionRegistry';

describe('Registre des sections Pays', () => {
  it('expose exactement les 4 sections prioritaires', () => {
    expect(PAYS_SECTIONS.map((section) => section.id)).toEqual([
      'presentation',
      'destinations',
      'activites',
      'culture',
    ]);
  });

  it('chaque section déclare au moins un bloc IA et des libellés', () => {
    for (const section of PAYS_SECTIONS) {
      expect(section.blockTypes.length).toBeGreaterThan(0);
      expect(section.label.length).toBeGreaterThan(0);
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.subtitle.length).toBeGreaterThan(0);
    }
  });

  it('n’attribue un partenaire qu’aux sections concernées', () => {
    expect(getPaysSection('destinations').partner).toBe('viator');
    expect(getPaysSection('activites').partner).toBe('viator');
    expect(getPaysSection('culture').partner).toBeUndefined();
    expect(getPaysSection('presentation').partner).toBeUndefined();
  });

  it('getPaysSection retourne la bonne définition (fallback sûr)', () => {
    expect(getPaysSection('culture').blockTypes).toEqual(['etiquette']);
    expect(getPaysSection('activites').blockTypes).toContain('itineraires_suggeres');
  });
});
