# Handoff Report — Lot 2 Web Primitives Unification Investigation

**Author**: `teamwork_explorer_lot2_web`  
**Mission**: Web Primitives Unification Explorer (Lot 2 Master Plan §1, §4, §6.3)  
**Date**: 2026-11-13  
**Status**: Investigation Complete — Ready for Implementation  

---

## 1. Observations

### 1.1 Track 1: Fragmentation of Drawers and Sheets (15 Competing Shells)
A repository-wide audit reveals 15 separate drawer/sheet shells with duplicated code, inconsistent detents, and competing drag gesture engines:

1. **`src/components/compte/drawer/shell/DrawerShell.tsx` (269 lines)**:
   - Duplicates `src/components/ui/drawer/DrawerShell.tsx` nearly line-for-line.
   - Contains a massive inline stylesheet constant `DRAWER_SHELL_CSS` (lines 241–279) injected via `<style dangerouslySetInnerHTML={{ __html: DRAWER_SHELL_CSS }} />` containing `41 !important` declarations, hardcoded colors (`#172B24`, `#56665D`, `#17402C`, `#d8f3de`, `rgba(23,43,36,.12)`), and hardcoded CSS calculations.
   - Embeds a bespoke tab bar (`.segc.lg-tabs.lens-on.lkdv-drawer-tabs.lkdv-capsule`) and secondary filter pill (`.ig-tabs-float.lkdv-drawer-secondary`).
   - Re-exported / imported by 9 files including `SortieDrawer.tsx`, `CompteDrawer.tsx`, `ProgressionDrawer.tsx`, `ReseauDrawer.tsx`, `HighlightEditDrawer.tsx`, `ExplorerDrawer.tsx`, `CreateDrawer.tsx`.

2. **`src/components/ui/drawer/DrawerShell.tsx` (279 lines)**:
   - 99% byte-identical clone of `src/components/compte/drawer/shell/DrawerShell.tsx`, with identical embedded `DRAWER_SHELL_CSS`.
   - Imported by 9 drawers in `src/features/hub/components/drawers/` (`HubGearDrawer.tsx`, `HubBudgetDrawer.tsx`, `HubChecklistDrawer.tsx`, `HubDepartDrawer.tsx`, `HubItineraryDrawer.tsx`, `HubJournalDrawer.tsx`, `HubSafetyDrawer.tsx`, `HubDocsDrawer.tsx`, `HubGroupeDrawer.tsx`).
   - Covered by unit tests in `src/components/ui/drawer/__tests__/DrawerShell.test.tsx` and `src/components/compte/drawer/shell/__tests__/DrawerShell.test.tsx`, which specifically assert regex matches on `DRAWER_SHELL_CSS` (e.g. `expect(DRAWER_SHELL_CSS).toMatch(/\.lkdv-drawer-tabs \.sel-lens\{[^}]*translateX\(calc\(var\(--i,0\)\*100%\)\)/)`).

3. **`src/components/ui/Sheet.tsx` (195 lines)**:
   - Canonical bottom sheet built on `@radix-ui/react-dialog` (`Dialog.Root`, `Dialog.Portal`, `Dialog.Overlay`, `Dialog.Content`, `Dialog.Title`, `Dialog.Close`).
   - Uses `bank.ts` tokens: `z-[var(--z-sheet)]`, `rounded-t-[var(--lkv-radius-sheet)]` (44px), `bg-[color:var(--glass-bg-medium)]`, `border-[color:var(--glass-border)]`.
   - Detents supported: `detent?: 'auto' | 'medium' | 'large'` mapping to `'auto' | 'h-[55dvh]' | 'h-[90dvh]'`.
   - Pointer-based drag-to-dismiss via `onPointerDown`/`Move`/`Up` with 25% height dismissal threshold.

