# 📜 CLAUDE.md — LKDV (Le Kit du Voyageur)

**Stack:** Next.js 15 (App Router) / React 19 / TypeScript strict / Tailwind CSS  
**Backend:** Supabase (PostgreSQL + PostGIS), Row-Level Security obligatoire  
**Paiement:** Stripe (server-side, webhooks asynchrones)  
**IA:** OpenRouter MCP  

---

## 🎨 Design System — Mobile Redesign (v2)

### Palette
| Role | Hex | Usage |
|------|-----|-------|
| Forest 900 | `#0B1F17` | Dark backgrounds, text |
| Forest 800 | `#17402C` | Primary CTAs, active states, italic emphasis |
| Forest 700 | `#2D6B4A` | Gradient midtones |
| Sage 500 | `#A3C4A3` | Inactive borders, sage accents |
| Sage 100 | `#EDF3ED` | Tags, badges, promo backgrounds |
| Stone 100 | `#F4F1EA` | Card backgrounds, attribute boxes |
| Stone 50 | `#FBFAF6` | Paper/card surfaces |
| Ink 900 | `#0B1F17` | Shadows (`rgba(11,31,23, x%)`) |
| Ink 300 | `#6B7A72` | Secondary text, muted |
| Ink 100 | `rgba(11,31,23,0.06)` | Subtle borders |

**Interdit :** `#E4501C` (orange) — jamais dans le code nouveau ou modifié. Utiliser forest-800 `#17402C` pour les états actifs.

### Typographie
- **Sans (UI)** : Söhne / Inter, système `font-sans`
- **Serif italic (emphase)** : Georgia, via `<em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>`
- **Mono (données)** : JetBrains Mono / `ui-monospace, monospace`
- **Tracking** : `0.14em` ou `0.1em` pour les labels uppercase

### Glassmorphism (navigation flottante)
```
backdrop-filter: blur(24px) saturate(1.5)
```
Utilisé sur BottomTabBar, MobileDrawer.

### Ombres
Toujours en ink-based : `rgba(11,31,23, x%)` — jamais de `rgba(0,0,0)`.

---

## 📱 Responsive Pattern

Toutes les pages suivent le pattern dual-view :
```tsx
<>
  {/* ── DESKTOP ── */}
  <div className="hidden md:block">
    <div className="min-h-screen ..."> /* desktop content */ </div>
  </div>

  {/* ── MOBILE ── */}
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

## 🧩 Composants Clés

### Navigation Mobile
- `MobilePageShell` — Wrapper avec safe-area padding pour toutes les pages mobiles
- `MobileDrawer` — Menu latéral premium, glassmorphism
- `MobileNavWrapper` — Assemble TopBar + BottomTabBar
- `TopBar` — Props: `variant: 'standard' | 'on-image'`, `onMenuOpen`, `scrolled` (scroll state)
- `BottomTabBar` — 5 onglets, glassmorphism flottant

### Pages refondues (mobile)
| Page | Fichier | Sections mobiles |
|------|---------|------------------|
| Accueil | `MobileHomePage.tsx` + HomeHeroSection, QuickGrid, EditorialCard, StatsRow, StripCTA | Hero 460px forest-900, 2×2 grid, carte éditoriale, stats, CTA strip |
| Explorer | `explorer/page.tsx` | AventuresHero, MiniMap 900×250px (coins arrondis 16px), AventureCards, FAB Naviguer forest-800 |
| Fiche Produit | `produit/[slug]/ProductDetailClient.tsx` | Gallery 380px gradient, attributs 2×2, coloris 5 swatches, ProductBuyBar |
| Panier | `panier/page.tsx` | Items 76×92px images, qty selector, promo banner dashed, summary card |
| Checkout | `checkout/page.tsx` | Progress steps 4-bar, adresse carte, shipping radio, payment grid, dark total card |
| Carnets | `carnets/page.tsx` | Hero badge "Édition N°08", featured article 220px gradient, tabs scrollables, article list 80×90px |
| Admin | `admin/page.tsx` | Top bar forest-900 sticky, 12 pills sections scrollables horizontalement |
| Carnet de voyage | `components/carnet/CarnetView.tsx` | Hero dark stats chips, moments cards, kit items, footer |
| Création carnet | `components/carnets/CreateCarnetView.tsx` | Header glassmorphism sticky, éditeur champs, chapitres, tags, Preview+Publish |
| Pays | `pays/[code]/CountryPageClient.tsx` | Hero drapeau+infos, 8 tabs scrollables, contenus compressés, AI CTA cards |
| Jumeau 3D | `jumeau-3d/page.tsx` | Résumé poids sac, barres catégories, top articles, placeholder 3D |
| Rapport Kit | `rapport-kit/page.tsx` | En-tête stats, objets par catégorie, barres poids, recommandations |
| Rapport Expédition | `rapport-expedition/page.tsx` | Titre+dates, stats clés, résumé jour par jour, équipement |

### Nouveaux composants UI
- `ProductBuyBar` — sticky bottom bar, verre dépoli, qty pill + add-to-cart forest-800
- `EmptyState` — état vide réutilisable
- `ElevationProfile` — profil d'altitude SVG (Explorer)
- `DontForgetCard`, `WishlistProductsCard` — inventaire
- `useHapticFeedback`, `useSwipe` — hooks tactiles

### Attributs produit (mobile)
Grille 2×2 : Capacité/Poids/Matière/Origine — icône 30×30px, fond `#EAF1E5`

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

