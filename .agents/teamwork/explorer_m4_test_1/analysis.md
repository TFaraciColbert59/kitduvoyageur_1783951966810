# Analysis: Test Architecture & E2E QA Acceptance Suite for Milestone 4 (R4)
**Author**: `explorer_m4_test_1`  
**Date**: 2026-10-04  
**Working Directory**: `.agents/teamwork/explorer_m4_test_1/`  
**Test Suite**: `proposed_terra-reputation-e2e.spec.ts`

---

## 1. Executive Summary & Scope

Milestone 4 (R4) represents the intelligence and gamification layer of LKDV Social. It bridges real-time messaging with human-supervised AI assistance (**Terra AI**) and anti-spam community recognition (**Reciprocal Utility Reputation & Collective Adventure Streaks**).

As the Test Architecture & E2E QA Acceptance Explorer for Milestone 4, we have designed, specified, and empirically validated the end-to-end Vitest test suite (`proposed_terra-reputation-e2e.spec.ts`), comprising **60 automated tests across 6 dedicated suites**. All 60 tests execute in **28ms** with a 100% pass rate.

### Six Core Pillars Tested:
1. **Terra AI Context Isolation & Room Governance**: Hermetic boundary enforcement per `conversation_id`, rejection of cross-room prompt leaks, and role-based permissions (`owner`, `admin`, `guide`) for toggling assistant capabilities.
2. **Quiet Catch-Up Summary Engine**: Unread sequence window calculation (`> last_read_sequence`), mandatory source citations matching regex `/\[seq #\d+, @\w+\]/`, verifiable anchor matching against actual message senders, and strict rejection of hallucinated/phantom sequences.
3. **Draft Action Engine**: Complete blockage of unilateral state mutations (`status: 'draft'`, `requiresConfirmation: true`), formal state machine transitions (`'draft' -> 'approved' | 'rejected'`), immutability of terminal states, and role authorization gates.
4. **Reciprocal Utility Reputation Points**: Fundamental anti-spam invariant (raw chat text, media, reactions yield strictly 0 points), point attributions for verified outdoor actions (GPX +25, Checklist +10, Pack Merge +15, Field Check-in +15, Safety Alert +30, Expedition +50), idempotency deduplication, and contributor tier classifications.
5. **Collective Adventure Streaks**: Multi-user team outing invariant (`participants.length >= 2`), completed status requirement, consecutive monthly cadence, 45-day grace period tracking, and team subset validation.
6. **UI Rendering & Apple HIG Ergonomics**: Synchronous zero-fetch rendering (`fetch` spy = 0), strict touch target compliance (`min-h-[44px]`), semantic accessibility, and complete elimination of legacy orange `#E4501C`.

---

## 2. Invariants & Contract Specifications

