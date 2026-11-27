# Explorer 20/20 Apple Liquid Glass Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc Explorer UI with a 20/20 Apple Liquid Glass single-drawer architecture (Approche A+B) strictly aligned with Clubs & Carnets (`SlotShell`, `CapsuleTabs`, `LensPager`, `SortMenuButton`), with native **Bouteille à la mer** and 100% bidirectional map interactivity while keeping all headless GIS, BFF, adaptive, and performance engines intact.

**Architecture:** `MapStage` occupies 100% of the viewport with minimal top chrome (`ExplorerMapChrome` + `ClubIsland`) and gains `queryRenderedFeatures` hit-testing + highlight state. All browsing, filtering, layers, Pokédex, safety, community/bottles, search, sport launch (`▶` top-right), GPS HUD, and post-activity summary live inside a single 3-detent GPU-animated bottom drawer (`ExplorerGlassDrawer`: `peek` docked above global `NavigationBar`, `mid` 56 dvh / `full` 86 dvh hiding `NavigationBar`).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, MapLibre GL, Zustand, TanStack Query, Framer Motion (`framer-motion`), `@number-flow/react`, Recharts, Lucide React, canonical LKDV UI primitives (`SlotShell`, `CapsuleTabs`, `LensPager`, `SortMenuButton`, `CollapsibleHeroPreview`, `ClubIsland`, `CarnetHorizontalTimeline`, `PokedexSpeciesDetailCard`, `CarnetSpeciesCreatePane`).

**Spec:** `docs/superpowers/specs/2026-11-25-explorer-apple-liquid-glass-design.md`

## Global Constraints

- **Palette & Material:** 100% Light Liquid Glass (`#17402C` forest primary, `#172B24` ink, `#96BA8E` sage, `#FBFAF6` ivory, `#56665D` secondary). NEVER `#E4501C`.
- **Canonical Drawer Spatial Contract:** Top grabber `.lkdv-mgrab`; top `CapsuleTabs` (icon-only) + top-right circular `▶` Sport button; ALL sub-drawers in bottom-right `.lkdv-lens-tabs` + horizontal swipe `LensPager`; ALL filters/sorts in bottom-right `SortMenuButton`; primary contextual CTA in bottom-left `.club-drawer-floating-left`; circular `×` close pill without text (`<X size={15} />`); ZERO inline forms (always `createPortal(..., document.body)`).
- **Visual-First & Zero Duplication:** Prefer SVG mini-traces, photos, 3D holographic cards, conic-gradient rings, Recharts curves, and `AnimatedNumber` over prose. Zero duplicate buttons for the same action. Zero floating filter/preset rails over the map.
- **Performance & Security:** `0` unnecessary `/api/explorer/v2/*` calls on cold boot in `peek`; GPU `transform: translate3d` drag (never animate `height`); `user_blocks` fail-closed (`503`); `https://` URL validation; zero `dangerouslySetInnerHTML` on external text; no forbidden providers (`overpass-api.de`, `waymarkedtrails`).
- **Headless Engine Preservation:** Keep all 68 existing Vitest tests green across `state/`, `map/`, `data/`, `adaptive/`, and `unifiedBridge.ts`.

## Review Focus

- **Global `NavigationBar` trap on `/explorer`:** Switching `peek → mid → peek` must reliably emit `lkdv-toggle-bottom-bar` (`hide: false` in `peek`, `hide: true` in `mid`/`full`/`GPS_ACTIVE`) and reset to `hide: false` on unmount.
- **Overlapping MapLibre feature tap priority:** Clicking where a hazard/bottle/Pokédex point overlaps a route and region polygon must strictly select `point/cluster > route > region > country` and never open two detail drawers simultaneously.
- **Cold-boot zero-fetch invariant:** Mounting Explorer in default `peek` detent must keep `selectExplorerMapContext` dormant so zero `/api/explorer/v2/*` calls fire until the user expands to `mid`/`full` or taps a category.
- **Bouteille à la mer safety & privacy:** `/api/explorer/v2/social/map?kinds=bottles` must exclude blocked users (fail-closed `503` on `user_blocks` error when authenticated), and `BottleLaunchModal` must enforce `trust_score >= 65`, floor `50`, and max `3` active groups.
- **GPS Active teardown & contrast restoration:** Entering `GPS_ACTIVE` must call `kf.process(...)` (fixing `kf.update`), sync valid `SafetyCorridorState` keys, purge disposable GPU layers, route Turn-by-Turn/Off-Route strictly through `ClubIsland`, and reset `hudContrast` to `'standard'` on stop.

