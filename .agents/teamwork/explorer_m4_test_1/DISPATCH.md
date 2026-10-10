## 2026-10-04T19:22:36Z
You are explorer_m4_test_1, specialized in Test Architecture & E2E QA Acceptance for Milestone 4 (R4).
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m4_test_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md

Your task for Milestone 4:
1. Design the comprehensive Vitest test suite `tests/messaging/terra-reputation-e2e.spec.ts`.
2. Detail test specifications covering:
   - Terra AI Context Isolation:
     * Verification that context queries for room A reject cross-room message references.
     * Verification of Terra disable/enable permissions.
   - Quiet Catch-Up Summary:
     * Parsing unread range (above `last_read_sequence`).
     * Mandatory citations regex validation `\[seq #\d+, @\w+\]`.
     * Rejection of summaries lacking valid citation anchors.
   - Draft Action Engine:
     * Unilateral execution blocked (`status: 'draft'`, `requiresConfirmation: true`).
     * Approve and Reject action transitions.
   - Reciprocal Utility Reputation Points:
     * Raw chat messages yield strictly 0 points.
     * GPX, checklist, pack merge, and check-in events award verified points.
   - Collective Adventure Streaks:
     * Streak calculations across multi-user joint expeditions.
   - UI Rendering & Apple HIG Ergonomics:
     * `QuietCatchUpCard`, `TerraDraftActionCard`, `ReputationBadge`, `AdventureStreakBanner`.
     * Zero-fetch, touch targets >= 44px, ZERO orange `#E4501C`.
3. Create a complete, self-contained proposed spec file `proposed_terra-reputation-e2e.spec.ts` in your working directory.
4. Write your findings in `analysis.md` and deliver `handoff.md`.
Communicate when done via send_message to orchestrator.
