# PHASE 1 — Audit UI/UX, nettoyage et préparation du design system

> Date : 2026-09-20 · Branche : `main` · Commit de référence : `b014e25f`
> Portée : front uniquement (`src/`). Aucune logique métier, route, donnée ou API modifiée.

## 0. Méthode

- Trois passes d'audit parallèles : tokens/styles, layouts/patterns UX, doublons/code mort.
- Graphe d'imports complet reconstruit par script (1 616 fichiers `src/`, roots = routes App Router + `middleware.ts` + `tests/` + `scripts/`), puis parcours en largeur.
- Chaque constat est vérifié par `rg` (comptes et `fichier:ligne`).
- Baseline verte avant toute modification : `type-check` 0 erreur, `lint` 0 erreur, `vitest` 406 fichiers / 2 936 tests passés.

---

## 1. Audit — Tokens & styles

### 1.1 Sources de variables CSS

| Fichier | Déclarations `--x:` | Rôle |
|---|---|---|
| `src/styles/tokens.css` | 318 | Source canonique (light + `.dark`) |
| `src/styles/liquid-glass.css` | 49 | Matériau verre, contrôles, legacy `.lkv-glass` |
| `src/styles/tailwind.css` | 27 | Alias sémantiques + utilitaires |
| `src/design/tokens.ts` | 0 (miroir typé) | Miroir TS, aucune valeur en dur (sauf 2 exceptions) |

### 1.2 Problèmes constatés

1. **Palette dupliquée et divergente** — `tailwind.config.js:72-137` code en dur forest/stone/sage/sand/ink avec des valeurs différentes de `tokens.css:66-140` (ex. `forest.900` = `#131A16` vs `#17402C`). Deux sémantiques de « primary » coexistent (`bg-primary` → `--lkv-action` ; `colors.primary` → `--lkv-primary`).
2. **27 variables référencées mais jamais définies**, dont `--lkv-font-serif` (23 usages), `--lkv-surface-raised` (15), `--bottom-nav-height` (10 — défini inline par `AppShell.tsx:89`, donc volontaire), `--dark-bg` (6), `--spring-smooth`/`--spring-bounce` (5, animations inertes), `--radius-sm/full/xs`, `--forest-600/400`.
3. **Fuite de valeurs brutes dans le TSX** : 5 808 hex, 2 994 `text-[#…]`, 880 `bg-[#…]`, 579 `border-[#…]` ; `#17402C` seul = 2 557 occurrences. Plus fréquents hors tokens : `#5A7064` (609), `#5C6B5E` (201).
4. **Rayons hors direction 12/16/24** : 349 `rounded-[…]` dont `1.25rem` (55), `1.5rem` (49), `1.4rem` (46), `1.75rem` (28) ; `--glass-radius-xl: 40px` contredit `--lkv-radius-xl: 24px`.
5. **Blur incohérent** : 7 tokens pour 4 valeurs ; `backdrop-blur-md` (12px) ≠ `--glass-blur-md` (16px) ; `blur-xs`/`backdrop-blur-xs` utilisés 28× mais **inexistants en Tailwind 3.4.6** (aucun effet).
6. **Z-index non gouverné** : 6 tokens `--z-*` jamais utilisés (`0` référence `var(--z-*)`), 88 `z-[…]` jusqu'à `z-[10010]`, `zIndex: 99990` inline.
7. **Typographie hors échelle** : 8 551 `text-[…]` dont ~2 500 tailles 8–11,5 px ; 264 `leading-/tracking-[…]` ; aucun token de graisse, interligne ou letter-spacing.
8. **Ombres disjointes** : 515 utilitaires `shadow-*` (rgba(26,31,28)) vs 3 usages de `shadow-elevation-*` (rgba(23,64,44)) ; `--elevation-*` jamais redéfinis en `.dark`.
9. **Doublons d'utilitaires** : `.pt-safe`/`.pb-safe` définis 2× avec des valeurs différentes (`tailwind.css:697-698` vs `929-930`, les seconds gagnent) ; `.animate-*` déclarés 2× (config + `tailwind.css:681-686`, ces derniers référencent des variables non définies) ; 2 `@keyframes shimmer`.
10. **CSS orphelins** (0 importeur) : `src/app/pays/styles/country.css` (1 974 lignes, 23 refs à `--lkv-font-serif` inexistant), `src/components/communaute/community.css`, `src/styles/index.css`.
11. **Safe areas non tokenisées** : utilitaires dupliqués, fallbacks contradictoires pour la bottom bar (80px `AppShell` vs 68px cartes vs 52px réel).

