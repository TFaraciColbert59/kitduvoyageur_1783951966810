# Proposed PackMerge Fixes — Milestone 2 Remediation

**Target File**: `src/features/messaging/domain/packMerge.ts`  
**Author**: `explorer_m2_remediation_domain_1`  
**Target Milestone**: M2 (Pack Merge & Load Distribution Engine)  
**Goal**: Make all 20/20 tests in `tests/messaging/adversarial-packmerge-stress.spec.ts` pass while maintaining 100% (36/36) passing tests in `tests/messaging/outdoor-live-cards.spec.ts`.

---

## 1. Executive Summary of Changes

The proposed remediation consists of 5 targeted surgical adjustments in `src/features/messaging/domain/packMerge.ts`:

1. **Boundary check for empty participants list (`participants.length === 0`)**:
   - Accounts for all `retainedItems` in `droppedDecisions` (marking them unassigned) when participants is empty, preserving the mass conservation invariant `Allocated + Dropped === Initial Total`. Emits an explicit unallocated gear warning (`ADV-EDGE-02`).
2. **Canine Eligibility Classifier (`isItemDogEligible`)**:
   - Explicitly rejects items with `canBeCarriedByDog === false` or hazardous gear (stoves, shelters) from canine portage. Ensures dog items (kibble, bowls, dog coats) are eligible.
3. **Personal Gear Assignment Hardening (Step 4)**:
   - For absent/unknown owners (`!ownerLoad`), personal gear is quarantined into `droppedDecisions` (unassigned) with an explicit warning, never leaking into `unassignedSharedItems` or being re-assigned to other hikers (`ADV-PERS-03`).
   - For canine owners (`ownerLoad.isDog`), verifies canine physiological portage ability (`ownerLoad.maxSafeWeightKg > 0`) and item eligibility. If canine portage is disabled (`isCarryingPack: false`, `ADV-DOG-02`) or item is non-canine (`ADV-GEAR-03`), safely reallocates personal gear to available human companions with an explicit warning, or quarantines it if no humans are present.
4. **Canine & Human Gear Partitioning (Step 5)**:
   - Uses `isItemDogEligible` to guarantee hazardous equipment never enters `dogItems`.
5. **Dog-Only Group Fallback Elimination (Step 7)**:
   - If `humans.length === 0`, human-only equipment is NEVER assigned to canines (`validParticipants[0]`). Items are quarantined into `droppedDecisions` with a critical warning: `Impossible d'assigner l'équipement ... : aucun participant humain disponible` (`ADV-GEAR-02`).

---

## 2. Surgical Code Diffs

### Diff 1: Canine Eligibility Classifier & Stove Refinement (Lines 224-293)

```diff
 export function isStoveItem(item: PackGearItem): boolean {
+  const name = normalizeStr(item.name || '');
+  if (name.includes('croquette') || name.includes('kibble') || name.includes('chien') || name.includes('dog')) {
+    return false;
+  }
   const cat = normalizeStr(item.category || '');
-  const name = normalizeStr(item.name || '');
   return (
     cat.includes('cook') ||
     cat.includes('cuisine') ||
     name.includes('rechaud') ||
     name.includes('stove') ||
     name.includes('jetboil') ||
     name.includes('pocketrocket') ||
     name.includes('popote')
   );
 }

 export function isDogSpecificItem(item: PackGearItem): boolean {
+  if (item.canBeCarriedByDog === false) return false;
   if (item.canBeCarriedByDog || item.isDogItem) return true;
   const name = normalizeStr(item.name || '');
   return (
     name.includes('chien') ||
     name.includes('dog') ||
     name.includes('croquette') ||
     name.includes('gamelle chien') ||
     name.includes('harnais bat') ||
     name.includes('bottines chien')
   );
 }
+
+export function isItemDogEligible(item: PackGearItem): boolean {
+  if (item.canBeCarriedByDog === false) return false;
+  if (item.canBeCarriedByDog === true || item.isDogItem === true) return true;
+  if (isStoveItem(item) || isShelterItem(item)) return false;
+  return isDogSpecificItem(item);
+}
```

---

### Diff 2: Empty Participants Mass Conservation Guard (After Step 2, Lines 393-398)

```diff
     // 2. Deduplicate shared gear
     const { retainedItems, droppedDecisions, weightSavedGrams } =
       this.deduplicateSharedGear(allItems);
+    let currentWeightSavedGrams = weightSavedGrams;
+
+    // Boundary check: empty participants list (ADV-EDGE-01, ADV-EDGE-02, ADV-UI-02)
+    if (participants.length === 0) {
+      const emptyWarnings: string[] = [];
+      if (allItems.length > 0) {
+        for (const item of retainedItems) {
+          currentWeightSavedGrams += item.weightGrams;
+          droppedDecisions.push({
+            keptItemId: '',
+            droppedItemIds: [item.id],
+            category: item.category,
+            name: item.name,
+            weightSavedGrams: item.weightGrams,
+            rationale: "Matériel non alloué : aucun participant dans l'expédition",
+            id: item.id,
+            reason: `Non assigné : aucun participant (${item.weightGrams}g non portés)`,
+            originalOwnerId: item.ownerId,
+          });
+        }
+        emptyWarnings.push(
+          `Aucun participant pour porter le matériel (${(totalOriginalWeightGrams / 1000).toFixed(1)} kg non assignés)`
+        );
+      }
+      return {
+        deduplicatedItems: [],
+        droppedDuplicates: droppedDecisions,
+        removedDuplicates: droppedDecisions,
+        individualLoads: {},
+        totalGroupWeightGrams: 0,
+        totalSafeCapacityGrams: 0,
+        groupCapacityUtilizationPercentage: 0,
+        isGroupOverloaded: false,
+        warnings: emptyWarnings,
+        metrics: {
+          weightSavedDeduplicationGrams: currentWeightSavedGrams,
+          humanCount: 0,
+          dogCount: 0,
+          sharedItemCount: 0,
+          personalItemCount: 0,
+        },
+        groupStats: {
+          totalOriginalWeightGrams,
+          totalOptimizedWeightGrams: 0,
+          weightSavedGrams: currentWeightSavedGrams,
+          weightSavedKg: Math.round((currentWeightSavedGrams / 1000) * 10) / 10,
+          duplicateCount: droppedDecisions.length,
+          itemCountOriginal: allItems.length,
+          itemCountOptimized: 0,
+          overloadedCount: 0,
+        },
+        participantLoads: [],
+      };
+    }
```

