# Le Kit du Voyageur — Complete Mobile App Reference

> **Scope** : this document describes the mobile application exclusively (PWA + native iOS/Android shells via Capacitor). It covers the vision, context, ambition, the unique visual style (with the **Hub** page as the canonical reference), every route, every feature, and everything remaining for a global launch. It also lists the AI agents and skills to use for any modification.
>
> **Sources of truth** : `DESIGN_SYSTEM.md`, `tailwind.config.js`, `src/styles/tokens.css`, `src/styles/liquid-glass.css`, `docs/Y_HUB_SPEC.md`, `ADVENTURE_INTELLIGENCE_MASTER_PLAN.md`, `ROADMAP_VOYAGE.md`, `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md`, `MISSION_LOG.md`, `MEMORY.md`, `CLAUDE.md`, `AGENTS.md`.

---

## 1. Vision, purpose & context

**Le Kit du Voyageur (LKDV)** is an e-commerce + community platform for outdoor travelers: gear shop, kit generator, hike explorer (PostGIS), community (clubs, groups, events, journals), AI-enriched country guides, real-time GPS cockpit, and a unified travel hub.

### The why — the `trip` pivot
Historically, the modules lived as "islands" (journal, kit, hiking, countries, shop, messaging) with no link between them. **The Travel Module introduced the pivotal `trip` object** that connects everything: `1..N countries × 1..N stages × 1..N days`, with kit, budget, documents, chat and journal attached to the same `trip_id`.

**The promise** : *"one screen: flight + hut + missing gear + commission + friends."*

### The context
- Product created by **Tony Faraci**, **French-speaking community first**, then international (Europe, North America, Asia).
- Target: outdoor travelers, self-sufficient hikers, bivouac campers.
- Built with an intensive agentic workflow: Superpowers skills, specialized subagents, multi-expert audits (Icon Agents).

---

## 2. Product ambition — "Adventure Intelligence System"

The target vision is an **"Adventure Autopilot"** : *"One intention. One complete adventure. Always up to date."*

Four families of intelligence make up the system:

| Family | Content |
|---|---|
| **Personal** | Terrain profile learned from usage (real pace, personal difficulty, fatigue) |
| **Terrain** | Qualified trail segments, technicality, GPS/PostGIS map-matching |
| **Collective** | "Terrain Live" — the Waze of the outdoors (reports, confirmations, privacy ≥ 5 users) |
| **Contextual** | Weather, conditions, external events |

**Founding principle** : *"Engines compute. The solver arbitrates. AI explains. The user controls."* — AI is an enricher/explainer, never the primary calculator.

---

## 3. Business model & target

**Frozen objectives by priority** (`ROADMAP_VOYAGE.md` §1.3) :
1. **Sell gear from the LKDV shop** — contextual kit generated → Stripe cart (full margin)
2. **Travelpayouts affiliation** — flights, hotels, cars, insurance, eSIM (1.1% to 70% commissions)
3. **SEO** — `/lieux/[slug]`, `/pays` pages, public trips, journals

**Target economic model** (master plan §25) :
- **B2C subscriptions** : Free / **Explorer €39.99/yr** / **Expedition €79.99/yr** / **Family-Group €119–149/yr**
- **Per-trip passes** : Weekend €6.99 / Trip €14.99 / Expedition €29.99
- Affiliation, gear sales, B2B/API, local marketplace

**Single KPI** : the number of trips reaching the "kit completed" state.

---

## 4. Mobile tech stack

| Layer | Technology | Version |
|---|---|---|
| Web framework | Next.js (App Router, RSC + Server Actions) | 15.5.25 |
| UI | React / React DOM | 19.0.3 |
| Language | TypeScript | ^5 |
| Native shell | Capacitor core/cli/android/ios | ^8.5.0 |
| Native plugins | app, camera, geolocation, haptics, keyboard, network, preferences, splash-screen, status-bar, PushNotifications | v8.x |
| Styling | Tailwind CSS (+ animate, forms, typography) | 3.4.6 |
| Icons | lucide-react, @heroicons/react, in-house masked PNG pack | — |
| Components | @headlessui/react, @radix-ui (dialog, toast), vaul, cmdk, framer-motion | v2.x / v12 |
| Data | Supabase (PostgreSQL + PostGIS) + direct pg | ^2.49.4 |
| Payments | Stripe | ^17.7.0 |
| AI | @rocketnew/llm-sdk + OpenRouter (Nemotron) | ^1.1.0 |
| Maps | MapLibre GL (atlas) + Leaflet / react-leaflet | ^6.4.1 / 1.9.4 |
| Client state | Zustand, @tanstack/react-query, react-hot-toast | ^5 / ^5.101 |
| Offline | Dexie (IndexedDB) | ^4.4.5 |
| Validation | Zod | ^4.4.3 |
| Tests | Vitest, Playwright (+ axe-core), ESLint 9, Prettier | ^4 / ^1.51 |

**Capacitor configuration** (`capacitor.config.ts`) :
- `appId: com.lekitduvoyageur.app`, `appName: "Le Kit du Voyageur"`, `webDir: public`
- **`CAPACITOR_SERVER_URL` required** : the native shell serves the remote server (never a static HTML)
- SplashScreen **forest green `#17402C`** (1200 ms), StatusBar DARK, Keyboard resize body
- `iosScheme: capacitor`, `androidScheme: https`, `scheme: lkdv`, `ios.contentInset: never`, `preferredContentMode: mobile`

**Ports** : dev `4000`, start `4028`.

---

## 5. Visual identity & Design System

> **Absolute rule (DESIGN_SYSTEM.md)** : no business component may recreate an existing UI component ad hoc nor introduce arbitrary colors/fonts. Sources of truth: `/materiel` (Liquid Glass) and `/compte` (user patterns).

### 5.1 Colors — canonical palette

**Master tokens** (`src/styles/tokens.css`) :

