## 2026-10-04T10:10:31Z
You are worker_m1_foundation_1, responsible for implementing Milestone 1: Canonical Messaging Foundation & Supabase RLS / Idempotence.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m1_foundation_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md

Read the Explorer analysis and handoffs:
- SQL/RLS: `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m1_sql_1\handoff.md` and `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m1_sql_1\proposed_20261004120000_lkdv_social_core_architecture.sql`
- Domain Refactoring: `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m1_domain_1\handoff.md` and `analysis.md`
- Test Architecture: `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m1_test_1\handoff.md` and `analysis.md`

Your exclusive write ownership covers:
- `supabase/migrations/20261004120000_lkdv_social_core_architecture.sql`
- `src/lib/supabase/types.ts`
- `src/features/messaging/types/messaging.types.ts`
- `src/features/messaging/services/domain/sequenceService.ts`
- `src/features/messaging/services/domain/idempotencyService.ts`
- `src/features/messaging/services/domain/cursorPaginationService.ts`
- `src/features/messaging/services/domain/offlineSyncQueue.ts`
- `src/features/messaging/services/messagingService.ts`
- `tests/messaging/canonical-foundation.spec.ts`

Implementation Tasks:
1. Create `supabase/migrations/20261004120000_lkdv_social_core_architecture.sql` using explorer_m1_sql_1's blueprint.
2. Update `src/lib/supabase/types.ts` to include the new columns (`sequence_number`, `client_nonce`, `last_sequence_number`, `last_read_sequence`, etc.) and new tables (`club_channels`, `expedition_rooms`, `terra_drafted_actions`).
3. Update `src/features/messaging/types/messaging.types.ts` to include `sequence_number`, `client_nonce`, `last_read_sequence`, updated `MemberRole` union ('member' | 'safety' | 'guide' | 'admin' | 'owner'), cursor pagination options, and offline sync types.
4. Implement domain services in `src/features/messaging/services/domain/`:
   - `sequenceService.ts`
   - `idempotencyService.ts`
   - `cursorPaginationService.ts`
   - `offlineSyncQueue.ts`
5. Refactor `src/features/messaging/services/messagingService.ts`:
   - Must use the Facade pattern.
   - Maintain 100% backward compatibility: all 19 existing public methods and signatures MUST continue to work identically for existing callers.
   - Wire internal calls to domain services.
6. Create `tests/messaging/canonical-foundation.spec.ts` implementing the 34 Vitest test cases from explorer_m1_test_1.
7. Run build and tests:
   - `npx vitest run tests/messaging/`
   - `npm run type-check`
   Ensure 100% of tests pass and 0 TypeScript errors.
8. Deliver `handoff.md` in your working directory documenting code changes, build/test results, and verification.
