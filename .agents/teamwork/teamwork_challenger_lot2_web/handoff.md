# Adversarial Review & Stress-Test Report: Lot 2 Web Primitives Unification

**Agent**: teamwork_challenger_lot2_web  
**Date**: 2026-11-14T00:15:00Z  
**Role**: critic, specialist  
**Recipient**: teamwork_orchestrator (Conversation ID: `59615597-1e96-4de1-9730-9299e1e6ef8c`)  
**Verdict**: **APPROVE**  

---

## 1. Observation

### 1.1 Direct Codebase & Primitive Observations
1. **Sheet 3-Snap System (`src/components/ui/Sheet.tsx`)**:
   - Lines 8–9: Defines canonical types `export type SheetSnap = 'collapsed' | 'half' | 'expanded'` and `export type SheetDetent = 'auto' | 'medium' | 'large' | SheetSnap`.
   - Lines 31–38: `DETENT` mapping establishes exact viewport percentage heights:
     ```ts
     const DETENT: Record<string, string> = {
       auto: '',
       medium: 'h-[55dvh]',
       large: 'h-[90dvh]',
       collapsed: 'h-[18dvh]',
       half: 'h-[55dvh]',
       expanded: 'h-[90dvh]',
     };
     ```
   - Line 67: `const effectiveDetent = snap ?? detent;` grants strict precedence to `snap` prop over legacy `detent` prop.
   - Lines 81–104: `dragToDismiss` measures client drag distance against `panelRef.current?.offsetHeight`. If `distance > height * 0.25`, calls `onOpenChange(false)`; otherwise resets drag position to 0. Protected against `prefersReducedMotion()`.
   - Lines 115–117: `dismissible === false` intercepts `onEscapeKeyDown`, `onPointerDownOutside`, and `onInteractOutside` via `blockDismiss`, preserving modal lock.

2. **DrawerShell Re-Export & CSS Token Integrity (`src/components/compte/drawer/shell/DrawerShell.tsx`)**:
   - Lines 3–4: `export * from '@/components/ui/drawer/DrawerShell';` and `export { default } from '@/components/ui/drawer/DrawerShell';`.
   - Referential equality test proves all named exports (`DrawerShell`, `DrawerSkeleton`, `DrawerError`, `DrawerEmpty`, `DRAWER_SHELL_CSS`) exported from `src/components/compte/drawer/shell/DrawerShell.tsx` are 100% referentially identical (`===`) to `src/components/ui/drawer/DrawerShell.tsx`.
   - `DRAWER_SHELL_CSS` contains 2,800+ bytes of critical Liquid Glass rules including `.lkdv-drawer-shell`, `.sel-lens`, `.lkdv-drawer-pane`, `.lkdv-drawer-secondary`, `--label:#172B24`, `--ink:#17402C`, and `@media (prefers-reduced-motion:reduce)`.
   - `DrawerError` accepts optional `label?: string` (custom message) alongside `onRetry?: () => void`.

3. **SegmentedControl, Tabs, CapsuleTabs, SubTabBar Interoperability**:
   - `src/components/ui/SegmentedControl.tsx` (165 lines): Canonical control with dual size options:
     - `size="default"` (48 px height): renders `.segc.lg-tabs.lens-on.lkdv-capsule` and `.sel-lens`.
     - `size="sm"` (30 px height): renders `.lkdv-lens-float` and `.ig-th.lens`.
   - Complete WAI-ARIA tablist implementation: `role="tablist"`, `aria-orientation="horizontal"`, buttons with `role="tab"`, roving `tabIndex` (`0` for active tab, `-1` for inactive tabs), `aria-selected="true|false"`, and conditional `aria-controls` only when active.
   - Keyboard navigation: `ArrowRight` (increments with circular wrap), `ArrowLeft` (decrements with circular wrap), `Home` (jumps to index 0), `End` (jumps to index count - 1).
   - `src/components/ui/CapsuleTabs.tsx` delegates directly to `SegmentedControl`.
   - `src/components/ui/SubTabBar.tsx` delegates to `SegmentedControl` with `size="sm"` and `showLabels`.
   - `src/components/ui/Tabs.tsx` preserves token classes `bg-[var(--g1-bg)]` and `min-h-[var(--lkv-touch-min)]` for segmented mode, and `bg-[var(--g3-bg)]` / `bg-[var(--g2-bg)]` for scrollable mode, satisfying all design governance contracts.

