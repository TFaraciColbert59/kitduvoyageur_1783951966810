import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const switcher = readFileSync('src/features/hub/components/AdventureSwitcher.tsx', 'utf8');

describe('AdventureSwitcher — sélection de l’activité à préparer', () => {
  it('liste uniquement les activités, sans suggestion, matériel, voyage ou groupe', () => {
    expect(switcher).toMatch(/renderGroup\(\s*['"]Mes activités['"],\s*filtered\.sorties/);
    expect(switcher).not.toContain("renderGroup('Mon matériel'");
    expect(switcher).not.toContain("renderGroup('Mes voyages'");
    expect(switcher).not.toContain("renderGroup('Mes groupes'");
    expect(switcher).not.toContain('suggestedEntry');
    expect(switcher).not.toContain('suggestion');
  });

  it('presente la liste comme une cible de préparation claire', () => {
    expect(switcher).toContain("Changer d'activité");
    expect(switcher).toContain('Rechercher une activité');
    expect(switcher).toContain('aria-label="Changer d\'activité"');
  });
});