| Domain | Invariant | Specification & Enforced Behavior |
|---|---|---|
| **Terra Context** | **Hermetic Isolation** | Queries for conversation $A$ filter strictly by `conversation_id = A`. Any query hint referencing foreign conversation IDs triggers leak blocking counter and sanitization. |
| **Terra Governance** | **Privileged Toggle** | In clubs and expedition rooms, only `owner`, `admin`, or `guide` can enable/disable Terra. Regular `member` and `safety` roles receive `INSUFFICIENT_PERMISSIONS`. In DMs, either peer can toggle. |
| **Quiet Catch-Up** | **Sequence Bounded** | Unread range starts strictly at $\max(0, \text{last\_read\_sequence}) + 1$ up to $\text{last\_sequence\_number}$. If member is up-to-date, `unreadCount = 0` and `isCaughtUp = true`. |
| **Quiet Catch-Up** | **Verifiable Citation** | Every bullet point must contain $\ge 1$ citation matching `/\[seq #(\d+), @(\w+)\]/`. Every cited sequence must exist in the unread window, and the cited author handle must strictly match the sender of that sequence. Hallucinations or phantom sequences cause immediate summary rejection. |
| **Draft Action Engine** | **Zero Unilateral Mutation** | Suggestions created by Terra are instantiated with `status: 'draft'`, `requiresConfirmation: true`, `reviewed_by: null`. Calling execution methods while in `'draft'` state throws `UNILATERAL_EXECUTION_BLOCKED`. |
| **Draft Action Engine** | **Terminal Immutability** | An approved action cannot be rejected or re-approved. A rejected action cannot be approved. High-privilege actions (expedition, safety alert) enforce reviewer outdoor role checks. |
| **Reputation Points** | **Anti-Spam Baseline** | Plain text chat messages (`CHAT_MESSAGE`), audio messages, attachments, and emoji reactions yield strictly $0$ reputation points, regardless of volume. |
| **Reputation Points** | **Verifiable Outdoor Utility** | Points awarded strictly for verified outdoor utility: `GPX_TRACK_SHARED` (+25), `CHECKLIST_ITEM_COMPLETED` (+10), `PACK_MERGE_CONFIRMED` (+15), `FIELD_CHECKIN_SUBMITTED` (+15), `SAFETY_ALERT_VERIFIED` (+30), `COMPLETED_COLLECTIVE_EXPEDITION` (+50). |
| **Reputation Points** | **Idempotent Claim** | Re-submitting an already processed event ID awards $0$ additional points and returns `isDuplicate: true`. |
| **Adventure Streaks** | **Collective Invariant** | Outings with $< 2$ team members yield $0$ team streak. Solo hikes never increment team streaks. Outings with status $\ne$ `'completed'` are excluded. |
| **Adventure Streaks** | **Cadence & Grace Window** | Maximum interval between consecutive outings is 45 days. Gaps $> 45$ days break current streak (reset to 1 or 0), while preserving historical `longestStreak`. |
| **UI Ergonomics** | **Zero Orange #E4501C** | Rendered static HTML must not match `/#e4501c/i` nor contain `orange-500` or orange Tailwind color tokens. Palette relies on emerald, slate, stone, zinc, and sand. |
| **UI Ergonomics** | **Apple HIG Touch Target** | Every interactive button, chip, and trigger has `min-h-[44px]` and `min-w-[44px]`. |
| **UI Ergonomics** | **Zero Network Fetch** | Synchronous rendering without runtime asynchronous waterfalls (`global.fetch` called 0 times). |

---

## 3. Test Suite Structure & Matrix (60 Tests)

The test suite in `proposed_terra-reputation-e2e.spec.ts` is divided into 6 distinct suites:

### Suite 1: Terra AI Context Isolation & Room Governance (6 tests)
- `TEST-TERRA-ISO-01`: Context query for room-alpha strictly rejects room-beta messages.
- `TEST-TERRA-ISO-02`: Adversarial cross-room query injection detected and sanitized.
- `TEST-TERRA-ISO-03`: Room-level toggle disabled blocks context generation (`isTerraEnabled: false`).
- `TEST-TERRA-ISO-04`: Non-privileged roles (`member`, `safety`) cannot toggle Terra in club/expedition rooms.
- `TEST-TERRA-ISO-05`: Direct message conversations permit peer toggling.
- `TEST-TERRA-ISO-06`: Unknown conversation ID returns empty context without throwing.

### Suite 2: Quiet Catch-Up Summary Engine & Citation Verification (10 tests)
- `TEST-CATCHUP-RANGE-01`: Correctly bounds unread range above `last_read_sequence`.
- `TEST-CATCHUP-RANGE-02`: Returns caught-up state when member is up to date (`unreadCount: 0`).
- `TEST-CATCHUP-RANGE-03`: Negative or 0 `last_read_sequence` defaults safely to sequence 1.
- `TEST-CATCHUP-CITE-01`: Citation regex extracts valid citations `[seq #N, @author]`.
- `TEST-CATCHUP-VALID-01`: Valid summary with verifiable citations is accepted.
- `TEST-CATCHUP-REJECT-01`: Rejects summary bullet missing mandatory citation.
- `TEST-CATCHUP-REJECT-02`: Rejects phantom sequence number outside unread range.
- `TEST-CATCHUP-REJECT-03`: Rejects author mismatch on cited sequence.
- `TEST-CATCHUP-EDGE-01`: Bullet with multiple citations where one is invalid is rejected.
- `TEST-CATCHUP-EDGE-02`: Handles author handles with underscores and numbers (e.g. `@alex_honnold_99`).
- `TEST-CATCHUP-EDGE-03`: Summary citing past already-read message outside unread window is rejected.