4. **`src/features/explorer-v2/sheet/ExplorerSheet.tsx` (366 lines)**:
   - Custom sheet implementation with 4 custom detents: `peek` (min ~32% viewport), `low` (same as peek), `mid` (max ~85%), `full` (max ~85%).
   - Calculates viewport dynamically (`window.visualViewport?.height ?? window.innerHeight`).
   - Custom velocity pointer tracking (lines 71–178) and keyboard navigation (`ArrowUp`, `ArrowDown`, `Home`, `End`).
   - Embeds its own internal segmented control `.xp-tabs` with `.xp-tab-lens` and `--n` / `--i`.

5. **`src/features/community/v2/shared/CommunitySheetShell.tsx` (412 lines)**:
   - Custom bottom sheet with `createPortal(..., document.body)`.
   - Fixed durations `SHEET_ENTER_MS = 720`, `SHEET_EXIT_MS = 560`.
   - Custom drag physics (`SHEET_DRAG_CLOSE_RATIO = 0.3`, `SHEET_DRAG_CLOSE_VELOCITY = 0.55`).
   - Integrates `LensPager`, `CapsuleTabs`, `SortMenuButton`, and `DynamicIsland`.

6. **`src/components/carnet/v2/CarnetDrawerV2.tsx` (1749 lines)**:
   - Integrates `SlotShell` + `CapsuleTabs` + custom row animations (`lkdv-row-in 450ms var(--ease-glass) both`).
   - Embeds `DRAWER_MOTION_CSS`.

7. **`src/components/compte/drawer/SlotShell.tsx` (349 lines)**:
   - Profile/Carnet drawer coque with `LensPager`, custom skeleton (`.lkdv-slot-skeleton`), error state, and external `.ig-tabs` selector.

8. **`src/components/compte/overlay/OverlaySheet.tsx` (187 lines)**:
   - Portals into `document.body`, inspects `#card` / `#phone` bounding rects, manually sets `document.body.style.overflow = 'hidden'`, and forces `inert` on `#sheet`.

9. **`src/components/accessibility/AccessibleDrawer.tsx` (182 lines)**:
   - Uses `useDrawerFocusRestoration`, `announceToScreenReader`, `AccessibilityStyles`.

10. **`src/features/compas/v5/V5Sheet.tsx` (124 lines)**:
    - Custom sheet inside `.v5-sheet`, handles Escape and Tab focus trap manually, with `aria-modal="false"`.

11. **`src/components/clubs/ClubLiquidGlassV8.tsx` (1340 lines)**:
    - Embeds a raw HTML mockup string `COMPTE_V8_HTML` containing `<div class="sw-wrap" id="sw" data-det="closed"><section class="sheet" id="sheet"></section></div>`. Mounts React sub-drawers into `#sheet` via `(window as any).__lkdvMountDrawer` and `ClubDrawerHost`.

12. **`src/hooks/useSheetDrag.ts` (72 lines)**:
    - Pure DOM pointer drag hook setting `--lkv-sheet-from` and `translateY` without `framer-motion` re-renders.

13. **Dead package check**:
    - `package.json` includes `"vaul": "^1.1.2"`.
    - Grep check `grep -rn "from 'vaul'" src/` returned 0 matches: `vaul` is completely unused dead code.

---

### 1.2 Track 2: Fragmentation of Segmented Controls & Tabs
The audit reveals 5 distinct tab implementations and 10+ stylesheets competing for styling:

1. **`src/components/ui/CapsuleTabs.tsx` (179 lines)**:
   - High-quality modern implementation.
   - Variants: `size="default"` (48px height, `.segc.lg-tabs.lens-on.lkdv-capsule`, `.sel-lens`) and `size="sm"` (30px height, `.lkdv-lens-float`, `.ig-th.lens`).
   - Driven by CSS variables `--n` (item count) and `--i` (active index).
   - WAI-ARIA accessible (`role="tablist"`, `role="tab"`, roving `tabIndex` 0 / -1, ArrowLeft/ArrowRight wrapping, `Home`, `End`).
   - Integrated with `useHapticFeedback('selection')`.

