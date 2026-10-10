## 2026-10-04T14:07:29Z
You are worker_m2_remediation_1, responsible for implementing the surgical remediation for Milestone 2: First-Class Outdoor Objects & Live Cards.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m2_remediation_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md

Read the remediation explorers' findings and blueprints:
- Domain Blueprint:
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_remediation_domain_1\handoff.md`
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_remediation_domain_1\proposed_packMerge_fixes.md`
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_remediation_domain_1\analysis.md`
- UI Blueprint:
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_remediation_ui_1\handoff.md`
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_remediation_ui_1\analysis.md`
- Test Plan:
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_remediation_test_1\handoff.md`

Your exclusive write ownership covers:
- `src/features/messaging/domain/packMerge.ts`
- `src/features/messaging/components/PackMergeSheet.tsx`
- `src/features/messaging/components/MessageBubble.tsx`
- `src/features/messaging/components/GPXLiveCard.tsx`

Implementation Tasks:
1. Update `src/features/messaging/domain/packMerge.ts`:
   - Apply the fixes from `proposed_packMerge_fixes.md` to resolve all 5 failure modes:
     * `ADV-EDGE-02`: When `participants: []`, ensure mass conservation holds: all unassigned gear is recorded as dropped/unassigned with explicit warning so `allocatedTotal + droppedTotal === initialTotal`.
     * `ADV-DOG-02`: For dogs with `isCarryingPack: false` or `maxSafeWeightKg === 0`, do NOT allocate personal gear to the dog; mark unassigned or re-route with warning.
     * `ADV-GEAR-02`: In expeditions without human participants, do NOT assign non-canine gear (stoves) to dogs; leave unassigned with warning.
     * `ADV-GEAR-03`: Personal non-canine equipment (stoves) in dog kits must NOT be assigned to dogs (verify `canBeCarriedByDog`).
     * `ADV-PERS-03`: Personal items of non-participants must NEVER be pushed into `unassignedSharedItems`; retain them as unassigned personal items with warning.
   - Implement and export `computeKitPreviewMergeResult(kitSnapshot: KitSnapshot): PackMergeResult` (as specified in UI explorer's `analysis.md`) to provide a realistic preview PackMergeResult when opening `PackMergeSheet` from a single `KitLiveCard`.
2. Update `src/features/messaging/components/PackMergeSheet.tsx`:
   - Add iOS safe-area bottom padding to the bottom sheet container: `pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))]` (or `.safe-p-bottom`) to prevent collision with the iOS home indicator.
   - Expand segmented switcher container to `h-12 min-h-[48px]` and each button to `min-h-[44px]` touch target per Apple HIG.
   - Add backdrop overlay scrim: `<div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />`.
3. Update `src/features/messaging/components/MessageBubble.tsx`:
   - Wire `computeKitPreviewMergeResult` to `PackMergeSheet` when triggered from `KitLiveCard`:
     Pass `result={computeKitPreviewMergeResult(message.metadata as KitSnapshot)}` so the sheet renders authentic items, load bars, and savings instead of an empty dialog!
4. Update `src/features/messaging/components/GPXLiveCard.tsx`:
   - Replace `window.location.href` with Next.js navigation (use Next.js `useRouter().push('/explorer?trail=' + snapshot.id)` or safe SPA navigation).
   - Use React `useId()` for instance-unique SVG gradient IDs.
   - Update icon glyph name from `arrow-down-tray` to valid `download`.
5. Run build and tests:
   - `npx vitest run tests/messaging/adversarial-packmerge-stress.spec.ts` (all 20 tests MUST pass!)
   - `npx vitest run tests/messaging/outdoor-live-cards.spec.ts` (all 36 tests MUST pass!)
   - `npx vitest run tests/messaging/challenger-m2-2-livecards-stress.spec.ts` (all 29 tests MUST pass!)
   - `npx vitest run tests/messaging/` (all 172+ tests MUST pass!)
   - `npm run type-check` (0 TypeScript errors)
6. Deliver `handoff.md` documenting all modified files, test outputs, and verification commands.