---

### Task 1: Backend Bottles Layer, Registry & Interactive MapStage Picking

**Files:**
- Modify: `src/app/api/explorer/v2/social/map/route.ts`
- Modify: `src/features/explorer-v2/data/unifiedLayersHooks.ts`
- Modify: `src/features/explorer-v2/state/presets.ts`
- Modify: `src/features/explorer-v2/map/layerRegistry.ts`
- Modify: `src/features/explorer-v2/map/layerLifecycle.ts`
- Modify: `src/features/explorer-v2/map/MapStage.tsx`
- Test: `src/features/explorer-v2/map/__tests__/interactivePickingAndBottles.test.ts`

**Interfaces:**
- Produces:
  - `SocialMapKind` union extended with `'bottles'`; `SocialMapPayload` extended with `bottles: GeoJsonFeatureCollection` and `counts.bottles: number`.
  - `ExtendedLayerKey` extended with `'socialBottles'`; `UNIFIED_LAYER_REGISTRY` entry `{ key: 'socialBottles', sourceId: 'xp-social-bottles', cluster: true, unloadTier: 'disposable' }`.
  - `MapInteractiveSelection = { kind: 'hazard' | 'bottle' | 'pokedex' | 'carnet' | 'club' | 'story' | 'friend' | 'route' | 'region' | 'country'; id: string; sourceId: string; properties: Record<string, unknown>; coordinates: [number, number] }`.
  - `MapStageProps` extended with `selectedFeature?: { id: string; coordinates: [number, number] } | null`, `onUnifiedFeatureClick?: (feature: MapInteractiveSelection) => void`, `onRouteClick?: (routeId: string, name: string | null, coordinates: [number, number]) => void`.
  - Pure helper `pickHighestPriorityFeature(features: ReadonlyArray<{ layerId: string; sourceId: string; properties: Record<string, unknown>; coordinates: [number, number] }>): MapInteractiveSelection | null` exported from `src/features/explorer-v2/map/featurePicking.ts`.

- [ ] **Step 1: Write failing unit tests for tap priority & `socialBottles` layer registry**
  - Create `src/features/explorer-v2/map/__tests__/interactivePickingAndBottles.test.ts` verifying:
    1. `pickHighestPriorityFeature` strictly ranks `xp-hazard-* / xp-social-bottles / xp-pokedex-species / xp-social-*` > `xp-routes` > `xp-regions` > `xp-countries`.
    2. `UNIFIED_LAYER_BY_KEY.socialBottles` exists with `sourceId: 'xp-social-bottles'`, `cluster: true`, `unloadTier: 'disposable'`, and is purged in `GPS_ACTIVE`/`SOS`.
- [ ] **Step 2: Run test to verify failure**
  - Run: `npx vitest run src/features/explorer-v2/map/__tests__/interactivePickingAndBottles.test.ts`
  - Expected: FAIL (`featurePicking` and `socialBottles` not defined).
- [ ] **Step 3: Implement `featurePicking.ts`, `socialBottles` registry/preset/lifecycle, `/social/map?kinds=bottles`, and `MapStage.tsx` click hit-testing + selected highlight ring**
  - In `social/map/route.ts`: add `'bottles'` to `VALID_KINDS`; query `travel_groups` (`visibility=eq.public`) + `group_public_card_stats` RPC + `countries_geo` centroids (deterministic micro-offset per bottle ID so multiple bottles in the same country cluster cleanly); filter `blockedIds` when authenticated (fail-closed `503` on `user_blocks` error).
  - In `MapStage.tsx`: add single unified `map.on('click', ...)` using `map.queryRenderedFeatures(event.point)` + `pickHighestPriorityFeature`; zoom in on cluster clicks (`point_count`); render lightweight `xp-selected-highlight` pulse circle when `selectedFeature` is set.
- [ ] **Step 4: Run Vitest & ESLint**
  - Run: `npx vitest run src/features/explorer-v2/map/__tests__/interactivePickingAndBottles.test.ts src/features/explorer-v2/map/__tests__/layerLifecycleAndCorridor.test.ts src/features/explorer-v2/data/__tests__/edgeCacheAndHooks.test.ts src/features/explorer-v2/state/__tests__/hudAndPresets.test.ts`
  - Expected: PASS (0 ESLint errors).