2. **`src/components/ui/Tabs.tsx` (141 lines)**:
   - Has `variant="segmented"` and `variant="scrollable"`.
   - Does NOT have a sliding glass active indicator! It simply applies `bg-[var(--g3-bg)] text-[var(--g3-text)]` on the active button and `text-[var(--glass-label-secondary)]` on inactive buttons.

3. **`src/components/ui/SubTabBar.tsx` (82 lines)**:
   - Floating secondary subbar (`inline-flex items-center gap-1 rounded-full p-1.5 g1`).
   - References phantom variable `--glass-secondary` (line 58, 70).
   - Static button background toggling without sliding indicator.

4. **`.ig-tabs` (10+ stylesheet declarations)**:
   - Found across `compte-v8.css`, `compte-apple-hig.css`, `drawer-selectors-tabbar.css`, `hub-camp-option3.css`, `community-card.css`, `messages-grammar.css`, and embedded inside `DRAWER_SHELL_CSS`.
   - Carries forced `!important` dimensions:
     ```css
     .lkdv-drawer-secondary .ig-tabs {
       width: calc(var(--n, 2) * 44px + 5px) !important;
       max-width: calc(var(--n, 2) * 44px + 5px) !important;
       height: 30px !important;
     }
     ```
   - In `HubGearDrawer.tsx` / `HubBudgetDrawer.tsx`, label text was hidden or truncated, causing the white/empty pill bug captured on iPhone 16 Pro (`shots/42-hub-gear.png`, `shots/43-hub-budget.png`).

5. **`.xp-tabs` in `ExplorerSheet.tsx`**:
   - Re-implements `--n` / `--i` and `.xp-tab-lens` with custom arrow key handling in React.

---

### 1.3 Track 3: The 4 Web Dynamic Island Implementations
Five separate implementations of Dynamic Island exist on Web:

1. **`src/components/ui/drawer/DynamicIsland.tsx` (133 lines)**:
   - Generic confirmation pill with title, subtitle, undo button, action button, and auto-dismiss (3800ms).
   - Auto-injects `DYNAMIC_ISLAND_CSS` (line 118):
     `position: fixed; top: 5px; left: 0; right: 0; z-index: var(--cv2-z-island, 70);`
   - **Critical bug**: `top: 5px` ignores `env(safe-area-inset-top)` entirely! On iPhone 16 Pro (safe area 59px), this renders directly underneath/colliding with the physical Dynamic Island hardware and system status bar.
   - **Critical z-index bug**: `--cv2-z-island: 70` is lower than `--z-sheet: 500` and `--z-modal: 600`, rendering confirmations completely hidden behind sheets!

2. **`src/components/carnet/v2/CarnetIsland.tsx` (62 lines)**:
   - Uses `.lkdv-carnet-island` from `carnet-v2.css` (lines 1199–1260).
   - Hardcoded black background (`#121815` / `#000`), in direct violation of the 100% Light Mode Liquid Glass mandate.

3. **`src/features/compas/v5/Island.tsx` (128 lines)**:
   - Preparation and status island with states `idle`, `live` (with progress % and stop button), and `note` (with done, stopped, error, and undo actions).
   - Uses WCAG 2.2.1 `onHold` (onPointerEnter / onFocus) to pause auto-dismiss while reading.

4. **`src/components/compte/compte-v8.css` + `ClubLiquidGlassV8.tsx`**:
   - `#island.island` element with `data-s="idle" | "live" | "note"`, `#isl.is.live`, `#isn.is.note`.
   - Hardcoded `background: #000; color: #fff;` and fixed pixel dimensions.

5. **`src/features/explorer-v2/guidance/ui/LiveActivityPreview.tsx`**:
   - ActivityKit Dynamic Island payload previewer exposing compact leading, compact trailing, and expanded views.

---

### 1.4 Track 4: Toast / Dialogs Silent Failure (`lkvAlert` & `react-hot-toast`)
1. **`src/components/ui/dialogs.ts`**:
   - Line 3: `import toast from 'react-hot-toast';`
   - Line 137–139:
     ```typescript
     export function lkvAlert(message: string): void {
       toast(message);
     }
     ```
