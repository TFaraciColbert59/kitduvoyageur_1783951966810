# DISPATCH — Sub-Orchestrator for Milestone M2 (/messagerie Refactor & Audit Fixes)

## Role
Sub-orchestrator M2 (self)

## Mission
Execute Milestone M2 in complete autonomy: refactor `/messagerie` and its drawers according to Section 5 of the iPhone Audit Report (`audit_complet_iphone.md`), applying the LKDV Apple Design Tokens (pure green palette, no pure black #000000, no #0d1117 flash).

## Working Directory
`/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`

## State Folder
`/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/sub_orch_m2`

## Scope Document
`/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/sub_orch_m2/SCOPE.md`

## Required Inputs
- `ORIGINAL_REQUEST.md`: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
- `PROJECT.md`: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
- Complete iPhone Audit Report (Section 5): `/Users/fr168256/.gemini/antigravity/brain/25ed2e40-8086-4101-9dbd-3687f6e94b76/audit_complet_iphone.md`
- Baseline Screenshots: `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/audit-shots/05-messagerie/`
- Design Bank: `src/design/bank.ts`, `src/styles/tokens.generated.css`, `src/components/ui/Sheet.tsx`
- E2E Tests: `tests/e2e/runner.mjs`, `tests/e2e/tiers/tier1-features.spec.ts`

## Procedure (Project Pattern Iteration Loop 2B)
1. Initialize BRIEFING.md and progress.md in your state folder.
2. Spawn 3 Explorers / Spec Miners:
   - Explorer 1: Analyze `/messagerie` page layout, navigation leak (`router.push('/compte')`, notification bell Link), SubCapsuleTabs filter repositioning, and split view 40/60 collision.
   - Explorer 2: Analyze bottom sheets (`ComposerMenuSheet`, `ConversationOptionsSheet`) migration out of `AccountDrawerHost` to Apple bottom sheet, Demandes duplicate empty state, and NewConversationModal contrast/wiring.
   - Explorer 3: Analyze group chat realtime freeze (`markAsRead` background refresh), shared post embed graceful fallback, and reaction emoji overlay positioning.
3. Synthesize findings into `synthesis.md`.
4. Spawn Worker (`teamwork_worker`) with the mandatory integrity warning to implement all fixes across M2 files. Worker must run `npm run test:e2e:tiers` (or `node tests/e2e/runner.mjs`) and verify all 140 tests pass cleanly, plus existing vitest suites.
5. Spawn 2 Reviewers, 2 Challengers, and 1 Forensic Auditor (`teamwork_auditor`).
6. Evaluate Gate (auditor binary veto first, then reviewers and challengers).
7. Report completion and handoff to parent orchestrator (`32cf54d7-5444-42a8-a74f-e149116d26fb`).


## 2026-11-14T11:37:43Z
[Message from parent 32cf54d7-5444-42a8-a74f-e149116d26fb]
You are Sub-orchestrator for Milestone M2 (/messagerie Refactor & Drawers).
Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/sub_orch_m2
Parent conversation ID: 32cf54d7-5444-42a8-a74f-e149116d26fb

Execute Milestone M2 using the Project Pattern Iteration Loop 2B:
1. Initialize BRIEFING.md and progress.md.
2. Spawn 3 Explorers / Spec Miners to map all Section 5 fixes across M2 files.
3. Synthesize exploration reports in `synthesis.md`.
4. Spawn Worker (`teamwork_worker`) with mandatory integrity warning to implement all fixes.
5. Spawn 2 Reviewers, 2 Challengers, and 1 Forensic Auditor (`teamwork_auditor`).
6. Evaluate Gate in `GATE_STATUS.md`.
7. Once gate passes, write handoff.md and send completion message to parent.
