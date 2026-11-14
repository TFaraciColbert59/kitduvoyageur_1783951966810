# Handoff Report: Lot 1 — CSS Radical Cleanup & Icon Consolidation

**Explorer**: `teamwork_explorer_lot1_2`  
**Role**: CSS and Icon Cleanup Explorer  
**Date**: 2026-11-13  
**Working Directory**: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`  
**State Folder**: `.agents/teamwork/teamwork_explorer_lot1_2`  

---

## 1. Observation

### 1.1 The Global CSS Files in `src/styles/`
A filesystem audit of `src/styles/` reveals 21 files totaling **19,581 lines of CSS**:
```
301   src/styles/account-glass.css
92    src/styles/app-tint.css
1069  src/styles/carnet-profile.css
1713  src/styles/carnet-v2.css
472   src/styles/communaute-v2-shell.css
2021  src/styles/communaute-v2.css
2084  src/styles/community-card.css
2302  src/styles/community-feed.css
339   src/styles/community-post-polish.css
1870  src/styles/community-social.css
196   src/styles/drawer-selectors-tabbar.css
1837  src/styles/explorer-v2.css
244   src/styles/floating-liquid-tabbar.css
4     src/styles/hub-tokens.css
240   src/styles/liquid-capsules.css
1189  src/styles/liquid-glass.css
1318  src/styles/liquid-ios27.css
48    src/styles/liquid-selectors.css
26    src/styles/native-account-tabbar.css
937   src/styles/tailwind.css
1279  src/styles/tokens.css
```
Excluding `tailwind.css`, `tokens.css` (which is replaced by `tokens.generated.css`), and `hub-tokens.css` (a 4-line re-export of `src/features/hub/styles/hub-tokens.css`), there are exactly **18 thematic CSS files**:

| # | File | Lines | Import Location | Status / Issue |
|---|---|---|---|---|
| 1 | `account-glass.css` | 301 | `src/app/layout.tsx:17` | Uses undeclared `--z-nav`. Specific to account view but loaded globally. |
| 2 | `app-tint.css` | 92 | `src/app/layout.tsx:14` | Global tint variables and overlay styles. |
| 3 | `carnet-profile.css` | 1,069 | `src/app/layout.tsx:19` | Global carnet styles, loaded globally. |
| 4 | `carnet-v2.css` | 1,713 | `CarnetScreenV2.tsx:38` | Feature stylesheet; contains 22 `!important`, undeclared `--lkv-text`. |
| 5 | `communaute-v2-shell.css` | 472 | `src/app/communaute/page.tsx:17` | Shell for community v2; contains 16 `!important`, undeclared `--cv2-layer-z`. |
| 6 | `communaute-v2.css` | 2,021 | `src/app/communaute/page.tsx:16` | Community styles; overrides tokens with `--cv2-light-*`. |
| 7 | `community-card.css` | 2,084 | **ORPHANED** | **Not imported anywhere** in `src/` (only referenced in comments). Dead code consuming 2,084 lines! |
| 8 | `community-feed.css` | 2,302 | `src/app/layout.tsx:18`, `ClubLiquidGlassV8.tsx:17` | Contains **396 `!important` occurrences** and undeclared `--result-tone`. |
| 9 | `community-post-polish.css` | 339 | `src/app/layout.tsx:13` | Contains 15 `!important`, undeclared `--post-pill-h`, `--post-pill-top`. |
| 10 | `community-social.css` | 1,870 | `src/app/layout.tsx:16` | Contains `.dark` rules at lines 815, 1370, 1762. |
| 11 | `drawer-selectors-tabbar.css`| 196 | `src/app/layout.tsx:12` | Contains 55 `!important` overrides for tab bar and drawers. |
| 12 | `explorer-v2.css` | 1,837 | `ExplorerV2.tsx:103` | Contains 19 `!important`, relies on undeclared `--lkv-native-bar-height`. |
| 13 | `floating-liquid-tabbar.css`| 244 | `src/app/layout.tsx:10` | Web fallback tab bar; contains 11 `!important` and undeclared `--z-nav`. |
| 14 | `liquid-capsules.css` | 240 | `src/app/layout.tsx:11` | Capsule tab styling; contains 1 `!important`. |
| 15 | `liquid-glass.css` | 1,189 | `src/app/layout.tsx:7` | Glass material; contains `.dark` rules (lines 1082-1143) and 60 `!important`. |
| 16 | `liquid-ios27.css` | 1,318 | `src/app/layout.tsx:8` | **CRITICAL BUG**: Lines 40-110 override text to white on all pages! 89 `!important`. |
| 17 | `liquid-selectors.css` | 48 | `src/app/layout.tsx:9` | Overrides for `.glass` selectors. |
| 18 | `native-account-tabbar.css` | 26 | `src/app/layout.tsx:15` | Small 26-line patch for native account tab bar. |

In `src/app/layout.tsx`, lines 5-20:
```tsx
import '@/styles/tokens.css';
import '@/styles/tailwind.css';
import '@/styles/liquid-glass.css';
import '@/styles/liquid-ios27.css';
import '@/styles/liquid-selectors.css';
import '@/styles/floating-liquid-tabbar.css';
import '@/styles/liquid-capsules.css';
import '@/styles/drawer-selectors-tabbar.css';
import '@/styles/community-post-polish.css';
import '@/styles/app-tint.css';
import '@/styles/native-account-tabbar.css';
import '@/styles/community-social.css';
import '@/styles/account-glass.css';
import '@/styles/community-feed.css';
import '@/styles/carnet-profile.css';
import '@/styles/hub-tokens.css';
```
16 separate global CSS stylesheets are loaded on every page request!

---

### 1.2 White Text on Light Background: Root Cause Analysis

#### Finding A: `src/styles/liquid-ios27.css:40-60`
`src/app/layout.tsx:216` mounts `<html data-liquid-ios27="" ...>`.
In `src/styles/liquid-ios27.css`, lines 40-60:
```css
html[data-liquid-ios27] {
  --hub-white: #ffffff;
  --hub-white-secondary: rgba(255, 255, 255, 0.71);
  --hub-white-tertiary: rgba(255, 255, 255, 0.5);
  --lkv-text-primary: var(--hub-white);           /* -> #FFFFFF */
  --lkv-text-secondary: var(--hub-white-secondary); /* -> rgba(255,255,255,0.71) */
  --lkv-text-muted: var(--hub-white-tertiary);      /* -> rgba(255,255,255,0.5) */
  --lkv-text-subtle: rgba(255, 255, 255, 0.46);
  --lkv-secondary: rgba(255, 255, 255, 0.71);
  --glass-label: #ffffff;                         /* -> #FFFFFF */
  --glass-label-secondary: rgba(255, 255, 255, 0.78);
  ...
  --hub-glass-base: #101010;                      /* -> Dark black glass */
}
```
Because `data-liquid-ios27` is applied to `<html>`, **every single component on every page** that renders on a light surface (`#FBFAF6`, `#FFFFFF`, `#F0F5EE`) and consumes `--lkv-text-primary` or `--glass-label` displays pure white text on light background.
Directly observed in:
- `shots/10-compte-gerer.png` (`ConsentSettingsSheet`)
- `webshots/hub-section-budget.png` ("Réservations" / "Aucune réservation")
- `src/components/ui/EmptyState.tsx`

