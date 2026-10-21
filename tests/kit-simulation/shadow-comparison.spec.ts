import { describe, expect, it } from 'vitest';
import {
  optimize,
  type Conditions,
  type Limits,
  type Option,
  type Requirement,
  type Slot,
} from '@/features/kit-simulation/core';
import {
  calculateWeightBreakdown as shakedownBreakdown,
  type GearItem,
} from '@/features/materiel/domain/shakedownEngine';
import {
  calcBaseWeight,
  calcConsumablesWeight,
  calcWornWeight,
} from '@/features/materiel/domain/departCalculations';
import { computeKitWeight } from '@/features/trips/engine/contextualKitEngine';
import { analyzeKit } from '@/lib/ai/configuratorCore';
import type { ChecklistItem } from '@/features/materiel/types/trekHub';
import type { TripItem } from '@/features/trips/types/trip.types';

/**
 * KIT-002 — Comparaison fantôme (dossier maître §8, étape 2).
 * Le noyau kit-simulation et les quatre moteurs historiques tournent sur les
 * mêmes scénarios synthétiques, hors ligne. Chaque divergence observée est
 * ATTRIBUÉE dans le test qui l'expose : correction de sémantique, donnée
 * inconnue, changement de règle ou comportement historique conservé.
 * Aucun moteur historique n'est modifié par cette comparaison.
 */

const now = '2026-10-18T12:00:00Z';

const conditions: Conditions = {
  accommodation: 'hotel',
  cooking: false,
  naturalWater: false,
  minTempC: null,
  minimumPadR: null,
  coldMarginC: 3,
};

const limits: Limits = {
  mode: 'balanced',
  budgetCents: 10000,
  packWeightG: 10000,
  packedVolumeMl: 50000,
  beamWidth: 64,
  candidatesPerSlot: 16,
};

function opt(slot: Slot, id: string, weightG: number | null, overrides: Partial<Option> = {}): Option {
  return {
    id,
    spec: {
      productId: '00000000-0000-4000-8000-000000000001',
      slot,
      name: `Fixture ${id}`,
      weightG,
      volumeMl: 1000,
      comfortC: null,
      rValue: null,
      verified: true,
    },
    source: 'owned',
    priceCents: 0,
    currency: 'EUR',
    availableUnits: 1,
    validUntil: '2026-10-19T12:00:00Z',
    measuredWeightG: null,
    worn: false,
    ...overrides,
  };
}

function gearItem(id: string, weightGrams: number, overrides: Partial<GearItem> = {}): GearItem {
  return { id, name: `Fixture ${id}`, weightGrams, category: 'misc', status: 'packed', ...overrides };
}

function checklistItem(
  id: string,
  weightG: number,
  overrides: Partial<ChecklistItem> = {}
): ChecklistItem {
  return { id, name: `Fixture ${id}`, category: null, weight_g: weightG, is_checked: true, ...overrides };
}

function tripItem(id: string, weightG: number | null, overrides: Partial<TripItem> = {}): TripItem {
  return {
    id,
    trip_id: 'trip-fixture',
    item_name: `Fixture ${id}`,
    category: null,
    quantity: 1,
    weight_grams: weightG,
    is_packed: true,
    status: 'packed',
    packed_by: null,
    inventory_item_id: null,
    affiliate_link_id: null,
    created_at: '2026-10-18T00:00:00Z',
    updated_at: '2026-10-18T00:00:00Z',
    ...overrides,
  };
}

const fourSlots: Requirement[] = [
  { slot: 'pack', quantity: 1 },
  { slot: 'bag', quantity: 1 },
  { slot: 'water_container', quantity: 1 },
  { slot: 'light', quantity: 1 },
];

describe('C1 — masse connue complète : accord des quatre moteurs', () => {
  it('même somme pour 1200 + 900 + 100 + 50 g', () => {
    const kernel = optimize(
      [
        opt('pack', 'pack', 1200),
        opt('bag', 'bag', 900),
        opt('water_container', 'bottle', 100),
        opt('light', 'lamp', 50),
      ],
      fourSlots,
      conditions,
      limits,
      now,
      0
    );
    const shakedown = shakedownBreakdown([
      gearItem('pack', 1200),
      gearItem('bag', 900),
      gearItem('bottle', 100),
      gearItem('lamp', 50),
    ]);
    const depart = calcBaseWeight([
      checklistItem('pack', 1200),
      checklistItem('bag', 900),
      checklistItem('bottle', 100),
      checklistItem('lamp', 50),
    ]);
    const contextual = computeKitWeight([
      tripItem('pack', 1200),
      tripItem('bag', 900),
      tripItem('bottle', 100),
      tripItem('lamp', 50),
    ]);

    // Attribution : aucune divergence sur données complètes — les quatre
    // implémentations s'accordent sur l'arithmétique connue.
    expect(kernel.packWeightG).toBe(2250);
    expect(kernel.coverage).toBe('complete');
    expect(shakedown.baseWeightGrams).toBe(2250);
    expect(depart).toBe(2250);
    expect(contextual.baseWeightGrams).toBe(2250);
  });
});