### Suite 3: Draft Action Engine & State Transitions (9 tests)
- `TEST-DRAFT-SAFETY-01`: Terra suggestions created strictly as draft with `requiresConfirmation: true`.
- `TEST-DRAFT-SAFETY-02`: Unilateral execution of unconfirmed draft is strictly blocked.
- `TEST-DRAFT-TRANS-01`: Human approval transitions draft to `'approved'` with reviewer stamp.
- `TEST-DRAFT-TRANS-02`: Human rejection transitions draft to `'rejected'`.
- `TEST-DRAFT-TRANS-03`: Terminal state immutability blocks re-review of approved actions.
- `TEST-DRAFT-ROLE-01`: Regular member cannot approve high-privilege expedition or safety draft.
- `TEST-DRAFT-ROLE-02`: Safety role can approve `safety_alert` draft but cannot approve `create_expedition`.
- `TEST-DRAFT-ACTION-TYPES-01`: Verified creation of all 4 distinct draft action types.
- `TEST-DRAFT-EDGE-01`: Reviewing non-existent draft ID returns `DRAFT_NOT_FOUND`.

### Suite 4: Reciprocal Utility Reputation Points Engine (11 tests)
- `TEST-REP-CHAT-01`: Raw chat messages yield strictly 0 reputation points.
- `TEST-REP-CHAT-02`: High volume raw chat spam (50 messages) still yields strictly 0 points.
- `TEST-REP-UTIL-01`: `GPX_TRACK_SHARED` awards +25 points.
- `TEST-REP-UTIL-02`: `CHECKLIST_ITEM_COMPLETED` awards +10 points.
- `TEST-REP-UTIL-03`: `PACK_MERGE_CONFIRMED` awards +15 points.
- `TEST-REP-UTIL-04`: `FIELD_CHECKIN_SUBMITTED` awards +15 points.
- `TEST-REP-UTIL-05`: `SAFETY_ALERT_VERIFIED` awards +30 points.
- `TEST-REP-UTIL-06`: `COMPLETED_COLLECTIVE_EXPEDITION` awards +50 points.
- `TEST-REP-FRAUD-01`: Duplicate event claim is rejected (idempotency guard).
- `TEST-REP-TIER-01`: Computes contributor tiers across thresholds (0-99 Explorer, 100-249 Trailblazer, 250-499 Pathfinder, 500+ Expedition Master).
- `TEST-REP-NON-CHAT-01`: System messages, reactions, and attachments yield strictly 0 utility points.
- `TEST-REP-TIER-02`: Monotonicity invariant: points always preserve or increase tier progression.
- `TEST-REP-BATCH-01`: Multiple users contributing simultaneously maintain isolated point balances.

### Suite 5: Collective Adventure Streaks Engine (7 tests)
- `TEST-STREAK-MULTI-01`: Solo outings (< 2 members) strictly yield 0 streak.
- `TEST-STREAK-STATUS-01`: Non-completed outings do not count towards streak.
- `TEST-STREAK-CADENCE-01`: Consecutive monthly outings increment streak.
- `TEST-STREAK-CADENCE-02`: Gap greater than 45 days breaks streak run but retains longest streak.
- `TEST-STREAK-CADENCE-03`: Long inactivity (> 45 days since last trip) marks streak as inactive (0).
- `TEST-STREAK-SUBSET-01`: 3-member team streak strictly requires all 3 members on each expedition.
- `TEST-STREAK-BOUNDARY-01`: Boundary check: exactly 45 days is active, 46 days is expired.
- `TEST-STREAK-EMPTY-01`: Empty expeditions list handled gracefully.

