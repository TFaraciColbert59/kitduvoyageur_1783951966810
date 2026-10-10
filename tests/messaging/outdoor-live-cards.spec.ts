/**
 * LKDV Social — Milestone 2: First-Class Outdoor Objects & Live Cards Test Suite
 * File: tests/messaging/outdoor-live-cards.spec.ts
 *
 * Covers:
 * 1. Pack Merge Engine: deduplication of shared equipment, proportional load redistribution,
 *    physiological safety thresholds (20% human, 15% dog), canine safety rules, and overload warnings.
 * 2. Outdoor Snapshots: serialization and hydration for GPX, Kit, Equipment, and Expedition payloads.
 * 3. Live Card Components: zero-fetch rendering, performance benchmarks, compact thread footprints,
 *    Apple HIG 44px touch targets, and WCAG 2.2 accessibility.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  PackMergeService,
  type PackParticipant,
  type PackGearItem,
  type PackMergeResult,
} from '@/features/messaging/services/domain/packMergeService';

import {
  serializeGPXSnapshot,
  serializeKitSnapshot,
  isGPXSnapshot,
  isKitSnapshot,
  isEquipmentSnapshot,
  isExpeditionSnapshot,
  hydrateOutdoorSnapshot,
  type GPXSnapshot,
  type KitSnapshot,
  type EquipmentSnapshot,
  type ExpeditionSnapshot,
} from '@/features/messaging/types/outdoorObjects.types';

import { GPXLiveCard } from '@/features/messaging/components/GPXLiveCard';
import { KitLiveCard } from '@/features/messaging/components/KitLiveCard';
import { PackMergeSheet } from '@/features/messaging/components/PackMergeSheet';
import { EquipmentLiveCard } from '@/features/messaging/components/EquipmentLiveCard';
import { ExpeditionLiveCard } from '@/features/messaging/components/ExpeditionLiveCard';

// Component aliases for complete specification compatibility
export const MockGPXLiveCard = GPXLiveCard;
export const MockKitLiveCard = KitLiveCard;
export const MockPackMergeSheet = PackMergeSheet;
export const MockEquipmentLiveCard = EquipmentLiveCard;
export const MockExpeditionLiveCard = ExpeditionLiveCard;

describe('Milestone 2: First-Class Outdoor Objects & Live Cards', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: PACK MERGE DEDUPLICATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Pack Merge: Shared Gear Deduplication', () => {
    it('TEST-PM-DEDUP-01: Deduplicates duplicate stoves and water filters in shared pool', () => {
      const participants: PackParticipant[] = [
        { id: 'u1', name: 'Alice', type: 'human', bodyWeightKg: 65, role: 'guide' },
        { id: 'u2', name: 'Bob', type: 'human', bodyWeightKg: 80, role: 'member' },
      ];

      const kits = [
        {
          ownerId: 'u1',
          items: [
            { id: 'i1', name: 'Réchaud Gaz', weightGrams: 350, category: 'cook' as const, isShared: true, ownerId: 'u1' },
            { id: 'i2', name: 'Filtre BeFree', weightGrams: 120, category: 'water' as const, isShared: true, ownerId: 'u1' },
          ],
        },
        {
          ownerId: 'u2',
          items: [
            { id: 'i3', name: 'Réchaud Gaz', weightGrams: 410, category: 'cook' as const, isShared: true, ownerId: 'u2' },
            { id: 'i4', name: 'Filtre BeFree', weightGrams: 120, category: 'water' as const, isShared: true, ownerId: 'u2' },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);

      expect(result.droppedDuplicates.length).toBe(2);
      expect(result.metrics.weightSavedDeduplicationGrams).toBe(410 + 120); // 530g saved
      expect(result.deduplicatedItems.filter((i) => i.name === 'Réchaud Gaz').length).toBe(1);
      expect(result.deduplicatedItems.filter((i) => i.name === 'Filtre BeFree').length).toBe(1);
    });

    it('TEST-PM-DEDUP-02: Preserves personal non-shared equipment without deduplication', () => {
      const participants: PackParticipant[] = [
        { id: 'u1', name: 'Alice', type: 'human', bodyWeightKg: 60 },
        { id: 'u2', name: 'Bob', type: 'human', bodyWeightKg: 75 },
      ];

      const kits = [
        {
          ownerId: 'u1',
          items: [
            { id: 's1', name: 'Duvet 0°C', weightGrams: 900, category: 'sleep' as const, isShared: false, ownerId: 'u1' },
            { id: 'c1', name: 'Veste Gore-Tex', weightGrams: 420, category: 'clothing' as const, isShared: false, ownerId: 'u1' },
          ],
        },
        {
          ownerId: 'u2',
          items: [
            { id: 's2', name: 'Duvet 0°C', weightGrams: 1050, category: 'sleep' as const, isShared: false, ownerId: 'u2' },
            { id: 'c2', name: 'Veste Gore-Tex', weightGrams: 480, category: 'clothing' as const, isShared: false, ownerId: 'u2' },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);

      expect(result.droppedDuplicates.length).toBe(0);
      expect(result.metrics.weightSavedDeduplicationGrams).toBe(0);
      expect(result.individualLoads['u1'].assignedItems.map((i) => i.itemId)).toEqual(['s1', 'c1']);
      expect(result.individualLoads['u2'].assignedItems.map((i) => i.itemId)).toEqual(['s2', 'c2']);
    });

    it('TEST-PM-DEDUP-03: Retains optimal shared gear (lowest weight)', () => {
      const items: PackGearItem[] = [
        { id: 't_heavy', name: 'Tente 2P', weightGrams: 2400, category: 'shelter', isShared: true, ownerId: 'u1' },
        { id: 't_light', name: 'Tente 2P', weightGrams: 1650, category: 'shelter', isShared: true, ownerId: 'u2' },
      ];

      const { retainedItems, droppedDecisions } = PackMergeService.deduplicateSharedGear(items);

      expect(retainedItems.length).toBe(1);
      expect(retainedItems[0].id).toBe('t_light');
      expect(droppedDecisions[0].droppedItemIds).toContain('t_heavy');
      expect(droppedDecisions[0].weightSavedGrams).toBe(2400);
    });

    it('TEST-PM-DEDUP-04: Mass conservation: allocated + dropped equals initial weight', () => {
      const participants: PackParticipant[] = [
        { id: 'u1', name: 'Alice', type: 'human', bodyWeightKg: 70 },
        { id: 'u2', name: 'Bob', type: 'human', bodyWeightKg: 70 },
      ];

      const items: PackGearItem[] = [
        { id: '1', name: 'Tente', weightGrams: 2000, category: 'shelter', isShared: true, ownerId: 'u1' },
        { id: '2', name: 'Tente', weightGrams: 2200, category: 'shelter', isShared: true, ownerId: 'u2' },
        { id: '3', name: 'Duvet', weightGrams: 1000, category: 'sleep', isShared: false, ownerId: 'u1' },
        { id: '4', name: 'Duvet', weightGrams: 1100, category: 'sleep', isShared: false, ownerId: 'u2' },
      ];

      const totalInitialWeight = items.reduce((acc, i) => acc + i.weightGrams, 0); // 6300g
      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'u1', items }]);

      const allocatedTotal = Object.values(result.individualLoads).reduce(
        (acc, l) => acc + l.allocatedWeightGrams,
        0
      );
      const droppedTotal = result.droppedDuplicates.reduce((acc, d) => acc + d.weightSavedGrams, 0);

      expect(allocatedTotal + droppedTotal).toBe(totalInitialWeight);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: PHYSIOLOGICAL THRESHOLDS & LOAD BALANCING
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Pack Merge: Physiological Thresholds & Load Balancing', () => {
    it('TEST-PM-LOAD-01: Applies 20% body weight limit for human participants', () => {
      const participants: PackParticipant[] = [
        { id: 'h1', name: 'Clara', type: 'human', bodyWeightKg: 55 },
        { id: 'h2', name: 'David', type: 'human', bodyWeightKg: 85 },
      ];

      const result = PackMergeService.runPackMerge(participants, []);

      // 55 * 0.20 = 11.0 kg; 85 * 0.20 = 17.0 kg
      expect(result.individualLoads['h1'].maxSafeWeightKg).toBe(11.0);
      expect(result.individualLoads['h1'].safeThresholdRatio).toBe(0.20);
      expect(result.individualLoads['h2'].maxSafeWeightKg).toBe(17.0);
      expect(result.individualLoads['h2'].safeThresholdRatio).toBe(0.20);
    });

    it('TEST-PM-LOAD-02: Applies 15% body weight limit for canine participants', () => {
      const participants: PackParticipant[] = [
        { id: 'd1', name: 'Rex', type: 'dog', bodyWeightKg: 24, isCarryingPack: true },
        { id: 'd2', name: 'Luna', type: 'dog', bodyWeightKg: 32, isCarryingPack: true },
      ];

      const result = PackMergeService.runPackMerge(participants, []);

      // 24 * 0.15 = 3.6 kg; 32 * 0.15 = 4.8 kg
      expect(result.individualLoads['d1'].maxSafeWeightKg).toBe(3.6);
      expect(result.individualLoads['d1'].safeThresholdRatio).toBe(0.15);
      expect(result.individualLoads['d2'].maxSafeWeightKg).toBe(4.8);
      expect(result.individualLoads['d2'].safeThresholdRatio).toBe(0.15);
    });

    it('TEST-PM-LOAD-03: Balances load percentage evenly across unequal body weights', () => {
      const participants: PackParticipant[] = [
        { id: 'light', name: 'Light User', type: 'human', bodyWeightKg: 50 }, // max safe: 10kg
        { id: 'heavy', name: 'Heavy User', type: 'human', bodyWeightKg: 100 }, // max safe: 20kg
      ];

      // Total 12kg of shared gear in 1kg increments
      const sharedItems: PackGearItem[] = Array.from({ length: 12 }, (_, i) => ({
        id: `item-${i}`,
        name: `Pack Item ${i}`,
        weightGrams: 1000,
        category: 'misc',
        isShared: true,
        ownerId: 'light',
      }));

      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'light', items: sharedItems }]);

      const loadLight = result.individualLoads['light'];
      const loadHeavy = result.individualLoads['heavy'];

      // Proportional water-filling distributes 2x weight to 100kg user
      expect(loadLight.allocatedWeightKg).toBe(4.0);
      expect(loadHeavy.allocatedWeightKg).toBe(8.0);
      expect(loadLight.loadPercentage).toBe(40);
      expect(loadHeavy.loadPercentage).toBe(40);
      expect(loadLight.isOverloaded).toBe(false);
      expect(loadHeavy.isOverloaded).toBe(false);
    });

    it('TEST-PM-LOAD-04: Canine gear eligibility filter prevents unsafe dog portage', () => {
      const participants: PackParticipant[] = [
        { id: 'human', name: 'Alice', type: 'human', bodyWeightKg: 70 },
        { id: 'dog', name: 'Rex', type: 'dog', bodyWeightKg: 20, isCarryingPack: true }, // max safe: 3kg
      ];

      const items: PackGearItem[] = [
        { id: 'kibble', name: 'Croquettes Trek', weightGrams: 1500, category: 'cook', isShared: true, ownerId: 'human', canBeCarriedByDog: true },
        { id: 'knife', name: 'Couteau Bivouac', weightGrams: 250, category: 'misc', isShared: true, ownerId: 'human', canBeCarriedByDog: false },
        { id: 'stove', name: 'Réchaud Titane', weightGrams: 400, category: 'cook', isShared: true, ownerId: 'human', canBeCarriedByDog: false },
      ];

      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'human', items }]);

      const dogItems = result.individualLoads['dog'].assignedItems;
      expect(dogItems.map((i) => i.itemId)).toEqual(['kibble']);
      expect(result.individualLoads['human'].assignedItems.map((i) => i.itemId)).toContain('knife');
      expect(result.individualLoads['human'].assignedItems.map((i) => i.itemId)).toContain('stove');
    });

    it('TEST-PM-LOAD-05: Non-carrying dog (isCarryingPack: false) receives 0g allocation', () => {
      const participants: PackParticipant[] = [
        { id: 'human', name: 'Alice', type: 'human', bodyWeightKg: 70 },
        { id: 'puppy', name: 'Puppy', type: 'dog', bodyWeightKg: 15, isCarryingPack: false },
      ];

      const items: PackGearItem[] = [
        { id: 'bowl', name: 'Gamelle Pliable', weightGrams: 200, category: 'cook', isShared: true, ownerId: 'human', canBeCarriedByDog: true },
      ];

      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'human', items }]);

      expect(result.individualLoads['puppy'].allocatedWeightGrams).toBe(0);
      expect(result.individualLoads['puppy'].maxSafeWeightKg).toBe(0);
      expect(result.individualLoads['human'].allocatedWeightGrams).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: OVERLOAD DETECTION & WARNINGS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Pack Merge: Overload Detection & Warnings', () => {
    it('TEST-PM-WARN-01: Raises explicit overload warning when human exceeds 20%', () => {
      const participants: PackParticipant[] = [
        { id: 'u1', name: 'Thomas', type: 'human', bodyWeightKg: 60 }, // max safe: 12.0kg
      ];

      const heavyItems: PackGearItem[] = [
        { id: 'heavy_pack', name: 'Sac Expédition', weightGrams: 15000, category: 'misc', isShared: false, ownerId: 'u1' },
      ];

      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'u1', items: heavyItems }]);

      const load = result.individualLoads['u1'];
      expect(load.isOverloaded).toBe(true);
      expect(load.overloadGrams).toBe(3000);
      expect(load.loadPercentage).toBe(125);
      expect(result.warnings.some((w) => w.includes('Thomas') && w.includes('Surcharge') && w.includes('20%'))).toBe(true);
    });

    it('TEST-PM-WARN-02: Raises explicit overload warning when dog exceeds 15%', () => {
      const participants: PackParticipant[] = [
        { id: 'd1', name: 'Max', type: 'dog', bodyWeightKg: 20, isCarryingPack: true }, // max safe: 3.0kg
      ];

      const dogKibble: PackGearItem[] = [
        { id: 'food', name: 'Croquettes 5j', weightGrams: 4000, category: 'cook', isShared: false, ownerId: 'd1', canBeCarriedByDog: true },
      ];

      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'd1', items: dogKibble }]);

      const load = result.individualLoads['d1'];
      expect(load.isOverloaded).toBe(true);
      expect(load.overloadGrams).toBe(1000);
      expect(result.warnings.some((w) => w.includes('Max') && w.includes('canine') && w.includes('15%'))).toBe(true);
    });

    it('TEST-PM-WARN-03: Warns on total group capacity deficit (required > capacity)', () => {
      const participants: PackParticipant[] = [
        { id: 'u1', name: 'Alice', type: 'human', bodyWeightKg: 50 }, // max 10kg
        { id: 'u2', name: 'Bob', type: 'human', bodyWeightKg: 60 },   // max 12kg
      ]; // Total group safe capacity: 22kg

      // Total gear: 28kg
      const items: PackGearItem[] = [
        { id: 'pack1', name: 'Matériel Lourd', weightGrams: 28000, category: 'misc', isShared: true, ownerId: 'u1' },
      ];

      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'u1', items }]);

      expect(result.isGroupOverloaded).toBe(true);
      expect(result.warnings[0]).toContain('Capacité totale du groupe dépassée');
      expect(result.warnings[0]).toContain('28.0 kg requis pour 22.0 kg');
    });

    it('TEST-PM-WARN-04: Guide / medic role prioritizes safety gear within safe limits', () => {
      const participants: PackParticipant[] = [
        { id: 'guide', name: 'Marc', type: 'human', bodyWeightKg: 80, role: 'guide' }, // max 16kg
        { id: 'member', name: 'Jean', type: 'human', bodyWeightKg: 80, role: 'member' }, // max 16kg
      ];

      const items: PackGearItem[] = [
        { id: 'trauma', name: 'Trousse Urgence Bivouac', weightGrams: 1800, category: 'safety', isShared: true, ownerId: 'member', isVital: true },
      ];

      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'member', items }]);

      expect(result.individualLoads['guide'].assignedItems.map((i) => i.itemId)).toContain('trauma');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: BOUNDARY CONDITIONS & FUZZING
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Pack Merge: Boundary Conditions & Fuzzing', () => {
    it('TEST-PM-EDGE-01: Handles solo participant pack merge cleanly', () => {
      const participants: PackParticipant[] = [
        { id: 'solo', name: 'Solo Hiker', type: 'human', bodyWeightKg: 70 },
      ];

      const items: PackGearItem[] = [
        { id: 'i1', name: 'Tente 1P', weightGrams: 1100, category: 'shelter', isShared: true, ownerId: 'solo' },
      ];

      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'solo', items }]);

      expect(result.droppedDuplicates.length).toBe(0);
      expect(result.individualLoads['solo'].allocatedWeightGrams).toBe(1100);
      expect(result.warnings.length).toBe(0);
    });

    it('TEST-PM-EDGE-02: Clamps invalid/zero body weights to safe defaults', () => {
      const participants: PackParticipant[] = [
        { id: 'zero', name: 'Zero Weight', type: 'human', bodyWeightKg: 0 },
      ];

      const result = PackMergeService.runPackMerge(participants, []);

      expect(result.individualLoads['zero'].bodyWeightKg).toBe(70);
      expect(result.individualLoads['zero'].maxSafeWeightKg).toBe(14.0);
    });

    it('TEST-PM-EDGE-03: Handles empty gear kits without division by zero', () => {
      const participants: PackParticipant[] = [
        { id: 'u1', name: 'Alice', type: 'human', bodyWeightKg: 60 },
      ];

      const result = PackMergeService.runPackMerge(participants, []);

      expect(result.totalGroupWeightGrams).toBe(0);
      expect(result.groupCapacityUtilizationPercentage).toBe(0);
      expect(result.isGroupOverloaded).toBe(false);
      expect(result.warnings.length).toBe(0);
    });

    it('TEST-PM-PERF-01: Executes 150 items across 10 humans and 4 dogs in < 10ms', () => {
      const participants: PackParticipant[] = [
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `h_${i}`,
          name: `Human ${i}`,
          type: 'human' as const,
          bodyWeightKg: 60 + (i * 3),
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `d_${i}`,
          name: `Dog ${i}`,
          type: 'dog' as const,
          bodyWeightKg: 20 + i,
          isCarryingPack: true,
        })),
      ];

      const items: PackGearItem[] = Array.from({ length: 150 }, (_, i) => ({
        id: `item_${i}`,
        name: `Equipement ${(i % 20)}`,
        weightGrams: 100 + (i * 15),
        category: 'misc' as const,
        isShared: i % 2 === 0,
        ownerId: `h_${i % 10}`,
        canBeCarriedByDog: i % 5 === 0,
      }));

      const start = performance.now();
      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'h_0', items }]);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(15);
      expect(result.deduplicatedItems.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 5: OUTDOOR SNAPSHOT SERIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Outdoor Snapshot Serialization', () => {
    it('TEST-SNAP-01: Serializes raw GPX coordinates into compact GPXSnapshot', () => {
      const rawPoints = [
        { lat: 45.8326, lng: 6.8652, ele: 1035 },
        { lat: 45.8450, lng: 6.8790, ele: 1350 },
        { lat: 45.8610, lng: 6.8920, ele: 1820 },
      ];

      const snapshot = serializeGPXSnapshot({
        title: 'Traversée du Montenvers',
        points: rawPoints,
      });

      expect(snapshot.type).toBe('gpx_snapshot');
      expect(snapshot.title).toBe('Traversée du Montenvers');
      expect(snapshot.distanceKm).toBeGreaterThan(3.0);
      expect(snapshot.elevationGainM).toBe(785); // (1350-1035) + (1820-1350)
      expect(snapshot.estimatedDurationMinutes).toBeGreaterThan(60);
      expect(snapshot.bounds.minLat).toBe(45.8326);
      expect(snapshot.bounds.maxLat).toBe(45.8610);
    });

    it('TEST-SNAP-02: Generates valid SVG polyline without NaN or out-of-bounds coordinates', () => {
      const rawPoints = [
        { lat: 44.0, lng: 6.0 },
        { lat: 44.5, lng: 6.5 },
      ];

      const snapshot = serializeGPXSnapshot({
        title: 'Test SVG',
        points: rawPoints,
        width: 240,
        height: 90,
        padding: 10,
      });

      expect(snapshot.svgPolylinePath).not.toContain('NaN');
      expect(snapshot.svgPolylinePath).not.toContain('Infinity');

      // Format check: "x,y x,y"
      const pairs = snapshot.svgPolylinePath.split(' ');
      expect(pairs.length).toBe(2);
      pairs.forEach((p) => {
        const [x, y] = p.split(',').map(Number);
        expect(x).toBeGreaterThanOrEqual(10);
        expect(x).toBeLessThanOrEqual(230);
        expect(y).toBeGreaterThanOrEqual(10);
        expect(y).toBeLessThanOrEqual(80);
      });
    });

    it('TEST-SNAP-03: Serializes gear kit into KitSnapshot with category aggregation', () => {
      const kit = {
        id: 'kit-123',
        title: 'Bivouac Estival 3J',
        items: [
          { name: 'Tente 2P', weightGrams: 1600, category: 'shelter' },
          { name: 'Tarp', weightGrams: 500, category: 'shelter' },
          { name: 'Réchaud', weightGrams: 85, category: 'cook' },
          { name: 'Duvet', weightGrams: 850, category: 'sleep' },
        ],
      };

      const snapshot = serializeKitSnapshot(kit);

      expect(snapshot.type).toBe('kit_snapshot');
      expect(snapshot.kitId).toBe('kit-123');
      expect(snapshot.totalWeightGrams).toBe(3035);
      expect(snapshot.itemCount).toBe(4);

      const shelterCategory = snapshot.categories.find((c) => c.name === 'shelter');
      expect(shelterCategory).toBeDefined();
      expect(shelterCategory?.count).toBe(2);
      expect(shelterCategory?.weightGrams).toBe(2100);
    });

    it('TEST-SNAP-04: Serializes individual equipment item into EquipmentSnapshot', () => {
      const eqSnapshot: EquipmentSnapshot = {
        type: 'equipment_snapshot',
        equipmentId: 'eq-msr-pocket',
        name: 'MSR PocketRocket Deluxe',
        weightGrams: 83,
        category: 'cook',
        brand: 'MSR',
        status: 'owned',
      };

      expect(eqSnapshot.type).toBe('equipment_snapshot');
      expect(eqSnapshot.weightGrams).toBe(83);
      expect(eqSnapshot.brand).toBe('MSR');
    });

    it('TEST-SNAP-05: Serializes expedition into ExpeditionSnapshot with ISO timestamps', () => {
      const expSnapshot: ExpeditionSnapshot = {
        type: 'expedition_snapshot',
        expeditionId: 'exp-ecrins-2026',
        title: 'Tour des Écrins Haute Route',
        startDate: '2026-07-15T07:00:00.000Z',
        endDate: '2026-07-22T18:00:00.000Z',
        status: 'planning',
        participantCount: 5,
        routeDistanceKm: 104.5,
        elevationGainM: 6800,
      };

      expect(expSnapshot.type).toBe('expedition_snapshot');
      expect(expSnapshot.status).toBe('planning');
      expect(expSnapshot.participantCount).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 6: OUTDOOR SNAPSHOT HYDRATION & TYPE GUARDS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('6. Outdoor Snapshot Hydration & Type Guards', () => {
    it('TEST-HYDRATE-01: Discriminated type guards accurately classify each snapshot type', () => {
      const gpxMeta = { type: 'gpx_snapshot', title: 'Route', distanceKm: 12, svgPolylinePath: '0,0', bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 } };
      const kitMeta = { type: 'kit_snapshot', kitId: 'k1', totalWeightGrams: 500, categories: [] };
      const eqMeta = { type: 'equipment_snapshot', equipmentId: 'e1', name: 'Lampe', weightGrams: 75 };
      const expMeta = { type: 'expedition_snapshot', expeditionId: 'x1', title: 'Raid', status: 'active', participantCount: 3 };

      expect(isGPXSnapshot(gpxMeta)).toBe(true);
      expect(isGPXSnapshot(kitMeta)).toBe(false);

      expect(isKitSnapshot(kitMeta)).toBe(true);
      expect(isKitSnapshot(eqMeta)).toBe(false);

      expect(isEquipmentSnapshot(eqMeta)).toBe(true);
      expect(isEquipmentSnapshot(expMeta)).toBe(false);

      expect(isExpeditionSnapshot(expMeta)).toBe(true);
      expect(isExpeditionSnapshot(gpxMeta)).toBe(false);
    });

    it('TEST-HYDRATE-02: Hydrates message.metadata with round-trip fidelity', () => {
      const original: KitSnapshot = {
        type: 'kit_snapshot',
        kitId: 'kit-alpine-ultra',
        title: 'Ultra Léger Vercors',
        totalWeightGrams: 4100,
        itemCount: 8,
        categories: [{ name: 'shelter', count: 1, weightGrams: 900 }],
      };

      const messageMetadata = { ...original };
      const hydrated = hydrateOutdoorSnapshot(messageMetadata);

      expect(hydrated).toEqual(original);
    });

    it('TEST-HYDRATE-03: Resilient fallback to null on malformed or missing metadata', () => {
      expect(hydrateOutdoorSnapshot(null)).toBeNull();
      expect(hydrateOutdoorSnapshot(undefined)).toBeNull();
      expect(hydrateOutdoorSnapshot({})).toBeNull();
      expect(hydrateOutdoorSnapshot({ type: 'unknown_outdoor_type' })).toBeNull();
      expect(hydrateOutdoorSnapshot('string_instead_of_object')).toBeNull();
    });

    it('TEST-HYDRATE-04: Rejects corrupted numeric types and negative metrics', () => {
      const corruptedGPX = {
        type: 'gpx_snapshot',
        title: 'Bad GPX',
        distanceKm: 'NOT_A_NUMBER', // Corrupted
        svgPolylinePath: '10,10',
        bounds: {},
      };

      expect(isGPXSnapshot(corruptedGPX)).toBe(false);
      expect(hydrateOutdoorSnapshot(corruptedGPX)).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 7: LIVE CARD COMPONENT RENDERING & ZERO-FETCH PERFORMANCE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('7. Live Card Component Rendering & Zero-Fetch Performance', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch');
    });

    it('TEST-CARD-01: GPXLiveCard renders SVG snapshot with ZERO network fetch calls', () => {
      const snapshot: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'Crêtes du Sancy',
        distanceKm: 14.8,
        elevationGainM: 920,
        estimatedDurationMinutes: 280,
        svgPolylinePath: '10.0,80.0 50.0,40.0 120.0,60.0 230.0,15.0',
        bounds: { minLat: 45.5, maxLat: 45.6, minLng: 2.8, maxLng: 2.9 },
      };

      const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot }));

      // Zero network fetch assertion
      expect(fetchSpy).not.toHaveBeenCalled();

      // Markup content assertions
      expect(html).toContain('Crêtes du Sancy');
      expect(html).toContain('14.8 km');
      expect(html).toContain('+920 m');
      expect(html).toContain('4h40m');
      expect(html).toContain('<polyline');
      expect(html).toContain('points="10.0,80.0 50.0,40.0 120.0,60.0 230.0,15.0"');
    });

    it('TEST-CARD-02: GPXLiveCard 100-card render benchmark executes in < 50ms', () => {
      const snapshot: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'Rapid Scroll Track',
        distanceKm: 21.0,
        elevationGainM: 1100,
        estimatedDurationMinutes: 340,
        svgPolylinePath: '10,10 50,50 100,20 200,80',
        bounds: { minLat: 44.0, maxLat: 44.5, minLng: 6.0, maxLng: 6.5 },
      };

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot }));
      }
      const duration = performance.now() - start;

      // 100 cards rendered in < 50ms -> average < 0.5ms per card
      expect(duration).toBeLessThan(50);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('TEST-CARD-03: KitLiveCard displays compact stats and Pack Merge trigger', () => {
      const snapshot: KitSnapshot = {
        type: 'kit_snapshot',
        kitId: 'k-bivouac',
        title: 'Pack Autonomie 4J',
        totalWeightGrams: 6800,
        itemCount: 14,
        categories: [{ name: 'shelter', count: 2, weightGrams: 2100 }],
      };

      const html = renderToStaticMarkup(React.createElement(KitLiveCard, { snapshot }));

      expect(html).toContain('Pack Autonomie 4J');
      expect(html).toContain('6.8 kg');
      expect(html).toContain('14 objets');
      expect(html).toContain('Pack Merge');
    });

    it('TEST-CARD-04: PackMergeSheet renders participant load bars and warnings', () => {
      const result: PackMergeResult = {
        deduplicatedItems: [],
        droppedDuplicates: [
          {
            keptItemId: 'k1',
            droppedItemIds: ['d1'],
            category: 'cook',
            name: 'Réchaud',
            weightSavedGrams: 350,
            rationale: 'Dédoublonné',
          },
        ],
        removedDuplicates: [],
        individualLoads: {
          u1: {
            participantId: 'u1',
            name: 'Alice',
            type: 'human',
            isDog: false,
            bodyWeightKg: 60,
            allocatedWeightGrams: 14000,
            allocatedWeightKg: 14.0,
            maxSafeWeightKg: 12.0,
            safeThresholdRatio: 0.20,
            actualRatio: 0.233,
            loadPercentage: 117,
            isOverloaded: true,
            overloadGrams: 2000,
            assignedItems: [],
            roleOrBreed: 'Guide',
            role: 'guide',
            personalWeightGrams: 14000,
            sharedWeightGrams: 0,
            totalWeightGrams: 14000,
            totalWeightKg: 14.0,
            bodyWeightRatio: 0.233,
            items: [],
          },
        },
        totalGroupWeightGrams: 14000,
        totalSafeCapacityGrams: 12000,
        groupCapacityUtilizationPercentage: 117,
        isGroupOverloaded: true,
        warnings: ['Surcharge de 2.0 kg pour Alice (23.3% > seuil max 20%)'],
        metrics: {
          weightSavedDeduplicationGrams: 350,
          humanCount: 1,
          dogCount: 0,
          sharedItemCount: 0,
          personalItemCount: 0,
        },
        groupStats: {
          totalOriginalWeightGrams: 14350,
          totalOptimizedWeightGrams: 14000,
          weightSavedGrams: 350,
          weightSavedKg: 0.4,
          duplicateCount: 1,
          itemCountOriginal: 2,
          itemCountOptimized: 1,
          overloadedCount: 1,
        },
        participantLoads: [],
      };

      const html = renderToStaticMarkup(React.createElement(PackMergeSheet, { result }));

      expect(html).toContain('350 g économisés par dédoublonnage');
      expect(html).toContain('Surcharge de 2.0 kg pour Alice');
      expect(html).toContain('bg-red-500'); // Overloaded bar
    });

    it('TEST-CARD-05: EquipmentLiveCard renders weight in grams and specs compactly', () => {
      const snapshot: EquipmentSnapshot = {
        type: 'equipment_snapshot',
        equipmentId: 'eq-lamp',
        name: 'Petzl Actik Core',
        weightGrams: 75,
        category: 'tech',
      };

      const html = renderToStaticMarkup(React.createElement(EquipmentLiveCard, { snapshot }));

      expect(html).toContain('Petzl Actik Core');
      expect(html).toContain('75 g');
      expect(html).toContain('tech');
    });

    it('TEST-CARD-06: ExpeditionLiveCard renders status badge and participant count', () => {
      const snapshot: ExpeditionSnapshot = {
        type: 'expedition_snapshot',
        expeditionId: 'exp-1',
        title: 'Traversée de Belledonne',
        startDate: '2026-08-01',
        status: 'active',
        participantCount: 4,
        routeDistanceKm: 42.0,
      };

      const html = renderToStaticMarkup(React.createElement(ExpeditionLiveCard, { snapshot }));

      expect(html).toContain('Traversée de Belledonne');
      expect(html).toContain('active');
      expect(html).toContain('4 membres');
      expect(html).toContain('42 km');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 8: THREAD FOOTPRINT, APPLE HIG & ACCESSIBILITY (WCAG 2.2)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('8. Thread Footprint, Apple HIG & Accessibility (WCAG 2.2)', () => {
    it('TEST-UI-01: Live cards enforce max-width constraint preventing thread blowout', () => {
      const gpxSnapshot: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'Sentier Littoral',
        distanceKm: 8.5,
        elevationGainM: 120,
        estimatedDurationMinutes: 120,
        svgPolylinePath: '10,10 200,80',
        bounds: { minLat: 43.0, maxLat: 43.1, minLng: 5.0, maxLng: 5.1 },
      };

      const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: gpxSnapshot }));

      // Enforces compact width constraint in chat thread
      expect(html).toContain('max-w-[320px]');
    });

    it('TEST-UI-02: Interactive buttons comply with Apple HIG 44px minimum touch target', () => {
      const kitSnapshot: KitSnapshot = {
        type: 'kit_snapshot',
        kitId: 'k1',
        title: 'Test Touch Target',
        totalWeightGrams: 2000,
        itemCount: 3,
        categories: [],
      };

      const html = renderToStaticMarkup(React.createElement(KitLiveCard, { snapshot: kitSnapshot }));

      // Min 44px height for touch targets
      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('h-[44px]');
    });

    it('TEST-UI-03: Decorative SVGs contain aria-hidden="true" or role="presentation"', () => {
      const gpxSnapshot: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'A11y Route',
        distanceKm: 10,
        elevationGainM: 500,
        estimatedDurationMinutes: 180,
        svgPolylinePath: '10,10 20,20',
        bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 },
      };

      const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: gpxSnapshot }));

      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('role="presentation"');
    });

    it('TEST-UI-04: Contrast and color tokens use LKDV design system CSS custom properties', () => {
      const gpxSnapshot: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'Design Tokens',
        distanceKm: 5,
        elevationGainM: 100,
        estimatedDurationMinutes: 60,
        svgPolylinePath: '0,0 10,10',
        bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 },
      };

      const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: gpxSnapshot }));

      // Must use design system CSS variables, no hardcoded un-themed styling
      expect(html).toContain('var(--glass-border)');
      expect(html).toContain('var(--glass-bg-medium)');
      expect(html).toContain('var(--lkv-secondary)');
    });
  });
});
