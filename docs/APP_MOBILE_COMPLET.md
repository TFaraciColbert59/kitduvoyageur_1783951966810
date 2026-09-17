# Le Kit du Voyageur — Référence Complète de l'Application Mobile

> **Portée** : ce document décrit exclusivement l'application mobile (PWA + coquilles natives iOS/Android via Capacitor). Il couvre la vision, le contexte, l'ambition, le style visuel unique (avec la page **Hub** comme référence canonique), toutes les routes, toutes les fonctionnalités, ainsi que tout ce qui reste à faire pour un lancement mondial. Il liste également les agents IA et skills à mobiliser pour toute modification.
>
> **Sources de vérité** : `DESIGN_SYSTEM.md`, `tailwind.config.js`, `src/styles/tokens.css`, `src/styles/liquid-glass.css`, `docs/Y_HUB_SPEC.md`, `ADVENTURE_INTELLIGENCE_MASTER_PLAN.md`, `ROADMAP_VOYAGE.md`, `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md`, `MISSION_LOG.md`, `MEMORY.md`, `CLAUDE.md`, `AGENTS.md`.

---

## 1. Vision, but & contexte

**Le Kit du Voyageur (LKDV)** est une plateforme e-commerce + communautaire pour voyageurs outdoor : boutique de matériel, générateur de kits, explorateur de randonnées (PostGIS), communauté (clubs, groupes, événements, carnets), guides pays enrichis par IA, cockpit GPS temps réel et hub de voyage unifié.

### Le pourquoi — le pivot `trip`
Historiquement, les modules vivaient en « îles » (carnet, kit, randonnée, pays, boutique, messagerie) sans lien entre eux. **Le Module Voyage a introduit l'objet pivot `trip`** qui relie tout : `1..N pays × 1..N étapes × 1..N jours`, avec kit, budget, papiers, chat et carnet accrochés au même `trip_id`.

**La promesse** : *« un seul écran : vol + refuge + matériel manquant + commission + amis ».*

### Le contexte
- Produit créé par **Tony Faraci**, communauté **francophone d'abord**, puis internationale (Europe, Amérique du Nord, Asie).
- Cible : voyageurs outdoor, randonneurs en autonomie, bivouaqueurs.
- Développé avec un workflow agentique intensif : skills Superpowers, sous-agents spécialisés, audits multi-experts (Icon Agents).

---

## 2. Ambition produit — « Adventure Intelligence System »

La vision cible est un **« Adventure Autopilot »** : *« Une intention. Une aventure complète. Toujours à jour. »*

Quatre familles d'intelligence composent le système :

| Famille | Contenu |
|---|---|
| **Personnelle** | Profil terrain appris par l'usage (allure réelle, difficulté personnelle, fatigue) |
| **Terrain** | Segments de sentier qualifiés, technicité, map-matching GPS/PostGIS |
| **Collective** | « Terrain Live » — le Waze de l'outdoor (signalements, confirmations, confidentialité ≥ 5 utilisateurs) |
| **Contextuelle** | Météo, conditions, événements extérieurs |

**Principe fondateur** : *« Les moteurs calculent. Le solveur arbitre. L'IA explique. L'utilisateur contrôle. »* — l'IA est un enrichisseur/explicateur, jamais le calculateur primaire.

---

## 3. Business model & cible

**Objectifs gelés par priorité** (`ROADMAP_VOYAGE.md` §1.3) :
1. **Vendre le matériel de la boutique LKDV** — kit contextuel généré → panier Stripe (marge pleine)
2. **Affiliation Travelpayouts** — vols, hôtels, voitures, assurance, eSIM (commissions 1,1 % à 70 %)
3. **SEO** — pages `/lieux/[slug]`, `/pays`, voyages publics, carnets

**Modèle économique cible** (master plan §25) :
- **Abonnements B2C** : Free / **Explorer 39,99 €/an** / **Expedition 79,99 €/an** / **Family-Group 119–149 €/an**
- **Passes par voyage** : Weekend 6,99 € / Voyage 14,99 € / Expédition 29,99 €
- Affiliation, vente de matériel, B2B/API, marketplace locale

**KPI unique** : le nombre de voyages atteignant l'état « kit complété ».

---

## 4. Stack technique mobile

| Couche | Technologie | Version |
|---|---|---|
| Framework web | Next.js (App Router, RSC + Server Actions) | 15.5.25 |
| UI | React / React DOM | 19.0.3 |
| Langage | TypeScript | ^5 |
| Coquille native | Capacitor core/cli/android/ios | ^8.5.0 |
| Plugins natifs | app, camera, geolocation, haptics, keyboard, network, preferences, splash-screen, status-bar, PushNotifications | v8.x |
| Style | Tailwind CSS (+ animate, forms, typography) | 3.4.6 |
| Icônes | lucide-react, @heroicons/react, pack PNG masqué maison | — |
| Composants | @headlessui/react, @radix-ui (dialog, toast), vaul, cmdk, framer-motion | v2.x / v12 |
| Données | Supabase (PostgreSQL + PostGIS) + pg direct | ^2.49.4 |
| Paiement | Stripe | ^17.7.0 |
| IA | @rocketnew/llm-sdk + OpenRouter (Nemotron) | ^1.1.0 |
| Cartes | MapLibre GL (atlas) + Leaflet / react-leaflet | ^6.4.1 / 1.9.4 |
| État client | Zustand, @tanstack/react-query, react-hot-toast | ^5 / ^5.101 |
| Offline | Dexie (IndexedDB) | ^4.4.5 |
| Validation | Zod | ^4.4.3 |
| Tests | Vitest, Playwright (+ axe-core), ESLint 9, Prettier | ^4 / ^1.51 |

