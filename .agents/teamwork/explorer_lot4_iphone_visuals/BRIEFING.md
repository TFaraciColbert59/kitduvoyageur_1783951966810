# BRIEFING — 2026-11-14T05:15:00Z

## Mission
Map and analyze all iPhone 16 Pro visual defects across Hub, Kit Studio, Explorer/Compas, Communauté, Messages, Carnet, Checkout, 404, and CookieConsentBanner, producing an exact, line-by-line fix strategy for worker_lot4_iphone_visuals.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: iPhone Visuals Explorer
- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/explorer_lot4_iphone_visuals
- Original parent: 48fe28d6-f315-49ec-9bda-5e88ceee1746
- Milestone: Lot 4 - iPhone 16 Pro Visual Polish across Remaining Screens

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Exact file paths, line numbers, CSS rules, JSX snippets, and precise proposed fixes
- Self-contained handoff.md with 5 components: Observation, Logic Chain, Caveats, Conclusion, Verification Method

## Current Parent
- Conversation ID: 48fe28d6-f315-49ec-9bda-5e88ceee1746
- Updated: 2026-11-14T05:15:00Z

## Investigation State
- **Explored paths**:
  - Area 1: `src/features/hub/components/HubCampShell.tsx`, `hub-camp-option3.css`, `HubGearDrawer.tsx`, `HubBudgetDrawer.tsx`, `ReservationsOverview.tsx`
  - Area 2: `src/app/kit-studio/page.tsx`, `kit-studio.css`, `getStudioData.ts`, `domain/catalog.ts`, `ItemSheet.tsx`, `glyphs.generated.ts`
  - Area 3: `src/features/explorer-v2/sheet/ExplorerSheet.tsx`, `SheetContent.tsx`, `compas/v5/map/map.css`, `compas/v5/v5.css`, `CarnetDrawerV2.tsx`
  - Area 4: `src/features/community/v2/shared/CommunitySheetShell.tsx`, `communaute-v2-shell.css`, `CommunityFeedTopBar.tsx`, `community-feed.css`, `account-glass.css`, `SearchPane.tsx`, `EventsPane.tsx`, `SegmentedControl.tsx`, `EventDetailClient.tsx`, `sorties/[id]/page.tsx`
  - Area 5: `src/components/messaging/MessagesScreen.tsx`, `messages-grammar.css`, `messagesModel.ts`, `useConversations.ts`
  - Area 6: `src/components/carnet/v2/CarnetScreenV2.tsx`, `CarnetCardV2.tsx`, `CarnetDrawerV2.tsx`, `carnet-v2.css`, `place.ts`, `CompteMapHud.tsx`, `compte-map.css`, `src/app/not-found.tsx`, `src/components/CookieConsentBanner.tsx`, `src/app/checkout/page.tsx`
- **Key findings**: Complete line-by-line defects catalogued across all 6 areas with exact root causes and proposed diffs.
- **Unexplored areas**: None, all requested areas covered.

## Key Decisions Made
- Root causes isolated at CSS/JSX levels to avoid touching backend or database models.
- Replaced dark cards and obsolete `--glass-label` with canonical Light Liquid Glass bank tokens (`#172B24`, `#226148`, `#F0F5EE`).
- Preserved existing data contracts and tests while ensuring flawless iPhone 16 Pro native and web rendering.

## Artifact Index
- `DISPATCH.md` — incoming mission dispatch
- `BRIEFING.md` — persistent working memory
- `progress.md` — liveness heartbeat
- `handoff.md` — comprehensive final report with 5 components