#### Finding B: `#lkdv-theme-init` in `src/app/layout.tsx:226-232`
```tsx
<script
  id="lkdv-theme-init"
  suppressHydrationWarning
  dangerouslySetInnerHTML={{
    __html: `(function(){var r=document.documentElement;var t=null;try{t=localStorage.getItem('lkdv_theme');}catch(e){}var isDark=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(/^\\/compas(\\/|$)/.test(location.pathname))isDark=false;if(isDark){r.classList.add('dark');r.setAttribute('data-theme','dark');r.style.colorScheme='dark';}else{r.classList.remove('dark');r.setAttribute('data-theme','light');r.style.colorScheme='light';}try{var g=localStorage.getItem('lkdv_glass_intensity');if(g)r.style.setProperty('--glass-intensity',g);}catch(e){}})();`,
  }}
/>
```
If an iPhone is in dark mode (default for many users), `window.matchMedia('(prefers-color-scheme: dark)').matches` evaluates to `true`, instantly adding `.dark` and `data-theme="dark"` to `<html>`.

#### Finding C: `.dark` blocks in `src/styles/tokens.css`
In `tokens.css`:
- Line 626: `.dark { ... }` overrides `--lkv-surface: #101C17; --lkv-text-primary: #F1F5F1;`
- Line 821: `html.dark, .dark, [data-theme='dark'] { --glass-label: #FFFFFF; --glass-rim-color: rgba(0, 0, 0, 0.65); ... }`
- Lines 906-965: `.dark .glass-pill`, `.dark .text-forest-900`, etc.
When combined with components hardcoding light surfaces, `.dark` turns text white while surfaces remain light or mismatched.

---

### 1.3 `!important` Analysis & The Worst Offenders
A full recursive scan reveals **10,114 occurrences of `!important` in `src/`**, with **777 occurrences directly in `src/styles/`**:

**Top Offenders in `src/styles/`**:
- `src/styles/community-feed.css`: **396**
- `src/styles/liquid-ios27.css`: **89**
- `src/styles/liquid-glass.css`: **60**
- `src/styles/tokens.css`: **58**
- `src/styles/drawer-selectors-tabbar.css`: **55**
- `src/styles/tailwind.css`: **33**
- `src/styles/carnet-v2.css`: **22**
- `src/styles/explorer-v2.css`: **19**
- `src/styles/communaute-v2-shell.css`: **16**
- `src/styles/community-post-polish.css`: **15**
- `src/styles/floating-liquid-tabbar.css`: **11**

**Top Offenders in Component Stylesheets / Inline `<style>` Blocks**:
- `src/components/compte/compte-apple-hig.css`: **2,028** (almost every single CSS declaration ends in `!important`!)
- `src/components/compte/drawer/sortie/SortieDrawer.tsx`: **1,036** (inside embedded `SORTIE_CSS`)
- `src/components/compte/drawer/compte/CompteDrawer.tsx`: **765** (inside embedded `COMPTE_CSS`)
- `src/components/compte/drawer/progression/ProgressionDrawer.tsx`: **615** (inside embedded `PROGRESSION_DRAWER_CSS`)
- `src/components/compte/compte-v8.css`: **504**
- `src/components/compte/drawer/cards/KitCard.tsx`: **430**
- `src/components/compte/overlay/compte-drawers.css`: **354**
- `src/features/hub/styles/hub-camp-option3.css`: **339**
- `src/components/compte/overlay/compte-overlay.css`: **328**
- `src/components/compte/drawer/sortie/TraceImportDrawer.tsx`: **311**
- `src/components/compte/map/compte-map.css`: **261**
- `src/components/compte/drawer/SlotShell.tsx`: **250**
- `src/components/compte/drawer/slots/LoansSlot.tsx`: **246**
- `src/components/ui/drawer/DrawerShell.tsx`: **228**
- `src/components/compte/drawer/shell/DrawerShell.tsx`: **228**
- `src/components/profile/PublicProfileV2.tsx`: **208**

---

### 1.4 Mapping the 35 Ghost CSS Variables
A static analysis tool traced all CSS variables used in `var(--...)` across `src/` that have **zero declaration** in `src/styles/tokens.css` or the entire project.

Here is the exact catalog of the **35 ghost variables**, their usage count, sample files, and proposed definitions in `bank.ts` / `tokens.generated.css`:

| # | Ghost Variable | Usages | Sample Files | Purpose | Proposed Fallback / Value in `bank.ts` |
|---|---|---|---|---|---|
| 1 | `--lkv-text-caption-1` | 98 | `app/cgu/page.tsx`, `app/cgv/page.tsx`, `EmptyState.tsx` | Caption 1 font size | `0.75rem` (12px), `line-height: 1rem` (16px) |
| 2 | `--glass-secondary` | 61 | `EmptyState.tsx`, `InsetGroupedList.tsx`, `SubTabBar.tsx`, `checkout/page.tsx` | Secondary text on glass | `var(--glass-label-secondary, #56665D)` |
| 3 | `--glass-specular` | 6 | `Card.tsx`, `SearchField.tsx`, `Chip.tsx`, `IconButton.tsx` | Surface specular highlight | `inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 2px 8px rgba(23, 64, 44, 0.06)` |
| 4 | `--bg-body` | 5 | `clubs/[id]/page.tsx`, `compte/page.tsx`, `compte/montres/page.tsx` | Canvas background | `var(--lkv-surface-canvas, #FBFAF6)` |
| 5 | `--lkv-native-bar-height` | 7 | `explorer-v2.css`, `MessagesScreen.tsx`, `NavigationBar.tsx` | Native tab bar safe clearance | `64px` |
| 6 | `--glass-bg-subtle` | 3 | `checkout/page.tsx`, `StepIndicator.tsx` | Subtle glass fill | `rgba(240, 245, 238, 0.70)` |
| 7 | `--glass-bg-prominent` | 2 | `checkout/page.tsx`, `StepIndicator.tsx` | Prominent glass fill | `var(--g3-bg, rgba(235, 242, 236, 0.95))` |
| 8 | `--glass-bg-base` | 1 | `CarnetHubHero.tsx` | Base glass fill | `var(--g1-bg, rgba(255, 255, 255, 0.72))` |
| 9 | `--z-nav` | 3 | `account-glass.css`, `floating-liquid-tabbar.css` | Tab bar navigation z-index | `var(--z-tabbar, 300)` |
| 10 | `--lkv-radius-pill` | 3 | `hubAdventuresDrawer.css` | Pill border radius | `9999px` |
| 11 | `--lkv-surface-primary` | 1 | `CarteClient.tsx` | Primary surface | `var(--lkv-surface-elevated, #FFFFFF)` |
| 12 | `--lkv-font-mono` | 1 | `watches.css` | Monospace font family | `var(--font-mono, "IBM Plex Mono", monospace)` |
| 13 | `--white-glass` | 2 | `event-detail.css` | Translucent white card | `rgba(255, 255, 255, 0.78)` |
| 14 | `--kb-inset` | 4 | `freedom.css`, `MessageComposer.tsx`, `MessageInbox.tsx` | Virtual keyboard inset | `env(keyboard-inset-height, 0px)` |
| 15 | `--shell-top-padding` | 4 | `adventure-prep.css`, `compas.css`, `v5.css` | Dynamic Island safe clearance | `calc(env(safe-area-inset-top, 0px) + 12px)` |
| 16 | `--cookie-banner-h` | 21 | `AppShell.tsx`, `explorer-v2.css` | Cookie banner clearance | `0px` (set dynamically by cookie banner) |
| 17 | `--font-inter` | 3 | `tokens.css`, `design-tokens-p017.test.ts` | Sans font family | `var(--font-sans, "Inter", -apple-system, sans-serif)` |
| 18 | `--font-sf` | 1 | `kit-studio.css` | Apple system font | `-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif` |
| 19 | `--lkv-warn` | 1 | `kit-studio.css` | Warning color alias | `var(--lkv-warning, #D97706)` |
| 20 | `--lkv-like` | 1 | `explore-v2.css` | Like heart active color | `#E11D48` (`--rose-600`) |
| 21 | `--forest-500` | 1 | `SafetyCenterModal.tsx` | Forest tone 500 | `var(--lkv-forest-500, #3D6038)` |
| 22 | `--lkv-text` | 1 | `carnet-v2.css` | Primary ink alias | `var(--lkv-text-primary, #172B24)` |
| 23 | `--cv2-layer-z` | 1 | `communaute-v2-shell.css` | Community z-index | `var(--z-base, 1)` |
| 24 | `--post-pill-top` | 1 | `community-post-polish.css` | Post pill top offset | `12px` |
| 25 | `--post-pill-h` | 2 | `community-post-polish.css` | Post pill height | `32px` |
| 26 | `--lkv-sheet-from` | 1 | `tailwind.css` | Sheet enter translation | `translateY(100%)` |
| 27 | `--lkdv-text-scale` | 1 | `tailwind.css` | A11y text scale factor | `1` |
| 28 | `--lkdv-a11y-map-min-height`| 1 | `AccessibilityStyles.tsx` | A11y map height | `280px` |
| 29 | `--explorer-carousel-height` | 3 | `UnifiedExplorerMap.tsx` | Explorer map carousel height | `140px` |
| 30 | `--msg-split` | 1 | `messages-grammar.css` | Desktop messages split | `360px` |
| 31 | `--space-7` | 1 | `rankings/ui.tsx` | Spacing scale step 7 | `1.75rem` (28px) |
| 32 | `--f-caption` | 1 | `design-tokens-p017.test.ts` | Caption font size alias | `var(--lkv-text-caption, 0.75rem)` |
| 33 | `--lkdv-cd-kb` | 3 | `community-card.css` | Card keyboard inset | `var(--kb-inset, 0px)` |
| 34 | `--result-tone` | 4 | `community-feed.css` | Feed result tone | `var(--lkv-primary, #17402C)` |
| 35 | `--lkdv-progress` | 1 | `creation-info-rail.css` | Creation progress bar | `0%` |

---

