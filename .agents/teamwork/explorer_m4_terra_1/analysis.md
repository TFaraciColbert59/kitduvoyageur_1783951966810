# Milestone 4 (R4) — Terra AI, Context Isolation & Draft Action Engine Analysis

## Executive Summary
Terra AI is designed as a human-in-the-loop outdoor co-pilot within the canonical LKDV messaging architecture (`src/features/messaging/`). It enforces three inviolable principles: (1) **Hermetic Per-Conversation Context Isolation** preventing cross-room data bleeding; (2) **"Quiet Catch-Up" Catch-Up Summaries** with mandatory verifiable citations `[seq #N, @author]` and zero hallucinations; and (3) a **Draft-Only Action Engine** where every proposal is constrained to `status: 'draft'`, `requiresConfirmation: true`, requiring explicit human approval before any mutation.

---

## 1. Context & Architectural Foundation

### 1.1 Existing Database Foundation
In `supabase/migrations/20261004120000_lkdv_social_core_architecture.sql`:
- **`messages`**: Contains atomic monotonic sequence numbers (`sequence_number BIGINT NOT NULL`) and unique constraint `uq_messages_conversation_sequence`.
- **`conversation_members`**: Contains `last_read_sequence BIGINT NOT NULL DEFAULT 0` and atomic RPC `update_last_read_sequence(UUID, BIGINT)`.
- **`conversations`**: Contains `last_sequence_number BIGINT NOT NULL DEFAULT 0` and `context_type TEXT CHECK (context_type IN ('direct', 'group', 'club_channel', 'expedition_room'))`.
- **`terra_drafted_actions`** (lines 642–688):
  ```sql
  CREATE TABLE IF NOT EXISTS public.terra_drafted_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('create_expedition', 'create_poll', 'update_checklist', 'safety_alert')),
    proposed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_message_sequences BIGINT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
  );
  ```
- **RLS & Security**: Hermetic RLS is already applied to `terra_drafted_actions` using `is_conversation_member(conversation_id, (SELECT auth.uid()))`.

### 1.2 TypeScript Typing Foundation
In `src/lib/supabase/types.ts` (lines 629–648):
- `TerraActionType`: `'create_expedition' | 'create_poll' | 'update_checklist' | 'safety_alert'`
- `TerraActionStatus`: `'draft' | 'approved' | 'rejected'`
- `DatabaseTerraDraftedAction`: Database interface with camel_case column mappings.

---

## 2. Requirement 1: Per-Conversation Context Isolation

### 2.1 Threat Model
In an outdoor adventure platform, chat threads contain sensitive data:
- Private DMs: Medical notes, personal fitness levels, emergency contacts.
- Expedition Rooms: Live GPS bivouac coordinates, off-trail waypoints, high-risk traverse plans.
- Club Channels: Broad member communications with public or semi-public scope.

