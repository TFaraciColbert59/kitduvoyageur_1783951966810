import { describe, it, expect } from 'vitest';
import { geocodeMessage } from '../hooks/useGeocode';
import type { GeocodeUiState } from '../hooks/useGeocode';

describe('geocodeMessage', () => {
  it('ne dit rien quand il n y a rien a dire', () => {
    expect(geocodeMessage({ kind: 'idle' })).toBeNull();
    expect(geocodeMessage({ kind: 'results', matches: [] })).toBeNull();
  });

  it('annonce la recherche en cours', () => {
    expect(geocodeMessage({ kind: 'searching' })).toMatch(/Recherche en cours/);
  });

  it('propose la saisie manuelle quand aucun lieu ne correspond', () => {
    const state: GeocodeUiState = { kind: 'no_result' };
    expect(geocodeMessage(state)).toMatch(/à vérifier/);
  });

  it('assume l indisponibilite plutot que de faire semblant', () => {
    const state: GeocodeUiState = { kind: 'unavailable' };
    expect(geocodeMessage(state)).toMatch(/indisponible/);
  });

  it('a un message pour chaque etat possible', () => {
    const kinds: GeocodeUiState['kind'][] = [
      'idle',
      'searching',
      'results',
      'no_result',
      'unavailable',
    ];
    for (const kind of kinds) {
      const state = (kind === 'results' ? { kind, matches: [] } : { kind }) as GeocodeUiState;
      expect(() => geocodeMessage(state)).not.toThrow();
    }
  });
});
