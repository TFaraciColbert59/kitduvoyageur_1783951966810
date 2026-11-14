# BRIEFING — 2026-11-14T01:18:00Z

## Mission
Investigate and design complete technical specification for Lot 3: Route Deletion (9 UI pages + /dev/*), Zero Mock eradication, and Supabase SQL targeted purge.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot3
- Original parent: 59615597-1e96-4de1-9730-9299e1e6ef8c
- Milestone: Lot 3

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Preserve intact all backend APIs (src/app/api/*) and library files (src/lib/*)
- MANDATORY HARD CONSTRAINT: DO NOT DELETE OR BREAK official demo account demo@lkdv.app (UID d5451f35-db9f-4575-9114-6d3b79550bbc)
- Map all inbound references to the 9 UI pages and /dev/*
- Map all occurrences of hardcoded mocks: DEMO_*, _MOCK_*, CLUB_PRESETS, Mathieu Chevrier, fake stories, Alpes/Écrins fake data, no_image.png
- Inspect Supabase icxyvwzfjbflcbqukpfz and formulate exact targeted SQL script for parasitic test rows

## Current Parent
- Conversation ID: 59615597-1e96-4de1-9730-9299e1e6ef8c
- Updated: 2026-11-14T01:18:00Z

## Investigation State
- **Explored paths**:
  - `src/app/` (9 routes + `/dev/*`), `src/app/api/*`, `src/lib/*`
  - `src/middleware.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/constants/routeRegistry.json`
  - `src/components/mobile-nav/destinationRegistry.ts`, `src/components/mobile-nav/navigation/useNavigationPlateau.ts`
  - `src/components/ui/GlobalSearchModal.tsx`, `src/components/map/UnifiedExplorerMap.tsx`
  - `src/components/ui/` (`GlassSubCard.tsx`, `GlassPill.tsx`, `GlassCapsuleBtn.tsx`)
  - `src/features/hub/`, `src/features/kit-studio/`, `src/features/community/`, `src/features/messaging/`
  - `src/components/clubs/`, `src/components/compte/`, `src/components/profile/publicProfilePayload.ts`
  - Live Supabase project `icxyvwzfjbflcbqukpfz` (`auth.users`, `user_profiles`, `clubs`, `events`, `club_events`, `community_posts`, `carnets`)
- **Key findings**:
  - 20 UI files across 10 folders mapped for deletion (`src/app/api/*` and `src/lib/*` strictly preserved).
  - All inbound routing/navigation references mapped with exact line numbers.
  - Zero mock inventory complete: DEMO_* (distinguishing demo-login from UI mocks), _MOCK_*, CLUB_PRESETS, fake stories, fake Alpes/Écrins data, no_image.png.
  - Official demo user `demo@lkdv.app` (`Léa Fontaine`, UID `d5451f35-db9f-4575-9114-6d3b79550bbc`) verified and safeguarded.
  - Targeted SQL script validated via dry-run count queries: exactly 11 parasitic posts, 3 test carnets, 1 test club (`Judisid`), 4 demo events, 29 club events, and 42 parasitic accounts.
  - FK constraints analyzed: 0 RESTRICT constraints; all cascade or set null cleanly.
- **Unexplored areas**: None for Lot 3 exploration.

## Key Decisions Made
- Confirmed preservation of `src/app/api/*` and `src/lib/*` (backend endpoints used by native iOS/Android apps).
- Kept `DEMO_AUTO_LOGIN` / `DEMO_LOGIN_*` in `src/features/demo/*` and `src/app/api/demo-login/` for the official demo account.
- Designed targeted SQL migration with `WHERE id != 'd5451f35-db9f-4575-9114-6d3b79550bbc'` as a hard invariant.

## Artifact Index
- `.agents/teamwork/teamwork_explorer_lot3/DISPATCH.md` — Task definition
- `.agents/teamwork/teamwork_explorer_lot3/progress.md` — Liveness heartbeat
- `.agents/teamwork/teamwork_explorer_lot3/BRIEFING.md` — Persistent working memory
- `.agents/teamwork/teamwork_explorer_lot3/handoff.md` — Final exploration deliverable
