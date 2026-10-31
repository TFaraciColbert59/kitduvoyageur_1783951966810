# Rapport final — nettoyage, refactoring et performance LKDV

**Date** : 31/10/2026 · **Branche de référence** : `origin/main` = `f89f5665961754e1dd5d37a55374169aac4dfedb`
**Environnement** : macOS arm64, Node 26.8.2, npm 11.19.1, Rust **absent**.
**Portée** : aucun commit sur `main`, aucune fusion, aucune mutation de production
ou de base de données.

## 1. État réel, sans arrondi

| Lot | Statut | Preuve principale |
|---|---|---|
| P00 — Bootstrap | **PASS** | worktree isolé, HEAD confirmé, PR #124 inspectée et non fusionnée |
| P01 — Baseline | **PASS partiel** | inventaire + typecheck + build + tests + bundle mesurés ; LCP/FPS/mobile **BLOCKED** |
| P02 — Bugs P0 | **PASS** | 4 incidents reproduits/corrigés, 40 tests, OOM prouvé avant |
| P03 — Nettoyage | **PASS partiel** | outillage + déduplication géo + scripts réparés ; dépendances et gros modules **non retirés** (décisions motivées) |
| P04 — SQL/réseau | **PASS (lecture seule)** | RPC et index profilés, aucune mutation ; RLS staging **BLOCKED** |
| P05 — Rust/WASM | **NO-GO** | TS mesuré 1,4 ms p50 / 3,1 ms p95 sur 100 k points ; toolchain Rust absente |
| P06 — Front/bundle | **PASS partiel** | bundle mesuré route par route ; aucune optimisation appliquée (validation visuelle indisponible) |
| P07 — Livraison | **PARTIEL** | 3 PRs en brouillon ; CI ne peut pas être verte (échecs préexistants prouvés sur `main`) |

## 2. Avant / après (mesuré)

| Mesure | Avant (`main` f89f5665) | Après (branches livrées) |
|---|---|---|
| `resampleTrack` sur un segment de 1 km, pas 60 m | **OOM, exit 134**, ~3 s | **16 points, < 1 ms** |
| `resampleTrack` sur 100 000 points | boucle non bornée | **p50 1,43 ms / p95 3,09 ms** (banc, 15 passes) |
| Web Worker géo | import direct dans le thread principal | `new Worker(new URL(...))` + protocole id/annulation/fallback |
| Clé du profil altimétrique | `length:premier-point` | FNV-1a sur le contenu complet + `stepM`/`demZoom` |
| GPS simulé en production | actif après 2,5 s sans fix | impossible en production (3 conditions cumulatives) |
| Implémentations du moteur géo | **3 copies** (worker, route API, banc) | **1** moteur partagé + 1 décodeur DEM |
| `npm ci` | **ÉCHEC** (lockfile désynchronisé) | **PASS** |
| Scripts `package.json` cassés | 3 | 0 |
| Tests des outils de nettoyage | 0 | 8 (`node:test`) |
| Bundle `/explorer` (First Load JS) | 156 kB | 156 kB (inchangé, objectif ≤ 170 kB tenu) |
| Bundle partagé | 105 kB | 105 kB |

## 3. PRs ouvertes (brouillon)

