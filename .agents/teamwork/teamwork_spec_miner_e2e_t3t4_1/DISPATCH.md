## 2026-11-14T10:43:34Z
You are teamwork_spec_miner assigned to design Tier 3 (Cross-Feature Combinations) and Tier 4 (Real-World Application Scenarios) test specifications for the E2E Testing Track.

Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
Your state folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_spec_miner_e2e_t3t4_1

MANDATORY: Read ORIGINAL_REQUEST.md before starting work:
/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md

Also read:
- PROJECT.md: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
- SCOPE.md: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/sub_orch_e2e/SCOPE.md
- Spec Report: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_spec_miner_survey_2/spec_messagerie_audit.md
- Baseline Audit: /Users/fr168256/.gemini/antigravity/brain/25ed2e40-8086-4101-9dbd-3687f6e94b76/audit_complet_iphone.md (Section 5)

Tasks:
1. Define comprehensive, concrete opaque-box test cases for Tier 3 (Cross-Feature Combinations):
   - At least 12 pairwise / multi-feature interaction test cases connecting features from PROJECT.md (F1 to F12).
   - Combinations such as:
     - Header navigation fix + SubCapsuleTabs filter switching
     - Split View resize + Bottom Sheet presentation (ComposerMenuSheet / ConversationOptionsSheet)
     - Group Chat Realtime refresh + Reaction Emoji Overlay Bar
     - Demandes empty state + NewConversationModal + LKDV Green Palette tokens
     - Shared Post Embed fallback + Inset Grouped design bank styling
     - Swift Design Tokens sync + CSS Custom Properties parity
2. Define comprehensive, concrete opaque-box test cases for Tier 4 (Real-World Scenarios):
   - At least 6 end-to-end realistic user workflows modeling iPhone 16 Pro (402×874 pt) viewport:
     - Scenario 1: Daily Messaging Flow (User opens /messagerie, browses conversations, sends message, reacts with emoji).
     - Scenario 2: Group Collaboration Flow (Opens group chat, views participant list, verifies no skeleton freeze, inspects attachment sheet).
     - Scenario 3: Request & Outreach Flow (Switches to Demandes tab, inspects single empty state, launches NewConversationModal).
     - Scenario 4: Split View Adjustment & Layout Stress (Drags msplit handle, verifies mpill pastille never collides by 44pt, checks top message padding).
     - Scenario 5: Bottom Sheet Complete Interaction (Opens ComposerMenuSheet from bottom y>=500, verifies all 5 options visible and padded, closes via backdrop/gesture).
     - Scenario 6: System Design Token & Dark-Avoidance Compliance (Full audit scan across rendered components, ensuring zero #000000 / #0d1117 and 100% Apple HIG compliance).
3. Write complete blueprint to handoff.md in your state folder.
4. Send a message to your parent orchestrator when complete.