2. **`src/app/layout.tsx`**:
   - Imports and mounts `<ConfirmHost />` (line 323), `<PromptHost />` (line 324), and `<ToastProvider>` from `@/contexts/ToastContext` (lines 295, 332).
   - **`<Toaster />` from `react-hot-toast` is NEVER imported and NEVER mounted anywhere in `layout.tsx` or any root layout.**
3. **Silent Failure Mechanism**:
   - Calling `toast(message)` updates `react-hot-toast`'s internal JavaScript observer store.
   - Because no `<Toaster />` component exists in the React DOM tree, no DOM nodes are ever mounted or rendered.
   - Over 40 call sites of `lkvAlert` across the entire application (including cart error alerts in `panier/page.tsx`, GPX error alerts in `ConversationView.tsx`, community moderation in `ReportBlockModal.tsx`, and expeditions in `BouteilleALaMer.tsx`) fail 100% silently without showing any UI to the user.
4. **Native Dialog Capability**:
   - `src/lib/native/ui.ts` registers `LKDVNativeUI` with `presentActions` (ActionSheet) and `presentPrompt` (Prompt with text input), but has no dedicated `presentAlert` for standard informational/error alerts.
   - `supportsNativeIOSUI()` still excludes `/compas` (line 44), which must be removed per Master Plan §4 & §6.3.

---

## 2. Logic Chain

```
[Observation 1.1: 15 competing shells & DrawerShell.tsx duplicated with raw DRAWER_SHELL_CSS]
      │
      ├─▶ Step 1: `src/components/ui/Sheet.tsx` already contains a robust Radix Dialog bottom sheet
      │           with ARIA dialog modal, focus trap, and bank.ts token integration.
      │
      ├─▶ Step 2: `DrawerShell.tsx` only differs by adding a tabbed navigation header and pane switcher.
      │
      └─▶ Conclusion 1: We can establish `src/components/ui/Sheet.tsx` as the single canonical Sheet
                        primitive with 3 snaps ('collapsed' 18%, 'half' 55dvh, 'expanded' 90dvh),
                        and build `src/components/ui/drawer/DrawerShell.tsx` as a clean tabbed wrapper
                        re-using the unified `SegmentedControl`, while aliasing `compte/drawer/shell/DrawerShell.tsx`
                        for backwards compatibility.
```

```
[Observation 1.2: 5 competing tab implementations + scattered .ig-tabs with !important]
      │
      ├─▶ Step 3: `CapsuleTabs.tsx` already implements the Apple HIG capsule aesthetic with
      │           a sliding glass lens (.sel-lens / .ig-th.lens), roving tabIndex, and haptics.
      │
      ├─▶ Step 4: `Tabs.tsx` and `SubTabBar.tsx` lack sliding lenses and duplicate styling logic.
      │
      └─▶ Conclusion 2: Unify `CapsuleTabs.tsx`, `Tabs.tsx`, `SubTabBar.tsx`, and `.ig-tabs` into
                        a single canonical `SegmentedControl.tsx` with 2 standard sizes ('default' 48px, 'sm' 30px),
                        icon-first layout, and sliding glass active lens driven by bank.ts tokens.
```

```
[Observation 1.3: DynamicIsland.tsx has top: 5px, z-index 70, and black backgrounds]
      │
      ├─▶ Step 5: `top: 5px` ignores env(safe-area-inset-top), colliding with iPhone hardware notches.
      │
      ├─▶ Step 6: `z-index: 70` renders beneath sheets (--z-sheet: 500) and modals (--z-modal: 600).
      │
      ├─▶ Step 7: Black backgrounds (#121815, #000) violate the 100% Light Mode Liquid Glass mandate.
      │
      └─▶ Conclusion 3: Create a single canonical `src/components/ui/DynamicIslandHost.tsx` mounted in
                        `layout.tsx`, positioned at `top: calc(env(safe-area-inset-top, 0px) + 8px)`,
                        `z-index: var(--z-alert, 700)`, styled with sauge/white liquid glass,
                        supporting Compact (leading/trailing) and Expanded presentations.
```