**Configuration Capacitor** (`capacitor.config.ts`) :
- `appId: com.lekitduvoyageur.app`, `appName: "Le Kit du Voyageur"`, `webDir: public`
- **`CAPACITOR_SERVER_URL` obligatoire** : la coquille native sert le serveur distant (jamais un HTML statique)
- SplashScreen **vert forêt `#17402C`** (1200 ms), StatusBar DARK, Keyboard resize body
- `iosScheme: capacitor`, `androidScheme: https`, `scheme: lkdv`, `ios.contentInset: never`, `preferredContentMode: mobile`

**Ports** : dev `4000`, start `4028`.

---

## 5. Identité visuelle & Design System

> **Règle absolue (DESIGN_SYSTEM.md)** : aucun composant métier ne doit recréer ad hoc un composant UI existant ni introduire de couleurs/polices arbitraires. Sources de vérité : `/materiel` (Liquid Glass) et `/compte` (patterns utilisateur).

### 5.1 Couleurs — palette canonique

**Tokens maîtres** (`src/styles/tokens.css`) :

| Token | Valeur |
|---|---|
| `--lkv-primary` (Forest) | `#17402C` |
| `--lkv-primary-hover` | `#205238` |
| `--lkv-primary-soft` | `#365233` |
| `--lkv-primary-subtle` | `#EBF2EC` |
| `--lkv-secondary` (Sage) | `#5B7F55` |
| `--lkv-secondary-hover` | `#4A6B44` |
| `--lkv-secondary-subtle` | `#D8E5D5` |
| `--lkv-surface` (toile mobile) | `#EEF3EC` |
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

**Palettes complètes** (`tailwind.config.js`) :
- **Forest** (marque) : `950 #0D1410` · `900 #131A16` · `700 #243028` · `600 #2D5A3D` · `500 #3D7A52` · `400 #4A7C5B` · `300 #6B9B7A` · `200 #9BBBA8` · `100 #C8D9CE` · `50 #EBF2EC`
- **Sage** (accent) : `900 #1E3A1D` → `50 #F2F6F1`, pivot `500 #5B7F55`
- **Stone** (fonds/verre) : `950 #1A1815` → `50 #FAF8F5`, pivots `400 #B8AE9E`, `600 #7A7365`
- **Sand** (chaud) : `900 #3D3828` → `50 #F5F3EE`
- **Sky** (cartes, eau) : `900 #10222B` → `50 #F0F7FA`
- **Ink** (texte) : `900 #14140F` · `700 #2B2A24` · `500 #5A574E` · `300 #8C8779`
- **Warm** : `300 #F1DAB1` · `500 #E4C695` · `700 #B08A4E`

### 5.2 Typographie

| Police | Variable CSS | Usage |
|---|---|---|
| **DM Sans** (300–700) | `--font-sans` / `--font-body` | Corps de texte |
| **Manrope** (400–800) | `--font-display` | Titres, display |
| **IBM Plex Mono** (400–600) | `--font-mono` | Chiffres, labels techniques, badges |
| **Instrument Serif** (normal+italic) | `--font-serif` (`.font-serif-lkv`) | Accents éditoriaux : donut budget, journal, citations |

**Note** : SF Pro n'est pas embarqué — l'app recrée le langage Apple avec DM Sans/Manrope + le système Liquid Glass maison. Échelles : `text-hero` clamp 3rem→6rem / -0.04em / 800 ; labels uppercase 11px `0.14em` ; stats `tabular-nums`.

### 5.3 Rayons, ombres, espacements, z-index

- **Rayons** : `xs 6px` · `sm 10px` · `md 14px` · `lg 20px` · `xl 26px` · `card 28px` · `2xl 32px` · `full 9999px`
- **Ombres** : `elevation-1..5` (`rgba(23,64,44,.04)` → `.16`) ; `green` `0 8px 24px rgba(45,90,61,0.28)` ; `green-lg` `0 16px 48px rgba(45,90,61,0.35)`
- **Espacements** : échelle 4 pt — 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 px
- **Z-index** : base 0 · sticky 20 · drawer 40 · sheet 50 · command 60 · toast 70
- **Tactile HIG** : `--lkv-touch-min 44px`, `--lkv-touch-comfortable 48px` (toute cible interactive ≥ 44×44 px)

### 5.4 Motion & durées

- **Durées** : `--dur-xfast 120ms` · `fast 180ms` · `med 280ms` · `slow 420ms` · `xslow 800ms`
- **Courbes** :
  - `--ease-glass` `cubic-bezier(0.22,1,0.36,1)`
  - `--ease-spring` `cubic-bezier(0.34,1.56,0.64,1)` (spring-bounce)
  - `--ease-smooth` `cubic-bezier(0.16,1,0.3,1)` (spring-smooth)
  - `--ease-emphasis` `cubic-bezier(0.2,0.8,0.2,1)`
- **Animations** : `slide-up 500ms`, `slide-down 300ms`, `fade-in 400ms`, `scale-in 300ms`, `spring-in 600ms`, `float 3s`, `shimmer 1.5s`, `pulse-slow 3s`
- **Haptique** : `useHapticFeedback()` / `triggerHaptic('selection'|'light'|'medium')` sur sélections, boutons, switches, tabs.

### 5.5 Liquid Glass (iOS 26) — le style signature

`src/styles/liquid-glass.css` (1 266 lignes) implémente la spec « True Crystal Glass with Soft White Veil » :

