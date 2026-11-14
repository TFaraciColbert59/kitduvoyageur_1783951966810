# Handoff Report — Explorer M1: Apple Design Tokens & Primitives (LKDV Greens)

## 1. Observation

### 1.1 Architecture & Token Generators
- **Source of Truth**: `src/design/bank.ts` exports `export const bank: DesignBank` defining surfaces, inks, brand colors, glass materials, typography, radii, zIndex, spacing, motion, and 35 resolved ghost variables.
- **Generator Script**: `scripts/generate-design-bank.mjs` consumes `bank.ts` and outputs 7 targets:
  1. `src/styles/tokens.generated.css`
  2. `src/design/tokens.generated.ts`
  3. `tailwind.preset.generated.js` (ESM)
  4. `tailwind.preset.generated.cjs` (CJS)
  5. `ios/App/App/DesignTokens.generated.swift` (Swift UIKit / SwiftUI)
  6. `android/app/src/main/res/values/design_tokens.generated.xml`
  7. `android/app/src/main/java/com/lekitduvoyageur/app/LKDVTheme.generated.kt`
- **Synchronization Check**: `node scripts/generate-design-bank.mjs --check` runs with exit code 0 and reports all generated artifacts in sync with `src/design/bank.ts`.
- **TypeScript Integrity**: `npm run type-check` (`tsc --noEmit`) passes with exit code 0 and zero errors.

### 1.2 Pure Black (`#000000`, `black`, `rgb(0,0,0)`), `#0d1117`, and Dark Remnants Inventory
Direct grep observations across files:
1. **Dark Keyboard Configuration**:
   - `capacitor.config.ts:75`:
     ```ts
     Keyboard: {
       resize: "body" as any,
       style: "DARK" as any,
       resizeOnFullScreen: true,
     },
     ```
   - `ios/App/App/capacitor.config.json:33`:
     ```json
     "Keyboard": {
       "resize": "body",
       "style": "DARK",
       "resizeOnFullScreen": true
     }
     ```
2. **Residual `.dark` Styling Blocks in `src/styles/tokens.css`**:
   - Lines 633–750 (`.dark`):
     - `line 652`: `--lkv-app-bg-scrim: rgba(8, 10, 12, 0.88);`
     - `line 653`: `--lkv-app-bg-fallback: #0b0d12;`
     - `lines 655–660`: `--lkv-surface: #101C17; --lkv-surface-paper: #1B2D24; --lkv-surface-card: #1B2D24; --lkv-surface-elevated: #1F3328; --lkv-surface-muted: #182A21;`
     - `line 672`: `--lkv-overlay-scrim: rgba(0, 0, 0, 0.55);`
     - `line 674–675`: `--lkv-on-action: #08150F; --lkv-on-primary: #08150F;`
     - `line 706`: `--glass-shadow-final: 0 8px 32px rgba(0, 0, 0, 0.14)...`
     - `line 713`: `--glass-shadow-overlay: ... 0 24px 48px -16px rgba(0, 0, 0, 0.5);`
     - `line 714`: `--glass-shadow-sheet: ... 0 -4px 24px -8px rgba(0, 0, 0, 0.3);`
     - `line 725`: `--btn-shadow: 0 4px 14px rgba(0, 0, 0, 0.40), 0 1px 3px rgba(0, 0, 0, 0.30);`
     - `lines 731–732`: `--card-shadow: 0 4px 14px rgba(0, 0, 0, 0.40)...; --card-shadow-elevated: 0 10px 28px rgba(0, 0, 0, 0.48)...;`
     - `line 736`: `--material-sheet-bg: rgba(30, 32, 30, 0.62);`
     - `line 759`: `--glass-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);`
   - Lines 834–891 (`html.dark, .dark, [data-theme='dark']`):
     - `line 835`: `--glass-tint-rgb: 14 18 16;`
     - `lines 844–846`: `--glass-bg-light: rgba(18, 22, 20, 0.82); --glass-bg-medium: rgba(14, 18, 16...); --glass-bg-strong: rgba(14, 18, 16...);`
     - `lines 852–857`: `--g1-bg: rgba(14, 18, 16...); --g2-bg: rgba(22, 26, 24...); --g1-reduced-bg: #0E1210; --g2-reduced-bg: #161A18;`
     - `lines 869–870`: `--lkv-app-bg-scrim: rgba(8, 10, 12, 0.88); --lkv-app-bg-fallback: #0b0d12;`
     - `line 887–889`: `--lkv-on-action: #08150F; --btn-on-solid: #08150F; --lkv-on-primary: #08150F;`
   - Lines 919–956 & 978–982:
     - `.dark .glass-pill`, `.dark .leaflet-control-zoom a`, `.dark .leaflet-bar a`, `.dark .leaflet-control-attribution`
     - `line 971`: `border: 0.5px solid rgba(0, 0, 0, 0.15) !important;`
     - `line 976`: `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;`
   - Lines 1030 & 1039: `0 4px 16px rgba(0, 0, 0, 0.25);`, `0 4px 14px rgba(0,0,0,0.18);`
