# BRIEFING — 2026-11-14T04:10:00Z

## Mission
Investigate existing profile and account implementations to establish a verified blueprint for unified Profile6040Shell.tsx and sub-surfaces.

## 🔒 My Identity
- Archetype: explorer
- Roles: Profile 60/40 Explorer
- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/explorer_lot4_profile
- Original parent: 48fe28d6-f315-49ec-9bda-5e88ceee1746
- Milestone: Lot 4 Profile 60/40 Exploration

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Zero mock highlights (no fake Dolomites, GR20...), real km / D+ aggregation
- Shared Profile6040Shell.tsx between /compte and /profil/[id]
- Fix drawer height (56dvh), double [x] button, ConsentSettingsSheet contrast, visibility drawer, map callout cutoff & banner overlap under TabBar

## Current Parent
- Conversation ID: 48fe28d6-f315-49ec-9bda-5e88ceee1746
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/app/compte/page.tsx` & `src/components/compte/MobileCompteV2.tsx`
  - `src/components/compte/CompteLiquidGlassV8.tsx` & `compte-liquid-glass-v8-runtime.js`
  - `src/app/profil/[id]/page.tsx` & `src/components/profile/PublicProfileV2.tsx`
  - `src/components/profile/publicProfilePayload.ts`
  - `src/components/compte/drawer/compte/ConsentSettingsSheet.tsx` & `compte-overlay.css`
  - `src/components/compte/drawer/compte/EditProfilePane.tsx` & `CompteDrawer.tsx`
  - `src/components/compte/map/CompteMapState.tsx`, `CompteMapCallout.tsx`, `compte-map.css`
  - `src/lib/supabase/queries-compte.ts` & `src/features/compte/data/accountBootstrap.ts`
  - `src/middleware.ts` & QA reference shots (`06-compte.png`, `10-compte-gerer.png`, `11-compte-edit.png`, `15-compte-mountain.png`, `16-compte-plus.png`, `17-compte-visibilite.png`)
- **Key findings**:
  - `_MOCK_HIGHLIGHTS` (Dolomites, Vercors, Lacs, GR20, Sac 780g) and `TONY_AVATAR` base64 hardcoded in `compte-liquid-glass-v8-runtime.js` (lines 411, 45).
  - Stats broken: `0 km · 0 k m D+` because `queries-compte.ts` queried `activities` instead of `hike_sessions`, completely omitted `elevation_gain_m`, and `publicProfilePayload.ts` left `outings: []` and unpopulated `yearMonths`.
  - `10-compte-gerer.png`: `ConsentSettingsSheet` inherits missing/white `--label` on white cards, rendering text completely invisible.
  - `11-compte-edit.png`: Double `[×]` button caused by `.lkdv-compte-edit-avatar-clear` absolute top-left on cover hero alongside `.lkdv-compte-edit-hero-tools` with remove cover `[×]`. Height clamped at 56dvh by `.sw-wrap[data-det="card"] .sheet { bottom: calc(31% + 46px) !important; }`.
  - `17-compte-visibilite.png`: Empty sheet opened because runtime `openOutingBulk` dispatched event without opening populated drawer, and demo/guest check aborted before setting items.
  - `06-compte.png`: Banner `"18 sortie(s)..."` overlapping under TabBar because `compte-map.css` applied `transform: none` on `top: 50%; left: 50%`, positioning top-left of card at center and pushing it directly under the TabBar.
  - `15-compte-mountain.png`: Empty dark green box on Sorties tab when no cover photo exists because `.voyage-info` has broken positioning/overflow within `.voyage-card`.
  - `/profil/[id]` lacks the 60/40 Liquid Glass split and the 3D map, while `/compte` has it.
- **Unexplored areas**: None, all items investigated down to line numbers.

## Key Decisions Made
- Architecture blueprint established for `Profile6040Shell.tsx` unifying `/compte` (owner) and `/profil/[id]` (visitor).
- Full blueprint with precise file paths, line numbers, and code diff instructions defined for Worker handoff.

## Artifact Index
- handoff.md — Comprehensive 5-component handoff report and implementation blueprint for Worker
