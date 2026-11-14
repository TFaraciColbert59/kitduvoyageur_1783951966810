# Handoff Report — iPhone 16 Pro Visual Polish Strategy

**Agent**: `explorer_lot4_iphone_visuals`  
**Role**: iPhone Visuals Explorer  
**Mission**: Map and analyze all iPhone 16 Pro visual defects across the remaining screens and provide an exact, line-by-line fix strategy for `worker_lot4_iphone_visuals`.  
**Target Milestone**: Lot 4 (§5.A iPhone 16 Pro visual fixes across Hub, Kit Studio, Explorer/Compas, Communauté, Messages, Carnet, Checkout, 404, CookieConsentBanner)  
**Date**: 2026-11-14  

---

## 1. Observation

### 1.1 `/hub` (Bivouac Alpine Screen)
1. **Interactive Alpine Spots are Invisible at Rest**:
   - In `src/features/hub/styles/hub-camp-option3.css` (lines 175–216):
     ```css
     .camp-touch-target {
       background: transparent;
       border: 0;
     }
     .camp-touch-ripple {
       opacity: 0;
     }
     ```
   - In `src/features/hub/components/HubCampShell.tsx` (lines 950–985): touch targets render on the alpine scene without visible disc/ring markers when idle. The user has no visual clue where to tap to open "Sac à dos", "Itinéraire", or "Budget".
2. **Alpine Header Uses Dark Charcoal Mode**:
   - In `src/features/hub/styles/hub-camp-option3.css` (line 78):
     ```css
     .camp-header {
       background: rgba(18, 38, 30, 0.78);
       backdrop-filter: blur(20px);
       border: 1px solid rgba(255, 255, 255, 0.08);
     }
     ```
   - Violates the LKDV Liquid Glass bank token system (which requires 100% light sage glass, zero dark mode).
3. **Blank Pills in Hub Drawers**:
   - In `src/features/hub/components/drawers/HubGearDrawer.tsx` (line 273) and `HubBudgetDrawer.tsx`, the secondary `.ig-tabs` pills render `<span className="text-[11px] font-bold">` without glyphs or valid text, resulting in blank white capsules as seen in QA screenshots `shots/42` and `shots/43`.
4. **Obsolete White/Dark Text Tokens in Reservations & Empty States**:
   - In `src/features/hub/components/budget/ReservationsOverview.tsx` (lines 64–74):
     `text-[color:var(--lkv-text-primary)]` and `var(--glass-label)` resolve to white `#FFFFFF` in legacy dark mode files instead of the canonical `#172B24` ink token.

---

### 1.2 `/kit-studio`
1. **Unauthenticated Access Immediately Redirects Instead of Showing Honest Empty State**:
   - In `src/app/kit-studio/page.tsx` (line 43):
     ```tsx
     case 'login':
       router.replace('/connexion?next=/kit-studio');
     ```
   - Visitors cannot preview or inspect the studio unauthenticated; it forcefully redirects rather than showing an empty state (`"Aucun kit"` / `"Créer un kit"` / `"Se connecter"`).
2. **Back Button Collision Under Dynamic Island**:
   - In `src/features/kit-studio/ui/kit-studio.css` (line 574):
     ```css
     .ks-back {
       top: calc(env(safe-area-inset-top, 0px) + 10px);
       z-index: 36;
     }
     ```
   - On iPhone 16 Pro (`env(safe-area-inset-top)` is 54–59px), the button lacks sufficient contrast against bright canvas backgrounds, and lacks concentric safe-margin clearance.
3. **Glyph Confusion for Tent, Duvet (Sleeping Bag), and Mattress (Sleeping Pad)**:
   - In `src/features/kit-studio/server/getStudioData.ts` (line 284): `GLYPH_BY_FN` maps `sleep: 'sack'`, `sleeppad: 'roll'`, `shelter: 'tent'`.
   - In `src/features/kit-studio/domain/catalog.ts` (lines 735–844): duvets (`sleep0`, `sleep-5`) erroneously have `gl: 'roll'` (identical to air mattresses `mat-air`).
   - In `src/features/kit-studio/ui/sheets/ItemSheet.tsx` (line 21) and `ui/icons.tsx`: `KNOWN` and `PATHS` omitted `'sack'` and `'roll'`, falling back to `'cube'`. Both SVG paths are already defined in `src/features/kit-studio/ui/glyphs.generated.ts`.

---

