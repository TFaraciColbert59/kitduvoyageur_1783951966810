# 🧠 CLAUDE.md — LKDV (Le Kit du Voyageur)

**Stack:** Next.js 15 (App Router) / React 19 / TypeScript strict / Tailwind CSS  
**Backend:** Supabase (PostgreSQL + PostGIS), Row-Level Security obligatoire  
**Paiement:** Stripe (server-side, webhooks async)  
**IA:** OpenRouter MCP  
**3D:** react-globe.gl + three.js (globe interactif page Pays)  

---

## 🎨 Design Système — Mobile Redesign (v2)

### Palette
| Rôle | Hex | Usage |
|---|---|---|
| Foreground 900 | `#0B1F17` | Dark backgrounds, text |
| Foreground 800 | `#17402C` | Primary CTAs, active states, italic emphasis |
| Foreground 700 | `#2D6B4A` | Gradient midtones |
| Sage 500 | `#A3C4A3` | Inactive borders, sage accents |
| Sage 100 | `#EDF3ED` | Promo backgrounds |
| Stone 100 | `#F4F1EA` | Card backgrounds, attribute boxes |
| Stone 50 | `#FBFAF6` | Paper/card surfaces |
| Ink 900 | `#0B1F17` | Shadows (`rgba(11,31,23, %)`) |
| Ink 300 | `#6B7A72` | Secondary text, muted |
| Ink 100 | `rgba(11,31,23,0.06)` | Subtle borders |

**Interdit :** `#E4501C` (orange) — jamais dans le code nouveau ou modifié. Utiliser foreground-800 `#17402C` pour les états actifs.

### Typographie
- **Sans (UI)** : Söhne / Inter, système `font-sans`
- **Serif italic (emphasis)** : Georgia, via `<em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>`
- **Mono (données)** : JetBrains Mono / `ui-monospace, monospace`
- **Tracking** : `0.14em` ou `0.1em` pour les labels uppercase

### Glassmorphism (navigation flottante)
```css
backdrop-filter: blur(24px) saturate(1.5);
```
Utilisé sur BottomTabBar, MobileDrawer.

### Ombres
Toutes en ink-based : `rgba(11,31,23, %)` — jamais de `rgba(0,0,0)`.

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
      /* mobile content — inline styles, pas de Tailwind mobile */
    </MobilePageShell>
  </div>