3. **Residual Blacks in Other Style Sheets**:
   - `src/styles/community-social.css`:
     - Line 660: `box-shadow: 0 24px 64px rgba(0, 0, 0, .35);`
     - Line 708: `text-shadow: 0 1px 5px #000;`
     - Lines 815–825: `.dark .lkdv-community-experience, [data-theme='dark'] .lkdv-community-experience`
     - Lines 1370–1380: `.dark .lkdv-context, [data-theme='dark'] .lkdv-context`
     - Line 1669: `text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);`
     - Lines 1762–1768: `.dark .lkdv-content-drawer, [data-theme='dark'] .lkdv-content-drawer`
   - `src/styles/liquid-glass.css:236`: `.dark .glass-pill`
   - `src/styles/tailwind.css:35`: `.dark` selector block.
   - `src/styles/explorer-v2.css`: Lines 98, 100, 102, 104, 449, 475 (`rgba(0, 0, 0, ...)` shadows).
   - `src/styles/liquid-ios27.css`: Lines 281, 294, 363, 754, 848, 872, 932, 977, 1085, 1130, 1136 (`rgba(0, 0, 0, ...)` shadows and text-shadows).
4. **Tailwind Configurations (`tailwind.config.js` & `tailwind.config.cjs`)**:
   - Line 5: `darkMode: 'class'`
   - Lines 70–71: `'dark-bg': { DEFAULT: 'var(--dark-bg)' }, 'dark-surface': { DEFAULT: 'var(--dark-surface)' }`
   - Line 184: `'live-dot': '0 2px 8px rgba(0,0,0,0.45)'`
   - Lines 145–156: `borderRadius` override diverges from `tailwind.preset.generated.cjs` (`xs: '8px'`, `sm: '12px'`, `md: '16px'`, `sheet: '36px'`).
5. **Messaging Specific Pure Blacks**:
   - `src/components/messaging/messages-grammar.css`:
     - Line 1395: `box-shadow: 0 4px 18px rgba(0, 0, 0, 0.22);` (attachment map bubble)
     - Line 1410: `box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);` (attachment image bubble)
   - `src/features/messaging/components/ComposerMenuSheet.tsx:324`:
     - `boxShadow: '0 2px 10px rgba(0,0,0,0.2)'`
   - `src/features/messaging/components/AudioPlayerBubble.tsx:139`:
     - Tailwind class `'border-black/5 ...'`
6. **Occurrence of `#0d1117`**:
   - No occurrences in active `src/` code (previously found only in historical commit `fb4f1a63` and references in documentation/PROJECT.md). The issue described in the audit report refers to the black transition flash when navigating from `/messagerie` to `/compte`.

### 1.3 Token Systems & Apple Primitives Discrepancies
Comparing `src/design/bank.ts` and `PROJECT.md` / `SCOPE.md` contracts:
1. **Continuous Corner Radii Discrepancy**:
   - `src/design/bank.ts:287–297`:
     ```ts
     radii: {
       xs: 12,
       sm: 16,
       md: 20,
       lg: 24,
       card: 28,
       hero: 38,
       sheet: 44,
       pill: 9999,
       concentricFloor: 20,
     }
     ```
   - Contract in `PROJECT.md:41` & `SCOPE.md:30–34`:
     ```ts
     radii: {
       sm: 8,
       md: 12,
       lg: 16,
       sheet: 28,
     }
     ```
   - In `ios/App/App/SceneDelegate.swift:301`, `sheet.preferredCornerRadius = 28` is already 28, directly supporting `radii.sheet = 28`.
2. **Sheet Grabber Definition**:
   - `src/design/bank.ts` does not define `grabber` or `sheetGrabber` tokens.
   - Contract in `PROJECT.md:42` & `SCOPE.md:35–37` requires:
     - Dimensions: `36 × 5pt`
     - Corner radius: `2.5pt`
     - Color: `rgba(23, 64, 44, 0.25)`
   - Currently, `src/components/ui/Sheet.tsx:149` has a hardcoded grabber:
     `<div className="h-1.5 w-12 rounded-full bg-[color:var(--lkv-text-muted)] opacity-40" />` (48 × 6px, wrong radius and color).
