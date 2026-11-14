# DISPATCH Task: Explorer Lot 3 (Route Deletion, Zero Mock & Supabase SQL Cleanup)

## Context
Working directory: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`
State folder: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot3`
Scope document: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md`
Original request: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md`

## Mission
Investigate and design the complete technical specification for Lot 3:
1. **Deletion of 9 UI Pages + `/dev/*`**:
   - The 9 UI page folders to delete under `src/app/`:
     - `/planification`
     - `/heatmaps`
     - `/segments`
     - `/classements`
     - `/rankings`
     - `/live-segments`
     - `/accessibilite`
     - `/carbone`
     - `/pays/[code]`
   - And all `/dev/*` routes under `src/app/dev/`
   - **Crucial Rule**: Preserve intact all backend APIs (`src/app/api/*`) and library files (`src/lib/*`).
   - Identify all inbound links, imports, `routeRegistry.ts`, navigation items, tab bar destinations, or redirects pointing to these 9 deleted routes and `/dev/*`. List every file that references them and needs updating.
2. **Zero Mock & Real Data Cleanup**:
   - Inventory all occurrences of hardcoded mocks across the codebase:
     - `DEMO_*` constants
     - `_MOCK_*` constants
     - `CLUB_PRESETS`
     - `Mathieu Chevrier`
     - Fake stories (Dolomites, GR20, etc.)
     - Hardcoded Alpes/Écrins fake data
     - `/assets/images/no_image.png`
   - Formulate replacement strategies: real database queries, real calculations, or graceful empty states when no data is present.
3. **Supabase SQL Cleanup on `icxyvwzfjbflcbqukpfz` (`lekitduvoyageur2`)**:
   - **MANDATORY HARD CONSTRAINT**: DO NOT DELETE OR BREAK the official demo account used on `/connexion` (`/api/demo-login`) with UID `d5451f35-db9f-4575-9114-6d3b79550bbc` (`demo@lkdv.app`). Its profile and login must remain 100% operational.
   - Inspect the database tables on `icxyvwzfjbflcbqukpfz` using the Supabase MCP tools.
   - Formulate exact targeted SQL `DELETE` / `UPDATE` statements to purge parasitic test accounts and fake data:
     - Test accounts (`ergre`, `Jdjdjd`, `Bdjdjdjd`, `traytest_*`, secondary test accounts)
     - Test clubs (`Judisid`, fake clubs)
     - Demo events (`Soirée Népal`, `Rencontre vanlife`, `Rencontre Japon`)
     - Fake `CC0` posts
   - Check foreign key cascades and constraints so the SQL statements execute cleanly without constraint violations.

Write your complete exploration report to `handoff.md` in your state folder and send a completion message back.


## 2026-11-14T00:07:59Z
Explore Lot 3: Route Deletion (9 UI pages + /dev/*), Zero Mock cleanup, and Supabase SQL targeted purge.
Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot3
Scope document: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
Original user request: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
Task dispatch details: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot3/DISPATCH.md