```
[Observation 1.4: react-hot-toast <Toaster /> was never mounted in layout.tsx]
      │
      ├─▶ Step 8: `lkvAlert()` silently fails because react-hot-toast has no mounted container.
      │
      ├─▶ Step 9: `ToastContext.tsx` and `ConfirmHost.tsx` already demonstrate working event-driven patterns.
      │
      └─▶ Conclusion 4: Replace `react-hot-toast` with a lightweight Liquid Glass Toast system (`ToastHost.tsx`)
                        mounted in `layout.tsx` at `z-index: var(--z-alert, 700)`, and route `lkvAlert` to
                        `UIAlertController` / `MaterialAlertDialogBuilder` on native iOS/Android.
```

---

## 3. Caveats & Assumptions

1. **Existing Unit Test Regex Assertions**:
   - `src/components/ui/drawer/__tests__/DrawerShell.test.tsx` and `src/components/compte/drawer/shell/__tests__/DrawerShell.test.tsx` explicitly check `DRAWER_SHELL_CSS` exports via regex.
   - *Mitigation*: The unified `DrawerShell` must export a compatible `DRAWER_SHELL_CSS` token string or re-export it so existing tests pass without regressions, while stripping the conflicting internal inline `<style>` tag in favor of CSS module / token-based rules.
2. **Backward Compatibility of Imports**:
   - Over 40 files import from `@/components/ui/dialogs`, 9 from `@/components/compte/drawer/shell/DrawerShell`, and 9 from `@/components/ui/drawer`.
   - *Mitigation*: All existing export signatures (`lkvAlert`, `lkvConfirm`, `lkvPromptAsync`, `DrawerShell`, `DrawerTab`, `DrawerSecondaryItem`, `DrawerEmpty`, `DrawerError`, `DrawerSkeleton`, `CapsuleTabs`, `SubCapsuleTabs`, `Tabs`, `SubTabBar`) must be preserved as typed wrappers or re-exports.
3. **Dead Package Removal**:
   - `"vaul": "^1.1.2"` is in `package.json` but has 0 imports in `src/`. It can be safely removed or kept unreferenced without runtime impact.
4. **Native Bridge Interface**:
   - Native iOS plugin `LKDVNativeUI` in `ios/App/App/LKDVNativeUIPlugin.swift` and Kotlin Android counterpart need `presentAlert` support if we want native alerts for `lkvAlert` in addition to `presentActions`. Alternatively, `presentActions` with an OK action can be used immediately as a fallback.

---

## 4. Conclusion & Architectural Specifications

