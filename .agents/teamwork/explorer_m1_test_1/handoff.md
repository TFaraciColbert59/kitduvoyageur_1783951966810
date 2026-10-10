# Handoff Report: Milestone 1 Canonical Messaging Foundation Test Suite

**Agent**: `explorer_m1_test_1`  
**Working Directory**: `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m1_test_1`  
**Target Milestone**: M1 (Canonical Messaging Foundation & Supabase RLS / Idempotence)  
**Date**: 2026-10-04  

---

## 1. Observation

1. **Test Environment & Configuration**:
   - Inspected `vitest.config.ts` (lines 10-24):
     ```typescript
     test: {
       environment: 'node',
       env: {
         NVIDIA_API_KEY: '',
         OPENROUTER_API_KEY: '',
       },
       include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx', 'src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
     }
     ```
     The test environment is hermetic Node.js without network access or live Supabase credentials.
   - Verified Vitest execution via `run_command`:
     `npx vitest run tests/messaging/messagingUtils.spec.ts` completed in 134ms with 7/7 tests passing (code 0).

2. **Existing Messaging Codebase State**:
   - `src/features/messaging/types/messaging.types.ts` defines `Conversation`, `ConversationMember`, `Message`, and `MessageType`. Noticeably missing from existing types are `sequence_number`, `client_nonce`, `last_sequence_number`, and `last_read_sequence`.
   - `src/features/messaging/services/messagingService.ts` (lines 568-593, 762-784, 842-849):
     - `getMessages` queries `messages` ordered by `created_at ASC` with simple integer `limit = 50`.
     - `sendMessage` inserts without `client_nonce` or `sequence_number`, risking duplicate inserts on network retries.
     - `markAsRead` updates `unread_count: 0, last_read_at: new Date().toISOString()`, lacking O(1) integer sequence pointers.

3. **Supabase Schema & Security Vulnerability Observations**:
   - In `supabase/migrations/20260830000000_messaging_security_helpers.sql` (lines 27-32):
     ```sql
     CREATE OR REPLACE FUNCTION public.is_conversation_member(
       target_conversation_id uuid,
       target_user_id uuid
     ) RETURNS boolean AS $$
       SELECT EXISTS(
         SELECT 1 FROM public.conversation_members cm
         WHERE cm.conversation_id = target_conversation_id
           AND cm.user_id = target_user_id
       );
     $$;
     ```
     Observed that `cm.left_at IS NULL` was omitted in the legacy helper! If a member exits a conversation (`left_at IS NOT NULL`), legacy RLS still treats them as an active member.
   - In `supabase/migrations/20260925010000_messaging_rls_auth_initplan.sql` (lines 74-78):
     Demonstrates the project requirement to wrap `auth.uid()` in `(SELECT auth.uid())` for PostgreSQL InitPlan execution plan caching.

4. **Project Contract Specifications**:
   - `PROJECT.md` lines 7-12, 75-93:
     - `conversations.last_sequence_number BIGINT NOT NULL DEFAULT 0`
     - `messages.sequence_number BIGINT NOT NULL`, `client_nonce TEXT`, `UNIQUE(conversation_id, sequence_number)`, `UNIQUE(conversation_id, client_nonce)`
     - `conversation_members.last_read_sequence BIGINT NOT NULL DEFAULT 0`
     - Trigger `trg_assign_message_sequence` BEFORE INSERT on `messages`.
     - Function `is_conversation_member` enforcing `cm.left_at IS NULL`.
     - Facade pattern on `messagingService.ts` maintaining 100% backward compatibility while delegating to domain services.

---

## 2. Logic Chain

1. **Determinism and Zero-Gap Ordering**:
   - Because client clocks experience drift and network arrivals are nondeterministic, ordering by `created_at` timestamp leads to message interleaving and inconsistent chat histories across devices.
   - By introducing an atomic trigger (`trg_assign_message_sequence`) that increments `conversations.last_sequence_number` per conversation, each message is assigned a strict monotonic integer (`sequence_number`).
   - Therefore, sorting by `sequence_number ASC` provides mathematically deterministic ordering across all clients.

2. **Send Idempotency & Zero Duplicate Rows**:
   - During mobile network transitions (e.g. cellular dropping to 2G/offline while hiking), a client may transmit an HTTP/WebSocket message that the server commits, but the client never receives the ACK.
   - Without idempotency, client retry causes a second identical row to be inserted.
   - By enforcing `UNIQUE(conversation_id, client_nonce)` in Postgres (violating with error code `23505`), the API interceptor can query and return the pre-existing message rather than failing or duplicating.
   - Therefore, duplicate retries with the same `client_nonce` return the existing message with 0 duplicate rows.

