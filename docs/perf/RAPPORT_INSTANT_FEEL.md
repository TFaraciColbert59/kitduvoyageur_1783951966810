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
| **First Load JS `/hub/[section]`** | **563 kB** (177 kB page) | **452 kB** (95.3 kB page) | **−20 %** | **P0-4** |
| First Load JS partagé | 104 kB | 104 kB | 0 (voir §P1-3) | P1-3 |
| Cache tuiles SW | non borné (éviction totale possible) | LRU 3000 entrées | fiabilité terrain | P2 |
| Sécurité SW | HTML/API privés en cache cross-comptes | liste blanche + purge + no-store | RGPD | P0-1 |
| Bug hub possession | « Section groupe incompatible » (rail) | filtre par nature | e2e débloqués | fix bd21984 |

### P0-4 livré via exports directs (pattern RSC prouvé)
Deux pièges documentés et résolus :
1. `next/dynamic` ssr:false invoqué via un **objet** local ou `React.lazy` +
   wrapper → rendu serveur du lazy → `Element type invalid: got undefined`
   (error boundary sur toutes les sections). **Reverté, re-testé par dichotomie.**
2. Pattern correct : composants dynamic **exportés directement** du module client
   (client references RSC, jamais exécutés côté serveur — même pattern que
   `MobileNavWrapper`/`BottomTabBar`). Les 17 vues chargent après hydratation,
   couvertes par un skeleton shimmer `aria-busy` (ux-mobile : jamais d'écran mort).
   Gain : 563 → 452 kB ; le plancher ≤ 210 kB exige P1-3 (framer-motion encore
   dans le graphe racine via MobileDrawer/SearchOverlay).

### Sécurité (bloquant lancement)
- **P0-1 (a8223667)** : fuite cross-comptes du SW fermée. Tests **SEC-1 : 3/3** (précache,
  visite authentifiée, purge + offline). `Cache-Control: private, no-store` sur routes authentifiées.
- **P0-5 (cbf681d6)** : `dangerouslyAllowSVG: false` + CSP images sandbox ; CSP
  `Report-Only` branchée sur `/api/telemetry/hub` ; **lint au build réactivé** (0 erreur,
  915 warnings à réduire règle par règle, TODO daté) ; **sameSite arbitré : NON changé**
  (WebView natif = origine distante, `lax` casserait l'auth — durcissement conditionnel
  documenté, requiert validation préprod iOS/Android).

### Ce qui n'a PAS bougé (et pourquoi)
- **First Load JS partagé (104 kB)** : les 5 consommateurs framer du graphe racine
  convertis en CSS pur — PageTransition, OfflineBanner, MobileDrawer, SearchOverlay
  et les **27 icônes animées** de LkvIcon (`AnimatedIconBase`, animations CSS
  `lkv-ia-*`, API ref/hover/reduced-motion préservée). **Mesure honnête** : le chunk
  framer-motion (1362, 130 kB raw) était déjà isolé — il passe de 76 à 75 routes
  /254 qui le chargent. L'hypothèse du rapport initial (« −40 kB sur le partagé via
  les icônes ») est **invalidée par la mesure** : le partagé reste à 104 kB.
- **Le plafond `/hub/[section]` ≤ 220 kB** exige de convertir framer-motion DANS les
  vues elles-mêmes (sheets, carrousels, expériences mobiles : ~75 routes le chargent
  encore). Chantier multi-fichiers identifié, chiffré, non livré — les icônes n'étaient
  pas le goulot.
- **P1-2 PPR** : **indisponible sur Next 15.5.25 stable** — `experimental.ppr`
  exige la dernière canary (« can only be enabled when using the latest canary
  version »). Le streaming P0-3 (premier octet 13-29 ms) couvre la Loi 1 en
  attendant une migration canary post-lancement.

## Vérifications (état final)
| Suite | Résultat |
|---|---|
| build (lint actif + types) | ✅ |
| vitest | **2756 passed / 0 failed** (27 skipped hermétiques) |
| test:visual | 82/83 stable (P0-3/P0-4) — le seul flaky restant est le contenu temps-réel `/communaute` (documenté) |
| test:a11y | **57/57** |
| test:e2e | **67 passed / 0 failed** (18 échecs pré-existants corrigés : dérives de libellés, strict-mode double-arbre, faux hors-ligne headless, submit canonique ; 3 tests gelés `fixme` documentés : timing hydratation du sélecteur d'aventure + focus clavier section Adventure) |
| SEC-1 (SW cross-comptes) | 3/3 |
| verify:invariants / icons | ✅ |
| Charge locale (P4) | `/` 128 req/s · `/explorer` 101 req/s · `/pays/fr` 93 req/s — p50 148-198 ms, p99 365-1137 ms, **0 erreur** (serveur Next local + Supabase distant, 20 conn × 8 s) |

## Charge & capacité (P4 — mesure locale 2026-09-16)
`node scripts/ops/p4_load_quick.mjs` → courbe de référence sur le serveur prod local
(base Supabase distante). Le test 3× pic en préprod reste requis avant ouverture
(le script `ops:a15-load` exige la stack Supabase locale, non démarrée ici).
Point de vigilance mesuré : `/explorer` p99 ≈ 1,1 s sous 20 connexions — surveiller
le pool PostgREST lors du test 3× (dashboard Supabase : connexions actives < 60 %).

## P2-2 — Audit RLS (artefacts livrés, non appliqués)
- `supabase/audit/rls_audit.sql` : audit lecture seule (policies `auth.uid()` nu,
  index des requêtes chaudes, `pg_stat_statements` top 20, tables sans RLS).
- La bascule `(select auth.uid())` + index manquants = **migration à valider sur
  copie** avant application (convention du dépôt) — procédure dans le fichier SQL.

## Restant (session suivante, ordre recommandé)
1. **Framer des vues chaudes → CSS** (~75 routes chargent encore le chunk 1362) :
   sheets (`PremiumBottomSheet`, `GlassSheet`), carrousels (`progressive-carousel`),
   expériences mobiles du hub — c'est LE chemin vers `/hub/[section]` ≤ 220 kB.
2. **P2-2** : appliquer la migration RLS/index après validation sur copie + EXPLAIN.
3. **P4** : test de charge 3× pic en préprod (`ops:a15-load` avec stack locale ou cible préprod).
4. **P1-2 PPR** : migration Next canary (planifiée post-lancement).
5. **A11y** : dette contraste du hub connecté (126 nodes color-contrast, badges 10px
   ratio 4.4:1) — chantier visuel dédié (le gel zéro-visuel du chantier perf l'exclut).

