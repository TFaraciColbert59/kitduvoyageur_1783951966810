# BRIEFING — 2026-11-13T20:07:00Z

## Mission
Investigate test failures and token discrepancies for Lot 0 (compte-profile-visibility failure at line 251, light-only mode token conflicts in p5-direction-tokens and tokens-sync, tokens.css, status-bar.ts, --z-modal, --glass-rim).

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: Read-only investigator, synthesis
- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_survey_2
- Original parent: f5b12d51-f943-4c09-a4eb-05cb349cbcf9
- Milestone: Lot 0 Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / modify source code directly
- Deliver findings in handoff.md, progress.md, and notify parent via send_message

## Current Parent
- Conversation ID: f5b12d51-f943-4c09-a4eb-05cb349cbcf9
- Updated: 2026-11-13T20:07:00Z

## Investigation State
- **Explored paths**:
  - `tests/design/compte-profile-visibility.spec.ts`
  - `tests/design/p5-direction-tokens.spec.ts`
  - `tests/design/tokens-sync.spec.ts`
  - `src/features/compte/data/accountBootstrap.ts`
  - `src/features/compte/data/accountSignatureVisibility.ts`
  - `src/styles/tokens.css`
  - `src/lib/native/status-bar.ts`
  - `capacitor.config.ts`
  - Supabase `icxyvwzfjbflcbqukpfz` `auth.users`, `user_profiles`, `hike_sessions`
- **Key findings**:
  1. `compte-profile-visibility.spec.ts:251` fails because `persistSignatureVisibility` was extracted into `accountSignatureVisibility.ts` in commit `10a71a0cce3c`. Only 1 failure out of 494 tests in `tests/design/`.
  2. `p5-direction-tokens.spec.ts` expects `.dark {` block and dark mode setup, conflicting with 100% Light-only mode.
  3. `status-bar.ts` passes `Style.Dark` (white icons on light canvas), inverted on iOS/Android.
  4. `--z-modal: 55` is behind `--z-tabbar: 300` and `--z-sheet: 500`. Needs `--z-modal: 600`.
  5. `--glass-rim` overwritten with box-shadow at `tokens.css:785`, breaking `border-[color:var(--glass-rim)]`.
  6. Official demo account UID identified as `d5451f35-db9f-4575-9114-6d3b79550bbc` (`demo@lkdv.app`, Léa Fontaine).
- **Unexplored areas**: None for Lot 0 scope.

## Key Decisions Made
- All findings and exact remediation code snippets documented in `handoff.md`.

## Artifact Index
- `DISPATCH.md` — incoming instructions log
- `BRIEFING.md` — persistent working memory
- `progress.md` — liveness heartbeat
- `handoff.md` — 5-component handoff report