| Token | Value |
|---|---|
| `--lkv-primary` (Forest) | `#17402C` |
| `--lkv-primary-hover` | `#205238` |
| `--lkv-primary-soft` | `#365233` |
| `--lkv-primary-subtle` | `#EBF2EC` |
| `--lkv-secondary` (Sage) | `#5B7F55` |
| `--lkv-secondary-hover` | `#4A6B44` |
| `--lkv-secondary-subtle` | `#D8E5D5` |
| `--lkv-surface` (mobile canvas) | `#EEF3EC` |
| `--lkv-surface-card` / `-elevated` | `#FFFFFF` |
| `--lkv-surface-muted` | `#F3EFEA` |
| `--lkv-text-primary` | `#17402C` |
| `--lkv-text-secondary` | `#5B7F55` |
| `--lkv-text-muted` | `#6B7568` |
| `--lkv-text-subtle` | `#9BA397` |
| `--lkv-border` | `rgba(23,64,44,0.12)` (subtle `0.06`, strong `0.24`) |
| `--lkv-success` | `#5B7F55` (bg `#E1EBDE`) |
| `--lkv-warning` | `#C89A3B` (bg `#FBF1DC`) |
| `--lkv-danger` | `#A8443A` (bg `#FDE8E6`) |
| `--lkv-info` | `#4B6B7C` (bg `#DDE7EE`) |

**Full palettes** (`tailwind.config.js`) :
- **Forest** (brand) : `950 #0D1410` · `900 #131A16` · `700 #243028` · `600 #2D5A3D` · `500 #3D7A52` · `400 #4A7C5B` · `300 #6B9B7A` · `200 #9BBBA8` · `100 #C8D9CE` · `50 #EBF2EC`
- **Sage** (accent) : `900 #1E3A1D` → `50 #F2F6F1`, pivot `500 #5B7F55`
- **Stone** (backgrounds/glass) : `950 #1A1815` → `50 #FAF8F5`, pivots `400 #B8AE9E`, `600 #7A7365`
- **Sand** (warm) : `900 #3D3828` → `50 #F5F3EE`
- **Sky** (maps, water) : `900 #10222B` → `50 #F0F7FA`
- **Ink** (text) : `900 #14140F` · `700 #2B2A24` · `500 #5A574E` · `300 #8C8779`
- **Warm** : `300 #F1DAB1` · `500 #E4C695` · `700 #B08A4E`

### 5.2 Typography

| Font | CSS variable | Usage |
|---|---|---|
| **DM Sans** (300–700) | `--font-sans` / `--font-body` | Body text |
| **Manrope** (400–800) | `--font-display` | Headings, display |
| **IBM Plex Mono** (400–600) | `--font-mono` | Numbers, technical labels, badges |
| **Instrument Serif** (regular+italic) | `--font-serif` (`.font-serif-lkv`) | Editorial accents: budget donut, journal, quotes |

**Note** : SF Pro is not embedded — the app recreates the Apple language with DM Sans/Manrope + the in-house Liquid Glass system. Scales: `text-hero` clamp 3rem→6rem / -0.04em / 800; uppercase labels 11px `0.14em`; stats `tabular-nums`.

### 5.3 Radii, shadows, spacing, z-index

- **Radii** : `xs 6px` · `sm 10px` · `md 14px` · `lg 20px` · `xl 26px` · `card 28px` · `2xl 32px` · `full 9999px`
- **Shadows** : `elevation-1..5` (`rgba(23,64,44,.04)` → `.16`) ; `green` `0 8px 24px rgba(45,90,61,0.28)` ; `green-lg` `0 16px 48px rgba(45,90,61,0.35)`
- **Spacing** : 4pt scale — 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 px
- **Z-index** : base 0 · sticky 20 · drawer 40 · sheet 50 · command 60 · toast 70
- **Touch (HIG)** : `--lkv-touch-min 44px`, `--lkv-touch-comfortable 48px` (every interactive target ≥ 44×44 px)

### 5.4 Motion & durations

- **Durations** : `--dur-xfast 120ms` · `fast 180ms` · `med 280ms` · `slow 420ms` · `xslow 800ms`
- **Curves** :
  - `--ease-glass` `cubic-bezier(0.22,1,0.36,1)`
  - `--ease-spring` `cubic-bezier(0.34,1.56,0.64,1)` (spring-bounce)
  - `--ease-smooth` `cubic-bezier(0.16,1,0.3,1)` (spring-smooth)
  - `--ease-emphasis` `cubic-bezier(0.2,0.8,0.2,1)`
- **Animations** : `slide-up 500ms`, `slide-down 300ms`, `fade-in 400ms`, `scale-in 300ms`, `spring-in 600ms`, `float 3s`, `shimmer 1.5s`, `pulse-slow 3s`
- **Haptics** : `useHapticFeedback()` / `triggerHaptic('selection'|'light'|'medium')` on selections, buttons, switches, tabs.

### 5.5 Liquid Glass (iOS 26) — the signature style

`src/styles/liquid-glass.css` (1,266 lines) implements the "True Crystal Glass with Soft White Veil" spec:

- **Glass** : `--glass-bg-light rgba(255,255,255,0.45)` / medium `0.55` / strong `0.75` ; border `rgba(255,255,255,0.65)` ; `backdrop-filter: blur(10px) saturate(160%)` ; sheen/specular edge highlights (::before/::after)
- **`.glass` class** : blur 10px + saturation 160% + inset shadow + edge-light ; `.glass.interactive` → hover `translateY(-2px)` + sage glow, active `scale(0.995)`
- **Tones** : `.tone-sage`, `.tone-warn`, `.tone-danger`, `.tone-info`
- **`.glass-capsule-btn`** : "stadium" pill — gradient `rgba(240,237,228,.94)→rgba(225,221,208,.84)`, 1.5px white 0.88 border, blur 16px sat 180% ; `.primary` variant = forest gradient `rgba(23,64,44,.92)→rgba(15,43,30,.96)` ; `.secondary` ; `.glass-capsule-btn-like` (rose `rgba(254,226,226,.85)`)
- **`.glass-circle-btn`** : round button — gradient `rgba(244,248,245,.96)→rgba(226,237,228,.88)` + `.primary`
- **`.glass-capsule-bar` / `.glass-capsule-segment`** : iOS 26 pill segmented control (active segment white gradient 0.75→0.45)
- **`.glass-sub-card`** : sub-card white 0.82 + blur 8px ; **`.glass-input`** : 44px, 16px font (iOS anti-zoom)
- **`.glass-eyebrow`** (11px / 0.14em / uppercase), **`.glass-metric`** (mono tabular, `-xl` 64px, `-xxl` 44px), **`.glass-pill`**, **`.glass-progress`** (4px), **`.glass-check-circle`**
- **Dark mode** (`prefers-color-scheme: dark`) : glass `rgba(255,255,255,0.10–0.22)`, border 0.18 ; **`.ultra-save-mode`** : pure OLED black (cockpit)
- **`data-lkv-material-theme='light'`** : ultra-bright cockpit (glass 0.08–0.18, border 0.35)
- **`.hub-rail .glass`** : reinforced background `rgba(255,255,255,0.62)` for legibility over photos (except `.glass-pure`)
- **Messaging** : `.msg-bubble` (received, white gradient 0.92), `.msg-bubble--mine` (forest gradient 165°), `.glass-send-btn`
- **`LiquidGlassDefs`** (`src/components/ui-layouts/liquid-glass-defs.tsx`) : SVG filter `feTurbulence fractalNoise 0.003/0.007` + `feDisplacementMap scale 200` — the "liquid glass" distortion
- **A11y** : `prefers-reduced-transparency` (glass → opaque), `prefers-reduced-motion` (durations 0.01ms), fallback `@supports not (backdrop-filter)`

---

## 6. Canonical UI components

All in `src/components/ui/`. **Use these first, always** — never recreate ad hoc.

| Component | Role & variants |
|---|---|
| **`LkvButton`** | Canonical button. Variants: `primary`, `secondary`, `light`, `ghost-light`, `ghost`, `danger`, `icon-only`. Sizes: `sm` 32px/12px, `md` 42px/14px, `lg` 48px/15px. Radius 999px, weight 600, press `scale(0.97)`, hover `scale(1.015)`, focus ring `2px #5B7F55`, disabled 0.45 |
| **`Button`** / **`Card`** / **`Badge`** | Retro-compatible adapters delegating to the primitives |
| **`GlassCard`** | Glass card. Tones: `neutral`, `sage`, `warn`, `danger`, `info` ; blur `sm 8px`/`md 10px`/`lg 16px` ; `interactive` (whileTap 0.985) |
| **`LkvChip`** | Pill chip/badge. Tones: `sage`, `warn`, `danger`, `info`, `stone`, `light`, `dark`. Padding 5px 12px, radius 999px, 11px, press 0.95 ; active = `#17402C` bg, white text |
| **`Sheet`** | Mobile bottom sheet: `rounded-t-[28px]`, drag handle `w-12 h-1.5`, drag-to-dismiss (>100px or velocity >500), spring damping 30 / stiffness 350 ; desktop = centered modal |
| **`GlassSheet`** | Full-screen glass sheet: blur 32px + sat 200%, sticky 56px header + safe-area-top, back button `glass interactive h-11 w-11 rounded-full` |
| **`GlassModal`** | Glass modal: `sheet`/`centered`, `rounded-t-3xl`/`rounded-3xl`, overlay `bg-ink-900/40 blur 2px` |
| **`GlassCapsuleBtn`** | Stadium-pill CTA: `default`/`primary`/`secondary`, sizes `default`/`sm`/`xs`, `min-h-[44px]` for hub CTAs |
| **`IOSSegmentedControl`** | iOS segmented: container `bg-[#EAE6DF]/70 backdrop-blur-xl border-white/60 rounded-full p-1`, active `#17402C`, framer pill `layoutId="ios-segmented-pill"` spring 480/36, `selection` haptic |
| **`ScrollableTabs`** | Scrollable tabs: `pill`/`underline`/`glass`, active pill `bg-lkv-primary` layoutId spring 500/35, mask fade, snap-x |
| **`LkvInput` / `LkvTextarea` / `LkvSelect` / `LkvCheckbox`** | Canonical forms: `bg-white/70 backdrop-blur-md border-[#17402C]/12 rounded-2xl`, focus ring, **`text-[16px]` iOS anti-zoom** |
| **`LkvSwitch`** | iOS switch: track `h-6 w-11`, on `#17402C` / off `#17402C/20`, spring 500/30 thumb, haptic |
| **`LkvIcon` / `Icon`** | Icons. 3-source resolution: 1) local animated SVGs (`src/components/icons/*`, 66 files, lucide-animated style), 2) masked PNG pack (`public/icons`, 468 files), 3) Heroicons 24. 27 animated names in `LkvIcon` (home, mountain, compass, box, users, user, sparkles, tent, book, bag, doc, search, chevrons, close, menu, bell, heart, bookmark, map-pin, star, lock, filter, minus, plus…) |
| **`BottomTabBar`** | See section 8 |
| **`GlassSubCard`**, **`GlassDrawer`**, **`GlassCommand`**, **`GlassIconButton`**, **`IOSInsetGroupedList`**, **`Skeleton`**, **`ShimmerLoader`**, **`EmptyState`**, **`ProgressBar`**, **`Metric`**, **`Eyebrow`** | Secondary primitives |
| **`MobilePageShell` / `AppShellDesktop`** | Page wrappers with safe areas (`env(safe-area-inset-*)`), canopy background, inner scroll |