### 1.3 `Explorer & Compas`
1. **Dock/HUD & Attribution Trapped Behind iOS TabBar**:
   - In `src/features/compas/v5/map/map.css` (line 175) and `src/features/compas/v5/v5.css` (line 61):
     `--v5-nav-clear: max(var(--bottom-nav-height, 0px), var(--cookie-banner-h, 0px)) + 24px;`
     On iOS native (where `UITabBar` is ~83px tall and `--bottom-nav-height` is 0px), `--v5-nav-clear` computes to only 24px. As documented in `shots/45-compas-after.png`, `.v5-map__approx` ("Tracé approximatif") and MapLibre attribution are buried behind the native TabBar.
2. **ExplorerSheet Collision with Top Search and Compass**:
   - In `src/features/explorer-v2/sheet/ExplorerSheet.tsx` (lines 40–48):
     `heightsFor(viewport)` computes `maxH = viewport - 122`. It ignores `env(safe-area-inset-top)` (~54px) and `.xp-chrome` height (~136px). In `shots/24` and `shots/29–34`, the expanded sheet title ("Smokkelaarspad") and back button collide directly with the search field and compass.
3. **Floating Point Mileage Leaks**:
   - In `src/components/carnet/v2/CarnetDrawerV2.tsx` (line 373):
     `{currentStackItem.etape.distanceKm ? `${currentStackItem.etape.distanceKm} km` : '—'}` formats raw IEEE 754 floats like `9.98579588836631 km` instead of rounded (`10 km` or `9,99 km`).
4. **Alpine Elevation Fallback on Flat Tracks**:
   - In `src/features/explorer-v2/sheet/SheetContent.tsx` (line 1567):
     A hardcoded fallback `'≈ 850 m'` is rendered when `route.dplus_m` is null. On flat Dutch/Belgian border trails (Smokkelaarspad), it displays alpine mountain gain!

---

### 1.4 `Communauté, + Créer, Clubs & Sorties`
1. **Top-Right Icons Lack Contrast**:
   - In `src/styles/community-feed.css` (line 593) and `src/styles/account-glass.css` (line 111):
     `.lkdv-top-actions .gbtn` has no explicit ink or background rules, falling back to faint translucent icons against bright backgrounds in `shots/17-communaute-feed.png`.
2. **Wizard Step Capsule `1 | 2 | 3` Overlaps "Suivant >" Button**:
   - In `src/styles/communaute-v2-shell.css` (lines 238–249):
     ```css
     .lkdv-cv2-mini-slot.has-footer {
       position: absolute;
       bottom: 72px;
       right: 10px;
     }
     ```
   - In `src/features/community/v2/shared/CommunitySheetShell.tsx` (lines 578–612):
     `.lkdv-cv2-mini-slot` is placed after `.lkdv-cv2-footer` as an absolute element at `bottom: 72px`. On mobile viewports and keyboard shifts, it directly collides with the "Suivant >" CTA button.
3. **Inconsistent Segmented Controls on Search and Sorties Tabs**:
   - In `src/features/community/v2/explore/panes/SearchPane.tsx` (line 242) and `EventsPane.tsx` (line 119):
     Ad-hoc `<div className="lkdv-cv2-seg">` elements with `<button aria-pressed=...>` are used instead of conforming to canonical `SegmentedControl` sliding liquid glass tokens (`.sel-lens`, `#172B24`).
4. **Missing or Broken Organizer Card on `/sorties/[id]`**:
   - In `src/app/sorties/[id]/EventDetailClient.tsx` (lines 353–374) and `page.tsx` (lines 151–160):
     When `event.organizer` has placeholder values (`name: 'Organisateur'`, `handle: null`), it renders a redundant duplicate card `"Organisateur / Organisateur"` with a dead link to `/profil/undefined`.

---

### 1.5 `Messages`
1. **Duplicate Direct Threads for Interlocutors**:
   - In `src/components/messaging/messagesModel.ts` (lines 47–67):
     `filterConversations` does not deduplicate direct threads. When multiple direct conversations exist with the same person (e.g. Tony Faraci), both appear in the feed.
2. **Avatar Falls Back to `no_image.png` Instead of Initials**:
   - In `src/components/messaging/MessagesScreen.tsx` (line 319):
     `{avatar ? <img src={avatar} ... /> : initials(title)}` lacks the `avatar !== '/assets/images/no_image.png'` check and lacks an `onError` handler, causing 404 broken image placeholders when avatars fail to load.
