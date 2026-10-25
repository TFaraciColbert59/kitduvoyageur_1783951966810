import { describe, it, expect } from 'vitest';
import {
  selectKitProducts,
  type KitProduct,
  type KitSelectionInput,
} from '@/features/trips/engine/selectKitProducts';

function product(partial: Partial<KitProduct> & Pick<KitProduct, 'slug' | 'name'>): KitProduct {
  return {
    category: 'Sécurité / Urgence',
    priority: 'indispensable',
    weightGrams: 100,
    sellPriceEur: 10,
    ...partial,
  };
}

const FIRST_AID = product({
  slug: 'trousse-premiers-secours',
  name: 'Trousse de premiers secours',
  category: 'Sécurité / Urgence',
  weightGrams: 200,
});
const HEADLAMP = product({
  slug: 'lampe-frontale',
  name: 'Lampe frontale LED',
  category: 'Éclairage',
  weightGrams: 90,
});
const NAV = product({
  slug: 'gps-randonnee',
  name: 'GPS de randonnée',
  category: 'Navigation / Orientation',
  weightGrams: 150,
});
const BOTTLE = product({
  slug: 'bouteille-eau',
  name: "Bouteille d'eau",
  category: 'Hydratation',
  weightGrams: 200,
});
const TENT = product({
  slug: 'tente-2p',
  name: 'Tente 2 places',
  category: 'Bivouac / Sommeil',
  priority: 'recommande',
  weightGrams: 2000,
});
const STOVE = product({
  slug: 'rechaud',
  name: 'Réchaud compact',
  category: 'Alimentation / Cuisine',
  priority: 'recommande',
  weightGrams: 300,
});
const POLES = product({
  slug: 'batons-trekking',
  name: 'Bâtons de trekking télescopiques',
  category: 'Équipement du sac',
  priority: 'recommande',
  weightGrams: 500,
});
const CRAMPONS = product({
  slug: 'crampons-baton',
  name: 'Crampons à neige – Bâton Trekking',
  category: 'Protection froid',
  priority: 'recommande',
  weightGrams: 400,
});
const GLOVES = product({
  slug: 'gants-froid',
  name: 'Gants thermiques',
  category: 'Protection froid',
  priority: 'recommande',
  weightGrams: 100,
});
const INSOLES = product({
  slug: 'semelles',
  name: 'Semelles confort',
  category: 'Confort des pieds',
  priority: 'recommande',
  weightGrams: 100,
});
const CHAIR = product({
  slug: 'chaise-pliante',
  name: 'Chaise pliante',
  category: 'Confort',
  priority: 'optionnel',
  weightGrams: 800,
});
const HEAVY_OPTION = product({
  slug: 'valise-lourde',
  name: 'Valise rigide',
  category: 'Transport',
  priority: 'optionnel',
  weightGrams: 11500,
});

const CATALOGUE: KitProduct[] = [
  FIRST_AID,
  HEADLAMP,
  NAV,
  BOTTLE,
  TENT,
  STOVE,
  POLES,
  CRAMPONS,
  GLOVES,
  INSOLES,
  CHAIR,
  HEAVY_OPTION,
];

function input(overrides: Partial<KitSelectionInput> = {}): KitSelectionInput {
  return {
    activity: 'hiking',
    durationDays: 1,
    season: 'ete',
    difficulty: 'moderate',
    elevationGainM: 200,
    partySize: 1,
    ...overrides,
  };
}