**Sidebar / rails** :
- **Desktop** : `AppShellDesktop` — 3-column cockpit: left sidebar 260px (activity navigation), center flex-1 (work in progress), right rail 300px (context widgets).
- **Hub** : `HubSidebarLeft` (activities + planner CTA), `HubSidebarRight` (`hub-rail`, reinforced glass 62% white, widgets `WidgetCard = glass p-4 rounded-[1.5rem]`, labels 10px uppercase 0.14em).

---

## 7. The Hub — the app's reference page

**Path** : `src/app/hub/` + `src/features/hub/` (159 files). The hub is the heart of the mobile experience: it defines the reference style, interactions and navigation.

### 7.1 Architecture

- **`/hub` (page.tsx)** — "Hub V4: ROOT = MENU of tab-cards". Dispatches by active adventure nature:
  - `SortieMenu` (trip) · `CollectifMenu` (group) · `PossessionMenu` (gear)
  - `?phase=live` → `PhaseLiveView` (field cockpit) · `?phase=recount` → `PhaseRecountView`
- **`/hub/layout.tsx`** — `dynamic = 'force-dynamic'` (never pre-rendered: auth/cookies). Suspense → `HubLoading` (BENTO skeleton), then `HubShell`, `AdventureIntelligenceHub`, `ItineraryAdventureCockpit`, `TripAffiliateProvider`, `LiquidGlassDefs`.
- **`/hub/nouveau`** — adventure creation: `?mode=ia` → `AutoGenTripCreateView`, otherwise `TripWizard` (5 steps).
- **`/hub/[section]`** — canonical URL-driven section rendering via `hubSectionRegistry` ; incompatible nature → 404 ; client views loaded with `ssr:false` (ItineraryPlanner, Budget, Checklist, Docs, Safety, Journal, Export, Team, GroupeCockpit).

### 7.2 Natures & phases

- **3 adventure natures** : `Sortie` (trip), `Collectif` (group), `Possession` (gear). The `NaturePill` shows the nature, `NatureSwitcherSheet` switches it ; `AdventureSwitcher` lists adventures.
- **3 phases** : `prepare` → `live` → `recount`. The BENTO menu and actions reconfigure per phase. In `live`: floating **SOS** button (`SosFloatingButton`).

### 7.3 Sections (`hubSectionRegistry` — 18 sections)

| Domain | Sections |
|---|---|
| Sortie (trip) | `itinerary`, `gear`, `groupe`, `budget`, `docs`, `checklist`, `safety`, `journal`, `export` |
| Possession (gear) | `inventaire`, `kit`, `preparation`, `depart`, `disponibilite`, `alertes`, `oublis` |
| Collectif (group) | `invitations`, `voyages-lies`, `groupe` |

Associated lucide icons : `Backpack`, `BellRing`, `BookOpen`, `CalendarCheck`, `CheckSquare`, `ClipboardList`, `Compass`, `CreditCard`, `FileText`, `FlaskConical`, `Footprints`, `MailPlus`, `Map`, `Navigation`, `Package`, `Share2`, `Shield`, `Users`.

**Y specification (10 trip sections + 4 invariant zones)** :
- Zones: header (identity + global state) · left column 260px (navigation only) · center flex-1 (work in progress, max 3 summaries) · right column 300px (widgets).
- `tripSectionRegistry` sections: `overview`, `itinerary`, `gear`, `team`, `budget` (`canManageBudget`), `docs` (`canViewDocuments`), `checklist`, `safety`, `journal`, `export`. **The map is an itinerary mode, not a section.**
- Profile → sections matrix (day/short/long/exped × solo/group), `compact` density if `scale=day`.
- Rules: one `<h1>` per surface, one network indicator, touch targets ≥ 44px.

### 7.4 Widgets (right rail / context — 12 widgets, priorities 100→20)

`countdown`, `primary-action`, `alerts`, `next-step`, `safety-next`, `kit-balance`, `budget-burn`, `group-presence`, `trip-context`, `country-card`, `docs-expiry`, `offline-toggle`.
Canonical CTA: "Enter the trip" = `glass-capsule-btn primary min-h-[44px]`.

### 7.5 Hub components

- **`HubShell.tsx`** — single shell: desktop = `AppShellDesktop` ; mobile = full-screen `MobilePageShell` without vertical scroll (`h-[calc(100dvh-var(--shell-top-padding,0px))]`), floating card above the tab bar ; `HubRealtimeRefresh`, `HubNetworkStatus`, `PrimaryActionWidget`, realtime bridge.
- **`SortieMenu.tsx`** — phase-contextualized BENTO, `MoreSectionsGrid` (spans 3/4/6/8, `fitRows`), `NextActionCard` (action thread), `ActivityIdentityBar`, `SosFloatingButton` (live).
- **`MenuCard.tsx`** — the **signature tab-card** : `glass relative h-full overflow-hidden rounded-[1.5rem]` ; micro-label `text-[11px] font-medium uppercase tracking-[0.14em]` (accent `--lkv-primary`, default `--lkv-text-secondary`) ; `media` variant (full-background media + `glass-sub-card w-[42%] min-w-[230px] max-w-[320px] rounded-xl` panel, bottom scrim `from-white/85`) ; `interactiveBody`.
- **Mobile sections** : `MobileAdventureHub`, `SectionCarousel`, `SortieMoment`/`CollectifMoment`/`PossessionMoment`, `MomentMapCard`, `MomentStatCard`, `HubRouteMap`, `DayTraceMap`, `InfoChipsRow`, `WeatherStrip` (capsule variant), `BudgetDonut` (serif italic budget donut), `NumberStat` (NumberFlow counters), `GearPhotoCarousel`, `MissingItemsDrawer`, `ItineraryDayTimeline`, `GroupeCriticalPath`.
- **Per-section engines** (`features/hub/mobile/`) : `mobileHubEngine`, `itineraryEngine`, `budgetEngine`, `gearEngine`, `groupeEngine`, `teamEngine`, `checklistEngine`, `docsEngine`, `exportEngine`, `journalEngine`, `safetyEngine`, `hubSwipeEngine`.
- **Hooks** : `useHubSwipeNav` (swipe between sections), `useAndroidHubBackNav` (Android back), `useHubLiveSensors`, `useHubTelemetry` (RUM).
- **State** : `useHubStore` (Zustand) ; `ActiveAdventureContext` + `activeAdventureServer` (cookies).

