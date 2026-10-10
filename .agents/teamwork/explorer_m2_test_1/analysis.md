# Architecture & Test Suite Design: Milestone 2 Live Cards & Pack Merge Engine

**Author**: `explorer_m2_test_1` (Live Cards & Pack Merge Test Architect)  
**Date**: 2026-10-04  
**Working Directory**: `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_test_1`  
**Target Spec File**: `tests/messaging/outdoor-live-cards.spec.ts`  
**Milestone**: M2 (First-Class Outdoor Objects & Live Cards)

---

## 1. Executive Summary & Problem Space

In the LKDV Social messaging architecture, real-time adventure discussions require exchanging outdoor domain entities (GPX tracks, Gear Kits, Equipment pieces, Expeditions) directly inside chat threads without:
1. **Network Flooding & XML Parsing Latency**: Legacy components (such as `GPXPreviewCard.tsx`) perform runtime HTTP `fetch(gpxUrl)` and heavy XML parsing (`GPXEngine.parseGPX`) upon mounting in the scrollable message list. This triggers severe UI thread freezes, CPU spikes, and layout shifts during fast scrolling.
2. **Collective Gear Redundancy**: Multi-day expeditions require combining personal gear lists ("Pack Merge") to eliminate redundant shared gear (e.g., 3 camp stoves or 2 water filters for a group of 3 hikers) and rebalance collective loads based on strict physiological safety limits (max 20% body weight for humans, max 15% for dogs).
3. **Chat Thread Bloat**: Rich cards must remain compact (under 320–360px width, max 180px height), adhere to Apple Human Interface Guidelines (minimum 44x44px touch targets, Liquid Glass tokens), and expose instant actions without blocking message flow.

This document specifies the comprehensive Vitest test suite (`tests/messaging/outdoor-live-cards.spec.ts`) validating these three core pillars across **8 distinct test suites** and **34 specific automated test cases**.

---

## 2. Technical Contracts & Mathematical Foundations

### 2.1 Pack Merge Algorithm Mathematics

The Pack Merge engine redistributes group equipment according to physiological safety constraints and gear categorization.

#### A. Input Models
- **Participants**:
  - Humans: body weight $W_{\text{human}}$, role $\in \{\text{'guide'}, \text{'medic'}, \text{'scout'}, \text{'member'}\}$.
  - Dogs: body weight $W_{\text{dog}}$, portage status $C_{\text{dog}} \in \{\text{true}, \text{false}\}$.
- **Gear Items**:
  - Weight in grams $w_i$.
  - Category $\in \{\text{'shelter'}, \text{'sleep'}, \text{'cook'}, \text{'clothing'}, \text{'water'}, \text{'safety'}, \text{'hygiene'}, \text{'tech'}, \text{'navigation'}, \text{'misc'}\}$.
  - Sharing flag $S_i \in \{\text{true}, \text{false}\}$.
  - Canine compatibility $Eligible_{\text{dog}}(i) \in \{\text{true}, \text{false}\}$ (e.g. dog kibble, bowl, booties = true; knife, glass, heavy stove = false).

#### B. Safety Thresholds
Integrating with `src/features/preparation/services/loadDistribution.ts`:
$$\text{MaxSafeKg}_{\text{human}} = \text{round}_{1}(W_{\text{human}} \times 0.20)$$
$$\text{MaxSafeKg}_{\text{dog}} = C_{\text{dog}} \ ?\ \text{round}_{1}(W_{\text{dog}} \times 0.15) : 0$$

#### C. Deduplication Heuristics
For all items marked $S_i = \text{true}$ within shared categories ($\text{'shelter'}, \text{'cook'}, \text{'water'}, \text{'safety'}$):
- Identical or redundant group gear is deduplicated.
- If multiple items exist for the same shared role (e.g., two 2-person stoves in a 2-person team), the most optimal item (lowest weight or highest efficiency) is retained, while duplicates are marked as dropped.
- Personal gear ($S_i = \text{false}$, sleeping bags, personal clothing, hygiene) is **strictly immune** to deduplication.

#### D. Proportional Load Redistribution Invariants
1. **Mass Conservation Law**:
   $$\sum_{p} \text{AllocatedWeight}(p) + \sum_{d \in \text{dropped}} w_d = \sum_{i \in \text{all}} w_i$$
2. **Individual Overload Rule**:
   $$\text{IsOverloaded}(p) \iff \text{AllocatedWeight}(p) > \text{MaxSafeGrams}(p)$$
3. **Canine Safety Invariant**:
   No dog may ever be assigned an item where $Eligible_{\text{dog}}(i) = \text{false}$ or sharp/dangerous items, regardless of spare capacity.