- **Verre** : `--glass-bg-light rgba(255,255,255,0.45)` / medium `0.55` / strong `0.75` ; bordure `rgba(255,255,255,0.65)` ; `backdrop-filter: blur(10px) saturate(160%)` ; reflets sheen/specular edge (::before/::after)
- **Classe `.glass`** : blur 10px + saturation 160 % + ombre inset + edge-light ; `.glass.interactive` → hover `translateY(-2px)` + glow sage, active `scale(0.995)`
- **Tons** : `.tone-sage`, `.tone-warn`, `.tone-danger`, `.tone-info`
- **`.glass-capsule-btn`** : pilule « stadium » — gradient `rgba(240,237,228,.94)→rgba(225,221,208,.84)`, bordure 1.5px blanc 0.88, blur 16px sat 180 % ; variante `.primary` = gradient forest `rgba(23,64,44,.92)→rgba(15,43,30,.96)` ; `.secondary` ; `.glass-capsule-btn-like` (rose `rgba(254,226,226,.85)`)
- **`.glass-circle-btn`** : bouton rond — gradient `rgba(244,248,245,.96)→rgba(226,237,228,.88)` + `.primary`
- **`.glass-capsule-bar` / `.glass-capsule-segment`** : segmented control pilule iOS 26 (segment actif gradient blanc 0.75→0.45)
- **`.glass-sub-card`** : sous-carte blanc 0.82 + blur 8px ; **`.glass-input`** : 44px, police 16px anti-zoom iOS
- **`.glass-eyebrow`** (11px / 0.14em / uppercase), **`.glass-metric`** (mono tabular, `-xl` 64px, `-xxl` 44px), **`.glass-pill`**, **`.glass-progress`** (4px), **`.glass-check-circle`**
- **Dark mode** (`prefers-color-scheme: dark`) : verre `rgba(255,255,255,0.10–0.22)`, bordure 0.18 ; **`.ultra-save-mode`** : OLED noir pur (cockpit)
- **`data-lkv-material-theme='light'`** : cockpit ultra-lumineux (glass 0.08–0.18, border 0.35)
- **`.hub-rail .glass`** : fond renforcé `rgba(255,255,255,0.62)` pour lisibilité sur photo (sauf `.glass-pure`)
- **Messagerie** : `.msg-bubble` (reçues gradient blanc 0.92), `.msg-bubble--mine` (gradient forest 165°), `.glass-send-btn`
- **`LiquidGlassDefs`** (`src/components/ui-layouts/liquid-glass-defs.tsx`) : filtre SVG `feTurbulence fractalNoise 0.003/0.007` + `feDisplacementMap scale 200` — la distorsion « verre liquide »
- **A11y** : `prefers-reduced-transparency` (verre → opaque), `prefers-reduced-motion` (durées 0.01ms), fallback `@supports not (backdrop-filter)`

---

## 6. Composants UI canoniques

Tous dans `src/components/ui/`. **À utiliser en priorité absolue**, jamais de re-création ad hoc.

| Composant | Rôle & variantes |
|---|---|
| **`LkvButton`** | Bouton canonique. Variantes : `primary`, `secondary`, `light`, `ghost-light`, `ghost`, `danger`, `icon-only`. Tailles : `sm` 32px/12px, `md` 42px/14px, `lg` 48px/15px. Radius 999px, weight 600, press `scale(0.97)`, hover `scale(1.015)`, focus ring `2px #5B7F55`, disabled 0.45 |
| **`Button`** / **`Card`** / **`Badge`** | Adaptateurs rétro-compatibles déléguant vers les primitives |
| **`GlassCard`** | Carte verre. Tons : `neutral`, `sage`, `warn`, `danger`, `info` ; blur `sm 8px`/`md 10px`/`lg 16px` ; `interactive` (whileTap 0.985) |
| **`LkvChip`** | Chip/badge pilule. Tons : `sage`, `warn`, `danger`, `info`, `stone`, `light`, `dark`. Padding 5px 12px, radius 999px, 11px, press 0.95 ; actif = fond `#17402C` texte blanc |
| **`Sheet`** | Bottom-sheet mobile : `rounded-t-[28px]`, drag handle `w-12 h-1.5`, drag-to-dismiss (>100px ou vélocité >500), spring damping 30 / stiffness 350 ; desktop = modal centré |
| **`GlassSheet`** | Sheet plein écran verre : blur 32px + sat 200 %, header sticky 56px + safe-area-top, bouton retour `glass interactive h-11 w-11 rounded-full` |
| **`GlassModal`** | Modale verre : `sheet`/`centered`, `rounded-t-3xl`/`rounded-3xl`, overlay `bg-ink-900/40 blur 2px` |
| **`GlassCapsuleBtn`** | CTA pilule stadium : `default`/`primary`/`secondary`, sizes `default`/`sm`/`xs`, `min-h-[44px]` pour les CTA hub |
| **`IOSSegmentedControl`** | Segmented iOS : conteneur `bg-[#EAE6DF]/70 backdrop-blur-xl border-white/60 rounded-full p-1`, actif `#17402C`, pilule framer `layoutId="ios-segmented-pill"` spring 480/36, haptique `selection` |
| **`ScrollableTabs`** | Tabs défilantes : `pill`/`underline`/`glass`, pilule active `bg-lkv-primary` layoutId spring 500/35, fade masque, snap-x |
| **`LkvInput` / `LkvTextarea` / `LkvSelect` / `LkvCheckbox`** | Formulaires canoniques : `bg-white/70 backdrop-blur-md border-[#17402C]/12 rounded-2xl`, focus ring, **`text-[16px]` anti-zoom iOS** |
| **`LkvSwitch`** | Switch iOS : piste `h-6 w-11`, on `#17402C` / off `#17402C/20`, pouce spring 500/30, haptique |
| **`LkvIcon` / `Icon`** | Icônes. Résolution en 3 sources : 1) SVGs animés locaux (`src/components/icons/*`, 66 fichiers style lucide-animated), 2) pack PNG masque CSS (`public/icons`, 468 fichiers), 3) Heroicons 24. 27 noms animés dans `LkvIcon` (home, mountain, compass, box, users, user, sparkles, tent, book, bag, doc, search, chevrons, close, menu, bell, heart, bookmark, map-pin, star, lock, filter, minus, plus…) |
| **`BottomTabBar`** | Voir section 8 |
| **`GlassSubCard`**, **`GlassDrawer`**, **`GlassCommand`**, **`GlassIconButton`**, **`IOSInsetGroupedList`**, **`Skeleton`**, **`ShimmerLoader`**, **`EmptyState`**, **`ProgressBar`**, **`Metric`**, **`Eyebrow`** | Primitives secondaires |
| **`MobilePageShell` / `AppShellDesktop`** | Wrappers de pages avec safe-areas (`env(safe-area-inset-*)`), fond canopée, scroll interne |

