# Structured Analysis Report: Canonical Messaging Foundation & Supabase RLS / Idempotence (Milestone 1)

**Agent**: `explorer_m1_sql_1` (Database & Security Specialist)  
**Date**: 2026-10-04  
**Context**: Milestone 1 — Canonical Messaging Foundation & Supabase RLS / Idempotence (`ORIGINAL_REQUEST.md`, `PROJECT.md`)  
**Core Finding**: The existing messaging architecture lacks strict conversational sequence numbers, network send idempotency (`client_nonce`), read sequence tracking, and has a critical security leak in `is_conversation_member` where departed members (`left_at IS NOT NULL`) retain access to conversations; all are resolved via an atomic BEFORE INSERT trigger, InitPlan-cached RLS policies, and modular role extensions.

---

## 1. Problem Statement & Architectural Audit

### 1.1 Critical Vulnerability: Security Leak in `is_conversation_member`
- **Location**: `supabase/migrations/20260830000000_messaging_security_helpers.sql:17-33`
- **Observation**:
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
    );
  $$;
  ```
- **Vulnerability**: The function does **NOT** check `cm.left_at IS NULL`. When a user leaves a conversation (`left_at` is set to a timestamp), `is_conversation_member` still returns `TRUE`.
- **Consequence**: Users who left or were removed from a group conversation continue to read all newly posted messages, attachments, and reactions via RLS policies (`members_select_messages`, `members_select_attachments`).
- **Resolution**: Patch `is_conversation_member`, `is_conv_owner`, and `is_conv_admin` to strictly require `cm.left_at IS NULL`, and add a partial index `ON public.conversation_members(conversation_id, user_id) WHERE left_at IS NULL`.

---

### 1.2 Message Sequencing & Race Conditions
- **Current State**: Messages are sorted only by `created_at ASC` (`messagingService.ts:591`).
- **Defects**:
  1. Timestamp collision: When multiple messages arrive in the same millisecond, client ordering is non-deterministic.
  2. Clock drift: Client timestamps differ from database timestamps, causing message interleaving.
  3. Cursor pagination: Inability to execute reliable O(1) integer range queries (`sequence_number < $cursor` or `sequence_number > $cursor`).
- **Resolution**:
  - Add `last_sequence_number BIGINT NOT NULL DEFAULT 0` to `public.conversations`.
  - Add `sequence_number BIGINT NOT NULL` with constraint `UNIQUE(conversation_id, sequence_number)` to `public.messages`.
  - Create trigger `trg_assign_message_sequence` executing `BEFORE INSERT ON public.messages`.
  - The trigger performs:
    ```sql
    UPDATE public.conversations
    SET last_sequence_number = last_sequence_number + 1,
        last_message_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.conversation_id
    RETURNING last_sequence_number INTO v_next_seq;
    ```
  - **Atomicity & Lock Guarantee**: Postgres row-level locks on `public.conversations` enforce strict serial monotonic ordering per conversation without global table locks or race conditions.

---

### 1.3 Network Send Idempotency (`client_nonce`)
- **Current State**: When an offline or flaky mobile connection drops during HTTP transmission, the client retries, resulting in duplicate message records.
- **Resolution**:
  - Add `client_nonce TEXT` to `public.messages`.
  - Add unique constraint & index `uq_messages_conversation_client_nonce UNIQUE (conversation_id, client_nonce)`.
  - On retry with the same nonce in the same conversation, database enforces uniqueness, preventing duplicate entries.

---

### 1.4 RLS Performance Optimization (InitPlan Caching)
- **Supabase Guideline**: Rule from `references/security-rls-performance.md`:
  - Calling `auth.uid()` directly inside row-level security expressions evaluates the function once per scanned row.
  - Wrapping in a subquery `(SELECT auth.uid())` allows Postgres query planner to treat it as an **InitPlan** (evaluated once per query execution and cached).
- **Resolution**: All RLS policies for `conversations`, `conversation_members`, `messages`, `message_attachments`, `message_reactions`, `message_mentions`, and `storage.objects` are updated to use `(SELECT auth.uid())`.

---

### 1.5 Modular Outdoor Roles & Context Types
- **Existing Roles**: `('member', 'admin', 'owner')` in `20260831000000_messaging_system_canonical.sql:54`.
- **Target Specification**: 5 modular outdoor roles required for expedition safety and clubs:
  `CHECK (role IN ('member', 'safety', 'guide', 'admin', 'owner'))`.
- **Conversation Context Types**:
  `CHECK (context_type IN ('direct', 'group', 'club_channel', 'expedition_room'))`.
- **Read Tracking**:
  - Add `last_read_sequence BIGINT NOT NULL DEFAULT 0` to `conversation_members`.
  - Create RPC `public.update_last_read_sequence(p_conversation_id UUID, p_sequence_number BIGINT)` for instant integer comparison.

---

### 1.6 Schema Foundations for Milestone 3 & Milestone 4
1. **Club Channels (`club_channels`)**:
   - Tied 1:1 to `conversations.id` with `context_type = 'club_channel'`.
   - Granular role gates: `min_role_to_read` and `min_role_to_write`.
2. **Expedition Rooms (`expedition_rooms`)**:
   - Cockpit table linking conversation to `trips(id)`, GPX SVG snapshot (`JSONB`), and live weather location (`JSONB`).
3. **Terra Drafted Actions (`terra_drafted_actions`)**:
   - Human-in-the-loop action engine (`action_type`, `proposed_payload`, `status: 'draft'`).
   - Mandatory source citations: `source_message_sequences BIGINT[] NOT NULL` referencing the exact conversational messages where the proposal originated.

---

## 2. Migration Design Summary

| Component | Target Location | Rationale |
|-----------|-----------------|-----------|
| Migration File | `proposed_20261004120000_lkdv_social_core_architecture.sql` (to be deployed to `supabase/migrations/20261004120000_lkdv_social_core_architecture.sql`) | Full atomic migration containing schema adjustments, backfills, triggers, RLS rewrites, and new tables. |
| Database Types | `proposed_types.ts` (to be merged into `src/lib/supabase/types.ts`) | Type-safe definitions for all updated and new tables. |
| Domain Types | `proposed_messaging.types.ts` (for `src/features/messaging/types/messaging.types.ts`) | Aligns frontend domain types with sequence numbers, nonces, and roles. |

---

## 3. Backward Compatibility & Impact Analysis

1. **`messagingService.ts`**:
   - In Milestone 1, `messagingService.ts` continues to function with backward compatibility while delegating sequence numbers and idempotency nonces.
   - Any insert without a specified `sequence_number` automatically gets assigned the next valid monotonic sequence number by `trg_assign_message_sequence`.
   - Existing code queries continue to work; cursor pagination will query `sequence_number` instead of relying solely on `created_at`.
2. **Existing Data**:
   - Migration includes idempotent backfills:
     - Pre-existing messages receive sequence numbers partitioned by conversation and ordered by `created_at ASC, id ASC`.
     - Pre-existing conversations set `last_sequence_number` to `MAX(sequence_number)`.
     - Pre-existing members backfill `last_read_sequence` based on `last_read_at`.
3. **Type Checking**:
   - `npm run type-check` currently runs with 0 errors. Adding these non-breaking types to `src/lib/supabase/types.ts` maintains 0 errors.
