import { describe, it, expect } from 'vitest';
import { GearItem } from '../src/features/gear/types/gear.types';
import {
  calculateWeightBreakdown,
  identifyDuplicates,
  identifyMissingVitals,
  identifyHeavyItems,
  generateShakedownReport,
} from '../src/features/gear/services/shakedownEngine';
import { useGearStore } from '../src/features/gear/stores/useGearStore';

const SAMPLE_ITEMS: GearItem[] = [
  {
    id: 'item-1',
    name: 'Tente 2P',
    weightGrams: 2200,
    category: 'shelter',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
  },
  {
    id: 'item-2',
    name: 'Sac de couchage',
    weightGrams: 1100,
    category: 'sleep',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
  },
  {
    id: 'item-3',
    name: 'Chaussures de trail',
    weightGrams: 900,
    category: 'clothing',
    status: 'packed',
    isPrivate: false,
    isWorn: true, // Worn
    isConsumable: false,
    isVital: false,
    quantity: 1,
  },
  {
    id: 'item-4',
    name: 'Lyophilisés 3 repas',
    weightGrams: 600,
    category: 'cook',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: true, // Consumable
    isVital: false,
    quantity: 1,
  },
  {
    id: 'item-5',
    name: 'Boussole de rechange',
    weightGrams: 50,
    category: 'misc',
    status: 'to_buy', // Not packed
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
  },
];

describe('Gear Feature — Base Weight & Arithmetic Calculations', () => {
  it('TEST-GEAR-01: calculates Base Weight strictly excluding worn items, consumables, and unpacked gear', () => {
    const breakdown = calculateWeightBreakdown(SAMPLE_ITEMS);

    // Base weight = Tente (2200) + Sac de couchage (1100) = 3300g (3.3kg)
    expect(breakdown.baseWeightGrams).toBe(3300);

    // Consumables = 600g
    expect(breakdown.consumableWeightGrams).toBe(600);

    // Worn = 900g
    expect(breakdown.wornWeightGrams).toBe(900);

    // Pack Weight = Base (3300) + Consumables (600) = 3900g
    expect(breakdown.totalPackWeightGrams).toBe(3900);

    // Total Weight = 3300 + 600 + 900 = 4800g
    expect(breakdown.totalWeightGrams).toBe(4800);

    // MUL Category: Base < 4.5kg => ultralight
    expect(breakdown.mulCategory).toBe('ultralight');
  });

  it('TEST-GEAR-02: classifies heavier base weights correctly', () => {
    const heavyItems: GearItem[] = [
      {
        id: 'h1',
        name: 'Tente 4P',
        weightGrams: 5000,
        category: 'shelter',
        status: 'packed',
        isPrivate: false,
        isWorn: false,
        isConsumable: false,
        isVital: false,
        quantity: 1,
      },
      {
        id: 'h2',
        name: 'Sac à dos lourd',
        weightGrams: 4500,
        category: 'misc',
        status: 'packed',
        isPrivate: false,
        isWorn: false,
        isConsumable: false,
        isVital: false,
        quantity: 1,
      },
    ];

    const breakdown = calculateWeightBreakdown(heavyItems);
    expect(breakdown.baseWeightGrams).toBe(9500);
    expect(breakdown.mulCategory).toBe('traditional');
  });
});

describe('Gear Feature — Shakedown Engine', () => {
  it('TEST-GEAR-03: identifies missing vital survival gear', () => {
    // Missing all required vitals (secours, couverture, frontale, filtre, sifflet)
    const missing = identifyMissingVitals(SAMPLE_ITEMS);
    expect(missing.length).toBeGreaterThanOrEqual(4);
    expect(missing.some((m) => m.toLowerCase().includes('secours'))).toBe(true);
    expect(missing.some((m) => m.toLowerCase().includes('filtre'))).toBe(true);
  });

  it('TEST-GEAR-04: detects duplicate redundant items', () => {
    const duplicateItems: GearItem[] = [
      ...SAMPLE_ITEMS,
      {
        id: 'dup-1',
        name: 'Tente 2P',
        weightGrams: 2200,
        category: 'shelter',
        status: 'packed',
        isPrivate: false,
        isWorn: false,
        isConsumable: false,
        isVital: false,
        quantity: 1,
      },
    ];

    const duplicates = identifyDuplicates(duplicateItems);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0]).toContain('Tente 2P');
  });

  it('TEST-GEAR-05: detects heavy items exceeding category thresholds', () => {
    const heavy = identifyHeavyItems(SAMPLE_ITEMS);
    // Tente is 2200g (threshold for shelter is 1600g)
    expect(heavy.length).toBe(1);
    expect(heavy[0].name).toBe('Tente 2P');
    expect(heavy[0].weightGrams).toBe(2200);
  });

  it('TEST-GEAR-06: generates actionable shakedown report with optimization recommendations', () => {
    const report = generateShakedownReport(SAMPLE_ITEMS);
    expect(report.score).toBeLessThan(100);
    expect(report.heavyItemWarnings.length).toBe(1);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.potentialWeightSavedGrams).toBeGreaterThan(0);
  });
});

describe('Gear Feature — Zustand Store Mutations', () => {
  it('TEST-GEAR-07: toggles worn state and moves weight dynamically', () => {
    const store = useGearStore.getState();
    const item = store.items.find((i) => i.status === 'packed' && !i.isConsumable);
    if (!item) return;

    const initialBreakdown = store.getWeightBreakdown();
    const initialBase = initialBreakdown.baseWeightGrams;

    // Toggle item to worn
    store.toggleItemWorn(item.id);
    const afterWorn = store.getWeightBreakdown();
    expect(afterWorn.baseWeightGrams).toBe(initialBase - item.weightGrams);
    expect(afterWorn.wornWeightGrams).toBe(initialBreakdown.wornWeightGrams + item.weightGrams);

    // Toggle back
    store.toggleItemWorn(item.id);
    const restored = store.getWeightBreakdown();
    expect(restored.baseWeightGrams).toBe(initialBase);
  });
});