</>
```

- **Mobile :** inline styles systématiquement (pas de Tailwind dans les vues mobiles)
- **Desktop :** Tailwind classes
- **Wrapper mobile :** `MobilePageShell` (padding safe-area)
- **Footer spacer mobile :** `<div style={{ height: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }} />`

---

## 🖼️ Image Fallback Convention

Toutes les images (`<img>` et `<Image>`) doivent utiliser un fallback pour les `src` vides ou nulles :
```tsx
src={data.image_url || '/assets/images/no_image.png'}
```

- Le fichier `/public/assets/images/no_image.png` sert de placeholder universel.
- `AppImage` applique cette logique à l'initialisation : `useState(src || fallbackSrc)` et `hasError = !src`.
- Concerné : 20+ composants (compte, inventaire, explorer, carnet, produit, événements, location).

---

## 🗺️ Cartes — Conventions Z-Index & Mobile

### ExplorerMap
- z-index des overlays abaissé à `1000` à `400` pour éviter le chevauchement avec la BottomTabBar mobile.
- Utiliser `h-dvh` (dynamic viewport height) sur mobile à lieu de `calc(100vh - ...)`.

### InteractiveMap
- Sidebar cachée sur mobile (`hidden sm:flex`), remplacée par un FAB de toggle filtres (bouton flottant `🏔️` en `fixed top-20 left-3 z-30`).
- Quand le panneau filtres est ouvert sur mobile : `fixed inset-0 z-50` avec bouton "✕ Fermer".
- Hauteur mobile : `h-dvh` au lieu de `calc(100vh-64px)`.

---

## 🛣 Routes & Redirects

### Routes supprimées (Chantier 2)
- `/catalogue` — supprimé, redirect permanent vers `/boutique`
- `/shop` — supprimé, redirect permanent vers `/boutique`
- `/configurateur` — supprimé, redirect permanent vers `/ai-configurateur`
- Anciens composants homepage (`src/app/components/`) supprimés (HeroSection, FeaturesSection, PopularKitsSection, SocialProofSection, CategoriesSection, CountryTeaserSection, ConfiguratorTeaser, etc.)

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

## 👥 Communautés Clés

### Navigation Mobile
- `MobilePageShell` — Wrapper avec safe-area padding pour toutes les pages mobiles
- `MobileDrawer` — Menu latéral premium, glassmorphism
- `MobileNavWrapper` — Assemble TopBar + BottomTabBar + MobileDrawer + SearchOverlay + OfflineBanner
- `TopBar` — Props: `variant: 'standard' | 'on-image'`, `onMenuOpen`, `scrolled` (scroll state). Haptique sur back et search.
- `BottomTabBar` — 5 onglets, glassmorphism flottant. Tabs : Accueil (`home`), Explorer (`mountain`), Boutique (`bag`), Communauté (`users`), Compte (`user`). Haptique sur tab switch.
- `LkvIcon` — Icônes disponibles : `home`, `mountain`, `bag`, `doc`, `user`, `search`, `chevron-left`, `chevron-right`, `heart`, `bookmark`, `bell`, `map-pin`, `star`, `minus`, `plus`, `close`, `menu`, `arrow-right`, `lock`, `filter`, `users`, `compass`.

### Pages référencées (mobile)
| Page | Fichier | Sections mobiles |
|---|---|---|
| Accueil | `MobileHomePage.tsx` + HeroSection, QuickGrid, EditorialCard, StatsRow, StripCTA | Hero 460px forest-900, 2-col grid, carte éditoriale, stats, CTA strip |
| Explorer | `explorer/page.tsx` | AventuresHero, MiniMap 900×250px (coins arrondis 16px), AventureCards, FAB Navigator forest-800 |
| Fiche Produit | `produit/[slug]/ProductDetailClient.tsx` | Gallery 380px gradient, attributs 2×2, couleurs 5 swatches, ProductBuyBar |
| Panier | `panier/page.tsx` | Items 77×92px images, qty selector, promo banner dashed, summary card |
| Checkout | `checkout/page.tsx` | Progress steps 4-bar, address card, shipping radio, payment grid, dark total card |
| Communauté | `communaute/page.tsx` + `BottomTabBar` tab | Remplace l'ancien tab "Carnet". Regroupe clubs, groupes, événements, feed, messagerie |
| Admin | `admin/page.tsx` | Top bar forest-900 sticky, 12 pillules sections scrollables horizontalement |
| Carnet de voyage | `components/carnet/CarnetView.tsx` | Hero dark stats chips, moments cards, kit items, randonnées |
| Création carnet | `compte/page.tsx` | Stats clés, objets par catégorie, barres pods, recommandations |
| Pays | `pays/[code]/CountryPageClient.tsx` | Hero drag+infos, 8 tabs scrollables, contenus compressés, AI CTA cards |
| Jumeau 3D | `jumeau-3d/page.tsx` | Résumé pods sac, barres catégoriques, top articles, placeholder 3D |
| Rapport Kit | `rapport-kit/page.tsx` | En-tête stats, objets par catégorie, barres pods, recommandations |
| Rapport Expédition | `rapport-expedition/page.tsx` | Titre+dates, stats clés, résumé jour par jour, équipement |
| Terrain | `terrain/page.tsx` | Desktop redirect vers /explorer, mobile rend TerrainHub dans MobilePageShell |

### Nouveaux composants UI
- `ProductBuyBar` — sticky bottom bar, verre dépoli, qty pill + add-to-cart forest-800
- `EmptyState` — état vide réutilisable
- `ElevationProfile` — profil d'élévation SVG (Explorer)
- `CountryGlobe` — globe 3D interactif (react-globe.gl) sur la page Pays
- `OfflineBanner` — bannière sticky hors ligne (z-index 55, sous safe-area)
- `SearchOverlay` — overlay global de recherche avec recherches récentes persistantes en localStorage
- `TerrainHub` — hub mobile centralisant GPS, carte, kit, recherche et mode hors ligne

### Attributs produit (mobile)
Grille 2×2 : Capacité/Poids/Matière/Origine — icône 30×30px, fond `#EAF1E5`.

---

## ⛰️ Terrain & Offline

### Page /terrain
- Page statique mobile-only. Desktop redirect vers `/explorer`.
- `TerrainHub.tsx` — header avec badge GPS actif/hors ligne (`useOnlineStatus`), hero card "Naviguer" (gradient forest), grille Accès rapide (Mon Kit, Recherche, Carnet, Guides), CTA "Mode terrain persistant" (à venir).
- Badge hors ligne en ink `#6B7A72` (orange `#E4501C` interdit par le design system).

