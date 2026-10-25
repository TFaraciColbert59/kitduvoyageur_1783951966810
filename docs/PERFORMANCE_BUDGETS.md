# Budgets de Performance & Web Vitals (LKDV)

## 1. Objectifs & Seuils Cibles (vs Baseline P0.6)

Conformément à la Phase 10.1 du chantier d'unification LKDV, chaque route majeure dispose d'un budget strict validé en CI.

| Route | Budget JS Transféré (Gzip) | LCP Cible (Mobile 4G) | INP Cible | CLS Cible | Rendu Principal |
|---|---|---|---|---|---|
| **`/` (Accueil)** | < 120 kB | < 1.8s | < 150 ms | < 0.05 | Server Component |
| **`/voyages`** | < 150 kB | < 2.2s | < 150 ms | < 0.05 | Server Component + Island Client |
| **`/voyages/[slug]`** | < 160 kB | < 2.4s | < 180 ms | < 0.06 | Server-First + Dynamic Leaflet |
| **`/equipages`** | < 130 kB | < 1.9s | < 120 ms | < 0.02 | Server Component (O(1) aggregations) |
| **`/equipages/[slug]`**| < 140 kB | < 2.1s | < 140 ms | < 0.03 | Server Component |
| **`/carnets/[id]`** | < 110 kB | < 1.6s | < 100 ms | < 0.02 | Server Component (SEO pur) |

## 2. Optimisations Réalisées

1. **Vidéo d'arrière-plan cinématique (`CompteBackground.tsx`)** :
   - Totalement inactive et absente sur mobile (< 768px).
   - Sur desktop : détection proactive de `prefers-reduced-motion` et `saveData` / `2g` via `navigator.connection` avec bascule immédiate sur image statique WebP/JPG.
2. **Cartographie Leaflet / OpenStreetMap** :
   - Chargement différé (`next/dynamic` avec `ssr: false`).
   - Pré-chargement des tuiles cartographiques dans le Service Worker (`public/sw.js` cache `lkdv-tiles-v1`).
3. **Élimination des N+1** :
   - Requêtes `/equipages` et `/voyages` fédérées au niveau de Supabase avec agrégats JSON et CTE uniques.
