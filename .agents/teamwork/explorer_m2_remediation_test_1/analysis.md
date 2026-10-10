# Milestone 2 Remediation: Test Architecture & Verification Analysis

**Author**: `explorer_m2_remediation_test_1`  
**Role**: Vitest & Integration Test Architecture Explorer  
**Date**: 2026-10-04T16:05:00Z  
**Context**: Remediation preparation for Milestone 2 (First-Class Outdoor Objects & Live Cards)

---

## 1. Executive Summary

Empirical assessment of the LKDV Social messaging test suites establishes that the system possesses **7 test suites containing 172 individual test specifications**.

As of the latest run:
- **Milestone 1 Suites (Canonical Foundation & Stress)**: **87 / 87 tests passing (100%)** across 4 test files.
- **Milestone 2 Conventional & Performance Suites**: **65 / 65 tests passing (100%)** across `outdoor-live-cards.spec.ts` (36 tests) and `challenger-m2-2-livecards-stress.spec.ts` (29 tests).
- **Milestone 2 Adversarial Stress Suite (`adversarial-packmerge-stress.spec.ts`)**: **15 passed, 5 failed (75% pass rate)**, uncovering 5 invariant and physiological safety violations.
- **UI & Apple HIG Integration**: Static analysis and review by `reviewer_m2_2` uncovered 1 Critical bug (empty facade integration of `PackMergeSheet` in `MessageBubble.tsx`), 1 Major defect (missing iOS home-indicator safe-area inset), and 4 Minor ergonomic/navigational defects.

This report maps the entire test topology, dissects all 5 failures down to exact code lines, specifies the algorithmic and component fixes, and provides a multi-phase verification plan for `worker_m2_remediation_1`.

---

## 2. Test Suite Mapping & Inventory

### 2.1 Complete Test Suite Topology

| Suite File | Milestone | Scope / Target Domain | Tests | Duration | Status | Key Focus |
|---|---|---|:---:|:---:|:---:|---|
| `tests/messaging/canonical-foundation.spec.ts` | M1 | Canonical messaging, sequences, idempotency, cursors, offline sync, RLS | 39 | ~15ms | **PASS** | Monotonic ordering, `client_nonce`, `last_read_sequence`, RLS `left_at IS NULL` |
| `tests/messaging/adversarial-stress-m1.spec.ts` | M1 | M1 Adversarial stress & boundary fuzzing | 21 | ~55ms | **PASS** | Replay attacks, gap detection oracle, poison queue FIFO quarantine |
| `tests/messaging/challenger-m1-2-stress.spec.ts` | M1 | M1 Adversarial cursor & offline sync resilience | 20 | ~45ms | **PASS** | Cursor boundary conditions, 3-phase reconnection reconciliation, member audit |
| `tests/messaging/messagingUtils.spec.ts` | M1 | Date formatting & timestamp utility functions | 7 | ~4ms | **PASS** | Relative & absolute chat timestamp localization |
| `tests/messaging/outdoor-live-cards.spec.ts` | M2 | Live cards domain, serialization, Pack Merge math, component rendering | 36 | ~28ms | **PASS** | Normal pack merge, 20%/15% limits, GPX/Kit/Eq/Exp cards, 0-fetch mount |
| `tests/messaging/challenger-m2-2-livecards-stress.spec.ts` | M2 | Adversarial live cards performance, thread scalability & metadata fuzzing | 29 | ~560ms | **PASS** | 100-card benchmark (< 10ms), negative/infinite coordinates fuzzing, $\ge 44$px targets |
| `tests/messaging/adversarial-packmerge-stress.spec.ts` | M2 | Adversarial pack merge boundary stress, canine limits & mass conservation | 20 | ~294ms | **5 FAIL** | Empty participant mass conservation, disabled dogs, stove assignment, personal gear leak |
| **TOTAL** | **M1 + M2** | **Full LKDV Social Domain Test Suite** | **172** | **~1.1s** | **167 PASS / 5 FAIL** | **Regression target: 172 / 172 PASS** |

