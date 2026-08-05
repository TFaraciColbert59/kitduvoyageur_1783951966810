# Le Kit du Voyageur (LKDV)

Plateforme e-commerce et communautaire pour voyageurs outdoor, construite avec Next.js 15, Supabase et Stripe.

## 🚀 Fonctionnalités

- **Boutique** — Catalogue produits outdoor, configurateur de kit, panier, checkout Stripe
- **Explorer** — Carte interactive des randonnées (PostGIS), filtres par difficulté/distance
- **Communauté** — Clubs, groupes, événements, feed, messagerie, carnets de voyage
- **Compte** — Dashboard voyageur : profil, aventures, carnets, clubs, commandes, badges, inventaire
- **Pays** — Guides par destination avec données climatiques, danger zones, globe 3D interactif
- **Admin** — Gestion produits, commandes, contenu (accès restreint)
- **Mobile** — Design responsive dual-view (desktop Tailwind + mobile inline styles via MobilePageShell)
- **Terrain** — Hub mobile centralisant GPS, carte, kit, recherche et mode hors ligne
- **Offline** — Bannière hors ligne, cache localStorage avec TTL, recherches récentes persistantes
- **Haptique** — Vibrations tactiles sur navigation mobile (BottomTabBar, SearchOverlay, TopBar)

## 🛠 Stack Technique

| Couche | Technologie |
|--|--|
| Frontend | Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS |
| Backend | Supabase (PostgreSQL + PostGIS), RLS par `auth.uid()` |
| Paiement | Stripe (server-side, webhooks async) |
| IA | OpenRouter MCP |
| 3D | react-globe.gl + three.js (globe interactif page Pays) |
| Cartes | Leaflet + tuiles OSM/satellite |
| Animations | Framer Motion |

## 📦 Installation

```bash
npm install
# ou
yarn install
```

## 🔧 Développement

```bash
npm run dev
# ou
yarn dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 🗂 Structure du Projet

```
nextjs/
    src/
        app/                  # App Router (pages, layouts, API routes)
        ├── 📂 (shop)/         # Boutique, produit, panier, checkout
        ├── 📂 explorer/       # Carte randonnées
        ├── 📂 communaute/     # Feed, clubs, groupes, événements
        ├── 📂 compte/         # Dashboard voyageur
        ├── 📂 pays/           # Guides par destination
        ├── 📂 terrain/       # Hub terrain mobile (offline, GPS)
        ├── 📂 admin/          # Admin (accès restreint)
        ├── 📂 components/   # (vidéo — anciens composants supprimés)
        components/
        mobile-nav/           # BottomTabBar, MobileDrawer, MobileNavWrapper, TopBar, OfflineBanner
        explorer/             # ExplorerMap, InteractiveMap
        carnet/               # CarnetView, CreateCarnetView
        communaute/           # CarnetFormModal, ClubFormModal, ClubDetailModal (dynamic imports)
        terrain/              # TerrainHub
        search/               # SearchOverlay, useRecentSearches
        compte/               # Dashboard tabs (dynamic imports)
        groupes/              # Cards groupe voyage (dynamic imports)
        home/                 # 17 sections homepage
        ui/                   # AppImage, LkvIcon, EmptyState
    hooks/                   # useHapticFeedback, useOnlineStatus, useOfflineCache, useRecentSearches
    lib/
        supabase/
        ├── 📂 queries-*.ts    # Service layer (queries-compte, queries-carnet, etc.)
        ├── 📂 client.ts       # Client Supabase
        ├── 📂 services/      # Logique métier (cart, auth, stripe)
    contexts/               # AuthContext, WishlistContext, ToastContext, SearchContext
    supabase/
        migrations/          # Migrations SQL (RLS, triggers, PostGIS)
    docs/
        ├── 📂 superpowers/
        ├── 📂 plans/          # Plans de développement
        ├── 📂 specs/          # Specs de design
        ├── 📂 FINAL_DELIVERY_REPORT.md
        ├── 📂 IMPLEMENTATION_SUMMARY.md
        CLAUDE.md            # Conventions de développement et design system
        PROGRESS.md          # Suivi des chantiers
    next.config.mjs
```

## 📐 Conventions

Voir [CLAUDE.md](./CLAUDE.md) pour le design system complet, les patterns responsive, les conventions d'image fallback, l'architecture, et les règles de sécurité.

Points clés :
- **Dual-view** : desktop (Tailwind) + mobile (inline styles via MobilePageShell)
- **Image fallback** : `src={data.image_url || '/assets/images/no_image.png'}`
- **Palette** : Foreground/Sage/Stone/Ink — orange `#E4501C` interdit
- **RLS** : obligatoire sur toutes les tables Supabase
- **Dynamic imports** : composants lourds en `next/dynamic` pour réduire le FLJS
- **États UI** : loading/error/empty sur toutes les pages data-driven
- **Haptique** : `useHapticFeedback` sur interactions mobile clés

## 📦 Scripts

- `npm run dev` — Serveur de développement (port 3000)
- `npm run build` — Build de production
- `npm run start` — Serveur de production
- `npm run server` — Alias de `npm run start`
- `npm run lint` — ESLint
- `npm run lint:fix` — Corriger automatiquement les erreurs ESLint
- `npm run format` — Prettier
- `node scripts/validate-country-cache.mjs` — Valide les fichiers `.country-cache/*.json` (schéma, températures, précipitations, FAQ dupliquées)

## 🔄 CI/CD

Workflow CI avec 4 quality gates (`.github/ci.yml`) :
- **ESLint** — `npm run lint`
- **Type-check** — `npm run type-check`
- **Build** — `npm run build`
- **Validation cache** — `node scripts/validate-country-cache.mjs`

Déclenché sur push et PR vers `main`/`develop`.

> **Note** : Le fichier est actuellement à `.github/ci.yml` (limitation API GitHub). À déplacer manuellement vers `.github/workflows/ci.yml` via l'interface GitHub pour activer GitHub Actions.

## 📚 Documentation

- [CLAUDE.md](./CLAUDE.md) — Conventions de développement et design system
- [docs/superpowers/plans/](./docs/superpowers/plans/) — Plans de développement
- [docs/superpowers/specs/](./docs/superpowers/specs/) — Specs de design
- [docs/FINAL_DELIVERY_REPORT.md](./docs/FINAL_DELIVERY_REPORT.md) — Rapport de livraison
- [docs/IMPLEMENTATION_SUMMARY.md](./docs/IMPLEMENTATION_SUMMARY.md) — Résumé d'implémentation
- [PROGRESS.md](./PROGRESS.md) — Suivi des chantiers (Chantiers 1-13)

## 🙏 Acknowledgements

- Built with [Rocket.new](https://rocket.new)
- Powered by Next.js and React
- Styled with Tailwind CSS