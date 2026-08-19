# 🧭 CLAUDE.md — LKDV (Le Kit du Voyageur)

**Stack:** Next.js 15 (App Router) / React 19 / TypeScript strict / Tailwind CSS  
**Backend:** Supabase (PostgreSQL + PostGIS), Row-Level Security obligatoire  
**Paiement:** Stripe (server-side, webhooks async)  
**IA:** OpenRouter MCP  
**3D:** react-globe.gl + three.js (globe interactif page Pays)  
**Cartes:** Leaflet + tuiles OSM  

---

## 🏔️ Module Randonnée — Cockpit GPS (Chantier 8, 9 août)

Le cockpit de randonnée (`/randonnee-active`) est une interface desktop temps réel pour le suivi GPS en montagne.

### Architecture
- **`HikingCockpitPage.tsx`** — Page principale, orchestre tous les panneaux
- **`DesktopTopBar`** — Barre supérieure (GPS, cap, météo, batterie, nom de route)
- **`DesktopLeftPanel`** — Progression, waypoints, profil altimétrique
- **`DesktopRightPanel`** — Stats live (vitesse, durée, dénivelé) + copilote IA
- **`DesktopDockBar`** — Barre inférieure (timer, pause/reprendre/terminer, capture, voix, moment)
- **`DesktopMapOverlay`** — Carte Leaflet avec tracé GPS live (polyline rouge)
- **`CompletionView`** — Écran de fin avec stats, moments forts et carnet généré
- **`ContextualInsight`** — Bannière alerte (déviation, météo, POI)

### Hook principal
- **`useHikingStore`** (`src/features/hiking/hooks/useHikingStore.ts`) — Gère l'état GPS complet :
  - `positions: Array<{latitude, longitude}>` — historique des positions GPS
  - `isActive`, `isPaused`, `isCompleted` — états de session
  - `distanceKm`, `durationSeconds`, `averageSpeedKmH`, `currentSpeedKmH`
  - `elevationGainM`, `paceMinPerKm`
  - `deviation: { distanceM } | null` — détection de déviation de route
  - `nextPoi: POI & { distanceRemainingM } | null` — prochain POI
  - `weather: { tempC, condition } | null` — météo live
  - `batteryLevel: number | null`
  - `routeName`, `routeTotalKm`
  - `startHike(routeId)`, `pauseHike()`, `resumeHike()`, `stopHike()`
  - `fetchWeather(lat, lon)`

### Flux de démarrage
1. L'utilisateur arrive via `/randonnee-active?routeId=X` (depuis Explorer ou TrailDetailPanel)
2. Vérification `navigator.permissions.query({ name: 'geolocation' })`
3. Si `'prompt'` : écran explicatif (évite le spam navigateur)
4. Si `'granted'` : `startHike(routeId)` automatique
5. Si `'denied'` : écran d'erreur avec bouton "Réessayer"
6. Sans `routeId` : suivi libre (sans itinéraire prédéfini)

### Données de route (Supabase)
- Table `hiking_routes` : `id, name, distance_km, elevation_gain_m, start_latitude, start_longitude, geometry`
- `geometry` peut être une string GeoJSON (parsée safe via `JSON.parse`)
- 66 migrations Supabase synchronisées (incluant `hike_sessions`, `carnet_moments`, `identified_species`, `trail_pois`, `trail_segments`, `trail_metadata`, `trail_scores`)
- RLS vérifié : insertion anonyme bloquée sur toutes les tables de randonnée

### Composants supprimés (refonte cockpit)
- `TopHUD`, `SideControlsCol`, `NavigationCard`, `CockpitBottomNav`, `OfflineIndicatorBanner` — remplacés par les composants Desktop*

### API routes (randonnée)
- `POST /api/hike-sessions` — Créer/mettre à jour une session
- `GET /api/hike-sessions/[id]/narrative` — Générer narratives IA post-randonnée
- `GET /api/hikes` — Lister les randonnées
- `POST /api/carnet/identify-species` — Identification d'espèces (IA)
- `POST /api/kit-report/generate` — Rapport de kit
- `POST /api/kit-report/convert-inventory` — Conversion d'inventaire
- Toutes les routes API utilisent `export const dynamic = 'force-dynamic'`

