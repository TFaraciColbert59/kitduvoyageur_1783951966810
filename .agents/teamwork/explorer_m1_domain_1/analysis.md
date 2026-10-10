# Milestone 1: Canonical Messaging Domain Refactoring Analysis

**Author:** explorer_m1_domain_1 (Domain Refactoring Analyst)  
**Date:** 2026-10-04  
**Target Domain:** `src/features/messaging/`  
**Milestone:** M1 — Canonical Messaging Foundation & Supabase RLS / Idempotence  

---

## 1. Executive Summary & Problem Boundary

### 1.1 Context & Objectives
In the existing architecture of LKDV, `src/features/messaging/services/messagingService.ts` operates as a 1,312-line monolithic service combining:
- Demo state in-memory simulation (`localDemoMessages`, `demoConversationsCache`)
- Direct Supabase REST queries across `conversations`, `conversation_members`, `messages`, `message_reactions`, `message_attachments`, `user_blocks`
- Profile hydration via `fetchPublicProfilesWith`
- Notification dispatching
- Object linking (equipment items, hiking trails)
- Role mutations and group lifecycle management

While functional for basic 1:1 chat, it lacks essential features for robust outdoor and collaborative messaging:
1. **Deterministic sequence ordering**: Messages rely on timestamps (`created_at`), which can suffer clock skew across distributed clients or within network latency spikes.
2. **Send idempotency**: Retries upon packet loss or reconnect produce duplicate messages because there is no client nonce or DB deduplication key.
3. **Cursor-based pagination**: Paginating by limit only (`limit = 50`) scans from start and breaks on bidirectional scrolling or high-frequency updates.
4. **Offline synchronization**: Disconnections result in silent failures or local state desynchronization without a deterministic reconciliation queue.
5. **O(1) read receipts**: Unread counts require counting rows or manual updates, instead of monotonic sequence comparisons.

### 1.2 Refactoring Strategy: Facade Pattern
To avoid breaking any of the 10+ callers throughout the application (such as `useMessages.ts`, `useConversations.ts`, `ConversationView.tsx`, `GroupSettingsModal.tsx`, `NewConversationModal.tsx`, `ForwardMessageSheet.tsx`), we use the **Facade Pattern**:
- `messagingService.ts` remains the single public entry point at its exact canonical location.
- All existing 19 exported method signatures and return types are **100% preserved**.
- Core domain logic is decomposed into dedicated, cohesive domain services in `src/features/messaging/services/domain/`:
  - `sequenceService.ts`: Sequence comparison, gap detection, O(1) unread count calculation.
  - `idempotencyService.ts`: Cryptographic client nonce generation, in-flight registry, duplicate collision recovery.
  - `cursorPaginationService.ts`: Deterministic bidirectional cursor pagination (`beforeSequence`, `afterSequence`).
  - `offlineSyncQueue.ts`: Local pending message storage and 3-phase reconnection reconciliation.
- Existing tests (such as `tests/adventure-intelligence/public-profiles.spec.ts` which mandates `src/features/messaging/services/messagingService.ts` without direct `user_profiles` joins) remain 100% compliant.

---

## 2. Canonical Data Model & Type Updates (`messaging.types.ts`)

File: `src/features/messaging/types/messaging.types.ts`

### 2.1 Type Changes Breakdown

#### A. `ConversationType` & `ConversationContextType`
```typescript
// Support for clubs, expedition rooms and classic channels
export type ConversationType = 'direct' | 'group';

export type ConversationContextType =
  | 'direct'
  | 'group'
  | 'club_channel'
  | 'expedition_room';
```

#### B. `MemberRole`
Expand from 3 roles (`'member' | 'admin' | 'owner'`) to the 5 modular outdoor roles specified in PROJECT.md:
```typescript
export type MemberRole = 'member' | 'safety' | 'guide' | 'admin' | 'owner';
```
*Note on Backward Compatibility:* Since `'member' | 'admin' | 'owner'` is a strict subset of the 5 roles, all existing role comparisons and validations remain strictly valid.

