# Mon Matériel — Cockpit Liquid Glass

Reconstruction complète du module **Mon Matériel** de LKDV (Cockpit Liquid Glass, inspiration
Apple iOS 26 / WWDC 2025). Stack : Next.js 15 (App Router), React 19, TypeScript strict, Tailwind,
Supabase (Postgres), Zod, Zustand.

## Routes

| Route | Description |
|---|---|
| `/materiel` | Grille des 6 cartes (Départ hero, À ne pas oublier, Mes kits, Inventaire, Alertes, Disponibilité) |
| `/materiel/depart/[id]` | Cockpit de préparation de départ (10 widgets : MapLibre, météo 48h, kit, checklist, consommables, poids, participants/urgence, score terrain, kits communauté, actions) |
| `/materiel/forget` | Checklist « à ne pas oublier » (persist `is_checked`) |
| `/materiel/kits` | Kits : KPIs, grille+filtres, assembleur DnD, optimiseur IA, comparateur, templates, historique, weather match, suggestions |
| `/materiel/inventaire` | Inventaire : vue d'ensemble, recherche/tri, grille virtualisée, détail, scan OCR, comparateur, achats, insight, cross-sell |
| `/materiel/alertes` | Alertes & fiabilité : score, top accordéon, onglets, timeline, entretien, météo, calendrier, occasion, export |
| `/materiel/disponibilite` | Disponibilité : jauge, KPIs, gantt, onglets prêts, conflits, heatmap, contrat, rappels, score, actions |
| `/k/[token]` | Page publique de partage d'un kit |

## Design System
- Palette Sage / Stone / Ink + sémantiques (`warn`, `danger`, `info`). **Jamais** `#E4501C`.
- Liquid glass : `src/styles/liquid-glass.css` (tokens + utilitaires `.glass`).
- Composants socles : `src/components/ui/{GlassCard,GlassSheet,GlassDrawer,GlassCommand,
  ProductGlassCard,Metric,Eyebrow,Badge,ProgressBar,SpotlightTracker}`.
- Règle : une seule feuille glass primaire par vue, contraste ≥ 4.5:1, `prefers-reduced-motion`.

## Schéma Supabase
Tables (schéma `public`, RLS par `auth.uid()`), migration `20260825000000_materiel_rebuild.sql` :

| Table | Rôle |
|---|---|
| `materiel_kits` | Kits utilisateur (user-owned) |
| `materiel_kit_items` | Articles de kit (FK `materiel_kits`, `product_ownership`) |
| `materiel_kit_history` | Historique des versions/activités d'un kit |
| `product_ownership` | Inventaire personnel |
| `alerts` | Alertes de fiabilité |
| `materiel_loans` | Prêts (accès croisé prêteur/emprunteur) |
| `share_tokens` | Partage public de kit |

> Noms adaptés pour éviter la collision avec les tables catalogue presets `kits`/`kit_items` et
> `loans` (déjà existantes, schémas incompatibles). Voir `MISSION_LOG.md` (décision D3.1).

## API
Routes sous `src/app/api/materiel/*` (validation Zod systématique, `runtime = nodejs`) :

| Route | Méthodes | Rôle |
|---|---|---|
| `items` | GET/POST | Inventaire (`product_ownership`) |
| `items/[id]` | PATCH/DELETE | Édition/suppression d'un objet |
| `kits` | GET/POST | Kits (`materiel_kits`) + journalisation historique |
| `kits/[id]` | PATCH/DELETE | Mise à jour/suppression d'un kit |
| `kits/[id]/history` | GET | Historique du kit (`materiel_kit_history`) |
| `kit-items/[id]` | PATCH | Check/uncheck + quantité article de kit |
| `alerts/[id]` | PATCH | Résolution d'alerte |
| `loans/[id]` | PATCH | Statut de prêt (rendu, etc.) |
| `participants` | POST | Ajout d'un participant à un départ |
| `export` | POST | Export kit (csv/json) |
| `share` | POST/GET | Génération/lecture de token de partage (`share_tokens`, service_role pour lecture publique) |
| `calendar` | GET | Export ICS |
| `fork` | POST | Dupliquer un kit public |
| `search` | GET | Recherche ⌘K (kits + items) |
| `optimize` | POST | Optimiseur IA (SSE, fallback déterministe) |
| `scan` | POST | Scan OCR/code-barres (fallback déterministe) |

## Offline
- `public/sw.js` : cache des routes `/materiel`, `/materiel/kits`, `/materiel/inventaire`.
- `src/lib/materiel/db.ts` : miroir IndexedDB (Dexie) + `src/features/materiel/services/sync.ts`.

## Tests
- Vitest : `tests/schemas/*.spec.ts` + `tests/materiel/*.spec.ts` (30 tests : zod, optimizer,
  comparator, conflicts, scanner, history, order).
- Playwright : `scripts/e2e/materiel.spec.ts` (grille, nav, écrans, cockpit départ, axe 0).

## Développement
```bash
npm run dev        # http://localhost:4000
npm run type-check # tsc --noEmit
npm run test       # vitest run
npm run build
npm run test:e2e   # playwright (serveur sur 4028, build requis)
node scripts/verify-materiel.mjs   # harness DB démo (tables peuplées)
```
