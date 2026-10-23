import { describe, expect, it } from 'vitest';
import type { CompasKitLine } from '../../engine/compasModel';
import type { KitAdvice } from '../../engine/kitRules';
import type { MyKit } from '../../engine/kitApply';
import type { CompasShopProduct } from '../../server/getCompasData';
import {
  adaptations,
  buyStage,
  carryView,
  groupLines,
  itemIcon,
  itemPhoto,
  itemState,
  kitSummary,
  myLines,
  restorablePurchaseState,
  shopProductFor,
  stateEditable,
  viewerCapacityKg,
  weightGroup,
  weightRing,
} from '../model/sac';
import { makeData, U } from './fixtures';

function line(p: Partial<CompasKitLine> & { id: string; name: string }): CompasKitLine {
  return {
    category: null,
    weightGrams: null,
    quantity: 1,
    packed: false,
    vital: false,
    kind: 'base',
    shared: false,
    ownerId: U.tony,
    inventoryItemId: null,
    lent: false,
    status: 'missing',
    reason: null,
    shopProductId: null,
    purchaseState: null,
    condition: null,
    ...p,
  };
}

describe('weightGroup', () => {
  it('lit la catégorie enregistrée (français, anglais, accents)', () => {
    expect(weightGroup('porter', 'x')).toBe('porter');
    expect(weightGroup('vêtements', 'x')).toBe('vetements');
    expect(weightGroup('clothing', 'x')).toBe('vetements');
    expect(weightGroup('safety', 'x')).toBe('securite');
    expect(weightGroup('Sécurité', 'x')).toBe('securite');
    expect(weightGroup('sleep', 'x')).toBe('dormir');
    expect(weightGroup('shelter', 'x')).toBe('dormir');
    expect(weightGroup('water', 'x')).toBe('eau');
    expect(weightGroup('cook', 'x')).toBe('eau');
  });

  it('retombe sur le nom quand la catégorie ne dit rien, sinon « autre »', () => {
    expect(weightGroup('tech', 'Frontale')).toBe('securite');
    expect(weightGroup('misc', 'Drap de sac')).toBe('dormir');
    expect(weightGroup(null, 'Sac à dos 38 L')).toBe('porter');
    expect(weightGroup('misc', 'Appareil photo')).toBe('autre');
  });
});

describe('itemIcon', () => {
  it('donne une illustration sobre selon le nom, puis la catégorie', () => {
    expect(itemIcon(line({ id: 'a', name: 'Bâtons de marche' }))).toBe('poles');
    expect(itemIcon(line({ id: 'a', name: 'Trousse de secours' }))).toBe('cross');
    expect(itemIcon(line({ id: 'a', name: 'Appareil photo', category: 'misc' }))).toBe('box');
    expect(itemIcon(line({ id: 'a', name: 'Truc', category: 'clothing' }))).toBe('shirt');
  });
});

describe('myLines', () => {
  const members = new Set([U.tony, U.claire]);
  const lines = [
    line({ id: 'perso', name: 'Veste' }),
    line({ id: 'autre', name: 'Veste de Claire', ownerId: U.claire }),
    line({ id: 'sans-porteur', name: 'Gourde', ownerId: null }),
    line({ id: 'commun-moi', name: 'Tente', shared: true, ownerId: U.tony }),
    line({ id: 'commun-autre', name: 'Réchaud', shared: true, ownerId: U.claire }),
    line({ id: 'commun-libre', name: 'Corde', shared: true, ownerId: null }),
    line({ id: 'porte', name: 'Chapeau', kind: 'worn' }),
  ];
  it('garde mes affaires, le commun qui m’est confié, ni le porté sur soi ni les affaires des autres', () => {
    expect(myLines(lines, U.tony, members).map((l) => l.id)).toEqual(['perso', 'sans-porteur', 'commun-moi']);
  });
  it('sans personne connectée, seules les affaires sans propriétaire sont comptées', () => {
    expect(myLines(lines, null, members).map((l) => l.id)).toEqual(['sans-porteur']);
  });
});