#### C. `Conversation` Interface
```typescript
export interface Conversation {
  id: string;
  type: ConversationType;
  context_type?: ConversationContextType;
  title?: string | null;
  avatar_url?: string | null;
  created_by?: string | null;
  last_message_at: string;
  last_sequence_number?: number; // Monotonic sequence tracking
  created_at: string;
  updated_at: string;

  // Enriched client metadata
  other_member?: UserProfileSummary | null;
  last_message?: MessageSummary | null;
  unread_count: number;
  is_muted?: boolean;
  mute_until?: string | null;
  is_archived?: boolean;
  status?: 'active' | 'pending' | 'rejected';
}
```

#### D. `ConversationMember` Interface
```typescript
export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  is_muted: boolean;
  is_archived: boolean;
  last_read_at: string;
  last_read_sequence?: number; // Monotonic read progression marker
  unread_count: number;
  joined_at: string;
  left_at?: string | null; // For RLS exclusion validation
  profile?: UserProfileSummary;
}
```

#### E. `Message` Interface
```typescript
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  sequence_number?: number; // Assigned monotonically by DB trigger
  client_nonce?: string | null; // Network idempotency token
  reply_to_id?: string | null;
  reply_to_message?: {
    id: string;
    sender_name: string;
    content: string;
  } | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;

  // Joins & UI states
  sender_profile?: UserProfileSummary;
  reactions?: MessageReaction[];
  attachments?: MessageAttachment[];
  status?: 'sending' | 'sent' | 'error' | 'pending'; // 'pending' added for offline queue
  metadata?: Record<string, unknown> | null;
}
```

#### F. New Domain Interfaces for M1 Services
```typescript
// Cursor Pagination Options & Result
export interface CursorPaginationOptions {
  limit?: number; // Default: 50
  beforeSequence?: number; // Load older messages (scrolling up)
  afterSequence?: number; // Load newer messages (scrolling down / catch-up)
}

export interface PaginatedMessagesResult {
  messages: Message[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  earliestSequence: number | null;
  latestSequence: number | null;
}

// Offline Queue & Sync Types
export interface PendingMessage {
  tempId: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: MessageType;
  replyToId?: string;
  metadata?: Record<string, unknown>;
  clientNonce: string;
  createdAt: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  lastError?: string;
}

export type SyncReconciliationPhase = 'flush_pending' | 'pull_delta' | 'resolve_conflicts';

export interface SyncReconciliationResult {
  flushedCount: number;
  failedCount: number;
  syncedMessages: Message[];
  newDeltaMessages: Message[];
}

// Sequence & Nonce Types
export interface SequenceUnreadResult {
  conversationId: string;
  lastReadSequence: number;
  lastConversationSequence: number;
  unreadCount: number;
}

export interface NonceRecord {
  clientNonce: string;
  conversationId: string;
  createdAt: number;
  status: 'pending' | 'confirmed' | 'failed';
}
```

---

## 3. Modular Domain Services Architecture

All domain services reside in `src/features/messaging/services/domain/`.

```
src/features/messaging/services/
├── messagingService.ts          <-- Unified Facade Pattern (100% backward compatible)
└── domain/
    ├── sequenceService.ts       <-- Deterministic ordering, gaps & unread calculation
    ├── idempotencyService.ts    <-- Nonce generator, deduplication & collision recovery
    ├── cursorPaginationService.ts<-- Bidirectional cursor pagination by sequence_number
    └── offlineSyncQueue.ts      <-- Pending queue & 3-phase reconnection reconciliation
```

### 3.1 `sequenceService.ts`

#### Responsibilities:
1. **Deterministic Message Ordering**:
   - Compares two messages:
     ```typescript
     function compareMessages(a: Message, b: Message): number {
       // 1. Primary: sequence_number
       if (a.sequence_number != null && b.sequence_number != null) {
         if (a.sequence_number !== b.sequence_number) {
           return a.sequence_number - b.sequence_number;
         }
       }
       // 2. Secondary fallback (optimistic or legacy messages without sequence_number): created_at
       const timeA = new Date(a.created_at).getTime();
       const timeB = new Date(b.created_at).getTime();
       if (timeA !== timeB) {
         return timeA - timeB;
       }
       // 3. Tertiary tie-breaker: id or client_nonce
       return (a.id || a.client_nonce || '').localeCompare(b.id || b.client_nonce || '');
     }
     ```
   - Sorts an array of messages immutably: `sortMessages(messages: Message[]): Message[]`.