---

### Diff 3: Personal Gear Step 4 Hardening (Lines 470-496)

```diff
     // 4. Assign personal items to owners first
+    const humans = validParticipants.filter((p) => !p.isDog);
     const unassignedSharedItems: PackGearItem[] = [];

     for (const item of retainedItems) {
       if (!item.isShared) {
         const ownerLoad = loads[item.ownerId || ''];
-        if (ownerLoad) {
+        if (!ownerLoad) {
+          // Absent owner (ADV-PERS-03)
+          droppedDecisions.push({
+            keptItemId: '',
+            droppedItemIds: [item.id],
+            category: item.category,
+            name: item.name,
+            weightSavedGrams: item.weightGrams,
+            rationale: `Équipement personnel non assigné : propriétaire (${item.ownerId}) absent de l'expédition`,
+            id: item.id,
+            reason: `Propriétaire absent (${item.weightGrams}g non portés)`,
+            originalOwnerId: item.ownerId,
+          });
+          currentWeightSavedGrams += item.weightGrams;
+          warnings.push(
+            `Équipement personnel "${item.name}" ignoré : le propriétaire (${item.ownerId}) ne fait pas partie des participants.`
+          );
+        } else if (ownerLoad.isDog) {
+          // Canine personal equipment (ADV-DOG-02, ADV-GEAR-03)
+          const canDogCarry =
+            ownerLoad.maxSafeWeightKg > 0 &&
+            isItemDogEligible(item);
+
+          if (canDogCarry) {
+            const rec: AssignedItem = {
+              itemId: item.id,
+              id: item.id,
+              name: item.name,
+              weightGrams: item.weightGrams,
+              assignedParticipantId: ownerLoad.participantId,
+              assignedParticipantName: ownerLoad.name,
+              category: item.category,
+              isShared: false,
+            };
+            ownerLoad.assignedItems.push(rec);
+            ownerLoad.items.push(rec);
+            ownerLoad.allocatedWeightGrams += item.weightGrams;
+            ownerLoad.personalWeightGrams += item.weightGrams;
+          } else {
+            // Relieve dog: transfer to human companion or quarantine if dog-only
+            if (humans.length > 0) {
+              humans.sort((a, b) => {
+                const capA = Math.max(1, loads[a.id].maxSafeWeightKg * 1000);
+                const capB = Math.max(1, loads[b.id].maxSafeWeightKg * 1000);
+                return loads[a.id].allocatedWeightGrams / capA - loads[b.id].allocatedWeightGrams / capB;
+              });
+              const targetHuman = humans[0];
+              const hLoad = loads[targetHuman.id];
+              const rec: AssignedItem = {
+                itemId: item.id,
+                id: item.id,
+                name: item.name,
+                weightGrams: item.weightGrams,
+                assignedParticipantId: targetHuman.id,
+                assignedParticipantName: hLoad.name,
+                category: item.category,
+                isShared: false,
+                reason: `Pris en charge pour ${ownerLoad.name} (sécurité ou portage canin désactivé)`,
+              };
+              hLoad.assignedItems.push(rec);
+              hLoad.items.push(rec);
+              hLoad.allocatedWeightGrams += item.weightGrams;
+              hLoad.personalWeightGrams += item.weightGrams;
+              warnings.push(
+                `Équipement personnel "${item.name}" de ${ownerLoad.name} pris en charge par ${hLoad.name} (portage canin inadapté ou désactivé).`
+              );
+            } else {
+              droppedDecisions.push({
+                keptItemId: '',
+                droppedItemIds: [item.id],
+                category: item.category,
+                name: item.name,
+                weightSavedGrams: item.weightGrams,
+                rationale: "Équipement non assignable : portage canin impossible et aucun humain disponible",
+                id: item.id,
+                reason: `Non assignable : aucun humain (${item.weightGrams}g non portés)`,
+                originalOwnerId: item.ownerId,
+              });
+              currentWeightSavedGrams += item.weightGrams;
+              warnings.push(
+                `Impossible d'assigner l'équipement "${item.name}" : portage canin impossible et aucun participant humain disponible.`
+              );
+            }
+          }
+        } else {
           const rec: AssignedItem = {
             itemId: item.id,
             id: item.id,
             name: item.name,
             weightGrams: item.weightGrams,
             assignedParticipantId: ownerLoad.participantId,
             assignedParticipantName: ownerLoad.name,
             category: item.category,
             isShared: false,
           };
           ownerLoad.assignedItems.push(rec);
           ownerLoad.items.push(rec);
           ownerLoad.allocatedWeightGrams += item.weightGrams;
           ownerLoad.personalWeightGrams += item.weightGrams;
-        } else {
-          unassignedSharedItems.push(item);
         }
       } else {
         unassignedSharedItems.push(item);
       }
     }
```

---

### Diff 4: Step 5 & Step 7 Canine Isolation and Dog-Only Group Guard (Lines 498-578)

```diff
     // 5. Separate dog-eligible shared items from human-only items