### Modules avancés
- **GPX Import/Export** — `GPXImportExportModal` (import de traces, export de sessions)
- **3D Terrain** — `Terrain3DViewer` (vue 3D du terrain avec three.js)
- **AI Narratives** — Génération de récits post-randonnée via OpenRouter
- **Safety Center** — `SafetyCenterModal` (numéros d'urgence, position sharing)
- **32 tests unitaires** — Suite de tests pour les modules hiking

---

## 🎨 Design Système — Mobile Redesign (v2)

### Palette
| Rôle | Hex | Usage |
|------|------|------|
| Foreground 900 | `#0B1F17` | Dark backgrounds, text |
| Foreground 800 | `#17402C` | Primary CTAs, active states, italic emphases |
| Foreground 700 | `#2D6B4A` | Gradient midtones |
| Sage 500 | `#A3C4A3` | Inactive borders, sage accents |
| Sage 100 | `#EDF3ED` | Promo backgrounds |
| Stone 100 | `#FBFAF6` | Card backgrounds, attribute boxes |
| Stone 50 | `#FBFAF6` | Paper/card surfaces |
| Ink 900 | `#0B1F17` | Shadows (`rgba(11,31,23, %)`) |
| Ink 300 | `#6B7A72` | Secondary text, muted |
| Ink 100 | `rgba(11,31,23,0.06)` | Subtle borders |

**Interdit :** `#E4501C` (orange) — jamais dans le code nouveau ou modifié. Utiliser foreground-800 `#17402C` pour les états actifs.

### Typographie
- **Sans (UI)** : Söhne / Inter, système `font-sans`
- **Serif italique (emphasis)** : Georgia, via `<em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>`
- **Mono (données)** : JetBrains Mono / `ui-monospace, monospace`
- **Tracking** : `0.14em` ou `0.1em` pour les labels uppercase

### Glassmorphism (navigation flottante)
```css
backdrop-filter: blur(24px) saturate(1.5);
```
Utiliser sur BottomTabBar, MobileDrawer.

### Ombres
Tout en ink-based : `rgba(11,31,23, %)`. Jamais `rgba(0,0,0)`.

---

## ⚡ Interaction Design & UX (Skill Aura)

> **Règle Permanente :** Le skill Aura Interaction Design doit être utilisé pour toute décision relative aux interactions et à l'expérience utilisateur lorsqu'il est pertinent.

- **Emplacement du skill :** `.agents/skills/interaction-design/SKILL.md` (et `.skills/interaction-design/SKILL.md`)
- **Domaines couverts :** UX, navigation, micro-interactions, animations, transitions, feedback utilisateur, états loading/empty/error, gestes mobiles, onboarding, modales/sheets, boutons/actions, hiérarchie interactive, parcours utilisateur.
- **Règles clés :**
  - Compléter le design system LKDV sans casser l'existant.
  - Toujours respecter `prefers-reduced-motion`.
  - Animer uniquement `transform` et `opacity` (GPU-safe, 60fps).
  - Respecter la palette LKDV (vert forêt `#17402C`, accents sage `#A3C4A3`, pas de orange `#E4501C`).
  - Préserver les safe-areas et les composants shell (`MobilePageShell`, `BottomTabBar`, `HamburgerMenu`).


---

## 📱 Responsive Pattern

Toutes les pages suivent le pattern dual-view :
```tsx
<>
  {/* DESKTOP */}
  <div className="hidden md:block">
    <div className="min-h-screen ...">/* desktop content */</div>
  </div>

  {/* MOBILE */}
  <div className="block md:hidden">
    <MobilePageShell>
      /* mobile content — inline styles, pas de Tailwind */
    </MobilePageShell>
  </div>
</>
```

- **Mobile :** inline styles systématiques (pas de Tailwind dans les vues mobiles)
- **Desktop :** Tailwind classes
- **Wrapper mobile :** `MobilePageShell` (padding safe-area)
- **Footer spacer mobile :** `<div style={{ height: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }} />`

---

## 🖼️ Image Fallback Convention

Toutes les images (`<img>` et `<Image>`) utilisent un fallback pour les `src` vides ou nulles :
```tsx
src={data.image_url || '/assets/images/no_image.png'}
```

- Le fichier `/public/assets/images/no_image.png` sert de placeholder universel.
- `AppImage` applique cette logique à l'initialisation : `useState(src || fallbackSrc)` et `hasError = !src`.
- Concernés : 20+ composants (compte, inventaire, explorer, carnet, produit, événements, location).

---

## 🗺️ Cartes — Conventions Z-Index & Mobile

### ExplorerMap
- z-index des overlays abaissés à `1000` et `400` pour éviter le chevauchement avec la BottomTabBar mobile.
- Utiliser `h-dvh` (dynamic viewport height) sur mobile à lieu de `calc(100vh - ...)`.

### InteractiveMap
- Sidebar cachée sur mobile (`hidden sm:flex`), remplacée par un FAB de toggle filtres (`📍` en `fixed top-20 left-3 z-30`).
- Quand le panneau filtres est ouvert sur mobile : `fixed inset-0 z-50` avec bouton "✕ Fermer".
- Hauteur mobile : `h-dvh` au lieu de `calc(100vh-64px)`.

---

## 🧭 Routes & Redirects

### Routes supprimées (Chantier 2)
- `/catalogue` — supprimé, redirect permanent vers `/boutique`
- `/shop` — supprimé, redirect permanent vers `/boutique`
- `/configurateur` — supprimé, redirect permanent vers `/ai-configurateur`
- Anciens composants homepage (`src/app/components/`) supprimés.

### Redirects configurés (next.config.mjs)
```js
redirects() {
  return [
    { source: '/shop', destination: '/boutique', permanent: true },
    { source: '/catalogue/:path*', destination: '/boutique', permanent: true },
    { source: '/configurateur', destination: '/ai-configurateur', permanent: true },
  ];
}
```

### transpilePackages (next.config.mjs)
```js
transpilePackages: ['react-globe.gl', 'three', 'lucide-react']
```

---

## 💬 Composants Clés

### Navigation Mobile
- `MobilePageShell` — Wrapper avec safe-area padding pour toutes les pages mobiles
- `MobileDrawer` — Menu latéral premium, glassmorphism
- `MobileNavWrapper` — Assemblage TopBar + BottomTabBar + MobileDrawer + SearchOverlay + OfflineBanner
- `TopBar` — Props: `variant: 'standard' | 'on-image'`, `onMenuOpen`, `scrolled` (scroll state). Haptique sur back et search.
- `BottomTabBar` — 5 onglets, glassmorphism flottant. Tabs : Accueil (`home`), Explorer (`mountain`), Boutique (`bag`), Communauté (`users`), Compte (`user`). Haptique sur tab switch.
- `LkvIcon` — Icônes disponibles : `home`, `mountain`, `bag`, `doc`, `user`, `search`, `chevron-left`, `chevron-right`, `heart`, `bookmark`, `bell`, `map-pin`, `star`, `minus`, `plus`, `close`, `menu`, `arrow-right`, `lock`, `filter`, `users`, `compass`, `backpack`, `book`.

### Pages référencées (mobile)
| Page | Fichier | Sections mobiles |
|------|--------|-----------------|
| Accueil | `MobileHomePage.tsx` + HeroSection, QuickGrid, EditorialCard, StatsRow, StripCTA | Hero 460px foreground-900, 2-col grid, carte éditoriale, stats, CTA stripe |
| Explorer | `explorer/page.tsx` | AventuresHero, MiniMap 900×250px (coins arrondis 16px), AventureCards, FAB Navigator |
| Fiche Produit | `produit/[slug]/ProductDetailClient.tsx` | Gallery 380px gradient, attributs 2×3, couleurs 5 swatches, ProductBuyBar |
| Panier | `panier/page.tsx` | Items 77×92px images, qty selector, promo banner dashed, summary card |
| Checkout | `checkout/page.tsx` | Progress steps 4-bar, address card, shipping radio, payment grid, dark total card |
| Communauté | `communauté/page.tsx` + `BottomTabBar` tab | Remplace l'ancien tab "Carnet". Regroupe clubs, groupes, événements, feed, messagerie |
| Admin | `admin/page.tsx` | Top bar foreground-900 sticky, 12 pilules sections scrollables horizontalement |
| Carnet de voyage | `carnet/[slug]/page.tsx` + `components/carnet/` | Hero image, moments timeline, galerie, espèces identifiées |
| Création carnet | `communauté/page.tsx` + `CarnetFormModal` | Modal de création avec upload photos |
| Terrain | `terrain/page.tsx` | Hub mobile (GPS, carte, kit, recherche, mode hors ligne) |
| Randonnée active | `randonnee-active` + `HikingCockpitPage` | Cockpit desktop complet (TopBar, LeftPanel, RightPanel, DockBar, MapOverlay) |
| Rapport Kit | `rapport-kit/page.tsx` | En-tête stats, objets par catégorie, barres pods, recommandations |
| Rapport Expédition | `rapport-expedition/page.tsx` | Titre+dates, stats clés, résumé jour par jour, équipement |

### Nouveaux composants UI
- `ProductBuyBar` — sticky bottom bar, verre dépoli, qty pill + add-to-cart foreground-800
- `EmptyState` — état vide réutilisable
- `ElevationProfile` — profil d'élévation (desktop hiking cockpit)
- `CustomCursor` — curseur personnalisé desktop (dot + ring lag, détecte les devices tactiles)

### Attributs produit (mobile)
Grille 2×3 : Capacité/Poids/Matière/Origine — icône 3×30px, font `#EAF1E5`.

---

## 🥾 Terrain & Offline

### Page /terrain
- Page statique mobile-only. Desktop redirect vers `/explorer`.
- `TerrainHub.tsx` — header avec badge GPS actif/hors ligne, hero card "Navigateur", grille AventureCards, CTA "Mode hors ligne".
- `OfflineBanner` — bannière sticky (z-index 55, sous safe-area) quand `navigator.onLine` est faux, toast "Connexion rétablie" au retour.

### Offline
- `OfflineBanner.tsx` — bannière sticky (z-index 55, sous safe-area) quand `navigator.onLine` est faux, toast "Connexion rétablie" au retour.
- `useOfflineCache.ts` — hook générique cache localStorage + TTL, fallback data, invalidate/refetch
- `OfflineBanner` monte aussi dans `MobileNavWrapper` (global via layout).

### Recherche persistante
- `SearchOverlay.tsx` — overlay global (scrim + panneau glassmorphism, autofocus, recherches récentes persistantes en localStorage).
- `useRecentSearches.ts` — hook localStorage pour recherches récentes (add/remove/clear, max 10).
- Soumission `/boutique?q=` (URL encode), fermeture auto de l'overlay.
- `SearchContext` + `SearchProvider` branches dans le layout racine.

### Haptique
- `useHapticFeedback` (`navigator.vibrate`) — **API mise à jour (PR #14)** : retourne `{ haptic }` au lieu de `{ haptic: haptic() }`. Utiliser `haptic('light')` ou `haptic('medium')` au lieu de `light()` / `medium()`.
- Branches sur : `BottomTabBar` (tab switch, light/medium), `SearchOverlay` (ouvert = selection, submit = success, recent click = light), `TopBar` (back = selection, search = light).
- `GestureCard` utilise `haptic('light')` et `haptic('medium')` via callbacks.

---

## 🪝 Hooks

| Hook | Fichier | Usage |
|------|--------|-------|
| `useHapticFeedback` | `src/hooks/useHapticFeedback.ts` | `navigator.vibrate` — styles: light, medium, selection, success. **API (PR #14)** : `{ haptic }` au lieu de `{ haptic: haptic() }`. Utiliser `haptic('light')` ou `haptic('medium')`. |
| `useOnlineStatus` | `src/hooks/useOnlineStatus.ts` | `navigator.onLine` — booléen en temps réel |
| `useOfflineCache` | `src/hooks/useOfflineCache.ts` | Cache localStorage + TTL, fallback data, invalidate/refetch |
| `useRecentSearches` | `src/hooks/useRecentSearches.ts` | Recherches récentes localStorage (max 10, add/remove/clear) |
| `useHikingStore` | `src/features/hiking/hooks/useHikingStore.ts` | État GPS complet (positions, distance, durée, déviation, météo, batterie) |

---

## ⚡ Performance — Dynamic Imports

Pattern pour réduire le First Load JS (Chantier 4, -39 kB total) :
```tsx
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), { ssr: false });
```

Pages optimisées :
- `/communauté` — 3 modales extraites (CarnetFormModal, ClubFormModal, ClubDetailModal) — -12 kB
- `/compte` — 5 tabs en dynamic import — -23 kB
- `/groups/[groupId]` — 4 composants en dynamic import — -4 kB

> **Note (PR #14)** : Dans `groups/[groupId]/page.tsx`, l'import `dynamic` a été renommé `dynamicImport` pour éviter un conflit avec `export const dynamic = 'force-dynamic'`.

---

## 🔍 SEO

### Metadata layouts
10 routes publiques avec `layout.tsx` exportant `metadata` (title, description, openGraph, twitter) :
- abonnements, ambassadeurs, avis, cart-interactive, communauté, contact, événements, explorer, pays, pro

### Structured data
3 helpers dans `seo-utils.ts` :
- `BreadcrumCrumbList` — fil d'Ariane
- `FAQPage` — FAQ
- `Product` — produit

### Sitemap
- 12 routes ajoutées au sitemap
- 11 slugs d'outils non implémentés supprimés (decompression, altimetre, meteo-montagne, carbonoscope, debit-eau, pharmacie, visa, neige, pharma, vaccins)

### robots.txt
Coverage allow/disallow étendue, références aux routes mortes supprimées.

---

## 🧱 CI/CD

Workflow CI avec 4 quality gates (`.github/ci.yml`) :
- **ESLint** — `npm run lint`
- **Type-check** — `npm run type-check`
- **Build** — `npm run build`
- **Validation cache** — `node scripts/validate-country-cache.mjs`

Déclenche sur push et PR vers `main`/`develop`.

> **Note** : Le fichier est à `.github/ci.yml` (limitation API GitHub). À déplacer vers `.github/workflows/ci.yml` via l'interface GitHub.

> **Build config (PR #14)** : `typescript.ignoreBuildErrors` est à `false`. `eslint.ignoreDuringBuilds` a été remis à `true` lors du chantier hiking (commit f86aac8, 9 août). À remettre à `false` pour restaurer le contrôle ESLint strict. Aucun bypass.

---

## 🎬 États de chargement / erreur / vidéo

Convention appliquée sur 6 pages (Chantier 7) :
- **Chargement** : spinner centré (border-2, animate-spin)
- **Erreur** : emoji ⚠️ + message + bouton "Réessayer" (foreground-800)
- **Vidéo** : emoji contextuel + message informatif

Pages concernées : alerts, avis, groupes, mes-aventures, messagerie.

Pattern :
```tsx
{loading && <Spinner />}
{error && <ErrorState onRetry={reload} />}
{!loading && !error && items.length === 0 && <EmptyState />}
{!loading && !error && items.length > 0 && <Content />}
```

---

## 🎭 Animation Components

`AnimatedPage`, `ScrollReveal`, `StaggerGrid` exportent maintenant en default ET named (backward compatibility) :
```tsx
// Les deux fonctionnent :
import AnimatedPage from '@/components/animation/AnimatedPage';
import { AnimatedPage } from '@/components/animation/AnimatedPage';
```

---

## 🛒 Cart API

```ts
// Ajouter au panier avec quantité supportée
addToCart(item: Omit<CartItem, 'quantity'>, 'quantity'>, quantity: number = 1): CartItem[]
// Mettre à jour la quantité
updateQuantity(id: string, quantity: number): CartItem[]
// Supprimer un item
removeFromCart(id: string): CartItem[]
// Calculer les totaux
getCartTotals(items: CartItem[]): { totalItems, totalPriceEur, totalWeightG, savedEur }
```

---

## 🏗️ Architecture

- **Server Components** : data fetching, API, logic serveur (les clés API restent serveur)
- **Client Components** (`'use client'`) : UI locale uniquement (état, événements) — pas de requêtes
- **Logique métier** : encapsulée dans `services/*.ts` ou `lib/supabase/queries-*.ts`
- **Service layer composé** : `src/lib/supabase/queries-compte.ts` centralise toutes les requêtes Supabase du dashboard voyageur (profil, stats, voyages, carnets, clubs, commandes, badges, activités, inventaire)
- **Validation** : `zod` pour toutes les entrées utilisateur (API + front)
- **Stripe** server-side only, webhooks async
- **Provider hierarchy** (root layout) : Auth > Wishlist > Toast > Search

### Connexion Supabase (Dashboard Compte)
Toutes les pages de compte utilisent `useAuth()` + `fetchDashboardData(user.id)` — pas de mock data.  
Le pattern :
```tsx
const { user } = useAuth();
const data = await fetchDashboardData(user.id);
setDashboardData(data);
```
8 fonctions de requêtes dans `queries-compte.ts` : `fetchFullProfile`, `fetchUserCarnets`, `fetchUserClubs`, `fetchUserOrders`, `fetchUserBadges`, `fetchUserActivities`, `fetchNextTrip`, `fetchDashboardData`.

### Navigation Client-side
Utiliser `useRouter()` de Next.js (`router.push()`) — jamais `window.location.href` qui force un rechargement complet de la page et casse le contexte React.

### Guards Null-safety
- `isFinite(null)` ⇔ `true` en JS (coercition `Number(null) = 0`). Toujours vérifier `lat != null && lng != null` avant `isFinite()`.
- Données optionnelles dashboard (profilVoyageur) : wrapper avec `{data && (...)}` ou `data?.field` pour éviter les crashes.

---

## 🗄️ Supabase

- **RLS obliger** sur toutes les tables, isolation par `auth.uid()`
- **Transactions SERIALIZABLE** pour les opérations multi-étapes (finances, inventaire)
- **PostGIS** côté serveur unique, CRS EPSG:4326
- **66 migrations** synchronisées dans `supabase/migrations/` (incluant hiking : `hike_sessions`, `carnet_moments`, `identified_species`, `trail_pois`, `trail_segments`, `trail_metadata`, `trail_scores`, `route_deviation_and_nearby_pois`, `offline_route_pois`)
- RLS vérifié en production : insertion anonyme bloquée sur toutes les tables de randonnée

---

## 🔐 Sécurité

- Clés API en variables d'environnement, jamais en dur
- Sanitization XSS côté serveur
- Validation d'entrée stricte (`zod`) à chaque front
- Stripe server-side only, webhooks async
- Routes API avec `export const dynamic = 'force-dynamic'` pour éviter le cache statique

---

## 📋 Workflow

1. Planification (design document)
2. Implémentation (sous-agent-driven développement)
3. Tests unitaires + intégration
4. Review (spec compliance + code quality)
5. Build vérification (`npx next build`)

### Types notables (PR #14)
- `MapTrail` étendu avec champs : `region`, `altitude_m`, `is_staffed`, `has_meals`, `price_per_night`, `has_blankets`, `description`
- `UserProfile` : champ `username?: string` ajouté
- `FilterState` renommé `FilterState` dans `src/components/explorer/types.ts`
- `CarnetMoment` étendu : `title`, `description`, `content`, `coordinates`
- `CarnetStatItem` étendu : `distance_km`, `denivele_m`, `duree_jours`
- `CarnetKitItem` étendu : `weightG`
- `AppIcon` : prop `title?: string` ajouté
- `LendItemModal` : prop `item` maintenant optionnel (`item?`)