---

### Task 2: Apple Liquid Glass Shell, Stylesheet, MapChrome & 3-Detent Drawer Host

**Files:**
- Create: `src/styles/explorer-glass.css`
- Create: `src/features/explorer-v2/redesign/mapContext.ts`
- Create: `src/features/explorer-v2/redesign/ExplorerMapChrome.tsx`
- Create: `src/features/explorer-v2/redesign/ExplorerGlassDrawer.tsx`
- Test: `src/features/explorer-v2/redesign/__tests__/drawerAndMapContext.test.ts`

**Interfaces:**
- Consumes: `SlotShell`, `DRAWER_V2_CSS`, `CapsuleTabs`, `SortMenuButton`, `ClubIsland`, `MapBaseStyle`, `UnifiedLayerKey`, `ExplorerMode`.
- Produces:
  - `ExplorerCategory = 'explorer' | 'layers' | 'pokedex' | 'safety' | 'community'`
  - `ExplorerDetent = 'peek' | 'mid' | 'full'`
  - `selectExplorerMapContext({ detent, category, lensId, userLayerVisibility, hasInteracted }): Record<string, boolean>` (returns `userLayerVisibility` unchanged when `detent === 'peek' && !hasInteracted`, preserving zero boot fetches; merges ephemeral contextual overlays in `mid`/`full` without mutating user presets).
  - `ExplorerMapChrome`: renders ONLY top-left location/search pill (`[ 📍 label ▾ ]` with optional back chevron), top-right vertical glass stack (`Compass 3D`, `LocateFixed`, `BaseStyle` popover), and `ClubIsland` toast.
  - `ExplorerGlassDrawer`: 3-detent GPU (`translate3d`) bottom drawer with `.lkdv-mgrab` drag/tap, top row (`CapsuleTabs` 5 icon-only categories + top-right 48×48 circular forest `▶` Sport button), `SlotShell` (`lenses` bottom-right + `SortMenuButton` bottom-right), and `.club-drawer-floating-left` contextual pill. Emits `lkdv-toggle-bottom-bar` (`hide: false` in `peek`, `hide: true` in `mid`/`full`/`GPS_ACTIVE`).

- [ ] **Step 1: Write failing unit tests for `selectExplorerMapContext` and `ExplorerGlassDrawer` detent/nav-bar contract**
  - Verify cold-boot `peek` returns unchanged `userLayerVisibility` (zero contextual fetches), switching to `pokedex` / `safety` / `community` (`bottles`) overlays the right ephemeral keys without overwriting user layers, and `peek` vs `mid` toggles `lkdv-toggle-bottom-bar`.
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement `explorer-glass.css`, `mapContext.ts`, `ExplorerMapChrome.tsx`, and `ExplorerGlassDrawer.tsx`**
  - Import canonical LKDV stylesheets (`liquid-selectors.css`, `liquid-capsules.css`, `drawer-selectors-tabbar.css`, `carnet-v2.css`, `club-drawers-v2.css`) and inject `DRAWER_V2_CSS`.
  - Keep `peek` docked cleanly above `NavigationBar` (`bottom: calc(var(--safe-bottom, 0px) + 76px)`, rounded 24px floating glass bar) and smoothly dock to `bottom: 0` (`border-radius: 24px 24px 0 0`) in `mid`/`full`.
- [ ] **Step 4: Run Vitest & ESLint**
  - Expected: PASS (0 ESLint errors).

---

### Task 3: Catégorie 1 (`Explorer`) & Catégorie 2 (`Carte & Calques`) Visual Lenses

**Files:**
- Create: `src/features/explorer-v2/redesign/components/RouteMiniTraceSvg.tsx`
- Create: `src/features/explorer-v2/redesign/lenses/ExplorerCategoryLenses.tsx`
- Create: `src/features/explorer-v2/redesign/lenses/LayersCategoryLenses.tsx`