-    const dogItems = unassignedSharedItems.filter((i) => i.canBeCarriedByDog === true || i.isDogItem === true);
-    const humanItems = unassignedSharedItems.filter((i) => !i.canBeCarriedByDog && !i.isDogItem);
+    const dogItems = unassignedSharedItems.filter((i) => isItemDogEligible(i));
+    const humanItems = unassignedSharedItems.filter((i) => !isItemDogEligible(i));

     // 6. Proportional allocation to dogs first (up to dog limit)
...
     // 7. Sort human items descending by weight for bin packing
     humanItems.sort((a, b) => b.weightGrams - a.weightGrams);

-    const humans = validParticipants.filter((p) => !p.isDog);
     const guide = humans.find((h) => h.role === 'guide');
     const medic = humans.find((h) => h.role === 'medic');

+    if (humans.length === 0) {
+      // Dog-only expedition with human gear (ADV-GEAR-02)
+      for (const item of humanItems) {
+        droppedDecisions.push({
+          keptItemId: '',
+          droppedItemIds: [item.id],
+          category: item.category,
+          name: item.name,
+          weightSavedGrams: item.weightGrams,
+          rationale: "Matériel non assignable : aucun participant humain disponible",
+          id: item.id,
+          reason: `Non assignable : aucun humain (${item.weightGrams}g non portés)`,
+          originalOwnerId: item.ownerId,
+        });
+        currentWeightSavedGrams += item.weightGrams;
+        warnings.push(
+          `Impossible d'assigner l'équipement "${item.name}" : aucun participant humain disponible.`
+        );
+      }
+    } else {
       for (const item of humanItems) {
         let targetHumanId: string;

         // Guides / Medics prioritize vital / safety gear
         if (
           item.isVital &&
           guide &&
           loads[guide.id].allocatedWeightGrams + item.weightGrams <= loads[guide.id].maxSafeWeightKg * 1000
         ) {
           targetHumanId = guide.id;
         } else if (
           isFirstAidItem(item) &&
           medic &&
           loads[medic.id].allocatedWeightGrams + item.weightGrams <= loads[medic.id].maxSafeWeightKg * 1000
         ) {
           targetHumanId = medic.id;
         } else {
           // Proportional water-filling across humans based on safe capacity
           humans.sort((a, b) => {
             const capA = Math.max(1, loads[a.id].maxSafeWeightKg * 1000);
             const capB = Math.max(1, loads[b.id].maxSafeWeightKg * 1000);
             const pctA = loads[a.id].allocatedWeightGrams / capA;
             const pctB = loads[b.id].allocatedWeightGrams / capB;
             return pctA - pctB;
           });
-          targetHumanId = humans[0]?.id || validParticipants[0]?.id;
+          targetHumanId = humans[0].id;
         }

         const hLoad = loads[targetHumanId];
         if (hLoad) {
           const rec: AssignedItem = {
             itemId: item.id,
             id: item.id,
             name: item.name,
             weightGrams: item.weightGrams,
             assignedParticipantId: targetHumanId,
             assignedParticipantName: hLoad.name,
             category: item.category,
             isShared: true,
           };
           hLoad.assignedItems.push(rec);
           hLoad.items.push(rec);
           hLoad.allocatedWeightGrams += item.weightGrams;
           hLoad.sharedWeightGrams += item.weightGrams;
         }
       }
+    }
```

---

## 3. Complete Proposed Replacement File for `src/features/messaging/domain/packMerge.ts`

```typescript
/**
 * LKDV Social — Pack Merge & Group Load Distribution Engine
 * File: src/features/messaging/domain/packMerge.ts
 *
 * Implements Milestone 2 Pack Merge Engine:
 * 1. Collective Gear Deduplication:
 *    - Tents/shelters, stoves, water filters, medical kits deduplication.
 *    - Preserves personal gear strictly. Retains lightest/most optimal shared item.
 * 2. Physiological Load Balancing:
 *    - Integrates with `src/features/preparation/services/loadDistribution.ts`.
 *    - 20% max body weight ratio for humans, 15% for dogs.
 *    - Canine portage eligibility enforcement (strictly safe items, 0g for non-carrying dogs).
 *    - Role-aware distribution (guides/medics prioritize vital equipment).
 *    - Proportional water-filling load balancing.
 * 3. Overload Warnings:
 *    - Explicit human-readable warnings for individual and group capacity deficits.
 */

import {
  DEFAULT_HUMAN_MAX_RATIO,
  DEFAULT_DOG_PORTAGE_RATIO,
  calculateDogMaxPackWeight,
} from '@/features/preparation/services/loadDistribution';
import type { ParticipantLoad } from '@/features/preparation/types/preparation.types';

// ============================================================================
// 1. DATA CONTRACTS & TYPE DEFINITIONS
// ============================================================================

export type ParticipantRole =
  | 'guide'
  | 'medic'
  | 'scout'
  | 'member'
  | 'safety'
  | 'leader';

export interface PackParticipant {
  id: string;
  name: string;
  type?: 'human' | 'dog';
  isDog?: boolean;
  bodyWeightKg: number;
  role?: ParticipantRole;
  isCarryingPack?: boolean; // Dogs only (default: true)
  breed?: string;
  basePersonalWeightGrams?: number;
  maxWeightGramsOverride?: number;
}

export type PackMergeParticipant = PackParticipant;

export interface PackGearItem {
  id: string;
  name: string;
  weightGrams: number;
  category:
    | 'shelter'
    | 'sleep'
    | 'cook'
    | 'clothing'
    | 'water'
    | 'safety'
    | 'hygiene'
    | 'tech'
    | 'navigation'
    | 'misc'
    | string;
  isShared?: boolean;
  ownerId?: string;
  isVital?: boolean;
  canBeCarriedByDog?: boolean;
  isDogItem?: boolean;
  quantity?: number;
  capacityPeople?: number;
}

export type PackMergeItem = PackGearItem;

export interface PackMergeKit {
  ownerId: string;
  items: PackGearItem[];
}