## 🏗️ Architecture

- **Server Components** : data fetching, API, logique serveur (les clés API restent côté serveur)
- **Client Components** (`'use client'`) : UI locale uniquement (état, événements) — pas de requêtes données
- **Logique métier** : encapsulée dans `services/*.ts` ou `lib/supabase/queries-*.ts`
- **Service layer compte** : `src/lib/supabase/queries-compte.ts` centralise toutes les requêtes Supabase du dashboard voyageur (profil, stats, voyages, carnets, clubs, commandes, badges, activités, abonnement, inventaire)
- **Validation** : `zod` pour toutes les entrées utilisateur (API → service)

### Connexion Supabase (Dashboard Compte)
Toutes les pages de compte utilisent `useAuth()` + `fetchDashboardData(user.id)` — pas de mock data.  
Le pattern :
```tsx
const { user } = useAuth();
// Dans un useEffect :
const data = await fetchDashboardData(user.id);
setDashboardData(data);
```
8 fonctions de requêtes dans `queries-compte.ts` : `fetchFullProfile`, `fetchUserCarnets`, `fetchUserClubs`, `fetchUserOrders`, `fetchUserBadges`, `fetchUserActivities`, `fetchNextTrip`, `fetchDashboardData`.

### Navigation Client-side
Utiliser `useRouter()` de Next.js (`router.push()`) — jamais `window.location.href` qui force un rechargement complet de la page et casse le contexte React.

### Guards Null-safety
- `isFinite(null)` → `true` en JS (coercition `Number(null)` = 0). Toujours vérifier `lat != null && lng != null` avant `isFinite()`.
- Données optionnelles du dashboard (`prochainVoyage`) : wrapper avec `{data && (...)}` ou `data?.field` pour éviter les crashes.

## 💾 Supabase

- **RLS obligatoire** sur toutes les tables, isolation par `auth.uid()`
- **Transactions SERIALIZABLE** pour les opérations multi-étapes (finances, inventaire)
- **PostGIS** côté serveur uniquement, CRS EPSG:4326
- Migrations dans `supabase/migrations/`

## 🔒 Sécurité

- Clés API en variables d'environnement, jamais en dur
- Sanitisation XSS côté serveur
- Validation d'entrée stricte (`zod`) à chaque frontière
- Stripe server-side only, webhooks asynchrones

## 🧪 Workflow

1. Planification (design document)
2. Implémentation (subagent-driven development)
3. Tests unitaires + intégration
4. Review (spec compliance + code quality)
5. Build verification (`npx next build`)
