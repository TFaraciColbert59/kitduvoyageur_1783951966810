## 2026-10-04T10:40:04Z
You are worker_m2_cards_1, responsible for implementing Milestone 2: First-Class Outdoor Objects & Live Cards.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m2_cards_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md

Read the M2 Explorer deliverables:
- Domain & Pack Merge:
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_domain_1\proposed_outdoorObjects.types.ts`
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_domain_1\proposed_packMerge.ts`
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_domain_1\handoff.md`
- UI & Apple HIG:
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_cards_1\handoff.md` and `analysis.md`
- Test Architecture:
  `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_test_1\handoff.md` and `analysis.md`

Your exclusive write ownership covers:
- `src/features/messaging/types/outdoorObjects.types.ts`
- `src/features/messaging/types/messaging.types.ts`
- `src/features/messaging/domain/packMerge.ts`
- `src/features/messaging/services/domain/packMergeService.ts`
- `src/features/messaging/components/GPXLiveCard.tsx`
- `src/features/messaging/components/KitLiveCard.tsx`
- `src/features/messaging/components/PackMergeSheet.tsx`
- `src/features/messaging/components/EquipmentLiveCard.tsx`
- `src/features/messaging/components/ExpeditionLiveCard.tsx`
- `src/features/messaging/components/MessageBubble.tsx`
- `tests/messaging/outdoor-live-cards.spec.ts`

Implementation Tasks:
1. Implement `src/features/messaging/types/outdoorObjects.types.ts` and update `messaging.types.ts` so `Message.metadata` supports outdoor snapshots (`GPXSnapshot`, `KitSnapshot`, `EquipmentSnapshot`, `ExpeditionSnapshot`, `ActivitySheetSnapshot`).
2. Implement `src/features/messaging/domain/packMerge.ts` and `src/features/messaging/services/domain/packMergeService.ts`:
   - Deduplicate collective gear (shared tents, stoves, water purification).
   - Balance loads using physiological ratios from `src/features/preparation/services/loadDistribution.ts` (20% max human, 15% dog, canine portage eligibility, role priorities).
   - Generate warnings if weight thresholds are exceeded.
3. Implement Live Cards UI components in `src/features/messaging/components/`:
   - `GPXLiveCard.tsx`: Instant pre-projected SVG polyline rendering (0ms network fetch on mount/scroll!), distance, D+, estimated duration, non-blocking. Tap opens full inspection modal/navigation.
   - `KitLiveCard.tsx`: Compact card with gear count, total weight, category badges, and interactive "Pack Merge" button.
   - `PackMergeSheet.tsx`: Native Apple HIG bottom sheet (Liquid Glass tokens, min 44px touch targets) showing deduplicated gear, individual load bars, safety ratios, and warnings.
   - `EquipmentLiveCard.tsx`: Compact equipment card (weight in grams, specs, status).
   - `ExpeditionLiveCard.tsx`: Expedition status, date countdown, route preview, member avatars.
   - Update `MessageBubble.tsx` to render these cards cleanly when snapshot metadata is present.
4. Implement `tests/messaging/outdoor-live-cards.spec.ts` based on explorer_m2_test_1's 34-test specification.
5. Run build and tests:
   - `npx vitest run tests/messaging/` (must pass 100%)
   - `npm run type-check` (must pass with 0 errors)
6. Deliver `handoff.md` documenting your code changes, build/test results, and verification commands.