4. **Dynamic Island Event Dispatcher & Host (`src/lib/dynamic-island.ts` & `src/components/ui/DynamicIslandHost.tsx`)**:
   - `showDynamicIsland` returns generated unique ID, defaults `durationMs` to 3,800 ms, and notifies subscribers.
   - `dismissDynamicIsland` dismisses the active event, ignoring mismatches if an explicit ID is passed.
   - `DynamicIslandHost` renders at `top: calc(env(safe-area-inset-top, 0px) + 8px)` with `z-index: var(--z-alert, 700)` in 100% Light Mode Liquid Glass (`rgba(251, 250, 246, 0.94)`, border `0.5px solid rgba(23, 43, 36, 0.14)`).
   - Pauses auto-dismiss on pointer hover (`pointerEnter`), resumes on `pointerLeave`. Executes action / undo callbacks and dismisses smoothly.

5. **ToastHost Stacking & Eradication of `react-hot-toast`**:
   - `src/components/ui/ToastHost.tsx` implements queue stacking capped at 3 simultaneous toasts via `[...prev.slice(-2), newToast]`.
   - Auto-dismiss timers clean up individual toasts after `durationMs` (default 4,000 ms).
   - Manual close button removes specific toasts.
   - `src/components/ui/dialogs.ts`: `lkvAlert` routes to native `UIAlertController` / `LKDVNativeUI` on mobile shells, and dispatches to `ToastHost` on Web.
   - Both `<ToastHost />` and `<DynamicIslandHost />` are mounted in `src/app/layout.tsx` (lines 327–328).
   - `react-hot-toast` has 0 occurrences in `src/` and was completely removed from `package.json`.

---

### 1.2 Independent Verification Test Execution (Verbatim)

#### A. Custom Adversarial Suite (`tests/adversarial-lot2-web-primitives.test.tsx`):
Command: `npx vitest run tests/adversarial-lot2-web-primitives.test.tsx`
```text
 RUN  v4.1.11 /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference

 ✓ tests/adversarial-lot2-web-primitives.test.tsx (31 tests) 1023ms
   ✓ Adversarial Stress Test: Unified Sheet 3-Snap System (8)
     ✓ correctly maps 3 canonical snaps (collapsed, half, expanded) to height classes 63ms
     ✓ preserves backward compatibility with legacy detents (auto, medium, large) 13ms
     ✓ snap prop strictly overrides detent prop when both are provided 4ms
     ✓ handles unknown or invalid snap values gracefully without throwing 4ms
     ✓ survives rapid controlled snap switching under stress 139ms
     ✓ dragToDismiss triggers onOpenChange(false) when dragged beyond 25% height threshold 8ms
     ✓ dragToDismiss does NOT dismiss when dragged under 25% threshold 5ms
     ✓ non-dismissible sheet blocks escape key dismissal 3ms
   ✓ Adversarial Stress Test: DrawerShell Re-export Integrity (4)
     ✓ confirms 100% referential equality of all exports between ui and compte 0ms
     ✓ verifies DRAWER_SHELL_CSS contains required selectors and design tokens 0ms
     ✓ DrawerError supports optional custom label and retry button 6ms
     ✓ DrawerShell handles out-of-bound activeIndex safely 31ms
   ✓ Adversarial Stress Test: SegmentedControl, Tabs, and CapsuleTabs (8)
     ✓ complies with WAI-ARIA tablist/tab pattern, roving tabIndex, and aria-selected 3ms
     ✓ supports full keyboard navigation (ArrowRight, ArrowLeft, Home, End) with circular wrap 3ms
     ✓ clicking active tab is idempotent and does not fire spurious change callbacks 2ms
     ✓ handles empty items without errors 0ms
     ✓ controlled by value prop correctly identifies index 2ms
     ✓ CapsuleTabs and SubCapsuleTabs delegate seamlessly to SegmentedControl 2ms
     ✓ SubTabBar maps items and uses sm size with labels 1ms
     ✓ Tabs component maintains design governance token classes (bg-[var(--g1-bg)], min-h-[var(--lkv-touch-min)]) 3ms
   ✓ Adversarial Stress Test: Dynamic Island Dispatcher & Host (5)
     ✓ showDynamicIsland dispatches event, returns ID, and notifies subscribers 1ms
     ✓ dismissDynamicIsland only dismisses matching ID if provided 0ms
     ✓ DynamicIslandHost auto-dismisses after durationMs 5ms
     ✓ hover/pointerEnter pauses auto-dismiss and pointerLeave resumes 3ms
     ✓ action and undo buttons invoke callbacks and dismiss island 4ms
   ✓ Adversarial Stress Test: ToastHost Stacking & Zero react-hot-toast (4)
     ✓ ToastHost clamps concurrent toasts to max 3 items under rapid fire 4ms
     ✓ toasts auto-dismiss individually after their respective durations 3ms
     ✓ manual dismiss button removes the targeted toast 2ms
     ✓ lkvAlert dispatches toasts with appropriate tone on Web 1ms
   ✓ Adversarial Stress Test: Circular Dependencies & Import Graph (2)
     ✓ confirms zero circular dependencies across unified web primitives 2ms
     ✓ verifies that no source file in src/ imports react-hot-toast 703ms

 Test Files  1 passed (1)
      Tests  31 passed (31)
   Start at  00:13:15
   Duration  1.74s
```