| PR | Branche | Contenu | CI observée |
|---|---|---|---|
| [#125](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/125) | `chore/lkdv-cleanup-perf-2026` | outillage audit/quarantaine, lockfile, scripts | `build` ✅, `lighthouse` ✅, `bundle-analysis` ✅, `build-ios` ✅ ; `quality-gates` ❌ (tests préexistants), `database-gates` ❌ (pgTAP préexistant), `perf-explorer` ❌ (mesure 600 s, réseau) |
| [#126](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/126) | `fix/explorer-geo-p0` (empile #125) | correction P0 géo + worker + GPS | `build` ✅, `lighthouse` ✅, `bundle-analysis` ✅, `build-ios` ✅ ; `quality-gates`/`database-gates`/`perf-explorer` ❌ préexistants |
| [#127](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/127) | `docs/lkdv-cleanup-baseline` (empile #126) | baseline, audit SQL, verdict Rust, banc, checklist, rapport | 1er run `build` ❌ (harnais de preuve en `.ts` hors périmètre) → corrigé, puis `build` ✅, `lighthouse` ✅, `bundle-analysis` ✅ |

Ordre de fusion : **#125 → #126 → #127**. Aucune fusion automatique n'est
effectuée : la décision revient au propriétaire du dépôt.

## 4. Preuves exécutées

```
node --test tests/cleanup/*.node-test.mjs                       → 8/8
npx vitest run <4 fichiers P0>                                  → 40/40
NODE_OPTIONS=--max-old-space-size=6144 npm run type-check       → exit 0
NODE_OPTIONS=--max-old-space-size=6144 npm run lint             → exit 0 (622 warnings préexistants)
npm run build (placeholders CI)                                 → ✓ Compiled in 3.0 min, exit 0, 58 pages
npm ci                                                          → exit 0 (après resynchronisation)
npm run explorer:bench:geo -- --runs=15                          → voir docs/cleanup/evidence/
npm run cleanup:audit                                           → 9 514 fichiers, 276,8 MiB, 0 script cassé
node /tmp/parity.mjs (ancien vs nouveau moteur)                 → 500 traces, 137 319 échantillons,
                                                                  0 divergence, écarts max 0 / 0
curl POST /api/explorer/v2/profile (next start local)           → HTTP 200 en 5,5 ms, 34 points
                                                                  monotones, DEM réel ; payloads
                                                                  invalides → HTTP 400
```

Preuves archivées : `docs/cleanup/evidence/` (OOM legacy, parité, smoke API,
banc, démonstration quarantaine).

### Suite complète `npm test` — baseline rouge, prouvée préexistante

`1139` fichiers : **13 059 tests passent**, 118 échouent (48 fichiers), 50
ignorés, 3 erreurs de démarrage de worker (machine saturée, `load average`
30–150). Les échecs sont concentrés sur des domaines **non touchés** :
`tests/design/compte-refonte-v*`, `tests/audit/*`, `tests/map/*`,
`src/features/compas/*`.

Preuve que ces échecs existaient avant ce chantier : les mêmes fichiers,
exécutés sur un worktree propre à `origin/main`, échouent à l'identique
(`tests/design/compte-refonte-v9`, `tests/audit/fix-round-1`,
`tests/map/leafletTiles`, `tests/design/unification`,
`src/features/compte/map/__tests__/camera` → **9 échecs / 38 succès**). De même,
`tests/audit/audit-scripts-static.spec.ts` échoue à l'identique sur `main` et
sur la branche. La CI `quality-gates` échoue d'ailleurs sur
`tests/design/unification.spec.ts` (3 tests), **sans lien avec ce chantier**.

## 5. Décisions prises seul (et ce qu'elles coûtent si elles sont fausses)

1. **Base de travail = `origin/main` (`f89f5665`)**, pas la branche locale
   `unified/latest` (100 commits non poussés). Coût si faux : le travail devra
   être rebasé sur la branche active.
2. **PR #124 reprise partiellement** : seul l'outil d'inventaire lecture seule
   est repris (avec son test), la roadmap n'est pas recopiée. Coût : doublon de
   documentation possible avec la PR #124.
3. **Aucun retrait de dépendance** malgré 14 candidats sans référence :
   tree-shaking déjà effectif, garde `rocketCritical`, E2E indisponible.
   Coût : `node_modules` reste plus gros que nécessaire.
4. **Aucune optimisation de bundle** (dynamic imports Hub/Compas) : sans recette
   visuelle, le risque de régression UX dépasse le gain. Coût : `/hub` reste à
   ~596 kB de First Load JS.
5. **Aucune migration SQL destructive** : les index doublons sont documentés
   avec migration + rollback, non appliqués. Coût : 2 index redondants restent.
6. **Profil altimétrique UI laissé côté serveur** : le worker est corrigé et
   testé mais non branché sur un écran (choix produit existant). Coût : le hook
   reste du code non utilisé en production.
7. **Worker géo non compté dans le bundle** : il est tree-shaké tant qu'aucun
   écran ne l'importe — constat honnête, pas un gain revendiqué.
8. **Simulation GPS derrière triple condition** (prod exclue, opt-in build,
   armement fixture) : en développement, elle est désormais inactive par défaut.
   Coût : les démos desktop sans GPS doivent poser les drapeaux explicitement.

## 6. Blocages (honnêtes)

| Blocage | Cause exacte | Contournement |
|---|---|---|
| CI non verte | 118 tests + pgTAP + `perf-explorer` échouent **déjà sur `main`** ; aucune modification de test autorisée pour les faire passer | PRs en brouillon, cause prouvée, correctifs hors périmètre |
| Rust/WASM non mesuré | `cargo`/`rustup`/`brew` absents ; `curl | bash` interdit | verdict fondé sur la mesure TS et le budget de frame |
| LCP/INP/FPS/mémoire mobile | aucune preview déployée, aucun appareil/simulateur | non mesuré, jamais inventé |
| RLS multi-comptes, plans `EXPLAIN ANALYZE` | pas de base de staging autorisée, production interdite | lecture seule (`pg_stat_statements`, catalogue) |
| E2E Playwright | base de test absente (`LKDV_E2E_ENABLED` non activé) | tests unitaires + build + smoke HTTP de la route profil |
| Workers Builds (Cloudflare) | job externe au dépôt, échoue aussi sur les autres branches | non exploitable comme signal de cette PR |

## 7. Production

**Aucun changement.** Aucun déploiement, aucune promotion, aucune migration,
aucun `git push` sur `main`, aucune écriture en base (toutes les requêtes SQL
étaient des `SELECT`).

## 8. Suite recommandée, par ordre de rentabilité

1. Faire passer `npm ci` + build sur `main` en fusionnant #125 (débloque toute la CI).
2. Traiter la dette de tests `design/*` et `audit/*` (118 échecs) : sans cela,
   aucune PR ne peut être « verte ».
3. Valider sur staging la suppression des index doublons `trips.slug` /
   `trips.share_token` (`docs/cleanup/SQL_AUDIT.md` §4).
4. Réduire le First Load JS de `/hub` et `/hub/[section]` (596/554 kB) avec une
   recette visuelle et une mesure Lighthouse avant/après.
5. Lot « dépendances » séparé, un paquet par commit, avec E2E.
6. Réévaluer Rust/WASM uniquement si un profil terrain montre > 16 ms de calcul
   géo (voir conditions de réouverture dans `RUST_VERDICT.md`).