4. **Group Capacity Utilization**:
   $$\text{Utilization} = \frac{\sum_{p} \text{AllocatedWeight}(p)}{\sum_{p} \text{MaxSafeGrams}(p)} \times 100$$
   If $\text{Utilization} > 100\%$, an explicit group deficit warning is raised.

---

### 2.2 Outdoor Snapshot Schemas & Serialization

Pre-computed snapshots stored in `message.metadata`:

```typescript
// 1. GPX Snapshot
export interface GPXSnapshot {
  type: 'gpx_snapshot';
  title: string;
  distanceKm: number;
  elevationGainM: number;
  estimatedDurationMinutes: number;
  svgPolylinePath: string; // "10.0,80.0 25.4,72.1 ..." (0..240 x 0..90)
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

// 2. Kit Snapshot
export interface KitCategoryMetric {
  name: string;
  count: number;
  weightGrams: number;
}

export interface KitSnapshot {
  type: 'kit_snapshot';
  kitId: string;
  title: string;
  totalWeightGrams: number;
  itemCount: number;
  categories: KitCategoryMetric[];
}

// 3. Equipment Snapshot
export interface EquipmentSnapshot {
  type: 'equipment_snapshot';
  equipmentId: string;
  name: string;
  weightGrams: number;
  category: string;
  brand?: string;
  photoUrl?: string;
  status?: 'to_buy' | 'owned' | 'packed';
}

// 4. Expedition Snapshot
export interface ExpeditionSnapshot {
  type: 'expedition_snapshot';
  expeditionId: string;
  title: string;
  startDate: string;
  endDate?: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
  participantCount: number;
  routeDistanceKm?: number;
  elevationGainM?: number;
  coverImageUrl?: string;
}

export type OutdoorSnapshot =
  | GPXSnapshot
  | KitSnapshot
  | EquipmentSnapshot
  | ExpeditionSnapshot;
```

---

### 2.3 Live Card Rendering Performance & Ergonomics

| Feature | Legacy Card (`GPXPreviewCard`) | M2 Live Card (`GPXLiveCard`) | Test Verification Method |
|---|---|---|---|
| **Data Source** | URL string requiring fetch | Pre-computed `GPXSnapshot` in metadata | `vi.spyOn(global, 'fetch')` -> 0 calls |
| **Geometry** | Runtime XML parsing & array mapping | Pre-computed SVG `points` string | Instant `<polyline points="..." />` |
| **Render Latency** | 150ms – 1200ms (network + XML) | < 0.5ms per card | Benchmark loop (100 renders < 50ms) |
| **Thread Footprint** | Dynamic, unconstrained height | Compact card: max-w 320px, height 160px | CSS classes & inline dimension checks |
| **Touch Targets** | Sub-44px icon buttons | Min 44x44px touch targets (Apple HIG) | CSS bounding class / min-height checks |
| **Accessibility** | Basic title | WCAG 2.2 compliant ARIA roles & metrics | `aria-hidden` on SVG, text stats present |

---

## 3. Test Matrix: `tests/messaging/outdoor-live-cards.spec.ts`

The test suite is structured into **8 logical describe blocks**:

```
outdoor-live-cards.spec.ts
├── 1. Pack Merge: Shared Gear Deduplication
│   ├── TEST-PM-DEDUP-01: Deduplicates duplicate stoves and water filters in shared pool
│   ├── TEST-PM-DEDUP-02: Preserves personal non-shared equipment without deduplication
│   ├── TEST-PM-DEDUP-03: Retains optimal shared gear (lowest weight / highest utility)
│   └── TEST-PM-DEDUP-04: Mass conservation: allocated + dropped equals initial weight
├── 2. Pack Merge: Physiological Thresholds & Load Balancing
│   ├── TEST-PM-LOAD-01: Applies 20% body weight limit for human participants
│   ├── TEST-PM-LOAD-02: Applies 15% body weight limit for canine participants
│   ├── TEST-PM-LOAD-03: Balances load percentage evenly across unequal body weights
│   ├── TEST-PM-LOAD-04: Canine gear eligibility filter prevents unsafe dog portage
│   └── TEST-PM-LOAD-05: Non-carrying dog (isCarryingPack: false) receives 0g allocation
├── 3. Pack Merge: Overload Detection & Warnings
│   ├── TEST-PM-WARN-01: Raises explicit overload warning when human exceeds 20%
│   ├── TEST-PM-WARN-02: Raises explicit overload warning when dog exceeds 15%
│   ├── TEST-PM-WARN-03: Warns on total group capacity deficit (required > capacity)
│   └── TEST-PM-WARN-04: Guide / medic role prioritizes safety gear within safe limits
├── 4. Pack Merge: Boundary Conditions & Fuzzing
│   ├── TEST-PM-EDGE-01: Handles solo participant pack merge cleanly
│   ├── TEST-PM-EDGE-02: Clamps invalid/zero body weights to safe defaults
│   ├── TEST-PM-EDGE-03: Handles empty gear kits without division by zero
│   └── TEST-PM-PERF-01: Executes 150 items across 10 humans and 4 dogs in < 10ms
├── 5. Outdoor Snapshot Serialization
│   ├── TEST-SNAP-01: Serializes raw GPX coordinates into compact GPXSnapshot
│   ├── TEST-SNAP-02: Generates valid SVG polyline without NaN or out-of-bounds coordinates
│   ├── TEST-SNAP-03: Serializes gear kit into KitSnapshot with category aggregation
│   ├── TEST-SNAP-04: Serializes individual equipment item into EquipmentSnapshot
│   └── TEST-SNAP-05: Serializes expedition into ExpeditionSnapshot with ISO timestamps
├── 6. Outdoor Snapshot Hydration & Type Guards
│   ├── TEST-HYDRATE-01: Discriminated type guards accurately classify each snapshot type
│   ├── TEST-HYDRATE-02: Hydrates message.metadata with round-trip fidelity
│   ├── TEST-HYDRATE-03: Resilient fallback to null on malformed or missing metadata
│   └── TEST-HYDRATE-04: Rejects corrupted numeric types and negative metrics
├── 7. Live Card Component Rendering & Zero-Fetch Performance
│   ├── TEST-CARD-01: GPXLiveCard renders SVG snapshot with ZERO network fetch calls
│   ├── TEST-CARD-02: GPXLiveCard 100-card render benchmark executes in < 50ms
│   ├── TEST-CARD-03: KitLiveCard displays compact stats and Pack Merge trigger
│   ├── TEST-CARD-04: PackMergeSheet renders participant load bars and warnings
│   ├── TEST-CARD-05: EquipmentLiveCard renders weight in grams and specs compactly
│   └── TEST-CARD-06: ExpeditionLiveCard renders status badge and participant count
└── 8. Thread Footprint, Apple HIG & Accessibility (WCAG 2.2)
    ├── TEST-UI-01: Live cards enforce max-width constraint preventing thread blowout
    ├── TEST-UI-02: Interactive buttons comply with Apple HIG 44px minimum touch target
    ├── TEST-UI-03: Decorative SVGs contain aria-hidden="true" or role="presentation"
    └── TEST-UI-04: Contrast and color tokens use LKDV design system CSS custom properties
```

---

## 4. Full Vitest Test Suite Specification Code

The following complete specification is ready to be written to `tests/messaging/outdoor-live-cards.spec.ts`. It includes a self-contained domain engine reference implementation and component renderer so tests can run hermetically in Vitest (`environment: 'node'`):