### 7.6 Notable hub classes

`hub-rail`, `data-hub-widget`, `glass-pure`, `glass-sub-card`, `no-scrollbar`, `bg-black/5` (progress tracks), `bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]` (bars), chips `bg-[var(--lkv-primary)]/10`, badges `bg-[var(--sage-50)] text-[var(--sage-700)]`, danger `bg-[var(--lkv-danger)]/10`, avatars `ring-2 ring-white`, stats `text-2xl font-extrabold tracking-tight`, serif italic `font-serif-lkv italic`, `tabular-nums`.

---

## 8. Mobile navigation

- **`BottomTabBar`** (floating iOS) — 4 tabs: **Explorer** (`mountain`), **Hub** (`tent`, isHero, **long-press 550ms → AdventureSwitcher**), **Community** (`users`), **Profile** (`user`).
  - 52px bar, radius 999, gradient `rgba(255,255,255,.78)→(.48)`, `blur(30px) saturate(200%)`
  - Active pill `glass-circle-btn` (framer layoutId, spring 450/32) ; active icon 26px `#17402C`, otherwise 22px `#365233`
  - `glass-pill` badges, 44px upper tray (per-page tabs), safe-area-bottom, hidable via `lkdv-toggle-bottom-bar` event
- **Safe areas** : `env(safe-area-inset-*)` in `GlassSheet`, `BottomTabBar`, messaging (`msg-safe-top`)
- **iOS/Android** : `viewport maximumScale=1, viewportFit='cover'`, `appleWebApp.capable`, `themeColor #EEF3EC`, `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`

---

## 9. Every app route

### 9.1 Hub (mobile core)

| Route | File | Role |
|---|---|---|
| `/hub` | `src/app/hub/page.tsx` | Hub V4 — root menu of tab-cards (Sortie/Collectif/Possession) |
| `/hub/[section]` | `src/app/hub/[section]/page.tsx` | URL-driven sections via `hubSectionRegistry` |
| `/hub/nouveau` | `src/app/hub/nouveau/page.tsx` | Adventure creation (5-step wizard or AI) |

### 9.2 Creation & exploration

| Route | Role |
|---|---|
| `/` | Desktop landing ; **mobile → 302 redirect `/hub`** (middleware) |
| `/explorer` | ATLAS — unified MapLibre globe explorer (replaces the historical map) |
| `/ai-configurator` | AI trip configurator |
| `/copilote` | Copilot |
| `/carte-interactive` | → 307 redirect `/explorer` |
| `/pays/[code]` | Country page (4 sections) |
| `/randonnee-active` | Active-hike GPS cockpit |
| `/preparer-randonnee` | Hike preparation |
| `/preparer-sentier/[id]` | Prepare a specific trail (live AI enrichment) |
| `/preparer-sentier/apercu` | Preparation preview |

### 9.3 Legacy trips (hub shims)

| Route | Role |
|---|---|
| `/voyages/[slug]` | Trip detail |
| `/voyages/[slug]/[section]` | **Pure shim** → switches to `/hub/<segment>` |

### 9.4 Community / social

`/communaute`, `/communaute/publier`, `/publier`, `/feed`, `/profil`, `/profil/[id]`, `/rejoindre/[slug]`, `/clubs`, `/clubs/[id]`, `/clubs/nouveau`, `/nouveau-groupe`, `/entraide`, `/evenements`, `/ambassadeurs`, `/experts`, `/createurs`, `/communaute-pro`, `/messagerie`, `/avis`

### 9.5 Commerce

`/boutique`, `/produit/[slug]`, `/kits`, `/kits/[slug]`, `/k/[token]` (shared kit), `/panier`, `/checkout`, `/abonnements`, `/occasion`, `/location`, `/fidelite`, `/recompenses`, `/pro` (B2B), `/carbone`, `/rapport-expedition`

### 9.6 Content & guides

`/guides`, `/guides/[slug]`, `/lieux`, `/lieux/[slug]`, `/outils`, `/outils/[slug]`, `/blog`, `/faq`, `/manifeste`, `/carnets`, `/carnets/[id]`, `/carnets/nouveau`

### 9.7 Account / auth / admin

`/connexion`, `/inscription`, `/compte`, `/compte/[userId]`, `/compte/modifier`, `/admin`, `/admin/produits`, `/hors-ligne` (offline page)

### 9.8 Legal

`/cgu`, `/cgv`, `/mentions-legales`, `/politique-confidentialite`, `/cookies`, `/contact`

### 9.9 Special files

`not-found.tsx`, `global-error.tsx`, `robots.ts`, `sitemap.ts` + `src/middleware.ts`.

---

## 10. API (99 route handlers in `src/app/api/`)

Domains: `account`, `admin`, `adventure`, `affiliate`, `ai`, `badges`, `billing`, `carnet(s)`, `checkout`, `cron`, `dev`, `discovery`, `guides`, `hike-sessions`, `hikes`, `hub`, `identity`, `indexnow`, `kit-report`, `kits`, `materiel`, `notifications`, `og-preview`, `pays`, `pois`, `produit`, `rewards`, `seed`, `stripe`, `telemetry`, `terrain`, `trails`, `trip-assistant`, `voyages`.

Notable: `/api/hikes` and `/api/pois` (rate limit 120/min/IP, 20° bbox per axis), `/api/telemetry/hub` (RUM Web Vitals), `/api/health`, versioned crons.

---

## 11. Middleware & redirects (`src/middleware.ts`)