### 4.1 Specification: Unified `Sheet` / `DrawerShell`
**Location**: `src/components/ui/Sheet.tsx` & `src/components/ui/drawer/DrawerShell.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│ Dialog.Overlay (z-index: 500, backdrop-blur: 12px, scrim)    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Dialog.Content (z-index: 500, rounded-t: 44px, g2 glass) │ │
│ │   [── Handle (pointer drag-to-dismiss & snap) ──]       │ │
│ │   [Optional Header: Title + Close (×) button]           │ │
│ │   ┌───────────────────────────────────────────────────┐ │ │
│ │   │ Unified SegmentedControl (Tabs / Sections)        │ │ │
│ │   ├───────────────────────────────────────────────────┤ │ │
│ │   │ Viewport / Active Tab Panel (inert when inactive) │ │ │
│ │   │ (Overscroll-contain, -webkit-overflow-scrolling)  │ │ │
│ │   ├───────────────────────────────────────────────────┤ │ │
│ │   │ [Optional Floating Secondary Filter Lens (.sm)]   │ │ │
│ │   └───────────────────────────────────────────────────┘ │ │
│ │   [Optional Footer: Safe-area bottom clearance]         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- **Props API**:
  ```typescript
  export type SheetSnap = 'collapsed' | 'half' | 'expanded';

  export interface SheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    snap?: SheetSnap;
    onSnapChange?: (snap: SheetSnap) => void;
    dismissible?: boolean;
    dragToDismiss?: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
    panelClassName?: string;
    contentClassName?: string;
  }
  ```
- **Snap Heights**:
  - `'collapsed'`: `calc(18dvh + env(safe-area-inset-bottom, 0px))` (or peek 176px)
  - `'half'`: `55dvh`
  - `'expanded'`: `min(90dvh, 100dvh - env(safe-area-inset-top, 0px) - 64px)`
- **Design Tokens**:
  - Background: `var(--glass-bg-prominent)` / `rgba(235, 242, 236, 0.95)`
  - Border: `var(--glass-rim-color)` (`rgba(23, 43, 36, 0.14)`)
  - Border Radius: `var(--lkv-radius-sheet)` (`44px`)
  - Shadow: `var(--glass-shadow-elevated)` (`0 16px 48px rgba(23, 64, 44, 0.16)`)
  - Z-Index: `var(--z-sheet)` (`500`)

---

### 4.2 Specification: Unified `SegmentedControl`
**Location**: `src/components/ui/SegmentedControl.tsx` (with backwards compatibility exports in `CapsuleTabs.tsx`, `Tabs.tsx`, `SubTabBar.tsx`)

- **Sizes & Geometry**:
  - `size="default"`: Height `48px`, border-radius `9999px`, active lens padding `3px`, tactile target `≥ 44×44pt`.
  - `size="sm"`: Height `30px`, border-radius `9999px`, active lens padding `2.5px`, compact indicator.
- **Visual Materials (100% Light Mode)**:
  - Track background: `rgba(255, 255, 255, 0.65)` with backdrop-filter `blur(28px) saturate(180%)`.
  - Track border: `0.5px solid rgba(255, 255, 255, 0.8)`.
  - Active Lens: `linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.82))` with shadow `0 2px 8px rgba(23, 43, 36, 0.10)`.
  - Active text/icon color: `var(--lkv-forest-900)` (`#17402C`).
  - Inactive text/icon color: `var(--glass-label-secondary)` (`#56665D`).
- **Sliding Indicator Transition**:
  - `transform: translateX(calc(var(--i, 0) * 100%));`
  - `transition: transform 0.42s var(--motion-ease-standard);`
  - Disabled when `@media (prefers-reduced-motion: reduce)`.
- **Icon-First Compliance**:
  - Icons are mandatory or prioritized; text labels are compact (`.lbl`, 11–13px).
  - Clean `aria-label` and `title` on every tab button for accessibility.

---

### 4.3 Specification: Unified `DynamicIslandHost`
**Location**: `src/components/ui/DynamicIslandHost.tsx` & `src/lib/dynamic-island.ts`

- **Placement & Safe-Area Clearance**:
  - `position: fixed;`
  - `top: calc(env(safe-area-inset-top, 0px) + var(--space-2, 8px));`
  - `left: 50%; transform: translateX(-50%);`
  - `z-index: var(--z-alert, 700);` (strictly above sheets at 500 and modals at 600).
- **Presentations**:
  1. **Compact**:
     - Dimensions: `width: 220px; height: 38px; border-radius: 9999px;`
     - Leading: Icon / Activity Glyph (e.g. Hiking step, GPS fix, checkmark).
     - Trailing: Metric value / status (e.g. `12.4 km`, `+450 m`, `1:42`).
  2. **Expanded**:
     - Dimensions: `width: min(366px, calc(100vw - 24px)); min-height: 44px; border-radius: 22px;`
     - Content: Title (`font-semibold 13px`) + Subtitle (`font-medium 11px`).
     - Actions: Optional Undo (`Annuler`) or Primary Action (`Voir`).
  3. **Live Activity**:
     - Progress bar with percentage and pause/stop controls for active outings or route preparations.