3. **Spacing Issues Above TabBar and Under Filters**:
   - In `src/components/messaging/messages-grammar.css` (line 1159):
     `.lkdv-messages .ig-grid-wrap` has `padding-bottom: 54px !important;`. The floating `.mfilters` pill (30px high, bottom: 10px) partially obscures the last conversation item.
   - In `MessagesScreen.tsx` (line 1726):
     The bottom padding for the thread view (`.map`) did not account for native iOS `UITabBar` (~83px) clearance.

---

### 1.6 `Carnet V2, Checkout, CookieConsentBanner & 404`
1. **Carnet TopBar and Dynamic Island Collisions**:
   - In `src/styles/carnet-v2.css` (line 1201):
     `.lkdv-carnet-island` has hardcoded `top: 56px;` and `background: #000000;`, colliding with the title pill on iPhone 16 Pro and violating light glass aesthetics.
2. **Ugly Em-Dash Separator Artifacts (`'— · '`)**:
   - In `src/features/carnet/detail/place.ts` (lines 106–119) and `src/components/carnet/v2/CarnetCardV2.tsx` (lines 200–207):
     Missing metrics default to `'—'`, producing strings like `" — · — · par Tony"`.
3. **Empty Green Card in `CarnetDrawerV2`**:
   - In `src/components/carnet/v2/CarnetDrawerV2.tsx` (lines 1092–1100):
     When `detail.kit.items.length === 0`, it renders a solitary green card showing `"Poids total du sac —"` over empty space instead of an honest empty state.
4. **Button "R" and Attribution Trapped Behind TabBar**:
   - In `src/components/compte/map/compte-map.css` (line 232) and `CompteMapHud.tsx`:
     Attribution and recenter controls use `bottom: max(72px, ...)` without `--lkv-native-bar-height`, placing them behind the 83px native iOS TabBar.
5. **Outdated Branding and Dark Mode in `not-found.tsx`**:
   - In `src/app/not-found.tsx` (line 12):
     `{ label: 'Boutique & Kits', href: '/explorer' }` references legacy naming and incorrect link instead of `"Kits & Studio"` (`/kit-studio`).
   - Line 44: Uses `<Card variant="featured">` which defaults to dark/charcoal styling instead of sage liquid glass (`#F0F5EE`, border `rgba(23,64,44,0.15)`, text `#17402C`).
6. **Dark Charcoal Background in `CookieConsentBanner`**:
   - In `src/components/CookieConsentBanner.tsx` (line 106):
     `bg-[color:var(--lkv-ink-900)]` renders a black/charcoal card that clashes with the 100% Light Liquid Glass aesthetic. Needs sage liquid glass with green CTA `#226148`.
7. **Safe-Area Insets in `Checkout`**:
   - In `src/app/checkout/page.tsx` (lines 625, 742):
     Mobile checkout view lacks `safe-area-inset-top` in the header and `safe-area-inset-bottom` around the payment CTA button.

---

## 2. Logic Chain

1. **Brand & Design System Consistency (Bank Tokens)**:
   - *Observation*: `src/design/bank.ts` defines the canonical LKDV Liquid Glass design tokens (pure light glass, `--lkv-forest-900` = `#172B24`, CTA `#226148`, light sage background `#F0F5EE`).
   - *Deduction*: Any occurrence of charcoal/black card backgrounds (`.camp-header`, `CookieConsentBanner`, `not-found.tsx`, `.lkdv-carnet-island`) is a regression from legacy dark-mode styling and must be aligned to the canonical sage glass tokens.

2. **iOS Safe Areas & Concentric Radii**:
   - *Observation*: On iPhone 16 Pro, top safe area is 54–59px (Dynamic Island) and bottom safe area is 34px (home indicator) or ~83px when native `UITabBar` is mounted.
   - *Deduction*: Hardcoded offsets like `top: 56px` or `bottom: 72px` or `viewport - 122` cause overlaps. Clearance must dynamically evaluate `max(var(--lkv-native-bar-height, 0px), env(safe-area-inset-bottom, 0px))` and `calc(env(safe-area-inset-top, 0px) + ...)`.

3. **Flex Flow vs. Absolute Positioning**:
   - *Observation*: `.lkdv-cv2-mini-slot.has-footer` was set to `position: absolute; bottom: 72px; right: 10px;`.
   - *Deduction*: Absolute positioning based on an assumed 72px footer height fails whenever footer actions wrap, when system font scaling is applied, or when the on-screen keyboard appears. Placing the step indicator in normal flex flow above `.lkdv-cv2-footer` guarantees zero collision across all viewport sizes.