1. **Mobile landing** : `/` + mobile UA → **302 `/hub`**
2. **Auth** : `/admin*`, `/checkout*` protected (Supabase SSR + `is_admin` RPC)
3. `/catalogue*` → `/boutique` (301)
4. **Legacy hub redirects** (307, matrix `src/lib/hub/hubRedirects.ts`) : `/materiel*`, `/voyages`, `/groupes`, `/equipages`, `/preparation`, `/terrain`, `/boussole`, etc. + `x-hub-redirect-source/target` headers
5. `/pays/[code|name]` → 2-letter normalization (301)

`next.config.mjs` : security headers (HSTS, CSP Report-Only), `Cache-Control: private, no-store` on `/hub`, `/compte`, private APIs ; redirects `/carte-interactive` and `/pays` → `/explorer` (307) ; `allowedDevOrigins` for local native testing.

---

## 12. PWA & Service Worker

- **`public/manifest.json`** : name "Le Kit du Voyageur", short "KdV", standalone, portrait, theme `#17402C`, 192/512 + maskable icons, **shortcuts** (AI Configurator `/ai-configurator`, Inventory `/inventaire`, Map `/carte-interactive`)
- **`public/sw.js` (v4)** :
  - CacheFirst (fonts/chunks), StaleWhileRevalidate (public images)
  - Network-First navigation — HTML cached **only for hard-coded public routes** (cross-account isolation)
  - Map tiles `lkdv-tiles-v1` bounded LRU 3000 entries
  - `LKDV_PURGE_PRIVATE` purge on logout (driven by AuthContext)
- **`public/offline.html`** + `/hors-ligne` page
- `ServiceWorkerRegistration` : **never registered in native Capacitor** ; `NativeAppBootstrap` handles native.

---

## 13. Features by domain

### Shop & kits
80-product CSV catalog → 67 imported SKUs, cart, Stripe checkout, AI configurator, kit report (`/api/kit-report/generate`), **kit lineages** (materialized filiation, GPS field proof, 2-axis trust scores, creator royalties, HMAC `lkdv_kit_ref` cookie), gear inventory `/materiel` (pack management, weight, availability).

### Itineraries & trips
5-step wizard, day-by-day planner, greedy budget, encrypted documents, **real GPX 1.1 + PDF exports**, checklist, safety, journal ; deterministic auto-generation (intent → 16 blueprints → 12 layers → `coherenceSolver` → `budgetEngine`) ; `/preparer-sentier/[id]` with instant deterministic dressing + live LLM enrichment (animated 6-phase rail) ; **multi-person** (`trip_member_profiles`: learned/estimated/average).

### Countries
`/pays/[code]` — 4 sections (Presentation, Destinations, Activities & Treks, Culture & Society) ; 13 multi-tier AI blocks (`country_content_blocks`, Tier 1 safety = human review + RLS until validated) ; 39/39 blocks generated for NP/PT/ST ; **anti-hallucination** real kit recommendations ; `UnifiedCountryGlobe` ; `.country-cache` climate data.

### Explorer / ATLAS
`/explorer` — single **MapLibre globe** engine, 4 zoom levels, GIST-indexed `trails_in_viewport` RPC (0.3 ms), density matviews, native POI clustering, exact selected trace, flyTo/easeTo camera ; `explorer_unified_map_enabled` flag at 100% ; Viator/Klook/Tripadvisor activity discovery (provider-agnostic).

### Departure cockpit
Redesign: identity tied to the **real trail**, purge of the duplicated 3-column cockpit, `?route=X`, unified alerts, pack/weight, departure checklist.

### Active hiking
GPS cockpit: TrackingEngine / NavigationEngine / CopilotEngine / SafetyEngine, rerouting, nearby POIs, weather, GPX import/export, 3D terrain, post-hike AI narratives, species identification, `hike_sessions`, anonymized public footprint (`user_field_signature`), private orientation (`user_orientation`).

### Terrain Live (community)
UI + hooks in place (`QuickReportSheet`, `TerrainLiveLayer`, `useTerrainReports`, `TerrainLiveCockpitControl`) ; full backend (confirmations, lifecycle, moderation) = phase a5 to finalize.

### Tribe / collective
**Capability-based** groups (40-row matrix), club↔hub bridge, ephemeral groups, delegations, quorum, activity journal, checklist templates, **live position sharing** (1–72h sessions, 15-min TTL bounded in DB, `LiveSharePanel`, `atlas-members` map layer).

### AI (Nemotron router)
`nvidia/nemotron-3.5-lightning:free` via OpenRouter (`src/lib/ai/askAI.ts`) ; web plugins, quotas, cache, fallbacks, async `ai_jobs` + crons ; `assertFreeModel` safeguard ; anti-fabrication (3 km corridor) ; jobs `activity-enrichment`, `trail-narrative`, `country-blocks`.

### Offline
Banner + TTL localStorage cache ; **Dexie IndexedDB** (`tripOfflineStorage`/`SyncQueue`, adventure-intelligence pack + syncWorker), LWW resolution + audit journal, GDPR exclusion of documents ; Capacitor (geolocation, haptics, network, status-bar, splash).

### Security & compliance
**RLS on 100% of tables**, anti-drift CI invariants (`verify:invariants`, 6 invariants), rate limiting, sanitization, Zod everywhere, compliance docs (AIPD, DPA, DPO, legal notices, community rules), GDPR affiliation (SHA-256, no IP), ethical blurring (~500 m).

---

## 14. i18n — current state

| Language | Code | Status |
|---|---|---|
| French | `fr` | Native / complete (production) |
| English | `en` | Dictionary ready (`src/lib/i18n/translations/en.ts`), **not wired** |
| Spanish | `es` | Planned Q1 2027 |
| German | `de` | Planned Q2 2027 |