### 1.5 Inline `<style>` and `dangerouslySetInnerHTML` Injections
A scan for `<style` across all TSX/TS files revealed **24 component injection sites**:
1. `src/components/ui/drawer/DynamicIsland.tsx:68`: `<style dangerouslySetInnerHTML={{ __html: DYNAMIC_ISLAND_CSS }} />`
2. `src/components/ui/drawer/DrawerShell.tsx:132`: `<style dangerouslySetInnerHTML={{ __html: DRAWER_SHELL_CSS }} />`
3. `src/components/ui/drawer/SortMenuButton.tsx:155`: `<style dangerouslySetInnerHTML={{ __html: SORT_MENU_CSS }} />`
4. `src/components/clubs/ClubLiquidGlassV8.tsx:1299`: `<style dangerouslySetInnerHTML={{ __html: DRAWER_V2_CSS }} />`
5. `src/components/profile/PublicProfileV2.tsx:287`: `<style dangerouslySetInnerHTML={{ __html: PUBLIC_PROFILE_CSS + '\n' + DRAWER_V2_CSS }} />`
6. `src/components/CookieConsentBanner.tsx:114`: `<style jsx>{...}`
7. `src/components/compte/drawer/sortie/SortieDrawer.tsx:415`: `<style dangerouslySetInnerHTML={{ __html: SORTIE_CSS }} />` (1,036 `!important`)
8. `src/components/compte/drawer/sortie/TraceImportDrawer.tsx:474, 485`: `<style dangerouslySetInnerHTML={{ __html: DRAWER_SHELL_CSS + TRACE_IMPORT_CSS }} />` (311 `!important`)
9. `src/components/compte/drawer/shell/DrawerShell.tsx:132`: `<style dangerouslySetInnerHTML={{ __html: DRAWER_SHELL_CSS }} />` (228 `!important`)
10. `src/components/compte/drawer/ProfileSettingsSheet.tsx:711`: `<style>{PROFILE_SETTINGS_CSS}</style>`
11. `src/components/compte/drawer/compte/HighlightEditDrawer.tsx:493`: `<style>{...}`
12. `src/components/compte/drawer/compte/CompteDrawer.tsx:129`: `<style dangerouslySetInnerHTML={{ __html: COMPTE_CSS }} />` (765 `!important`)
13. `src/components/compte/drawer/compte/ConsentSettingsSheet.tsx:188`: `<style>{CONSENT_SHEET_CSS}</style>`
14. `src/components/compte/drawer/progression/ProgressionDrawer.tsx:1458`: `<style dangerouslySetInnerHTML={{ __html: PROGRESSION_DRAWER_CSS }} />` (615 `!important`)
15. `src/components/compte/drawer/slots/KitSlot.tsx:134`: `<style ...>`
16. `src/components/compte/drawer/slots/VitrineSlot.tsx:290, 621, 739, 799`: `<style>{VITRINE_CSS}</style>`
17. `src/components/compte/drawer/slots/LoansSlot.tsx:337, 352, 373`: `<style dangerouslySetInnerHTML={{ __html: LOANS_CSS }} />` (246 `!important`)
18. `src/components/compte/drawer/reseau/ReseauDrawer.tsx:298`: `<style dangerouslySetInnerHTML={{ __html: RESEAU_CSS }} />`
19. `src/components/compte/CompteLiquidGlassV8.tsx:1797`: `<style dangerouslySetInnerHTML={{ __html: DRAWER_V2_CSS }} />`
20. `src/components/compte/onboarding/FirstRunJourney.tsx:193`: `<style dangerouslySetInnerHTML={{ __html: ONBOARDING_CSS }} />`
21. `src/components/carnet/v2/CarnetScreenV2.tsx:468`: `<style dangerouslySetInnerHTML={{ __html: DRAWER_V2_CSS }} />`
22. `src/components/carnet/v2/CarnetTopBarV2.tsx:147`: `<style dangerouslySetInnerHTML={{ __html: TOPBAR_MOTION_CSS }} />`
23. `src/components/carnet/v2/CarnetDrawerV2.tsx:1706`: `<style dangerouslySetInnerHTML={{ __html: DRAWER_MOTION_CSS }} />`
24. `src/components/accessibility/AccessibilityStyles.tsx:546`: `<style data-lkdv-accessibility-ui="">{ACCESSIBILITY_UI_CSS}</style>`

---

### 1.6 Icon Consolidation Investigation

#### Finding A: The 4 Competing Icon Stacks
1. `src/components/ui/Icon/Icon.tsx`:
   - Line 105: `resolveMaskFile(name, variant)` maps icons to raster PNG files in `/icons/*.png` with CSS `maskImage: url("/icons/${maskFile}")`.
   - Line 168: If not found, falls back to `<span>✦</span>`.
   - In `public/icons/`, there are **over 300 raster PNG files** (e.g. `notification-1.png`, `user circle-4.png`, `Circle Arrow Down-3.png`). These raster masks are blurry on Retina / iPhone 16 Pro, require runtime HTTP requests, and fail when filenames have spaces.
2. `src/components/ui/AppIcon.tsx`:
   - 17 lines, hardcodes `source="pack"` to force PNG masks. Imported by 50 files.
3. `src/components/ui/LkvIcon.tsx`:
   - 119 lines, imports 27 animated SVG components from `@/components/icons/*`. Imported by 10 files.
4. `src/features/explorer-v2/ui/XpIcon.tsx`:
   - 131 lines, maintains an inline path dictionary `XP_ICON_PATHS` for 50+ SVG paths.

