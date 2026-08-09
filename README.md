# Le Kit du Voyageur (LKDV)

Plateforme e-commerce et communautaire pour voyageurs outdoor, construite avec Next.js 15, Supabase et Stripe.

## 🛍️ Fonctionnalités

- **Boutique** — Catalogue produits outdoor, configuration de kit, panier, checkout Stripe
- **Explorer** — Carte interactive des randonnées (PostGIS), filtres par difficulté/distance
- **Communauté** — Clubs, groupes, événements, feed, messagerie, carnets de voyage
- **Compte** — Dashboard voyageur : profil, aventures, carnets, clubs, commandes, badges, inventaire
- **Pays** — Guides par destination avec données climatiques, danger zones, globe 3D interactif
- **Admin** — Gestion produits, commandes, contenu (accès restreint)
- **Mobile** — Design responsive dual-view (desktop Tailwind + mobile inline styles via MobilePageShell)
- **Terrain** — Hub mobile centralisant GPS, carte, kit, recherche et mode hors ligne
- **Offline** — Bannière hors ligne, cache localStorage avec TTL, recherches persistantes
- **Haptique** — Vibrations tactiles sur navigation mobile (BottomTabBar, SearchOverlay, TopBar)
- **Cockpit de randonnée** 🥾 Suivi GPS en temps réel avec tracé live sur carte, écran de fin avec stats et carnet, import/export GPX, vue 3D terrain, narratives IA post-randonnée, détection de déviation et POIs proches

## 🏗️ Stack Technique

| Couche | Technologie |
|------|------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS |
| Backend | Supabase (PostgreSQL + PostGIS), RLS par `auth.uid()` |
| Paiement | Stripe (server-side, webhooks async) |
| IA | OpenRouter MCP |
| 3D | react-globe.gl + three.js (globe interactif page Pays) |
| Cartes | Leaflet + tuiles OSM |
| Animations | Frame Motion |

## 📦 Installation

```bash
npm install
# ou
yarn install
```

## 🚀 Développement

```bash
npm run dev
# ou
yarn dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 🗂️ Structure du projet

```
nextjs/
    src/
        app/                    # App Router (pages, layouts, API routes)
        ├── 🛍️ (shop)           # Boutique, produit, panier, checkout
        ├── 🗺️ explorer/       # Carte randonnées
        ├── 💬 communauté/      # Feed, clubs, groupes, événements
        ├── 📊 compte/          # Dashboard voyageur
        ├── 🗺️ pays/            # Guides par destination
        ├── 🥾 terrain/         # Hub terrain mobile (offline, GPS)
        ├── 🔧 admin/           # Admin (accès restreint)
        ├── 🖼️ components/   # (vidéo — anciens composants supprimés)
        components/
            mobile-nav/         # BottomTabBar, MobileDrawer, MobileNavWrapper, TopBar, OfflineBanner
            explorer/           # ExplorerMap, InteractiveMap
            carnet/             # CarnetView, CreateCarnetView
            communauté/        # CarnetFormModal, ClubFormModal, ClubDetailModal (dynamic imports)
            terrain/            # TerrainHub
            search/            # SearchOverlay, useRecentSearches
            compte/            # Dashboard tabs (dynamic imports)
            groups/            # Cards groupe voyage (dynamic imports)
            home/              # 17 sections homepage
            ui/                # AppImage, LkvIcon, EmptyState, CustomCursor
        features/
            hiking/              # Cockpit de randonnée (GPS, stats, carnet, GPX, 3D, IA)
                components/       # DesktopTopBar, DesktopLeftPanel, DesktopRightPanel, DesktopDockBar, DesktopMapOverlay, CompletionView, HikingCockpitPage
                hooks/            # useHikingStore (GPS, positions, déviation, météo)
                types/            # POI, FilterState, etc.
            hooks/             # useHapticFeedback, useOnlineStatus, useOfflineCache, useRecentSearches
            lib/
                supabase/
                ├── queries-*.ts   # Service layer (queries-compte, queries-carnet, etc.)
                ├── client.ts      # Client Supabase
                ├── services/     # Logique métier (cart, auth, stripe)
                contexts/          # AuthContext, WishlistContext, ToastContext, SearchContext
                supabase/
                    migrations/    # Migrations SQL (RLS, triggers, PostGIS) — 66 migrations synchronisées
                docs/
                ├── 📋 superpowers/
                ├── 📋 plans/      # Plans de développement
                ├── 📋 specs/      # Specs de design
                ├── 📄 FINAL_DELIVERY_REPORT.md
                ├── 📄 IMPLEMENTATION_SUMMARY.md
                CLAUDE.md          # Conventions de développement et design système
                PROGRESS.md        # Suivi des chantiers
                next.config.mjs