2. **Sequence Gap Detection**:
   - Detects whether intermediate messages were dropped by network packet loss during realtime streaming:
     ```typescript
     function detectSequenceGaps(messages: Message[]): Array<{ from: number; to: number }> {
       const sequenced = messages
         .filter((m) => m.sequence_number != null)
         .sort((a, b) => (a.sequence_number! - b.sequence_number!));
       const gaps: Array<{ from: number; to: number }> = [];
       for (let i = 0; i < sequenced.length - 1; i++) {
         const current = sequenced[i].sequence_number!;
         const next = sequenced[i + 1].sequence_number!;
         if (next > current + 1) {
           gaps.push({ from: current + 1, to: next - 1 });
         }
       }
       return gaps;
     }
     ```
3. **O(1) Unread Message Calculation**:
   - Calculates unread count without table scans:
     ```typescript
     function calculateUnreadCount(lastSequenceNumber: number, lastReadSequence: number): number {
       return Math.max(0, lastSequenceNumber - lastReadSequence);
     }
     function isMessageUnread(messageSequence: number, lastReadSequence: number): boolean {
       return messageSequence > lastReadSequence;
     }
     ```
4. **Monotonic Read Sequence Advance**:
   - In Supabase, updates `conversation_members`:
     Sets `last_read_sequence = GREATEST(last_read_sequence, sequenceNumber)`, `unread_count = 0`, `last_read_at = now()`.

---

### 3.2 `idempotencyService.ts`

