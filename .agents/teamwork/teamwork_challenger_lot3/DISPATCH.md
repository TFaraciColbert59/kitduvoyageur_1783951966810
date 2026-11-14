# DISPATCH: Lot 3 Adversarial Challenge

## Mission
Adversarially challenge and stress-test the work completed in Lot 3 (Route Deletion, Zero Mock Cleanup & Supabase SQL Purge):
1. **Route Deletion & Navigation Stress**:
   - Check if any component, test, or config still attempts to import or route to deleted pages (`planification`, `heatmaps`, `segments`, `classements`, `rankings`, `live-segments`, `accessibilite`, `carbone`, `pays`, `dev`).
   - Verify that all backend API endpoints (`/api/heatmaps/*`, `/api/segments/*`, `/api/live-segments/*`, `/api/rankings/*`, `/api/pays/*`, `/api/dev/*`) are still fully functional and covered by tests.
2. **Obsolete Primitives Eradication**:
   - Grep the entire repository for `GlassSubCard`, `GlassPill`, `GlassCapsuleBtn`. Ensure 0 dead references exist.
3. **Zero Mock Adversarial Audit**:
   - Inspect `ClubLiquidGlassV8.tsx` and `CompteLiquidGlassV8.tsx` for hardcoded mock objects, demo stories, fake stats, or fake club presets.
   - Verify `checkout/page.tsx` for credit card strings or bogus shipping logic.
   - Check `publicProfilePayload.ts` for dynamic metric calculations.
   - Verify that demo auth (`demo@lkdv.app`, `/api/demo-login`) remains 100% operational.
4. **Supabase Integrity Stress Test**:
   - Query project `icxyvwzfjbflcbqukpfz` to confirm:
     - Demo account `d5451f35-db9f-4575-9114-6d3b79550bbc` exists in `auth.users` and `public.user_profiles`.
     - Test club `Judisid`, test posts, test carnets, and parasitic accounts are gone.
     - Foreign key integrity is intact (0 broken references).
5. Run tests:
   - `npx vitest run tests/design/`
   - `npx vitest run src/app/api/`
   - `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`
6. Write `handoff.md` with verdict: APPROVE or REQUEST_CHANGES.

## Authoritative Inputs
- `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md`
- `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot3/handoff.md`

## State & Working Directory
- Working Directory: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`
- State Folder: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot3`


## 2026-11-14T00:50:53Z
You are challenger_lot3. Your mission is to adversarially challenge and stress-test the work of Lot 3 (Route Deletion, Zero Mock Cleanup & Supabase SQL Purge).

Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot3

Before starting, read:
1. /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
3. /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot3/handoff.md
4. /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot3/DISPATCH.md