If Terra AI memory, caches, or prompt builders inadvertently bleed state across conversations, a catastrophic privacy breach or hazard miscommunication could occur (e.g. sharing an expedition's secret water source or emergency contact into a public club channel).

### 2.2 Hermetic Isolation Enforcement
To guarantee complete isolation:
1. **Scoped Query Boundary**: All message retrieval for Terra must be strictly filtered by `conversation_id = target_conversation_id`.
2. **Context Boundary Guard**: A dedicated validator `validateTerraContextBoundary(context, requestedConversationId)` validates that:
   - `context.conversationId === requestedConversationId`
   - For every message in `context.scopedMessages`, `msg.conversation_id === requestedConversationId`.
   - If any message fails, a `TerraContextBleedError` is thrown immediately.
3. **Partitioned Cache Keys**: All cached embeddings, prompt tokens, or unread summaries must be keyed strictly by:
   `terra:ctx:${conversationId}:${lastSequenceNumber}`.
   Zero global cross-room conversational scratchpads are permitted.

### 2.3 Room-Level Permission Toggle
- Conversations can enable or disable the Terra AI assistant.
- In `Conversation` interface: `is_terra_enabled?: boolean`.
- Permissions:
  - In direct DMs with Terra bot (`type === 'direct'`, recipient is Terra): always `enabled = true`.
  - In regular direct DMs between two users: default `enabled = false` (opt-in privacy).
  - In group chats, club channels, and expedition rooms: toggling requires `admin` or `owner` outdoor role (enforced via `hasRolePermission(userRole, 'admin')`).
- If Terra is disabled for a conversation, any attempt to generate a Quiet Catch-Up or invoke Terra commands will return `null` or reject with `TERRA_DISABLED_IN_ROOM`.

---

## 3. Requirement 2: "Quiet Catch-Up" Catch-Up Engine

### 3.1 Outdoor Problem & Operational Requirements
Adventurers returning from off-grid areas often face 50 to 200 unread messages accumulated across expedition and club threads. Navigating long message lists on mobile under outdoor conditions (cold weather, sunlight, low battery) is difficult and error-prone.

"Quiet Catch-Up" provides an instantaneous, structured debriefing of what transpired while offline.

### 3.2 Unread Sequence Range
Read progress in LKDV Social is tracked via `last_read_sequence` on `conversation_members`.
The unread window is computed deterministically in $O(1)$:
$$\text{fromSequence} = \text{last\_read\_sequence} + 1$$
$$\text{toSequence} = \text{last\_sequence\_number}$$
$$\text{unreadCount} = \text{toSequence} - \text{fromSequence} + 1$$

If $\text{fromSequence} > \text{toSequence}$, the unread count is 0, and the engine immediately returns `null` (no catch-up needed).

### 3.3 Mandatory Verifiable Citations
To eliminate AI hallucination, **every single summary bullet must include verifiable source citations**:
- Standard citation format: `[seq #<N>, @<author>]` (e.g. `[seq #14, @alice]`).
- Multiple citations allowed: `[seq #14, @alice] [seq #16, @marc]`.
- Regex definition:
  ```typescript
  export const CITATION_REGEX = /\[seq\s*#(\d+),\s*@([a-zA-Z0-9_\-\s]+)\]/g;
  ```

### 3.4 Anti-Hallucination Verification Protocol
Before returning any summary, the engine executes `verifySummaryCitations(summary, scopedMessages)`:
1. For each citation `[seq #N, @author]`:
   - Verify that a message with `sequence_number === N` exists in `scopedMessages`.
   - Verify that the message's sender name corresponds to `@author` (case-insensitive normalized match).
   - Verify that the message was not deleted.
2. If any citation is invalid or hallucinated:
   - The invalid citation is stripped, or the bullet is dropped if no valid citations remain.
   - The result guarantees **100% verified anchors** in conversation history.

### 3.5 Deterministic Heuristic Engine (Offline-First)
In situations where an LLM is unreachable (offline mode, no network, or local execution), `TerraService.buildDeterministicSummary()` operates as a zero-network rule-based extractor:
- Categorizes messages into topics: `logistics`, `weather`, `gear`, `safety`, `general`.
- Detects keywords (e.g., "validé", "qui prend", "orage", "danger") to extract key decisions and action items.
- Automatically attaches exact sequence numbers and author names, guaranteeing 100% citation compliance.

---

## 4. Requirement 3: Draft Action Engine

### 4.1 Principle of Zero Unilateral Mutations
Terra AI must **NEVER** execute mutations directly on the database. In outdoor expedition planning, automated mutations (such as changing a route, adding a heavy piece of gear to someone's pack, or setting a trip date) without human consent create safety liabilities.

### 4.2 Action Types & Database Alignment
The underlying PostgreSQL table `terra_drafted_actions` enforces a `CHECK (action_type IN ('create_expedition', 'create_poll', 'update_checklist', 'safety_alert'))`.
At the domain layer, we support both the 4 canonical types and rich outdoor sub-actions:
```typescript
export type DatabaseTerraActionType =
  | 'create_expedition'
  | 'create_poll'
  | 'update_checklist'
  | 'safety_alert';

export type DraftActionType =
  | DatabaseTerraActionType
  | 'propose_trip_date'
  | 'allocate_gear'
  | 'broadcast_route_update';
```

A normalizer `normalizeToDbActionType()` maps:
- `propose_trip_date` $\to$ `create_expedition`
- `allocate_gear` $\to$ `update_checklist`
- `broadcast_route_update` $\to$ `safety_alert`

This guarantees 100% database schema compatibility with zero migration conflicts.

### 4.3 Draft Action Model
Every draft action is generated with:
- `status: 'draft'`
- `requiresConfirmation: true` (strictly typed boolean literal `true`)
- `sourceMessageSequences: number[]` (linking back to the conversational origin)
- `proposedPayload: T` (structured parameters)

```typescript
export interface TerraDraftAction<T = Record<string, unknown>> {
  id: string;
  conversationId: string;
  actionType: DraftActionType;
  status: DraftActionStatus;
  requiresConfirmation: true;
  proposedPayload: T;
  sourceMessageSequences: number[];
  explanation?: string;
  proposedBy: 'terra';
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 4.4 Human Confirmation Flow
1. **Draft Creation**: Stored in `terra_drafted_actions` with `status: 'draft'`.
2. **Review Permissions**: `canUserReviewDraft(userRole, action)`:
   - For polls, expeditions, checklists: any active member of the room (`member`, `guide`, `admin`, `owner`).
   - For safety alerts or route broadcasts: requires at least `safety`, `guide`, `admin`, or `owner`.
3. **Approve Transition**:
   - `approveDraftAction(action, reviewerId, reviewerName)` sets `status = 'approved'`, `reviewedBy = reviewerId`, `reviewedAt = now()`.
   - Only approved actions with a non-null `reviewedBy` can execute the underlying business logic (`canExecuteAction(action) === true`).
4. **Reject Transition**:
   - `rejectDraftAction(action, reviewerId, reviewerName)` sets `status = 'rejected'`, `reviewedBy = reviewerId`. No business mutation is triggered.

---

## 5. Requirement 4: UI Component Blueprints

### 5.1 Design System & Apple HIG Guidelines
All components follow Apple Human Interface Guidelines:
- **Typography**: SF Pro hierarchy (`text-sm font-bold`, `text-xs leading-relaxed`).
- **Touch Targets**: Minimum **44px** hit area (`min-h-[44px]`, `h-11`) for all interactive elements (Approve, Reject, Dismiss).
- **Glass Materials**: `bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] border border-[color:var(--glass-border)] rounded-2xl`.
- **Zero Orange `#E4501C` Rule**: Absolutely zero `#E4501C` used. Color palette relies on:
  - AI Intelligence: Apple Indigo / Violet (`text-indigo-600 dark:text-indigo-400`, `bg-indigo-500/15`).
  - Approval / Success: Emerald (`bg-emerald-600`, `text-emerald-700 dark:text-emerald-400`).
  - Rejection / Cancel: Neutral zinc / system secondary (`bg-black/[0.06] dark:bg-white/[0.10]`).
  - Warning / Draft: Muted amber (`bg-amber-500/15 text-amber-700 dark:text-amber-400`).

### 5.2 `QuietCatchUpCard.tsx` / `QuietCatchUpModal.tsx`
- **Header**: Terra AI icon badge (✨), "Quiet Catch-Up" title, unread range pill (`seq #12 à #25 (14 non lus)`), and 44px dismiss button (✕).
- **Body**:
  - Categorized bullet points with icons (🎒 gear, ⛅ weather, ⚠️ safety, 📍 logistics, 💬 general).
  - Clickable citation tags: `[#14 @Sarah]` styled as interactive pills. Tapping a citation invokes `onSelectCitation(14)` which scrolls the chat list directly to message #14.
  - Section for **Décisions validées** (green checkmark pills).
  - Section for **Actions à mener** (task checklist with assignee tags).
- **Footer**: 44px dismiss button ("C'est clair, fermer").
- **Modal Wrapper (`QuietCatchUpModal.tsx`)**: Backdrop blur sheet (`bg-black/40 backdrop-blur-sm`) with bottom slide-in animation on mobile and centered modal on desktop.

### 5.3 `TerraDraftActionCard.tsx`
- **Embedded in Conversation Stream**: Renders alongside chat bubbles as a specialized interactive card.
- **Header**: AI Co-pilot tag (`🤖 Proposition Terra AI`) and dynamic status pill (`Brouillon`, `✓ Validé`, `✕ Rejeté`).
- **Action Context**:
  - Title & description explaining why Terra proposed the action.
  - Traceability row: "Sources : " with sequence tags (`#seq 12`, `#seq 14`).
- **Payload Preview**:
  - Poll: Question and numbered option list.
  - Expedition / Date proposal: Destination and candidate dates.
  - Checklist / Gear: Item name, weight in grams, and proposed carrier.
  - Safety alert: Hazard description and recommended safety action.
- **Safety Notice**: "🔒 Requiert une confirmation explicite d'un équipier avant exécution."
- **Interactive Action Footer**:
  - When `status === 'draft'`:
    - **Approve Button**: `h-11 min-h-[44px]` primary emerald button with checkmark.
    - **Reject Button**: `h-11 min-h-[44px]` secondary neutral button with cross.
  - When `status === 'approved'` or `'rejected'`:
    - Buttons are replaced with a persistent resolution banner displaying reviewer name and timestamp.

---

## 6. Requirement 5: TypeScript Types Specification

The complete, type-checked definitions have been created in `proposed_terra.types.ts`:
- Core interfaces: `TerraContext`, `QuietCatchUpSummary`, `SummaryCitation`, `TerraDraftAction`, `DraftActionType`, `DraftActionStatus`.
- Domain payloads: `CreatePollPayload`, `CreateExpeditionPayload`, `ProposeTripDatePayload`, `UpdateChecklistPayload`, `AllocateGearPayload`, `SafetyAlertPayload`, `BroadcastRouteUpdatePayload`.
- Guard & validation functions:
  - `validateTerraContextBoundary(context, requestedConversationId)`
  - `isTerraEnabledInRoom(conversation)`
  - `formatCitationTag(citation)`
  - `parseCitationTag(tag)`
  - `extractCitationsFromText(text)`
  - `validateCitation(citation, messages)`
  - `verifySummaryCitations(summary, messages)`
  - `isActionDraft(action)`
  - `canExecuteAction(action)`
  - `approveDraftAction(action, reviewerId, reviewerName)`
  - `rejectDraftAction(action, reviewerId, reviewerName)`
  - `canUserReviewDraft(userRole, action)`

---

## 7. Artifacts Created & Ready for Implementation

| Proposed Artifact | Target Location | Description |
|-------------------|-----------------|-------------|
| `proposed_terra.types.ts` | `src/features/messaging/types/terra.types.ts` | Complete TypeScript domain types, interfaces, guards & citation verifiers |
| `proposed_terraService.ts` | `src/features/messaging/services/domain/terraService.ts` | Unread range calculation, deterministic summarization, citation verification, draft actions CRUD |
| `proposed_QuietCatchUpCard.tsx` | `src/features/messaging/components/QuietCatchUpCard.tsx` | Apple HIG card with clickable citation tags, unread range, and zero orange |
| `proposed_QuietCatchUpModal.tsx` | `src/features/messaging/components/QuietCatchUpModal.tsx` | Slide-up modal wrapper for Quiet Catch-Up |
| `proposed_TerraDraftActionCard.tsx` | `src/features/messaging/components/TerraDraftActionCard.tsx` | Stream-embedded card with 44px Approve & Reject buttons |

---

## 8. Verification & QA Roadmap for Milestone 4

The upcoming test suite `tests/messaging/terra-reputation-e2e.spec.ts` must validate:
1. **Context Isolation**:
   - Injection of messages from conversation B into conversation A's context triggers `TerraContextBleedError`.
   - `isTerraEnabledInRoom` correctly returns false when toggled off.
2. **Quiet Catch-Up & Citations**:
   - Correct unread range `[last_read_sequence + 1, last_sequence_number]`.
   - Every bullet matches `\[seq #\d+, @\w+\]`.
   - Rejection/flagging of hallucinated citations where sequence does not exist or author does not match.
3. **Draft Action Lifecycle**:
   - Draft creation guarantees `status: 'draft'`, `requiresConfirmation: true`.
   - `canExecuteAction` returns false on draft, true only after approval with reviewer ID.
   - Successful approval and rejection state transitions.
4. **UI Apple HIG Compliance**:
   - `renderToStaticMarkup` tests confirming `min-h-[44px]` on Approve and Reject buttons.
   - String check confirming zero instances of `#E4501C`.
