# DISPATCH: Lot 3 Implementation — Route Deletion, Zero Mock & Supabase Purge

## Mission
Execute Lot 3 of the LKDV Master Plan:
1. Delete the 20 UI files across the 10 target directories under `src/app/` (`planification`, `heatmaps`, `segments`, `classements`, `rankings`, `live-segments`, `accessibilite`, `carbone`, `pays`, `dev`). Strictly preserve all `src/app/api/*` and `src/lib/*` files.
2. Clean up inbound references in routing, middleware, sitemap, navigation, search, and maps. Remove the 3 obsolete primitives (`GlassSubCard`, `GlassPill`, `GlassCapsuleBtn`) and adapt single usage in `HubActivityHero.tsx` to `Button variant="glass"`.
3. Eliminate hardcoded mocks (`CLUB_PRESETS`, `DEMO_*` non-auth mocks, Unsplash fallbacks, fake Écrins/Alpes text in Hub drawers, checkout fake card, calculate real km/D+ in `publicProfilePayload.ts`).
   **MANDATORY**: Strictly preserve the official demo account constants (`DEMO_AUTO_LOGIN`, `DEMO_LOGIN_EMAIL`, `DEMO_LOGIN_PASSWORD` in `AuthContext.tsx`, `/api/demo-login`, etc.).
4. Execute the targeted Supabase SQL purge on project `icxyvwzfjbflcbqukpfz` using Supabase MCP `execute_sql`, preserving UID `d5451f35-db9f-4575-9114-6d3b79550bbc` (`demo@lkdv.app`).
5. Run full verification (`vitest`, `tsc --noEmit`, Supabase verification queries) and write `handoff.md`.

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Authoritative Inputs
- `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md`
- `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot3/handoff.md`

## State & Working Directory
- Working Directory: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`
- State Folder: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot3`


## 2026-11-14T00:21:49Z
Scope of work received from parent 59615597-1e96-4de1-9730-9299e1e6ef8c:
Lot 3 implementation: Route Deletion (20 UI files across 10 directories), Clean up inbound references, Zero Mock Cleanup (non-auth mocks, keep demo account intact), Targeted Supabase SQL Purge (on project icxyvwzfjbflcbqukpfz), Verification (vitest, tsc, sql checks).
