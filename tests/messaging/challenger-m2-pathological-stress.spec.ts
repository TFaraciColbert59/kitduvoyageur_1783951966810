/**
 * LKDV Social — Milestone 2: Challenger Pathological Stress Test Suite
 * File: tests/messaging/challenger-m2-pathological-stress.spec.ts
 *
 * EMPIRICAL ADVERSARIAL CHALLENGER SUITE:
 * 1. Floating-Point Weight Rounding & Precision Invariants
 * 2. Extreme Dog Pack Caps & Multi-Canine Group Allocations
 * 3. Edge-Case Group Compositions & Mass Conservation Invariants
 */

import { describe, it, expect } from 'vitest';
import {
  PackMergeService,
  computeKitPreviewMergeResult,
  type PackParticipant,
  type PackGearItem,
  type PackMergeKit,
} from '@/features/messaging/domain/packMerge';

describe('Challenger M2 Pathological Stress Tests', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. FLOATING-POINT WEIGHT ROUNDING & PRECISION INVARIANTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Floating-Point Weight Rounding & Precision Invariants', () => {
    it('CHALLENGE-FP-01: Irrational and fractional body weights do not yield NaN, Infinity, or precision drift', () => {
      const participants: PackParticipant[] = [
        { id: 'h_fractional', name: 'Fractional Human', type: 'human', bodyWeightKg: 68.33333333333333 },
        { id: 'd_fractional', name: 'Fractional Dog', type: 'dog', bodyWeightKg: 13.66666666666667, isCarryingPack: true },
      ];

      const kits: PackMergeKit[] = [
        {
          ownerId: 'h_fractional',
          items: [
            { id: 'item_1', name: 'Item Alpha', weightGrams: 3333, category: 'misc', isShared: true },
            { id: 'kibble_1', name: 'Croquettes Bio', weightGrams: 1555, category: 'cook', isShared: true, canBeCarriedByDog: true },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);
      const hLoad = result.individualLoads['h_fractional'];
      const dLoad = result.individualLoads['d_fractional'];

      // Checks for Human
      expect(Number.isFinite(hLoad.maxSafeWeightKg)).toBe(true);
      expect(Number.isFinite(hLoad.allocatedWeightKg)).toBe(true);
      expect(Number.isFinite(hLoad.actualRatio)).toBe(true);
      expect(Number.isFinite(hLoad.loadPercentage)).toBe(true);
      expect(Number.isNaN(hLoad.actualRatio)).toBe(false);
      expect(Number.isNaN(hLoad.loadPercentage)).toBe(false);

      // Checks for Dog
      expect(Number.isFinite(dLoad.maxSafeWeightKg)).toBe(true);
      expect(Number.isFinite(dLoad.allocatedWeightKg)).toBe(true);
      expect(Number.isFinite(dLoad.actualRatio)).toBe(true);
      expect(Number.isFinite(dLoad.loadPercentage)).toBe(true);
      expect(Number.isNaN(dLoad.actualRatio)).toBe(false);
      expect(Number.isNaN(dLoad.loadPercentage)).toBe(false);

      // Group totals
      expect(Number.isFinite(result.totalSafeCapacityGrams)).toBe(true);
      expect(Number.isFinite(result.groupCapacityUtilizationPercentage)).toBe(true);
      expect(Number.isNaN(result.groupCapacityUtilizationPercentage)).toBe(false);

      // Strict mass conservation
      const initialTotal = 3333 + 1555;
      const allocatedTotal = hLoad.allocatedWeightGrams + dLoad.allocatedWeightGrams;
      const droppedTotal = result.droppedDuplicates.reduce((sum, d) => sum + d.weightSavedGrams, 0);
      expect(allocatedTotal + droppedTotal).toBe(initialTotal);
    });

    it('CHALLENGE-FP-02: Micro-weights and sub-gram accumulation maintain exact mass conservation', () => {
      const participants: PackParticipant[] = [
        { id: 'h1', name: 'Ultralight Hiker', type: 'human', bodyWeightKg: 70 },
      ];

      // 50 tiny items
      const items: PackGearItem[] = Array.from({ length: 50 }, (_, i) => ({
        id: `micro_${i}`,
        name: `Micro Object ${i}`,
        weightGrams: i % 2 === 0 ? 1 : 2,
        category: 'misc',
        isShared: true,
      }));

      const initialTotal = items.reduce((s, it) => s + it.weightGrams, 0);
      const result = PackMergeService.runPackMerge(participants, [{ ownerId: 'h1', items }]);

      const hLoad = result.individualLoads['h1'];
      const allocatedTotal = hLoad.allocatedWeightGrams;
      const droppedTotal = result.droppedDuplicates.reduce((s, d) => s + d.weightSavedGrams, 0);

      expect(allocatedTotal + droppedTotal).toBe(initialTotal);
      expect(result.totalGroupWeightGrams).toBe(initialTotal);
    });

    it('CHALLENGE-FP-03: Exact boundary thresholds: 1g under, exactly on, and 1g over maximum safe weight', () => {
      // 70kg human -> 20% = 14.0 kg = 14000g max safe
      const pOn: PackParticipant = { id: 'p_on', name: 'On Boundary', type: 'human', bodyWeightKg: 70 };
      const resOn = PackMergeService.runPackMerge([pOn], [
        { ownerId: 'p_on', items: [{ id: 'exact_14k', name: 'Exact 14kg', weightGrams: 14000, category: 'misc', isShared: true }] },
      ]);
      const loadOn = resOn.individualLoads['p_on'];
      expect(loadOn.isOverloaded).toBe(false);
      expect(loadOn.overloadGrams).toBe(0);

      const pUnder: PackParticipant = { id: 'p_under', name: 'Under Boundary', type: 'human', bodyWeightKg: 70 };
      const resUnder = PackMergeService.runPackMerge([pUnder], [
        { ownerId: 'p_under', items: [{ id: 'under_14k', name: '13999g', weightGrams: 13999, category: 'misc', isShared: true }] },
      ]);
      const loadUnder = resUnder.individualLoads['p_under'];
      expect(loadUnder.isOverloaded).toBe(false);
      expect(loadUnder.overloadGrams).toBe(0);

      const pOver: PackParticipant = { id: 'p_over', name: 'Over Boundary', type: 'human', bodyWeightKg: 70 };
      const resOver = PackMergeService.runPackMerge([pOver], [
        { ownerId: 'p_over', items: [{ id: 'over_14k', name: '14001g', weightGrams: 14001, category: 'misc', isShared: true }] },
      ]);
      const loadOver = resOver.individualLoads['p_over'];
      expect(loadOver.isOverloaded).toBe(true);
      expect(loadOver.overloadGrams).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. EXTREME DOG PACK CAPS & MULTI-CANINE ALLOCATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Extreme Dog Pack Caps & Multi-Canine Allocations', () => {
    it('CHALLENGE-DOG-01: maxWeightGramsOverride overrides default 15% canine ratio strictly', () => {
      // 30kg dog: default 15% is 4.5kg (4500g).
      // Custom veterinary cap: 1800g override.
      const dog: PackParticipant = {
        id: 'd_custom',
        name: 'Older Dog',
        type: 'dog',
        bodyWeightKg: 30,
        isCarryingPack: true,
        maxWeightGramsOverride: 1800,
      };

      const human: PackParticipant = {
        id: 'h1',
        name: 'Companion',
        type: 'human',
        bodyWeightKg: 70,
      };

      const kits: PackMergeKit[] = [
        {
          ownerId: 'h1',
          items: [
            { id: 'k1', name: 'Kibble Pack 1', weightGrams: 1500, category: 'cook', isShared: true, canBeCarriedByDog: true },
            { id: 'k2', name: 'Kibble Pack 2', weightGrams: 500, category: 'cook', isShared: true, canBeCarriedByDog: true },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge([dog, human], kits);
      const dLoad = result.individualLoads['d_custom'];
      const hLoad = result.individualLoads['h1'];

      // Dog maxSafeWeightKg is overridden to 1.8kg (1800g)
      expect(dLoad.maxSafeWeightKg).toBe(1.8);
      // Dog receives k1 (1500g). k2 (500g) would cause 2000g > 1800g, so k2 rolls over to human!
      expect(dLoad.allocatedWeightGrams).toBe(1500);
      expect(dLoad.isOverloaded).toBe(false);
      expect(hLoad.allocatedWeightGrams).toBe(500);
    });

    it('CHALLENGE-DOG-02: Multi-canine pack with mixed disabled and enabled dogs distributes fairly to dogs before humans', () => {
      const participants: PackParticipant[] = [
        { id: 'd_husky', name: 'Balto', type: 'dog', bodyWeightKg: 28, isCarryingPack: true }, // max safe: 4.2kg = 4200g
        { id: 'd_injured', name: 'Rover', type: 'dog', bodyWeightKg: 20, isCarryingPack: false }, // max safe: 0g
        { id: 'd_terrier', name: 'Jack', type: 'dog', bodyWeightKg: 10, isCarryingPack: true }, // max safe: 1.5kg = 1500g
        { id: 'h_lead', name: 'Elena', type: 'human', bodyWeightKg: 65 }, // max safe: 13.0kg = 13000g
      ];

      // 4 dog items totaling 6200g:
      // item 1: 3000g, item 2: 1200g, item 3: 1000g, item 4: 1000g
      const kits: PackMergeKit[] = [
        {
          ownerId: 'h_lead',
          items: [
            { id: 'k1', name: 'Croquettes 3kg', weightGrams: 3000, category: 'cook', isShared: true, canBeCarriedByDog: true },
            { id: 'k2', name: 'Croquettes 1.2kg', weightGrams: 1200, category: 'cook', isShared: true, canBeCarriedByDog: true },
            { id: 'k3', name: 'Croquettes 1kg', weightGrams: 1000, category: 'cook', isShared: true, canBeCarriedByDog: true },
            { id: 'k4', name: 'Gamelles & Jouets', weightGrams: 1000, category: 'misc', isShared: true, canBeCarriedByDog: true },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);

      // Injured dog MUST have 0g
      expect(result.individualLoads['d_injured'].allocatedWeightGrams).toBe(0);
      expect(result.individualLoads['d_injured'].assignedItems.length).toBe(0);

      // Husky and Terrier receive dog items without exceeding physiological caps
      expect(result.individualLoads['d_husky'].allocatedWeightGrams).toBeLessThanOrEqual(4200);
      expect(result.individualLoads['d_husky'].isOverloaded).toBe(false);

      expect(result.individualLoads['d_terrier'].allocatedWeightGrams).toBeLessThanOrEqual(1500);
      expect(result.individualLoads['d_terrier'].isOverloaded).toBe(false);

      // Mass conservation check
      const totalInitial = 3000 + 1200 + 1000 + 1000;
      const totalAllocated = Object.values(result.individualLoads).reduce(
        (acc, l) => acc + l.allocatedWeightGrams,
        0
      );
      expect(totalAllocated).toBe(totalInitial);
    });

    it('CHALLENGE-DOG-03: Dog-only expedition with dog items exceeding dog capacity quarantines overflow with warnings', () => {
      const participants: PackParticipant[] = [
        { id: 'd_solo', name: 'Solo Dog', type: 'dog', bodyWeightKg: 20, isCarryingPack: true }, // max safe: 3000g
      ];

      const kits: PackMergeKit[] = [
        {
          ownerId: 'd_solo',
          items: [
            { id: 'k_fits', name: 'Kibble Fit', weightGrams: 2500, category: 'cook', isShared: true, canBeCarriedByDog: true },
            { id: 'k_overflow', name: 'Kibble Too Heavy', weightGrams: 2000, category: 'cook', isShared: true, canBeCarriedByDog: true },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);

      // Dog only takes k_fits (2500g <= 3000g)
      expect(result.individualLoads['d_solo'].allocatedWeightGrams).toBe(2500);
      expect(result.individualLoads['d_solo'].isOverloaded).toBe(false);

      // Overflow item cannot be carried by humans (0 humans), so it is dropped
      const droppedIds = result.droppedDuplicates.flatMap((d) => d.droppedItemIds);
      expect(droppedIds).toContain('k_overflow');

      // Mass conservation
      const initialTotal = 4500;
      const allocated = result.individualLoads['d_solo'].allocatedWeightGrams;
      const dropped = result.droppedDuplicates.reduce((s, d) => s + d.weightSavedGrams, 0);
      expect(allocated + dropped).toBe(initialTotal);

      // Warning present
      expect(result.warnings.some((w) => w.includes('aucun participant humain disponible'))).toBe(true);
    });

    it('CHALLENGE-DOG-04: Non-canine dangerous items (stoves, shelters) in dog-only group are strictly quarantined', () => {
      const participants: PackParticipant[] = [
        { id: 'd1', name: 'Rex', type: 'dog', bodyWeightKg: 30, isCarryingPack: true },
      ];

      const kits: PackMergeKit[] = [
        {
          ownerId: 'd1',
          items: [
            { id: 'stove_danger', name: 'Jetboil Flash', weightGrams: 371, category: 'cook', isShared: true },
            { id: 'tent_danger', name: 'Tarp Silnylon', weightGrams: 450, category: 'shelter', isShared: true },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);
      const rexLoad = result.individualLoads['d1'];

      // Rex must carry 0g of dangerous non-canine items
      expect(rexLoad.allocatedWeightGrams).toBe(0);
      expect(rexLoad.assignedItems.length).toBe(0);

      // All dangerous items quarantined into dropped duplicates
      expect(result.droppedDuplicates.length).toBe(2);
    });

    it('CHALLENGE-BUG-01: Disabled dog (isCarryingPack: false) with maxWeightGramsOverride must NOT be allocated gear or have non-zero capacity', () => {
      const participants: PackParticipant[] = [
        { id: 'h1', name: 'Alice', type: 'human', bodyWeightKg: 70 },
        { id: 'd_disabled_override', name: 'Rover', type: 'dog', bodyWeightKg: 25, isCarryingPack: false, maxWeightGramsOverride: 500 },
      ];

      const kits: PackMergeKit[] = [
        {
          ownerId: 'd_disabled_override',
          items: [
            { id: 'kibble', name: 'Croquettes', weightGrams: 400, category: 'cook', isShared: false, ownerId: 'd_disabled_override', canBeCarriedByDog: true },
          ],
        },
      ];

      const result = PackMergeService.runPackMerge(participants, kits);
      const dLoad = result.individualLoads['d_disabled_override'];

      expect(dLoad.maxSafeWeightKg).toBe(0);
      expect(dLoad.allocatedWeightGrams).toBe(0);
    });

    it('CHALLENGE-BUG-02: Explicit override of 0g (medical restriction) must not be ignored in favor of default capacity', () => {
      const p: PackParticipant = { id: 'h_injured', name: 'Injured Human', type: 'human', bodyWeightKg: 70, maxWeightGramsOverride: 0 };
      const res = PackMergeService.runPackMerge([p], []);
      // Safety Invariant: Explicit 0g override must yield 0.0 kg max safe capacity, not default 14.0 kg
      expect(res.individualLoads['h_injured'].maxSafeWeightKg).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. PREVIEW GENERATOR & ROBUSTNESS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Preview Generator & Live Card Robustness', () => {
    it('CHALLENGE-PREV-01: computeKitPreviewMergeResult with empty/sparse KitSnapshot generates valid result', () => {
      const emptySnapshot = {
        type: 'kit_snapshot' as const,
        kitId: 'empty-kit',
        title: 'Kit Vide',
        totalWeightGrams: 0,
        itemCount: 0,
        categories: [],
      };

      const result = computeKitPreviewMergeResult(emptySnapshot);

      expect(result.isGroupOverloaded).toBe(false);
      expect(result.totalGroupWeightGrams).toBe(0);
      expect(result.deduplicatedItems.length).toBe(0);
      expect(Object.keys(result.individualLoads).length).toBe(2); // 2 preview participants generated
    });

    it('CHALLENGE-PREV-02: computeKitPreviewMergeResult with realistic categories balances load between preview members', () => {
      const snap = {
        type: 'kit_snapshot' as const,
        kitId: 'kit-123',
        title: 'Bivouac Été',
        totalWeightGrams: 8000,
        itemCount: 4,
        categories: [
          { name: 'Abri', count: 1, weightGrams: 2500 },
          { name: 'Cuisine', count: 1, weightGrams: 1500 },
          { name: 'Couchage', count: 1, weightGrams: 3000 },
          { name: 'Sécurité', count: 1, weightGrams: 1000 },
        ],
      };

      const result = computeKitPreviewMergeResult(snap, { currentUserName: 'Clémence' });

      expect(result.totalGroupWeightGrams).toBe(8000);
      expect(result.groupStats.totalOptimizedWeightGrams).toBe(8000);
      expect(result.individualLoads['teammate-1'].name).toBe('Clémence');

      const p1Weight = result.individualLoads['kit-owner'].allocatedWeightGrams;
      const p2Weight = result.individualLoads['teammate-1'].allocatedWeightGrams;
      expect(p1Weight).toBeGreaterThan(0);
      expect(p2Weight).toBeGreaterThan(0);
      expect(p1Weight + p2Weight).toBe(8000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. RANDOMIZED PROPERTY-BASED FUZZING (100 ITERATIONS)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Randomized Property-Based Fuzzing (100 Iterations)', () => {
    it('CHALLENGE-FUZZ-01: 100 randomized expeditions preserve all physical and safety invariants', () => {
      // Deterministic seed PRNG
      let seed = 123456789;
      function rnd(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let iteration = 0; iteration < 100; iteration++) {
        // Generate random participants (0 to 6)
        const participantCount = Math.floor(rnd() * 7);
        const participants: PackParticipant[] = [];
        for (let i = 0; i < participantCount; i++) {
          const isDog = rnd() < 0.35;
          const isCarrying = isDog ? rnd() > 0.3 : true;
          const bodyWeight = isDog ? 5 + rnd() * 45 : 45 + rnd() * 60;
          // Note: hasOverride restricted to carrying dogs here to allow general invariant verification;
          // the disabled dog + override vulnerability is isolated in CHALLENGE-BUG-01.
          const hasOverride = isDog && isCarrying && rnd() < 0.25;
          participants.push({
            id: `p_${i}`,
            name: `${isDog ? 'Dog' : 'Human'}_${i}`,
            type: isDog ? 'dog' : 'human',
            isDog,
            bodyWeightKg: bodyWeight,
            isCarryingPack: isCarrying,
            maxWeightGramsOverride: hasOverride ? Math.floor(rnd() * 3000) : undefined,
          });
        }

        // Generate random kits
        const kitCount = Math.floor(rnd() * 5);
        const kits: PackMergeKit[] = [];
        let totalInitialWeightGrams = 0;

        for (let k = 0; k < kitCount; k++) {
          const ownerId = rnd() < 0.8 && participants.length > 0
            ? participants[Math.floor(rnd() * participants.length)].id
            : `absent_owner_${k}`;

          const itemCount = Math.floor(rnd() * 8);
          const items: PackGearItem[] = [];

          for (let j = 0; j < itemCount; j++) {
            const itemType = rnd();
            let cat = 'misc';
            let name = `Item_${k}_${j}`;
            let canBeDog = false;

            if (itemType < 0.2) {
              cat = 'shelter';
              name = `Tente_${j}`;
            } else if (itemType < 0.4) {
              cat = 'cook';
              name = `Rechaud_${j}`;
            } else if (itemType < 0.6) {
              cat = 'cook';
              name = `Croquettes_${j}`;
              canBeDog = true;
            } else if (itemType < 0.8) {
              cat = 'water';
              name = `Gourde_${j}`;
            }

            const weightGrams = Math.floor(10 + rnd() * 3000);
            const isShared = rnd() < 0.6;

            items.push({
              id: `item_${k}_${j}`,
              name,
              weightGrams,
              category: cat,
              isShared,
              ownerId,
              canBeCarriedByDog: canBeDog,
            });
            totalInitialWeightGrams += weightGrams;
          }

          kits.push({ ownerId, items });
        }

        const result = PackMergeService.runPackMerge(participants, kits);

        // Invariant 1: Exact Mass Conservation
        const totalAllocated = Object.values(result.individualLoads).reduce(
          (sum, l) => sum + l.allocatedWeightGrams,
          0
        );
        const totalDropped = result.droppedDuplicates.reduce(
          (sum, d) => sum + d.weightSavedGrams,
          0
        );
        expect(totalAllocated + totalDropped).toBe(totalInitialWeightGrams);

        // Invariant 2: Group Total matches Sum of Loads
        expect(result.totalGroupWeightGrams).toBe(totalAllocated);

        // Invariant 3: Disabled dogs carry 0g
        for (const p of participants) {
          if (p.isDog && p.isCarryingPack === false) {
            const l = result.individualLoads[p.id];
            expect(l.allocatedWeightGrams).toBe(0);
          }
        }

        // Invariant 4: No NaN in any metric
        expect(Number.isNaN(result.totalGroupWeightGrams)).toBe(false);
        expect(Number.isNaN(result.totalSafeCapacityGrams)).toBe(false);
        expect(Number.isNaN(result.groupCapacityUtilizationPercentage)).toBe(false);

        for (const l of Object.values(result.individualLoads)) {
          expect(Number.isNaN(l.allocatedWeightKg)).toBe(false);
          expect(Number.isNaN(l.actualRatio)).toBe(false);
          expect(Number.isNaN(l.loadPercentage)).toBe(false);
        }

        // Invariant 5: No dog carries stoves or shelters
        for (const p of participants) {
          if (p.isDog) {
            const l = result.individualLoads[p.id];
            for (const item of l.assignedItems) {
              const nameLower = item.name.toLowerCase();
              expect(nameLower.includes('rechaud')).toBe(false);
              expect(nameLower.includes('tente')).toBe(false);
            }
          }
        }
      }
    });
  });
});

