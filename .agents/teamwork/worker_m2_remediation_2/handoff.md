# Remediation Handoff Report: Milestone 2 Pack Merge Override & Design Token Remediation

**Agent**: `worker_m2_remediation_2`  
**Roles**: implementer, qa, specialist  
**Working directory**: `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m2_remediation_2`  
**Target Milestone**: M2: First-Class Outdoor Objects & Live Cards  
**Date**: 2026-10-04T16:35:00Z  
**Verdict**: **`READY_FOR_REVIEW`**

---

## 1. Observation

Direct empirical observations from codebase inspection, initial test failure logs, and post-remediation verification runs:

### 1.1 Baseline Defect State
1. **Challenger Pathological Stress Test Failure**:
   ```
   Command: npx vitest run tests/messaging/challenger-m2-pathological-stress.spec.ts
   Output:
   FAIL CHALLENGE-BUG-01: Disabled dog (isCarryingPack: false) with maxWeightGramsOverride must NOT be allocated gear or have non-zero capacity
   AssertionError: expected 0.5 to be +0 (Received: 0.5, Expected: 0)
   FAIL CHALLENGE-BUG-02: Explicit override of 0g (medical restriction) must not be ignored in favor of default capacity
   AssertionError: expected 14 to be +0 (Received: 14, Expected: 0)
   ```
   - In `src/features/messaging/domain/packMerge.ts` lines 484-486, the condition `if (p.maxWeightGramsOverride && p.maxWeightGramsOverride > 0)` treated explicit `0g` as falsy, causing the participant's safe capacity to fall back to the default body weight ratio (e.g., 14.0 kg for a 70 kg human).
   - In addition, the override check did not guard against disabled dogs (`p.isCarryingPack === false`), allowing an override value (e.g. 500g -> 0.5 kg) to overwrite `maxSafeKg = 0` for disabled canines.

2. **Design Governance Test Failure (U-D61)**:
   ```
   Command: npx vitest run tests/design/unification.spec.ts
   Output:
   FAIL tests/design/unification.spec.ts > CHANTIER U — GARDE-FOUS DE GOUVERNANCE > U-D61 : aucune classe froide zinc/gray/slate/amber/emerald/blue
   AssertionError: Classes froides dans:
   src/features/messaging/components/PackMergeSheet.tsx: text-amber-800
   ```
   - In `src/features/messaging/components/PackMergeSheet.tsx` line 134, warning pills used `text-amber-800`, which directly violates rule U-D61 prohibiting cold palette utilities outside designated primitives.

---

## 2. Logic Chain

1. **`CHALLENGE-BUG-01` Remediation**:
   - For canine participants (`isDog = true`), physical welfare requires that any dog with `isCarryingPack === false` (e.g. injured, elderly, or without panniers) must maintain `maxSafeKg = 0` regardless of whether an advisory `maxWeightGramsOverride` exists on their profile.
   - Guarding the assignment with `if (!isDog || p.isCarryingPack !== false)` ensures that a disabled canine's `maxSafeKg` strictly remains `0`.
   - Because `ownerLoad.maxSafeWeightKg` evaluates to `0`, downstream allocation checks (`canDogCarry` and `eligibleDogs`) correctly exclude the disabled dog from all gear distributions (personal and collective), ensuring `allocatedWeightGrams === 0`.

2. **`CHALLENGE-BUG-02` Remediation**:
   - For participants with medical restrictions or explicitly zero carrying capacity, `maxWeightGramsOverride: 0` is a valid, intentional boundary value.
   - Changing the condition from `p.maxWeightGramsOverride && p.maxWeightGramsOverride > 0` to `typeof p.maxWeightGramsOverride === 'number' && p.maxWeightGramsOverride >= 0` allows `0` to enter the assignment block.
   - For `0`, `Math.round((0 / 1000) * 10) / 10` evaluates to `0`. Consequently, `maxSafeKg = 0` is preserved, satisfying the invariant that an explicit 0g cap must not revert to ratio-based default capacity.

3. **Design Token Unification Remediation**:
   - In `src/features/messaging/components/PackMergeSheet.tsx` line 134, `text-amber-800` was replaced with the semantic token class `text-[color:var(--lkv-warning,#b45309)]`.
   - In `src/styles/tokens.css`, `--lkv-warning` is defined natively (`#C89A3B` in light mode, `#E4C27A` in dark mode).
   - This replacement eliminates all forbidden cold color class matches in `PackMergeSheet.tsx`, cleanly satisfying rule `U-D61` in `tests/design/unification.spec.ts`.

---

## 3. Caveats

- No caveats. Both modifications adhere strictly to the minimal-change principle, targeting only the assigned files and the exact lines causing test/governance failures without side effects.

---

## 4. Conclusion

- `src/features/messaging/domain/packMerge.ts` now correctly distinguishes between enabled and disabled canines when applying overrides, and treats explicit `0g` overrides as genuine non-falsy limits.
- `src/features/messaging/components/PackMergeSheet.tsx` strictly adheres to design system tokens with zero cold palette class violations.
- All 184 tests across the 8 messaging test suites in `tests/messaging/` pass at 100%.
- All 5 governance checks in `tests/design/unification.spec.ts` pass at 100%.
- `npm run type-check` executes with 0 errors.

---

## 5. Verification Method

To independently reproduce and verify all results:

1. **Verify Challenger Pathological Stress Suite**:
   ```powershell
   npx vitest run tests/messaging/challenger-m2-pathological-stress.spec.ts
   # Expected: 12 passed (12)
   ```

2. **Verify Adversarial Pack Merge Suite**:
   ```powershell
   npx vitest run tests/messaging/adversarial-packmerge-stress.spec.ts
   # Expected: 20 passed (20)
   ```

3. **Verify Outdoor Live Cards Suite**:
   ```powershell
   npx vitest run tests/messaging/outdoor-live-cards.spec.ts
   # Expected: 36 passed (36)
   ```

4. **Verify Challenger Live Cards Stress Suite**:
   ```powershell
   npx vitest run tests/messaging/challenger-m2-2-livecards-stress.spec.ts
   # Expected: 29 passed (29)
   ```

5. **Verify Design System Unification (U-D61)**:
   ```powershell
   npx vitest run tests/design/unification.spec.ts
   # Expected: 5 passed (5), 0 cold classes detected
   ```

6. **Verify TypeScript Compilation**:
   ```powershell
   npm run type-check
   # Expected: Exit code 0, 0 errors
   ```

7. **Verify Complete Messaging Domain Topology**:
   ```powershell
   npx vitest run tests/messaging/
   # Expected: 8 test files passed, 184 passed (184), 0 failed
   ```