### Suite 6: UI Rendering & Apple HIG Ergonomics (13 tests)
- `TEST-UI-CATCHUP-01`: `QuietCatchUpCard` renders citations, unread count, and dismiss button.
- `TEST-UI-CATCHUP-02`: `QuietCatchUpCard` enforces Apple HIG 44px minimum touch targets.
- `TEST-UI-CATCHUP-03`: `QuietCatchUpCard` contains ZERO orange `#E4501C`.
- `TEST-UI-DRAFT-01`: `TerraDraftActionCard` renders draft badge, action preview, and Approve/Reject buttons.
- `TEST-UI-DRAFT-02`: `TerraDraftActionCard` buttons enforce Apple HIG 44px touch targets.
- `TEST-UI-DRAFT-03`: `TerraDraftActionCard` contains ZERO orange `#E4501C`.
- `TEST-UI-REP-01`: `ReputationBadge` renders contributor tier and points.
- `TEST-UI-REP-02`: `ReputationBadge` contains ZERO orange `#E4501C`.
- `TEST-UI-STREAK-01`: `AdventureStreakBanner` renders flame icon and streak count.
- `TEST-UI-STREAK-02`: `AdventureStreakBanner` contains ZERO orange `#E4501C`.
- `TEST-UI-ZERO-FETCH-01`: Zero-fetch rendering: `global.fetch` is called strictly 0 times across all components.
- `TEST-UI-A11Y-01`: All 4 components render appropriate semantic aria-labels or roles.
- `TEST-UI-TOUCH-ALL-01`: Every action button across components satisfies Apple HIG 44px min touch target.

---

## 4. Empirical Verification Results

Running the Vitest test runner over the proposed spec:
```bash
npx vitest run --config .agents/teamwork/explorer_m4_test_1/vitest.explorer.config.ts
```
**Results**:
- **Test Files**: 1 passed (1)
- **Tests**: 60 passed (60)
- **Duration**: 283ms (tests execute in 28ms)
- **Zero regressions**: All 11 existing test suites in `tests/messaging/` continue to pass (285/285 tests).

---

## 5. Implementer Guidance & Handoff Recommendations

For workers implementing M4 in production (`worker_m4_terra`, `worker_m4_reputation`):
1. **Database Schema**: Use the already migrated table `public.terra_drafted_actions` from `20261004120000_lkdv_social_core_architecture.sql`.
2. **Type Definitions**:
   - `src/features/messaging/types/terra.types.ts`: Implement `TerraContext`, `QuietCatchUpSummary`, `SummaryCitation`, `TerraDraftAction`, `DraftActionType`, `DraftActionStatus`.
   - `src/features/messaging/types/reputation.types.ts`: Implement `UtilityEventType`, `UtilityEvent`, `UserReputation`, `AdventureStreak`, `ReputationTier`.
3. **Domain Services**:
   - `src/features/messaging/services/domain/terraService.ts`: Implement `buildTerraContext`, `generateQuietCatchUpSummary`, `createDraftAction`, `reviewDraftAction`.
   - `src/features/messaging/services/domain/reputationService.ts`: Implement `awardPointsForEvent`, `getUserReputation`, `calculateTeamStreak`.
4. **UI Components**:
   - In `src/features/messaging/components/`: create `QuietCatchUpCard.tsx`, `TerraDraftActionCard.tsx`, `ReputationBadge.tsx`, `AdventureStreakBanner.tsx`. Ensure all interactive elements have `min-h-[44px]` and strictly NO orange `#E4501C`.
5. **Test Placement**:
   - Copy `proposed_terra-reputation-e2e.spec.ts` to `tests/messaging/terra-reputation-e2e.spec.ts` and link directly to production modules.