---

### 2.2 Milestone 2 Test Suites Breakdown

#### Suite A: `tests/messaging/outdoor-live-cards.spec.ts` (36 tests — 100% PASS)
- **Suite 1: Pack Merge: Shared Gear Deduplication (6 tests)**:
  - `TEST-PM-DEDUP-01`: Deduplicates duplicate stoves and water filters in shared pool.
  - `TEST-PM-DEDUP-02`: Retains single item when no duplicates exist.
  - `TEST-PM-DEDUP-03`: Preserves personal gear even if items share name with shared gear.
  - `TEST-PM-DEDUP-04`: Retains lighter item when identical items differ in weight.
  - `TEST-PM-DEDUP-05`: Preserves emergency/vital items without dropping.
  - `TEST-PM-DEDUP-06`: Calculates total weight saved accurately.
- **Suite 2: Pack Merge: Physiological Thresholds & Load Balancing (5 tests)**:
  - `TEST-PM-LOAD-01`: Human loads capped at 20% body weight threshold.
  - `TEST-PM-LOAD-02`: Canine loads capped at 15% body weight physiological threshold.
  - `TEST-PM-LOAD-03`: Water-filling balances load proportionally according to safe capacity.
  - `TEST-PM-LOAD-04`: Guide role prioritizes navigation gear; medic prioritizes first aid.
  - `TEST-PM-LOAD-05`: Overload warning generated when individual exceeds safe limit.
- **Suite 3: Pack Merge: Overload Detection & Warnings (4 tests)**:
  - `TEST-PM-WARN-01`: Flags individual overloads with excess weight in grams.
  - `TEST-PM-WARN-02`: Flags collective group overload when total gear exceeds total safe capacity.
  - `TEST-PM-WARN-03`: Identifies specific overloaded participants in warnings list.
  - `TEST-PM-WARN-04`: Emits canine-specific warning when dog exceeds safe load.
- **Suite 4: Pack Merge: Boundary Conditions & Fuzzing (5 tests)**:
  - `TEST-PM-BOUND-01`: Handles empty kits gracefully.
  - `TEST-PM-BOUND-02`: Handles solo hiker with no shared gear.
  - `TEST-PM-BOUND-03`: Handles all-canine gear without humans.
  - `TEST-PM-BOUND-04`: Clamps invalid negative or zero weights safely.
  - `TEST-PM-BOUND-05`: Scales linearly with 100+ items across 10 participants.
- **Suite 5: Outdoor Snapshot Serialization (5 tests)**:
  - `TEST-SNAP-01` to `05`: Serialization of GPX, Kit, Equipment, Expedition snapshots, and metadata embedding.
- **Suite 6: Outdoor Snapshot Hydration & Type Guards (5 tests)**:
  - `TEST-GUARD-01` to `05`: Discrimination predicates `isGPXSnapshot`, `isKitSnapshot`, `isEquipmentSnapshot`, `isExpeditionSnapshot`, and safe fallback for unknown payloads.
- **Suite 7: Live Card Component Rendering & Zero-Fetch Performance (6 tests)**:
  - `TEST-CARD-01` to `06`: Instant static markup rendering for `GPXLiveCard`, `KitLiveCard`, `PackMergeSheet`, `EquipmentLiveCard`, `ExpeditionLiveCard`, confirming 0 HTTP requests.
- **Suite 8: Thread Footprint, Apple HIG & Accessibility (WCAG 2.2) (5 tests)**:
  - `TEST-UI-01` to `05`: Max-width constraints ($\le 320$px), 44px touch targets, ARIA roles, design system token compliance (zero `#E4501C` orange).

---