### Offline
- `OfflineBanner.tsx` — bannière sticky (z-index 55, sous safe-area) quand `navigator.onLine` est faux, toast "Connexion rétablie" au retour, icône wifi-off en SVG inline, indiquer sage `#A3C4A3`.
- `useOfflineCache.ts` — hook générique cache localStorage + TTL (`lkdv_cache_<key>`), expose `{ data, isLoading, error, isCached, invalid, clearCache, refetch }`.
- `OfflineBanner` monté dans `MobileNavWrapper` (global via layout).

### Recherche persistante
- `SearchOverlay.tsx` — overlay global (scrim + panneau glassmorphism, autofocus, recherches récentes persistantes en localStorage).
- `useRecentSearches.ts` — hook localStorage pour recherches récentes (add/clear/remove, max 10).
- Soumission `/boutique?q=` (URL encode), fermeture auto de l'overlay.
- `SearchContext` + `SearchProvider` branchés dans le layout racine.

### Haptique
- `useHapticFeedback` (`navigator.vibrate`) — **API mise à jour (PR #14)** : retourne `{ haptic }` au lieu de `{ light, medium }`. Utiliser `haptic('light')` ou `haptic('medium')` au lieu de `light()` / `medium()`.
- Branché sur : `BottomTabBar` (tab switch, light/medium), `SearchOverlay` (ouvert = selection, submit = success, recent click = light), `TopBar` (back = selection, search = selection).
- `GestureCard` utilise `haptic('light')` et `haptic('medium')` via callbacks.

---

## 🪝 Hooks

| Hook | Fichier | Usage |
|---|---|---|
| `useHapticFeedback` | `src/hooks/useHapticFeedback.ts` | `navigator.vibrate` — styles: light, medium, selection, success. **API: `{ haptic }` (PR #14)** |
| `useOnlineStatus` | `src/hooks/useOnlineStatus.ts` | `navigator.onLine` — boolean en temps réel |
| `useOfflineCache` | `src/hooks/useOfflineCache.ts` | Cache localStorage + TTL, fallback data, invalidate/refetch |
| `useRecentSearches` | `src/hooks/useRecentSearches.ts` | Recherches récentes localStorage (max 10, add/remove/clear) |

---

## ⚡ Performance — Dynamic Imports

Pattern pour réduire le First Load JS (Chantier 4, -39 kB total) :
```tsx
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), { ssr: false });
```

Pages optimisées :
- `/communaute` — 3 modales extraites (CarnetFormModal, ClubFormModal, ClubDetailModal) — -12 kB
- `/compte` — 5 tabs en dynamic import — -23 kB
- `/groupes/[groupId]` — 4 composants en dynamic import — -4 kB

> **Note (PR #14)** : Dans `groupes/[groupId]/page.tsx`, l'import `dynamic` a été renommé `dynamicImport` pour éviter un conflit avec `export const dynamic = 'force-dynamic'`.

---

## 🔍 SEO

### Metadata layouts
10 routes publiques avec `layout.tsx` exportant `metadata` (title, description, openGraph, twitter) :
- abonnements, ambassadeurs, avis, cart-interactive, communaute, contact, evenements, explorer, pays, pro

### Structured data
3 helpers dans `seo-utils.ts` :
- `BreadcrumbList` — fil d'Ariane
- `FAQPage` — FAQ
- `Product` — produit

### Sitemap
- 12 routes ajoutées au sitemap
- 11 slugs d'outils non implémentés supprimés (decompression, altimetre, meteo-montagne, carbonescope, debit-eau, pharmacie, visa, noeud, soleil, pharmacie, vaccins)

### robots.txt
Coverage allow/disallow étendue, références aux routes mortes supprimées.

---

## 🛠 CI/CD

Workflow CI avec 4 quality gates (`.github/ci.yml`) :
- **ESLint** — `npm run lint`
- **Type-check** — `npm run type-check`
- **Build** — `npm run build`
- **Validation cache** — `node scripts/validate-country-cache.mjs`

Déclenche sur push et PR vers `main`/`develop`.

> **Note** : Le fichier est à `.github/ci.yml` (limitation API GitHub). À déplacer manuellement vers `.github/workflows/ci.yml` via l'interface GitHub pour activer GitHub Actions.

> **Build config (PR #14)** : `typescript.ignoreBuildErrors` et `eslint.ignoreDuringBuilds` sont à `false`. Le build échoue en cas d'erreur TypeScript ou ESLint. Aucun bypass.

---

## 📦 États de chargement / erreur / vide

Convention appliquée sur 6 pages (Chantier 7) :
- **Chargement** : spinner centré (border-2, animate-spin)
- **Erreur** : emoji ⚠️ + message + bouton "Réessayer" (forest-800)
- **Vide** : emoji contextuel + message informatif

Pages concernées : alertes, avis, fidélité, groupes, mes-aventures, messagerie.

Pattern :
```tsx
{loading && <Spinner />}
{error && <ErrorState onRetry={reload} />}
{!loading && !error && items.length === 0 && <EmptyState />}
{!loading && !error && items.length > 0 && <Content />}
```

---

## 🎬 Animation Components

`AnimatedPage`, `ScrollReveal`, `StaggerGrid` exportent maintenant en default ET named (backward compatibility) :
```tsx
// Les deux fonctionnent :
import AnimatedPage from '@/components/animation/AnimatedPage';
import { AnimatedPage } from '@/components/animation/AnimatedPage';
```

---

## 🛒 Cart API

```ts
// Ajoute au panier avec quantité supportée
addToCart(item: Omit<CartItem, 'quantity'>, quantity: number = 1): CartItem[]
// Met à jour la quantité
updateQuantity(id: string, quantity: number): CartItem[]
// Supprime un item
removeFromCart(id: string): CartItem[]
// Calcule les totaux
getCartTotals(items: CartItem[]): { totalItems, totalPriceEur, totalWeightG, savedEur }
```

---

## 🏗 Architecture

- **Server Components** : data fetching, API, logique serveur (les clés API restent serveur)
- **Client Components** (`'use client'`) : UI locale uniquement (état, événements) — pas de requêtes
- **Logique métier** : encapsulée dans `services/*.ts` ou `lib/supabase/queries-*.ts`
- **Service layer composé** : `src/lib/supabase/queries-compte.ts` centralise toutes les requêtes Supabase du dashboard voyageur (profil, stats, voyages, carnets, clubs, commandes, badges, activités, inventaire)
- **Validation** : `zod` pour toutes les entrées utilisateur (API + front)
- **Stripe** server-side only, webhooks async
- **Provider hierarchy** (root layout) : Auth > Wishlist > Toast > Search > ErrorBoundary

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
- `isFinite(null)` → `true` en JS (coercition `Number(null) = 0`). Toujours vérifier `lat != null && lng != null` avant `isFinite()`.
- Données optionnelles dashboard (profilVoyageur) : wrapper avec `{data && (...)}` ou `data?.field` pour éviter les crashes.

---

## 🗄 Supabase

- **RLS obligatoire** sur toutes les tables, isolation par `auth.uid()`
- **Transactions SERIALIZABLE** pour les opérations multi-étapes (finances, inventaire)
- **PostGIS** côté serveur unique, CRS EPSG:4326
- Migrations dans `supabase/migrations/`

---

## 🔒 Sécurité

- Clés API en variables d'environnement, jamais en dur
- Sanitization XSS côté serveur
- Validation d'entrée stricte (`zod`) à chaque front
- Stripe server-side only, webhooks async

---

## 🛠 Workflow

1. Planification (design document)
2. Implémentation (sous-agent-driven développement)
3. Tests unitaires + intégration
4. Review (spec compliance + code quality)
5. Build vérification (`npx next build`)

### Types notables (PR #14)
- `MapTrail` étendu avec champs refuges/shelters : `region`, `altitude_m`, `capacity`, `is_staffed`, `has_meals`, `open_months`, `price_per_night`, `has_blankets`, `description`
- `UserProfile` : champ `username?: string` ajouté
- `FilterState` renommé `FilterStates` dans `src/components/explorer/types.ts`
- `CarnetMoment` étendu : `title`, `description`, `content`, `coordinates`
- `CarnetStatItem` étendu : `distance_km`, `denivele_m`, `duree_jours`
- `CarnetKitItem` étendu : `weightG`
- `AppIcon` : prop `title?: string` ajoutée
- `LendItemModal` : prop `item` maintenant optionnelle (`item?`)