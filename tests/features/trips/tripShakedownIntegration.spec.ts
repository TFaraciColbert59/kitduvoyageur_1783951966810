import { describe, it, expect } from 'vitest';
import {
  generateShakedownReport,
  calculateWeightBreakdown,
  identifyMissingVitals,
  identifyDuplicates,
  type GearItem,
} from '@/features/materiel/domain/shakedownEngine';
import type { TripItem } from '@/features/trips/types/trip.types';

describe('Hub Voyages — Intégration Shakedown Canonique & Inventaire Matériel', () => {
  const mockTripItems: TripItem[] = [
    {
      id: 'trip-item-1',
      trip_id: 'trip-123',
      item_name: 'Tente 2P Ultra-Légère',
      category: 'shelter',
      quantity: 1,
      weight_grams: 1450,
      is_packed: true,
      status: 'needed',
      packed_by: null,
      inventory_item_id: 'inv-item-abc-1', // Lié à l'inventaire physique
      affiliate_link_id: null,
      is_vital: false,
      is_worn: false,
      is_consumable: false,
      source: 'inventory',
      created_at: '2026-09-08T12:00:00Z',
      updated_at: '2026-09-08T12:00:00Z',
    },
    {
      id: 'trip-item-2',
      trip_id: 'trip-123',
      item_name: 'Veste Gore-Tex Pro',
      category: 'clothing',
      quantity: 1,
      weight_grams: 420,
      is_packed: true,
      status: 'needed',
      packed_by: null,
      inventory_item_id: 'inv-item-abc-2', // Lié à l'inventaire physique
      affiliate_link_id: null,
      is_vital: false,
      is_worn: true, // Porté sur soi
      is_consumable: false,
      source: 'inventory',
      created_at: '2026-09-08T12:00:00Z',
      updated_at: '2026-09-08T12:00:00Z',
    },
    {
      id: 'trip-item-3',
      trip_id: 'trip-123',
      item_name: 'Eau Minérale 1.5L',
      category: 'water',
      quantity: 2,
      weight_grams: 1500,
      is_packed: true,
      status: 'needed',
      packed_by: null,
      inventory_item_id: null,
      affiliate_link_id: null,
      is_vital: true,
      is_worn: false,
      is_consumable: true, // Consommable
      source: 'custom',
      created_at: '2026-09-08T12:00:00Z',
      updated_at: '2026-09-08T12:00:00Z',
    },
    {
      id: 'trip-item-4',
      trip_id: 'trip-123',
      item_name: 'Trousse de premiers secours',
      category: 'safety',
      quantity: 1,
      weight_grams: 180,
      is_packed: true,
      status: 'needed',
      packed_by: null,
      inventory_item_id: 'inv-item-abc-3',
      affiliate_link_id: null,
      is_vital: true,
      is_worn: false,
      is_consumable: false,
      source: 'inventory',
      created_at: '2026-09-08T12:00:00Z',
      updated_at: '2026-09-08T12:00:00Z',
    },
  ];

  it('TEST-Z3-01: convertit les items de voyage et calcule le Base Weight formel', () => {
    const gearItems: GearItem[] = mockTripItems.map((i) => ({
      id: i.id,
      name: i.item_name,
      weightGrams: i.weight_grams || 0,
      category: i.category || 'misc',
      status: i.is_packed ? 'packed' : 'to_buy',
      isWorn: i.is_worn ?? false,
      isConsumable: i.is_consumable ?? false,
      isVital: i.is_vital ?? false,
      quantity: i.quantity || 1,
    }));

    const breakdown = calculateWeightBreakdown(gearItems);

    // Base Weight = Tente (1450) + Trousse (180) = 1630g
    expect(breakdown.baseWeightGrams).toBe(1630);
    // Consumables = 2x 1500g = 3000g
    expect(breakdown.consumableWeightGrams).toBe(3000);
    // Worn = 420g
    expect(breakdown.wornWeightGrams).toBe(420);
    // Pack Weight = 1630 + 3000 = 4630g
    expect(breakdown.totalPackWeightGrams).toBe(4630);
    // Total = 4630 + 420 = 5050g
    expect(breakdown.totalWeightGrams).toBe(5050);
    expect(breakdown.mulCategory).toBe('ultralight');
  });

  it('TEST-Z3-02: génère le rapport Shakedown et repère la traçabilité inventaire possédé', () => {
    const gearItems: GearItem[] = mockTripItems.map((i) => ({
      id: i.id,
      name: i.item_name,
      weightGrams: i.weight_grams || 0,
      category: i.category || 'misc',
      status: i.is_packed ? 'packed' : 'to_buy',
      isWorn: i.is_worn ?? false,
      isConsumable: i.is_consumable ?? false,
      isVital: i.is_vital ?? false,
      quantity: i.quantity || 1,
    }));

    const report = generateShakedownReport(gearItems);

    // Vérifie que le rapport est exploitable par l'UI
    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThanOrEqual(100);

    // Vérifie que la trousse est bien détectée comme vitale présente
    const missing = identifyMissingVitals(gearItems);
    expect(missing.some((m) => m.toLowerCase().includes('secours'))).toBe(false);

    // Vérifie le décompte d'items possédés issus de l'inventaire physique
    const ownedFromInventory = mockTripItems.filter((i) => i.inventory_item_id !== null);
    expect(ownedFromInventory.length).toBe(3);
  });
});