**Critical point** : the dictionaries (`fr.ts`/`en.ts`, `TranslationKeys` type) and formatters (`formatters.ts` : metric/imperial units, EUR/USD/GBP/CHF/CAD/JPY currencies, UTC-safe dates) exist, **but no file in `src/` imports `lib/i18n`**. The infrastructure is dormant — a major prerequisite for global launch.

---

## 15. What remains for a global launch

> Reference: `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md`. **Current verdict: NO-GO for global production** (development/private/preview only).

### 15.1 The 13 phases (0–12)

| Phase | Content | Status |
|---|---|---|
| **0–1** | Fix red HEAD CI, protect `main`, SBOM, secrets/licenses scan | ❌ |
| **2** | Certify the **remote database** (isolated Supabase test project, migration replay, remote pgTAP) | ❌ |
| **3** | **Unify the identifier chain** `trip_id → adventure_plan_id → route → kit → session → journal → publication` (verified anomaly: `AutoGenTripCreateView` does not truly link the chain) | ❌ |
| **4** | **Worldwide coverage** : licensed import pipeline, per-region quality thresholds — today 1,169 `hiking_routes` rows concentrated in France/Belgium, 0 trails in Chamonix, 30 micro-states without geometry | ❌ |
| **5** | Observability & operations (distributed rate limiting, backups) | ⚠️ `ops:a14-*`/`ops:a15-*` scripts |
| **6** | ATLAS scale : production tile contract + CSP, external scheduler for the density cron, 30 micro-state backfill, keyboard alternative on `/explorer`, First Load JS `/explorer` 265 KB > 170 KB target | ❌ |
| **7** | Community **without demo data** (hard-coded demos present), private journal by default | ❌ |
| **8** | **Real Stripe** : 6 Price IDs `INSUFFICIENT_DATA` (`docs/compliance/07_STRIPE_PRICE_IDS.md`), fail-safe tested but **no real payment ever executed** | ❌ |
| **9** | Wired i18n (label extraction, dates/units/currencies) | ❌ |
| **10** | Load & capacity (`phase10-capacity` suite to repair) | ⚠️ |
| **11** | **Stores** : signed Android AAB proven locally (`docs/mobile/ANDROID_RELEASE.md`) but **no publication** ; iOS **impossible on this machine** (no Mac/Xcode) — `docs/mobile/STORES_CHECKLIST.md` all `INSUFFICIENT_DATA` | ❌ |
| **12** | Progressive rollout internal → 1% → … → 100% with stop criteria | ❌ |

### 15.2 Documented blockers

- **B1** (`docs/Y_BLOCKERS.md`) : PR #31 merge impossible by the agent (`gh` CLI absent) → **human action (Tony) required**
- **4 pre-existing failing test suites** : `tests/ops/a14-healthcheck.spec.ts`, `tests/ops/a15-rollout.spec.ts`, `tests/ops/phase10-capacity.spec.ts`, `tests/adventure-intelligence/a13-backtest-export.spec.ts` (SyntaxError) — the quality-at-scale program (Batch B) must repair them
- **`docs/Z_TROUS_INVENTAIRE.md`** : of 12 functional layers, 8 are **estimations** (transport, huts, 2024 budget, administrative…) → mandatory "Estimation" mentions, honest positioning as a "route configurator and compiler"
- **`docs/BACKLOG_APRES_Z.md`** : D28/D29 (BigBuy catalog drives advice instead of the reverse), **Z7 legal compliance blocked (human legal review)**, Z10 Go/No-Go undecided
- **CI** : workflow to move `.github/ci.yml` → `.github/workflows/ci.yml` ; `eslint.ignoreDuringBuilds` still `true`
- **Missing owner env vars** : `TRAVELPAYOUTS_WEBHOOK_SECRET`, `TRAVELPAYOUTS_MARKER`, Stripe secrets, Travelpayouts Drive redeployment
- **Performance** : GO_NO_GO verdict "NO-GO large, 3 projects remaining" — framer-motion out of the static hub graph, dynamic splitting of `/hub/[section]`, RUM Web Vitals

---

## 16. Agents & skills to use for any modification

### 16.1 Permanent rules (AGENTS.md)

1. **UX & Interaction Design** : the `apple-ui-designer` and `interaction-design` skills **must** be applied for any decision about mobile layouts, visual hierarchies, microinteractions or native iOS/Apple transitions.
2. **Superpowers** : for any major development task, apply the Brainstorming → Implementation plan → Subagent-driven / TDD → Verification workflow.
3. **Design System** : never arbitrary colors/fonts, never an ad-hoc recreated UI component (see §5–6).

### 16.2 Icon Agents (64 experts, 8 pods)

Installed in `.claude/agents/`, `.claude/commands/`, `.agents/agents/` :

| Pod | Experts |
|---|---|
| **Programming** | Linus Torvalds, John Carmack, Rich Hickey, Brendan Eich, Kent Beck, Barbara Liskov, Leslie Lamport, Donald Knuth |
| **Security** | Dan Kaminsky, Katie Moussouris, Bruce Schneier, Mikko Hyppönen, Tarah Wheeler, Mudge Zatko, Eva Galperin, Moxie Marlinspike |
| **Design** | Dieter Rams, Don Norman, Edward Tufte, Jonathan Ive, Susan Kare, Jakob Nielsen, Kat Holmes, Lou Downe |
| **Business** | Clayton Christensen, Michael Porter, Eric Ries, Steve Jobs, Jeff Bezos, Satya Nadella, Reid Hoffman, Elon Musk |
| **Data & AI** | Andrew Ng, Fei-Fei Li, Geoffrey Hinton, Hilary Mason, Yann LeCun, Cassie Kozyrkov, DJ Patil, Demis Hassabis |
| **Product & Policy** | Marty Cagan, Gene Kim, Joanna Bryson, Michelle Zatlyn, Julie Zhuo, Ben Horowitz, Tristan Harris, Cathy O'Neil |
| **Platform & Ops** | Tim Berners-Lee, Vint Cerf, Radia Perlman, Werner Vogels, Martin Fowler, Brendan Gregg, Kelsey Hightower, Jessie Frazelle |
| **Healthcare & AI** | Atul Gawande, Eric Topol, Regina Barzilay, Daphne Koller, Bob Wachter, Fei-Fei Li, Andrew Ng, Vinod Khosla |

