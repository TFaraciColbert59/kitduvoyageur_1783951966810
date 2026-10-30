import { describe, expect, it } from 'vitest';
import { parseQuery } from '@/app/api/explorer/v2/search/route';

/**
 * Recherche en langage naturel (P6-08) : 10 requêtes types → filtres attendus.
 * Aucun modèle : seules des règles déterministes, vérifiables ici.
 */
describe('explorer-v2 · analyseur de recherche', () => {
  const cases: Array<{ q: string; expect: Partial<ReturnType<typeof parseQuery>> }> = [
    { q: 'un point d’eau à moins de 2 heures', expect: { kinds: ['water'], maxDistanceKm: 8 } },
    { q: 'refuge facile pour débutant', expect: { kinds: ['refuge'], easy: true } },
    { q: 'sommet avec vue', expect: { kinds: ['summit', 'viewpoint'] } },
    { q: 'bivouac en famille', expect: { kinds: ['bivouac'], family: true } },
    { q: 'parking à moins de 5 km', expect: { kinds: ['access'], maxDistanceKm: 5 } },
    { q: 'lac pour se baigner', expect: { kinds: ['water'] } },
    { q: 'cabane en forêt', expect: { kinds: ['refuge'] } },
    { q: 'panorama accessible', expect: { kinds: ['viewpoint'], easy: true } },
    { q: 'source', expect: { kinds: ['water'] } },
    { q: 'randonnée pour enfants', expect: { family: true } },
  ];

  for (const testCase of cases) {
    it(`« ${testCase.q} »`, () => {
      const filters = parseQuery(testCase.q);
      expect(filters).toMatchObject(testCase.expect);
    });
  }

  it('sans mot-clé de type, cherche tous les repères utiles', () => {
    const filters = parseQuery('autour de moi');
    expect(filters.kinds).toEqual(['water', 'refuge', 'summit', 'viewpoint', 'bivouac']);
    expect(filters.maxDistanceKm).toBeNull();
  });

  it('convertit les heures en distance à 4 km/h', () => {
    expect(parseQuery('à moins de 1 heure').maxDistanceKm).toBe(4);
    expect(parseQuery('moins de 3 heures').maxDistanceKm).toBe(12);
  });
});
