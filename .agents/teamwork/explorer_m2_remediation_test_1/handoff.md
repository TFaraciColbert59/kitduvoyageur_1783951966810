# Handoff Report: Milestone 2 Test Suite Architecture & Remediation Verification Plan

**Agent**: `explorer_m2_remediation_test_1`  
**Roles**: explorer, specialist (Vitest & Integration Test Architecture)  
**Working directory**: `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_remediation_test_1`  
**Milestone**: M2 (First-Class Outdoor Objects & Live Cards Remediation)  
**Date**: 2026-10-04T16:08:00Z  
**Type**: Hard Handoff  

---

## 1. Observation

Direct empirical observations from Vitest test execution and codebase inspection:

### 1.1 Complete Messaging Test Topology Run
Executed command:
```powershell
npx vitest run tests/messaging/
```
Result:
- **Test Files**: 1 failed | 6 passed (7 total test files)
- **Tests**: 5 failed | 167 passed (172 total tests)
- **Duration**: 1.15s

Breakdown by file:
1. `tests/messaging/canonical-foundation.spec.ts`: **39 passed** (39) in 15ms.
2. `tests/messaging/adversarial-stress-m1.spec.ts`: **21 passed** (21) in 55ms.
3. `tests/messaging/challenger-m1-2-stress.spec.ts`: **20 passed** (20) in 45ms.
4. `tests/messaging/messagingUtils.spec.ts`: **7 passed** (7) in 4ms.
   *Subtotal Milestone 1*: **87 / 87 passed (100%)**.
5. `tests/messaging/outdoor-live-cards.spec.ts`: **36 passed** (36) in 28ms.
6. `tests/messaging/challenger-m2-2-livecards-stress.spec.ts`: **29 passed** (29) in 561ms.
7. `tests/messaging/adversarial-packmerge-stress.spec.ts`: **15 passed, 5 failed** (20) in 294ms.
   *Subtotal Milestone 2*: **80 passed, 5 failed (94.1%)**.

---

### 1.2 Verbatim Failures in `tests/messaging/adversarial-packmerge-stress.spec.ts`

1. **`ADV-EDGE-02`: Empty participants list with non-empty kits list — mass conservation invariant**
   - **File & Line**: `tests/messaging/adversarial-packmerge-stress.spec.ts:66:45`
   - **Target Code**: `src/features/messaging/domain/packMerge.ts:394-467, 655-656`
   - **Verbatim Error**:
     ```
     AssertionError: expected +0 to be 2400 // Object.is equality
     - Expected: 2400
     + Received: 0
     ```
   - **Cause**: When `participants: []` and 2400g kit is passed, gear evaporates without being assigned or dropped. `allocatedTotal (0) + droppedTotal (0) !== 2400`.

2. **`ADV-DOG-02`: Disabled canine (`isCarryingPack: false`) must be allocated strictly 0g even with personal items**
   - **File & Line**: `tests/messaging/adversarial-packmerge-stress.spec.ts:240:44`
   - **Target Code**: `src/features/messaging/domain/packMerge.ts:472-495`
   - **Verbatim Error**:
     ```
     AssertionError: expected 400 to be +0 // Object.is equality
     - Expected: 0
     + Received: 400
     ```
   - **Cause**: Step 4 personal gear assignment unconditionally adds `item.weightGrams` to `ownerLoad.allocatedWeightGrams` without checking if `ownerLoad.isDog` and `ownerLoad.maxSafeWeightKg === 0`.

3. **`ADV-GEAR-02`: Non-canine gear (stoves) must NEVER be assigned to dogs even in dog-only group**
   - **File & Line**: `tests/messaging/adversarial-packmerge-stress.spec.ts:334:47`
   - **Target Code**: `src/features/messaging/domain/packMerge.ts:576`
   - **Verbatim Error**:
     ```
     AssertionError: expected [ 'Réchaud Titane' ] to not include 'Réchaud Titane'
     ```
   - **Cause**: Step 7 fallback `targetHumanId = humans[0]?.id || validParticipants[0]?.id;` falls back to a dog when `humans` is empty, assigning human gear to animals.

4. **`ADV-GEAR-03`: Personal non-canine equipment (stove) in dog kit must not be carried by dog**
   - **File & Line**: `tests/messaging/adversarial-packmerge-stress.spec.ts:356:47`
   - **Target Code**: `src/features/messaging/domain/packMerge.ts:472-495`
   - **Verbatim Error**:
     ```
     AssertionError: expected [ 'Réchaud Personnel' ] to not include 'Réchaud Personnel'
     ```
   - **Cause**: Step 4 personal gear assignment does not verify canine gear eligibility (`canBeCarriedByDog: false`).

5. **`ADV-PERS-03`: Personal item of non-participant is NEVER re-assigned to active participants**
   - **File & Line**: `tests/messaging/adversarial-packmerge-stress.spec.ts:446:83`
   - **Target Code**: `src/features/messaging/domain/packMerge.ts:490-492`
   - **Verbatim Error**:
     ```
     AssertionError: expected [ 'bob_duvet' ] to not include 'bob_duvet'
     ```
   - **Cause**: When `loads[item.ownerId]` is missing for personal item, code executes `unassignedSharedItems.push(item);`, forcing private gear into shared distribution.

---