4. **Data Honesty & Fallbacks**:
   - *Observation*: Flat trails showing `≈ 850 m`, float distances showing `9.98579588836631 km`, and missing metadata showing `— · —`.
   - *Deduction*: LKDV's product principle is strict data honesty. Unknown data must render as `'—'` or be omitted rather than fabricated. Floating point numbers must be formatted with localized precision (`10 km` or `9,99 km`).

---

## 3. Caveats

1. **Native Shell vs. Web Browser Compatibility**:
   - When running inside Capacitor / iOS WebKit with native `UITabBar`, CSS variable `--lkv-native-bar-height` is injected (~83px). In standard mobile Safari, `--bottom-nav-height` or `env(safe-area-inset-bottom)` applies. All bottom clearances must use `max(...)` to handle both environments seamlessly.
2. **Component Reusability**:
   - Components such as `CompteMapHud` and `SegmentedControl` are shared across `/compte`, `/carnets`, `/communaute`, and `/hub`. Fixes must respect their props contract without breaking dependent routes.
3. **No Database Schema Changes**:
   - All fixes are purely presentation-layer (CSS and React TSX). No database migrations or API contract modifications are required.

---

## 4. Conclusion & Actionable Implementation Plan

The following line-by-line strategy provides exact, drop-in instructions for `worker_lot4_iphone_visuals`:

### Area 1: `/hub`
1. **Discrete Glass Markers**:
   - In `src/features/hub/styles/hub-camp-option3.css`:
     Update `.camp-touch-target` to display a discrete glass ring/disc at rest:
     ```css
     .camp-touch-target {
       width: 32px;
       height: 32px;
       border-radius: 50%;
       background: rgba(255, 255, 255, 0.45);
       -webkit-backdrop-filter: blur(8px) saturate(160%);
       backdrop-filter: blur(8px) saturate(160%);
       border: 0.5px solid rgba(255, 255, 255, 0.85);
       box-shadow: 0 2px 8px rgba(23, 43, 36, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
       transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease;
     }
     .camp-touch-target:active {
       transform: scale(0.92);
       background: rgba(255, 255, 255, 0.7);
     }
     ```
2. **Sage Glass Header**:
   - In `src/features/hub/styles/hub-camp-option3.css` (line 78):
     Replace `.camp-header` background with:
     ```css
     .camp-header {
       background: rgba(255, 255, 255, 0.82) !important;
       -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
       backdrop-filter: blur(20px) saturate(180%) !important;
       border-bottom: 0.5px solid rgba(23, 43, 36, 0.12) !important;
       color: #172B24 !important;
     }
     ```
3. **Secondary Pill Glyphs**:
   - In `src/features/hub/components/drawers/HubGearDrawer.tsx` (line 273) and `HubBudgetDrawer.tsx`:
     Ensure secondary tab items pass Lucide icon components (`Backpack`, `Layers`, `Scale`, etc.) instead of empty text spans.
4. **Token Enactment in Reservations**:
   - In `src/features/hub/components/budget/ReservationsOverview.tsx`:
     Replace any `text-[color:var(--glass-label)]` with `text-[#172B24]` and secondary text with `text-[#56665D]`.

---

### Area 2: `/kit-studio`
1. **Honest Empty State When Unauthenticated**:
   - In `src/app/kit-studio/page.tsx` (line 43):
     Replace immediate `router.replace` with a state rendering `StudioEmptyState` containing:
     - Heading: "Aucun kit pour le moment"
     - Subtitle: "Créez votre premier kit d'expédition ou connectez-vous pour retrouver vos kits."
     - Actions: Primary button "Créer un kit" and Secondary button "Se connecter".
2. **Back Button Safe-Area & Contrast**:
   - In `src/features/kit-studio/ui/kit-studio.css` (line 574):
     ```css
     .ks-back {
       top: calc(env(safe-area-inset-top, 0px) + 12px);
       left: 12px;
       background: rgba(255, 255, 255, 0.82);
       -webkit-backdrop-filter: blur(16px) saturate(180%);
       backdrop-filter: blur(16px) saturate(180%);
       border: 0.5px solid rgba(23, 43, 36, 0.15);
       color: #172B24;
       box-shadow: 0 2px 8px rgba(23, 43, 36, 0.08);
       z-index: 36;
     }
     ```