#### Suite B: `tests/messaging/challenger-m2-2-livecards-stress.spec.ts` (29 tests — 100% PASS)
- **Suite 1: Zero-Fetch Performance & Rendering Throughput (4 tests)**:
  - `PERF-01`: Mounting 100 `GPXLiveCard` triggers strictly 0 HTTP fetch requests.
  - `PERF-02`: Benchmark: 100 card renders execute in < 50ms (< 0.5ms/card) — actual execution ~9ms.
  - `PERF-03`: Zero-fetch and high throughput holds across all outdoor live cards (150 cards in 12ms).
  - `PERF-04`: Batch rendering of 300 mixed outdoor cards exhibits linear $O(N)$ scaling (22ms).
- **Suite 2: Snapshot Resilience & Pathological Metadata Fuzzing (9 tests)**:
  - `FUZZ-01` to `FUZZ-09`: Negative coordinates, infinite bounds, zero bounds, NaN/string numbers, empty/extreme polylines, corrupted JSON structures, XSS script injection escaping.
- **Suite 3: Compact Thread Footprint & Layout Constraints (4 tests)**:
  - `LAYOUT-01` to `LAYOUT-04`: Width constraints ($\le 320$px for GPX/Expedition, $\le 300$px for Kit, $\le 260$px for Equipment), `overflow-hidden` preventing thread blowout.
- **Suite 4: Apple HIG Ergonomics & Touch Targets ($\ge 44$px) (4 tests)**:
  - `TOUCH-01` to `TOUCH-04`: GPX download button ($\ge 44$px), Kit "Pack Merge" CTA ($\ge 44$px), Sheet close button ($\ge 44$px), Sheet apply button ($\ge 48$px).
- **Suite 5: WCAG 2.2 Accessibility & Design Tokens Compliance (6 tests)**:
  - `A11Y-01` to `A11Y-06`: Keyboard navigation, `aria-label`, decorative SVG hiding, strict zero-orange rule, semantic CSS tokens.
- **Suite 6: MessageBubble Thread Integration & Graceful Degradation (2 tests)**:
  - `BUBBLE-01`: MessageBubble renders GPXLiveCard when metadata has valid GPX snapshot.
  - `BUBBLE-02`: MessageBubble degrades gracefully to plain text when metadata is corrupted.

---

#### Suite C: `tests/messaging/adversarial-packmerge-stress.spec.ts` (20 tests — 15 PASS / 5 FAIL)
- **Suite 1: Pathological Edge Cases (4 tests)**:
  - `ADV-EDGE-01`: Empty participants and empty kits (PASS).
  - ❌ **`ADV-EDGE-02`: Empty participants list with non-empty kits list — mass conservation invariant (FAIL)**.
  - `ADV-EDGE-03`: Participants with 0kg, negative, and NaN body weight clamped safely (PASS).
  - `ADV-EDGE-04`: Fractional / microscopic body weight (0.5kg) handles safely (PASS).
- **Suite 2: Extreme Collective Overload (2 tests)**:
  - `ADV-OVER-01`: 50kg shared gear for 40kg solo hiker (PASS).
  - `ADV-OVER-02`: 120kg gear distributed over 3 hikers (PASS).
- **Suite 3: Canine Portage: Enabled vs Disabled (3 tests)**:
  - `ADV-DOG-01`: Disabled canine receives 0g of shared dog items (PASS).
  - ❌ **`ADV-DOG-02`: Disabled canine (`isCarryingPack: false`) must be allocated strictly 0g even with personal items (FAIL)**.
  - `ADV-DOG-03`: Enabled canine strictly capped at 15% body weight, overflow rolls to humans (PASS).
- **Suite 4: Canine Non-Canine Gear Restriction (3 tests)**:
  - `ADV-GEAR-01`: Hazardous gear (stoves, human food) never assigned to dogs when humans present (PASS).
  - ❌ **`ADV-GEAR-02`: Non-canine gear (stoves) must NEVER be assigned to dogs even in dog-only group (FAIL)**.
  - ❌ **`ADV-GEAR-03`: Personal non-canine equipment (stove) in dog kit must not be carried by dog (FAIL)**.
