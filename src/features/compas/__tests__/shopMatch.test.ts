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

/**
 * Constat K-001 (banc Compas, phase 7) : exemples réels relevés sur l'aperçu. Le catalogue
 * porte des titres « <catégorie> – <produit> » dont le préfixe est parfois étranger à l'objet.
 */
import { productFitsLine } from '../engine/shopMatch';

const real = (name: string) => ({ name, category: null, brand: 'BigBuy Outdoor', mode: 'achat' });

describe('K-001 — un produit dont le titre contredit l’objet n’est ni proposé ni montré', () => {
  const batons = { name: 'Bâtons de trekking télescopiques', category: null };
  const sac = { name: 'Sac à dos technique de randonnée', category: null };

  it('« Briquet/Allume-Feu Camping – Bâton Trekking… » ne convient pas à des bâtons de trekking', () => {
    expect(productFitsLine(batons, real('Briquet/Allume-Feu Camping – Bâton Trekking Black Diamond BD110065 Pourpre'))).toBe(false);
  });
  it('« Crampons à Neige/Glace – Bâton Trekking… » et « Jumelles/Optique – Bâton Trekking… » non plus', () => {
    expect(productFitsLine(batons, real('Crampons à Neige/Glace – Bâton Trekking Black Diamond BD110045'))).toBe(false);
    expect(productFitsLine(batons, real('Jumelles/Optique – Bâton Trekking Leki 65221191'))).toBe(false);
  });
  it('« Accessoires pour Sac à Dos » n’est pas un sac à dos', () => {
    expect(productFitsLine(sac, real('Accessoires pour Sac à Dos – Catégorie BigBuy'))).toBe(false);
  });
  it('les titres cohérents restent proposés', () => {
    expect(productFitsLine(sac, real('Sac à Dos de Randonnée – Catégorie BigBuy'))).toBe(true);
    expect(productFitsLine({ name: 'Couteau pliant multifonction en inox', category: null }, real('Couteau Pliant Opinel n°8 Acier Inoxydable 8 cm'))).toBe(true);
    expect(productFitsLine({ name: 'Crème solaire haute protection SPF 50+', category: null }, real('Crème Solaire Nivea SPF 50+ – 200 ml'))).toBe(true);
  });
  it('un objet qui dit « accessoire » accepte « Accessoires pour… »', () => {
    expect(productFitsLine({ name: 'Accessoire de sac à dos', category: null }, real('Accessoires pour Sac à Dos – Catégorie BigBuy'))).toBe(true);
  });
  it('bestShopProduct ne propose pas un produit au titre contradictoire', () => {
    const only = [real('Briquet/Allume-Feu Camping – Bâton Trekking Black Diamond BD110065 Pourpre')];
    expect(bestShopProduct(batons, only)).toBeNull();
    const withGood = [...only, real('Bâtons de Trekking Télescopiques Quechua')];
    expect(bestShopProduct(batons, withGood)?.name).toBe('Bâtons de Trekking Télescopiques Quechua');
  });
});