3. **Apple WebKit System Typography**:
   - WebKit system font shorthands (`font: -apple-system-body;`, `-apple-system-headline;`, `-apple-system-subheadline;`, `-apple-system-footnote;`, `-apple-system-caption1;`, `-apple-system-caption2;`) are not currently generated or exposed as CSS variables or utility classes.
4. **Swift Native Tokens Export**:
   - `scripts/generate-design-bank.mjs` generates `DesignTokens.generated.swift`, but currently lacks `DesignTokens.Grabber` and does not export the updated radii matching `radii.sheet = 28`.

### 1.4 Component Consumption & Messagerie Defects Analysis
1. **Header Navigation & Escape to `/compte`**:
   - `src/components/messaging/MessagesScreen.tsx:1468–1475`:
     ```tsx
     <button
       type="button"
       className="lg ig-handle"
       onClick={() => router.push('/compte')}
       onPointerEnter={() => router.prefetch('/compte')}
       onTouchStart={() => router.prefetch('/compte')}
       aria-label="Messages — aller au compte"
     >
     ```
   - `src/components/messaging/MessagesScreen.tsx:1479`: `<NotificationBell userId={currentUserId ?? undefined} />`
   - `src/components/ui/NotificationBell.tsx:29–36`: wraps `<Link href="/compte?tab=notifications">`.
   - Effect: Tapping either element forces navigation to `/compte`, causing the black flash.
2. **Filter SegmentedControl Collision**:
   - `src/components/messaging/MessagesScreen.tsx:1661–1677`:
     `<SubCapsuleTabs ... placement="float" showLabels={false} className="mfilters" />`
   - `src/components/messaging/messages-grammar.css:995–1005`:
     ```css
     .lkdv-messages .mfilters {
       position: absolute !important;
       right: 12px !important;
       bottom: 10px !important;
       z-index: 6 !important;
       width: 196px !important;
       height: 30px !important;
     }
     ```
   - Effect: The floating capsule hovers directly on top of the 4th conversation in `card-scroll`.
3. **Split View 40/60 Collision**:
   - `src/components/messaging/MessagesScreen.tsx:1682–1723`:
     `<button type="button" className="msplit" role="separator" ...>`
   - `src/components/messaging/messages-grammar.css:1909–1926`:
     `.lkdv-messages .mapzone > .msplit { position: absolute; top: 2px; left: 50%; transform: translateX(-50%); width: 88px; height: 22px; z-index: 8; }`
   - `src/components/messaging/MessagesScreen.tsx:1743`: `<button type="button" className="mpill" ...>`
   - `src/components/messaging/messages-grammar.css:360–371`:
     `.lkdv-messages .mpill { margin: 8px 12px 6px; min-height: 44px; z-index: 5; }`
   - Effect: 44pt overlap between `msplit` handle and `mpill` group pill, obscuring contact name and the first message.
4. **Drawers Stuck in Upper Card (`AccountDrawerHost variant="card"`)**:
   - `src/features/messaging/components/ComposerMenuSheet.tsx:5 & 238`: wraps menu in `<AccountDrawerHost variant="card" open={isOpen} ...>`.
   - `src/features/messaging/components/ConversationOptionsSheet.tsx:6 & 111`: wraps menu in `<AccountDrawerHost variant="card" open={isOpen} ...>`.
   - `src/design/account/AccountDrawerHost.tsx:23–24`: `DRAWER_INSET = { top: 48, left: 12, right: 12, bottom: 342.92 }`.
   - Effect: Menus open inside `#card` at `y=114..386` instead of opening at bottom of screen (bottom sheet `y >= 500pt`).
5. **Double Empty States & Inaccessible Button**:
   - `src/components/messaging/MessagesScreen.tsx:1598–1644`: renders `.mstate` empty state in conversation list when `visible.length === 0`.
   - `src/components/messaging/MessagesScreen.tsx:1801–1808`: simultaneously renders `.mstate` in `mapzone` when `selected === null`.
   - `src/components/messaging/MessagesScreen.tsx:1628`:
     `<button type="button" className="mbtn p" onClick={focusSearch} style={{ ... background: 'linear-gradient(180deg, #275d3f, #17402c)', color: '#fff' }}>`
   - Effect: Both empty states render on screen at once; button calls `focusSearch` rather than opening `NewConversationModal`.
