# Empirical Challenger Report: Milestone 2 Pack Merge Stress Testing

**Agent**: `challenger_m2_remediation_1`  
**Roles**: critic, specialist  
**Working directory**: `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\challenger_m2_remediation_1`  
**Date**: 2026-10-04T14:30:00Z  
**Verdict**: **`REQUEST_CHANGES`**  

---

## 1. Observation

Direct empirical evidence obtained from codebase inspection, adversarial test harness execution, randomized property-based fuzzing, and boundary condition evaluation:

### 1.1 Test Suite Executions

1. **Adversarial Pack Merge Stress Suite (`adversarial-packmerge-stress.spec.ts`)**:
   ```
   Command: npx vitest run tests/messaging/adversarial-packmerge-stress.spec.ts
   Output:
   ✓ tests/messaging/adversarial-packmerge-stress.spec.ts (20 tests) 334ms
   Test Files  1 passed (1)
   Tests       20 passed (20)
   ```
   All 20 tests pass completely, confirming that the worker's previous fixes for `ADV-EDGE-02`, `ADV-DOG-02`, `ADV-GEAR-02`, `ADV-GEAR-03`, and `ADV-PERS-03` are intact.

2. **Standard Outdoor Live Cards Suite (`outdoor-live-cards.spec.ts`)**:
   ```
   Command: npx vitest run tests/messaging/outdoor-live-cards.spec.ts
   Output:
   ✓ tests/messaging/outdoor-live-cards.spec.ts (36 tests) 29ms
   Test Files  1 passed (1)
   Tests       36 passed (36)
   ```
   Zero regressions on standard component and snapshot tests.

3. **Challenger Live Cards Stress Suite (`challenger-m2-2-livecards-stress.spec.ts`)**:
   ```
   Command: npx vitest run tests/messaging/challenger-m2-2-livecards-stress.spec.ts
   Output:
   ✓ tests/messaging/challenger-m2-2-livecards-stress.spec.ts (29 tests) 584ms
   Test Files  1 passed (1)
   Tests       29 passed (29)
   ```

4. **Challenger Pathological Stress Suite (`tests/messaging/challenger-m2-pathological-stress.spec.ts`)**:
   ```
   Command: npx vitest run tests/messaging/challenger-m2-pathological-stress.spec.ts
   Output:
   ❯ tests/messaging/challenger-m2-pathological-stress.spec.ts (12 tests | 2 failed) 22ms
         ✓ CHALLENGE-FP-01: Irrational and fractional body weights do not yield NaN, Infinity, or precision drift 2ms
         ✓ CHALLENGE-FP-02: Micro-weights and sub-gram accumulation maintain exact mass conservation 1ms
         ✓ CHALLENGE-FP-03: Exact boundary thresholds: 1g under, exactly on, and 1g over maximum safe weight 0ms
         ✓ CHALLENGE-DOG-01: maxWeightGramsOverride overrides default 15% canine ratio strictly 0ms
         ✓ CHALLENGE-DOG-02: Multi-canine pack with mixed disabled and enabled dogs distributes fairly to dogs before humans 0ms
         ✓ CHALLENGE-DOG-03: Dog-only expedition with dog items exceeding dog capacity quarantines overflow with warnings 1ms
         ✓ CHALLENGE-DOG-04: Non-canine dangerous items (stoves, shelters) in dog-only group are strictly quarantined 0ms
         × CHALLENGE-BUG-01: Disabled dog (isCarryingPack: false) with maxWeightGramsOverride must NOT be allocated gear or have non-zero capacity 4ms
         × CHALLENGE-BUG-02: Explicit override of 0g (medical restriction) must not be ignored in favor of default capacity 0ms
         ✓ CHALLENGE-PREV-01: computeKitPreviewMergeResult with empty/sparse KitSnapshot generates valid result 0ms
         ✓ CHALLENGE-PREV-02: computeKitPreviewMergeResult with realistic categories balances load between preview members 0ms
         ✓ CHALLENGE-FUZZ-01: 100 randomized expeditions preserve all physical and safety invariants 12ms

   FAIL  CHALLENGE-BUG-01: Disabled dog (isCarryingPack: false) with maxWeightGramsOverride must NOT be allocated gear or have non-zero capacity
   AssertionError: expected 0.5 to be +0
   - Expected: 0
   + Received: 0.5

   FAIL  CHALLENGE-BUG-02: Explicit override of 0g (medical restriction) must not be ignored in favor of default capacity
   AssertionError: expected 14 to be +0
   - Expected: 0
   + Received: 14
   ```

5. **Entire Messaging Domain Regression Test Topology (`tests/messaging/`)**:
   ```
   Command: npx vitest run tests/messaging/
   Result: 182 passed, 2 failed across 8 test suites.
   ```

---

### 1.2 Verbatim Code Inspection in `src/features/messaging/domain/packMerge.ts`

Lines 476 to 488:
```typescript
476:       } else {
477:         ratio = targetDogRatio;
478:         const canCarry = p.isCarryingPack !== false;
479:         maxSafeKg = canCarry
480:           ? calculateDogMaxPackWeight(bodyWeight, ratio)
481:           : 0;
482:       }
483: 
484:       if (p.maxWeightGramsOverride && p.maxWeightGramsOverride > 0) {
485:         maxSafeKg = Math.round((p.maxWeightGramsOverride / 1000) * 10) / 10;
486:       }
```

