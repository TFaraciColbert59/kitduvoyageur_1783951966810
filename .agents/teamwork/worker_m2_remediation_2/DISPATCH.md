## 2026-10-04T14:30:41Z
You are worker_m2_remediation_2, responsible for applying the targeted override and design token fixes for Milestone 2.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m2_remediation_2

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md

Read the handoffs:
- challenger_m2_remediation_1 handoff:
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\challenger_m2_remediation_1\handoff.md`
- reviewer_m2_remediation_1 handoff:
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\reviewer_m2_remediation_1\handoff.md`

Your exclusive write ownership covers:
- `src/features/messaging/domain/packMerge.ts`
- `src/features/messaging/components/PackMergeSheet.tsx`

Implementation Tasks:
1. In `src/features/messaging/domain/packMerge.ts`:
   Fix the override handling around line 484.
   Replace:
   ```typescript
   if (p.maxWeightGramsOverride && p.maxWeightGramsOverride > 0) {
     maxSafeKg = Math.round((p.maxWeightGramsOverride / 1000) * 10) / 10;
   }
   ```
   With:
   ```typescript
   if (typeof p.maxWeightGramsOverride === 'number' && p.maxWeightGramsOverride >= 0) {
     if (!isDog || p.isCarryingPack !== false) {
       maxSafeKg = Math.round((p.maxWeightGramsOverride / 1000) * 10) / 10;
     }
   }
   ```
   This ensures:
   - `CHALLENGE-BUG-01`: Disabled dogs (`isCarryingPack: false`) with `maxWeightGramsOverride` maintain `maxSafeKg = 0` and are allocated strictly 0g.
   - `CHALLENGE-BUG-02`: Explicit 0g override (`maxWeightGramsOverride: 0`) is respected and sets `maxSafeKg = 0` instead of reverting to default ratio capacity.

2. In `src/features/messaging/components/PackMergeSheet.tsx`:
   Find line 134 or any occurrence of forbidden cold Tailwind class `text-amber-800`.
   Replace with semantic design token or permitted warning color: e.g. `text-[color:var(--lkv-warning,#b45309)]` or `text-foreground-secondary` to satisfy rule `U-D61` in `tests/design/unification.spec.ts`.

3. Run build and tests:
   - `npx vitest run tests/messaging/challenger-m2-pathological-stress.spec.ts` (all 12 tests must pass!)
   - `npx vitest run tests/messaging/adversarial-packmerge-stress.spec.ts` (all 20 tests must pass!)
   - `npx vitest run tests/messaging/outdoor-live-cards.spec.ts` (all 36 tests must pass!)
   - `npx vitest run tests/messaging/challenger-m2-2-livecards-stress.spec.ts` (all 29 tests must pass!)
   - `npx vitest run tests/design/unification.spec.ts` (must pass U-D61!)
   - `npm run type-check` (0 errors)
   - `npx vitest run tests/messaging/` (all 184 tests must pass 100%!)

4. Deliver `handoff.md` in your working directory documenting code changes, test outputs, and verification commands.