6. **Group Chat Realtime Loading Freeze**:
   - `src/features/messaging/hooks/useConversations.ts:46`: `setLoading(true)` called inside `fetchConversations()`.
   - `src/features/messaging/hooks/useConversations.ts:84 & 96`: Realtime triggers call `fetchConversations()`.
   - `src/components/messaging/MessagesScreen.tsx:1582–1589`: when `loading === true`, conversation list is wiped and replaced by 4 gray skeleton elements:
     `[1, 2, 3, 4].map((row) => (<div className="mskel" ...>))`
7. **Reaction Emoji Overlay Clipped**:
   - `src/features/messaging/components/MessageBubble.tsx:217–239`: `<Card className="animate-scale-in z-[var(--z-dropdown)] mb-[var(--space-2)] flex items-center ...">` rendered inline in the flex column above the bubble instead of a fixed/portal overlay, shifting content and getting cropped by `.mpane-body` overflow container.

---

## 2. Logic Chain

1. **Premise 1 (Design System Centralization)**:
   Per `PROJECT.md` and `SCOPE.md`, `src/design/bank.ts` is the single source of truth for the LKDV Design System. If a token (such as `sheetGrabber` or Apple system typography) is not declared in `bank.ts`, components are forced to declare ad-hoc styles, leading to regressions such as `Sheet.tsx:149` (48×6px grabber) and `carnet-profile.css:353` (42×5px grabber).
2. **Premise 2 (Pure LKDV Greens & Zero Pure Black)**:
   The user request mandates "sans aucun noir pur" and elimination of dark backgrounds. Currently, `capacitor.config.ts:75` configures `style: "DARK"`, which forces the iOS native keyboard to render in dark mode over a light screen. `src/styles/tokens.css` retains 120+ lines of residual `.dark` styling containing `#0b0d12`, `#101C17`, and `rgba(0,0,0,...)`. Multiple component stylesheets (`messages-grammar.css:1395,1410`, `community-social.css:660,708`, `AudioPlayerBubble.tsx:139`) still declare raw black shadows and borders.
3. **Premise 3 (Continuous Corner Radii Alignment)**:
   `bank.ts:287–297` currently defines `radii.sm: 16, md: 20, lg: 24, sheet: 44`. The contract in `PROJECT.md:41` specifies `radii.sm: 8, md: 12, lg: 16, sheet: 28`. Furthermore, `ios/App/App/SceneDelegate.swift:301` already uses `sheet.preferredCornerRadius = 28`. Therefore, updating `bank.ts` and `scripts/generate-design-bank.mjs` directly reconciles the web design tokens with native Swift.
4. **Premise 4 (Swift & Web Generation)**:
   `node scripts/generate-design-bank.mjs` already compiles `bank.ts` to 7 targets. Adding `sheetGrabber`, system typography variables, and aligning radii in `bank.ts` automatically propagates the changes across CSS (`tokens.generated.css`), TypeScript (`tokens.generated.ts`), Tailwind preset (`tailwind.preset.generated.js/cjs`), and Swift (`DesignTokens.generated.swift`).
5. **Premise 5 (Messagerie Root Causes)**:
   The 8 defects identified in the audit report correspond to exact source code patterns:
   - Defect 1 (Header exit): Explicit `router.push('/compte')` in `MessagesScreen.tsx:1471` and `<NotificationBell>` link in `NotificationBell.tsx:30`.
   - Defect 2 (Filter overlap): Absolute positioning (`bottom: 10px; right: 12px`) of `SubCapsuleTabs` in `messages-grammar.css:997–1000`.
   - Defect 3 (Split view collision): Overlapping layout of `.msplit` (`top: 2px; left: 50%`) and `.mpill` (`margin: 8px 12px 6px`).
   - Defect 4 (Drawer placement): Usage of `AccountDrawerHost variant="card"` in `ComposerMenuSheet.tsx:238` and `ConversationOptionsSheet.tsx:111`.
   - Defect 5 (Double empty states): Two concurrent empty state renders in `MessagesScreen.tsx:1598` and `1801`.
   - Defect 6 (Group freeze): Unconditional `setLoading(true)` in `useConversations.ts:46`.
   - Defect 7 (Shared post error): Unstyled fallback in `SharedPostEmbed.tsx:71`.
   - Defect 8 (Reaction clipping): Inline rendering in `MessageBubble.tsx:217` instead of a floating overlay.

---

## 3. Caveats

1. **Existing Test Dependency on `DARK_SELECTOR`**:
   The test file `src/features/adventure-prep/__tests__/prep-dark-ink.test.ts:31` directly reads `src/styles/tokens.css` and parses `DARK_SELECTOR = "html.dark, .dark, [data-theme='dark']"`, asserting on `--lkv-action` and `--lkv-on-action`. If that selector block is completely deleted without updating or harmonizing `prep-dark-ink.test.ts`, that test will fail. All pure black and dark values inside it must be converted to LKDV forest greens, or the test updated in coordination.
