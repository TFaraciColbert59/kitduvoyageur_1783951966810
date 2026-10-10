# Handoff Report: Adversarial Stress Testing of Pack Merge & Load Distribution (Milestone 2)

**Agent**: `challenger_m2_1`  
**Roles**: critic, specialist  
**Working directory**: `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\challenger_m2_1`  
**Milestone**: M2 (Pack Merge & Load Distribution Engine)  
**Date**: 2026-10-04T13:58:00Z  
**Verdict**: `REQUEST_CHANGES`

---

## Challenge Summary

**Overall risk assessment**: **HIGH**  
**Verdict**: **`REQUEST_CHANGES`**

While the core deduplication and proportional water-filling mechanics in `src/features/messaging/domain/packMerge.ts` function correctly for conventional multi-human trips (36/36 tests in `outdoor-live-cards.spec.ts` pass), empirical adversarial stress testing in `tests/messaging/adversarial-packmerge-stress.spec.ts` exposed **5 distinct failure modes and invariant violations** under pathological inputs and boundary conditions.

---

## 1. Observation

Direct observations from test harness execution and code inspection:

### Command Executed:
```powershell
npx vitest run tests/messaging/adversarial-packmerge-stress.spec.ts
```

### Result:
- 15 passed, 5 failed (20 total tests).

### Observation 1: Invariant Violation — Vanishing Mass with Empty Participants List
- **File & Line**: `src/features/messaging/domain/packMerge.ts:394-467, 576-581, 602-605, 655-656`
- **Test**: `ADV-EDGE-02: Empty participants list with non-empty kits list — mass conservation invariant`
- **Verbatim Error**:
  ```
  FAIL tests/messaging/adversarial-packmerge-stress.spec.ts > ADV-EDGE-02
  AssertionError: expected +0 to be 2400 // Object.is equality
  - Expected: 2400
  + Received: 0
  ```
- **Observed Behavior**: When `participants: []` is provided alongside a kit containing 2400g of gear, `AllocatedWeight = 0`, `DroppedWeight = 0`. The 2400g of equipment completely vanishes from the result without being allocated or marked as dropped, breaking the fundamental conservation law: `Allocated + Dropped === Initial Total`. No warning is emitted indicating unallocated equipment.

### Observation 2: Canine Safety Violation — Allocation to Disabled Dogs
- **File & Line**: `src/features/messaging/domain/packMerge.ts:472-495`
- **Test**: `ADV-DOG-02: Disabled canine (isCarryingPack: false) must be allocated strictly 0g even with personal items`
- **Verbatim Error**:
  ```
  FAIL tests/messaging/adversarial-packmerge-stress.spec.ts > ADV-DOG-02
  AssertionError: expected 400 to be +0 // Object.is equality
  - Expected: 0
  + Received: 400
  ```
- **Observed Behavior**: When a canine participant has `isCarryingPack: false` (injured dog, puppy, senior dog), line 413 correctly sets `maxSafeWeightKg = 0`. However, step 4 (personal equipment assignment) unconditionally adds weight to `loads[item.ownerId]`. Consequently, a personal item (e.g. 400g dog coat) is allocated to the dog, violating the contract that non-carrying dogs receive strictly 0g.

### Observation 3: Canine Gear Eligibility Violation — Fallback Assigns Stoves to Canines
- **File & Line**: `src/features/messaging/domain/packMerge.ts:576`
  ```typescript
  targetHumanId = humans[0]?.id || validParticipants[0]?.id;
  ```
- **Test**: `ADV-GEAR-02: Non-canine gear (stoves) must NEVER be assigned to dogs even in dog-only group`
- **Verbatim Error**:
  ```
  FAIL tests/messaging/adversarial-packmerge-stress.spec.ts > ADV-GEAR-02
  AssertionError: expected [ 'Réchaud Titane' ] to not include 'Réchaud Titane'
  ```
- **Observed Behavior**: When no human participants are present in the expedition, `humans` is empty (`[]`). Line 576 falls back to `validParticipants[0]?.id`, which is a canine. As a result, shared human-only gear (such as a 400g gas stove where `canBeCarriedByDog: false`) is directly allocated to the dog.

### Observation 4: Canine Gear Eligibility Violation — Personal Stoves Allowed on Dogs
- **File & Line**: `src/features/messaging/domain/packMerge.ts:472-495`
- **Test**: `ADV-GEAR-03: Personal non-canine equipment (stove) in dog kit must not be carried by dog`
- **Verbatim Error**:
  ```
  FAIL tests/messaging/adversarial-packmerge-stress.spec.ts > ADV-GEAR-03
  AssertionError: expected [ 'Réchaud Personnel' ] to not include 'Réchaud Personnel'
  ```
- **Observed Behavior**: If an equipment item is categorized as `cook` or has `canBeCarriedByDog: false` but is marked as personal gear with `ownerId: dog.id`, step 4 bypasses all canine eligibility checks and assigns the stove to the dog.

### Observation 5: Privacy & Boundary Violation — Leaking Personal Gear to Other Hikers
- **File & Line**: `src/features/messaging/domain/packMerge.ts:490-492`
  ```typescript
  if (!item.isShared) {
    const ownerLoad = loads[item.ownerId || ''];
    if (ownerLoad) {
      ...
    } else {
      unassignedSharedItems.push(item);
    }
  }
  ```
- **Test**: `ADV-PERS-03: Personal item of non-participant is NEVER re-assigned to active participants`
- **Verbatim Error**:
  ```
  FAIL tests/messaging/adversarial-packmerge-stress.spec.ts > ADV-PERS-03
  AssertionError: expected [ 'bob_duvet' ] to not include 'bob_duvet'
  ```