3. **Distinct Item Glyphs**:
   - In `src/features/kit-studio/domain/catalog.ts`:
     Change duvets (`sleep0`, `sleep-5`) from `gl: 'roll'` to `gl: 'sack'`.
   - In `src/features/kit-studio/ui/sheets/ItemSheet.tsx` (line 21) & `ui/icons.tsx`:
     Add `'sack'` and `'roll'` to `KNOWN` and map them to their respective paths from `glyphs.generated.ts`.

---

### Area 3: `Explorer & Compas`
1. **Dock/HUD & Attribution Raised Above Native TabBar**:
   - In `src/features/compas/v5/map/map.css` (line 175) & `src/features/compas/v5/v5.css` (line 61):
     ```css
     --v5-nav-clear: max(
       var(--lkv-native-bar-height, 0px),
       var(--bottom-nav-height, 0px),
       var(--cookie-banner-h, 0px),
       calc(env(safe-area-inset-bottom, 0px) + 60px)
     ) + 20px;
     ```
2. **ExplorerSheet Height Capped Under `.xp-chrome`**:
   - In `src/features/explorer-v2/sheet/ExplorerSheet.tsx` (lines 40–48):
     ```tsx
     const safeTop = typeof window !== 'undefined'
       ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0', 10) || 54
       : 54;
     const maxH = Math.max(260, viewport - 136 - safeTop);
     ```
3. **Distance Rounding**:
   - In `src/components/carnet/v2/CarnetDrawerV2.tsx` (line 373):
     Format `distanceKm` using `Math.round(currentStackItem.etape.distanceKm)` or `currentStackItem.etape.distanceKm.toFixed(1)`.
4. **Remove Hardcoded Alps Fallback**:
   - In `src/features/explorer-v2/sheet/SheetContent.tsx` (line 1567):
     Replace `'≈ 850 m'` with `null` or `'Dénivelé non renseigné'` when `route.dplus_m` is null.

---

### Area 4: `Communauté, + Créer, Clubs & Sorties`
1. **Top-Right Icons Contrast**:
   - In `src/styles/community-feed.css`:
     Add high contrast rule for `.lkdv-top-actions`:
     ```css
     .lkdv-top-actions .gbtn,
     .lkdv-top-actions .lkdv-notif-wrap {
       color: #172B24 !important;
       background: rgba(255, 255, 255, 0.75) !important;
       border: 0.5px solid rgba(23, 43, 36, 0.12) !important;
       box-shadow: 0 2px 8px rgba(23, 43, 36, 0.08) !important;
     }
     ```
2. **Capsule `1 | 2 | 3` in Flex Flow**:
   - In `src/features/community/v2/shared/CommunitySheetShell.tsx`:
     Move `{mini && !detail ? ... : null}` BEFORE `{footer && !detail ? <div className="lkdv-cv2-footer">{footer}</div> : null}`.
   - In `src/styles/communaute-v2-shell.css`:
     ```css
     .lkdv-cv2-mini-slot.has-footer {
       position: relative !important;
       bottom: auto !important;
       right: auto !important;
       display: flex !important;
       justify-content: flex-end !important;
       padding: 0 14px 4px !important;
     }
     ```
3. **Segmented Control Alignment**:
   - In `SearchPane.tsx` and `EventsPane.tsx`:
     Ensure `.lkdv-cv2-seg` buttons use `.sel-lens` liquid glass styling with active ink `#172B24` and sliding glass lens.
4. **Clean Organizer Masking**:
   - In `src/app/sorties/[id]/EventDetailClient.tsx`:
     If `!event.organizer || (!event.organizer.handle && event.organizer.name === 'Organisateur')`:
     Mask the organizer section or render an honest attribution to the club/community without dead link.

---

### Area 5: `Messages`
1. **Deduplicate Direct Threads**:
   - In `src/components/messaging/messagesModel.ts` (`filterConversations`):
     ```ts
     const seen = new Set<string>();
     return list.filter((conv) => {
       if (conv.left_at) return false;
       // Filter conditions...
       if (conv.type === 'direct') {
         const key = conv.other_member?.id || conv.other_member?.full_name || conv.id;
         if (seen.has(key)) return false;
         seen.add(key);
       }
       return true;
     });
     ```
2. **Initials Fallback Without `no_image.png`**:
   - In `src/components/messaging/MessagesScreen.tsx` (line 319):
     ```tsx
     {avatar && avatar !== '/assets/images/no_image.png' && !imgFailed ? (
       <img
         src={avatar}
         alt=""
         loading="lazy"
         decoding="async"
         referrerPolicy="no-referrer"
         width={40}
         height={40}
         onError={() => setImgFailed(true)}
       />
     ) : (
       initials(title)
     )}
     ```