### 1.3 UI & Mobile Integration Defects Identified by Reviewer M2-2 & Challenger M2-2
1. **`MessageBubble.tsx:516-523`**: `<PackMergeSheet isOpen={true} ... />` rendered without `result` prop, showing empty dialog with (0) items/loads in production.
2. **`PackMergeSheet.tsx:65, 223`**: Fixed to `bottom-0` with uniform 16px padding, missing iOS safe area inset (`pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))]`), overlapping home indicator bar.
3. **`PackMergeSheet.tsx:120-149`**: Segmented tab buttons have 32px height in 40px container, violating Apple HIG 44px touch target.
4. **`GPXLiveCard.tsx:35`**: Direct `window.location.href = ...` triggers full page reload instead of Next.js SPA navigation.
5. **`GPXLiveCard.tsx:79`**: Non-existent glyph `name="arrow-down-tray"` triggers console warnings (must be `name="download"`).
6. **`GPXLiveCard.tsx:28`**: Non-unique SVG gradient ID risks DOM collisions across multiple GPX cards (needs `useId()`).
7. **`PackMergeSheet.tsx:61`**: Missing modal backdrop scrim overlay for tap-outside dismissal.

---

## 2. Logic Chain

1. **Root-Cause to Algorithmic Fixes in `packMerge.ts`**:
   - `ADV-EDGE-02`: Mass conservation requires $\text{Allocated} + \text{Dropped} = \text{Initial}$. When `participants.length === 0`, all unassigned items must be recorded in `droppedDuplicates` with reason `'Aucun participant disponible pour porter ce matériel'` and a warning emitted.
   - `ADV-DOG-02` & `ADV-GEAR-03`: In Step 4, when `ownerLoad.isDog` and `(ownerLoad.maxSafeWeightKg === 0 || !item.canBeCarriedByDog)`, the item cannot be assigned to the dog. If humans exist, transfer to `humans[0]` with an explicit warning; if no humans, record in `droppedDuplicates`.
   - `ADV-GEAR-02`: In Step 7, if `humans.length === 0`, human gear cannot be carried. It must NOT fall back to `validParticipants[0]`. It must be recorded in `droppedDuplicates` with a warning.
   - `ADV-PERS-03`: In Step 4, if `ownerLoad` is missing, personal gear must NEVER be pushed to `unassignedSharedItems`. It must be placed in `droppedDuplicates` with reason `'Propriétaire non participant'` and an explicit warning.

2. **Root-Cause to UI Fixes in `PackMergeSheet.tsx`, `MessageBubble.tsx`, `GPXLiveCard.tsx`**:
   - Supplying `result={previewResult}` in `MessageBubble.tsx` (computed via `PackMergeService.runPackMerge(...)` from `KitSnapshot`) guarantees the sheet displays non-empty loads, weights, and items.
   - Adding `pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))]` guarantees that the action button never collides with the iOS home indicator bar.
   - Sizing tab buttons to `min-h-[44px]` guarantees full Apple HIG tap target compliance.
   - Replacing `arrow-down-tray` with `download` in `GPXLiveCard.tsx` resolves the SVG glyph and eliminates all console warnings.
   - Generating gradient IDs via `useId()` prevents SVG fill corruption across long threads.

3. **Inference**:
   Addressing these 5 domain branches and 5 UI touchpoints will bring the messaging test suite from 167/172 to 172/172 (100% green) with 0 regressions on Milestone 1.

---

## 3. Caveats

1. **No Production Source Code Modifications Undertaken**:
   In strict accordance with the explorer role guidelines, no production files in `src/` or tests in `tests/` were altered. All proposed modifications are documented in detail for `worker_m2_remediation_1`.
2. **Environment**:
   Tests run in Node.js with Vitest SSR (`renderToStaticMarkup`). Mobile pointer drag gestures and hardware haptic vibrations are mocked via `useHapticFeedback` and tested in Playwright E2E suites.

---

## 4. Conclusion

The defects preventing Milestone 2 approval are precisely isolated to:
1. Five edge-case branches in `src/features/messaging/domain/packMerge.ts`.
2. Missing `result` prop propagation in `src/features/messaging/components/MessageBubble.tsx`.
3. Ergonomic safe-area and touch-target padding in `src/features/messaging/components/PackMergeSheet.tsx`.
4. Icon glyph and gradient ID polish in `src/features/messaging/components/GPXLiveCard.tsx`.

The remediation worker (`worker_m2_remediation_1`) has a clear, deterministic path to resolve all issues without introducing regressions.

---

## 5. Verification Method

### Step 1: Verify Adversarial Stress Suite (Target: 20/20 PASS)
```powershell
npx vitest run tests/messaging/adversarial-packmerge-stress.spec.ts
```
*Expected*: All 20 tests pass, including `ADV-EDGE-02`, `ADV-DOG-02`, `ADV-GEAR-02`, `ADV-GEAR-03`, `ADV-PERS-03`.

### Step 2: Verify Milestone 2 Live Cards Suites (Target: 65/65 PASS)
```powershell
npx vitest run tests/messaging/outdoor-live-cards.spec.ts tests/messaging/challenger-m2-2-livecards-stress.spec.ts
```
*Expected*: All 65 tests pass, with zero `[Icon] No glyph resolved` console warnings.

### Step 3: Verify Milestone 1 Non-Regression (Target: 87/87 PASS)
```powershell
npx vitest run tests/messaging/canonical-foundation.spec.ts tests/messaging/adversarial-stress-m1.spec.ts tests/messaging/challenger-m1-2-stress.spec.ts tests/messaging/messagingUtils.spec.ts
```
*Expected*: All 87 tests pass cleanly.

### Step 4: Verify Full Messaging Test Suite (Target: 172/172 PASS)
```powershell
npx vitest run tests/messaging/
```
*Expected*: 7 test files passed, 172 passed (172), 0 failed in < 1.5s.

### Step 5: Verify Type-Check and Linter
```powershell
npm run type-check
npx eslint src/features/messaging/
```
*Expected*: 0 errors, 0 warnings.
