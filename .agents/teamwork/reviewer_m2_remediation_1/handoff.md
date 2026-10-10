# Review & Adversarial Stress Report: Milestone 2 Remediation

**Agent**: `reviewer_m2_remediation_1`  
**Roles**: reviewer, critic  
**Working directory**: `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\reviewer_m2_remediation_1`  
**Date**: 2026-10-04T14:27:30Z  
**Verdict**: **`REQUEST_CHANGES`**  

---

## 1. Observation

Direct empirical evidence obtained from codebase inspection, type-checking, and test suite execution:

### 1.1 Type Check & Test Executions

1. **TypeScript Typecheck**:
   ```
   Command: npm run type-check
   Output:
   > tsc --noEmit
   Exit Code: 0 (0 errors)
   ```

2. **Milestone 2 Target Tests**:
   ```
   Command: npx vitest run tests/messaging/adversarial-packmerge-stress.spec.ts tests/messaging/outdoor-live-cards.spec.ts
   Output:
   ✓ tests/messaging/adversarial-packmerge-stress.spec.ts (20 tests) 299ms
   ✓ tests/messaging/outdoor-live-cards.spec.ts (36 tests) 30ms
   Test Files  2 passed (2)
   Tests       56 passed (56)
   ```

3. **Challenger Pathological Stress Suite**:
   ```
   Command: npx vitest run tests/messaging/challenger-m2-pathological-stress.spec.ts
   Output:
   FAIL tests/messaging/challenger-m2-pathological-stress.spec.ts > Challenger M2 Pathological Stress Tests > 2. Extreme Dog Pack Caps & Multi-Canine Allocations > CHALLENGE-BUG-01: Disabled dog (isCarryingPack: false) with maxWeightGramsOverride must NOT be allocated gear or have non-zero capacity
   AssertionError: expected 0.5 to be +0 // Object.is equality
   - Expected: 0
   + Received: 0.5
     tests/messaging/challenger-m2-pathological-stress.spec.ts:296:37

   FAIL tests/messaging/challenger-m2-pathological-stress.spec.ts > Challenger M2 Pathological Stress Tests > 4. Randomized Property-Based Fuzzing (100 Iterations) > CHALLENGE-FUZZ-01: 100 randomized expeditions preserve all physical and safety invariants
   AssertionError: expected 1787 to be +0 // Object.is equality
   - Expected: 0
   + Received: 1787
     tests/messaging/challenger-m2-pathological-stress.spec.ts:462:44
   ```

4. **Design Governance Linting Suite**:
   ```
   Command: npx vitest run tests/design/unification.spec.ts
   Output:
   FAIL tests/design/unification.spec.ts > CHANTIER U — GARDE-FOUS DE GOUVERNANCE > U-D61 : aucune classe froide zinc/gray/slate/amber/emerald/blue
   AssertionError: Classes froides dans:
   src/features/messaging/components/PackMergeSheet.tsx: text-amber-800: expected [ Array(1) ] to deeply equal []
   - Expected: []
   + Received: ["src/features/messaging/components/PackMergeSheet.tsx: text-amber-800"]
   ```

### 1.2 Code Inspection Observations

1. **`src/features/messaging/domain/packMerge.ts` lines 473-488**:
   ```typescript
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
   ```
   `p.maxWeightGramsOverride` is applied unconditionally outside the `!isDog` / `isDog` branch, directly overwriting `maxSafeKg = 0` for disabled canines (`p.isCarryingPack === false`).

2. **`src/features/messaging/domain/packMerge.ts` lines 560-565**:
   ```typescript
   } else if (ownerLoad.isDog) {
     // Canine personal equipment (ADV-DOG-02, ADV-GEAR-03)
     const canDogCarry =
       ownerLoad.maxSafeWeightKg > 0 &&
       isItemDogEligible(item);
   ```
   `canDogCarry` evaluates to `true` whenever `ownerLoad.maxSafeWeightKg > 0`, which occurs for disabled dogs having `maxWeightGramsOverride`. Consequently, personal items (e.g. 1787g in `CHALLENGE-FUZZ-01`) are assigned to the disabled dog.

3. **`src/features/messaging/domain/packMerge.ts` lines 301-305**:
   ```typescript
   export function isItemDogEligible(item: PackGearItem): boolean {
     if (item.canBeCarriedByDog === false) return false;
     if (item.canBeCarriedByDog === true || item.isDogItem === true) return true;
     if (isStoveItem(item) || isShelterItem(item)) return false;
     return isDogSpecificItem(item);
   }
   ```
   `item.canBeCarriedByDog === true` is evaluated before `isStoveItem(item)` and `isShelterItem(item)`, allowing hazardous items marked `canBeCarriedByDog: true` to bypass safety exclusion.

4. **`src/features/messaging/components/PackMergeSheet.tsx` line 134**:
   ```tsx
   <div
     key={idx}
     className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs font-semibold text-amber-800 dark:text-amber-200"
   >
   ```
   Uses raw Tailwind amber classes (`bg-amber-500/10`, `text-amber-800`, `dark:text-amber-200`), violating project design token rule `U-D61`.

---

## 2. Logic Chain

1. **Canine Safety Invariant Breach (Requirement 2)**:
   - *Observation*: `p.isCarryingPack === false` with `p.maxWeightGramsOverride: 195` produces `maxSafeWeightKg: 0.2` and allocated weight `1787g` in `CHALLENGE-FUZZ-01`.
   - *Reasoning*: A canine incapable of carrying a pack (`isCarryingPack: false`) must have strictly 0g safe capacity and 0g allocated gear under all conditions. An override value cannot medically or physically enable an incapacitated or non-pack-carrying dog.
   - *Deduction*: Because line 484 overrides `maxSafeKg` regardless of `canCarry`, disabled canines are granted safe capacity and subsequently assigned personal gear in Step 4.