describe('weightRing', () => {
  it('somme par catégorie et dit les poids inconnus au lieu de les compter zéro', () => {
    const ring = weightRing(
      [
        line({ id: '1', name: 'Sac à dos', category: 'porter', weightGrams: 1000 }),
        line({ id: '2', name: 'Veste', category: 'vetements', weightGrams: 300, quantity: 2 }),
        line({ id: '3', name: 'Mystère', category: 'misc' }),
      ],
      null
    );
    expect(ring.totalG).toBe(1600);
    expect(ring.unknownWeightCount).toBe(1);
    expect(ring.segments.map((s) => [s.group, s.grams])).toEqual([
      ['porter', 1000],
      ['vetements', 600],
    ]);
    expect(ring.capacityG).toBeNull();
    expect(ring.segments.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 5);
    expect(ring.over).toBe(false);
  });

  it('prend la capacité pour échelle et signale un dépassement', () => {
    const ring = weightRing([line({ id: '1', name: 'Tente', category: 'dormir', weightGrams: 2000 })], 1.5);
    expect(ring.capacityG).toBe(1500);
    expect(ring.over).toBe(true);
    expect(ring.segments[0].share).toBe(1);
    const under = weightRing([line({ id: '1', name: 'Tente', category: 'dormir', weightGrams: 750 })], 1.5);
    expect(under.segments[0].share).toBeCloseTo(0.5, 5);
    expect(under.over).toBe(false);
  });

  it('un sac sans aucun poids connu est vide, pas égal à zéro kilo trompeur', () => {
    const ring = weightRing([line({ id: '1', name: 'X' })], null);
    expect(ring.totalG).toBe(0);
    expect(ring.segments).toEqual([]);
    expect(ring.unknownWeightCount).toBe(1);
  });
});

describe('viewerCapacityKg', () => {
  it('lit la fiche du membre, sinon le poids max du voyage, sinon rien', () => {
    const data = makeData();
    expect(viewerCapacityKg(data.model, U.tony)).toBe(14);
    expect(viewerCapacityKg(data.model, U.leo)).toBeNull();
    const withMax = { ...data.model, preferences: { ...data.model.preferences, maxPackKg: 9 } };
    expect(viewerCapacityKg(withMax, U.leo)).toBe(9);
  });
});

describe('itemState', () => {
  it('traduit status et purchaseState existants', () => {
    expect(itemState(line({ id: 'a', name: 'a', status: 'owned' }), U.tony)).toBe('have');
    expect(itemState(line({ id: 'a', name: 'a', status: 'missing', purchaseState: 'added' }), U.tony)).toBe('have');
    expect(itemState(line({ id: 'a', name: 'a', status: 'missing', purchaseState: 'in_cart' }), U.tony)).toBe('buy');
    expect(itemState(line({ id: 'a', name: 'a', status: 'lent' }), U.tony)).toBe('lent');
    expect(itemState(line({ id: 'a', name: 'a', status: 'replace' }), U.tony)).toBe('replace');
  });
  it('« à emprunter » : un objet manquant confié à quelqu’un d’autre du groupe', () => {
    expect(itemState(line({ id: 'a', name: 'a', shared: true, ownerId: U.claire }), U.tony)).toBe('borrow');
    expect(itemState(line({ id: 'a', name: 'a', shared: true, ownerId: U.tony }), U.tony)).toBe('buy');
    expect(itemState(line({ id: 'a', name: 'a', shared: true, ownerId: null }), U.tony)).toBe('buy');
  });
  it('l’état ne se change pas ici pour un objet d’inventaire ou emballé, ni pour un objet prêté', () => {
    expect(stateEditable(line({ id: 'a', name: 'a', status: 'owned' }))).toBe(false);
    expect(stateEditable(line({ id: 'a', name: 'a', status: 'owned', purchaseState: 'added' }))).toBe(true);
    expect(stateEditable(line({ id: 'a', name: 'a', status: 'lent' }))).toBe(false);
    expect(stateEditable(line({ id: 'a', name: 'a', status: 'missing' }))).toBe(true);
  });
  it('étapes d’achat et état à rétablir', () => {
    expect(buyStage(line({ id: 'a', name: 'a', purchaseState: 'in_cart' }))).toBe('in_cart');
    expect(buyStage(line({ id: 'a', name: 'a', purchaseState: 'shipping' }))).toBe('shipping');
    expect(buyStage(line({ id: 'a', name: 'a', purchaseState: 'to_buy' }))).toBe('needed');
    expect(restorablePurchaseState({ purchaseState: 'shipping' })).toBe('shipping');
    expect(restorablePurchaseState({ purchaseState: 'owned' })).toBe('needed');
    expect(restorablePurchaseState({ purchaseState: null })).toBe('needed');
  });
});