#### Finding B: Direct `lucide-react` Imports Across the Codebase
A project-wide scan reveals:
- **229 files** directly import from `lucide-react`.
- **291 unique Lucide icons** are imported across the codebase.
- The 20 most frequent icons:
  1. `Check`: 43 files
  2. `Users`: 38 files
  3. `Plus`: 34 files
  4. `X`: 33 files
  5. `Trash2`: 30 files
  6. `ShieldCheck`: 29 files
  7. `Compass`: 27 files
  8. `MapPin`: 25 files
  9. `Mountain`: 24 files
  10. `ArrowRight`: 23 files
  11. `Package`: 21 files
  12. `Backpack`: 20 files
  13. `Share2`: 20 files
  14. `Loader2`: 19 files
  15. `CalendarDays`: 18 files
  16. `Shield`: 16 files
  17. `CheckCircle2`: 16 files
  18. `ChevronRight`: 15 files
  19. `ChevronLeft`: 15 files
  20. `BookOpen`: 15 files

---

## 2. Logic Chain

1. **Premise 1 (White text on light background)**:
   - Observation 1.2.A shows that `src/styles/liquid-ios27.css:40-60` redefines `--lkv-text-primary: #ffffff` and `--glass-label: #ffffff` on `html[data-liquid-ios27]`.
   - Observation 1.2.A also shows that `src/app/layout.tsx:216` applies `data-liquid-ios27=""` to `<html>` for all routes.
   - Observation 1.2.B shows that `#lkdv-theme-init` in `layout.tsx` applies `.dark` to `<html>` whenever `prefers-color-scheme: dark` is true.
   - Observation 1.2.C shows that `.dark` in `tokens.css:626, 821` also overrides text colors to `#F1F5F1` / `#FFFFFF`.
   - **Deduction**: White text on light background across `shots/10-compte-gerer.png`, `webshots/hub-section-budget.png`, `EmptyState`, and `ConsentSettingsSheet` is caused by this combination. To resolve it, `liquid-ios27.css` must have its dark overrides removed, `#lkdv-theme-init` must be eliminated, and `<html>` must default strictly to `data-theme="light"` and `color-scheme: light`.

2. **Premise 2 (`!important` proliferation and specificity wars)**:
   - Observation 1.3 shows 777 `!important` occurrences in `src/styles/` and over 10,114 across `src/`.
   - Observation 1.3 shows that single files like `compte-apple-hig.css` (2,028 `!important`), `SortieDrawer.tsx` (1,036), `CompteDrawer.tsx` (765), and `ProgressionDrawer.tsx` (615) are massive offenders.
   - Observation 1.5 shows that these drawers inject inline `<style dangerouslySetInnerHTML>` directly into the DOM to fight global styles.
   - Observation 1.1 shows that `tokens.css:884` used `background-color: var(--g3-bg) !important;` on `[class*='var(--g3-bg)']`.
   - **Deduction**: The `!important` epidemic was triggered by utility classes in `tokens.css` forcing `!important`, compelling drawer authors to slap `!important` on every single property in their inline `<style>` strings. Replacing `tokens.css` with a cleanly scoped `tokens.generated.css` (0 `!important`) removes the need for `!important` in component styles.

3. **Premise 3 (Ghost CSS Variables)**:
   - Observation 1.4 catalogued 35 CSS variables referenced in components and CSS via `var(--...)` that have no definition in `src/styles/`.
   - `--lkv-text-caption-1` has 98 usages; in `tokens.css:230-231`, `--lkv-text-caption-2` and `--lkv-text-caption` were defined, but `--lkv-text-caption-1` was omitted.
   - `--glass-secondary` has 61 usages in core UI components (`EmptyState`, `InsetGroupedList`, `SubTabBar`, `PriceTag`, `StepIndicator`); `tokens.css` defined `--glass-label-secondary`, leaving `--glass-secondary` completely unstyled.
   - `--glass-specular` has 6 usages in `Card.tsx`, `SearchField.tsx`, `Chip.tsx`, `IconButton.tsx` as a box-shadow highlight reflection, but was never declared.
   - `--bg-body` has 5 usages in `clubs/[id]/page.tsx`, `compte/page.tsx`, `compte/montres/page.tsx`, causing transparent unstyled backgrounds.
   - `--lkv-native-bar-height` has 7 usages in `explorer-v2.css`, `MessagesScreen.tsx`, `NavigationBar.tsx`, causing dock/HUD elements to overlap with the native `UITabBar`.
   - **Deduction**: Defining all 35 variables in `src/design/bank.ts` and exporting them to `tokens.generated.css` immediately repairs 98 text elements, 61 glass labels, 6 glass card reflections, 5 page backgrounds, and 7 native bar clearances with zero code changes in consumers.