export interface DeduplicationDecision {
  keptItemId: string;
  droppedItemIds: string[];
  category: string;
  name: string;
  weightSavedGrams: number;
  rationale: string;
  // Aliases for compatibility
  id?: string;
  reason?: string;
  originalOwnerId?: string;
}

export type RemovedDuplicateItem = DeduplicationDecision;

export interface AssignedItem {
  itemId: string;
  id?: string;
  name: string;
  weightGrams: number;
  assignedParticipantId: string;
  assignedParticipantName?: string;
  category: string;
  isShared: boolean;
  reason?: string;
}

export type DeduplicatedItemRecord = AssignedItem;

export interface IndividualLoadResult {
  participantId: string;
  name: string;
  type: 'human' | 'dog';
  isDog: boolean;
  bodyWeightKg: number;
  allocatedWeightGrams: number;
  allocatedWeightKg: number;
  maxSafeWeightKg: number;
  safeThresholdRatio: number; // 0.20 for human, 0.15 for dog
  actualRatio: number; // allocatedWeightKg / bodyWeightKg
  loadPercentage: number; // (allocatedWeightKg / maxSafeWeightKg) * 100
  isOverloaded: boolean;
  overloadGrams: number;
  assignedItems: AssignedItem[];
  roleOrBreed: string;
  role: ParticipantRole;
  personalWeightGrams: number;
  sharedWeightGrams: number;
  totalWeightGrams: number;
  totalWeightKg: number;
  bodyWeightRatio: number;
  items: AssignedItem[];
}

export type IndividualLoadSummary = IndividualLoadResult;

export interface GroupPackStats {
  totalOriginalWeightGrams: number;
  totalOptimizedWeightGrams: number;
  weightSavedGrams: number;
  weightSavedKg: number;
  duplicateCount: number;
  itemCountOriginal: number;
  itemCountOptimized: number;
  overloadedCount: number;
}

export interface PackMergeResult {
  deduplicatedItems: AssignedItem[];
  droppedDuplicates: DeduplicationDecision[];
  removedDuplicates: DeduplicationDecision[];
  individualLoads: Record<string, IndividualLoadResult>;
  totalGroupWeightGrams: number;
  totalSafeCapacityGrams: number;
  groupCapacityUtilizationPercentage: number;
  isGroupOverloaded: boolean;
  warnings: string[];
  metrics: {
    weightSavedDeduplicationGrams: number;
    humanCount: number;
    dogCount: number;
    sharedItemCount: number;
    personalItemCount: number;
  };
  groupStats: GroupPackStats;
  participantLoads: ParticipantLoad[];
}

export interface PackMergeOptions {
  targetHumanRatio?: number;
  targetDogRatio?: number;
  targetScoutRatio?: number;
  targetGuideRatio?: number;
  deduplicateShelters?: boolean;
  deduplicateStoves?: boolean;
  deduplicateWaterFilters?: boolean;
  deduplicateFirstAid?: boolean;
}

export interface PackMergeInput {
  participants: PackParticipant[];
  kits: PackMergeKit[];
  options?: PackMergeOptions;
}

export { DEFAULT_HUMAN_MAX_RATIO, DEFAULT_DOG_PORTAGE_RATIO };

// ============================================================================
// 2. HELPER CLASSIFIERS
// ============================================================================

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function isShelterItem(item: PackGearItem): boolean {
  const cat = normalizeStr(item.category || '');
  const name = normalizeStr(item.name || '');
  return (
    cat.includes('shelter') ||
    cat.includes('bivouac') ||
    cat.includes('abri') ||
    name.includes('tente') ||
    name.includes('tent') ||
    name.includes('tarp')
  );
}

export function extractTentCapacity(item: PackGearItem): number {
  if (item.capacityPeople && item.capacityPeople > 0) {
    return item.capacityPeople;
  }
  const name = normalizeStr(item.name || '');
  if (name.includes('3p') || name.includes('3 places') || name.includes('3 person')) return 3;
  if (name.includes('4p') || name.includes('4 places') || name.includes('4 person')) return 4;
  if (name.includes('1p') || name.includes('1 place') || name.includes('solo')) return 1;
  return 2;
}

export function isStoveItem(item: PackGearItem): boolean {
  const name = normalizeStr(item.name || '');
  if (name.includes('croquette') || name.includes('kibble') || name.includes('chien') || name.includes('dog')) {
    return false;
  }
  const cat = normalizeStr(item.category || '');
  return (
    cat.includes('cook') ||
    cat.includes('cuisine') ||
    name.includes('rechaud') ||
    name.includes('stove') ||
    name.includes('jetboil') ||
    name.includes('pocketrocket') ||
    name.includes('popote')
  );
}

export function isWaterFilterItem(item: PackGearItem): boolean {
  const cat = normalizeStr(item.category || '');
  const name = normalizeStr(item.name || '');
  return (
    (cat.includes('water') || cat.includes('hydrat')) &&
    (name.includes('filtre') ||
      name.includes('filter') ||
      name.includes('sawyer') ||
      name.includes('befree') ||
      name.includes('katadyn') ||
      name.includes('purifi') ||
      name.includes('micropur'))
  );
}

export function isFirstAidItem(item: PackGearItem): boolean {
  const cat = normalizeStr(item.category || '');
  const name = normalizeStr(item.name || '');
  return (
    cat.includes('safety') ||
    cat.includes('securit') ||
    name.includes('secours') ||
    name.includes('medical') ||
    name.includes('pharmacie') ||
    name.includes('first aid') ||
    name.includes('trousse') ||
    name.includes('trauma')
  );
}

export function isNavigationItem(item: PackGearItem): boolean {
  const cat = normalizeStr(item.category || '');
  const name = normalizeStr(item.name || '');
  return (
    cat.includes('navig') ||
    name.includes('gps') ||
    name.includes('inreach') ||
    name.includes('balise') ||
    name.includes('boussole') ||
    name.includes('carte') ||
    name.includes('topo')
  );
}

