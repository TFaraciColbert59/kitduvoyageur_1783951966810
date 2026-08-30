import { describe, it, expect } from 'vitest';
import {
  calculateWeightBreakdown,
  calculatePreparationStats,
} from '@/features/preparation/services/weightCalculator';
import {
  calculateDogMaxPackWeight,
  calculateDogWaterRation,
  calculateDogFoodRation,
  calculateParticipantLoads,
} from '@/features/preparation/services/loadDistribution';
import {
  identifyDuplicates,
  identifyMissingVitals,
  identifyHeavyItems,
  generateShakedownReport,
  detectGearGaps,
} from '@/features/preparation/services/gearGapEngine';
import type { GearItem, HumanParticipant, DogParticipant } from '@/features/preparation/types/preparation.types';

describe('Weight Calculator Service', () => {
  const sampleItems: GearItem[] = [
    {
      id: 'item-1',
      name: 'Tente 2P',
      weightGrams: 1800,
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
      name: 'Veste Imperméable',
      weightGrams: 400,
      category: 'clothing',
      status: 'packed',
      isPrivate: false,
      isWorn: true, // Worn
      isConsumable: false,
      isVital: false,
      quantity: 1,
    },
    {
      id: 'item-3',
      name: 'Eau (1.5L)',
      weightGrams: 1500,
      category: 'water',
      status: 'packed',
      isPrivate: false,
      isWorn: false,
      isConsumable: true, // Consumable
      isVital: true,
      quantity: 1,
    },
    {
      id: 'item-4',
      name: 'Popote Titane',
      weightGrams: 200,
      category: 'cook',
      status: 'to_buy', // Not packed yet
      isPrivate: false,
      isWorn: false,
      isConsumable: false,
      isVital: false,
      quantity: 1,
    },
  ];

  it('calcule correctement le Base Weight, Worn et Consumables sans double comptage', () => {
    const breakdown = calculateWeightBreakdown(sampleItems);

    expect(breakdown.baseWeightGrams).toBe(1800); // Tente
    expect(breakdown.wornWeightGrams).toBe(400); // Veste
    expect(breakdown.consumableWeightGrams).toBe(1500); // Eau
    expect(breakdown.totalPackWeightGrams).toBe(3300); // 1800 + 1500
    expect(breakdown.totalWeightGrams).toBe(3700); // 1800 + 1500 + 400
    expect(breakdown.mulCategory).toBe('ultralight'); // < 4500g
  });

  it('calcule la progression et le score de complétude', () => {
    const stats = calculatePreparationStats(sampleItems, [
      {
        id: 'h1',
        type: 'human',
        publicData: { id: 'h1', firstName: 'Alex', packWeightKg: 5, fitnessScore: 85, role: 'guide' },
        privateData: { bloodType: 'O+', allergies: [], iceContact: { name: 'Claire', phone: '06', relationship: 'Conjointe' } },
        isUnlocked: false,
      },
    ]);

    expect(stats.totalCount).toBe(4);
    expect(stats.packedCount).toBe(3);
    expect(stats.toBuyCount).toBe(1);
    expect(stats.checklistProgress).toBe(75); // 3/4
    expect(stats.overallScore).toBeGreaterThan(60);
  });
});

describe('Load Distribution & Dog Care Service', () => {
  it('respecte la règle des 15% de portage canin', () => {
    expect(calculateDogMaxPackWeight(20)).toBe(3.0);
    expect(calculateDogMaxPackWeight(30)).toBe(4.5);
    expect(calculateDogMaxPackWeight(0)).toBe(0);
  });

  it('calcule la ration d eau pour chien avec météo et dénivelé', () => {
    const normal = calculateDogWaterRation(20, 500, 20); // 20 * 0.05 + 5 * 0.02 = 1.0 + 0.1 = 1.1L
    expect(normal).toBe(1.1);

    const heatWave = calculateDogWaterRation(20, 500, 28); // 1.1 * 1.2 = 1.32L
    expect(heatWave).toBe(1.32);
  });

  it('calcule la ration de nourriture pour chien actif', () => {
    expect(calculateDogFoodRation(25, true)).toBe(700); // 25 * 28g
    expect(calculateDogFoodRation(25, false)).toBe(550); // 25 * 22g
  });

  it('calcule la répartition de charge individuelle et détecte la surcharge', () => {
    const humans: HumanParticipant[] = [
      {
        id: 'h1',
        type: 'human',
        publicData: { id: 'h1', firstName: 'Alex', bodyWeightKg: 70, packWeightKg: 12, fitnessScore: 90, role: 'guide' },
        privateData: { bloodType: 'O+', allergies: [], iceContact: { name: 'C', phone: '06', relationship: 'C' } },
        isUnlocked: false,
      },
    ];

    const dogs: DogParticipant[] = [
      {
        id: 'd1',
        type: 'dog',
        name: 'Taïga',
        breed: 'Aussie',
        weightKg: 20,
        isCarryingPack: true,
        packWeightKg: 3.5, // > 15% (3.0kg) -> Overloaded!
        maxCarryingCapacityKg: 3.0,
        waterRationLitersPerDay: 1.1,
        foodRationGramsPerDay: 560,
      },
    ];

    const loads = calculateParticipantLoads([], humans, dogs);
    expect(loads.length).toBe(2);

    const humanLoad = loads.find((l) => l.participantId === 'h1');
    expect(humanLoad?.isOverloaded).toBe(false); // 12kg <= 14kg (20% of 70kg)

    const dogLoad = loads.find((l) => l.participantId === 'd1');
    expect(dogLoad?.isOverloaded).toBe(true); // 3.5kg > 3.0kg
  });
});

describe('Gear Gap & Shakedown Engine', () => {
  const itemsWithGaps: GearItem[] = [
    {
      id: 'g1',
      name: 'Tente Dôme 3 Places',
      weightGrams: 2900, // Very heavy shelter
      category: 'shelter',
      status: 'packed',
      isPrivate: false,
      isWorn: false,
      isConsumable: false,
      isVital: false,
      quantity: 1,
    },
    {
      id: 'g2',
      name: 'Couteau suisse',
      weightGrams: 120,
      category: 'misc',
      status: 'packed',
      isPrivate: false,
      isWorn: false,
      isConsumable: false,
      isVital: false,
      quantity: 2, // Duplicate
    },
  ];

  it('détecte les doublons', () => {
    const dups = identifyDuplicates(itemsWithGaps);
    expect(dups.length).toBe(1);
    expect(dups[0]).toContain('Doublon détecté');
  });

  it('détecte les objets lourds avec seuil', () => {
    const heavy = identifyHeavyItems(itemsWithGaps);
    expect(heavy.length).toBe(1);
    expect(heavy[0].name).toBe('Tente Dôme 3 Places');
  });

  it('détecte les équipements vitaux manquants (Gear Gaps)', () => {
    const missing = identifyMissingVitals(itemsWithGaps);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.some((m) => m.includes('secours') || m.includes('frontale'))).toBe(true);
  });

  it('génère un rapport Shakedown complet avec score et recommandations LKDV', () => {
    const report = generateShakedownReport(itemsWithGaps);
    expect(report.score).toBeLessThan(80);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.potentialWeightSavedGrams).toBeGreaterThan(0);
  });
});