Commands: `/icon-review` (global), `/icon-programming-review`, `/icon-security-review`, `/icon-design-review`, `/icon-business-review`, `/icon-data-ai-review`, `/icon-product-policy-review`, `/icon-platform-operations-review`, `/icon-healthcare-review`.

### 16.3 OpenCode subagents (`.opencode/agent/`)

- **`atlas-conformite-lg`** — Liquid Glass quality control for the ATLAS project (grep checklist + fixes + tsc/lint/build + Playwright)
- **`atlas-data-layer`** — ATLAS data layer: PostGIS RPCs, materialized views, GIST indexes, RLS (verifies via EXPLAIN ANALYZE, never invents schema)
- **`atlas-globe-engine`** — single MapLibre GL engine (globe projection, 4 zoom levels, native clustering, flyTo/easeTo camera), respects the mobile perf budget
- **`pays-conformite-lg`** — Liquid Glass compliance of country pages
- **`code-reviewer`** — quality/security/maintainability review (use after any modification)
- **`security-reviewer`** — OWASP Top 10, secrets, SSRF, injections
- **`database-reviewer`** — PostgreSQL/Supabase: queries, schemas, performance
- **`performance-optimizer`** — profiling, bundle, bottlenecks
- **`a11y-architect`** — WCAG 2.2 (web + native)
- **`architect`** — architecture & scalability
- **`silent-failure-hunter`** — silent failures, swallowed errors, bad fallbacks

### 16.4 Country agents (`.claude/agents/` and `.agents/agents/`)

`pays-communaute-refonte`, `pays-conformite-lg`, `pays-hero-refonte`, `pays-sections-refonte` — Liquid Glass refactors of country pages (style only, business logic untouched). + `openrouter` agent (free secondary AI for analysis/review).

### 16.5 LKDV skills (`.agents/skills/`)

| Skill | Usage |
|---|---|
| `lkdv-development` | LKDV development rules and architecture |
| `lkdv-seo-agent` | SEO mission: outdoor travel reference |
| `map-geospatial` | LKDV maps (PostGIS, OSM, Leaflet) |
| `supabase-postgis` | Safe Supabase/PostgreSQL/PostGIS development |
| `security-audit` | Next.js, Supabase, APIs security review |
| `testing-qa` | Testing and regression prevention |
| `ux-mobile` | Premium mobile UX and responsive |
| `nextjs-performance` | Next.js 15 / React performance optimization |
| `code-quality` | Production quality, security, anti-regression |
| `github-workflow` | Safe Git/GitHub |
| `ai-agent-workflow` | LKDV agentic workflow |
| `seo` | Full multi-facet SEO (+ `claude-seo` suite ~30 skills) |

### 16.6 Superpowers (14 skills)

`brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `dispatching-parallel-agents`, `using-git-worktrees`, `finishing-a-development-branch`, `writing-skills`, `using-superpowers`.

### 16.7 Design & motion

`apple-ui-designer` (Apple-like iOS UI), `interaction-design` (microinteractions/motion), `frontend-design`, `expo-native-ui`, `liquid-glass-design` (iOS 26).

### 16.8 Other useful

Obsidian (`obsidian-markdown`, `obsidian-bases`, `obsidian-cli`, `json-canvas`, `defuddle`) ; `SkillsForOpenCode` bundle (~150 generic skills: accessibility, backend-patterns, kotlin-*, swift-*, etc.).

---

## 17. Verification commands (before closing any modification)

```bash
npm run dev                 # dev server (port 4000)
npm run build               # production build
npm run start               # production server (4028)
npm run test                # Vitest unit tests (~2,750 green)
npm run test:e2e            # Playwright E2E
npm run test:visual         # visual tests
npm run test:a11y           # axe-core audits
npm run verify:invariants   # 6 anti-drift CI invariants (RLS, ID chain…)
npm run mobile:sync         # npx cap sync
npm run mobile:build        # native build
npm run mobile:open:ios / npm run mobile:open:android
npm run icons:build         # regenerate icon registry
npm run seed:demo           # demo data
npm run supabase:status
npm run ops:*               # operational scripts (a14/a15)
```

**Mandatory verification** : `eslint` + `tsc` + test suites + `verify:invariants` before claiming success ; 4 pre-existing red suites (`a14-healthcheck`, `a15-rollout`, `phase10-capacity`, `a13-backtest-export`) to repair in the quality-at-scale program (Batch B).

---

## 18. Key documentary sources

| Document | Role |
|---|---|
| `DESIGN_SYSTEM.md` | Design system governance |
| `src/styles/tokens.css` + `liquid-glass.css` + `tailwind.css` | Tokens, Liquid Glass, Tailwind layers |
| `docs/Y_HUB_SPEC.md` | Frozen travel hub spec (zones, sections, widgets) |
| `ADVENTURE_INTELLIGENCE_MASTER_PLAN.md` | Adventure Intelligence product vision |
| `ROADMAP_VOYAGE.md` | Travel Module program (612 subtasks) |
| `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md` | The 13 global-launch phases |
| `docs/compliance/07_STRIPE_PRICE_IDS.md` | Stripe status |
| `docs/mobile/STORES_CHECKLIST.md` + `ANDROID_RELEASE.md` | Stores status |
| `docs/I18N_STRATEGY.md` | i18n strategy |
| `MISSION_LOG.md`, `MEMORY.md` | Execution history & agent memory |
| `docs/Y_BLOCKERS.md`, `docs/Z_TROUS_INVENTAIRE.md` | Blockers and inventory gaps |