#### Responsibilities:
1. **Cryptographic Client Nonce Generation**:
   - Generates unique nonces for each send attempt:
     ```typescript
     function generateNonce(): string {
       const now = Date.now();
       const random = typeof crypto !== 'undefined' && crypto.randomUUID
         ? crypto.randomUUID()
         : `${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
       return `nonce_${now}_${random}`;
     }
     ```
2. **In-Flight Deduplication & In-Memory Registry**:
   - Maintains an in-memory `Map<string, NonceRecord>` with TTL pruning (10 minutes).
   - Prevents duplicate clicks or rapid double-submits from triggering multiple queries.
     - `isNonceInFlight(nonce: string): boolean`
     - `trackInFlight(nonce: string, conversationId: string): void`
     - `markConfirmed(nonce: string): void`
     - `markFailed(nonce: string): void`
3. **Network Collision & PostgreSQL 23505 Error Recovery**:
   - When a network connection drops while Postgres commits the transaction, the client retries with the SAME nonce.
   - Postgres triggers error `23505` (`duplicate key value violates unique constraint "messages_conversation_id_client_nonce_key"`).
   - The service intercepts `23505` and queries:
     ```typescript
     const { data: existingMessage } = await supabase
       .from('messages')
       .select('*')
       .eq('conversation_id', conversationId)
       .eq('client_nonce', clientNonce)
       .single();
     ```
   - Returns `existingMessage` with status `'sent'`. This guarantees **zero duplicated messages** and transparent recovery for the user.

---

### 3.3 `cursorPaginationService.ts`

#### Responsibilities:
1. **Deterministic Bidirectional Query Execution**:
   - **Older Messages (`beforeSequence`)**:
     ```typescript
     let query = supabase.from('messages').select(...).eq('conversation_id', conversationId);
     if (options.beforeSequence != null) {
       query = query.lt('sequence_number', options.beforeSequence);
     }
     query = query.order('sequence_number', { ascending: false }).limit(limit + 1);
     ```
     If `data.length > limit`, `hasMoreBefore = true`. The array is trimmed to `limit` and reversed to ascending order.
   - **Newer Messages (`afterSequence`)**:
     ```typescript
     let query = supabase.from('messages').select(...).eq('conversation_id', conversationId);
     if (options.afterSequence != null) {
       query = query.gt('sequence_number', options.afterSequence);
     }
     query = query.order('sequence_number', { ascending: true }).limit(limit + 1);
     ```
     If `data.length > limit`, `hasMoreAfter = true`. The array is trimmed to `limit`.
2. **Boundary Calculations**:
   - Computes `earliestSequence` (first item in ascending array) and `latestSequence` (last item in ascending array).
3. **Demo Mode Emulation**:
   - For `demo-conv-*`, sequences are assigned index-based values (1, 2, 3...) in-memory, supporting identical pagination logic.

---

### 3.4 `offlineSyncQueue.ts`

#### Responsibilities:
1. **Persistent Local Queue Storage**:
   - Encapsulates queue persistence with local storage / memory fallback:
     - `enqueue(pending: Omit<PendingMessage, 'retryCount' | 'status' | 'createdAt'>): PendingMessage`
     - `dequeue(tempId: string): void`
     - `getPending(conversationId?: string): PendingMessage[]`
     - `updateStatus(tempId: string, status: PendingMessage['status'], error?: string): void`
2. **3-Phase Reconnection Reconciliation Protocol**:
   - **Phase 1: `flush_pending`**:
     - Pulls all pending messages in FIFO order (by `createdAt`).
     - Attempts delivery via `messagingService.sendMessage(..., clientNonce)`.
     - Uses `clientNonce` so any message already received by the server is safely deduplicated without creating a duplicate.
     - On success: dequeues message and updates local status to `'sent'`.
     - On failure: increments `retryCount`, marks as `'failed'` if max retries exceeded.
   - **Phase 2: `pull_delta`**:
     - Obtains highest confirmed `sequence_number` known locally.
     - Queries `cursorPaginationService` with `afterSequence: latestConfirmedSequence`.
     - Discovers all messages created by other participants during disconnection.
   - **Phase 3: `resolve_conflicts`**:
     - Merges server messages with remaining local pending items.
     - Deduplicates items sharing identical `client_nonce` or `id`.
     - Passes list through `sequenceService.sortMessages` for deterministic presentation.

---

## 4. Facade Pattern Implementation in `messagingService.ts`

### 4.1 Preservation of Existing Signatures & Zero Caller Breakage

All 19 existing methods remain exposed with exact arguments and return types:

| Existing Method | Original Signature | Facade Implementation Plan |
|---|---|---|
| `getConversations` | `(userId: string) => Promise<Conversation[]>` | Preserved. Enriches with `last_sequence_number` & `unread_count`. |
| `getOrCreateDirectConversation` | `(targetUserId: string, currentUserId: string) => Promise<string \| null>` | Preserved. Calls `get_or_create_direct_conversation` RPC. |
| `getMessages` | `(conversationId: string, limit = 50) => Promise<Message[]>` | Preserved. Delegates internally to `cursorPaginationService.getMessages(...)`. |
| `toggleReaction` | `(messageId: string, userId: string, reactionValue: string, conversationId?: string) => Promise<{ added: boolean; reaction?: MessageReaction }>` | Preserved. Unchanged reaction logic. |
| `sendMessage` | `(conversationId: string, senderId: string, content: string, messageType?: MessageType, replyToId?: string, metadata?: Record<string, unknown>, clientNonce?: string) => Promise<Message \| null>` | Preserved with optional `clientNonce` 7th param. Generates nonce if absent, checks idempotency, falls back to `offlineSyncQueue` on network crash. |
| `uploadAttachment` | `(conversationId: string, file: File) => Promise<string \| null>` | Preserved. Storage upload with 2-segment path and signed URL. |
| `markAsRead` | `(conversationId: string, userId: string, sequenceNumber?: number) => Promise<void>` | Preserved with optional `sequenceNumber`. Delegates to `sequenceService.markSequenceAsRead`. |
| `getBlockedUserIds` | `(userId: string) => Promise<string[]>` | Preserved. Queries `user_blocks`. |
| `updateMemberPreferences` | `(conversationId: string, userId: string, prefs: {...}) => Promise<boolean>` | Preserved. |
| `acceptMessageRequest` | `(conversationId: string, userId: string) => Promise<boolean>` | Preserved. |
| `declineMessageRequest` | `(conversationId: string, userId: string) => Promise<boolean>` | Preserved. |
| `forwardMessage` | `(fromMessage: Message, targetConvId: string, userId: string) => Promise<{ ok: boolean; error?: string }>` | Preserved. Copies message & attachments with forward metadata. |
| `getShareableInventory` | `(userId: string) => Promise<{...}[]>` | Preserved. Queries `product_ownership` & `resolveGearImage`. |
| `getShareableTrails` | `() => Promise<{...}[]>` | Preserved. Queries `hiking_routes`. |
| `getGroupMembers` | `(conversationId: string) => Promise<ConversationMember[]>` | Preserved. Enriches members via `fetchPublicProfilesWith`. |
| `updateGroupInfo` | `(conversationId: string, updates: { title?: string; avatar_url?: string }) => Promise<boolean>` | Preserved. |
| `updateMemberRole` | `(conversationId: string, targetUserId: string, newRole: MemberRole) => Promise<{ success: boolean; error?: string }>` | Preserved. Updated with 5 roles. |
| `removeGroupMember` | `(conversationId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>` | Preserved. |
| `leaveGroup` | `(conversationId: string, userId: string) => Promise<{ success: boolean; error?: string; requireOwnerTransfer?: boolean }>` | Preserved. |

### 4.2 New Extended Facade Methods

```typescript
export const messagingService = {
  // --- Existing 19 methods (see table above) ---
  ...

  // --- Sub-services directly accessible via Facade ---
  sequence: sequenceService,
  idempotency: idempotencyService,
  cursor: cursorPaginationService,
  offlineQueue: offlineSyncQueue,

  // --- Extended Domain Operations ---
  async getMessagesCursor(
    conversationId: string,
    options: CursorPaginationOptions
  ): Promise<PaginatedMessagesResult> {
    return cursorPaginationService.getMessagesCursor(conversationId, options);
  },

  async markSequenceAsRead(
    conversationId: string,
    userId: string,
    sequenceNumber: number
  ): Promise<void> {
    return sequenceService.markSequenceAsRead(conversationId, userId, sequenceNumber);
  },

  async reconcileOfflineMessages(
    conversationId?: string
  ): Promise<SyncReconciliationResult> {
    return offlineSyncQueue.reconcile(conversationId);
  },

  getPendingMessages(conversationId?: string): PendingMessage[] {
    return offlineSyncQueue.getPending(conversationId);
  },
};
```

### 4.3 Invariant Safeguard
Test `TEST-A10-F1-05` in `tests/adventure-intelligence/public-profiles.spec.ts` verifies that:
1. `src/features/messaging/services/messagingService.ts` exists.
2. It does not use direct `user_profiles` joins (`user_profiles!`, `:user_profiles(`, or `user_profiles(`).
3. Profiles are hydrated via `fetchPublicProfilesWith`.
The Facade design respects this invariant.

---

## 5. Database Schema & Supabase RLS Alignment

The database migration `supabase/migrations/20261004120000_lkdv_social_core_architecture.sql` implements:

1. **Atomic Monotonic Sequence Trigger**:
   ```sql
   CREATE OR REPLACE FUNCTION public.assign_message_sequence()
   RETURNS TRIGGER
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public, pg_temp
   AS $$
   DECLARE
       v_next_seq BIGINT;
   BEGIN
       -- Atomic increment on conversation row with row lock
       UPDATE public.conversations
       SET last_sequence_number = last_sequence_number + 1,
           last_message_at = now()
       WHERE id = NEW.conversation_id
       RETURNING last_sequence_number INTO v_next_seq;

       IF v_next_seq IS NULL THEN
           RAISE EXCEPTION 'Conversation % introuvable', NEW.conversation_id;
       END IF;

       NEW.sequence_number := v_next_seq;
       RETURN NEW;
   END;
   $$;

   DROP TRIGGER IF EXISTS trg_assign_message_sequence ON public.messages;
   CREATE TRIGGER trg_assign_message_sequence
       BEFORE INSERT ON public.messages
       FOR EACH ROW
       EXECUTE FUNCTION public.assign_message_sequence();
   ```

2. **Constraints & Indexes**:
   ```sql
   ALTER TABLE public.messages
       ADD COLUMN IF NOT EXISTS sequence_number BIGINT,
       ADD COLUMN IF NOT EXISTS client_nonce TEXT;

   CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conv_seq
       ON public.messages (conversation_id, sequence_number);

   CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conv_nonce
       ON public.messages (conversation_id, client_nonce)
       WHERE client_nonce IS NOT NULL;
   ```

3. **RLS Hardening & Exited Member Leak Fix**:
   Fix helper `is_conversation_member` to enforce `left_at IS NULL`:
   ```sql
   CREATE OR REPLACE FUNCTION public.is_conversation_member(
     target_conversation_id uuid,
     target_user_id uuid
   )
   RETURNS boolean
   LANGUAGE sql
   STABLE
   SECURITY DEFINER
   SET search_path = public, pg_temp
   AS $$
     SELECT EXISTS(
       SELECT 1
       FROM public.conversation_members cm
       WHERE cm.conversation_id = target_conversation_id
         AND cm.user_id = target_user_id
         AND cm.left_at IS NULL
     );
   $$;
   ```
   Ensures InitPlan caching `(SELECT auth.uid())` across all policies, preventing N-row per-statement auth function evaluations.

---

## 6. Testing Strategy & Test Suite Specification

Test Suite: `tests/messaging/canonical-foundation.spec.ts`

### 6.1 Test Suites Structure
```typescript
describe('Canonical Messaging Foundation (M1)', () => {
  describe('sequenceService', () => {
    it('sorts messages deterministically by sequence_number ascending');
    it('falls back to created_at when sequence_number is absent');
    it('detects sequence gaps accurately');
    it('calculates unread count in O(1) via last_sequence_number - last_read_sequence');
    it('identifies unread messages based on sequence threshold');
  });

  describe('idempotencyService', () => {
    it('generates unique client nonces with timestamp prefix');
    it('tracks in-flight nonces to avoid duplicate requests');
    it('recovers gracefully from unique constraint collisions (23505) by returning existing message');
    it('cleans up expired in-flight entries after TTL');
  });

  describe('cursorPaginationService', () => {
    it('slices older messages with beforeSequence in descending query returned in ascending order');
    it('slices newer messages with afterSequence');
    it('correctly sets hasMoreBefore and hasMoreAfter flags');
    it('handles empty message collections and boundary limits');
  });

  describe('offlineSyncQueue', () => {
    it('enqueues pending messages with temporary identifiers');
    it('dequeues synced messages');
    it('executes 3-phase reconciliation: flush pending, pull delta, resolve conflicts');
    it('merges server and local pending messages without duplicate nonces');
  });

  describe('messagingService Facade', () => {
    it('preserves all existing public methods and signatures');
    it('maintains demo mode fallback for offline UI tests');
    it('exposes domain sub-services via facade properties');
  });
});
```

---

## 7. Migration & Rollout Plan

1. **Step 1: Types & Interfaces**:
   Apply type additions to `src/features/messaging/types/messaging.types.ts` (`sequence_number`, `client_nonce`, `last_read_sequence`, 5 member roles).
2. **Step 2: Modular Domain Services Implementation**:
   Implement `sequenceService.ts`, `idempotencyService.ts`, `cursorPaginationService.ts`, and `offlineSyncQueue.ts` in `src/features/messaging/services/domain/`.
3. **Step 3: Facade Refactor of `messagingService.ts`**:
   Refactor `messagingService.ts` to delegate to domain services while preserving all 19 existing methods and the `fetchPublicProfilesWith` requirement.
4. **Step 4: Database Migration**:
   Deploy migration `20261004120000_lkdv_social_core_architecture.sql` for trigger, columns, and RLS left_at checks.
5. **Step 5: Vitest Test Suite**:
   Create and execute `tests/messaging/canonical-foundation.spec.ts`, ensuring 100% pass rate.
6. **Step 6: Verification**:
   Execute `npm run type-check` and `npm run test` across the full project to verify zero regressions.