**Sidebar / rail** :
- **Desktop** : `AppShellDesktop` — cockpit 3 colonnes : sidebar gauche 260px (navigation activités), centre flex-1 (travail en cours), rail droit 300px (widgets contexte).
- **Hub** : `HubSidebarLeft` (activités + CTA planificateur), `HubSidebarRight` (`hub-rail`, verre renforcé 62 % blanc, widgets `WidgetCard = glass p-4 rounded-[1.5rem]`, labels 10px uppercase 0.14em).

---

## 7. Le Hub — page de référence de l'app

**Chemin** : `src/app/hub/` + `src/features/hub/` (159 fichiers). Le hub est le cœur de l'expérience mobile : c'est lui qui définit le style, les interactions et la navigation de référence.

### 7.1 Architecture

- **`/hub` (page.tsx)** — « Hub V4 : RACINE = MENU de cartes-onglets ». Distribue selon la nature de l'aventure active :
  - `SortieMenu` (voyage) · `CollectifMenu` (groupe) · `PossessionMenu` (matériel)
  - `?phase=live` → `PhaseLiveView` (cockpit terrain) · `?phase=recount` → `PhaseRecountView`
- **`/hub/layout.tsx`** — `dynamic = 'force-dynamic'` (jamais pré-rendu : auth/cookies). Suspense → `HubLoading` (squelette BENTO), puis `HubShell`, `AdventureIntelligenceHub`, `ItineraryAdventureCockpit`, `TripAffiliateProvider`, `LiquidGlassDefs`.
- **`/hub/nouveau`** — création d'aventure : `?mode=ia` → `AutoGenTripCreateView`, sinon `TripWizard` (5 étapes).
- **`/hub/[section]`** — rendu canonique des sections piloté par URL via `hubSectionRegistry` ; nature incompatible → 404 ; vues clientes chargées en `ssr:false` (ItineraryPlanner, Budget, Checklist, Docs, Safety, Journal, Export, Team, GroupeCockpit).

### 7.2 Natures & phases

- **3 natures d'aventure** : `Sortie` (voyage), `Collectif` (groupe), `Possession` (matériel). Le `NaturePill` affiche la nature, le `NatureSwitcherSheet` permet de changer ; l'`AdventureSwitcher` liste les aventures.
- **3 phases** : `prepare` → `live` → `recount`. Le menu BENTO et les actions se reconfigurent par phase. En `live` : bouton flottant **SOS** (`SosFloatingButton`).

### 7.3 Sections (registre `hubSectionRegistry` — 18 sections)

| Domaine | Sections |
|---|---|
| Sortie (voyage) | `itinerary`, `gear`, `groupe`, `budget`, `docs`, `checklist`, `safety`, `journal`, `export` |
| Possession (matériel) | `inventaire`, `kit`, `preparation`, `depart`, `disponibilite`, `alertes`, `oublis` |
| Collectif (groupe) | `invitations`, `voyages-lies`, `groupe` |

Icônes lucide associées : `Backpack`, `BellRing`, `BookOpen`, `CalendarCheck`, `CheckSquare`, `ClipboardList`, `Compass`, `CreditCard`, `FileText`, `FlaskConical`, `Footprints`, `MailPlus`, `Map`, `Navigation`, `Package`, `Share2`, `Shield`, `Users`.

**Spécification Y (10 sections trip + 4 zones invariantes)** :
- Zones : en-tête (identité + état global) · colonne gauche 260px (navigation seule) · centre flex-1 (travail en cours, max 3 synthèses) · colonne droite 300px (widgets).
- Sections `tripSectionRegistry` : `overview`, `itinerary`, `gear`, `team`, `budget` (`canManageBudget`), `docs` (`canViewDocuments`), `checklist`, `safety`, `journal`, `export`. **La carte est un mode d'itinerary, pas une section.**
- Matrice profil → sections (day/short/long/exped × solo/group), densité `compact` si `scale=day`.
- Règles : un seul `<h1>` par surface, un seul indicateur réseau, cibles tactiles ≥ 44px.

### 7.4 Widgets (rail droit / contexte — 12 widgets, priorités 100→20)

`countdown`, `primary-action`, `alerts`, `next-step`, `safety-next`, `kit-balance`, `budget-burn`, `group-presence`, `trip-context`, `country-card`, `docs-expiry`, `offline-toggle`.
CTA canonique : « Entrer dans le voyage » = `glass-capsule-btn primary min-h-[44px]`.

### 7.5 Composants du hub

