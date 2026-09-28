import { beforeEach, describe, expect, it, vi } from 'vitest';

// Le hook tire React + Supabase + Auth : on neutralise la chaine d'import pour
// ne tester que les fonctions pures de purification.
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/useHapticFeedback', () => ({ useHapticFeedback: () => ({ triggerHaptic: () => {} }) }));

import {
  buildCartItemFromProduct,
  mapShopProductRow,
  normalizeEssentiality,
  normalizeShopCount,
  normalizeShopPrice,
  normalizeShopRating,
  normalizeShopText,
  normalizeShopWeight,
  readGuestGearPayload,
  type AddToCartOutcome,
  type UnifiedProduct,
} from '../useEquipment';

/**
 * Aucune donnee boutique ne doit etre inventee. Le schema `shop_products`
 * utilise 0 et '' comme sentinelles « non renseigne » :
 *   brand TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
 *   weight_g INTEGER NOT NULL DEFAULT 0, price_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
 *   rating NUMERIC(3,1) NOT NULL DEFAULT 0, image TEXT NOT NULL DEFAULT ''.
 * Ces sentinelles doivent devenir `null` cote UI, jamais 4,8 / 12 / 10 / 0 g.
 */

const LIGNE_REELLE = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'osprey-farpoint-40',
  name: 'Osprey Farpoint 40',
  brand: 'Osprey',
  category: 'Sacs',
  category_main: 'Portage',
  weight_g: 1420,
  price_eur: 179.9,
  image: 'https://cdn.test/osprey.jpg',
  image_alt: 'Sac Osprey Farpoint 40',
  rating: 4.8,
  review_count: 312,
  stock: 15,
  essentiality: 'Indispensable',
  is_active: true,
  score_kdv: 91,
  description: 'Sac de voyage cabine.',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('normalizeShopText — pas de valeur par defaut inventee', () => {
  it('conserve un texte reel', () => {
    expect(normalizeShopText('Osprey')).toBe('Osprey');
  });

  it('transforme la sentinelle vide du schema en null', () => {
    expect(normalizeShopText('')).toBeNull();
  });

  it('transforme une chaine blanche en null', () => {
    expect(normalizeShopText('   ')).toBeNull();
  });

  it('transforme null et undefined en null', () => {
    expect(normalizeShopText(null)).toBeNull();
    expect(normalizeShopText(undefined)).toBeNull();
  });

  it('refuse un nombre plutot que de le convertir en texte', () => {
    expect(normalizeShopText(42)).toBeNull();
  });
});