export function isDogSpecificItem(item: PackGearItem): boolean {
  if (item.canBeCarriedByDog === false) return false;
  if (item.canBeCarriedByDog || item.isDogItem) return true;
  const name = normalizeStr(item.name || '');
  return (
    name.includes('chien') ||
    name.includes('dog') ||
    name.includes('croquette') ||
    name.includes('gamelle chien') ||
    name.includes('harnais bat') ||
    name.includes('bottines chien')
  );
}

export function isItemDogEligible(item: PackGearItem): boolean {
  if (item.canBeCarriedByDog === false) return false;
  if (item.canBeCarriedByDog === true || item.isDogItem === true) return true;
  if (isStoveItem(item) || isShelterItem(item)) return false;
  return isDogSpecificItem(item);
}

// ============================================================================
// 3. PACK MERGE ENGINE
// ============================================================================

export class PackMergeService {
  /**
   * Deduplicates collective gear:
   * Keeps optimal item (lowest weight / highest utility) and drops redundant copies.
   * Personal items (isShared === false) are strictly immune to deduplication.
   */
  static deduplicateSharedGear(items: PackGearItem[]): {
    retainedItems: PackGearItem[];
    droppedDecisions: DeduplicationDecision[];
    weightSavedGrams: number;
  } {
    const retainedItems: PackGearItem[] = [];
    const droppedDecisions: DeduplicationDecision[] = [];
    let weightSavedGrams = 0;

    const sharedGroups = new Map<string, PackGearItem[]>();

    for (const item of items) {
      if (!item.isShared) {
        retainedItems.push(item);
      } else {
        const key = `${normalizeStr(item.category)}:${normalizeStr(item.name)}`;
        if (!sharedGroups.has(key)) {
          sharedGroups.set(key, []);
        }
        sharedGroups.get(key)!.push(item);
      }
    }

    for (const [, group] of sharedGroups.entries()) {
      if (group.length === 1) {
        retainedItems.push(group[0]);
      } else {
        // Sort ascending by weight (lightest item retained)
        group.sort((a, b) => a.weightGrams - b.weightGrams);
        const kept = group[0];
        const dropped = group.slice(1);
        retainedItems.push(kept);

        const groupWeightSaved = dropped.reduce((acc, d) => acc + d.weightGrams, 0);
        weightSavedGrams += groupWeightSaved;

        droppedDecisions.push({
          keptItemId: kept.id,
          droppedItemIds: dropped.map((d) => d.id),
          category: kept.category,
          name: kept.name,
          weightSavedGrams: groupWeightSaved,
          rationale: `Dédoublonnage matériel partagé : ${dropped.length} exemplaire(s) superflu(s) retiré(s)`,
          id: dropped[0]?.id,
          reason: `Dédoublonné : matériel identique optimisé (${groupWeightSaved}g économisés)`,
          originalOwnerId: dropped[0]?.ownerId,
        });
      }
    }

    return { retainedItems, droppedDecisions, weightSavedGrams };
  }

