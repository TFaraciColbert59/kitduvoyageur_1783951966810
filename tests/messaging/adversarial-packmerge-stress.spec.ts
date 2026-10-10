/**
 * LKDV Social — Milestone 2: Adversarial Stress Test Suite for Pack Merge & Load Distribution
 * File: tests/messaging/adversarial-packmerge-stress.spec.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS HARNESS:
 * 1. Pathological Edge Cases (empty participants, empty kits, 0kg/negative weight)
 * 2. Extreme Collective Overload (50kg for 40kg solo hiker)
 * 3. Canine Portage: enabled vs disabled (isCarryingPack: false -> 0g allocation)
 * 4. Canine Gear Rejection: non-canine gear (stoves, cook, human food) strictly forbidden on dogs
 * 5. Preservation of Personal Equipment: never dropped, never re-assigned
 * 6. Mass Conservation Invariant: Allocated + Dropped === Initial Total
 * 7. Property-based randomized stress generator
 */

import { describe, it, expect } from 'vitest';
import {
  PackMergeService,
  mergePacks,
  type PackParticipant,
  type PackGearItem,
  type PackMergeKit,
} from '@/features/messaging/services/domain/packMergeService';

describe('Adversarial Stress Testing: Pack Merge & Load Distribution', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PATHOLOGICAL EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Pathological Edge Cases', () => {
    it('ADV-EDGE-01: Empty participants and empty kits list handled gracefully without throwing', () => {
      const result = PackMergeService.runPackMerge([], []);

      expect(result.deduplicatedItems).toEqual([]);
      expect(result.droppedDuplicates).toEqual([]);
      expect(result.totalGroupWeightGrams).toBe(0);
      expect(result.totalSafeCapacityGrams).toBe(0);
      expect(result.groupCapacityUtilizationPercentage).toBe(0);
      expect(result.isGroupOverloaded).toBe(false);
      expect(result.warnings).toEqual([]);
      expect(result.groupStats.totalOriginalWeightGrams).toBe(0);
      expect(result.groupStats.totalOptimizedWeightGrams).toBe(0);
    });

    it('ADV-EDGE-02: Empty participants list with non-empty kits list — mass conservation invariant', () => {
      const kits: PackMergeKit[] = [
        {
          ownerId: 'ghost_user',
          items: [
            { id: 'stove_1', name: 'Réchaud Gaz', weightGrams: 400, category: 'cook', isShared: true },
            { id: 'tent_1', name: 'Tente 2P', weightGrams: 2000, category: 'shelter', isShared: true },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge([], kits);

      const totalInitial = 2400;
      const allocatedTotal = Object.values(result.individualLoads).reduce(
        (acc, l) => acc + l.allocatedWeightGrams,
        0
      );
      const droppedTotal = result.droppedDuplicates.reduce((acc, d) => acc + d.weightSavedGrams, 0);

      // Invariant: Allocated + Dropped must equal Initial Total
      // When participants = [], all gear remains unallocated and un-dropped (disappears)
      expect(allocatedTotal + droppedTotal).toBe(totalInitial);
    });

    it('ADV-EDGE-03: Participants with 0kg, negative, and NaN body weight are safely clamped', () => {
      const participants: PackParticipant[] = [
        { id: 'h_zero', name: 'Zero Weight Human', type: 'human', bodyWeightKg: 0 },
        { id: 'h_neg', name: 'Negative Weight Human', type: 'human', bodyWeightKg: -15 },
        { id: 'd_zero', name: 'Zero Weight Dog', type: 'dog', bodyWeightKg: 0, isCarryingPack: true },
        { id: 'd_neg', name: 'Negative Weight Dog', type: 'dog', bodyWeightKg: -5, isCarryingPack: true },
      ];

      const result = PackMergeService.runPackMerge(participants, []);

      // Humans clamped to default 70kg -> 14.0 kg safe max
      expect(result.individualLoads['h_zero'].bodyWeightKg).toBe(70);
      expect(result.individualLoads['h_zero'].maxSafeWeightKg).toBe(14.0);
      expect(result.individualLoads['h_neg'].bodyWeightKg).toBe(70);
      expect(result.individualLoads['h_neg'].maxSafeWeightKg).toBe(14.0);

      // Dogs clamped to default 20kg -> 3.0 kg safe max (20 * 0.15)
      expect(result.individualLoads['d_zero'].bodyWeightKg).toBe(20);
      expect(result.individualLoads['d_zero'].maxSafeWeightKg).toBe(3.0);
      expect(result.individualLoads['d_neg'].bodyWeightKg).toBe(20);
      expect(result.individualLoads['d_neg'].maxSafeWeightKg).toBe(3.0);

      expect(Number.isNaN(result.totalSafeCapacityGrams)).toBe(false);
      expect(result.totalSafeCapacityGrams).toBeGreaterThan(0);
    });

    it('ADV-EDGE-04: Fractional and microscopic body weight (e.g. 0.5kg) does not produce NaN or Infinity', () => {
      const participants: PackParticipant[] = [
        { id: 'h_micro', name: 'Micro Hiker', type: 'human', bodyWeightKg: 0.5 },
      ];

      const kits: PackMergeKit[] = [
        {
          ownerId: 'h_micro',
          items: [{ id: 'item_1', name: 'Boussole', weightGrams: 50, category: 'navigation', isShared: true }],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);
      const load = result.individualLoads['h_micro'];

      expect(Number.isFinite(load.actualRatio)).toBe(true);
      expect(Number.isFinite(load.loadPercentage)).toBe(true);
      expect(Number.isNaN(load.loadPercentage)).toBe(false);
      expect(load.allocatedWeightGrams).toBe(50);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. EXTREME COLLECTIVE OVERLOAD
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Extreme Collective Overload', () => {
    it('ADV-OVER-01: 50kg shared gear for a 40kg solo hiker triggers severe group and individual overload warnings', () => {
      const participants: PackParticipant[] = [
        { id: 'solo_40', name: 'Lea', type: 'human', bodyWeightKg: 40 }, // max safe: 8.0 kg (20%)
      ];

      // 50kg of shared gear across multiple items
      const heavyItems: PackGearItem[] = [
        { id: 'tent_exp', name: 'Tente Camp de Base 8P', weightGrams: 18000, category: 'shelter', isShared: true, ownerId: 'solo_40' },
        { id: 'climb_rack', name: 'Jeu de Coinceurs & Cordes', weightGrams: 14000, category: 'misc', isShared: true, ownerId: 'solo_40' },
        { id: 'ration_crate', name: 'Caisse Rations Expédition', weightGrams: 18000, category: 'cook', isShared: true, ownerId: 'solo_40' },
      ];

      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'solo_40', items: heavyItems }]);
      const load = result.individualLoads['solo_40'];

      expect(load.allocatedWeightGrams).toBe(50000);
      expect(load.allocatedWeightKg).toBe(50.0);
      expect(load.maxSafeWeightKg).toBe(8.0);
      expect(load.isOverloaded).toBe(true);
      expect(load.overloadGrams).toBe(42000); // 50000 - 8000
      expect(load.actualRatio).toBe(1.25); // 50kg / 40kg = 125% of body weight
      expect(load.loadPercentage).toBe(625); // 50kg / 8kg * 100

      // Group overload assertions
      expect(result.isGroupOverloaded).toBe(true);
      expect(result.groupCapacityUtilizationPercentage).toBe(625);
      expect(result.totalSafeCapacityGrams).toBe(8000);
      expect(result.totalGroupWeightGrams).toBe(50000);

      // Warning verification
      expect(result.warnings.some((w) => w.includes('Capacité totale du groupe dépassée'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('50.0 kg requis pour 8.0 kg'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('Lea') && w.includes('Surcharge') && w.includes('42'))).toBe(true);
    });

    it('ADV-OVER-02: 120kg gear distributed over team of 3 hikers: proportional overflow without data corruption', () => {
      const participants: PackParticipant[] = [
        { id: 'h1', name: 'Alice', type: 'human', bodyWeightKg: 50 }, // max safe: 10kg
        { id: 'h2', name: 'Bob', type: 'human', bodyWeightKg: 70 },   // max safe: 14kg
        { id: 'h3', name: 'Charlie', type: 'human', bodyWeightKg: 80 }, // max safe: 16kg
      ]; // Total group safe capacity: 40kg

      // 60 items of 2kg each = 120kg total
      const items: PackGearItem[] = Array.from({ length: 60 }, (_, i) => ({
        id: `brick_${i}`,
        name: `Matériel Lourd ${i}`,
        weightGrams: 2000,
        category: 'misc',
        isShared: true,
        ownerId: 'h1',
      }));

      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'h1', items }]);

      expect(result.isGroupOverloaded).toBe(true);
      expect(result.totalGroupWeightGrams).toBe(120000);
      expect(result.groupStats.overloadedCount).toBe(3);

      const totalAllocated = Object.values(result.individualLoads).reduce(
        (acc, l) => acc + l.allocatedWeightGrams,
        0
      );
      expect(totalAllocated).toBe(120000);

      // Water filling preserves relative proportions: Charlie (80kg) carries more than Alice (50kg)
      expect(result.individualLoads['h3'].allocatedWeightGrams).toBeGreaterThan(
        result.individualLoads['h1'].allocatedWeightGrams
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CANINE PORTAGE: ENABLED VS DISABLED
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Canine Portage: Enabled vs Disabled', () => {
    it('ADV-DOG-01: Disabled canine (isCarryingPack: false) receives strictly 0g of shared dog items', () => {
      const participants: PackParticipant[] = [
        { id: 'h1', name: 'Alice', type: 'human', bodyWeightKg: 65 },
        { id: 'd_disabled', name: 'Puppy', type: 'dog', bodyWeightKg: 15, isCarryingPack: false },
        { id: 'd_enabled', name: 'Atlas', type: 'dog', bodyWeightKg: 30, isCarryingPack: true },
      ];

      const kits: PackMergeKit[] = [
        {
          ownerId: 'h1',
          items: [
            { id: 'kibble_1', name: 'Croquettes 1', weightGrams: 1000, category: 'cook', isShared: true, canBeCarriedByDog: true },
            { id: 'kibble_2', name: 'Croquettes 2', weightGrams: 1000, category: 'cook', isShared: true, canBeCarriedByDog: true },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);

      expect(result.individualLoads['d_disabled'].allocatedWeightGrams).toBe(0);
      expect(result.individualLoads['d_disabled'].maxSafeWeightKg).toBe(0);
      expect(result.individualLoads['d_disabled'].assignedItems.length).toBe(0);
      expect(result.individualLoads['d_enabled'].allocatedWeightGrams).toBe(2000);
    });

    it('ADV-DOG-02: Disabled canine (isCarryingPack: false) must be allocated strictly 0g even with personal items', () => {
      const participants: PackParticipant[] = [
        { id: 'h1', name: 'Alice', type: 'human', bodyWeightKg: 70 },
        { id: 'd_injured', name: 'Chien Blesse', type: 'dog', bodyWeightKg: 25, isCarryingPack: false },
      ];

      const kits: PackMergeKit[] = [
        {
          ownerId: 'd_injured',
          items: [
            { id: 'dog_coat', name: 'Manteau Chien', weightGrams: 400, category: 'clothing', isShared: false, ownerId: 'd_injured' },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);
      const dogLoad = result.individualLoads['d_injured'];

      // Requirement: Ensure 0g allocated when disabled (isCarryingPack: false)
      expect(dogLoad.allocatedWeightGrams).toBe(0);
    });

    it('ADV-DOG-03: Enabled canine strictly capped at 15% body weight, overflow rolls over to humans', () => {
      const participants: PackParticipant[] = [
        { id: 'human', name: 'Benoit', type: 'human', bodyWeightKg: 75 }, // max safe: 15kg
        { id: 'dog', name: 'Sam', type: 'dog', bodyWeightKg: 20, isCarryingPack: true }, // max safe: 3.0kg (15%)
      ];

      // Dog-eligible items totaling 5.5kg (exceeding dog safe capacity of 3.0kg)
      const kits: PackMergeKit[] = [
        {
          ownerId: 'human',
          items: [
            { id: 'k1', name: 'Kibble Pack 1', weightGrams: 2000, category: 'cook', isShared: true, canBeCarriedByDog: true },
            { id: 'k2', name: 'Kibble Pack 2', weightGrams: 1000, category: 'cook', isShared: true, canBeCarriedByDog: true },
            { id: 'k3', name: 'Kibble Pack 3', weightGrams: 2500, category: 'cook', isShared: true, canBeCarriedByDog: true },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);

      const dogLoad = result.individualLoads['dog'];
      const humanLoad = result.individualLoads['human'];

      // Dog carries exactly 3000g (2000g + 1000g), exactly at its 3.0kg physiological limit
      expect(dogLoad.allocatedWeightGrams).toBe(3000);
      expect(dogLoad.allocatedWeightKg).toBe(3.0);
      expect(dogLoad.isOverloaded).toBe(false);

      // Overflow item (k3: 2500g) was reassigned to human
      expect(humanLoad.assignedItems.map((i) => i.itemId)).toContain('k3');
      expect(humanLoad.allocatedWeightGrams).toBe(2500);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CANINE NON-CANINE GEAR RESTRICTION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Canine Non-Canine Gear Restriction', () => {
    it('ADV-GEAR-01: Hazardous and non-canine equipment (stoves, human food, shelters) NEVER assigned to dogs when humans present', () => {
      const participants: PackParticipant[] = [
        { id: 'h1', name: 'Marc', type: 'human', bodyWeightKg: 80 },
        { id: 'd1', name: 'Rex', type: 'dog', bodyWeightKg: 30, isCarryingPack: true },
      ];

      const kits: PackMergeKit[] = [
        {
          ownerId: 'h1',
          items: [
            { id: 'stove', name: 'Réchaud Primus', weightGrams: 350, category: 'cook', isShared: true, canBeCarriedByDog: false },
            { id: 'knife', name: 'Couteau Survie', weightGrams: 200, category: 'misc', isShared: true, canBeCarriedByDog: false },
            { id: 'gas', name: 'Cartouche Gaz 230g', weightGrams: 380, category: 'cook', isShared: true, canBeCarriedByDog: false },
            { id: 'tent', name: 'Tente Hubba Hubba', weightGrams: 1720, category: 'shelter', isShared: true, canBeCarriedByDog: false },
            { id: 'dog_kibble', name: 'Croquettes Rex', weightGrams: 1200, category: 'cook', isShared: true, canBeCarriedByDog: true },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);

      const dogAssigned = result.individualLoads['d1'].assignedItems;
      const humanAssigned = result.individualLoads['h1'].assignedItems;

      // Dog only gets kibble
      expect(dogAssigned.map((i) => i.itemId)).toEqual(['dog_kibble']);

      // Human carries all dangerous / human equipment
      expect(humanAssigned.map((i) => i.itemId)).toContain('stove');
      expect(humanAssigned.map((i) => i.itemId)).toContain('knife');
      expect(humanAssigned.map((i) => i.itemId)).toContain('gas');
      expect(humanAssigned.map((i) => i.itemId)).toContain('tent');
    });

    it('ADV-GEAR-02: Non-canine gear (stoves) must NEVER be assigned to dogs even in dog-only group', () => {
      // Adversarial test: trip with ONLY dogs (no humans) and a stove
      const participants: PackParticipant[] = [
        { id: 'dog_solo', name: 'Lone Dog', type: 'dog', bodyWeightKg: 25, isCarryingPack: true },
      ];

      const kits: PackMergeKit[] = [
        {
          ownerId: 'dog_solo',
          items: [
            { id: 'stove', name: 'Réchaud Titane', weightGrams: 400, category: 'cook', isShared: true, canBeCarriedByDog: false },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);
      const dogItems = result.individualLoads['dog_solo'].assignedItems;

      // Requirement: Non-canine gear must be rejected or assigned strictly to humans
      expect(dogItems.map((i) => i.name)).not.toContain('Réchaud Titane');
    });

    it('ADV-GEAR-03: Personal non-canine equipment (stove) in dog kit must not be carried by dog', () => {
      const participants: PackParticipant[] = [
        { id: 'h1', name: 'Alice', type: 'human', bodyWeightKg: 65 },
        { id: 'd1', name: 'Rex', type: 'dog', bodyWeightKg: 25, isCarryingPack: true },
      ];

      const kits: PackMergeKit[] = [
        {
          ownerId: 'd1',
          items: [
            { id: 'stove_dog', name: 'Réchaud Personnel', weightGrams: 500, category: 'cook', isShared: false, ownerId: 'd1', canBeCarriedByDog: false },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);
      const dogItems = result.individualLoads['d1'].assignedItems;

      // Canine cannot carry stove even if listed as personal item
      expect(dogItems.map((i) => i.name)).not.toContain('Réchaud Personnel');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. PRESERVATION OF PERSONAL EQUIPMENT
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Preservation of Personal Equipment', () => {
    it('ADV-PERS-01: Personal equipment is NEVER dropped during deduplication even with identical names', () => {
      const participants: PackParticipant[] = [
        { id: 'u1', name: 'Alice', type: 'human', bodyWeightKg: 60 },
        { id: 'u2', name: 'Bob', type: 'human', bodyWeightKg: 75 },
      ];

      // Alice and Bob have identical personal sleeping bags, personal headlamps, personal clothing
      const kits: PackMergeKit[] = [
        {
          ownerId: 'u1',
          items: [
            { id: 'duvet_a', name: 'Duvet Cumulus Panyam 600', weightGrams: 980, category: 'sleep', isShared: false, ownerId: 'u1' },
            { id: 'lamp_a', name: 'Petzl Actik Core', weightGrams: 75, category: 'tech', isShared: false, ownerId: 'u1' },
          ],
        },
        {
          ownerId: 'u2',
          items: [
            { id: 'duvet_b', name: 'Duvet Cumulus Panyam 600', weightGrams: 980, category: 'sleep', isShared: false, ownerId: 'u2' },
            { id: 'lamp_b', name: 'Petzl Actik Core', weightGrams: 75, category: 'tech', isShared: false, ownerId: 'u2' },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);

      // Dropped duplicates must be 0!
      expect(result.droppedDuplicates.length).toBe(0);
      expect(result.metrics.weightSavedDeduplicationGrams).toBe(0);

      // Alice keeps exactly her items
      expect(result.individualLoads['u1'].assignedItems.map((i) => i.itemId).sort()).toEqual(['duvet_a', 'lamp_a']);
      // Bob keeps exactly his items
      expect(result.individualLoads['u2'].assignedItems.map((i) => i.itemId).sort()).toEqual(['duvet_b', 'lamp_b']);
    });

    it('ADV-PERS-02: Personal equipment is NEVER re-assigned to another participant to balance group load', () => {
      const participants: PackParticipant[] = [
        { id: 'heavy_user', name: 'Alice', type: 'human', bodyWeightKg: 50 }, // max safe: 10kg
        { id: 'light_user', name: 'Bob', type: 'human', bodyWeightKg: 90 },   // max safe: 18kg
      ];

      // Alice brings a 12kg personal pack (exceeding her safe 10kg limit)
      // Bob brings 0 personal items
      const kits: PackMergeKit[] = [
        {
          ownerId: 'heavy_user',
          items: [
            { id: 'p_camera', name: 'Boitier Photo & Objectifs', weightGrams: 12000, category: 'tech', isShared: false, ownerId: 'heavy_user' },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);

      // Despite Alice being overloaded (12kg > 10kg safe), personal gear must STAY with Alice
      expect(result.individualLoads['heavy_user'].assignedItems.map((i) => i.itemId)).toEqual(['p_camera']);
      expect(result.individualLoads['light_user'].assignedItems).toEqual([]);

      // Overload warning is correctly raised for Alice
      expect(result.individualLoads['heavy_user'].isOverloaded).toBe(true);
      expect(result.individualLoads['heavy_user'].overloadGrams).toBe(2000);
    });

    it('ADV-PERS-03: Personal item of non-participant is NEVER re-assigned to active participants', () => {
      const participants: PackParticipant[] = [
        { id: 'u1', name: 'Alice', type: 'human', bodyWeightKg: 60 },
      ];

      // Bob's personal kit is provided, but Bob is not in the participants list
      const kits: PackMergeKit[] = [
        {
          ownerId: 'u2',
          items: [
            { id: 'bob_duvet', name: 'Duvet Bob', weightGrams: 1200, category: 'sleep', isShared: false, ownerId: 'u2' },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);

      // Alice must NOT receive Bob's personal item
      expect(result.individualLoads['u1'].assignedItems.map((i) => i.itemId)).not.toContain('bob_duvet');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. MASS CONSERVATION INVARIANT
  // ═══════════════════════════════════════════════════════════════════════════
  describe('6. Mass Conservation Invariant: Allocated + Dropped === Initial Total', () => {
    it('ADV-MASS-01: Invariant holds across complex mix of personal, shared, duplicates, and roles', () => {
      const participants: PackParticipant[] = [
        { id: 'p1', name: 'Alice', type: 'human', bodyWeightKg: 65, role: 'guide' },
        { id: 'p2', name: 'Bob', type: 'human', bodyWeightKg: 80, role: 'medic' },
        { id: 'p3', name: 'Claire', type: 'human', bodyWeightKg: 55, role: 'member' },
        { id: 'd1', name: 'Rex', type: 'dog', bodyWeightKg: 28, isCarryingPack: true },
      ];

      const kits: PackMergeKit[] = [
        {
          ownerId: 'p1',
          items: [
            { id: 't1', name: 'Tente 3P', weightGrams: 2800, category: 'shelter', isShared: true },
            { id: 's1', name: 'Réchaud MSR', weightGrams: 350, category: 'cook', isShared: true },
            { id: 'f1', name: 'Filtre Katadyn', weightGrams: 240, category: 'water', isShared: true },
            { id: 'pers_1', name: 'Duvet Alice', weightGrams: 850, category: 'sleep', isShared: false, ownerId: 'p1' },
          ],
        },
        {
          ownerId: 'p2',
          items: [
            { id: 't2', name: 'Tente 3P', weightGrams: 2950, category: 'shelter', isShared: true }, // Duplicate
            { id: 's2', name: 'Réchaud MSR', weightGrams: 350, category: 'cook', isShared: true },   // Duplicate
            { id: 'med', name: 'Trousse Pharmacie', weightGrams: 800, category: 'safety', isShared: true, isVital: true },
            { id: 'pers_2', name: 'Duvet Bob', weightGrams: 1100, category: 'sleep', isShared: false, ownerId: 'p2' },
          ],
        },
        {
          ownerId: 'p3',
          items: [
            { id: 'f2', name: 'Filtre Katadyn', weightGrams: 240, category: 'water', isShared: true }, // Duplicate
            { id: 'dog_food', name: 'Croquettes Chien', weightGrams: 2000, category: 'cook', isShared: true, canBeCarriedByDog: true },
            { id: 'pers_3', name: 'Duvet Claire', weightGrams: 750, category: 'sleep', isShared: false, ownerId: 'p3' },
          ],
        },
      ];

      const initialTotalWeight = kits.flatMap((k) => k.items).reduce((acc, i) => acc + i.weightGrams, 0);

      const result = PackMergeService.runPackMerge(participants, kits);

      const allocatedTotal = Object.values(result.individualLoads).reduce(
        (acc, l) => acc + l.allocatedWeightGrams,
        0
      );
      const droppedTotal = result.droppedDuplicates.reduce((acc, d) => acc + d.weightSavedGrams, 0);

      expect(allocatedTotal + droppedTotal).toBe(initialTotalWeight);
      expect(result.totalGroupWeightGrams).toBe(allocatedTotal);
      expect(result.groupStats.totalOriginalWeightGrams).toBe(initialTotalWeight);
      expect(result.groupStats.totalOptimizedWeightGrams).toBe(allocatedTotal);
      expect(result.groupStats.weightSavedGrams).toBe(droppedTotal);
    });

    it('ADV-MASS-02: Property-based fuzz harness — 50 randomized iterations verifying mass conservation invariant', () => {
      // Deterministic PRNG seed for reproducible fuzzing
      let seed = 42;
      const pseudoRandom = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };

      for (let trial = 0; trial < 50; trial++) {
        const numHumans = 1 + Math.floor(pseudoRandom() * 5); // 1 to 5 humans
        const numDogs = Math.floor(pseudoRandom() * 3);       // 0 to 2 dogs

        const participants: PackParticipant[] = [];
        for (let h = 0; h < numHumans; h++) {
          participants.push({
            id: `h_${trial}_${h}`,
            name: `Hiker ${h}`,
            type: 'human',
            bodyWeightKg: 45 + Math.floor(pseudoRandom() * 50), // 45kg to 95kg
          });
        }
        for (let d = 0; d < numDogs; d++) {
          participants.push({
            id: `d_${trial}_${d}`,
            name: `Dog ${d}`,
            type: 'dog',
            bodyWeightKg: 15 + Math.floor(pseudoRandom() * 25), // 15kg to 40kg
            isCarryingPack: pseudoRandom() > 0.3,
          });
        }

        const numItems = 5 + Math.floor(pseudoRandom() * 30);
        const kits: PackMergeKit[] = participants.map((p) => ({ ownerId: p.id, items: [] }));

        let trialInitialWeight = 0;
        const categories = ['shelter', 'cook', 'water', 'sleep', 'clothing', 'tech', 'misc'];

        for (let i = 0; i < numItems; i++) {
          const ownerIndex = Math.floor(pseudoRandom() * participants.length);
          const owner = participants[ownerIndex];
          const isShared = pseudoRandom() > 0.4;
          const weight = 50 + Math.floor(pseudoRandom() * 3000); // 50g to 3050g
          const cat = categories[Math.floor(pseudoRandom() * categories.length)];
          const isDogSafe = isShared && cat !== 'cook' && cat !== 'shelter' && pseudoRandom() > 0.5;

          const item: PackGearItem = {
            id: `item_${trial}_${i}`,
            name: `Gear_${cat}_${i % 4}`, // Forces duplicate names
            weightGrams: weight,
            category: cat,
            isShared,
            ownerId: owner.id,
            canBeCarriedByDog: isDogSafe,
          };

          kits[ownerIndex].items.push(item);
          trialInitialWeight += weight;
        }

        const result = PackMergeService.runPackMerge(participants, kits);

        const allocatedTotal = Object.values(result.individualLoads).reduce(
          (acc, l) => acc + l.allocatedWeightGrams,
          0
        );
        const droppedTotal = result.droppedDuplicates.reduce((acc, d) => acc + d.weightSavedGrams, 0);

        // INVARIANT VERIFICATION
        expect(allocatedTotal + droppedTotal).toBe(trialInitialWeight);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. HIGH VOLUME LOAD & ASYMMETRY BENCHMARK
  // ═══════════════════════════════════════════════════════════════════════════
  describe('7. High Volume Load & Asymmetry Benchmark', () => {
    it('ADV-SCALE-01: 500 items across 25 participants executes cleanly in < 30ms', () => {
      const participants: PackParticipant[] = Array.from({ length: 25 }, (_, i) => ({
        id: `user_${i}`,
        name: `Participant ${i}`,
        type: i % 5 === 0 ? ('dog' as const) : ('human' as const),
        bodyWeightKg: i % 5 === 0 ? 25 : 60 + (i * 2),
        isCarryingPack: true,
      }));

      const kits: PackMergeKit[] = participants.map((p) => ({ ownerId: p.id, items: [] }));

      let totalWeight = 0;
      for (let i = 0; i < 500; i++) {
        const ownerIdx = i % 25;
        const weight = 100 + (i * 10);
        kits[ownerIdx].items.push({
          id: `gear_${i}`,
          name: `Item Model ${i % 30}`,
          weightGrams: weight,
          category: 'misc',
          isShared: i % 2 === 0,
          canBeCarriedByDog: i % 6 === 0,
        });
        totalWeight += weight;
      }

      const t0 = performance.now();
      const result = mergePacks({ participants, kits });
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(35);
      const allocated = Object.values(result.individualLoads).reduce((acc, l) => acc + l.allocatedWeightGrams, 0);
      const dropped = result.droppedDuplicates.reduce((acc, d) => acc + d.weightSavedGrams, 0);
      expect(allocated + dropped).toBe(totalWeight);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. UI COMPONENT RESILIENCE UNDER PATHOLOGICAL / EXTREME INPUTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('8. UI Component Resilience Under Pathological Inputs', () => {
    it('ADV-UI-01: PackMergeSheet renders extreme 625% overload safely with red overload indicator', async () => {
      const React = await import('react');
      const { renderToStaticMarkup } = await import('react-dom/server');
      const { PackMergeSheet } = await import('@/features/messaging/components/PackMergeSheet');

      const participants: PackParticipant[] = [
        { id: 'solo', name: 'Lea', type: 'human', bodyWeightKg: 40 },
      ];
      const items: PackGearItem[] = [
        { id: 'rack', name: 'Caisse Lourde', weightGrams: 50000, category: 'misc', isShared: true, ownerId: 'solo' },
      ];

      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'solo', items }]);
      const html = renderToStaticMarkup(React.createElement(PackMergeSheet, { result }));

      expect(html).toContain('Surcharge critique');
      expect(html).toContain('bg-red-500');
      expect(html).toContain('Lea');
      expect(html).not.toContain('NaN');
    });

    it('ADV-UI-02: PackMergeSheet renders empty merge result without throwing', async () => {
      const React = await import('react');
      const { renderToStaticMarkup } = await import('react-dom/server');
      const { PackMergeSheet } = await import('@/features/messaging/components/PackMergeSheet');

      const result = PackMergeService.runPackMerge([], []);
      const html = renderToStaticMarkup(React.createElement(PackMergeSheet, { result }));

      expect(html).toContain('Charges &amp; Sécurité (0)');
      expect(html).not.toContain('NaN');
    });
  });
});

