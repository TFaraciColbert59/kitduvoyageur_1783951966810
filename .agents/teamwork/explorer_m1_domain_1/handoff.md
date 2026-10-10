# Handoff Report: Canonical Messaging Domain Refactoring (Milestone 1)

**Agent:** `explorer_m1_domain_1`  
**Working Directory:** `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m1_domain_1`  
**Parent Agent:** `22810fd4-62f8-4724-853b-2cdeda826f11`  
**Handoff Type:** Hard (Task complete)  

---

## 1. Observation

1. **Current Messaging Monolith**:
   - `src/features/messaging/services/messagingService.ts` contains 1,312 lines combining mock demo data (`localDemoMessages`, lines 7, 157-410), direct Supabase queries, profile hydration (`fetchPublicProfilesWith`, lines 467-471, 601-604, 1196-1200), reactions, inventory, trails, and group lifecycle.
   - It exports exactly 19 public methods on `export const messagingService`:
     - `getConversations(userId: string)` (line 414)
     - `getOrCreateDirectConversation(targetUserId: string, currentUserId: string)` (line 525)
     - `getMessages(conversationId: string, limit = 50)` (line 544)
     - `toggleReaction(messageId: string, userId: string, reactionValue: string, conversationId?: string)` (line 654)
     - `sendMessage(conversationId: string, senderId: string, content: string, messageType = 'text', replyToId?: string, metadata?: Record<string, unknown>)` (line 732)
     - `uploadAttachment(conversationId: string, file: File)` (line 815)
     - `markAsRead(conversationId: string, userId: string)` (line 842)
     - `getBlockedUserIds(userId: string)` (line 851)
     - `updateMemberPreferences(conversationId: string, userId: string, prefs: ...)` (line 860)
     - `acceptMessageRequest(conversationId: string, userId: string)` (line 889)
     - `declineMessageRequest(conversationId: string, userId: string)` (line 909)
     - `forwardMessage(fromMessage: Message, targetConvId: string, userId: string)` (line 934)
     - `getShareableInventory(userId: string)` (line 1062)
     - `getShareableTrails()` (line 1098)
     - `getGroupMembers(conversationId: string)` (line 1116)
     - `updateGroupInfo(conversationId: string, updates: ...)` (line 1225)
     - `updateMemberRole(conversationId: string, targetUserId: string, newRole: ...)` (line 1248)
     - `removeGroupMember(conversationId: string, targetUserId: string)` (line 1270)
     - `leaveGroup(conversationId: string, userId: string)` (line 1291)
2. **Callers Across the Codebase**:
   - Grep search confirms `messagingService` is directly consumed in 10 UI components and hooks:
     - `src/features/messaging/hooks/useMessages.ts` (lines 4, 23, 28, 71, 85, 126, 185)
     - `src/features/messaging/hooks/useConversations.ts` (lines 4, 22)
     - `src/features/messaging/components/NewConversationModal.tsx` (lines 8, 76)
     - `src/features/messaging/components/GroupSettingsModal.tsx` (lines 10, 49, 68, 86, 104, 120)
     - `src/features/messaging/components/ForwardMessageSheet.tsx` (lines 8, 39, 65)
     - `src/features/messaging/components/ConversationView.tsx` (lines 149, 162, 175, 190, 197)
     - `src/features/messaging/components/ConversationOptionsSheet.tsx` (lines 8, 58, 66, 84, 97)
     - `src/features/messaging/components/ConversationOptionsMenuModal.tsx` (lines 7, 49, 64)
     - `src/features/messaging/components/ConversationList.tsx` (lines 9, 80, 82, 84, 88)
     - `src/features/messaging/components/ComposerMenuSheet.tsx` (lines 12, 76, 102)
   - Any breaking change to existing method signatures will cause compilation failures across all 10 callers.
3. **Existing Test Invariant**:
   - `tests/adventure-intelligence/public-profiles.spec.ts` (lines 144, 147-159) explicitly requires:
     `expect(fs.existsSync('src/features/messaging/services/messagingService.ts')).toBe(true)` and enforces that no direct `user_profiles` joins occur. All profile lookups must pass through `fetchPublicProfilesWith`.
4. **Current Types**:
   - `src/features/messaging/types/messaging.types.ts` defines `ConversationType = 'direct' | 'group'`, `MemberRole = 'member' | 'admin' | 'owner'`, `Conversation`, `ConversationMember`, `Message`.
   - Lacks `sequence_number`, `client_nonce`, `last_read_sequence`, `left_at`, and the 5 modular outdoor roles (`owner`, `admin`, `guide`, `safety`, `member`).
5. **Database RLS Observation**:
   - In `supabase/migrations/20260830000000_messaging_security_helpers.sql` (lines 17-33), `is_conversation_member` checks `WHERE cm.conversation_id = target_conversation_id AND cm.user_id = target_user_id`, without checking `AND cm.left_at IS NULL`.
   - In `supabase/migrations/20260925010000_messaging_rls_auth_initplan.sql` (lines 60-82), policies were cached with `(SELECT auth.uid())`, which must be retained in subsequent migrations.