  /**
   * Runs the full Pack Merge load balancing and deduplication engine.
   */
  static runPackMerge(
    participants: PackParticipant[],
    kits: Array<{ ownerId: string; items: PackGearItem[] }>,
    options?: PackMergeOptions
  ): PackMergeResult {
    const targetHumanRatio = options?.targetHumanRatio ?? DEFAULT_HUMAN_MAX_RATIO;
    const targetDogRatio = options?.targetDogRatio ?? DEFAULT_DOG_PORTAGE_RATIO;

    // 1. Flatten all gear items
    const allItems: PackGearItem[] = [];
    let totalOriginalWeightGrams = 0;

    for (const kit of kits) {
      for (const item of kit.items) {
        const qty = item.quantity || 1;
        for (let i = 0; i < qty; i++) {
          const singleItem: PackGearItem = {
            ...item,
            id: qty > 1 ? `${item.id}-${i + 1}` : item.id,
            quantity: 1,
            ownerId: item.ownerId || kit.ownerId,
          };
          allItems.push(singleItem);
          totalOriginalWeightGrams += item.weightGrams;
        }
      }
    }

    // 2. Deduplicate shared gear
    const { retainedItems, droppedDecisions, weightSavedGrams: initialWeightSavedGrams } =
      this.deduplicateSharedGear(allItems);
    let weightSavedGrams = initialWeightSavedGrams;

    // Boundary check: empty participants list (ADV-EDGE-01, ADV-EDGE-02, ADV-UI-02)
    if (participants.length === 0) {
      const emptyWarnings: string[] = [];
      if (allItems.length > 0) {
        for (const item of retainedItems) {
          weightSavedGrams += item.weightGrams;
          droppedDecisions.push({
            keptItemId: '',
            droppedItemIds: [item.id],
            category: item.category,
            name: item.name,
            weightSavedGrams: item.weightGrams,
            rationale: "Matériel non alloué : aucun participant dans l'expédition",
            id: item.id,
            reason: `Non assigné : aucun participant (${item.weightGrams}g non portés)`,
            originalOwnerId: item.ownerId,
          });
        }
        emptyWarnings.push(
          `Aucun participant pour porter le matériel (${(totalOriginalWeightGrams / 1000).toFixed(1)} kg non assignés)`
        );
      }
      return {
        deduplicatedItems: [],
        droppedDuplicates: droppedDecisions,
        removedDuplicates: droppedDecisions,
        individualLoads: {},
        totalGroupWeightGrams: 0,
        totalSafeCapacityGrams: 0,
        groupCapacityUtilizationPercentage: 0,
        isGroupOverloaded: false,
        warnings: emptyWarnings,
        metrics: {
          weightSavedDeduplicationGrams: weightSavedGrams,
          humanCount: 0,
          dogCount: 0,
          sharedItemCount: 0,
          personalItemCount: 0,
        },
        groupStats: {
          totalOriginalWeightGrams,
          totalOptimizedWeightGrams: 0,
          weightSavedGrams,
          weightSavedKg: Math.round((weightSavedGrams / 1000) * 10) / 10,
          duplicateCount: droppedDecisions.length,
          itemCountOriginal: allItems.length,
          itemCountOptimized: 0,
          overloadedCount: 0,
        },
        participantLoads: [],
      };
    }

    // 3. Initialize participant loads with clamped safe limits
    const loads: Record<string, IndividualLoadResult> = {};
    let totalSafeCapacityGrams = 0;
    const warnings: string[] = [];

    const validParticipants = participants.map((p) => {
      const isDog = p.type === 'dog' || p.isDog === true;
      const type: 'human' | 'dog' = isDog ? 'dog' : 'human';
      const defaultWeight = isDog ? 20 : 70;
      const bodyWeight = p.bodyWeightKg > 0 ? p.bodyWeightKg : defaultWeight;

      let maxSafeKg = 0;
      let ratio = 0;

      if (!isDog) {
        ratio = targetHumanRatio;
        maxSafeKg = Math.round(bodyWeight * ratio * 10) / 10;
      } else {
        ratio = targetDogRatio;
        const canCarry = p.isCarryingPack !== false;
        maxSafeKg = canCarry
          ? calculateDogMaxPackWeight(bodyWeight, ratio)
          : 0;
      }

      if (p.maxWeightGramsOverride && p.maxWeightGramsOverride > 0) {
        maxSafeKg = Math.round((p.maxWeightGramsOverride / 1000) * 10) / 10;
      }

      totalSafeCapacityGrams += Math.round(maxSafeKg * 1000);

      const role: ParticipantRole = p.role || 'member';
      const roleOrBreed = isDog
        ? p.breed || 'Chien'
        : role === 'guide'
          ? 'Guide'
          : role === 'medic'
            ? 'Secouriste'
            : role === 'scout'
              ? 'Éclaireur'
              : 'Équipier';

      loads[p.id] = {
        participantId: p.id,
        name: p.name,
        type,
        isDog,
        bodyWeightKg: bodyWeight,
        allocatedWeightGrams: 0,
        allocatedWeightKg: 0,
        maxSafeWeightKg: maxSafeKg,
        safeThresholdRatio: ratio,
        actualRatio: 0,
        loadPercentage: 0,
        isOverloaded: false,
        overloadGrams: 0,
        assignedItems: [],
        roleOrBreed,
        role,
        personalWeightGrams: 0,
        sharedWeightGrams: 0,
        totalWeightGrams: 0,
        totalWeightKg: 0,
        bodyWeightRatio: 0,
        items: [],
      };

      return {
        ...p,
        isDog,
        type,
        bodyWeightKg: bodyWeight,
        maxSafeKg,
      };
    });

    const humans = validParticipants.filter((p) => !p.isDog);

    // 4. Assign personal items to owners first (ADV-DOG-02, ADV-GEAR-03, ADV-PERS-03)
    const unassignedSharedItems: PackGearItem[] = [];

    for (const item of retainedItems) {
      if (!item.isShared) {
        const ownerLoad = loads[item.ownerId || ''];
        if (!ownerLoad) {
          // Absent owner (ADV-PERS-03)
          droppedDecisions.push({
            keptItemId: '',
            droppedItemIds: [item.id],
            category: item.category,
            name: item.name,
            weightSavedGrams: item.weightGrams,
            rationale: `Équipement personnel non assigné : propriétaire (${item.ownerId}) absent de l'expédition`,
            id: item.id,
            reason: `Propriétaire absent (${item.weightGrams}g non portés)`,
            originalOwnerId: item.ownerId,
          });
          weightSavedGrams += item.weightGrams;
          warnings.push(
            `Équipement personnel "${item.name}" ignoré : le propriétaire (${item.ownerId}) ne fait pas partie des participants.`
          );
        } else if (ownerLoad.isDog) {
          // Canine personal equipment (ADV-DOG-02, ADV-GEAR-03)
          const canDogCarry =
            ownerLoad.maxSafeWeightKg > 0 &&
            isItemDogEligible(item);

          if (canDogCarry) {
            const rec: AssignedItem = {
              itemId: item.id,
              id: item.id,
              name: item.name,
              weightGrams: item.weightGrams,
              assignedParticipantId: ownerLoad.participantId,
              assignedParticipantName: ownerLoad.name,
              category: item.category,
              isShared: false,
            };
            ownerLoad.assignedItems.push(rec);
            ownerLoad.items.push(rec);
            ownerLoad.allocatedWeightGrams += item.weightGrams;
            ownerLoad.personalWeightGrams += item.weightGrams;
          } else {
            // Dog cannot carry this item: transfer to least-loaded human companion or quarantine if dog-only
            if (humans.length > 0) {
              humans.sort((a, b) => {
                const capA = Math.max(1, loads[a.id].maxSafeWeightKg * 1000);
                const capB = Math.max(1, loads[b.id].maxSafeWeightKg * 1000);
                return loads[a.id].allocatedWeightGrams / capA - loads[b.id].allocatedWeightGrams / capB;
              });
              const targetHuman = humans[0];
              const hLoad = loads[targetHuman.id];
              const rec: AssignedItem = {
                itemId: item.id,
                id: item.id,
                name: item.name,
                weightGrams: item.weightGrams,
                assignedParticipantId: targetHuman.id,
                assignedParticipantName: hLoad.name,
                category: item.category,
                isShared: false,
                reason: `Pris en charge pour ${ownerLoad.name} (sécurité ou portage canin désactivé)`,
              };
              hLoad.assignedItems.push(rec);
              hLoad.items.push(rec);
              hLoad.allocatedWeightGrams += item.weightGrams;
              hLoad.personalWeightGrams += item.weightGrams;
              warnings.push(
                `Équipement personnel "${item.name}" de ${ownerLoad.name} pris en charge par ${hLoad.name} (portage canin inadapté ou désactivé).`
              );
            } else {
              // No humans available on expedition to carry dog personal item
              droppedDecisions.push({
                keptItemId: '',
                droppedItemIds: [item.id],
                category: item.category,
                name: item.name,
                weightSavedGrams: item.weightGrams,
                rationale: "Équipement non assignable : portage canin impossible et aucun humain disponible",
                id: item.id,
                reason: `Non assignable : aucun humain (${item.weightGrams}g non portés)`,
                originalOwnerId: item.ownerId,
              });
              weightSavedGrams += item.weightGrams;
              warnings.push(
                `Impossible d'assigner l'équipement "${item.name}" : portage canin impossible et aucun participant humain disponible.`
              );
            }
          }
        } else {
          // Standard human personal equipment
          const rec: AssignedItem = {
            itemId: item.id,
            id: item.id,
            name: item.name,
            weightGrams: item.weightGrams,
            assignedParticipantId: ownerLoad.participantId,
            assignedParticipantName: ownerLoad.name,
            category: item.category,
            isShared: false,
          };
          ownerLoad.assignedItems.push(rec);
          ownerLoad.items.push(rec);
          ownerLoad.allocatedWeightGrams += item.weightGrams;
          ownerLoad.personalWeightGrams += item.weightGrams;
        }
      } else {
        unassignedSharedItems.push(item);
      }
    }

    // 5. Separate dog-eligible shared items from human-only items
    const dogItems = unassignedSharedItems.filter((i) => isItemDogEligible(i));
    const humanItems = unassignedSharedItems.filter((i) => !isItemDogEligible(i));

    // 6. Proportional allocation to dogs first (up to dog limit)
    const carryingDogs = validParticipants.filter((p) => p.isDog && p.isCarryingPack !== false && p.maxSafeKg > 0);

    for (const dogItem of dogItems) {
      let assigned = false;

      carryingDogs.sort((a, b) => {
        const capA = Math.max(1, loads[a.id].maxSafeWeightKg * 1000);
        const capB = Math.max(1, loads[b.id].maxSafeWeightKg * 1000);
        const pctA = loads[a.id].allocatedWeightGrams / capA;
        const pctB = loads[b.id].allocatedWeightGrams / capB;
        return pctA - pctB;
      });

      for (const dog of carryingDogs) {
        const dLoad = loads[dog.id];
        const prospectiveGrams = dLoad.allocatedWeightGrams + dogItem.weightGrams;
        if (prospectiveGrams <= dLoad.maxSafeWeightKg * 1000) {
          const rec: AssignedItem = {
            itemId: dogItem.id,
            id: dogItem.id,
            name: dogItem.name,
            weightGrams: dogItem.weightGrams,
            assignedParticipantId: dog.id,
            assignedParticipantName: dLoad.name,
            category: dogItem.category,
            isShared: true,
          };
          dLoad.assignedItems.push(rec);
          dLoad.items.push(rec);
          dLoad.allocatedWeightGrams += dogItem.weightGrams;
          dLoad.sharedWeightGrams += dogItem.weightGrams;
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        humanItems.push(dogItem);
      }
    }

    // 7. Sort human items descending by weight for bin packing (ADV-GEAR-02)
    humanItems.sort((a, b) => b.weightGrams - a.weightGrams);

    const guide = humans.find((h) => h.role === 'guide');
    const medic = humans.find((h) => h.role === 'medic');

    if (humans.length === 0) {
      for (const item of humanItems) {
        droppedDecisions.push({
          keptItemId: '',
          droppedItemIds: [item.id],
          category: item.category,
          name: item.name,
          weightSavedGrams: item.weightGrams,
          rationale: "Matériel non assignable : aucun participant humain disponible",
          id: item.id,
          reason: `Non assignable : aucun humain (${item.weightGrams}g non portés)`,
          originalOwnerId: item.ownerId,
        });
        weightSavedGrams += item.weightGrams;
        warnings.push(
          `Impossible d'assigner l'équipement "${item.name}" : aucun participant humain disponible.`
        );
      }
    } else {
      for (const item of humanItems) {
        let targetHumanId: string;

        // Guides / Medics prioritize vital / safety gear
        if (
          item.isVital &&
          guide &&
          loads[guide.id].allocatedWeightGrams + item.weightGrams <= loads[guide.id].maxSafeWeightKg * 1000
        ) {
          targetHumanId = guide.id;
        } else if (
          isFirstAidItem(item) &&
          medic &&
          loads[medic.id].allocatedWeightGrams + item.weightGrams <= loads[medic.id].maxSafeWeightKg * 1000
        ) {
          targetHumanId = medic.id;
        } else {
          // Proportional water-filling across humans based on safe capacity
          humans.sort((a, b) => {
            const capA = Math.max(1, loads[a.id].maxSafeWeightKg * 1000);
            const capB = Math.max(1, loads[b.id].maxSafeWeightKg * 1000);
            const pctA = loads[a.id].allocatedWeightGrams / capA;
            const pctB = loads[b.id].allocatedWeightGrams / capB;
            return pctA - pctB;
          });
          targetHumanId = humans[0].id;
        }

        const hLoad = loads[targetHumanId];
        if (hLoad) {
          const rec: AssignedItem = {
            itemId: item.id,
            id: item.id,
            name: item.name,
            weightGrams: item.weightGrams,
            assignedParticipantId: targetHumanId,
            assignedParticipantName: hLoad.name,
            category: item.category,
            isShared: true,
          };
          hLoad.assignedItems.push(rec);
          hLoad.items.push(rec);
          hLoad.allocatedWeightGrams += item.weightGrams;
          hLoad.sharedWeightGrams += item.weightGrams;
        }
      }
    }

    // 8. Compute final metrics and overload warnings
    let totalGroupWeightGrams = 0;
    let overloadedCount = 0;

    for (const p of validParticipants) {
      const load = loads[p.id];
      totalGroupWeightGrams += load.allocatedWeightGrams;
      load.totalWeightGrams = load.allocatedWeightGrams;
      load.allocatedWeightKg = Math.round((load.allocatedWeightGrams / 1000) * 10) / 10;
      load.totalWeightKg = load.allocatedWeightKg;

      load.actualRatio =
        load.bodyWeightKg > 0
          ? Math.round((load.allocatedWeightKg / load.bodyWeightKg) * 1000) / 1000
          : 0;
      load.bodyWeightRatio = load.actualRatio;

      load.loadPercentage =
        load.maxSafeWeightKg > 0
          ? Math.round((load.allocatedWeightKg / load.maxSafeWeightKg) * 100)
          : 0;

      const maxSafeGrams = Math.round(load.maxSafeWeightKg * 1000);
      if (load.allocatedWeightGrams > maxSafeGrams) {
        overloadedCount++;
        load.isOverloaded = true;
        load.overloadGrams = load.allocatedWeightGrams - maxSafeGrams;
        const overloadKg = Math.round((load.overloadGrams / 1000) * 10) / 10;
        const thresholdPct = Math.round(load.safeThresholdRatio * 100);
        const actualPct = Math.round(load.actualRatio * 1000) / 10;

        if (!load.isDog) {
          warnings.push(
            `Surcharge de ${overloadKg} kg pour ${load.name} (${actualPct}% du poids corporel > seuil max ${thresholdPct}%)`
          );
        } else {
          warnings.push(
            `Surcharge canine de ${load.overloadGrams} g pour ${load.name} (${actualPct}% > seuil physiologique ${thresholdPct}%)`
          );
        }
      }
    }

    const groupUtilization =
      totalSafeCapacityGrams > 0
        ? Math.round((totalGroupWeightGrams / totalSafeCapacityGrams) * 100)
        : 0;
    const isGroupOverloaded = totalGroupWeightGrams > totalSafeCapacityGrams;

    if (isGroupOverloaded) {
      const reqKg = (totalGroupWeightGrams / 1000).toFixed(1);
      const capKg = (totalSafeCapacityGrams / 1000).toFixed(1);
      warnings.unshift(
        `Capacité totale du groupe dépassée : ${reqKg} kg requis pour ${capKg} kg de capacité max sécurisée`
      );
    }

    const deduplicatedItems: AssignedItem[] = [];
    Object.values(loads).forEach((l) => deduplicatedItems.push(...l.assignedItems));

    // Stats & Bridge to LKDV ParticipantLoad
    const participantLoads: ParticipantLoad[] = Object.values(loads).map((l) => ({
      participantId: l.participantId,
      name: l.name,
      type: l.isDog ? 'dog' : 'human',
      allocatedWeightKg: l.allocatedWeightKg,
      maxSafeWeightKg: l.maxSafeWeightKg,
      loadPercentage: l.loadPercentage,
      isOverloaded: l.isOverloaded,
      roleOrBreed: l.roleOrBreed,
    }));

    const weightSavedKg = Math.round((weightSavedGrams / 1000) * 10) / 10;
    const groupStats: GroupPackStats = {
      totalOriginalWeightGrams,
      totalOptimizedWeightGrams: totalGroupWeightGrams,
      weightSavedGrams,
      weightSavedKg,
      duplicateCount: droppedDecisions.length,
      itemCountOriginal: allItems.length,
      itemCountOptimized: deduplicatedItems.length,
      overloadedCount,
    };

    return {
      deduplicatedItems,
      droppedDuplicates: droppedDecisions,
      removedDuplicates: droppedDecisions,
      individualLoads: loads,
      totalGroupWeightGrams,
      totalSafeCapacityGrams,
      groupCapacityUtilizationPercentage: groupUtilization,
      isGroupOverloaded,
      warnings,
      metrics: {
        weightSavedDeduplicationGrams: weightSavedGrams,
        humanCount: humans.length,
        dogCount: carryingDogs.length,
        sharedItemCount: deduplicatedItems.filter((i) => i.isShared).length,
        personalItemCount: deduplicatedItems.filter((i) => !i.isShared).length,
      },
      groupStats,
      participantLoads,
    };
  }
}

/**
 * Functional wrapper matching proposed_packMerge.ts contract
 */
export function mergePacks(input: PackMergeInput): PackMergeResult {
  return PackMergeService.runPackMerge(input.participants, input.kits, input.options);
}

/**
 * Formats a clean text summary of the Pack Merge optimization
 */
export function formatPackMergeSummary(result: PackMergeResult): string {
  const { groupStats, droppedDuplicates, warnings } = result;
  const lines: string[] = [];

  lines.push(`📦 Pack Merge LKDV : ${groupStats.weightSavedKg} kg économisés`);
  lines.push(`• Éléments dédoublonnés : ${groupStats.duplicateCount}`);
  lines.push(
    `• Poids total optimisé : ${Math.round(groupStats.totalOptimizedWeightGrams / 100) / 10} kg (vs ${Math.round(groupStats.totalOriginalWeightGrams / 100) / 10} kg initialement)`
  );

  if (droppedDuplicates.length > 0) {
    lines.push('\nMatériel allégé :');
    for (const d of droppedDuplicates) {
      lines.push(`- ${d.name} (${Math.round(d.weightSavedGrams / 10) / 100} kg) : ${d.rationale}`);
    }
  }

  if (warnings.length > 0) {
    lines.push('\n⚠️ Alertes de sécurité :');
    for (const w of warnings) {
      lines.push(`- ${w}`);
    }
  }

  return lines.join('\n');
}
```