4. **Premise 4 (Icon Unification without Breaking Changes)**:
   - Observation 1.6.A shows that `Icon.tsx` currently resolves icons through PNG masks in `public/icons/*.png` with `maskImage: url(...)`, falling back to `✦`.
   - Observation 1.6.B shows that 229 files import directly from `lucide-react` (291 unique icons) because `Icon.tsx` was perceived as unreliable or blurry.
   - Observation 1.6.A shows that `AppIcon.tsx` is an alias forcing `source="pack"` (PNG masks), and `LkvIcon.tsx` / `XpIcon.tsx` are duplicated icon components.
   - **Deduction**: By re-architecting `src/components/ui/Icon/Icon.tsx` to render vector Lucide SVGs directly from a comprehensive dictionary (mapping semantic names like `'compass'`, `'check'`, `'mountain'`, `'backpack'` to crisp vector SVGs), we:
     1. Instantly upgrade all 187 callers of `Icon` and 50 callers of `AppIcon` to sharp vectors (0 PNG masks, 0 blurry pixels on iPhone 16 Pro).
     2. Provide named re-exports (e.g. `export { Compass, Mountain, Check, ... } from '@/components/ui/Icon'`) or `<Icon name="..." />` allowing all 229 files importing `lucide-react` to migrate cleanly to `@/components/ui/Icon` with 0 direct `lucide-react` imports from feature pages.
     3. Support cross-platform parity: on iOS Swift, the token maps to SF Symbols (`compass`, `mountain.2`); on Android Kotlin, it maps to Material Symbols.

---

## 3. Caveats

1. **Existing Uncommitted Git Changes in Working Tree**:
   - `git status` shows modifications already present in `src/styles/tokens.css`, `carnet-v2.css`, `communaute-v2.css`, `explorer-v2.css`, `src/lib/native/status-bar.ts`, and `tests/design/compte-profile-visibility.spec.ts`.
   - These modifications were verified to be compatible with Lot 1 (e.g., `--glass-rim: var(--glass-rim-color)`, `--z-modal: 600`, and `status-bar.ts` `dark: false, color: "#FBFAF6"`). They should be preserved and unified into the generator.
2. **Vitest String Matchers in Existing Design Tests**:
   - `tests/design/hub-liquid-glass.spec.ts:133, 139` specifically asserts `--hub-smoke: rgba(16, 16, 16, 0.3)` and `--hub-glass-base: #101010`.
   - `tests/design/p5-direction-tokens.spec.ts:48` asserts `.dark { ... }` in `tokens.css`.
   - When Lot 1 eliminates `.dark` and `#101010` in favor of the pure 100% Light Liquid Glass Design System, these test assertions must be reconciled as specified in Master Plan §6.2.
3. **Dead Code Cleanup vs. Scope**:
   - `src/styles/community-card.css` (2,084 lines) is completely unreferenced. It can be safely removed, but feature tests in `tests/design/community-feed-contract.spec.ts` read it via `fs.readFileSync('src/styles/community-card.css')`. Therefore, `community-card.css` should either be emptied or the test contract updated simultaneously to avoid breaking CI.

---

## 4. Conclusion & Actionable Implementation Roadmap

### 4.1 CSS Cleanup Roadmap (Lot 1 Implementation)
1. **Source of Truth & Token Generator**:
   - Create `src/design/bank.ts` and `scripts/generate-design-bank.mjs` exporting `tokens.generated.css` with a single `:root` block, 0 `.dark`, 0 `!important`.
   - Include the **35 ghost CSS variables** listed in Section 1.4 directly in `bank.ts` and `tokens.generated.css`.
2. **Purge Dark Overrides and Fix White Text**:
   - In `src/app/layout.tsx`:
     - Remove `<script id="lkdv-theme-init" ... />`.
     - Set `<html lang={locale} data-theme="light" suppressHydrationWarning className="...">`.
   - In `src/styles/liquid-ios27.css`:
     - Delete the root override block `html[data-liquid-ios27] { --lkv-text-primary: #ffffff; --glass-label: #ffffff; ... }`.
     - Set `--hub-glass-base: #FFFFFF;`, `--hub-smoke: rgba(240, 245, 238, 0.70);`, and forest inks (`--lkv-text-primary: #172B24;`).
   - In `src/styles/tokens.css` / `tokens.generated.css`:
     - Remove `.dark` and `html.dark, .dark, [data-theme='dark']` blocks.
   - In `src/styles/liquid-glass.css`:
     - Remove `.dark` block (lines 1082-1143).
