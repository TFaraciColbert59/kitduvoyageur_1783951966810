# SDD ledger — plan: implementation_plan.md (Shell Mobile LKDV stabilisation)

MERGE_BASE: b8037951377560f49622c6bc7c7a8d3146e4d02a

## Pre-flight conflict scan

| Tasks | Shared file / interface | Finding |
|---|---|---|
| T1 / T2 | `CountryGlobe.tsx` | T1 modifies it; T2 doesn't touch it. Clean. |
| T1 / T6 | `pays/loading.tsx` | T1 fixes the globe component; T6 verifies loading.tsx wraps a shell. Both independent. Clean. |
| T2 / T4 | `MobilePageShell` props | T2 adds JSDoc to the prop; T4 creates AppShell with the same prop surface. Both can coexist — T2 enriches MobilePageShell, T4 creates a parallel component. Clean. |
| T4 / T5 | `AppShell.tsx` | T5 imports what T4 produces. Sequential dependency — execute T4 first. ✓ |
| T3 / T8 | `playwright.config.ts` | T3 rewrites it for `tests/visual/`; T8 adds a CI workflow that calls `npx playwright test`. Sequential dependency — T3 before T8. ✓ |
| T7 / all | `eslint.config.mjs` | T7 creates this file from scratch. No other task touches ESLint. Clean. |

**Scan ruling:** All conflicts are sequential dependencies already ordered in the plan. No contradictions found. Proceeding.

## Progress

- [x] Task 1 — GeoJSON local (commits b803795..25cf00f, review clean)
- [x] Task 2 — safeTop=false documentation (commits 25cf00f..a9b8e92, review clean)
- [x] Task 3 — Playwright visual tests (commits a9b8e92..03ef674, review clean)
- [x] Task 4 — AppShell component (commits 03ef674..6a07b8f, review clean)
- [x] Task 5 — Migrate /ambassadeurs to AppShell (commits 6a07b8f..567a931, review clean)
- [x] Task 6 — loading.tsx audit — no changes needed (commit 64c2195, review clean)
- [x] Task 7 — ESLint safe-area rule (commit ff5ec60, review clean) — 135 warnings on existing code, 0 errors
- [x] Task 8 — CI visual regression workflow (commit 3cf6b00, review clean)

## Out-of-scope commits (cosmetic, by implementers)
- 6ede3f7: map button calibration (ExplorerMap/InteractiveMap)
- 508fabc: remove opaque bg styles on map controls
- 74aedfa: liquid glass gloss amplification

## Final review
- Dispatched on pro model — awaiting verdict
