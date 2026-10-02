import { describe, expect, it } from 'vitest';
import { bestShopProduct, shopRelevance } from '../engine/shopMatch';

const shop = [
  {
    id: 'a',
    name: 'Sac à Dos de Randonnée – Catégorie BigBuy',
    category: 'Équipement du sac',
    brand: 'BigBuy Outdoor',
    mode: 'achat',
  },
  {
    id: 'b',
    name: 'Tente de Camping 2 Personnes',
    category: 'Bivouac / Sommeil',
    brand: null,
    mode: 'achat',
  },
  {
    id: 'c',
    name: 'Sac de Couchage Enfant Tineo',
    category: 'Bivouac / Sommeil',
    brand: null,
    mode: 'achat',
  },
  {
    id: 'd',
    name: 'Tente 3 places (location)',
    category: 'Bivouac / Sommeil',
    brand: null,
    mode: 'location',
  },
];

describe('bestShopProduct — un vrai produit du catalogue, jamais inventé', () => {
  it('rapproche par les mots du nom (accents et casse ignorés)', () => {
    expect(bestShopProduct({ name: 'Sac à dos 45 L', category: 'sac' }, shop)?.id).toBe('a');
    expect(bestShopProduct({ name: 'Tente légère', category: null }, shop)?.id).toBe('b');
    expect(bestShopProduct({ name: 'Sac de couchage', category: 'couchage' }, shop)?.id).toBe('c');
  });

  it('CONTRE-EXEMPLE — catégorie seule, mot vide ou location : aucune proposition', () => {
    expect(bestShopProduct({ name: 'Frontale', category: 'Bivouac / Sommeil' }, shop)).toBeNull();
    expect(bestShopProduct({ name: 'à', category: null }, shop)).toBeNull();
    expect(bestShopProduct({ name: 'Tente', category: null }, [shop[3]])).toBeNull();
  });

  it('les mots génériques du catalogue ne comptent pas', () => {
    expect(shopRelevance({ name: 'Catégorie BigBuy', category: null }, shop[0])).toBe(0);
  });
});