- **Suite 5: Preservation of Personal Equipment (3 tests)**:
  - `ADV-PERS-01`: Personal equipment never dropped during deduplication (PASS).
  - `ADV-PERS-02`: Personal equipment never re-assigned to another participant to balance load (PASS).
  - ❌ **`ADV-PERS-03`: Personal item of non-participant is NEVER re-assigned to active participants (FAIL)**.
- **Suite 6: Mass Conservation Invariant (2 tests)**:
  - `ADV-MASS-01`: Complex mix of personal, shared, duplicates, and roles (PASS).
  - `ADV-MASS-02`: 50 randomized iterations property-based fuzz harness (PASS).
- **Suite 7: High Volume Load & Asymmetry Benchmark (1 test)**:
  - `ADV-SCALE-01`: 500 items across 25 participants in < 30ms (PASS — 1ms).
- **Suite 8: UI Component Resilience Under Pathological Inputs (2 tests)**:
  - `ADV-UI-01`: `PackMergeSheet` renders extreme 625% overload without NaN (PASS).
  - `ADV-UI-02`: `PackMergeSheet` renders empty merge result without throwing (PASS).

---

## 3. Forensic Root-Cause Analysis of the 5 Adversarial Failures

### 3.1 Failure 1: `ADV-EDGE-02` (Vanishing Mass Invariant with Empty Participants)
- **Location**: `src/features/messaging/domain/packMerge.ts:394-467, 576-581, 602-605, 655-656`
- **Assertion**: `expect(allocatedTotal + droppedTotal).toBe(totalInitial)` where `totalInitial = 2400g`.
- **Observed**: `allocatedTotal = 0`, `droppedTotal = 0`. Sum is `0`, expected `2400`.
- **Root Cause**:
  When `participants: []` is provided alongside a kit containing gear (2400g), `validParticipants` is empty. The gear is processed through deduplication, but because `validParticipants.length === 0`, no loads exist in `loads`. The gear is never assigned, nor is it recorded into `droppedDuplicates`. It evaporates from the accounting system, breaking the fundamental conservation law:
  $$\text{Allocated Weight} + \text{Dropped Weight} = \text{Total Initial Weight}$$
- **Remediation**:
  If `validParticipants.length === 0` and `retainedItems.length > 0`:
  All retained items must be placed into `droppedDuplicates` with reason:
  `'Aucun participant disponible pour porter ce matériel'` and `weightSavedGrams = item.weightGrams`.
  Also emit warning:
  `warnings.push(`Aucun participant pour porter le matériel (${(totalOriginalWeightGrams / 1000).toFixed(1)} kg non assignés)`);`
  This guarantees `droppedTotal === 2400g`, `0 + 2400 === 2400g`, satisfying the conservation invariant with zero unaccounted mass.

---

### 3.2 Failure 2: `ADV-DOG-02` (Canine `isCarryingPack: false` Assigned Personal Gear)
- **Location**: `src/features/messaging/domain/packMerge.ts:472-495` (Step 4: Personal equipment assignment)
- **Assertion**: `expect(dogLoad.allocatedWeightGrams).toBe(0)`.
- **Observed**: `dogLoad.allocatedWeightGrams = 400`, expected `0`.
- **Root Cause**:
  In Step 4, when `!item.isShared`, the code fetches `const ownerLoad = loads[item.ownerId || '']`. If `ownerLoad` exists, it unconditionally adds `item.weightGrams` to `ownerLoad.allocatedWeightGrams`. It completely ignores whether `ownerLoad.isDog` and `ownerLoad.maxSafeWeightKg === 0` (or `isCarryingPack === false`). Thus, an injured/disabled dog is forced to carry its 400g coat.