describe('normalizeShopPrice — 0 EUR est une sentinelle, pas un prix', () => {
  it('conserve un prix reel', () => {
    expect(normalizeShopPrice(179.9)).toBe(179.9);
  });

  it('transforme le defaut 0 du schema en null', () => {
    expect(normalizeShopPrice(0)).toBeNull();
  });

  it('transforme une chaine numerique en nombre', () => {
    expect(normalizeShopPrice('49.90')).toBe(49.9);
  });

  it('refuse un prix negatif', () => {
    expect(normalizeShopPrice(-5)).toBeNull();
  });

  it('refuse NaN et Infinity', () => {
    expect(normalizeShopPrice(Number.NaN)).toBeNull();
    expect(normalizeShopPrice(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('refuse une texte non numerique', () => {
    expect(normalizeShopPrice('sur demande')).toBeNull();
  });
});

describe('normalizeShopWeight — 0 g est une sentinelle, pas un poids', () => {
  it('conserve un poids reel', () => {
    expect(normalizeShopWeight(1420)).toBe(1420);
  });

  it('transforme le defaut 0 du schema en null', () => {
    expect(normalizeShopWeight(0)).toBeNull();
  });

  it('accepte un poids decimal issu de weight_grams', () => {
    expect(normalizeShopWeight(1420.4)).toBe(1420.4);
  });

  it('refuse un poids negatif', () => {
    expect(normalizeShopWeight(-1)).toBeNull();
  });
});

describe('normalizeShopRating — jamais 4,8 par defaut', () => {
  it('conserve une note reelle', () => {
    expect(normalizeShopRating(4.8)).toBe(4.8);
  });

  it('transforme le defaut 0 du schema en null', () => {
    expect(normalizeShopRating(0)).toBeNull();
  });

  it('refuse une note hors echelle 5', () => {
    expect(normalizeShopRating(5.4)).toBeNull();
  });
});

describe('normalizeShopCount — le 0 est une information reelle', () => {
  it('conserve un 0 de stock reel (rupture)', () => {
    expect(normalizeShopCount(0)).toBe(0);
  });

  it('conserve un stock reel', () => {
    expect(normalizeShopCount(15)).toBe(15);
  });

  it('refuse un compte negatif', () => {
    expect(normalizeShopCount(-2)).toBeNull();
  });

  it('refuse une valeur non numerique', () => {
    expect(normalizeShopCount('beaucoup')).toBeNull();
  });
});

describe('normalizeEssentiality — aligne le schema sur lunion de types', () => {
  it('normalise la valeur reelle du schema', () => {
    expect(normalizeEssentiality('Indispensable')).toBe('indispensable');
    expect(normalizeEssentiality('Recommandé')).toBe('recommande');
    expect(normalizeEssentiality('Optionnel')).toBe('optionnel');
  });

  it('accepte deja la forme minuscule', () => {
    expect(normalizeEssentiality('optionnel')).toBe('optionnel');
  });

  it('refuse une valeur hors nomenclature plutot que de la deviner', () => {
    expect(normalizeEssentiality('incroyable')).toBeNull();
  });

  it('refuse la sentinelle vide', () => {
    expect(normalizeEssentiality('')).toBeNull();
  });
});

describe('mapShopProductRow — aucune valeur inventee sur une ligne reelle', () => {
  it('projette une ligne complete sans rien ajouter', () => {
    const produit = mapShopProductRow(LIGNE_REELLE);

    expect(produit).not.toBeNull();
    expect(produit?.brand).toBe('Osprey');
    expect(produit?.price_eur).toBe(179.9);
    expect(produit?.weight_g).toBe(1420);
    expect(produit?.rating).toBe(4.8);
    expect(produit?.stock).toBe(15);
    expect(produit?.image).toBe('https://cdn.test/osprey.jpg');
    expect(produit?.essentiality).toBe('indispensable');
    expect(produit?.category).toBe('Portage');
  });

  it('NE FABRIQUE PAS la marque quand le schema a la chaine vide', () => {
    const produit = mapShopProductRow({ ...LIGNE_REELLE, brand: '' });

    expect(produit?.brand).toBeNull();
  });

  it('NE FABRIQUE PAS une note de 4,8 quand le schema a 0', () => {
    const produit = mapShopProductRow({ ...LIGNE_REELLE, rating: 0, review_count: 0 });

    expect(produit?.rating).toBeNull();
  });

  it('NE FABRIQUE PAS 12 avis quand le schema a 0', () => {
    const produit = mapShopProductRow({ ...LIGNE_REELLE, review_count: 0 });

    expect(produit?.review_count).toBe(0);
  });

  it('NE FABRIQUE PAS un stock de 10 quand la colonne est absente', () => {
    const { stock: _absent, ...sansStock } = LIGNE_REELLE;
    const produit = mapShopProductRow(sansStock);

    expect(produit?.stock).toBeNull();
  });

  it('NE FABRIQUE PAS une image unsplash quand la colonne est vide', () => {
    const produit = mapShopProductRow({ ...LIGNE_REELLE, image: '' });

    expect(produit?.image).toBeNull();
  });

  it('NE FABRIQUE PAS une categorie Autre quand les deux colonnes sont vides', () => {
    const produit = mapShopProductRow({ ...LIGNE_REELLE, category: '', category_main: '' });

    expect(produit?.category).toBeNull();
    expect(produit?.category_main).toBeNull();
  });

  it('NE FABRIQUE PAS un prix de 0 EUR quand la colonne vaut 0', () => {
    const produit = mapShopProductRow({ ...LIGNE_REELLE, price_eur: 0 });

    expect(produit?.price_eur).toBeNull();
  });

  it('refuse une ligne sans identifiant', () => {
    const { id: _absent, ...sansId } = LIGNE_REELLE;

    expect(mapShopProductRow(sansId)).toBeNull();
  });

  it('refuse une ligne sans nom', () => {
    expect(mapShopProductRow({ ...LIGNE_REELLE, name: '' })).toBeNull();
  });

  it('refuse une ligne qui n est pas un objet', () => {
    expect(mapShopProductRow(null)).toBeNull();
    expect(mapShopProductRow('ligne')).toBeNull();
  });

  it('ne mute jamais la ligne recue', () => {
    const copie = { ...LIGNE_REELLE };
    mapShopProductRow(copie);

    expect(copie).toEqual(LIGNE_REELLE);
  });
});

describe('readGuestGearPayload — aucun inventaire invite', () => {
  it('renvoie un inventaire vide quand rien n est stocke', () => {
    expect(readGuestGearPayload(null)).toEqual([]);
  });

  it('renvoie un inventaire vide sur un JSON casse', () => {
    expect(readGuestGearPayload('{pas du json')).toEqual([]);
  });

  it('renvoie un inventaire vide sur un tableau vide', () => {
    expect(readGuestGearPayload('[]')).toEqual([]);
  });

  it('renvoie un inventaire vide si le JSON n est pas un tableau', () => {
    expect(readGuestGearPayload('{"osprey":true}')).toEqual([]);
  });

  it('ecarte une entree sans identifiant plutot que de l inventer', () => {
    const raw = JSON.stringify([
      { id: 'gear-1', name: 'Lampe', weight_g: 85 },
      { name: 'Sans identifiant', weight_g: 10 },
    ]);

    const lu = readGuestGearPayload(raw);

    expect(lu).toHaveLength(1);
    expect(lu[0]?.id).toBe('gear-1');
  });

  it('conserve un inventaire reellement enregistre par l utilisateur', () => {
    const brut = [{ id: 'gear-1', name: 'Lampe', brand: 'Petzl', weight_g: 85 }];

    expect(readGuestGearPayload(JSON.stringify(brut))).toEqual(brut);
  });

  it('ne renvoie jamais de prix d achat fabrique', () => {
    const lu = readGuestGearPayload(JSON.stringify([{ id: 'gear-1', name: 'Lampe' }]));

    expect(lu[0]?.purchase_price ?? null).toBeNull();
  });
});

describe('buildCartItemFromProduct — refus de mettre 0 EUR au panier', () => {
  const produit = (over: Partial<UnifiedProduct> = {}): UnifiedProduct => ({
    id: 'p-1',
    slug: 'osprey-farpoint-40',
    name: 'Osprey Farpoint 40',
    brand: 'Osprey',
    category: 'Portage',
    weight_g: 1420,
    price_eur: 179.9,
    image: 'https://cdn.test/osprey.jpg',
    image_alt: 'Sac Osprey Farpoint 40',
    ...over,
  });

  it('construit une ligne de panier quand le prix est reel', () => {
    const issue = buildCartItemFromProduct(produit(), 2) as AddToCartOutcome;

    expect(issue.ok).toBe(true);
    if (issue.ok) {
      expect(issue.item.priceEur).toBe(179.9);
      expect(issue.item.weightG).toBe(1420);
      expect(issue.item.quantity).toBe(2);
      expect(issue.item.name).toBe('Osprey Farpoint 40');
    }
  });

  it('REFUSE la ligne quand le prix est inconnu', () => {
    const issue = buildCartItemFromProduct(produit({ price_eur: null }), 1) as AddToCartOutcome;

    expect(issue.ok).toBe(false);
    if (!issue.ok) expect(issue.reason).toBe('prix_inconnu');
  });

  it('utilise la/string vide comme marqueur de valeur inconnue, pas une marque bidon', () => {
    const issue = buildCartItemFromProduct(produit({ brand: null }), 1) as AddToCartOutcome;

    expect(issue.ok).toBe(true);
    if (issue.ok) expect(issue.item.brand).toBe('');
  });

  it('utilise la/string vide comme marqueur de categorie inconnue', () => {
    const issue = buildCartItemFromProduct(produit({ category: null }), 1) as AddToCartOutcome;

    expect(issue.ok).toBe(true);
    if (issue.ok) expect(issue.item.category).toBe('');
  });

  it('utilise 0 g comme poids inconnu dans le panier, sans image de substitution', () => {
    const issue = buildCartItemFromProduct(
      produit({ weight_g: null, image: null }),
      1
    ) as AddToCartOutcome;

    expect(issue.ok).toBe(true);
    if (issue.ok) {
      expect(issue.item.weightG).toBe(0);
      expect(issue.item.image).toBe('');
    }
  });

  it('signale explicitement que le 0 g est une sentinelle, pas une mesure', () => {
    const inconnu = buildCartItemFromProduct(produit({ weight_g: null }), 1) as AddToCartOutcome;
    expect(inconnu.ok).toBe(true);
    // weightKnown=false empeche l'appelant d'annoncer « 0 g » comme un poids reel.
    if (inconnu.ok) {
      expect(inconnu.weightKnown).toBe(false);
      expect(inconnu.item.weightG).toBe(0);
    }

    for (const poids of [0, -10, Number.NaN, null]) {
      const issue = buildCartItemFromProduct(produit({ weight_g: poids }), 1) as AddToCartOutcome;
      expect(issue.ok).toBe(true);
      if (issue.ok) expect(issue.weightKnown).toBe(false);
    }

    const reel = buildCartItemFromProduct(produit({ weight_g: 1420 }), 1) as AddToCartOutcome;
    if (reel.ok) {
      expect(reel.weightKnown).toBe(true);
      expect(reel.item.weightG).toBe(1420);
    }
  });

  it('derive le texte alternatif du vrai nom, jamais d une image inventee', () => {
    const issue = buildCartItemFromProduct(produit({ image_alt: null }), 1) as AddToCartOutcome;

    expect(issue.ok).toBe(true);
    if (issue.ok) expect(issue.item.imageAlt).toBe('Osprey Farpoint 40');
  });

  it('ne mute jamais le produit recu', () => {
    const original = produit();
    const copie = { ...original };

    buildCartItemFromProduct(copie, 1);

    expect(copie).toEqual(original);
  });
});
