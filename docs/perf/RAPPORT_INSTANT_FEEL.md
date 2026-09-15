# RAPPORT INSTANT-FEEL — chantier performance LKDV

Branche `perf/instant-feel`, base `08055da3` (programme/qualite-echelle).
Baseline complète : `docs/perf/baseline/BASELINE.md`. Un lot = un commit = un chiffre.

## Tableau avant/après (p50, prod locale, Supabase EU distant, 5 runs)

| Métrique | Avant (baseline) | Après | Gain | Commit |
|---|---:|---:|---|---|
| TTFB `/hub` sortie authentifiée (HTML complet) | ~1000 ms (870-1050) | **615 ms** | **−38 %** | P0-2 |
| TTFB = premier octet `/hub` (shell+skeleton) | ~1000 ms (HTML bloqué) | **13-29 ms** | **Loi 1 satisfaite** | P0-3 |
| Cascade `layout.adventure` | ~800 ms | ~415 ms | −48 % | P0-2 |
| Étape `lists` (N+1 groupes) | ~390 ms | ~250 ms | −140 ms | P0-2 |
| Étapes séquentielles cascade | 4 vagues séquentielles | 2 vagues + enrich parallèle | ~5 RTT | P0-2 |
| Chargement section (`/hub/[section]`) | getTripBySlug ×2 (10 tables ×2) | ×1 (cache React partagé) | −50 % DB | P2 |
| N+1 compteurs groupes | 2+N requêtes | 2 requêtes `.in()` | n→2 | P0-2 |
| Refetch `trip_steps` itinéraire | 1 requête redondante | 0 (trip.steps) | −1 | P2 |
| First Load JS `/hub/[section]` | 563 kB | 563 kB | 0 (bloqué, voir §P0-4) | — |
| First Load JS partagé | 104 kB | 104 kB | 0 (voir §P1-3) | P1-3 |
| Cache tuiles SW | non borné (éviction totale possible) | LRU 3000 entrées | fiabilité terrain | P2 |
| Sécurité SW | HTML/API privés en cache cross-comptes | liste blanche + purge + no-store | RGPD | P0-1 |

### Sécurité (bloquant lancement)
- **P0-1 (a8223667)** : fuite cross-comptes du SW fermée. Tests **SEC-1 : 3/3** (précache,
  visite authentifiée, purge + offline). `Cache-Control: private, no-store` sur routes authentifiées.
- **P0-5 (cbf681d6)** : `dangerouslyAllowSVG: false` + CSP images sandbox ; CSP
  `Report-Only` branchée sur `/api/telemetry/hub` ; **lint au build réactivé** (0 erreur,
  915 warnings à réduire règle par règle, TODO daté) ; **sameSite arbitré : NON changé**
  (WebView natif = origine distante, `lax` casserait l'auth — durcissement conditionnel
  documenté, requiert validation préprod iOS/Android).

### Ce qui n'a PAS bougé (et pourquoi)
- **First Load JS partagé (104 kB)** : P1-3 a retiré framer-motion du graphe direct du
  layout (PageTransition en CSS pur, rendu pixel-identique), mais `MobileDrawer`,
  `OfflineBanner` et `SearchOverlay` (imports statiques de `MobileNavWrapper`) le
  maintiennent dans le partagé. Leur conversion (gestes/drag, AnimatePresence) est le
  prochain levier — travail prudent, non livré de ce fait.
- **P0-4 (découpage `/hub/[section]`) — BLOQUÉ TECHNIQUEMENT** :
  1. `next/dynamic` sans `ssr:false` : chunks préchargés par le flight → 565 kB, aucun gain.
  2. `ssr:false` / `React.lazy` + Suspense dans un module client rendu par un RSC :
     échec de rendu (`Element type is invalid: got: undefined` au re-rendu CSR →
     error boundary sur toutes les sections). Vérifié par dichotomie : même un export
     default isolé produit l'erreur. **Reverté intégralement** (état re-prouvé 83/83).
  3. Voie correcte (session suivante) : `<ViewportOnly>` (P1-1) — monté après
     hydratation via `useState/useEffect`, jamais de lazy dans l'arbre RSC, skeleton
     iso-géométrique par section ; cible alors ≤ 210 kB avec P1-3.
- Note : le plafond ≤ 210 kB exige aussi P1-3 (le layout partagé du hub pèse ~250 kB).

## Vérifications (état final)
| Suite | Résultat |
|---|---|
| build (lint actif + types) | ✅ |
| vitest | **2756 passed / 0 failed** (27 skipped hermétiques) |
| test:visual | **80/83 + 3 échecs = flakiness réseau du test `pays-skeleton-loading`** (test de transition réseau ralenti ; signature identique à l'état d'entrée ; surface inchangée depuis le dernier 0-diff 83/83 de P0-3) |
| test:a11y | 57/57 (état d'entrée) |
| test:e2e | 49/67 + 18 échecs **pré-existants** documentés à l'Étape 0 (bug possession `hubSectionHref`, double-arbre `adventure-intelligence` ×2, test `createBtn` cassé) |
| SEC-1 | 3/3 |
| verify:invariants / icons | ✅ |

## Restant (session suivante, ordre recommandé)
1. **P0-4 via `<ViewportOnly>`** (P1-1) — le seul chemin sain pour le découpage.
2. **P1-3 suite** : MobileDrawer/OfflineBanner/SearchOverlay en CSS pur → cible ≤ 85 kB partagé.
3. **P1-2** : PPR incrémental sur /hub (test SEC-5 obligatoire sur le HTML prérendu).
4. **P2-2 DB** : `(select auth.uid())` sur toutes les policies + `EXPLAIN ANALYZE` des 15 requêtes chaudes (migration à valider sur copie).
5. **P4** : courbe de saturation (`ops:a15-load`) + seuils rollback.
6. Corriger les 18 échecs e2e pré-existants (hors périmètre perf, bloquants pour la confiance CI).