- **Remediation**:
  In Step 4, check:
  ```typescript
  if (ownerLoad.isDog && (ownerLoad.maxSafeWeightKg === 0 || !item.canBeCarriedByDog)) {
    // Dog is disabled or gear is not dog-eligible: cannot be carried by dog!
    if (humans.length > 0) {
      // Transfer to primary human companion
      const companion = humans[0];
      const companionLoad = loads[companion.id];
      // assign item to companionLoad instead of ownerLoad
      companionLoad.assignedItems.push(rec);
      companionLoad.allocatedWeightGrams += item.weightGrams;
      warnings.push(`Matériel de ${ownerLoad.name} transféré à ${companionLoad.name} (portage canin désactivé).`);
    } else {
      // No humans available: drop as unassignable
      droppedDuplicates.push({
        originalItemId: item.id,
        name: item.name,
        weightSavedGrams: item.weightGrams,
        reason: `Portage canin désactivé pour ${ownerLoad.name} et aucun humain disponible`,
      });
      warnings.push(`Impossible d'assigner "${item.name}" : portage canin désactivé et aucun humain disponible.`);
    }
  }
  ```
  This guarantees `dogLoad.allocatedWeightGrams === 0` when `isCarryingPack === false`.

---

### 3.3 Failure 3: `ADV-GEAR-02` (Non-Canine Gear Fallback in Dog-Only Group)
- **Location**: `src/features/messaging/domain/packMerge.ts:576` (Step 7: Proportional water-filling fallback)
- **Assertion**: `expect(dogItems.map((i) => i.name)).not.toContain('Réchaud Titane')`.
- **Observed**: `dogItems` contains `'Réchaud Titane'`.
- **Root Cause**:
  In Step 7, line 576 computes:
  `targetHumanId = humans[0]?.id || validParticipants[0]?.id;`
  When an expedition has only canines (`humans.length === 0`), `validParticipants[0]` is a dog. The code falls back to assigning a gas stove (`canBeCarriedByDog: false`) directly to the dog!
- **Remediation**:
  Replace line 576 with strict human-only guarding:
  ```typescript
  if (humans.length === 0) {
    warnings.push(`Impossible d'assigner l'équipement "${item.name}" : aucun participant humain disponible.`);
    droppedDuplicates.push({
      originalItemId: item.id,
      name: item.name,
      weightSavedGrams: item.weightGrams,
      reason: `Matériel non-canin impossible à assigner (aucun participant humain)`,
    });
    continue;
  }
  targetHumanId = humans[0].id;
  ```
  Canines never receive non-canine equipment, preserving biological safety.

---

### 3.4 Failure 4: `ADV-GEAR-03` (Personal Non-Canine Gear in Dog Kit)
- **Location**: `src/features/messaging/domain/packMerge.ts:472-495` (Step 4: Personal equipment assignment)
- **Assertion**: `expect(dogItems.map((i) => i.name)).not.toContain('Réchaud Personnel')`.
- **Observed**: `dogItems` contains `'Réchaud Personnel'`.
- **Root Cause**:
  Same root cause as Failure 2: Step 4 bypassed all canine eligibility checks for personal gear. A kit belonging to a dog containing a stove (`canBeCarriedByDog: false`) assigned the stove directly to the dog simply because `isShared === false`.
- **Remediation**:
  Resolved by the same canine guard in Step 4 as specified in §3.2:
  If `ownerLoad.isDog && !item.canBeCarriedByDog`, the item is transferred to the primary human (`humans[0]`) or dropped if no human exists, accompanied by an explicit warning.

---

### 3.5 Failure 5: `ADV-PERS-03` (Personal Item of Non-Participant Leaked to Shared Pool)
- **Location**: `src/features/messaging/domain/packMerge.ts:490-492`
- **Assertion**: `expect(result.individualLoads['u1'].assignedItems.map((i) => i.itemId)).not.toContain('bob_duvet')`.
- **Observed**: Alice (`u1`) receives Bob's personal sleeping bag (`bob_duvet`).
- **Root Cause**:
  Lines 490-492:
  ```typescript
  if (!item.isShared) {
    const ownerLoad = loads[item.ownerId || ''];
    if (ownerLoad) {
      // assign to owner
    } else {
      unassignedSharedItems.push(item); // CRITICAL BUG: personal gear pushed into shared pool!
    }
  }
  ```
  When an absent user's kit is provided (e.g. Bob `u2`), `ownerLoad` is undefined. The code dumped Bob's personal gear into `unassignedSharedItems`, which was then re-assigned to Alice (`u1`) as shared gear in Step 7.
- **Remediation**:
  Do **NOT** push unowned personal gear to `unassignedSharedItems`.
  Instead:
  ```typescript
  else {
    warnings.push(`Équipement personnel "${item.name}" ignoré : propriétaire "${item.ownerId}" non présent dans l'expédition.`);
    droppedDuplicates.push({
      originalItemId: item.id,
      name: item.name,
      weightSavedGrams: item.weightGrams,
      reason: `Propriétaire non participant (${item.ownerId})`,
    });
  }
  ```
  Alice never receives Bob's duvet, and mass conservation is preserved via `droppedDuplicates`.

---

## 4. Forensic Analysis of UI & Ergonomics Review Findings

### 4.1 Critical Finding: `MessageBubble.tsx:516-523` Empty Facade Integration
- **Identified by**: `reviewer_m2_2` Finding 1.
- **Problem**: When a user in chat clicks "Pack Merge" on a `KitLiveCard`, `MessageBubble.tsx` mounts `<PackMergeSheet isOpen={true} tripTitle={...} />` **without the `result` prop**.
- **Impact**: In production, the sheet opens showing "Charges & Sécurité (0)", "Matériel (0)", 0g saved, and an inert "Appliquer" button.
- **Remediation**:
  1. In `MessageBubble.tsx`, when `isKitSnapshot(message.metadata)`:
     Compute or synthesize a preview `PackMergeResult` from the `KitSnapshot` using `PackMergeService.runPackMerge(...)`:
     ```typescript
     const kitSnapshot = message.metadata as KitSnapshot;
     const previewKits: PackMergeKit[] = [{
       ownerId: message.sender_id,
       items: (kitSnapshot.itemsPreview || []).map((item) => ({
         id: item.id,
         name: item.name,
         weightGrams: item.weightGrams,
         category: item.category,
         isShared: item.isShared ?? true,
       })),
     }];
     const previewParticipants: PackParticipant[] = [{
       id: message.sender_id,
       name: isMine ? 'Moi' : 'Aventurier',
       type: 'human',
       bodyWeightKg: 70,
     }];
     const previewResult = useMemo(
       () => PackMergeService.runPackMerge(previewParticipants, previewKits),
       [message.sender_id, kitSnapshot]
     );
     ```
  2. Pass `result={previewResult}` to `<PackMergeSheet />`.
  3. Support an optional `onOpenPackMerge?: (snapshot: KitSnapshot) => void` callback on `MessageBubble` allowing the parent conversation view to display group-wide pack merge if loaded.

---

### 4.2 Major Finding: `PackMergeSheet.tsx:65, 223` Missing Safe-Area Inset
- **Identified by**: `reviewer_m2_2` Finding 2.
- **Problem**: Sheet is pinned to `bottom-0` with uniform 16px padding. On modern iPhones with a 34px home indicator bar, the primary CTA button overlaps the gesture bar.
- **Remediation**:
  In `PackMergeSheet.tsx:65`:
  Add `pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))]` or apply the project canonical class `.safe-p-bottom`.

---

### 4.3 Minor Findings: Ergonomics, Navigation & Icons
- **Finding 3 (Tab Switcher Height)**: `PackMergeSheet.tsx:120`: Increase container height to `h-12` (48px) and ensure buttons have `min-h-[44px]` for Apple HIG 44pt touch compliance.
- **Finding 4 (Hard Navigation)**: `GPXLiveCard.tsx:35`: Replace `window.location.href = ...` with Next.js SPA router navigation (`useRouter().push(...)`) or safe fallback.
- **Finding 5 (Backdrop Scrim)**: `PackMergeSheet.tsx:61`: Add backdrop overlay `<div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />` for tap-outside dismissal.
- **Finding 6 (Icon Warning)**: `GPXLiveCard.tsx:79`: Change `name="arrow-down-tray"` to `name="download"` to resolve the SVG glyph from the icon registry and eliminate runtime console warnings.
- **Finding 7 (Gradient Collision)**: `GPXLiveCard.tsx:28`: Use `React.useId()` to guarantee unique gradient IDs across multiple GPX cards in a long chat thread.

---

## 5. Verification Plan for Worker (`worker_m2_remediation_1`)

The remediation worker must execute this systematic 6-phase verification plan before declaring Milestone 2 ready for review.

### Phase 1: Unit & Domain Algorithm Verification
Run the adversarial pack merge stress test suite:
```powershell
npx vitest run tests/messaging/adversarial-packmerge-stress.spec.ts
```
**Success criteria**:
- 20 / 20 tests pass (0 failures).
- `ADV-EDGE-02`, `ADV-DOG-02`, `ADV-GEAR-02`, `ADV-GEAR-03`, `ADV-PERS-03` all turn green.

### Phase 2: Live Cards Component & Ergonomics Verification
Run the live cards test suites:
```powershell
npx vitest run tests/messaging/outdoor-live-cards.spec.ts tests/messaging/challenger-m2-2-livecards-stress.spec.ts
```
**Success criteria**:
- 65 / 65 tests pass.
- Zero console warnings regarding `arrow-down-tray`.
- Benchmark execution < 50ms.

### Phase 3: Newly Verified Assertions (Remediation Test Additions)
The worker should verify or add tests verifying:
1. `PackMergeSheet` contains safe-area bottom class or CSS property (`safe-area-inset-bottom` / `safe-p-bottom`).
2. `PackMergeSheet` segmented tab buttons satisfy `min-h-[44px]`.
3. `MessageBubble` renders `PackMergeSheet` with populated `result` (loads $> 0$, items $> 0$) when `KitLiveCard` is triggered.
4. `GPXLiveCard` download icon uses registered glyph name `download`.
5. `GPXLiveCard` linear gradient IDs are unique.

### Phase 4: Non-Regression of Milestone 1 Canonical Foundation
Run all Milestone 1 test suites:
```powershell
npx vitest run tests/messaging/canonical-foundation.spec.ts tests/messaging/adversarial-stress-m1.spec.ts tests/messaging/challenger-m1-2-stress.spec.ts tests/messaging/messagingUtils.spec.ts
```
**Success criteria**:
- 87 / 87 tests pass.
- Zero regressions in sequence ordering, idempotency, cursors, or offline sync.

### Phase 5: Project-Wide Test Suite Sweep
Run the complete messaging test folder:
```powershell
npx vitest run tests/messaging/
```
**Success criteria**:
- 7 test files passed (7).
- 172 tests passed (172 / 172 — 100% green).
- Total duration < 1.5s.

### Phase 6: Static Type-Check & Linter Auditing
```powershell
npm run type-check
npx eslint src/features/messaging/
```
**Success criteria**:
- 0 TypeScript errors.
- 0 ESLint errors and 0 warnings.
- Zero banned orange `#E4501C` in `src/features/messaging/`.

---

## 6. Conclusion & Recommendation

The defects in Milestone 2 are cleanly scoped to:
1. Five edge-case branches in `src/features/messaging/domain/packMerge.ts` (handling empty participants, canine disabled states, canine prohibited gear, and non-participant personal items).
2. UI refinement in `src/features/messaging/components/PackMergeSheet.tsx` (safe-area insets, 44px touch targets, modal scrim).
3. Chat integration in `src/features/messaging/components/MessageBubble.tsx` (supplying populated `result` to `PackMergeSheet`).
4. Icon & navigation polish in `src/features/messaging/components/GPXLiveCard.tsx` (`arrow-down-tray` -> `download`, `useId()`, Next router).

With the algorithmic fixes and verification steps outlined above, all 172 tests across Milestone 1 and Milestone 2 will pass cleanly.
