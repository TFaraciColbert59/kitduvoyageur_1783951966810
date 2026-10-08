import { describe, expect, it, vi } from 'vitest';

vi.mock('../server/sharedCache', () => ({ cached: vi.fn(), coordKey: vi.fn() }));
vi.mock('../server/geoapify', () => ({ geoapifyReverse: vi.fn(), geoapifySearch: vi.fn() }));

import { plain, queryKey } from '../server/placeLookup';

describe('clé de cache d’une recherche de lieu', () => {
  it('forme simple pour un nom latin (accents et casse ignorés)', () => {
    expect(queryKey('Genève')).toBe('geneve');
    expect(queryKey('  GENEVE ')).toBe(queryKey('Genève'));
  });

  it('nom sans lettre latine : une clé propre à chaque texte, jamais vide ni partagée', () => {
    expect(plain('Москва')).toBe('');
    const moscou = queryKey('Москва');
    const tokyo = queryKey('東京');
    expect(moscou).toMatch(/^u:[0-9a-f]{24}$/);
    expect(tokyo).not.toBe(moscou);
    expect(queryKey('москва')).toBe(moscou);
  });
});