---

## 2. Audit — Primitives & doublons

### 2.1 Primitives (`src/components/ui/`, 59 fichiers)

- **20 mortes ou masquées** : `AppLogo`, `Button`, `Card`, `GlassCommand`, `IOSInsetGroupedList`, `LkvCheckbox`, `LkvSelect`, `LkvSwitch`, `LkvTextarea`, `MediaUpload`, `ProductCard`, `ScrollReveal`, `SpotlightTracker`, `StartDistanceModal`, `ThemeToggle`, `PremiumGlassCard(.client)`, `Tabs`, `ScrollableTabs` (+ `mediaUploadPath`).
- **Wrappers d'exacte délégation** : `Button→LkvButton`, `Card→GlassCard`, `Badge→LkvChip` (seul `Badge` est utilisé), `Tabs→ScrollableTabs|IOSSegmentedControl`.
- **5 primitives de sheet/modale concurrentes** : `GlassModal` (24 usages), `GlassDrawer` (9), `GlassSheet` (4), `Sheet` (2), `PremiumBottomSheet` (2) + au moins 6 sheets maison (`components/social/*`, `panier`, `clubs`, `carnets`).
- **3 systèmes d'icônes** : `ui/Icon` (149 imports), `components/icons/*` (legacy, 45 imports dont 16 fichiers morts), `lucide-react` (66 fichiers).
- **Primitives form canoniques non utilisées** : `LkvInput` (2 usages), `LkvTextarea/Select/Checkbox/Switch` (0) — les pages codent leurs champs à la main.

### 2.2 Cartes métier

Familles dupliquées sans socle commun (classes `glass`/`glass-sub-card` recopiées) : équipement (7 `GearCard*` mortes + `InventoryCard`), voyage (`TripCard` morte, `ProchainVoyageCard`, `ResumeActiveTripCard` — 3 langages visuels), communauté (`CommunityPostCard` vs `PostCard` morte), profil (legacy mort vs `MobileCompteV2`), produit (`ui/ProductCard` morte vs `features/messaging/ProductCard`), carnet (nombreuses cartes).

---

## 3. Audit — Incohérences UX

| # | Incohérence | Preuves |
|---|---|---|
| 1 | **7 implémentations de bouton retour** ; primitive `ui/BackButton` quasi morte | `kits/page.tsx:157`, `KitDetailPage.tsx:411`, `clubs/[id]/page.tsx:107`, `compte/modifier/page.tsx:33`, `hors-ligne/page.tsx:73`, `GuideDetailClient.tsx:338`, `MobilePreparationView.tsx:123` |
| 2 | **9+ headers sticky maison** sans composant partagé | `MobileCompteV2.tsx:465`, `PublicMobileProfileView.tsx:68`, `MobileClubDetailView.tsx:102`, `admin/page.tsx:1602`, `compte/modifier/page.tsx:32`, `hors-ligne/page.tsx:71`, `kits/page.tsx:150`, etc. |
| 3 | **Action principale à 6 emplacements différents** | barre sticky (`publier:1047`), CTA fin de scroll (`panier:426`, `checkout:735`, `location:812`), FAB (`ConfiguratorWizard:879`, `InventoryWorkspace:242`), widget sidebar (`HubShell:234`), filtres haut de page (`occasion:578`) |
| 4 | **54 pages dupliquent leur layout desktop/mobile** | `hidden md:*` + `block md:hidden` (ex. `boutique:76/121`, `location:509/677`, `panier:140/339`) |
| 5 | **Modales/sheets fragmentés** ; overlays sans `role="dialog"` ni focus trap | `panier:143`, `clubs:1316`, `carnets:114` |
| 6 | **Confirmations destructives : 3 ergonomies** | `window.confirm` (17 usages, `dialogs.ts:14`), `ConfirmDialog` Radix (24 refs), overlays maison (`panier`, `clubs`, `carnets`) |
| 7 | **Empty states** : `EmptyState` utilisé 8× seulement | réimplémentations emoji : `carnets:1124`, `evenements:749`, `location:762`, `messagerie:79`, `experts:37` |
| 8 | **Loading** : 4 systèmes sans standard de route | spinners artisanaux (33 fichiers), pulse (81), `Skeleton` (11), shimmer hub (`hub/loading.tsx`) |
| 9 | **Safe-area / bottom-nav** : math dupliquée, fallbacks contradictoires | `AppShell:76-77` (80px), `ExplorerMap:553` (68px), `BottomTabBar:969` (52px), spacers `calc(62px+…)` recopiés (`evenements:784`, `admin:1702`, `location:679`) |
| 10 | **Deux recherches globales concurrentes** | `GlobalSearchModal` (desktop, `Header:274`) vs `SearchOverlay` (mobile, `MobileNavWrapper:50`) |