```

## 📐 Conventions

Voir [CLAUDE.md](./CLAUDE.md) pour le design système complet, les patterns responsives, les conventions d'image fallback, l'architecture, et les règles de sécurité.

Points clés :
- **Dual-view** : desktop (Tailwind) + mobile (inline styles via MobilePageShell)
- **Image fallback** : `src={data.image_url || '/assets/images/no_image.png'}`
- **Palette** : Foreground/Sage/Stone/Ink — orange `#E4501C` interdit
- **RLS** : obliger sur toutes les tables Supabase
- **Dynamic imports** : composants lourds en `next/dynamic` pour réduire le FLJS
- **États UI** : loading/erreur/vide sur toutes les pages data-driven
- **Haptique** : `useHapticFeedback` sur interactions mobile clés
- **`force-dynamic`** : les routes API utilisent `export const dynamic = 'force-dynamic'` pour éviter le cache statique Next.js

## 📜 Scripts

- `npm run dev` — Serveur de développement (port 3000)
- `npm run build` — Build de production
- `npm run start` — Serveur de production
- `npm run server` — Alias de `npm run start`
- `npm run lint` — ESLint
- `npm run lint:fix` — Corriger automatiquement les erreurs ESLint
- `npm run format` — Prettier
- `node scripts/validate-country-cache.mjs` — Valide les fichiers `.country-cache/*.json` (schéma, températures, précipitations, FAQ dupliquées)

## 🔧 CI/CD

Workflow CI avec 4 quality gates (`.github/ci.yml`) :
- **ESLint** — `npm run lint`
- **Type-check** — `npm run type-check`
- **Build** — `npm run build`
- **Validation cache** — `node scripts/validate-country-cache.mjs`

Déclenche sur push et PR vers `main`/`develop`.

> **Note** : Le fichier est actuellement à `.github/ci.yml` (limitation API GitHub). À déplacer manuellement vers `.github/workflows/ci.yml` via l'interface GitHub pour activer GitHub Actions.

> **Build config** : `typescript.ignoreBuildErrors` est à `false` (depuis PR #14). `eslint.ignoreDuringBuilds` a été remis à `true` lors du chantier hiking (commit f86aac8, 9 août). À remettre à `false` pour restaurer le contrôle ESLint strict.

## 📚 Documentation

- [CLAUDE.md](./CLAUDE.md) — Conventions de développement et design système
- [docs/superpowers/plans/](./docs/superpowers/plans/) — Plans de développement
- [docs/superpowers/specs/](./docs/superpowers/specs/) — Specs de design
- [docs/FINAL_DELIVERY_REPORT.md](./docs/FINAL_DELIVERY_REPORT.md) — Rapport de livraison
- [docs/IMPLEMENTATION_SUMMARY.md](./docs/IMPLEMENTATION_SUMMARY.md) — Résumé d'implémentation
- [PROGRESS.md](./PROGRESS.md) — Suivi des chantiers (Chantiers 1-13)

## 🙌 Acknowledgements

- Built with [Rocket.net](https://rocket.net)
- Powered by Next.js and React
- Styled with Tailwind CSS