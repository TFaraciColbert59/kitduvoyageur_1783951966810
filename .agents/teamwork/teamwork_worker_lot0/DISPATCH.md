# Worker Lot 0 Dispatch
State folder for Worker Lot 0.


## 2026-11-13T20:39:41Z
MANDATORY: Read /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md before starting work.
Also read /Users/fr168256/.gemini/antigravity/brain/25ed2e40-8086-4101-9dbd-3687f6e94b76/implementation_plan.md and /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md.

Read the explorer handoffs:
- .agents/teamwork/teamwork_explorer_survey_1/handoff.md
- .agents/teamwork/teamwork_explorer_survey_2/handoff.md
- .agents/teamwork/teamwork_explorer_survey_3_gen1/handoff.md

State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot0
Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Milestone: Lot 0 — Unblocking & Prerequisites
You exclusively own and modify the following files:
1. `ios/App/CapApp-SPM/Package.swift`: Revert path to `../../../node_modules/@capacitor/*` (was pointing to non-existent `../../../../lkdv-p01-social/node_modules/@capacitor/*`).
2. `src/features/compas/v5/TripCard.tsx`: Fix missing import `formatKm` from `../engine/format`.
3. `src/features/explorer-v2/sheet/SheetContent.tsx`: Fix `ctx.weather?.current` access on `WeatherResponse` safely.
4. `src/features/messaging/services/messagingService.ts`: Fix TypeScript typing on lines 504 and 576 (`avatar_url` and `status`).
5. `tests/design/compte-profile-visibility.spec.ts`: Fix test at line 251 so it checks that `.select('signature_visibility')` is present in either `accountBootstrap.ts` or `accountSignatureVisibility.ts` (where it was modularized in commit 10a71a0cce3c).
6. `src/styles/tokens.css`:
   - Set `--z-modal: 600;` (in 100-step scale above sheet 500, below alert 700).
   - Fix `--glass-rim` collision: ensure `--glass-rim-color: rgba(23, 43, 36, 0.14)` and `--glass-rim-shadow: 0 0 0 0.5px rgba(23, 43, 36, 0.14)`, and clean up where `--glass-rim` was used as a border color.
7. `src/lib/native/status-bar.ts` & `capacitor.config.ts`:
   - Set default status bar style to `Style.Light` (encres sombres / icônes foncées pour fond clair).

Required verifications to execute:
1. `npx vitest run tests/design/compte-profile-visibility.spec.ts` -> must pass!
2. `npx vitest run tests/design/` -> must pass 494/494!
3. `npx tsc --noEmit` -> must pass with 0 errors!

Document all changes and test outputs in `handoff.md` in your state folder. Send a completion message back.