- **`HubShell.tsx`** — coquille unique : desktop = `AppShellDesktop` ; mobile = `MobilePageShell` plein écran sans scroll vertical (`h-[calc(100dvh-var(--shell-top-padding,0px))]`), carte flottante au-dessus de la tab bar ; `HubRealtimeRefresh`, `HubNetworkStatus`, `PrimaryActionWidget`, pont realtime.
- **`SortieMenu.tsx`** — BENTO contextualisé par phase, grille `MoreSectionsGrid` (spans 3/4/6/8, `fitRows`), `NextActionCard` (fil d'action), `ActivityIdentityBar`, `SosFloatingButton` (live).
- **`MenuCard.tsx`** — la **carte-onglet signature** : `glass relative h-full overflow-hidden rounded-[1.5rem]` ; micro-label `text-[11px] font-medium uppercase tracking-[0.14em]` (accent `--lkv-primary`, défaut `--lkv-text-secondary`) ; variante `media` (média plein fond + panneau `glass-sub-card w-[42%] min-w-[230px] max-w-[320px] rounded-xl`, scrim bas `from-white/85`) ; `interactiveBody`.
- **Sections mobiles** : `MobileAdventureHub`, `SectionCarousel`, `SortieMoment`/`CollectifMoment`/`PossessionMoment`, `MomentMapCard`, `MomentStatCard`, `HubRouteMap`, `DayTraceMap`, `InfoChipsRow`, `WeatherStrip` (variante capsule), `BudgetDonut` (donut budget serif italique), `NumberStat` (compteurs NumberFlow), `GearPhotoCarousel`, `MissingItemsDrawer`, `ItineraryDayTimeline`, `GroupeCriticalPath`.
- **Moteurs par section** (`features/hub/mobile/`) : `mobileHubEngine`, `itineraryEngine`, `budgetEngine`, `gearEngine`, `groupeEngine`, `teamEngine`, `checklistEngine`, `docsEngine`, `exportEngine`, `journalEngine`, `safetyEngine`, `hubSwipeEngine`.
- **Hooks** : `useHubSwipeNav` (swipe entre sections), `useAndroidHubBackNav` (retour Android), `useHubLiveSensors`, `useHubTelemetry` (RUM).
- **État** : `useHubStore` (Zustand) ; contexte `ActiveAdventureContext` + `activeAdventureServer` (cookies).

### 7.6 Classes hub notables

`hub-rail`, `data-hub-widget`, `glass-pure`, `glass-sub-card`, `no-scrollbar`, `bg-black/5` (pistes de progression), `bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]` (barres), chips `bg-[var(--lkv-primary)]/10`, badges `bg-[var(--sage-50)] text-[var(--sage-700)]`, danger `bg-[var(--lkv-danger)]/10`, avatars `ring-2 ring-white`, stats `text-2xl font-extrabold tracking-tight`, serif italique `font-serif-lkv italic`, `tabular-nums`.

---

## 8. Navigation mobile

- **`BottomTabBar`** (flottante iOS) — 4 tabs : **Explorer** (`mountain`), **Hub** (`tent`, isHero, **appui long 550 ms → AdventureSwitcher**), **Communauté** (`users`), **Profil** (`user`).
  - Barre 52px, radius 999, gradient `rgba(255,255,255,.78)→(.48)`, `blur(30px) saturate(200%)`
  - Pilule active `glass-circle-btn` (framer layoutId, spring 450/32) ; icône active 26px `#17402C`, sinon 22px `#365233`
  - Badges `glass-pill`, upper tray 44px (onglets par page), safe-area-bottom, masquable via événement `lkdv-toggle-bottom-bar`
- **Safe areas** : `env(safe-area-inset-*)` dans `GlassSheet`, `BottomTabBar`, messagerie (`msg-safe-top`)
- **iOS/Android** : `viewport maximumScale=1, viewportFit='cover'`, `appleWebApp.capable`, `themeColor #EEF3EC`, `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`

---

## 9. Toutes les routes de l'app

### 9.1 Hub (cœur mobile)

| Route | Fichier | Rôle |
|---|---|---|
| `/hub` | `src/app/hub/page.tsx` | Hub V4 — menu racine de cartes-onglets (Sortie/Collectif/Possession) |
| `/hub/[section]` | `src/app/hub/[section]/page.tsx` | Sections URL-driven via `hubSectionRegistry` |
| `/hub/nouveau` | `src/app/hub/nouveau/page.tsx` | Création d'aventure (wizard 5 étapes ou IA) |

### 9.2 Création & exploration

| Route | Rôle |
|---|---|
| `/` | Landing desktop ; **mobile → redirect 302 `/hub`** (middleware) |
| `/explorer` | ATLAS — explorateur unifié MapLibre globe (remplace la carte historique) |
| `/ai-configurator` | Configurateur IA de voyage |
| `/copilote` | Copilote |
| `/carte-interactive` | → redirect 307 `/explorer` |
| `/pays/[code]` | Fiche pays (4 sections) |
| `/randonnee-active` | Cockpit GPS randonnée active |
| `/preparer-randonnee` | Préparation randonnée |
| `/preparer-sentier/[id]` | Préparer un sentier précis (enrichissement IA live) |
| `/preparer-sentier/apercu` | Aperçu préparation |

### 9.3 Legacy voyages (shims du hub)

| Route | Rôle |
|---|---|
| `/voyages/[slug]` | Détail voyage |
| `/voyages/[slug]/[section]` | **Shim pur** → bascule vers `/hub/<segment>` |

### 9.4 Communauté / social

`/communaute`, `/communaute/publier`, `/publier`, `/feed`, `/profil`, `/profil/[id]`, `/rejoindre/[slug]`, `/clubs`, `/clubs/[id]`, `/clubs/nouveau`, `/nouveau-groupe`, `/entraide`, `/evenements`, `/ambassadeurs`, `/experts`, `/createurs`, `/communaute-pro`, `/messagerie`, `/avis`

### 9.5 Commerce

`/boutique`, `/produit/[slug]`, `/kits`, `/kits/[slug]`, `/k/[token]` (kit partagé), `/panier`, `/checkout`, `/abonnements`, `/occasion`, `/location`, `/fidelite`, `/recompenses`, `/pro` (B2B), `/carbone`, `/rapport-expedition`

### 9.6 Contenu & guides

`/guides`, `/guides/[slug]`, `/lieux`, `/lieux/[slug]`, `/outils`, `/outils/[slug]`, `/blog`, `/faq`, `/manifeste`, `/carnets`, `/carnets/[id]`, `/carnets/nouveau`

### 9.7 Compte / auth / admin

`/connexion`, `/inscription`, `/compte`, `/compte/[userId]`, `/compte/modifier`, `/admin`, `/admin/produits`, `/hors-ligne` (page offline)

### 9.8 Légal

`/cgu`, `/cgv`, `/mentions-legales`, `/politique-confidentialite`, `/cookies`, `/contact`

### 9.9 Fichiers spéciaux

`not-found.tsx`, `global-error.tsx`, `robots.ts`, `sitemap.ts` + `src/middleware.ts`.

---

## 10. API (99 route handlers dans `src/app/api/`)

Domaines : `account`, `admin`, `adventure`, `affiliate`, `ai`, `badges`, `billing`, `carnet(s)`, `checkout`, `cron`, `dev`, `discovery`, `guides`, `hike-sessions`, `hikes`, `hub`, `identity`, `indexnow`, `kit-report`, `kits`, `materiel`, `notifications`, `og-preview`, `pays`, `pois`, `produit`, `rewards`, `seed`, `stripe`, `telemetry`, `terrain`, `trails`, `trip-assistant`, `voyages`.

Notables : `/api/hikes` et `/api/pois` (rate limit 120/min/IP, bbox 20°/axe), `/api/telemetry/hub` (RUM Web Vitals), `/api/health`, crons versionnés.

---

## 11. Middleware & redirections (`src/middleware.ts`)

1. **Mobile landing** : `/` + UA mobile → **302 `/hub`**
2. **Auth** : `/admin*`, `/checkout*` protégés (Supabase SSR + RPC `is_admin`)
3. `/catalogue*` → `/boutique` (301)
4. **Redirections legacy hub** (307, matrice `src/lib/hub/hubRedirects.ts`) : `/materiel*`, `/voyages`, `/groupes`, `/equipages`, `/preparation`, `/terrain`, `/boussole`, etc. + en-têtes `x-hub-redirect-source/target`
5. `/pays/[code|nom]` → normalisation 2 lettres (301)

`next.config.mjs` : headers sécurité (HSTS, CSP Report-Only), `Cache-Control: private, no-store` sur `/hub`, `/compte`, API privées ; redirects `/carte-interactive` et `/pays` → `/explorer` (307) ; `allowedDevOrigins` pour test natif local.

---

## 12. PWA & Service Worker

- **`public/manifest.json`** : name "Le Kit du Voyageur", short "KdV", standalone, portrait, theme `#17402C`, icônes 192/512 + maskable, **shortcuts** (Configurateur IA `/ai-configurateur`, Inventaire `/inventaire`, Carte `/carte-interactive`)
- **`public/sw.js` (v4)** :
  - CacheFirst (polices/chunks), StaleWhileRevalidate (images publiques)
  - Network-First navigation — cache HTML **uniquement des routes publiques listées en dur** (isolation inter-comptes)
  - Tuiles cartographiques `lkdv-tiles-v1` borné LRU 3000 entrées
  - Purge `LKDV_PURGE_PRIVATE` à la déconnexion (pilotée par AuthContext)
- **`public/offline.html`** + page `/hors-ligne`
- `ServiceWorkerRegistration` : **jamais enregistré en natif Capacitor** ; `NativeAppBootstrap` gère le natif.

---

## 13. Fonctionnalités par domaine

### Boutique & kits
Catalogue 80 produits CSV → 67 SKU importés, panier, checkout Stripe, configurateur IA, rapport kit (`/api/kit-report/generate`), **lignées de kits** (filiation matérialisée, preuve terrain GPS, trust scores 2 axes, royalties créateur, cookie `lkdv_kit_ref` HMAC), inventaire matériel `/materiel` (gestion du sac, poids, disponibilité).

### Itinéraires & voyages
Wizard 5 étapes, planificateur jour/jour, budget glouton, documents chiffrés, export **GPX 1.1 + PDF réels**, checklist, sécurité, journal/carnet ; auto-génération déterministe (intent → 16 blueprints → 12 couches → `coherenceSolver` → `budgetEngine`) ; `/preparer-sentier/[id]` avec dressage déterministe instantané + enrichissement LLM live (rail 6 phases animé) ; **multi-personnes** (`trip_member_profiles` : appris/estimé/moyenne).

### Pays
`/pays/[code]` — 4 sections (Présentation, Destinations, Activités & Treks, Culture & Société) ; 13 blocs IA multi-tiers (`country_content_blocks`, Tier 1 safety = review humaine + RLS tant que non validé) ; 39/39 blocs générés pour NP/PT/ST ; recommandations kits réels **anti-hallucination** ; globe `UnifiedCountryGlobe` ; données climatiques `.country-cache`.

### Explorer / ATLAS
`/explorer` — moteur unique **MapLibre globe**, 4 paliers de zoom, RPC `trails_in_viewport` indexée GIST (0,3 ms), matviews de densité, clustering POI natif, tracé exact sélectionné, caméra flyTo/easeTo ; flag `explorer_unified_map_enabled` à 100 % ; découverte d'activités Viator/Klook/Tripadvisor (provider-agnostic).

### Cockpit départ
Refonte : identité liée au **sentier réel**, purge du cockpit 3 colonnes dupliqué, `?route=X`, alertes unifiées, sac/poids, checklist de départ.

### Randonnée active
Cockpit GPS : TrackingEngine / NavigationEngine / CopilotEngine / SafetyEngine, déviation, POI proches, météo, import/export GPX, 3D terrain, narratives IA post-randonnée, identification d'espèces, sessions `hike_sessions`, empreinte publique anonymisée (`user_field_signature`), orientation privée (`user_orientation`).

### Terrain Live (communautaire)
UI + hooks en place (`QuickReportSheet`, `TerrainLiveLayer`, `useTerrainReports`, `TerrainLiveCockpitControl`) ; backend complet (confirmations, cycle de vie, modération) = phase a5 à finaliser.

### Tribu / collectif
Groupes par **capacités** (matrice 40 lignes), pont club↔hub, groupes éphémères, délégations, quorum, journal d'activité, modèles de checklist, **partage de position live** (sessions 1–72 h, TTL 15 min borné en base, panneau `LiveSharePanel`, couche carte `atlas-members`).

### IA (routeur Nemotron)
`nvidia/nemotron-3.5-lightning:free` via OpenRouter (`src/lib/ai/askAI.ts`) ; plugins web, quotas, cache, fallbacks, jobs asynchrones `ai_jobs` + crons ; garde-fou `assertFreeModel` ; anti-invention (corridor 3 km) ; jobs `activity-enrichment`, `trail-narrative`, `country-blocks`.

### Offline
Bannière + cache localStorage TTL ; **Dexie IndexedDB** (`tripOfflineStorage`/`SyncQueue`, pack adventure-intelligence + syncWorker), résolution LWW + journal d'audit, exclusion RGPD des documents ; Capacitor (geolocation, haptics, network, status-bar, splash).

### Sécurité & conformité
**RLS 100 % des tables**, invariants CI anti-dérive (`verify:invariants`, 6 invariants), rate limiting, sanitization, Zod partout, docs compliance (AIPD, DPA, DPO, mentions légales, règles communauté), affiliation RGPD (SHA-256 sans IP), floutage éthique (~500 m).

---

## 14. i18n — état actuel

| Langue | Code | Statut |
|---|---|---|
| Français | `fr` | Natif / complet (production) |
| Anglais | `en` | Dictionnaire prêt (`src/lib/i18n/translations/en.ts`), **non branché** |
| Espagnol | `es` | Planifié Q1 2027 |
| Allemand | `de` | Planifié Q2 2027 |

**Point critique** : les dictionnaires (`fr.ts`/`en.ts`, type `TranslationKeys`) et les formateurs (`formatters.ts` : unités metric/imperial, devises EUR/USD/GBP/CHF/CAD/JPY, dates UTC-safe) existent, **mais aucun fichier de `src/` n'importe `lib/i18n`**. L'infrastructure est dormante — prérequis majeur du lancement mondial.

---

## 15. Ce qu'il reste pour un lancement mondial

> Référence : `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md`. **Verdict actuel : NO-GO production mondiale** (développement/privé/preview uniquement).

### 15.1 Les 13 phases (0–12)

| Phase | Contenu | Statut |
|---|---|---|
| **0–1** | Réparer CI HEAD rouge, protéger `main`, SBOM, scan secrets/licences | ❌ |
| **2** | Certifier la **BDD distante** (projet Supabase de test isolé, replay migrations, pgTAP distant) | ❌ |
| **3** | **Unifier la chaîne d'identifiants** `trip_id → adventure_plan_id → route → kit → session → carnet → publication` (anomalie vérifiée : `AutoGenTripCreateView` ne relie pas réellement la chaîne) | ❌ |
| **4** | **Couverture mondiale** : pipeline d'import licencié, seuils de qualité par région — aujourd'hui 1 169 lignes `hiking_routes` concentrées France/Belgique, 0 sentier à Chamonix, 30 micro-états sans géométrie | ❌ |
| **5** | Observabilité & exploitation (rate limiting distribué, backups) | ⚠️ scripts `ops:a14-*`/`ops:a15-*` |
| **6** | Échelle ATLAS : contrat de tuiles production + CSP, scheduler externe du cron densité, backfill 30 micro-états, alternative clavier `/explorer`, First Load JS `/explorer` 265 Ko > cible 170 Ko | ❌ |
| **7** | Communauté **sans données de démonstration** (démos en dur présentes), carnet privé par défaut | ❌ |
| **8** | **Stripe réel** : 6 Price IDs `INSUFFICIENT_DATA` (`docs/compliance/07_STRIPE_PRICE_IDS.md`), fail-safe testé mais **aucun paiement réel exécuté** | ❌ |
| **9** | i18n branchée (extraction des libellés, dates/unités/devises) | ❌ |
| **10** | Charge & capacité (suite `phase10-capacity` à réparer) | ⚠️ |
| **11** | **Stores** : Android AAB signé prouvé localement (`docs/mobile/ANDROID_RELEASE.md`) mais **aucune publication** ; iOS **impossible sur cette machine** (pas de Mac/Xcode) — `docs/mobile/STORES_CHECKLIST.md` tout `INSUFFICIENT_DATA` | ❌ |
| **12** | Rollout progressif interne → 1 % → … → 100 % avec arrêts | ❌ |

### 15.2 Blockers documentés

- **B1** (`docs/Y_BLOCKERS.md`) : fusion PR #31 impossible par l'agent (`gh` CLI absent) → **action humaine Tony requise**
- **4 suites de tests en échec préexistant** : `tests/ops/a14-healthcheck.spec.ts`, `tests/ops/a15-rollout.spec.ts`, `tests/ops/phase10-capacity.spec.ts`, `tests/adventure-intelligence/a13-backtest-export.spec.ts` (SyntaxError) — le programme qualité-échelle (Lot B) doit les réparer
- **`docs/Z_TROUS_INVENTAIRE.md`** : sur 12 couches fonctionnelles, 8 sont des **estimations** (transport, refuges, budget 2024, administratif…) → mentions « Estimation » obligatoires, positionnement honnête « configurateur et compilateur d'itinéraires »
- **`docs/BACKLOG_APRES_Z.md`** : D28/D29 (catalogue BigBuy pilote le conseil), **Z7 conformité légale bloquée (avis juridique humain)**, Z10 Go/No-Go non tranché
- **CI** : workflow à déplacer `.github/ci.yml` → `.github/workflows/ci.yml` ; `eslint.ignoreDuringBuilds` encore à `true`
- **Env propriétaire manquants** : `TRAVELPAYOUTS_WEBHOOK_SECRET`, `TRAVELPAYOUTS_MARKER`, secrets Stripe, redéploiement Travelpayouts Drive
- **Perf** : verdict GO_NO_GO « NO-GO large, 3 chantiers restants » — framer-motion hors du graphe statique hub, découpage dynamique `/hub/[section]`, RUM Web Vitals

---

## 16. Agents & skills à utiliser pour toute modification

### 16.1 Règles permanentes (AGENTS.md)

1. **UX & Interaction Design** : les skills `apple-ui-designer` et `interaction-design` **doivent** être appliqués pour toute décision de layout mobile, hiérarchie visuelle, microinteraction ou transition native iOS/Apple.
2. **Superpowers** : pour toute tâche de développement majeure, appliquer le workflow Brainstorming → Plan d'implémentation → Subagent-driven / TDD → Vérification.
3. **Design System** : jamais de couleur/police arbitraire, jamais de composant UI recréé ad hoc (voir §5–6).

### 16.2 Icon Agents (64 experts, 8 pods)

Installés dans `.claude/agents/`, `.claude/commands/`, `.agents/agents/` :

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

Commandes : `/icon-review` (global), `/icon-programming-review`, `/icon-security-review`, `/icon-design-review`, `/icon-business-review`, `/icon-data-ai-review`, `/icon-product-policy-review`, `/icon-platform-operations-review`, `/icon-healthcare-review`.

### 16.3 Subagents OpenCode (`.opencode/agent/`)

- **`atlas-conformite-lg`** — contrôle qualité Liquid Glass du CHANTIER ATLAS (checklist grep + corrections + tsc/lint/build + Playwright)
- **`atlas-data-layer`** — data-layer ATLAS : RPC PostGIS, vues matérialisées, index GIST, RLS (vérifie via EXPLAIN ANALYZE, n'invente aucun schéma)
- **`atlas-globe-engine`** — moteur MapLibre GL unique (projection globe, 4 paliers de zoom, clustering natif, caméra flyTo/easeTo), respect du budget perf mobile
- **`pays-conformite-lg`** — conformité Liquid Glass des pages pays
- **`code-reviewer`** — revue qualité/sécurité/maintenabilité (à utiliser après toute modification)
- **`security-reviewer`** — OWASP Top 10, secrets, SSRF, injections
- **`database-reviewer`** — PostgreSQL/Supabase : requêtes, schémas, perf
- **`performance-optimizer`** — profilage, bundle, bottlenecks
- **`a11y-architect`** — WCAG 2.2 (web + natif)
- **`architect`** — architecture & scalabilité
- **`silent-failure-hunter`** — échecs silencieux, erreurs avalées, mauvais fallbacks

### 16.4 Agents pays (`.claude/agents/` et `.agents/agents/`)

`pays-communaute-refonte`, `pays-conformite-lg`, `pays-hero-refonte`, `pays-sections-refonte` — refontes Liquid Glass des pages pays (style seul, logique métier intacte). + agent `openrouter` (IA secondaire gratuite pour analyse/review).

### 16.5 Skills LKDV (`.agents/skills/`)

| Skill | Usage |
|---|---|
| `lkdv-development` | Règles de développement et architecture LKDV |
| `lkdv-seo-agent` | Mission SEO : référence voyage outdoor |
| `map-geospatial` | Cartes LKDV (PostGIS, OSM, Leaflet) |
| `supabase-postgis` | Développement sécurisé Supabase/PostgreSQL/PostGIS |
| `security-audit` | Revue sécurité Next.js, Supabase, APIs |
| `testing-qa` | Tests et prévention de régression |
| `ux-mobile` | UX mobile premium et responsive |
| `nextjs-performance` | Optimisation perf Next.js 15 / React |
| `code-quality` | Qualité production, sécurité, anti-régression |
| `github-workflow` | Git/GitHub sécurisé |
| `ai-agent-workflow` | Workflow agentique LKDV |
| `seo` | SEO complet multi-facettes (+ suite `claude-seo` ~30 skills) |

### 16.6 Superpowers (14 skills)

`brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `dispatching-parallel-agents`, `using-git-worktrees`, `finishing-a-development-branch`, `writing-skills`, `using-superpowers`.

### 16.7 Design & motion

`apple-ui-designer` (UI Apple-like iOS), `interaction-design` (microinteractions/motion), `frontend-design`, `expo-native-ui`, `liquid-glass-design` (iOS 26).

### 16.8 Autres utiles

Obsidian (`obsidian-markdown`, `obsidian-bases`, `obsidian-cli`, `json-canvas`, `defuddle`) ; bundle `SkillsForOpenCode` (~150 skills génériques : accessibility, backend-patterns, kotlin-*, swift-*, etc.).

---

## 17. Commandes de vérification (avant toute clôture de modification)

```bash
npm run dev                 # dev server (port 4000)
npm run build               # build production
npm run start               # serveur production (4028)
npm run test                # Vitest unitaires (~2 750 verts)
npm run test:e2e            # Playwright E2E
npm run test:visual         # tests visuels
npm run test:a11y           # audits axe-core
npm run verify:invariants   # 6 invariants CI anti-dérive (RLS, chaîne d'IDs…)
npm run mobile:sync         # npx cap sync
npm run mobile:build        # build natif
npm run mobile:open:ios / npm run mobile:open:android
npm run icons:build         # régénération registre icônes
npm run seed:demo           # données démo
npm run supabase:status
npm run ops:*               # scripts opérationnels (a14/a15)
```

**Vérification obligatoire** : `eslint` + `tsc` + suites de tests + `verify:invariants` avant toute affirmation de succès ; 4 suites rouges préexistantes (`a14-healthcheck`, `a15-rollout`, `phase10-capacity`, `a13-backtest-export`) à réparer dans le programme qualité-échelle (Lot B).

---

## 18. Sources documentaires clés

| Document | Rôle |
|---|---|
| `DESIGN_SYSTEM.md` | Gouvernance du design system |
| `src/styles/tokens.css` + `liquid-glass.css` + `tailwind.css` | Tokens, Liquid Glass, couches Tailwind |
| `docs/Y_HUB_SPEC.md` | Spec figée du hub voyage (zones, sections, widgets) |
| `ADVENTURE_INTELLIGENCE_MASTER_PLAN.md` | Vision produit Adventure Intelligence |
| `ROADMAP_VOYAGE.md` | Programme Module Voyage (612 sous-tâches) |
| `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md` | Les 13 phases de lancement mondial |
| `docs/compliance/07_STRIPE_PRICE_IDS.md` | État Stripe |
| `docs/mobile/STORES_CHECKLIST.md` + `ANDROID_RELEASE.md` | État stores |
| `docs/I18N_STRATEGY.md` | Stratégie i18n |
| `MISSION_LOG.md`, `MEMORY.md` | Historique d'exécution & mémoire agent |
| `docs/Y_BLOCKERS.md`, `docs/Z_TROUS_INVENTAIRE.md` | Blockers et trous d'inventaire |
