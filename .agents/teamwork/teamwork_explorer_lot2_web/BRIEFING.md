# BRIEFING — 2026-11-13T22:36:00Z

## Mission
Investigate and map out the unification of the 4 fragmented web primitives (Sheet/Drawer, SegmentedControl, DynamicIslandHost, Toast/Dialogs) in LKDV.

## 🔒 My Identity
- Archetype: explorer
- Roles: Web Primitives Unification Explorer
- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_web
- Original parent: 38f1fd31-f581-4b46-b0dd-5af01c98f20a
- Milestone: Lot 2 Web Primitives Unification Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / modify source code
- Produce 5-component handoff report (`handoff.md`)
- Adhere strictly to Teamwork file workspace conventions and system prompt protection

## Current Parent
- Conversation ID: 38f1fd31-f581-4b46-b0dd-5af01c98f20a
- Updated: 2026-11-13T22:36:00Z

## Investigation State
- **Explored paths**:
  - Competing drawer shells: `src/components/ui/Sheet.tsx`, `src/components/ui/drawer/DrawerShell.tsx`, `src/components/compte/drawer/shell/DrawerShell.tsx`, `src/components/carnet/v2/CarnetDrawerV2.tsx`, `src/components/compte/drawer/SlotShell.tsx`, `src/components/compte/drawer/sortie/SortieDrawer.tsx`, `src/components/compte/drawer/compte/CompteDrawer.tsx`, `src/components/compte/drawer/progression/ProgressionDrawer.tsx`, `src/components/clubs/ClubLiquidGlassV8.tsx`, `src/features/explorer-v2/sheet/ExplorerSheet.tsx`, `src/components/compte/overlay/OverlaySheet.tsx`, `src/components/accessibility/AccessibleDrawer.tsx`, `src/features/community/v2/shared/CommunitySheetShell.tsx`, `src/features/compas/v5/V5Sheet.tsx`, `src/hooks/useSheetDrag.ts`.
  - Competing segmented controls: `src/components/ui/CapsuleTabs.tsx`, `src/components/ui/Tabs.tsx`, `src/components/ui/SubTabBar.tsx`, `.ig-tabs`, `.lkdv-drawer-tabs`, `.xp-tabs`, `liquid-capsules.css`, `drawer-selectors-tabbar.css`.
  - Web Dynamic Island implementations: `src/components/ui/drawer/DynamicIsland.tsx`, `src/components/carnet/v2/CarnetIsland.tsx`, `src/features/compas/v5/Island.tsx`, `compte-v8.css` `#island`, `src/features/explorer-v2/guidance/ui/LiveActivityPreview.tsx`.
  - Toast & Dialogs repair: `src/components/ui/dialogs.ts`, `lkvAlert`, `src/contexts/ToastContext.tsx`, `src/app/layout.tsx`, `src/lib/native/ui.ts`, `ConfirmHost.tsx`, `PromptHost.tsx`.
- **Key findings**:
  - Track 1: `src/components/compte/drawer/shell/DrawerShell.tsx` and `src/components/ui/drawer/DrawerShell.tsx` are 99% duplicate files embedding 250+ lines of raw `DRAWER_SHELL_CSS` with dozens of `!important`. A single canonical `Sheet.tsx` based on Radix Dialog with 3 detents (collapsed, half, expanded) + a clean `DrawerShell.tsx` tabbed wrapper re-using `SegmentedControl` will unify all 15 competing shells.
  - Track 2: `.ig-tabs` is scattered with `!important` across 10 stylesheets. `CapsuleTabs.tsx` already has the sliding lens physics (`.sel-lens` / `.ig-th.lens`), roving tabindex, keyboard and haptic navigation. Unifying `CapsuleTabs`, `Tabs`, `SubTabBar`, and `.ig-tabs` into a canonical `SegmentedControl.tsx` with size variants ('default' 48px, 'sm' 30px) provides full HIG compliance and eliminates the white pill bug.
  - Track 3: `DynamicIsland.tsx` uses `top: 5px` (colliding with notch/island) and `--cv2-z-island: 70` (hidden behind sheets). `CarnetIsland.tsx` and `compte-v8.css` use hardcoded black backgrounds (`#121815` / `#000`). Canonical `DynamicIslandHost.tsx` mounted in `layout.tsx` at `top: calc(env(safe-area-inset-top, 0px) + var(--space-2, 8px))` with `z-index: var(--z-alert, 700)` and 100% Light Mode Liquid Glass resolves all issues.
  - Track 4: `react-hot-toast`'s `<Toaster />` was NEVER mounted in `layout.tsx`, causing all 40+ `lkvAlert()` calls to fail silently. Replacing `react-hot-toast` with a lightweight Liquid Glass toast system hooked into `layout.tsx` and calling `UIAlertController` on native platforms fixes all alerts.
- **Unexplored areas**: None for Web Primitives.

## Key Decisions Made
- Fully audited all 4 Web Primitives. Formulated complete specification and migration roadmap.

## Artifact Index
- `.agents/teamwork/teamwork_explorer_lot2_web/DISPATCH.md` — Incoming dispatch log
- `.agents/teamwork/teamwork_explorer_lot2_web/BRIEFING.md` — Persistent working memory
- `.agents/teamwork/teamwork_explorer_lot2_web/progress.md` — Liveness heartbeat
- `.agents/teamwork/teamwork_explorer_lot2_web/handoff.md` — Final handoff report