3. **Feed Padding Clearance**:
   - In `src/components/messaging/messages-grammar.css` (line 1159):
     Increase padding-bottom on `.lkdv-messages .ig-grid-wrap` to `68px !important;`.
   - In `MessagesScreen.tsx` (line 1726):
     Add `var(--lkv-native-bar-height, 0px)` into thread view bottom padding:
     `max(calc(env(safe-area-inset-bottom, 0px) + 74px), calc(var(--lkv-native-bar-height, 0px) + 16px))`

---

### Area 6: `Carnet V2, Checkout, CookieConsentBanner & 404`
1. **Carnet Polish**:
   - In `src/styles/carnet-v2.css` (line 1201):
     Update `.lkdv-carnet-island` to `top: calc(env(safe-area-inset-top, 0px) + 10px);` and background to deep forest glass with white ink.
   - In `src/features/carnet/detail/place.ts` and `CarnetCardV2.tsx`:
     Filter out `'—'` before string concatenation to prevent `" — · "` artifacts.
   - In `src/components/carnet/v2/CarnetDrawerV2.tsx` (line 1087):
     Replace the empty `"Poids total du sac —"` card with an honest empty state (`"Aucun équipement renseigné dans ce carnet"`).
   - In `src/components/compte/map/compte-map.css` (line 232):
     Raise attribution above native TabBar:
     `bottom: max(calc(var(--lkv-native-bar-height, 0px) + 12px), calc(env(safe-area-inset-bottom, 0px) + 84px), calc(var(--bottom-nav-height, 60px) + 12px));`.
2. **`not-found.tsx` Brand & Liquid Glass**:
   - Line 12: Replace `{ label: 'Boutique & Kits', href: '/explorer' }` with `{ label: 'Kits & Studio', href: '/kit-studio' }`.
   - Line 44: Replace `<Card variant="featured">` styling with light sage liquid glass:
     `background: rgba(240, 245, 238, 0.88); border: 0.5px solid rgba(23, 64, 44, 0.15); color: #17402C;`
     CTA Button: `#226148` with white text.
3. **`CookieConsentBanner` Sage Liquid Glass**:
   - In `src/components/CookieConsentBanner.tsx` (line 106):
     Replace `bg-[color:var(--lkv-ink-900)]` with:
     `bg-[rgba(240,245,238,0.92)] border-[rgba(23,64,44,0.15)] text-[#172B24]`.
     CTA "Tout accepter": background `#226148`, text `#FFFFFF`.
     CTA "Refuser": background `transparent`, border `0.5px solid rgba(23,64,44,0.15)`, text `#172B24`.
4. **Checkout Safe Areas**:
   - In `src/app/checkout/page.tsx`:
     Add `pt-[calc(env(safe-area-inset-top,0px)+var(--space-3))]` to the mobile header container.
     Add `pb-[calc(env(safe-area-inset-bottom,0px)+var(--space-6))]` to the mobile summary card.

---

## 5. Verification Method

To verify these fixes independently:

1. **Unit & Regression Testing**:
   ```bash
   npx vitest run src/components/messaging/__tests__/messagesModel.test.ts
   npx vitest run src/features/community/
   npx vitest run src/components/carnet/v2/
   npx vitest run src/features/explorer-v2/
   ```
2. **Device Visual Audit (iPhone 16 Pro Viewport: 393 × 852 or 402 × 874)**:
   - Run the QA audit script:
     ```bash
     cd /Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa && node web-audit.mjs
     ```
   - Inspect generated screenshots:
     - `/hub`: Verify alpine glass markers are visible at rest; verify `.camp-header` is light sage glass.
     - `/kit-studio`: Verify back button is visible beneath Dynamic Island; verify tent/duvet/mattress icons are distinct.
     - `Explorer & Compas`: Verify sheet title does not collide with search chrome; verify MapLibre attribution sits cleanly above the native TabBar; verify distances are rounded integers/decimals without float leaks.
     - `Communauté`: Verify top-right icons have `#172B24` contrast; verify `1 | 2 | 3` does not overlap "Suivant >".
     - `Messages`: Verify `Tony Faraci` appears only once in the conversation list; verify initials fallback appears without broken image icons.
     - `Carnet V2 & 404 & CookieConsentBanner`: Verify no `" — · "` strings appear; verify `not-found.tsx` and `CookieConsentBanner` are light sage liquid glass with green CTA `#226148`.