- **Observed Behavior**: When a personal item (`isShared: false`) belongs to a user not in the active `participants` list (e.g. absent member, ID mismatch, external kit merge), line 491 silently pushes the personal item into `unassignedSharedItems`. The item is then converted to shared gear (`isShared: true`) in step 7 and distributed to other participants (e.g. Alice). This violates the core invariant that personal items must never be re-assigned.

---

## 2. Logic Chain

1. **Mass Conservation Requirement**:
   - The contract specifies: `Allocated + Dropped = Initial Total`.
   - In `packMerge.ts:602-605`, `totalGroupWeightGrams` is computed solely by summing `loads[p.id]` across `validParticipants`.
   - When `validParticipants` is empty, no items can be assigned to `loads`, yet items were parsed into `allItems`.
   - Result: Gear weight evaporates without being dropped as duplicate, resulting in `0 + 0 !== InitialTotal`.
   - **Remediation**: If `validParticipants.length === 0`, all items must either be recorded as unallocated with an explicit warning or rejected at the boundary, maintaining strict accounting.

2. **Canine Safety & Biological Limits**:
   - Dogs cannot safely carry human gear (stoves, gas, sharp implements, tents) or any weight when portage is disabled (`isCarryingPack: false`).
   - The current code applies canine filtering *only* to shared items (`dogItems` vs `humanItems` in steps 5–6), completely omitting checks during personal item assignment (step 4).
   - Furthermore, the fallback in step 7 (`humans[0]?.id || validParticipants[0]?.id`) assumes `validParticipants[0]` is a human. When all participants are dogs, `validParticipants[0]` is a canine, assigning stoves to animals.
   - **Remediation**:
     - In step 4: Check if `ownerLoad.isDog`. If `ownerLoad.isCarryingPack === false` or `!item.canBeCarriedByDog`, the item cannot be assigned to the dog; it must be transferred to a human companion or marked with an overload/safety warning.
     - In step 7: If `humans.length === 0`, human gear must NOT be assigned to `validParticipants[0]`; it must remain unallocated and generate a critical warning: `Matériel humain impossible à assigner (aucun participant humain)`.

3. **Personal Equipment Boundary**:
   - The definition of personal gear (`isShared === false`) is that it belongs strictly to its owner.
   - Silently falling back to `unassignedSharedItems.push(item)` when `ownerLoad` is missing causes private personal equipment to be re-labeled `isShared = true` and forced into other hikers' packs.
   - **Remediation**: If `!item.isShared` and `ownerId` does not match any active participant, the item must be placed in an unassigned personal gear bucket with a warning, never distributed to other hikers.

---

## 3. Caveats

1. **Standard Scenarios Pass**: Conventional multi-human expeditions with well-formed participant lists and shared items pass all 36 tests in `outdoor-live-cards.spec.ts` without error.
2. **UI Safety**: React rendering tests (`ADV-UI-01`, `ADV-UI-02`) verified that `PackMergeSheet` does not crash, throw, or display `NaN` even under extreme 625% group overloads.
3. **No Code Modification Constraint**: In accordance with the Challenger role constraints (`Review-only — do NOT modify implementation code`), no implementation changes were committed to `src/features/messaging/domain/packMerge.ts`. The stress test suite was added to `tests/messaging/adversarial-packmerge-stress.spec.ts` to provide reproducible regression proof.

---

## 4. Conclusion

**Verdict: `REQUEST_CHANGES`**

Milestone 2 cannot be approved in its current state due to physiological and algorithmic safety vulnerabilities:
1. Non-carrying dogs (`isCarryingPack: false`) can be allocated pack weight.
2. Dangerous gear (gas stoves) can be assigned to canines under edge cases (dog-only expeditions or dog personal kits).
3. Mass conservation invariant fails when `participants` list is empty.
4. Personal items of absent members leak into collective distribution and are assigned to active hikers.

### Recommended Actions for Worker:
1. **In `src/features/messaging/domain/packMerge.ts:472-495` (Step 4)**:
   - For dogs: If `ownerLoad.isDog && (ownerLoad.maxSafeWeightKg === 0 || !item.canBeCarriedByDog)`, do NOT add to `ownerLoad.allocatedWeightGrams`. Either transfer to the first available human or track as unassignable dog gear with an explicit warning.
   - For unlisted owners: Do NOT push personal items to `unassignedSharedItems`. Record them in an unassigned personal list and raise a warning.
2. **In `src/features/messaging/domain/packMerge.ts:576` (Step 7)**:
   - Replace `targetHumanId = humans[0]?.id || validParticipants[0]?.id;` with:
     ```typescript
     if (humans.length === 0) {
       warnings.push(`Impossible d'assigner l'équipement "${item.name}" : aucun participant humain disponible.`);
       continue;
     }
     targetHumanId = humans[0].id;
     ```
3. **In `src/features/messaging/domain/packMerge.ts:361-395`**:
   - If `participants.length === 0` and `allItems.length > 0`, emit a warning: `Aucun participant pour porter le matériel (${(totalOriginalWeightGrams / 1000).toFixed(1)} kg non assignés)`.

---

## 5. Verification Method

To independently reproduce all 5 failures:

```powershell
npx vitest run tests/messaging/adversarial-packmerge-stress.spec.ts
```

*Expected output*: 15 passed, 5 failed (`ADV-EDGE-02`, `ADV-DOG-02`, `ADV-GEAR-02`, `ADV-GEAR-03`, `ADV-PERS-03`).

To verify that conventional tests still pass:
```powershell
npx vitest run tests/messaging/outdoor-live-cards.spec.ts
```
*Expected output*: 36 passed (36).

To verify type safety and linting:
```powershell
npm run type-check
npx eslint tests/messaging/adversarial-packmerge-stress.spec.ts
```
*Expected output*: 0 errors.