- **Light Mode Styling**:
  - Background: `rgba(255, 255, 255, 0.92)` with `backdrop-filter: blur(28px) saturate(180%)`.
  - Border: `0.5px solid rgba(23, 43, 36, 0.14)`.
  - Shadow: `0 10px 30px rgba(23, 64, 44, 0.14)`.
  - Ink: `#172B24` (Primary), `#56665D` (Secondary).
  - Button: `#17402C` background with `#FFFFFF` ink.
  - Zero `#000` / `#121815`.
- **Global API**:
  ```typescript
  export function showDynamicIsland(options: {
    title: string;
    subtitle?: string;
    leadingIcon?: string;
    trailingText?: string;
    undo?: { label?: string; onUndo: () => void };
    action?: { label: string; onAction: () => void };
    durationMs?: number;
  }): void;
  ```

---

### 4.4 Specification: Toast & Dialogs Repair
**Location**: `src/components/ui/dialogs.ts`, `src/components/ui/ToastHost.tsx`, `src/app/layout.tsx`

1. **Remove `react-hot-toast`**:
   - Strip `import toast from 'react-hot-toast'` from `src/components/ui/dialogs.ts`.
   - Remove `"react-hot-toast"` from `package.json`.
2. **Mount `ToastHost` in `src/app/layout.tsx`**:
   ```tsx
   <CookieConsentBanner />
   <ConfirmHost />
   <PromptHost />
   <ToastHost />
   <DynamicIslandHost />
   ```
3. **Multi-Target `lkvAlert` Implementation**:
   ```typescript
   export function lkvAlert(message: string, options?: { title?: string; tone?: 'info' | 'success' | 'warning' | 'error' }): void {
     // 1. Native iOS/Android: present UIAlertController / Material alert
     if (supportsNativeIOSUI()) {
       void presentNativeActions({
         title: options?.title || 'Information',
         message,
         actions: [{ id: 'ok', title: 'OK' }],
       });
       return;
     }

     // 2. Web fallback: push to unified Toast / Dynamic Island event bus
     emitToast({
       id: `toast-${Date.now()}`,
       message,
       title: options?.title,
       tone: options?.tone || 'info',
       durationMs: 4000,
     });
   }
   ```
4. **Toast Host Component**:
   - Renders toasts at `z-index: var(--z-alert, 700)` with Liquid Glass styling (`bg-[color:var(--glass-bg-prominent)]`, `border-[color:var(--glass-rim)]`, `text-[color:var(--glass-label)]`).
   - Accessible: `role="status"` and `aria-live="polite"`.

---

## 5. Verification Method

### 5.1 Verification Commands
To independently verify the web primitives unification during Lot 2 implementation:

1. **Type Checking**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected result*: 0 errors.

2. **Design & Governance Test Suite**:
   ```bash
   npx vitest run tests/design/
   ```
   *Expected result*: 47/47 files passed, 509+ tests passed (100% green, especially `tests/design/unification.spec.ts` U-D60 → U-D64 and `lot2-shell.spec.ts`).

3. **Drawer & UI Primitives Unit Tests**:
   ```bash
   npx vitest run src/components/ui/drawer/__tests__/ src/components/compte/drawer/shell/__tests__/
   ```
   *Expected result*: All 60 tests pass.

4. **Web Build Verification**:
   ```bash
   npm run build
   ```
   *Expected result*: Clean Next.js compilation with zero SSR/CSR hydration errors.

### 5.2 Invalidation Conditions
This investigation report is invalidated if:
- Any implementation continues to use `react-hot-toast` without mounting `<Toaster />`.
- `DynamicIsland` retains `top: 5px` or `z-index: 70`.
- Any drawer shell re-introduces `#000` / `#121815` or raw inline `<style>` with `!important`.
- `SegmentedControl` drops the sliding glass indicator (`.sel-lens` / `.ig-th.lens`).
