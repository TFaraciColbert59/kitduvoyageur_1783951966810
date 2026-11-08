import { describe, expect, it } from 'vitest';
import { editDistance, suggestAlternatives, withSuggestedTerm } from '../search/suggest';

describe('editDistance', () => {
  it('calcule la distance d’édition bornée', () => {
    expect(editDistance('vercors', 'vercors')).toBe(0);
    expect(editDistance('vercor', 'vercors')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('chamonix', 'chamonie')).toBe(1);
  });
});

describe('suggestAlternatives', () => {
  it('propose une correction orthographique proche', () => {
    const result = suggestAlternatives('vercor', ['Vercors', 'Chamonix', 'Lac Blanc']);
    expect(result.best).toEqual({ from: 'vercor', to: 'Vercors' });
  });

  it('propose des mots proches par préfixe', () => {
    const result = suggestAlternatives('chamo', ['Chamonix', 'Chamonix-Mont-Blanc', 'Bivouac']);
    expect(result.near).toContain('Chamonix');
    expect(result.near.length).toBeLessThanOrEqual(4);
  });

  it('ne propose rien quand le vocabulaire est vide ou identique', () => {
    expect(suggestAlternatives('inconnu', [])).toEqual({ best: null, near: [] });
    expect(suggestAlternatives('vercors', ['Vercors'])).toEqual({ best: null, near: [] });
  });

  it('remplace le terme fautif dans la requête complète', () => {
    expect(withSuggestedTerm('vercor au printemps', { from: 'vercor', to: 'Vercors' })).toBe(
      'Vercors au printemps',
    );
    expect(withSuggestedTerm('VERCOR', { from: 'vercor', to: 'Vercors' })).toBe('Vercors');
  });
});
