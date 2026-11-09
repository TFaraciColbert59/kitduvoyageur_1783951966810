import { describe, expect, it } from 'vitest';
import { KIT_MODEL_OPTIONS, kitModelLabel, kitPreparationSuggestions } from '../kitTemplates';

describe('kitTemplates (FID-069)', () => {
  it('expose les modèles de la maquette (journée, bivouac, alpinisme)', () => {
    expect(KIT_MODEL_OPTIONS.slice(0, 3)).toEqual([
      { id: 'day', label: 'Journée' },
      { id: 'bivouac', label: 'Bivouac' },
      { id: 'alpine', label: 'Alpinisme' },
    ]);
  });

  it('rend le libellé d’un modèle et null pour un identifiant inconnu', () => {
    expect(kitModelLabel('bivouac')).toBe('Bivouac');
    expect(kitModelLabel('inconnu')).toBeNull();
    expect(kitModelLabel(null)).toBeNull();
  });

  it('calcule la préparation d’un kit bivouac (catégories manquantes)', () => {
    const suggestions = kitPreparationSuggestions('bivouac', [], []);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((entry) => entry.category === 'Abri')).toBe(true);
    expect(suggestions[0]?.reason).toContain('bivouac');

    const ready = kitPreparationSuggestions('day', [
      { id: '1', name: 'Sac', category: 'Portage' },
      { id: '2', name: 'Gourde', category: 'Eau' },
      { id: '3', name: 'Barres', category: 'Nutrition' },
      { id: '4', name: 'Veste', category: 'Vêtements' },
      { id: '5', name: 'Trousse', category: 'Sécurité' },
      { id: '6', name: 'Carte', category: 'Navigation' },
    ]);
    expect(ready).toEqual([]);
  });
});