2. **UI Radius Test Constraint (`radius.spec.ts`)**:
   `tests/design/radius.spec.ts:35` rejects class names matching `rounded-sm`, `rounded-xs`, or `rounded-[1-11px]` in `src/components/ui/` (with an exception only for checkbox). If `radii.sm` in `tailwind.config.js` is mapped to `8px`, using `rounded-sm` in `src/components/ui/` would trigger this test. The implementer should ensure `radius.spec.ts` remains passing.
3. **Pure Mask Composites in WebKit CSS**:
   Instances of `#000` in `liquid-ios27.css:342` and `carnet-profile.css:369` are CSS mask gradients (`linear-gradient(#000 0 0)` and `-webkit-mask-image`). In CSS masks, `#000` is used purely as an alpha stencil and produces no visible black pixel. These do not violate the visual palette, but should be documented so implementers do not mistakenly break mask compositing.

---

## 4. Conclusion

1. **Single Source of Truth (`src/design/bank.ts`)**:
   - Add `sheetGrabber` token object:
     ```ts
     export interface SheetGrabberTokens {
       readonly width: number;  // 36
       readonly height: number; // 5
       readonly radius: number; // 2.5
       readonly color: string;  // 'rgba(23, 64, 44, 0.25)'
     }
     ```
   - Update `radii` to match Apple Design Resources & `SceneDelegate.swift`:
     `radii.sm = 8, radii.md = 12, radii.lg = 16, radii.sheet = 28`.
   - Add Apple WebKit System Typography primitives (`-apple-system-body`, `-apple-system-headline`, `-apple-system-subheadline`, `-apple-system-footnote`, `-apple-system-caption1`, `-apple-system-caption2`).
2. **Generator Script (`scripts/generate-design-bank.mjs`)**:
   - Emit CSS variables for grabber (`--lkv-grabber-width: 36px;`, `--lkv-grabber-height: 5px;`, etc.).
   - Emit CSS system font primitives.
   - Update `generateSwift` to export `DesignTokens.Grabber` and aligned `DesignTokens.Radii`.
3. **Elimination of Pure Black & Dark Keyboard**:
   - Update `capacitor.config.ts:75` from `style: "DARK"` to `style: "LIGHT"`.
   - Update `ios/App/App/capacitor.config.json:33` from `"style": "DARK"` to `"style": "LIGHT"`.
   - Sanitize residual `rgba(0, 0, 0, ...)` shadows in `tokens.css`, `messages-grammar.css`, `community-social.css`, `ComposerMenuSheet.tsx`, and `AudioPlayerBubble.tsx` to forest green tint `rgba(23, 64, 44, ...)`.
   - Neutralize or harmonize `.dark` styling in `tokens.css` while maintaining compatibility with `prep-dark-ink.test.ts`.
4. **Component Standardizations**:
   - Update `src/components/ui/Sheet.tsx:149` to use the 36×5pt grabber (`w-[36px] h-[5px] rounded-[2.5px] bg-[rgba(23,64,44,0.25)]`).
   - For Milestone M2: Migrate `ComposerMenuSheet` and `ConversationOptionsSheet` to use `src/components/ui/Sheet.tsx` as bottom sheets.

---

## 5. Verification Method

1. **Verify Token Generation**:
   ```bash
   node scripts/generate-design-bank.mjs
   node scripts/generate-design-bank.mjs --check
   ```
   *Expected outcome*: Exit code 0, all 7 artifacts updated and in sync.
2. **Verify Swift Token Validity**:
   ```bash
   swiftc -typecheck ios/App/App/DesignTokens.generated.swift
   ```
   *Expected outcome*: Valid Swift compilation with no syntax errors.
3. **Verify Zero Black & Zero `#0d1117`**:
   ```bash
   grep -rn "#0d1117" src/
   grep -rn -E 'style:\s*"DARK"' capacitor.config.ts ios/App/App/capacitor.config.json
   ```
   *Expected outcome*: 0 matches.
4. **Verify TypeScript & Automated Tests**:
   ```bash
   npm run type-check
   npx vitest run tests/design/tokens-sync.spec.ts tests/design/radius.spec.ts tests/design/unification.spec.ts tests/design-system/primitives.spec.ts tests/capacitor-release-config.spec.ts
   ```
   *Expected outcome*: All test suites pass with 0 failures.