---

## 4. Audit — Code mort

Graphe d'imports : **223 fichiers inatteignables** depuis les 265 points d'entrée.

- **120 fichiers non métier** = ancien design inutilisé, supprimables sans risque :
  - 30 composants home legacy (`src/app/components/home/*`, `src/components/home/*`) orphelins depuis la suppression de `HomepageV1` ;
  - 13 fichiers `src/app/preparer-randonnee/*` (route remplacée par redirection vers `/preparer-sentier` et `/hub`) ;
  - 15 primitives/utilitaires `src/components/ui/*` ;
  - 16 icônes legacy `src/components/icons/*` ; 9 `components/groupes/*` ; 8 `components/compte/*` ; 5 `components/animations/*` ; 5 `components/mobile-nav/*` ; 3 `components/carnet/*` ; 2 `components/social/*` ; 3 zones produit legacy ; `ErrorBoundary` (non utilisé, `ErrorBoundaryWrapper` est autonome) ; `TerrainHub` ; `ExplorerMobileSheet` ; `EventDetailModal` ; `RdevLayer` ; `progressive-carousel` ; 2 CSS orphelins.
- **~103 fichiers métier** conservés (staging produit, à confirmer avant purge) : `features/adventure-intelligence`, `features/hiking` (moteurs), `features/hub` (blocs), `features/trips`, `features/crews`, `features/gear`, hooks/lib associés.
- **Dépendances npm inutilisées** : `vaul`, `@headlessui/react`, `@radix-ui/react-toast`, `class-variance-authority`, `@tailwindcss/forms` (0 import). `@dhiwise/component-tagger` et `recharts` sont protégés par la liste `rocketCritical` de `package.json` — non touchés.

---

## 5. Décisions d'architecture (Phase 1)

1. **Tokens** — `src/styles/tokens.css` reste la source canonique ; `src/design/tokens.ts` en est le miroir typé. Les catégories manquantes sont ajoutées de façon **additive** (aucun redesign) : contrôles, opacités, z-index overlay, safe areas, breakpoints, typographie (graisses/interlignes/letter-spacing), largeurs de bordure, focus.
2. **Primitives** — restent dans `src/components/ui/` (convention `DESIGN_SYSTEM.md`) : pas de déplacement massif de fichiers. Les primitives manquantes sont créées : `Spinner`, `Divider`, `Section`, `Page`, `PageHeader`, `PageContent`, `PageActions`.
3. **Façade unique** — `src/design/index.ts` expose en un seul point d'import les tokens, primitives et layouts (`import { … } from '@/design'`), sans dupliquer les implémentations.
4. **Layouts standard** — créés dans `src/design/layouts/` et composés au-dessus de `AppShell` (canonique existant) : `PageLayout`, `ListPageLayout`, `DetailPageLayout`, `FormPageLayout`, `DashboardPageLayout`, `MapPageLayout`.
5. **Migration progressive** — aucune page n'est redesignée en Phase 1. Les primitives sont adoptées au fil des touches, en commençant par les remplacements à rendu strictement identique (spinners).

---

## 6. Plan de migration Phase 2 (indicatif)

1. Fondations visuelles iOS 27 / Liquid Glass (tokens finaux, background, navigation, sheets, haptics).
2. Shells : header unifié, bottom bar native, suppression des 9 headers maison.
3. Migration page par page, en priorisant les 54 pages à double branche desktop/mobile.
4. Purge des styles locaux par feature (hex, `rounded-[…]`, `z-[…]`, tailles de texte).
5. Unification confirmations / empty states / loading ; suppression des primitives concurrentes (`Sheet`, `PremiumBottomSheet`, sheets maison).
6. Suppression des ~103 fichiers métier morts après arbitrage produit (adventure-intelligence, hub blocks, hiking engines).

---

## 7. Vérifications

- Baseline : `npm run type-check` ✅ · `npm run lint` ✅ · `npm test` ✅ (406 fichiers / 2 936 tests).
- Après chaque lot de modifications : mêmes commandes + `npm run build` en clôture de phase.