describe('selectKitProducts — sélection catalogue réelle', () => {
  it('conserve toujours les indispensables (quantité 1, personnel)', () => {
    const selection = selectKitProducts(input(), CATALOGUE);
    const slugs = selection.items.map((item) => item.product.slug);

    expect(slugs).toContain('trousse-premiers-secours');
    expect(slugs).toContain('lampe-frontale');
    expect(slugs).toContain('gps-randonnee');
    expect(slugs).toContain('bouteille-eau');
    expect(slugs).not.toContain('tente-2p');
    expect(slugs).toContain('chaise-pliante');

    const firstAid = selection.items.find((item) => item.product.slug === 'trousse-premiers-secours');
    expect(firstAid?.quantity).toBe(1);
    expect(firstAid?.ownership).toBe('personal');
    const chair = selection.items.find((item) => item.product.slug === 'chaise-pliante');
    expect(chair?.reason.toLowerCase()).toContain('optionnel');
    expect(selection.totalWeightGrams).toBe(200 + 90 + 150 + 200 + 800);
  });

  it('partage abri / cuisine et met l’eau à la quantité par personne', () => {
    const selection = selectKitProducts(
      input({ activity: 'bivouac', durationDays: 3, partySize: 4 }),
      CATALOGUE
    );

    const tent = selection.items.find((item) => item.product.slug === 'tente-2p');
    expect(tent?.ownership).toBe('shared');
    expect(tent?.quantity).toBe(1);

    const stove = selection.items.find((item) => item.product.slug === 'rechaud');
    expect(stove?.ownership).toBe('shared');
    expect(stove?.quantity).toBe(1);

    const bottle = selection.items.find((item) => item.product.slug === 'bouteille-eau');
    expect(bottle?.ownership).toBe('personal');
    expect(bottle?.quantity).toBe(4);
  });

  it('ajoute « Protection froid » en saison hivernale avec raison traçable', () => {
    const summer = selectKitProducts(input(), CATALOGUE);
    expect(summer.items.some((item) => item.product.slug === 'gants-froid')).toBe(false);

    const winter = selectKitProducts(input({ season: 'hiver' }), CATALOGUE);
    const gloves = winter.items.find((item) => item.product.slug === 'gants-froid');
    expect(gloves).toBeDefined();
    expect(gloves?.reason.toLowerCase()).toContain('hiver');
  });

  it('ajoute les bâtons uniquement quand D+ ≥ 800 m (jamais les crampons homonymes)', () => {
    const flat = selectKitProducts(input({ elevationGainM: 300 }), CATALOGUE);
    expect(flat.items.some((item) => item.product.slug === 'batons-trekking')).toBe(false);

    const steep = selectKitProducts(input({ elevationGainM: 1200 }), CATALOGUE);
    const poles = steep.items.find((item) => item.product.slug === 'batons-trekking');
    expect(poles).toBeDefined();
    expect(poles?.reason).toContain('800');
    expect(steep.items.some((item) => item.product.slug === 'crampons-baton')).toBe(false);
  });

  it('ajoute la protection des pieds quand la difficulté est hard/expert', () => {
    const easy = selectKitProducts(input({ difficulty: 'easy' }), CATALOGUE);
    expect(easy.items.some((item) => item.product.slug === 'semelles')).toBe(false);

    const hard = selectKitProducts(input({ difficulty: 'expert' }), CATALOGUE);
    expect(hard.items.some((item) => item.product.slug === 'semelles')).toBe(true);
  });

  it('ne retient les optionnels que si le budget de poids le permet', () => {
    const light = selectKitProducts(input(), CATALOGUE);
    expect(light.items.some((item) => item.product.slug === 'chaise-pliante')).toBe(true);
    expect(light.items.some((item) => item.product.slug === 'valise-lourde')).toBe(false);
    expect(light.warnings.some((warning) => warning.toLowerCase().includes('optionnel'))).toBe(true);
  });

  it('calcule le poids total réel (Σ poids × quantité)', () => {
    const selection = selectKitProducts(
      input({ activity: 'bivouac', durationDays: 3, partySize: 2 }),
      CATALOGUE
    );
    const expected = selection.items.reduce(
      (total, item) => total + (item.product.weightGrams ?? 0) * item.quantity,
      0
    );
    expect(selection.totalWeightGrams).toBe(expected);
    // 200 + 90 + 150 + 200×2 + 2000 + 300 + 800 (chaise) = 3940
    expect(selection.totalWeightGrams).toBe(3940);
  });

  it('avertit quand une catégorie indispensable manque au catalogue', () => {
    const partial = CATALOGUE.filter((entry) => entry.category !== 'Hydratation');
    const selection = selectKitProducts(input(), partial);

    expect(selection.warnings.some((warning) => warning.includes('Hydratation'))).toBe(true);
    expect(selection.items.some((item) => item.product.slug === 'bouteille-eau')).toBe(false);
  });

  it('est déterministe et ignore les poids inconnus dans le total', () => {
    const catalogue = [...CATALOGUE, product({ slug: 'sifflet', name: 'Sifflet', weightGrams: null })];
    const run1 = JSON.stringify(selectKitProducts(input(), catalogue));
    const run2 = JSON.stringify(selectKitProducts(input(), catalogue));
    expect(run1).toBe(run2);
    const selection = selectKitProducts(input(), catalogue);
    expect(selection.totalWeightGrams).toBe(200 + 90 + 150 + 200 + 800);
  });
});
