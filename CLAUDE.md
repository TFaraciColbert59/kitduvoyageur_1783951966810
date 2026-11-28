# CLAUDE.md — Règles & Context Engineering LKDV

> Fichier de règles persistantes (Niveau 1) pour tout agent IA travaillant sur **Le Kit du Voyageur (LKDV)**.

## Stack technique exacte
- **Web** : Next.js `15.5.25` (App Router), React `19.3.1`, TypeScript 5, Tailwind CSS 3 + Design Bank (`src/design/bank.ts`).
- **Hébergement Web** : **Cloudflare Workers via `vinext`** (`cloudflare.config.ts`, `vite.config.ts`). **Vercel est retiré** — ne jamais recréer `vercel.json` ni `.vercel/`.
- **Mobile Natif** : **Capacitor 8** (`ios/` + `android/` + tests `.maestro/`). `CAPACITOR_SERVER_URL` obligatoire en HTTPS pour les builds release.
- **Base de données** : **Supabase** (`lekitduvoyageur2`, `eu-west-3`, PostgreSQL 17 + PostGIS + RLS + 8 buckets Storage + 2 Edge Functions `fetch-osm-trails`, `geo-import`).
- **Cartographie & 3D** : **MapLibre GL + Three.js `r186`** + modèles GLB optimisés Draco/WebP. `react-leaflet` et `explorer-osm` sont supprimés (ne pas introduire de nouvelles dépendances Leaflet).
- **Routage natif haute perf** : Crate Rust/WASM `crates/lkdv-route-core`.
- **UI & Charts** : `@base-ui/react`, `@radix-ui/react-dialog`, Framer Motion 12, Recharts 2.15, Lucide React.

## Commandes critiques (Contrainte machine : Mac 8 Go RAM)
- **Design Bank** (avant tout commit touchant au CSS/tokens) : `npm run design:check`
- **Tests unitaires** : `npm test` (Vitest)
- **Lint** : `npm run lint`
- **Build production** :
  ```bash
  FAST_BUILD=1 NODE_OPTIONS="--max-old-space-size=3072" npx next build && rm -rf .next/cache/webpack
  ```
  *(Toujours purger `.next/cache/webpack` après un build pour préserver l'espace disque et ne jamais lancer deux builds/tests lourds en parallèle.)*
- **Serveur prod local** : `npx next start -p 3001 -H ::`

## Invariants & Pièges connus (À ne JAMAIS casser)
1. **Sub-drawers portaled Explorer v2 (`ExplorerNestedSubDrawer`)** : Ne **JAMAIS** appliquer la classe `.xp20-root` à l'intérieur d'un sub-drawer portaled (`position: fixed; inset: 0; overflow: hidden;` effondre la hauteur à 131 px). Utiliser exclusivement `.xp20-exp-scope`.
2. **Design Bank générée** : `scripts/generate-design-bank.mjs` génère `tailwind.preset.generated.js` ET `.cjs` à chaque `predev`/`prebuild`. Ne jamais supprimer l'un sans mettre à jour le générateur.
3. **`empty-stub.js` à la racine** : Requis par `vite.config.ts` pour Cloudflare Workers (`vinext`) — ne jamais supprimer.
4. **Fixtures de tests dans `docs/`** : Les fichiers suivants sont lus directement par Vitest/Playwright :
   - `docs/design-system/maquettes/compte-ios27-v8.html`
   - `docs/progression/2.0/economie.md` & `docs/progression/2.0/rules-registry.json`
   - `docs/kit-studio/reference/kit-studio.html`
   - `docs/audit/communaute-v2-2026-11-08/integration/fixtures.mjs`
   - `docs/coverage/*.json`
5. **Routes fusionnées / supprimées** :
   - `/itineraire` redirige vers `/explorer?mode=plan`.
   - `/carnets` (hub) est supprimé (`308` → `/communaute` dans `src/constants/routeRegistry.json`), seul `/carnets/[id]` reste actif.
6. **Budget API : 0 € strict** : Utiliser uniquement des APIs gratuites/open-data (Waymarked Trails, Overpass, Open-Meteo, AWS Terrarium DEM, NOAA offline) et des calculs locaux.
7. **Base de données** : Ne jamais exécuter `DROP TABLE ... CASCADE` ; toujours vérifier `pg_proc` / `pg_views` / `src/` / `scripts/` et utiliser `RESTRICT`. Ne jamais commiter `.env.local` ni de secrets.

## Carte rapide du code
- `src/app/` — 46 pages App Router & 400+ routes API (`src/app/api/`)
- `src/features/explorer-v2/` — Cartographie 3D, HUD 6 onglets, Route Planner, Tracker GPS, Studio Analyse Avancée (`redesign/summary/`), Handoff universel (`outingHandoff.ts`)
- `src/features/community/` — Communauté V2, 6 formulaires auto-remplis (`CreateSheetV2.tsx`, `CarnetFormV2`, `PostFormV2`, etc.)
- `src/design/bank.ts` — Source unique des tokens design
- `src/styles/explorer-glass.css` — Style Apple Liquid Glass & thèmes `light` / `dark` / `night-red`
- `docs/README.md` — Documentation complète détaillée par domaine