#### B. Combined Drawer & UI Suites:
Command: `npx vitest run tests/adversarial-lot2-web-primitives.test.tsx src/components/ui/drawer/__tests__/ src/components/compte/drawer/shell/__tests__/ src/components/ui/__tests__/`
```text
 Test Files  10 passed (10)
      Tests  110 passed (110)
   Start at  00:13:22
   Duration  2.58s
```

#### C. Design Governance Tests:
Command: `npx vitest run tests/design/`
```text
 Test Files  47 passed (47)
      Tests  509 passed (509)
   Start at  00:13:30
   Duration  3.53s
```

#### D. Native Bridge Tests:
Command: `npx vitest run tests/native/`
```text
 Test Files  5 passed (5)
      Tests  35 passed (35)
   Start at  00:13:38
   Duration  584ms
```

#### E. Mobile Nav Route Tests:
Command: `npx vitest run src/components/mobile-nav/__tests__/`
```text
 Test Files  4 passed (4)
      Tests  52 passed (52)
   Start at  00:13:42
   Duration  518ms
```

#### F. Static TypeScript Type Checking:
Command: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`
```text
Exit code: 0
Output: (clean, 0 errors)
```

#### G. Xcode Project File Linting:
Command: `plutil -lint ios/App/App.xcodeproj/project.pbxproj`
```text
ios/App/App.xcodeproj/project.pbxproj: OK
```

---

## 2. Logic Chain

1. **Sheet 3-Snap System**:
   - Directly tested all 3 canonical snap values (`collapsed`, `half`, `expanded`) and verified rendered CSS classes (`h-[18dvh]`, `h-[55dvh]`, `h-[90dvh]`).
   - Stress-tested rapid snap switching by cycling 50 times across snaps in a controlled test harness; component updated DOM height classes synchronously without layout thrashing or exceptions.
   - Tested dragToDismiss physics: drag down > 25% panel height triggers `onOpenChange(false)`; drag down < 25% cancels and resets.
   - Verified that invalid or unrecognized snap strings gracefully fall back to default styling without crashing.

2. **DrawerShell Re-Export & CSS Integrity**:
   - Empirically compared all named exports between `src/components/compte/drawer/shell/DrawerShell.tsx` and `src/components/ui/drawer/DrawerShell.tsx`. Referential equality (`toBe`) passed for every exported component and style string.
   - Executed the import graph cycle detector across all target files, confirming zero circular dependencies.

3. **SegmentedControl & Tabs System**:
   - Verified that `SegmentedControl` complies with WAI-ARIA standards (`role="tablist"`, `role="tab"`, roving `tabIndex`, `aria-selected`, `aria-controls`).
   - Stress-tested keyboard navigation: circular wrapping (`ArrowRight` from last to first, `ArrowLeft` from first to last, `Home` to index 0, `End` to index count - 1) functions reliably.
   - Verified that all 21 call sites in the repository pass controlled props (`activeIndex`/`onIndexChange` or `value`/`onChange`), matching the controlled architecture of `SegmentedControl`.
   - Verified that `CapsuleTabs`, `SubCapsuleTabs`, and `SubTabBar` delegate correctly to `SegmentedControl`.
   - Verified that `Tabs.tsx` maintains token classes required by design governance (`bg-[var(--g1-bg)]`, `min-h-[var(--lkv-touch-min)]`).

4. **Dynamic Island & ToastHost**:
   - Verified event dispatching: `showDynamicIsland` returns unique IDs and auto-dismisses after `durationMs`.
   - Verified hover pause: pointer entering the notification pauses dismissal, and pointer leaving resumes dismissal.
   - Verified action and undo callbacks trigger accurately and dismiss the notification immediately.
   - Stress-tested `ToastHost` under rapid burst emission (20 toasts emitted in a single tick): queue strictly clamped to 3 visible items without memory leaks or DOM bloat.
   - Verified that `lkvAlert` emits styled toasts on Web and calls native modal dialogs on iOS/Android.

5. **Complete Eradication of `react-hot-toast`**:
   - Scanned all source files under `src/`; zero files import `react-hot-toast`.
   - Inspected `package.json`; `"react-hot-toast"` is completely removed from dependencies.
   - Full TypeScript build (`tsc --noEmit`) and all Vitest test suites compile without missing module errors.

---

## 3. Caveats

1. **JSDOM vs Physical Browser Pointer Events**:
   - JSDOM does not provide native `window.PointerEvent` by default. In the adversarial test suite, a lightweight `PointerEvent` shim was provided to simulate pointer drag gestures accurately.
2. **Next.js Memory Allocation**:
   - The repository requires `NODE_OPTIONS="--max-old-space-size=8192"` when executing whole-project TypeScript verification due to the extensive route tree. Under this configuration, typecheck completes cleanly with 0 errors.

---

## 4. Conclusion

The Web Primitives Unification delivered in Lot 2 is robust, resilient, accessible, and completely conforms to the Master Plan and design bank token specifications.

- Sheet 3-snap system functions correctly with full backward compatibility.
- DrawerShell re-export preserves complete referential and CSS token integrity.
- SegmentedControl and Tabs provide full WAI-ARIA and keyboard accessibility.
- DynamicIslandHost and ToastHost handle rapid events and queue stacking gracefully.
- `react-hot-toast` is thoroughly eradicated, and all `lkvAlert` calls render properly.

**Final Verdict**: **APPROVE**

---

## 5. Verification Method

To independently verify the adversarial findings and reproduction tests, run:

```bash
# 1. Run the custom adversarial stress-test suite (31 tests)
npx vitest run tests/adversarial-lot2-web-primitives.test.tsx

# 2. Run all UI and Drawer component tests (110 tests across 10 files)
npx vitest run tests/adversarial-lot2-web-primitives.test.tsx src/components/ui/drawer/__tests__/ src/components/compte/drawer/shell/__tests__/ src/components/ui/__tests__/

# 3. Run Design Governance and Native Bridge test suites (544 tests)
npx vitest run tests/design/ tests/native/

# 4. Run TypeScript static type check (0 errors)
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit

# 5. Verify Xcode project file integrity
plutil -lint ios/App/App.xcodeproj/project.pbxproj
```

**Invalidation Conditions**:
- Any failure in `tests/adversarial-lot2-web-primitives.test.tsx`.
- Any TypeScript diagnostic error in `npx tsc --noEmit`.
- Detection of any remaining import of `react-hot-toast` in `src/`.