**Interfaces:**
- Consumes: `AnimatedNumber`, `CollapsibleHeroPreview`, `StackSlideView`, `Recharts AreaChart`, `EXPLORER_PRESETS`, `RouteItem`, `TerritorialEncyclopediaData`, `AdaptiveOverviewBundle`, `UnifiedLayerItem`, `OfflineInstalledPackRecord`.
- Produces:
  - `ExplorerCategoryLenses` (3 lenses: `spots`, `territory`, `readiness` + `ExplorerRouteDetailView` with circular `×` close pill, 4-stat zero-label pill row, clickable Recharts elevation profile synced to map).
  - `LayersCategoryLenses` (3 lenses: `presets` 9 visual tiles in 2-col grid, `overlays` unified 2-col toggle grid with freshness dot + `X/2` raster counter, `offline` visual pack cards).

- [ ] **Step 1: Implement `RouteMiniTraceSvg.tsx`** (pure SVG mini polyline from GeoJSON LineString/MultiLineString, matching `CarnetCoverCard` `.lkdh-trace`).
- [ ] **Step 2: Implement `ExplorerCategoryLenses.tsx` and `LayersCategoryLenses.tsx`** following `.agents/rules/lkdv-design-system.md` (zero prose paragraphs, zero inline filter bars, zero duplicate controls).
- [ ] **Step 3: Run ESLint check on created files**
  - Expected: 0 errors.

---

### Task 4: Catégorie 3 (`Pokédex`) & Catégorie 4 (`Sécurité & Terrain`) Visual Lenses

**Files:**
- Create: `src/features/explorer-v2/redesign/lenses/PokedexCategoryLenses.tsx`
- Create: `src/features/explorer-v2/redesign/lenses/SafetyCategoryLenses.tsx`

**Interfaces:**
- Consumes: `PokedexSpeciesDetailCard`, `CarnetSpeciesCreatePane` (portaled via `document.body`), `PokedexNearPayload`, `HazardsPayload`, `WeatherResponse`, `OfflineDaylight`, `PoiItem`, `AnimatedNumber`, `Recharts AreaChart`.
- Produces:
  - `PokedexCategoryLenses` (3 lenses: `all`, `faune`, `flore`; 2-col 3D tilt holo cards using `.lkdv-carnet-pokedex-*` classes; click → `onFocusCoordinates` + `StackSlideView` detail with circular `×`; portaled observation capture sheet).
  - `SafetyCategoryLenses` (3 lenses: `hazards`, `weather`, `survival`; visual severity cards, 12 h Recharts curve + offline twilight/turnaround times, 2-col water/refuge/rescue cards; click → `onFocusCoordinates`).

- [ ] **Step 1: Implement `PokedexCategoryLenses.tsx` and `SafetyCategoryLenses.tsx`** strictly reusing `.lkdv-carnet-pokedex-*` and `.club-glass-card` classes.
- [ ] **Step 2: Run ESLint check on created files**
  - Expected: 0 errors.

---

### Task 5: Catégorie 5 (`Communauté & Bouteille à la mer`) + Portaled Bottle Modal

**Files:**
- Create: `src/features/explorer-v2/redesign/lenses/BottleLaunchModal.tsx`
- Create: `src/features/explorer-v2/redesign/lenses/CommunityCategoryLenses.tsx`

**Interfaces:**
- Consumes: `SocialMapPayload` (including `bottles`, `carnets`, `clubs`, `stories`, `friends`), `CarnetHorizontalTimeline`, `StoriesViewer` (lazy-loaded), Supabase client (`travel_groups`, `group_members`, `group_public_card_stats`, `user_blocks`), `useAuth`.
- Produces:
  - `BottleLaunchModal`: portaled (`createPortal(..., document.body)`) Apple Liquid Glass modal matching `OutingTransportLens` modal grammar, circular `×` close pill, enforcing `trust_score >= 65` (create), floor `50` (join), max `3` active owned bottles, majority checkbox.
  - `CommunityCategoryLenses` (4 lenses: `bottles`, `carnets`, `clubs`, `stories`; visual bottle cards with single action pill, 4:5 carnet cover cards, `CarnetHorizontalTimeline` of club outings, `.ig-hl-row` story bubbles + fuzzed friends pills; clicking any card focuses the 3D map via `onFocusCoordinates`).

- [ ] **Step 1: Implement `BottleLaunchModal.tsx` and `CommunityCategoryLenses.tsx`** (zero inline forms; strict `https://` URL validation).
- [ ] **Step 2: Run ESLint check on created files**
  - Expected: 0 errors.

---

### Task 6: Sport Launch (`▶`), Compact GPS Drawer, Unified Search, Bilan & Clean Master Rewiring