describe('boutique : produit et photo', () => {
  const shop: CompasShopProduct[] = [
    { id: 'p1', slug: 's', mode: 'achat', name: 'Trousse de secours randonnée', brand: null, category: null, weightG: 260, priceEur: 24.9, pricePerDay: null, rating: null, reviewCount: null, image: 'https://img/trousse.jpg', imageAlt: 'Trousse rouge' },
    { id: 'p2', slug: 'b', mode: 'achat', name: 'Briquet Camping – Bâton Trekking', brand: null, category: null, weightG: 100, priceEur: 5, pricePerDay: null, rating: null, reviewCount: null, image: 'https://img/briquet.jpg', imageAlt: null },
  ];
  it('propose le produit pertinent du catalogue et rien d’autre', () => {
    const hit = shopProductFor(line({ id: 'a', name: 'Trousse de secours' }), shop);
    expect(hit?.product.id).toBe('p1');
    expect(hit?.linked).toBe(false);
    expect(shopProductFor(line({ id: 'a', name: 'Tente 2 places' }), shop)).toBeNull();
  });
  it('la photo vient du produit lié au catalogue, jamais d’un produit qui contredit l’objet', () => {
    expect(itemPhoto(line({ id: 'a', name: 'Trousse de secours', shopProductId: 'p1' }), shop)).toEqual({ src: 'https://img/trousse.jpg', alt: 'Trousse rouge' });
    expect(itemPhoto(line({ id: 'a', name: 'Bâtons de trekking', shopProductId: 'p2' }), shop)).toBeNull();
    expect(itemPhoto(line({ id: 'a', name: 'Trousse de secours' }), shop)).toBeNull();
  });
});

describe('adaptations', () => {
  const advice: KitAdvice[] = [
    { id: 'pluie', need: 'pluie', label: 'Veste imperméable', reason: '70 % de pluie le 4', source: 'MET Norway', covered: true, coveredBy: 'Veste' },
    { id: 'froid', need: 'froid', label: 'Couche chaude', reason: '0 °C le 4', source: 'MET Norway', covered: false, coveredBy: null },
  ];
  it('explique les objets ajoutés par leur raison et liste les conseils non couverts', () => {
    const a = adaptations(
      [
        line({ id: '1', name: 'Veste de pluie', reason: 'Averses le 4', weightGrams: 320 }),
        line({ id: '2', name: 'Trousse', reason: ' Vital ', weightGrams: null, vital: true }),
        line({ id: '3', name: 'Gourde', reason: '   ' }),
        line({ id: '4', name: 'Frontale' }),
      ],
      advice
    );
    expect(a.added.map((x) => x.lineId)).toEqual(['2', '1']);
    expect(a.added[1].reason).toBe('Averses le 4');
    expect(a.addedWeightG).toBe(320);
    expect(a.addedUnknownWeight).toBe(1);
    expect(a.advice.map((x) => x.adviceId)).toEqual(['froid']);
    expect(a.advice[0].source).toBe('MET Norway');
    expect(a.coveredAdvice).toBe(1);
    expect(a.totalAdvice).toBe(2);
  });
  it('rien à adapter quand il n’y a ni raison ni conseil', () => {
    const a = adaptations([line({ id: '1', name: 'Sac' })], []);
    expect(a.added).toEqual([]);
    expect(a.advice).toEqual([]);
  });
});

describe('groupLines', () => {
  it('range par catégorie dans l’ordre de l’anneau, vitaux d’abord', () => {
    const groups = groupLines([
      line({ id: '1', name: 'Frontale', category: 'safety' }),
      line({ id: '2', name: 'Sac à dos', category: 'porter' }),
      line({ id: '3', name: 'Trousse', category: 'safety', vital: true }),
    ]);
    expect(groups.map((g) => g.group)).toEqual(['porter', 'securite']);
    expect(groups[1].lines.map((l) => l.id)).toEqual(['3', '1']);
  });
});

describe('kitSummary', () => {
  const kit: MyKit = {
    id: 'k1',
    name: 'Rando 3 saisons',
    season: null,
    items: [
      { id: 'a', name: 'Veste de pluie', category: null, weightG: 300, quantity: 1, isVital: false, productOwnershipId: null },
      { id: 'b', name: 'Sifflet', category: null, weightG: null, quantity: 1, isVital: false, productOwnershipId: null },
      { id: 'c', name: 'Gourde', category: null, weightG: 100, quantity: 2, isVital: false, productOwnershipId: null },
    ],
  };
  it('compte les objets, le poids connu, les poids inconnus et ce qu’appliquer ajouterait', () => {
    const s = kitSummary(kit, ['veste DE pluie', 'Frontale']);
    expect(s.itemCount).toBe(3);
    expect(s.knownWeightG).toBe(500);
    expect(s.unknownWeightCount).toBe(1);
    expect(s.plan.alreadyThere).toBe(1);
    expect(s.plan.toAdd.map((i) => i.id)).toEqual(['b', 'c']);
  });
});

describe('carryView', () => {
  it('donne la charge de chaque membre, ses objets communs et le commun sans porteur', () => {
    const data = makeData();
    const view = carryView(data.model, data.model.kit.lines);
    expect(view.members.map((m) => m.name)).toEqual(['Tony', 'Claire', 'Léo', 'Maya']);
    expect(view.unassigned.map((l) => l.name)).toEqual(['Tente 2 places', 'Réchaud et popote']);
    expect(view.sharedCount).toBe(2);
    expect(view.members[0].capacityKg).toBe(14);
    expect(view.members[2].capacityKg).toBeNull();
  });
});