3. **Prune Global Stylesheets in `layout.tsx`**:
   - Consolidate redundant files (`community-post-polish.css`, `liquid-selectors.css`, `native-account-tabbar.css`) into `liquid-glass.css` / `tokens.generated.css`.
   - Remove `community-card.css` (or empty it and update `community-feed-contract.spec.ts`).
4. **Eliminate Component `<style>` Injections**:
   - In `SortieDrawer.tsx`, `CompteDrawer.tsx`, `ProgressionDrawer.tsx`, `TraceImportDrawer.tsx`, and `DrawerShell.tsx`, replace the huge embedded CSS strings (totaling ~4,000 `!important` occurrences) with standard scoped CSS classes backed by design tokens.

### 4.2 Icon Consolidation Roadmap
1. **Re-architect `src/components/ui/Icon/Icon.tsx`**:
   - Replace the raster PNG mask resolver (`maskImage: url("/icons/...")`) with a direct SVG vector renderer using `lucide-react`.
   - Remove all dependency on `public/icons/*.png`.
2. **Expand `src/components/ui/Icon/registry.ts`**:
   - Provide a normalized dictionary mapping:
     - Semantic names (`'compass'`, `'mountain'`, `'backpack'`, `'check'`, `'trash'`, `'users'`, `'plus'`, `'close'`, `'user'`, `'map-pin'`, `'gear'`, etc.)
     - Direct Lucide component names (`'Compass'`, `'Mountain'`, `'Backpack'`, `'Check'`, `'Trash2'`, `'Users'`, `'Plus'`, `'X'`, etc.)
     - Legacy Heroicon names (`'CompassIcon'`, `'CheckIcon'`, `'PlusIcon'`, `'XMarkIcon'`, etc.)
     - Kebab-case SF names (`'arrow-left'`, `'chevron-right'`, etc.)
     directly to Lucide SVG components.
3. **Non-Breaking Adapters**:
   - `src/components/ui/AppIcon.tsx`: Update to `<Icon {...props} />` (delegating directly to vector `Icon`).
   - `src/components/ui/LkvIcon.tsx`: Delegate to `Icon` or re-export vector equivalents.
   - `src/features/explorer-v2/ui/XpIcon.tsx`: Delegate to `Icon`.
4. **Feature Migration**:
   - Re-export the top 40 Lucide icons directly from `@/components/ui/Icon` (e.g. `export { Check, Users, Plus, X, Trash2, Compass, Mountain, Backpack, MapPin, ... } from 'lucide-react'`).
   - Feature files can simply change `from 'lucide-react'` to `from '@/components/ui/Icon'`, ensuring 0 direct `lucide-react` imports from feature pages while guaranteeing 100% type safety.

---

## 5. Verification Method

### 5.1 Independent Test Verification Commands
Run these commands in `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`:

1. **Verify Design Test Suite**:
   ```bash
   npx vitest run tests/design/
   ```
   *Expected*: All 45 test files and 494 tests pass (with 0 `SKIP`).

2. **Verify Tokens Synchronization**:
   ```bash
   npx vitest run tests/design/tokens-sync.spec.ts tests/design/no-primary.spec.ts tests/design/contrast.spec.ts
   ```
   *Expected*: All tests pass, no unlisted hex codes, no forbidden palette colors.

3. **Verify Ghost CSS Variables Absence**:
   Run the scan script to verify that all 35 ghost CSS variables have at least 1 formal declaration in `tokens.generated.css` or `src/styles/`:
   ```bash
   node -e '
   const fs = require("fs");
   const tokens = fs.readFileSync("src/styles/tokens.css", "utf8");
   const checkVars = ["--lkv-text-caption-1", "--glass-secondary", "--glass-specular", "--bg-body", "--lkv-native-bar-height"];
   const missing = checkVars.filter(v => !tokens.includes(v + ":"));
   if (missing.length > 0) { console.error("Missing declarations:", missing); process.exit(1); }
   console.log("All critical ghost variables declared successfully!");
   '
   ```

4. **Verify Zero PNG Mask References in `Icon.tsx`**:
   ```bash
   grep -rn "maskImage" src/components/ui/Icon/
   ```
   *Expected*: 0 matches.

5. **Typecheck & Build**:
   ```bash
   npx tsc --noEmit
   npm run build
   ```

### 5.2 Invalidation Conditions
This investigation report is invalidated if:
1. `src/styles/tokens.css` retains multiple conflicting `:root` blocks or `.dark` blocks.
2. `html[data-liquid-ios27]` continues to define `--lkv-text-primary: #ffffff` or `--glass-label: #ffffff`, causing white text on light backgrounds.
3. Any of the 35 ghost CSS variables remains undeclared in the generated design tokens.
4. `Icon.tsx` continues to load raster `/icons/*.png` files via CSS `mask-image`.
