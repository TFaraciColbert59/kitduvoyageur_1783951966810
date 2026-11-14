# Dispatch: Sub-Orchestrator E2E Testing Track

- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/sub_orch_e2e
- Scope document: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md (E2E Track)
- ORIGINAL_REQUEST.md: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
- Baseline Audit Report: /Users/fr168256/.gemini/antigravity/brain/25ed2e40-8086-4101-9dbd-3687f6e94b76/audit_complet_iphone.md
- Spec report: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_spec_miner_survey_2/spec_messagerie_audit.md

## Scope & Objective
Deliver the E2E Testing Track per Project Pattern specifications:
1. Create `TEST_INFRA.md` at project root defining the 4-tier methodology:
   - Tier 1: Feature Coverage (>=5 per feature)
   - Tier 2: Boundary & Corner Cases (>=5 per feature)
   - Tier 3: Cross-Feature Combinations (pairwise coverage)
   - Tier 4: Real-World Application Scenarios (realistic use cases)
2. Design and implement comprehensive opaque-box test suites for the features in `PROJECT.md § Feature Inventory` (specifically the Apple Design System, tokens, `/messagerie` features, drawer sheets, empty states, and reactions).
3. Ensure runner passes and publish `TEST_READY.md` at project root with complete coverage matrix.

## Iteration Procedure (Iteration Loop 2B)
As sub-orchestrator, follow the Project Pattern procedure:
- Spawn Explorers / Test Writers (`teamwork_test_writer`).
- Review via Reviewers (`teamwork_reviewer`).
- Verify via Challengers (`teamwork_challenger`) and Forensic Auditor (`teamwork_auditor`).
- Publish `TEST_READY.md` once the E2E test suite is complete.


## 2026-11-14T10:41:11Z
You are the Sub-Orchestrator for the E2E Testing Track.
Your state folder is /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/sub_orch_e2e.
Working directory is /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference.
Read your task assignment in DISPATCH.md at /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/sub_orch_e2e/DISPATCH.md, PROJECT.md at /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md, and ORIGINAL_REQUEST.md at /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md.
Create TEST_INFRA.md at project root per the Project Pattern guidelines:
- 4-Tier test methodology (Tier 1: Feature Coverage, Tier 2: Boundary & Corner Cases, Tier 3: Cross-Feature Combinations, Tier 4: Real-World Scenarios).
Design and build the opaque-box test suites for the features in PROJECT.md.
Run your iteration loop with test writers (`teamwork_test_writer`), reviewers (`teamwork_reviewer`), challengers (`teamwork_challenger`), and forensic auditor (`teamwork_auditor`).
When complete and verified, publish TEST_READY.md at project root and send a completion message back to parent.