3. **Bidirectional Cursor Pagination**:
   - Offset pagination (`OFFSET N`) suffers from severe O(N) performance degradation and message skipping/duplication when new messages arrive while scrolling.
   - Monotonic sequence numbers enable true bidirectional cursor pagination:
     - Older messages: `sequence_number < before_cursor ORDER BY sequence_number DESC LIMIT K` (reversed in memory).
     - Newer messages: `sequence_number > after_cursor ORDER BY sequence_number ASC LIMIT K`.
   - Therefore, pagination is O(1) index-backed and immune to real-time chat insertion shifts.

4. **O(1) Aggregated Read Status**:
   - Calculating unread counts by querying all messages where `created_at > last_read_at` is an expensive scan that degrades as chat history grows.
   - With monotonic sequence numbers, a member's unread count is simply `Math.max(0, conversation.last_sequence_number - member.last_read_sequence)`.
   - Furthermore, a monotonic guard (`GREATEST(last_read_sequence, targetSeq)`) prevents reading older cached messages from downgrading the read pointer.

5. **Airtight RLS Isolation**:
   - Enforcing `cm.left_at IS NULL` in `is_conversation_member` ensures that any user who has left a group conversation cannot read newly posted messages or send unauthorized messages.
   - Checking `sender_id = auth.uid()` in `members_insert_messages` prevents identity spoofing.

6. **Hermetic Vitest Execution**:
   - Because tests run in Node.js without network, a high-fidelity stateful in-memory database mock (`MockMessagingDatabase`) simulating table storage, trigger sequence increments, unique constraints, and RLS checks is necessary and sufficient to comprehensively validate all 6 domains.

---

## 3. Caveats

1. **Database Trigger Execution Environment**:
   - The trigger `trg_assign_message_sequence` runs in PostgreSQL PL/pgSQL on Supabase in production. Our Vitest test suite uses a high-fidelity JavaScript mock simulating the exact trigger logic (`last_sequence_number += 1`). To complement this, static migration analysis verifies the SQL trigger definitions in `supabase/migrations/20261004120000_lkdv_social_core_architecture.sql`.
2. **Local Storage / IndexedDB Runtime**:
   - In Node.js testing, browser `indexedDB` is stubbed or mocked in memory. The mock queue verifies the queuing, serialization, FIFO order, and reconciliation algorithms without relying on browser native storage binaries.
3. **Multi-Tab BroadcastChannel**:
   - Multi-tab synchronization (broadcasting offline sync events across tabs) is outside the scope of Milestone 1 unit tests and belongs to browser integration/E2E testing.

---

## 4. Conclusion

The Vitest test suite for Milestone 1 (`tests/messaging/canonical-foundation.spec.ts`) has been completely designed and specified with **34 rigorous, targeted test cases** across:
1. Atomic sequence progression & deterministic ordering (6 tests).
2. Send idempotency via `client_nonce` (6 tests).
3. Bidirectional cursor pagination (`before`/`after`) (6 tests).
4. Aggregated read tracking (`last_read_sequence`) (5 tests).
5. Offline sync queue & 3-phase reconnection draining (6 tests).
6. Supabase RLS security isolation & exited member rejection (5 tests).

The full test suite code, mock database architecture, and integration requirements are documented in `analysis.md` and ready for the implementer/builder agent.

---

## 5. Verification Method

1. **Inspect Artifacts**:
   - Review `analysis.md` in `.agents/teamwork/explorer_m1_test_1/analysis.md` for complete class interfaces, mock implementations, and test scenario listings.
2. **Execute Vitest**:
   - Once the builder agent writes `tests/messaging/canonical-foundation.spec.ts`, verify with:
     ```powershell
     npx vitest run tests/messaging/canonical-foundation.spec.ts
     ```
   - Success condition: 34 tests passing, 0 failures, execution time under 500ms.
3. **Invalidation Conditions**:
   - Any test that fails when `left_at IS NOT NULL` is set indicates an RLS isolation leak.
   - Any duplicate `client_nonce` resulting in more than 1 row indicates an idempotency failure.
   - Any sequence counter skip or collision during concurrent inserts indicates a monotonicity failure.