2. **Hazardous Canine Equipment Precedence (Requirement 3)**:
   - *Observation*: In `isItemDogEligible`, line 302 returns `true` for `canBeCarriedByDog === true` before checking `isStoveItem(item) || isShelterItem(item)` at line 303.
   - *Reasoning*: Equipment safety rules require that stoves, fuel, and shelters must never be placed on dogs under any circumstances. Category-level hazards must take precedence over positive boolean flags.

3. **Design Governance Compliance (`U-D61`)**:
   - *Observation*: `text-amber-800` in `PackMergeSheet.tsx` triggers a failure in `tests/design/unification.spec.ts`.
   - *Reasoning*: LKDV enforces strict token governance banning cold tailwind colors (`zinc`, `gray`, `slate`, `amber`, `emerald`, `blue`). Alert and warning surfaces must use canonical design tokens (e.g. `var(--lkv-action)` or `var(--lkv-warning)`).

4. **Satisfied Requirements**:
   - *Requirement 1 (Mass conservation under empty participants)*: VERIFIED PASS. In `packMerge.ts:406-457`, when `participants.length === 0`, all retained items are moved to `droppedDecisions`, `weightSavedGrams` is accumulated, and `allocatedTotal (0) + droppedTotal (initialTotal) === initialTotal`.
   - *Requirement 4 (Personal gear isolation)*: VERIFIED PASS. In `packMerge.ts:542-559`, gear belonging to absent owners is quarantined to `droppedDecisions` with explicit warnings; never converted to shared gear or distributed.
   - *Requirement 5 (`computeKitPreviewMergeResult`)*: VERIFIED PASS. Correctly constructs a 2-person preview expedition running authentic water-filling load balancing and deduplication.

---

## 3. Caveats

- No integrity violations (hardcoded test results or facades) were detected in `packMerge.ts` or `computeKitPreviewMergeResult`. The implementations are algorithmic and genuine.
- The failure is a logical edge-case defect where `maxWeightGramsOverride` bypassed the `isCarryingPack === false` check, coupled with a CSS token governance lint failure.

---

## 4. Conclusion

Remediation work in Milestone 2 is substantially solid but requires a targeted fix before approval.

### Required Changes:

1. **Fix Canine Safety Capacity in `src/features/messaging/domain/packMerge.ts`**:
   Ensure `maxWeightGramsOverride` only applies when `isDog` has `p.isCarryingPack !== false`:
   ```typescript
   if (!isDog) {
     ratio = targetHumanRatio;
     maxSafeKg = Math.round(bodyWeight * ratio * 10) / 10;
     if (p.maxWeightGramsOverride && p.maxWeightGramsOverride > 0) {
       maxSafeKg = Math.round((p.maxWeightGramsOverride / 1000) * 10) / 10;
     }
   } else {
     ratio = targetDogRatio;
     const canCarry = p.isCarryingPack !== false;
     if (!canCarry) {
       maxSafeKg = 0;
     } else if (p.maxWeightGramsOverride && p.maxWeightGramsOverride > 0) {
       maxSafeKg = Math.round((p.maxWeightGramsOverride / 1000) * 10) / 10;
     } else {
       maxSafeKg = calculateDogMaxPackWeight(bodyWeight, ratio);
     }
   }
   ```

2. **Fix Precedence in `isItemDogEligible` in `src/features/messaging/domain/packMerge.ts`**:
   Place stove/shelter checks ahead of `canBeCarriedByDog === true`:
   ```typescript
   export function isItemDogEligible(item: PackGearItem): boolean {
     if (item.canBeCarriedByDog === false) return false;
     if (isStoveItem(item) || isShelterItem(item)) return false;
     if (item.canBeCarriedByDog === true || item.isDogItem === true) return true;
     return isDogSpecificItem(item);
   }
   ```

3. **Enforce `isCarryingPack !== false` in Step 4**:
   In `src/features/messaging/domain/packMerge.ts`:
   ```typescript
   const canDogCarry =
     ownerLoad.maxSafeWeightKg > 0 &&
     isItemDogEligible(item);
   ```
   (With `maxSafeWeightKg` correctly clamped to 0 when `!canCarry`, this evaluates to false for disabled dogs).

4. **Replace forbidden Tailwind Amber classes in `src/features/messaging/components/PackMergeSheet.tsx:134`**:
   Replace `bg-amber-500/10 text-amber-800 dark:text-amber-200` with semantic design tokens:
   `className="flex items-center gap-2 rounded-xl bg-[color:var(--lkv-action)]/10 p-2.5 text-xs font-semibold text-[color:var(--lkv-action)]"`

---

## 5. Verification Method

To verify the required fix:

1. **Verify challenger pathological stress suite passes**:
   ```powershell
   npx vitest run tests/messaging/challenger-m2-pathological-stress.spec.ts
   ```
   *Expected*: 11 passed (11), 0 failed.

2. **Verify adversarial and live cards suites pass**:
   ```powershell
   npx vitest run tests/messaging/adversarial-packmerge-stress.spec.ts tests/messaging/outdoor-live-cards.spec.ts
   ```
   *Expected*: 56 passed (56), 0 failed.

3. **Verify design governance passes**:
   ```powershell
   npx vitest run tests/design/unification.spec.ts
   ```
   *Expected*: `U-D61` passes with 0 cold classes.

4. **Verify TypeScript compilation**:
   ```powershell
   npm run type-check
   ```
   *Expected*: 0 errors.