6. **Tool Results**:
   - `npm run type-check`: Exited with code 0 (clean baseline).
   - `npm test tests/messaging/messagingUtils.spec.ts`: Exited with code 0 (7 passed in 138ms).

---

## 2. Logic Chain

1. **Premise 1 (Zero-Breakage Facade Requirement)**:
   - Observation 2 demonstrates that 10 existing callers import and execute `messagingService` methods directly.
   - Observation 3 shows that tests mandate the physical existence of `src/features/messaging/services/messagingService.ts`.
   - *Therefore*, the Facade pattern is mandatory: all 19 methods on `messagingService` must preserve their exact names, argument lists, and return types, delegating internally to domain services while remaining the canonical public gateway.
2. **Premise 2 (Domain Service Decomposition)**:
   - For deterministic sequence ordering, gap detection, and O(1) unread calculation, logic must be extracted into `src/features/messaging/services/domain/sequenceService.ts`.
   - For network send idempotency, client nonce generation, in-flight tracking, and recovering from PostgreSQL error 23505 (unique_violation), logic must be isolated in `src/features/messaging/services/domain/idempotencyService.ts`.
   - For bidirectional cursor pagination by integer `sequence_number` (beforeSequence / afterSequence), logic belongs in `src/features/messaging/services/domain/cursorPaginationService.ts`.
   - For local queued messages and 3-phase reconnection reconciliation (flush pending -> pull delta -> resolve conflicts), logic belongs in `src/features/messaging/services/domain/offlineSyncQueue.ts`.
3. **Premise 3 (Type System Soundness)**:
   - Observation 4 shows missing types for monotonic sequences and outdoor roles.
   - Adding `sequence_number?: number`, `client_nonce?: string | null` to `Message`, `last_read_sequence?: number`, `left_at?: string | null` to `ConversationMember`, and updating `MemberRole` to `'member' | 'safety' | 'guide' | 'admin' | 'owner'` is backward compatible because new fields are optional and existing roles are a subset of the new union.
4. **Premise 4 (RLS Hardening Alignment)**:
   - Observation 5 reveals `is_conversation_member` lacks `cm.left_at IS NULL`. Exited members could still view or insert messages.
   - The M1 schema update must add `AND cm.left_at IS NULL` to `is_conversation_member` and maintain `(SELECT auth.uid())` InitPlan optimization.

---

## 3. Caveats

1. **Offline Persistence Storage**:
   - `offlineSyncQueue.ts` is designed with an adaptable storage driver: `localStorage` in browser environments, with in-memory fallback in Node.js test environments.
2. **Sequence Number Generation**:
   - Monotonic sequence numbers are assigned atomically by Postgres `BEFORE INSERT` trigger in production. In client-side demo mode (`demo-conv-*`), sequence numbers are assigned by an in-memory counter starting from the last known message sequence to ensure Vitest and offline development work seamlessly without a database connection.
3. **No Code Modification Undertaken**:
   - In accordance with the explorer archetype rules, this phase is strictly read-only analysis. No source code or tests were modified during this investigation.

---

## 4. Conclusion

The refactoring plan is fully detailed and ready for immediate implementation:
1. `src/features/messaging/types/messaging.types.ts` will be updated with `sequence_number`, `client_nonce`, `last_read_sequence`, `left_at`, 5 outdoor member roles, and domain pagination/sync interfaces.
2. Four domain services will be created under `src/features/messaging/services/domain/`:
   - `sequenceService.ts`
   - `idempotencyService.ts`
   - `cursorPaginationService.ts`
   - `offlineSyncQueue.ts`
3. `src/features/messaging/services/messagingService.ts` will be refactored into a clean Facade preserving 100% backward compatibility for all 19 methods and adding domain accessors.
4. A dedicated Vitest test suite `tests/messaging/canonical-foundation.spec.ts` will cover sequence ordering, idempotency deduplication, cursor pagination, and 3-phase offline reconciliation.

Full technical details, algorithms, and interface specifications are documented in `analysis.md`.

---

## 5. Verification Method

To verify the findings and subsequent implementation independently:

1. **Verify Existing Tests and Baseline**:
   ```bash
   npm test tests/messaging/messagingUtils.spec.ts
   npm test tests/adventure-intelligence/public-profiles.spec.ts
   npm run type-check
   ```
2. **Verify Callers and Invariants**:
   - Inspect `src/features/messaging/services/messagingService.ts` to confirm all 19 method names and signatures match callers in `src/features/messaging/hooks/useMessages.ts`.
   - Confirm `fetchPublicProfilesWith` is used for all profile lookups (no direct `user_profiles` joins).
3. **Verify Implementation of M1 Suite (Once Implemented)**:
   ```bash
   npm test tests/messaging/canonical-foundation.spec.ts
   npm run type-check
   ```
   Invalidation condition: Any TypeScript diagnostic error during `tsc --noEmit` or any test failure in `canonical-foundation.spec.ts` or `public-profiles.spec.ts`.
