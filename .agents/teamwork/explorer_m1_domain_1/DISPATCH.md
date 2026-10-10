## 2026-10-04T10:03:04Z
You are explorer_m1_domain_1, specialized in Canonical Messaging Domain Refactoring.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m1_domain_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md

Your task for Milestone 1 (Canonical Messaging Foundation & Supabase RLS / Idempotence):
1. Analyze the exact refactoring plan for `src/features/messaging/services/messagingService.ts`:
   - Must use the Facade pattern: preserve all existing exported methods and signatures on `messagingService` so zero callers break.
   - Decompose core logic into modular domain services in `src/features/messaging/services/domain/`:
     - `sequenceService.ts`: handles deterministic sequence comparison, unread calculation (`last_read_sequence`).
     - `idempotencyService.ts`: client nonce generation, local tracking, retry deduplication.
     - `cursorPaginationService.ts`: bidirectional cursor pagination (`beforeSequence`, `afterSequence`).
     - `offlineSyncQueue.ts`: local pending message queue, 3-phase reconnection reconciliation.
2. Specify exact type updates needed in `src/features/messaging/types/messaging.types.ts` (`sequence_number`, `client_nonce`, `last_read_sequence`, updated member roles, etc.).
3. Produce a structured analysis report in `analysis.md` and deliver `handoff.md` in your working directory.
Communicate when done via send_message to orchestrator.