**Files:**
- Create: `src/features/explorer-v2/redesign/ExplorerSportLaunchSheet.tsx`
- Create: `src/features/explorer-v2/redesign/ExplorerGpsDrawer.tsx`
- Create: `src/features/explorer-v2/redesign/ExplorerSearchSheet.tsx`
- Create: `src/features/explorer-v2/redesign/ExplorerSummarySheet.tsx`
- Modify: `src/features/explorer-v2/ExplorerV2.tsx`
- Modify: `tests/explorer-v2/explorer-mount-hydration.spec.tsx`
- Remove obsolete UI files (verify zero dangling imports first):
  - `src/features/explorer-v2/chrome/PresetPillRail.tsx`
  - `src/features/explorer-v2/chrome/BottomBar.tsx`
  - `src/features/explorer-v2/sheet/AdaptiveReadinessCard.tsx`
  - `src/features/explorer-v2/sheet/TerritorialEncyclopediaSheet.tsx`
  - `src/features/explorer-v2/sheet/UnifiedLayersSheet.tsx`
  - `src/features/explorer-v2/hud/GpsActiveHud.tsx`
  - `src/features/explorer-v2/hud/HudContrastToggle.tsx`

**Interfaces:**
- Consumes: all headless hooks (`useGpsTracker`, `useNavigationGuidance`, `localSession`, `sessionSync`, `useExplorerStore`, `unifiedLayersHooks`, `adaptive/*`), `ExplorerMapChrome`, `ExplorerGlassDrawer`, all 5 category lens components, `ClubIsland`.
- Produces:
  - Clean `ExplorerV2.tsx` mounting ONLY: `MapStage` + `ExplorerMapChrome` + `ExplorerGlassDrawer` (or `ExplorerGpsDrawer` in `GPS_ACTIVE`/`SOS`) + lazy `Countdown` + lazy `planner`/`multiday` deep-link portal.
  - Fixes `kf.update` → `kf.process` and aligns `updateSafetyCorridor` keys with `SafetyCorridorState`.
  - Routes Turn-by-Turn / Off-Route strictly into `ClubIsland` (zero stacked overlays in GPS mode).

- [ ] **Step 1: Implement `ExplorerSportLaunchSheet.tsx`, `ExplorerGpsDrawer.tsx`, `ExplorerSearchSheet.tsx`, and `ExplorerSummarySheet.tsx`**
- [ ] **Step 2: Rewire `ExplorerV2.tsx` to use the new 20/20 architecture, fix Kalman + corridor wiring, and remove obsolete 0/20 UI files (after grepping for any remaining imports/tests)**
- [ ] **Step 3: Update `tests/explorer-v2/explorer-mount-hydration.spec.tsx` and add end-to-end UI wiring tests**
- [ ] **Step 4: Run ESLint + full Explorer Vitest suite**
  - Expected: 0 ESLint errors, 100% Vitest green.

---

### Task 7: Final Code Review, Architectural Audit & 20/20 Visual Browser QA (`390×844`)

**Files:**
- Verify live: `http://localhost:4029/explorer`

- [ ] **Step 1: Dispatch `apple-liquid-glass-architect` + `code-reviewer` on the complete diff**
  - Verify 100% adherence to `.agents/rules/lkdv-design-system.md`, zero duplicate buttons, zero inline forms, visual-over-text craft, security/privacy invariants.
- [ ] **Step 2: Live Browser QA (`browser` subagent, `Model: "flash"`, `390×844`) + Direct Screenshot Inspection (`read_file`)**
  - Capture and inspect screenshots of:
    1. Cold boot `peek` (map 85% visible, global `NavigationBar` visible, drawer docked above with 5 icons + `▶` top-right, `0` `/api/explorer/v2/*` calls).
    2. `mid` & `full` across all 5 categories (`Explorer`, `Carte & Calques`, `Pokédex` 3D holo, `Sécurité`, `Communauté` with **Bouteille à la mer**).
    3. Map click → detail sub-drawer & card click → map focus bidirectional interconnection.
    4. `▶` Sport launch → `GPS_ACTIVE` compact drawer → `Plein soleil` / `Nuit rouge` via `SortMenuButton` → `Stop 0,8 s` → `Bilan` → clean return to `EXPLORE`.
  - Fix every single visual or functional defect discovered and re-verify until 0 console errors, 0 HTTP 4xx/5xx errors, and genuine **20/20 Apple Liquid Glass** visual quality.
