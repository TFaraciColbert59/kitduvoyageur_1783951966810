import { describe, it, expect } from 'vitest';
import { buildRegionTiles, normalizeTripHistory } from '../paysDrawerData';

describe('tuiles régions fiche pays', () => {
  it('utilise les régions administratives quand elles existent', () => {
    const tiles = buildRegionTiles(
      [{ id: '11', name: 'Alpes' }],
      [{ categorie: 'Haute Montagne · Alpes', titre: 'Massif du', titre_em: 'Mont-Blanc', meta_2: 'Chamonix', image_url: 'https://example.test/alpes.jpg' }],
    );
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ name: 'Alpes', image: 'https://example.test/alpes.jpg', count: 1 });
  });

  it('ne colle pas une image à une région sans correspondance textuelle', () => {
    const tiles = buildRegionTiles(
      [{ id: '94', name: 'Corse' }],
      [{ categorie: 'Haute Montagne · Alpes', titre: 'Massif du', titre_em: 'Mont-Blanc', meta_2: 'Chamonix', image_url: 'https://example.test/alpes.jpg' }],
    );
    expect(tiles[0]).toMatchObject({ name: 'Corse', image: null, count: 0 });
  });

  it('regroupe les zones éditoriales quand le référentiel est vide', () => {
    const tiles = buildRegionTiles([], [
      { categorie: 'Haute Montagne · Alpes', titre: 'Massif du', titre_em: 'Mont-Blanc', meta_2: 'Chamonix', image_url: 'https://example.test/alpes.jpg' },
      { categorie: 'Sauvage · Corse', titre: 'GR20', titre_em: 'Corse', meta_2: '16 étapes', image_url: 'https://example.test/corse.jpg' },
    ]);
    expect(tiles.map((tile) => tile.name)).toEqual(['Haute Montagne · Alpes', 'Sauvage · Corse']);
    expect(tiles[0]).toMatchObject({ count: 1, image: 'https://example.test/alpes.jpg' });
  });
});

describe('historique pays du voyageur', () => {
  it('déduplique et trie les voyages du plus récent au plus ancien', () => {
    const rows = normalizeTripHistory(
      [
        { id: 'a', slug: 'a', title: '  ', destination_name: 'France', start_date: '2024-06-01', end_date: '2024-06-08', status: 'termine' },
        { id: 'b', slug: 'b', title: 'Corse', destination_name: 'France', start_date: '2025-07-01', end_date: '2025-07-08', status: 'termine' },
      ],
      [{ id: 'a', slug: 'a', title: 'Doublon', destination_name: 'France', start_date: '2024-06-01', end_date: '2024-06-08', status: 'termine' }],
    );
    expect(rows.map((row) => row.id)).toEqual(['b', 'a']);
    expect(rows[1].title).toBe('Voyage sans titre');
  });
});