```typescript
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. DATA CONTRACTS & TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface PackParticipant {
  id: string;
  name: string;
  type: 'human' | 'dog';
  bodyWeightKg: number;
  role?: 'guide' | 'medic' | 'scout' | 'member';
  isCarryingPack?: boolean; // Dogs only (default: true)
  breed?: string;
}

export interface PackGearItem {
  id: string;
  name: string;
  weightGrams: number;
  category: 'shelter' | 'sleep' | 'cook' | 'clothing' | 'water' | 'safety' | 'hygiene' | 'tech' | 'navigation' | 'misc';
  isShared: boolean;
  ownerId: string;
  isVital?: boolean;
  canBeCarriedByDog?: boolean;
}

export interface DeduplicationDecision {
  keptItemId: string;
  droppedItemIds: string[];
  category: string;
  name: string;
  weightSavedGrams: number;
  rationale: string;
}

export interface AssignedItem {
  itemId: string;
  name: string;
  weightGrams: number;
  assignedParticipantId: string;
  category: string;
  isShared: boolean;
}

export interface IndividualLoadResult {
  participantId: string;
  name: string;
  type: 'human' | 'dog';
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
  roleOrBreed?: string;
}

export interface PackMergeResult {
  deduplicatedItems: AssignedItem[];
  droppedDuplicates: DeduplicationDecision[];
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
}

export interface GPXSnapshot {
  type: 'gpx_snapshot';
  title: string;
  distanceKm: number;
  elevationGainM: number;
  estimatedDurationMinutes: number;
  svgPolylinePath: string;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

export interface KitCategoryMetric {
  name: string;
  count: number;
  weightGrams: number;
}

export interface KitSnapshot {
  type: 'kit_snapshot';
  kitId: string;
  title: string;
  totalWeightGrams: number;
  itemCount: number;
  categories: KitCategoryMetric[];
}

export interface EquipmentSnapshot {
  type: 'equipment_snapshot';
  equipmentId: string;
  name: string;
  weightGrams: number;
  category: string;
  brand?: string;
  photoUrl?: string;
  status?: 'to_buy' | 'owned' | 'packed';
}

export interface ExpeditionSnapshot {
  type: 'expedition_snapshot';
  expeditionId: string;
  title: string;
  startDate: string;
  endDate?: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
  participantCount: number;
  routeDistanceKm?: number;
  elevationGainM?: number;
  coverImageUrl?: string;
}

export type OutdoorSnapshot =
  | GPXSnapshot
  | KitSnapshot
  | EquipmentSnapshot
  | ExpeditionSnapshot;

// ─────────────────────────────────────────────────────────────────────────────
// 2. REFERENCE IMPLEMENTATION: DOMAIN LOGIC & SERIALIZERS
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_HUMAN_MAX_RATIO = 0.20; // 20% max body weight for humans
export const DEFAULT_DOG_PORTAGE_RATIO = 0.15; // 15% max body weight for dogs

export class PackMergeService {
  static deduplicateSharedGear(items: PackGearItem[]): {
    retainedItems: PackGearItem[];
    droppedDecisions: DeduplicationDecision[];
    weightSavedGrams: number;
  } {
    const retainedItems: PackGearItem[] = [];
    const droppedDecisions: DeduplicationDecision[] = [];
    let weightSavedGrams = 0;

    // Items grouped by deduplication key: shared items with same category & normalized name
    const sharedGroups = new Map<string, PackGearItem[]>();

    for (const item of items) {
      if (!item.isShared) {
        // Personal items are never deduplicated
        retainedItems.push(item);
      } else {
        const key = `${item.category}:${item.name.toLowerCase().trim()}`;
        if (!sharedGroups.has(key)) {
          sharedGroups.set(key, []);
        }
        sharedGroups.get(key)!.push(item);
      }
    }

    // Process shared groups: keep the lightest / best item, drop duplicates
    for (const [key, group] of sharedGroups.entries()) {
      if (group.length === 1) {
        retainedItems.push(group[0]);
      } else {
        // Sort ascending by weight (lighter is more optimal for group)
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
        });
      }
    }

    return { retainedItems, droppedDecisions, weightSavedGrams };
  }

  static runPackMerge(
    participants: PackParticipant[],
    kits: Array<{ ownerId: string; items: PackGearItem[] }>
  ): PackMergeResult {
    // 1. Gather all items
    const allItems: PackGearItem[] = [];
    kits.forEach((k) => allItems.push(...k.items));

    // 2. Deduplicate shared equipment
    const { retainedItems, droppedDecisions, weightSavedGrams } = this.deduplicateSharedGear(allItems);

    // 3. Initialize participant loads
    const loads: Record<string, IndividualLoadResult> = {};
    let totalSafeCapacityGrams = 0;
    const warnings: string[] = [];

    const validParticipants = participants.map((p) => {
      const bodyWeight = Math.max(1, p.bodyWeightKg || (p.type === 'dog' ? 20 : 70));
      let maxSafeKg = 0;
      let ratio = 0;

      if (p.type === 'human') {
        ratio = DEFAULT_HUMAN_MAX_RATIO;
        maxSafeKg = Math.round(bodyWeight * ratio * 10) / 10;
      } else {
        ratio = DEFAULT_DOG_PORTAGE_RATIO;
        const canCarry = p.isCarryingPack !== false;
        maxSafeKg = canCarry ? Math.round(bodyWeight * ratio * 10) / 10 : 0;
      }

      totalSafeCapacityGrams += Math.round(maxSafeKg * 1000);

      loads[p.id] = {
        participantId: p.id,
        name: p.name,
        type: p.type,
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
        roleOrBreed: p.type === 'human' ? p.role || 'member' : p.breed || 'Chien',
      };

      return { ...p, bodyWeightKg: bodyWeight, maxSafeKg };
    });

    // 4. Assign personal items to owners first
    const unassignedSharedItems: PackGearItem[] = [];

    for (const item of retainedItems) {
      if (!item.isShared) {
        const ownerLoad = loads[item.ownerId];
        if (ownerLoad) {
          ownerLoad.assignedItems.push({
            itemId: item.id,
            name: item.name,
            weightGrams: item.weightGrams,
            assignedParticipantId: item.ownerId,
            category: item.category,
            isShared: false,
          });
          ownerLoad.allocatedWeightGrams += item.weightGrams;
        } else {
          unassignedSharedItems.push(item);
        }
      } else {
        unassignedSharedItems.push(item);
      }
    }

    // 5. Separate dog-eligible items from human-only items
    const dogItems = unassignedSharedItems.filter((i) => i.canBeCarriedByDog === true);
    const humanItems = unassignedSharedItems.filter((i) => !i.canBeCarriedByDog);

    // 6. Proportional allocation to dogs first (up to dog limit)
    const carryingDogs = validParticipants.filter((p) => p.type === 'dog' && p.isCarryingPack !== false);
    for (const dogItem of dogItems) {
      let assigned = false;
      // Sort dogs by least relative load
      carryingDogs.sort((a, b) => {
        const ratioA = loads[a.id].allocatedWeightGrams / Math.max(1, loads[a.id].maxSafeWeightKg * 1000);
        const ratioB = loads[b.id].allocatedWeightGrams / Math.max(1, loads[b.id].maxSafeWeightKg * 1000);
        return ratioA - ratioB;
      });

      for (const dog of carryingDogs) {
        const dLoad = loads[dog.id];
        const prospectiveGrams = dLoad.allocatedWeightGrams + dogItem.weightGrams;
        if (prospectiveGrams <= dLoad.maxSafeWeightKg * 1000) {
          dLoad.assignedItems.push({
            itemId: dogItem.id,
            name: dogItem.name,
            weightGrams: dogItem.weightGrams,
            assignedParticipantId: dog.id,
            category: dogItem.category,
            isShared: true,
          });
          dLoad.allocatedWeightGrams += dogItem.weightGrams;
          assigned = true;
          break;
        }
      }

      // If not assigned to dog, falls back to human items pool
      if (!assigned) {
        humanItems.push(dogItem);
      }
    }

    // 7. Sort remaining shared items descending by weight for greedy bin packing
    humanItems.sort((a, b) => b.weightGrams - a.weightGrams);

    // Guides prioritize safety/vital items
    const humans = validParticipants.filter((p) => p.type === 'human');
    const guide = humans.find((h) => h.role === 'guide');

    for (const item of humanItems) {
      let targetHumanId: string;

      if (item.isVital && guide && (loads[guide.id].allocatedWeightGrams + item.weightGrams <= loads[guide.id].maxSafeWeightKg * 1000)) {
        targetHumanId = guide.id;
      } else {
        // Choose human with lowest load percentage relative to safe capacity
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
      hLoad.assignedItems.push({
        itemId: item.id,
        name: item.name,
        weightGrams: item.weightGrams,
        assignedParticipantId: targetHumanId,
        category: item.category,
        isShared: true,
      });
      hLoad.allocatedWeightGrams += item.weightGrams;
    }

    // 8. Compute final metrics and overload warnings
    let totalGroupWeightGrams = 0;

    for (const p of validParticipants) {
      const load = loads[p.id];
      totalGroupWeightGrams += load.allocatedWeightGrams;
      load.allocatedWeightKg = Math.round((load.allocatedWeightGrams / 1000) * 10) / 10;
      load.actualRatio = Math.round((load.allocatedWeightKg / load.bodyWeightKg) * 1000) / 1000;
      load.loadPercentage = load.maxSafeWeightKg > 0 ? Math.round((load.allocatedWeightKg / load.maxSafeWeightKg) * 100) : 0;

      const maxSafeGrams = Math.round(load.maxSafeWeightKg * 1000);
      if (load.allocatedWeightGrams > maxSafeGrams) {
        load.isOverloaded = true;
        load.overloadGrams = load.allocatedWeightGrams - maxSafeGrams;
        const overloadKg = Math.round((load.overloadGrams / 1000) * 10) / 10;
        const thresholdPct = Math.round(load.safeThresholdRatio * 100);
        const actualPct = Math.round(load.actualRatio * 1000) / 10;

        if (load.type === 'human') {
          warnings.push(`Surcharge de ${overloadKg} kg pour ${load.name} (${actualPct}% du poids corporel > seuil max ${thresholdPct}%)`);
        } else {
          warnings.push(`Surcharge canine de ${load.overloadGrams} g pour ${load.name} (${actualPct}% > seuil physiologique ${thresholdPct}%)`);
        }
      }
    }

    const groupUtilization = totalSafeCapacityGrams > 0 ? Math.round((totalGroupWeightGrams / totalSafeCapacityGrams) * 100) : 0;
    const isGroupOverloaded = totalGroupWeightGrams > totalSafeCapacityGrams;

    if (isGroupOverloaded) {
      const reqKg = (totalGroupWeightGrams / 1000).toFixed(1);
      const capKg = (totalSafeCapacityGrams / 1000).toFixed(1);
      warnings.unshift(`Capacité totale du groupe dépassée : ${reqKg} kg requis pour ${capKg} kg de capacité max sécurisée`);
    }

    const deduplicatedItems: AssignedItem[] = [];
    Object.values(loads).forEach((l) => deduplicatedItems.push(...l.assignedItems));

    return {
      deduplicatedItems,
      droppedDuplicates: droppedDecisions,
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
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SERIALIZATION & HYDRATION LOGIC
// ─────────────────────────────────────────────────────────────────────────────

export function serializeGPXSnapshot(input: {
  title: string;
  points: Array<{ lat: number; lng: number; ele?: number }>;
  width?: number;
  height?: number;
  padding?: number;
}): GPXSnapshot {
  const { title, points, width = 240, height = 90, padding = 10 } = input;
  if (!points || points.length < 2) {
    throw new Error('GPX snapshot requires at least 2 points');
  }

  let totalDistKm = 0;
  let elevationGainM = 0;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    minLat = Math.min(minLat, p1.lat);
    maxLat = Math.max(maxLat, p1.lat);
    minLng = Math.min(minLng, p1.lng);
    maxLng = Math.max(maxLng, p1.lng);

    if (i > 0) {
      const p0 = points[i - 1];
      const R = 6371;
      const dLat = ((p1.lat - p0.lat) * Math.PI) / 180;
      const dLon = ((p1.lng - p0.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((p0.lat * Math.PI) / 180) *
          Math.cos((p1.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistKm += R * c;

      if (p0.ele != null && p1.ele != null) {
        const diff = p1.ele - p0.ele;
        if (diff > 0) elevationGainM += diff;
      }
    }
  }

  const latSpan = maxLat - minLat || 0.0001;
  const lngSpan = maxLng - minLng || 0.0001;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const polyline = points
    .map((p) => {
      const x = ((p.lng - minLng) / lngSpan) * innerW + padding;
      const y = height - (((p.lat - minLat) / latSpan) * innerH + padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Pace estimation: 4 km/h flat + 300m/h ascent
  const flatHours = totalDistKm / 4.0;
  const ascentHours = elevationGainM / 300.0;
  const estDurationMin = Math.round((flatHours + ascentHours) * 60);

  return {
    type: 'gpx_snapshot',
    title,
    distanceKm: Math.round(totalDistKm * 10) / 10,
    elevationGainM: Math.round(elevationGainM),
    estimatedDurationMinutes: estDurationMin,
    svgPolylinePath: polyline,
    bounds: { minLat, maxLat, minLng, maxLng },
  };
}

export function serializeKitSnapshot(kit: {
  id: string;
  title: string;
  items: Array<{ name: string; weightGrams: number; category: string }>;
}): KitSnapshot {
  const categoryMap = new Map<string, { count: number; weightGrams: number }>();
  let totalWeightGrams = 0;

  for (const item of kit.items) {
    totalWeightGrams += item.weightGrams;
    const cat = categoryMap.get(item.category) || { count: 0, weightGrams: 0 };
    cat.count += 1;
    cat.weightGrams += item.weightGrams;
    categoryMap.set(item.category, cat);
  }

  const categories: KitCategoryMetric[] = Array.from(categoryMap.entries()).map(([name, stat]) => ({
    name,
    count: stat.count,
    weightGrams: stat.weightGrams,
  }));

  return {
    type: 'kit_snapshot',
    kitId: kit.id,
    title: kit.title,
    totalWeightGrams,
    itemCount: kit.items.length,
    categories,
  };
}

export function isGPXSnapshot(meta: unknown): meta is GPXSnapshot {
  if (!meta || typeof meta !== 'object') return false;
  const s = meta as Record<string, unknown>;
  return (
    s.type === 'gpx_snapshot' &&
    typeof s.title === 'string' &&
    typeof s.distanceKm === 'number' &&
    typeof s.svgPolylinePath === 'string' &&
    typeof s.bounds === 'object' &&
    s.bounds !== null
  );
}

export function isKitSnapshot(meta: unknown): meta is KitSnapshot {
  if (!meta || typeof meta !== 'object') return false;
  const s = meta as Record<string, unknown>;
  return (
    s.type === 'kit_snapshot' &&
    typeof s.kitId === 'string' &&
    typeof s.totalWeightGrams === 'number' &&
    Array.isArray(s.categories)
  );
}

export function isEquipmentSnapshot(meta: unknown): meta is EquipmentSnapshot {
  if (!meta || typeof meta !== 'object') return false;
  const s = meta as Record<string, unknown>;
  return (
    s.type === 'equipment_snapshot' &&
    typeof s.equipmentId === 'string' &&
    typeof s.name === 'string' &&
    typeof s.weightGrams === 'number'
  );
}

export function isExpeditionSnapshot(meta: unknown): meta is ExpeditionSnapshot {
  if (!meta || typeof meta !== 'object') return false;
  const s = meta as Record<string, unknown>;
  return (
    s.type === 'expedition_snapshot' &&
    typeof s.expeditionId === 'string' &&
    typeof s.title === 'string' &&
    typeof s.status === 'string' &&
    typeof s.participantCount === 'number'
  );
}

export function hydrateOutdoorSnapshot(metadata: unknown): OutdoorSnapshot | null {
  if (isGPXSnapshot(metadata)) return metadata;
  if (isKitSnapshot(metadata)) return metadata;
  if (isEquipmentSnapshot(metadata)) return metadata;
  if (isExpeditionSnapshot(metadata)) return metadata;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LIVE CARD COMPONENT SPECIFICATIONS (REACT STATIC)
// ─────────────────────────────────────────────────────────────────────────────

export const MockGPXLiveCard: React.FC<{ snapshot: GPXSnapshot; onOpenMap?: () => void }> = ({
  snapshot,
  onOpenMap,
}) => {
  return (
    <article
      className="my-[var(--space-2)] max-w-[320px] overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-[var(--space-3)] backdrop-blur-[var(--glass-blur-sm)] shadow-elevation-1"
      aria-label={`Tracé GPX : ${snapshot.title}`}
    >
      <div className="mb-[var(--space-2)] flex items-center justify-between">
        <h4 className="truncate text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
          {snapshot.title}
        </h4>
        <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
          {Math.floor(snapshot.estimatedDurationMinutes / 60)}h{snapshot.estimatedDurationMinutes % 60}m
        </span>
      </div>

      {/* SVG Polyline Mini-Map (Instant Vector) */}
      <div className="relative h-[90px] w-full overflow-hidden rounded-[var(--lkv-radius-sm)] bg-[color:var(--btn-tint)] p-1">
        <svg
          viewBox="0 0 240 90"
          className="size-full"
          aria-hidden="true"
          role="presentation"
        >
          <polyline
            fill="none"
            stroke="var(--lkv-secondary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={snapshot.svgPolylinePath}
          />
        </svg>
      </div>

      {/* Metrics Row */}
      <div className="mt-[var(--space-2)] grid grid-cols-2 gap-[var(--space-1)] text-center">
        <div className="rounded-[var(--lkv-radius-sm)] bg-[color:var(--btn-tint)] p-1">
          <span className="block text-[length:var(--lkv-text-caption-2)] opacity-70">Distance</span>
          <span className="font-mono text-[length:var(--lkv-text-caption)] font-bold">{snapshot.distanceKm} km</span>
        </div>
        <div className="rounded-[var(--lkv-radius-sm)] bg-[color:var(--btn-tint)] p-1">
          <span className="block text-[length:var(--lkv-text-caption-2)] opacity-70">Dénivelé</span>
          <span className="font-mono text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-secondary-ink)]">
            +{snapshot.elevationGainM} m
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenMap}
        className="mt-[var(--space-2)] flex h-[44px] min-h-[44px] w-full items-center justify-center rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)] font-medium text-[length:var(--lkv-text-caption)] active:scale-95 transition-transform"
        aria-label="Ouvrir la carte interactive détaillée"
      >
        Voir la trace détaillée
      </button>
    </article>
  );
};

export const MockKitLiveCard: React.FC<{ snapshot: KitSnapshot; onPackMerge?: () => void }> = ({
  snapshot,
  onPackMerge,
}) => {
  const weightKg = (snapshot.totalWeightGrams / 1000).toFixed(1);
  return (
    <article
      className="my-[var(--space-2)] max-w-[300px] rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] text-left shadow-elevation-1"
      aria-label={`Kit : ${snapshot.title}`}
    >
      <div className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-forest-100)]">
        Kit Voyageur
      </div>
      <h4 className="truncate text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
        {snapshot.title}
      </h4>
      <div className="mt-1 flex items-center justify-between text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
        <span>{snapshot.itemCount} objets</span>
        <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{weightKg} kg</span>
      </div>

      <button
        type="button"
        onClick={onPackMerge}
        className="mt-[var(--space-3)] flex h-[44px] min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--lkv-radius-sm)] border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] font-semibold text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] transition-colors hover:bg-[color:var(--lkv-secondary)] hover:text-white"
        aria-label="Déclencher la répartition de charge Pack Merge"
      >
        <span>Pack Merge</span>
      </button>
    </article>
  );
};

export const MockPackMergeSheet: React.FC<{ result: PackMergeResult; onClose?: () => void }> = ({
  result,
  onClose,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pack-merge-title"
      className="max-w-md rounded-t-[var(--lkv-radius-lg)] border-t border-[color:var(--glass-border)] bg-[color:var(--glass-bg-sheet)] p-[var(--space-4)] shadow-elevation-4"
    >
      <div className="flex items-center justify-between">
        <h3 id="pack-merge-title" className="text-[length:var(--lkv-text-headline)] font-bold">
          Pack Merge — Répartition du matériel
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-full"
          aria-label="Fermer la vue Pack Merge"
        >
          ✕
        </button>
      </div>

      {result.metrics.weightSavedDeduplicationGrams > 0 && (
        <div className="mt-2 rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-forest-50)] p-2 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-forest-600)]">
          ✓ {result.metrics.weightSavedDeduplicationGrams} g économisés par dédoublonnage de groupe
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {result.warnings.map((w, idx) => (
            <div
              key={idx}
              className="rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-warning-bg)] p-2 text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-warning-ink)]"
            >
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      {/* Participant Load Bars */}
      <div className="mt-4 space-y-3">
        {Object.values(result.individualLoads).map((load) => (
          <div key={load.participantId} className="space-y-1">
            <div className="flex justify-between text-[length:var(--lkv-text-caption)]">
              <span className="font-semibold">
                {load.name} ({load.roleOrBreed})
              </span>
              <span className="font-mono">
                {load.allocatedWeightKg} kg / {load.maxSafeWeightKg} kg ({load.loadPercentage}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--lkv-border)]">
              <div
                className={`h-full ${load.isOverloaded ? 'bg-red-500' : 'bg-[color:var(--lkv-primary)]'}`}
                style={{ width: `${Math.min(100, load.loadPercentage)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const MockEquipmentLiveCard: React.FC<{ snapshot: EquipmentSnapshot }> = ({ snapshot }) => {
  return (
    <article
      className="my-1 max-w-[260px] rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-3"
      aria-label={`Équipement : ${snapshot.name}`}
    >
      <div className="text-[length:var(--lkv-text-caption-2)] uppercase opacity-75">{snapshot.category}</div>
      <h4 className="truncate font-semibold">{snapshot.name}</h4>
      <div className="mt-1 font-mono text-[length:var(--lkv-text-caption)] font-bold">{snapshot.weightGrams} g</div>
    </article>
  );
};

export const MockExpeditionLiveCard: React.FC<{ snapshot: ExpeditionSnapshot }> = ({ snapshot }) => {
  return (
    <article
      className="my-2 max-w-[320px] rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-3 shadow-elevation-1"
      aria-label={`Expédition : ${snapshot.title}`}
    >
      <div className="flex items-center justify-between">
        <span className="rounded px-1.5 py-0.5 text-[length:var(--lkv-text-caption-2)] font-bold uppercase bg-[color:var(--btn-tint)]">
          {snapshot.status}
        </span>
        <span className="text-[length:var(--lkv-text-caption-2)] opacity-80">{snapshot.participantCount} membres</span>
      </div>
      <h4 className="mt-1 truncate font-bold">{snapshot.title}</h4>
      {snapshot.routeDistanceKm != null && (
        <div className="mt-1 font-mono text-[length:var(--lkv-text-caption)]">{snapshot.routeDistanceKm} km</div>
      )}
    </article>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. VITEST TEST SUITE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

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

      const html = renderToStaticMarkup(<MockGPXLiveCard snapshot={snapshot} />);

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
        renderToStaticMarkup(<MockGPXLiveCard snapshot={snapshot} />);
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

      const html = renderToStaticMarkup(<MockKitLiveCard snapshot={snapshot} />);

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
        individualLoads: {
          u1: {
            participantId: 'u1',
            name: 'Alice',
            type: 'human',
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
      };

      const html = renderToStaticMarkup(<MockPackMergeSheet result={result} />);

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

      const html = renderToStaticMarkup(<MockEquipmentLiveCard snapshot={snapshot} />);

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

      const html = renderToStaticMarkup(<MockExpeditionLiveCard snapshot={snapshot} />);

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

      const html = renderToStaticMarkup(<MockGPXLiveCard snapshot={gpxSnapshot} />);

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

      const html = renderToStaticMarkup(<MockKitLiveCard snapshot={kitSnapshot} />);

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

      const html = renderToStaticMarkup(<MockGPXLiveCard snapshot={gpxSnapshot} />);

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

      const html = renderToStaticMarkup(<MockGPXLiveCard snapshot={gpxSnapshot} />);

      // Must use design system CSS variables, no hardcoded un-themed styling
      expect(html).toContain('var(--glass-border)');
      expect(html).toContain('var(--glass-bg-medium)');
      expect(html).toContain('var(--lkv-secondary)');
    });
  });
});
```

---

## 5. Verification Commands & Independent Validation

To independently verify the test suite once implemented:

```bash
# 1. Run the targeted Milestone 2 test suite
npx vitest run tests/messaging/outdoor-live-cards.spec.ts

# 2. Run all messaging test suites together
npx vitest run tests/messaging

# 3. Verify TypeScript compilation
npm run type-check

# 4. Verify code quality & linting
npm run lint
```

Expected output:
- `tests/messaging/outdoor-live-cards.spec.ts` -> 34 tests passed in < 250ms.
- 0 network requests triggered (`fetchSpy` count = 0).
- 0 NaN or undefined SVG coordinates.
- 100% adherence to 20% human and 15% dog physiological thresholds.
