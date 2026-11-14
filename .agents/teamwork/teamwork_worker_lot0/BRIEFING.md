# BRIEFING — 2026-11-13T20:49:00Z

## Mission
Complete Lot 0 — Unblocking & Prerequisites: fix iOS SPM path, TripCard import, SheetContent weather typing, messagingService typing, test compte-profile-visibility, tokens.css z-index & glass-rim, and status-bar style. Verify with vitest & tsc.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot0
- Original parent: f5b12d51-f943-4c09-a4eb-05cb349cbcf9
- Milestone: Lot 0 — Unblocking & Prerequisites

## 🔒 Key Constraints
- Exclusively own and modify:
  1. `ios/App/CapApp-SPM/Package.swift`
  2. `src/features/compas/v5/TripCard.tsx`
  3. `src/features/explorer-v2/sheet/SheetContent.tsx`
  4. `src/features/messaging/services/messagingService.ts`
  5. `tests/design/compte-profile-visibility.spec.ts`
  6. `src/styles/tokens.css`
  7. `src/lib/native/status-bar.ts` & `capacitor.config.ts`
- Integrity mandate: No cheating, no hardcoding test outputs, genuine implementation.
- Required verifications:
  1. `npx vitest run tests/design/compte-profile-visibility.spec.ts` -> pass
  2. `npx vitest run tests/design/` -> pass 494/494
  3. `npx tsc --noEmit` -> pass 0 errors

## Current Parent
- Conversation ID: f5b12d51-f943-4c09-a4eb-05cb349cbcf9
- Updated: 2026-11-13T20:49:00Z

## Task Summary
- **What to build**: Fix build blockers, typing errors, design token collisions, and test assertion.
- **Success criteria**: All 3 test/typecheck commands pass cleanly; handoff written.
- **Interface contracts**: PROJECT.md
- **Code layout**: PROJECT.md

## Change Tracker
- **Files modified**:
  - `ios/App/CapApp-SPM/Package.swift`: Reverted Capacitor SPM dependencies path to `../../../node_modules/@capacitor/*`.
  - `src/features/compas/v5/TripCard.tsx`: Added `formatKm` import from `../engine/format`.
  - `src/features/explorer-v2/sheet/SheetContent.tsx`: Safely handled weather data, falling back to `ctx.weather?.hours?.[0]`.
  - `src/features/messaging/services/messagingService.ts`: Fixed typing on `avatar_url` (empty string fallback) and `status` (`Conversation['status']`).
  - `tests/design/compte-profile-visibility.spec.ts`: Checked `.select('signature_visibility')` in either `accountBootstrap.ts` or `accountSignatureVisibility.ts`.
  - `src/styles/tokens.css`: Set `--z-modal: 600;`, separated `--glass-rim-color` (`rgba(23, 43, 36, 0.14)`) and `--glass-rim-shadow` (`0 0 0 0.5px rgba(23, 43, 36, 0.14)`), mapped `--glass-rim` to `--glass-rim-color`.
  - `src/lib/native/status-bar.ts` & `capacitor.config.ts`: Set default status bar style to `Style.Light` (`dark: false` / `style: "LIGHT"`) for dark ink on `#FBFAF6` canvas.
- **Build status**: `npx tsc --noEmit` PASSED (0 errors). `vitest tests/design/` PASSED (494/494).
- **Pending issues**: None.

## Quality Status
- **Build/test result**:
  - `npx vitest run tests/design/compte-profile-visibility.spec.ts`: 14 passed / 14
  - `npx vitest run tests/design/`: 494 passed / 494 across 45 files
  - `npx tsc --noEmit`: 0 errors
- **Lint status**: No violations introduced
- **Tests added/modified**: Updated assertion in `tests/design/compte-profile-visibility.spec.ts:251` to support modularized signature visibility code.

## Loaded Skills
- None

## Key Decisions Made
- Mapped `--glass-rim` to `var(--glass-rim-color)` so all components using it as border color obtain valid CSS color `rgba(23, 43, 36, 0.14)`.
- Derived Explorer V2 conditions weather safely from `ctx.weather?.hours?.[0]` with fallback to direct text when unavailable.

## Artifact Index
- DISPATCH.md — assignment details
- BRIEFING.md — working memory
- progress.md — liveness heartbeat
- handoff.md — 5-component handoff report