describe('C2 — quantités : divergence historique attribuée', () => {
  it('checklist historique ne multiplie pas, le noyau et le contextual si', () => {
    const kernel = optimize(
      [opt('water_container', 'bottle', 100, { availableUnits: 2 })],
      [{ slot: 'water_container', quantity: 2 }],
      conditions,
      limits,
      now,
      0
    );
    const shakedown = shakedownBreakdown([gearItem('bottle', 100, { quantity: 2 })]);
    const depart = calcBaseWeight([checklistItem('bottle', 100, { quantity: 2 })]);
    const contextual = computeKitWeight([tripItem('bottle', 100, { quantity: 2 })]);

    // Attribution : le noyau, le shakedown et le contextual multiplient par la
    // quantité (200 g) ; la checklist de départ (departCalculations) ignore la
    // quantité (100 g) — comportement historique conservé, la quantité est
    // gérée ailleurs. C'est le type d'écart que le dossier §8 anticipe
    // (« une égalité totale n'est pas attendue »).
    expect(kernel.packWeightG).toBe(200);
    expect(shakedown.baseWeightGrams).toBe(200);
    expect(contextual.baseWeightGrams).toBe(200);
    expect(depart).toBe(100);
  });
});

describe('C3 — poids inconnu : zéro silencieux vs inconnue exposée', () => {
  it('seul le noyau et le contextual signalent l’inconnue', () => {
    const kernel = optimize(
      [opt('pack', 'pack', 1200), opt('light', 'lamp', null)],
      [
        { slot: 'pack', quantity: 1 },
        { slot: 'light', quantity: 1 },
      ],
      conditions,
      limits,
      now,
      0
    );
    const shakedown = shakedownBreakdown([gearItem('pack', 1200), gearItem('lamp', 0)]);
    const depart = calcBaseWeight([checklistItem('pack', 1200), checklistItem('lamp', 0)]);
    const contextual = computeKitWeight([tripItem('pack', 1200), tripItem('lamp', null)]);

    // Attribution : avec un poids inconnu, le noyau publie null + une somme
    // connue partielle (knownPackWeightG) ; le contextual compte l'article non
    // pesé ('incomplet'). Les deux historiques par zéro (shakedown, checklist)
    // assimilent silencieusement l'inconnue à 0 g — écart E03/E10 documenté au
    // dossier, non corrigé ici pour préserver les appelants.
    expect(kernel.packWeightG).toBeNull();
    expect(kernel.knownPackWeightG).toBe(1200);
    expect(kernel.warnings.some((w) => w.includes('Poids manquant'))).toBe(true);
    expect(contextual.unweighedItemsCount).toBe(1);
    expect(contextual.weightCategory).toBe('incomplet');
    expect(shakedown.baseWeightGrams).toBe(1200);
    expect(depart).toBe(1200);
  });
});

describe('C4 — porté : accord sur la séparation dos/porté', () => {
  it('800 g portés exclus du dos dans les quatre moteurs', () => {
    const kernel = optimize(
      [opt('pack', 'shoes', 800, { worn: true })],
      [{ slot: 'pack', quantity: 1 }],
      conditions,
      limits,
      now,
      0
    );
    const shakedown = shakedownBreakdown([gearItem('shoes', 800, { isWorn: true })]);
    const depart = calcWornWeight([checklistItem('shoes', 800, { is_worn: true })]);
    const contextual = computeKitWeight([tripItem('shoes', 800, { is_worn: true })]);

    // Attribution : aucune divergence sémantique — tous excluent le porté de la
    // charge au dos et l'exposent séparément.
    expect(kernel.packWeightG).toBe(0);
    expect(kernel.wornWeightG).toBe(800);
    expect(shakedown.baseWeightGrams).toBe(0);
    expect(shakedown.wornWeightGrams).toBe(800);
    expect(depart).toBe(800);
    expect(contextual.wornWeightGrams).toBe(800);
  });
});

describe('C5 — classification MUL : deux barèmes historiques incompatibles', () => {
  it('4800 g : light (shakedown) vs ultralight (contextual)', () => {
    const shakedown = shakedownBreakdown([gearItem('pack', 4800)]);
    const contextual = computeKitWeight([tripItem('pack', 4800)]);

    // Attribution : seuils différents — shakedown 4500/9000, contextual
    // 5000/8000/12000. Le noyau ne reprend AUCUN badge (dossier §10) : ce test
    // prouve que les deux classifications coexistent et divergent.
    expect(shakedown.mulCategory).toBe('light');
    expect(contextual.weightCategory).toBe('ultralight');
  });

  it('10000 g : traditional (shakedown) vs standard (contextual)', () => {
    const shakedown = shakedownBreakdown([gearItem('pack', 10000)]);
    const contextual = computeKitWeight([tripItem('pack', 10000)]);

    expect(shakedown.mulCategory).toBe('traditional');
    expect(contextual.weightCategory).toBe('standard');
  });
});