And Step 4 (lines 562-581):
```typescript
562:           const canDogCarry =
563:             ownerLoad.maxSafeWeightKg > 0 &&
564:             isItemDogEligible(item);
565: 
566:           if (canDogCarry) {
567:             const rec: AssignedItem = {
568:               itemId: item.id,
...
578:             ownerLoad.assignedItems.push(rec);
579:             ownerLoad.items.push(rec);
580:             ownerLoad.allocatedWeightGrams += item.weightGrams;
581:             ownerLoad.personalWeightGrams += item.weightGrams;
```

---

## 2. Logic Chain

1. **Bug 1: Resurrection of Disabled Dogs via `maxWeightGramsOverride` (`CHALLENGE-BUG-01`)**:
   - *Observation*: In `CHALLENGE-BUG-01`, a dog is defined with `isCarryingPack: false` and `maxWeightGramsOverride: 500`.
   - *Trace*:
     - Lines 478-481 set `maxSafeKg = 0` because `canCarry` is false (`p.isCarryingPack !== false` is false).
     - Lines 484-486 unconditionally overwrite `maxSafeKg` with `Math.round((500 / 1000) * 10) / 10 = 0.5`.
     - Lines 562-564 evaluate `canDogCarry = ownerLoad.maxSafeWeightKg > 0 && isItemDogEligible(item)`. Since `0.5 > 0`, `canDogCarry` is `true`.
     - Lines 566-581 allocate 400g of personal gear directly to the disabled dog (`dLoad.allocatedWeightGrams === 400`), instead of transferring the load to human companion Alice or quarantining it with a warning.
   - *Divergence from Contract*: Violates `ADV-DOG-01` and `ADV-DOG-02` invariants ("Disabled canine (`isCarryingPack: false`) must be allocated strictly 0g"). A dog that is injured or does not wear a pack must never be assigned carrying duty, regardless of historical weight caps.

2. **Bug 2: Restrictive Medical / Veterinary 0g Override Ignored (`CHALLENGE-BUG-02`)**:
   - *Observation*: In `CHALLENGE-BUG-02`, a participant (e.g. human with back injury or dog under veterinary rest) has `maxWeightGramsOverride: 0`.
   - *Trace*:
     - Line 484 evaluates `if (p.maxWeightGramsOverride && p.maxWeightGramsOverride > 0)`.
     - When `p.maxWeightGramsOverride === 0`, `0 && 0 > 0` evaluates to `0` (falsy in JS).
     - The override block is bypassed.
     - The participant is assigned the full default body weight percentage (14.0 kg for 70kg human).
   - *Divergence from Contract*: Setting an explicit 0g override represents a total portage exemption, but the condition `> 0` silently ignores it.

---

## 3. Caveats

1. **Areas of High Robustness**:
   - **Floating Point Math**: Clamping to 1 decimal place (`Math.round(... * 10) / 10`) and ratio to 3 decimal places behaves deterministically. No NaN or Infinity generated across microscopic (0.1g) or irrational (68.33333333333kg) inputs (`CHALLENGE-FP-01`, `CHALLENGE-FP-02`, `CHALLENGE-FP-03`).
   - **Randomized Fuzzing**: A 100-iteration randomized fuzzer (`CHALLENGE-FUZZ-01`) confirmed strict mass conservation (`allocatedTotal + droppedTotal === totalInitial`) holds across random group topologies.
   - **Hazardous Item Rejection**: Stoves and shelters are strictly blocked from dogs even in dog-only expeditions (`CHALLENGE-DOG-04`).
   - **Kit Snapshot Previews**: `computeKitPreviewMergeResult` handles empty, sparse, and multi-category kits with balanced load distribution (`CHALLENGE-PREV-01`, `CHALLENGE-PREV-02`).
2. **Review-Only Constraint**:
   - Per role constraints (`Review-only — do NOT modify implementation code`), this challenger did not modify `src/features/messaging/domain/packMerge.ts`. The fix must be applied by the implementer.

---

## 4. Conclusion

**Verdict: `REQUEST_CHANGES`**

Milestone 2 implementation is 95% sound, but fails on 2 specific boundary conditions where `maxWeightGramsOverride` breaks physiological safety guarantees:
1. `isCarryingPack: false` is overridden by `maxWeightGramsOverride`, causing disabled dogs to carry gear.
2. `maxWeightGramsOverride: 0` is ignored due to `> 0` check.

### Required Remediation (3 lines in `src/features/messaging/domain/packMerge.ts`)

In `src/features/messaging/domain/packMerge.ts`, replace lines 484-486:
```typescript
// CURRENT (FLAWED):
if (p.maxWeightGramsOverride && p.maxWeightGramsOverride > 0) {
  maxSafeKg = Math.round((p.maxWeightGramsOverride / 1000) * 10) / 10;
}

// PROPOSED SURGICAL FIX:
if (typeof p.maxWeightGramsOverride === 'number' && p.maxWeightGramsOverride >= 0) {
  if (!isDog || p.isCarryingPack !== false) {
    maxSafeKg = Math.round((p.maxWeightGramsOverride / 1000) * 10) / 10;
  }
}
```

---

## 5. Verification Method

To verify the remediation:

1. **Run the challenger pathological stress suite**:
   ```powershell
   npx vitest run tests/messaging/challenger-m2-pathological-stress.spec.ts
   ```
   *Expected after fix*: All 12 tests pass (including `CHALLENGE-BUG-01` and `CHALLENGE-BUG-02`).

2. **Run the adversarial stress suite**:
   ```powershell
   npx vitest run tests/messaging/adversarial-packmerge-stress.spec.ts
   ```
   *Expected*: 20 passed (20).

3. **Run all messaging tests**:
   ```powershell
   npx vitest run tests/messaging/
   ```
   *Expected*: 184 passed across 8 test suites (100% green).