describe('C6 — sac vide : trois comportements historiques distincts', () => {
  it('badge optimiste, none, et besoin structuré', () => {
    const kernel = optimize([], [{ slot: 'pack', quantity: 1 }], conditions, limits, now, 0);
    const shakedown = shakedownBreakdown([]);
    const contextual = computeKitWeight([]);

    // Attribution : shakedown classe un sac vide en « ultralight » (constat du
    // dossier §10) ; le contextual a corrigé ce cas ('none') ; le noyau expose
    // un manque structuré et n'accorde aucun badge.
    expect(shakedown.baseWeightGrams).toBe(0);
    expect(shakedown.mulCategory).toBe('ultralight');
    expect(contextual.weightCategory).toBe('none');
    expect(kernel.coverage).toBe('incomplete');
    expect(kernel.missing).toEqual(['pack']);
  });
});

describe('C7 — consommables : inconnue explicite vs estimation constante', () => {
  it('consommables null : le noyau refuse un total exact, la checklist affirme 0', () => {
    const kernel = optimize([opt('pack', 'pack', 1200)], [{ slot: 'pack', quantity: 1 }], conditions, limits, now, null);
    const depart = calcConsumablesWeight([checklistItem('pack', 1200)], null);

    // Attribution : E10 — le noyau conserve l'inconnue (packWeightG null) ; la
    // checklist retourne 0 sans signal.
    expect(kernel.packWeightG).toBeNull();
    expect(depart).toBe(0);
  });

  it('2 L d’eau : le noyau exige des grammes, la checklist invente 1000 g/L', () => {
    const kernel = optimize([opt('pack', 'pack', 1200)], [{ slot: 'pack', quantity: 1 }], conditions, limits, now, 2000);
    const depart = calcConsumablesWeight([checklistItem('pack', 1200)], { water: 2 });

    // Attribution : la checklist convertit 2 L en 2000 g via la constante
    // non contextualisée 1000 g/L (dossier E10) ; le noyau ne convertit
    // jamais — les grammes de consommables sont une entrée explicite. Résultat
    // identique ici par coïncidence de la constante, divergence de contrat.
    expect(kernel.packWeightG).toBe(3200);
    expect(depart).toBe(2000);
  });
});

describe('C8 — besoins : slot structuré vs produit de catalogue réel', () => {
  it('catalogue vide : le noyau liste les manques, le configurateur n’invente rien', () => {
    const kernel = optimize([], [{ slot: 'pack', quantity: 1 }], conditions, limits, now, 0);
    const config = analyzeKit({
      catalog: [],
      ownedItems: [],
      weatherKey: 'sec_chaud',
      durationKey: '3-5d',
    });

    // Attribution : rôles complémentaires, pas une contradiction — le noyau
    // publie le besoin (slot) sans produit (« never fabricates » côté
    // configurateur, slots côté noyau). Le score du configurateur est une
    // heuristique de préparation, jamais une couverture de besoins.
    expect(kernel.missing).toEqual(['pack']);
    expect(config.missingItems).toEqual([]);
    expect(config.preparationScore).toBe(40);
  });
});

describe('C9 — prix : cents entiers vs euros flottants', () => {
  it('le noyau calcule en cents, le configurateur en euros décimaux', () => {
    const kernel = optimize(
      [opt('pack', 'pack', 1200, { source: 'new', priceCents: 4999 })],
      [{ slot: 'pack', quantity: 1 }],
      conditions,
      limits,
      now,
      0
    );
    const config = analyzeKit({
      catalog: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          slug: 'sac-fixture',
          name: 'Sac à dos fixture',
          brand: 'Fixture',
          category: 'Sacs à dos',
          priceEur: 49.99,
          weightGrams: 1300,
          image: '',
          stock: 3,
        },
      ],
      ownedItems: [],
      weatherKey: 'sec_chaud',
      durationKey: '3-5d',
    });

    // Attribution : unités différentes — cents entiers sans flottant dans le
    // noyau (dossier §7) ; euros décimaux côté configurateur. Conversion à la
    // frontière d'affichage, jamais dans le moteur.
    expect(kernel.costCents).toBe(4999);
    expect(Number.isInteger(kernel.costCents)).toBe(true);
    expect(config.totalMissingPriceEur).toBeCloseTo(49.99, 2);
  });
});
