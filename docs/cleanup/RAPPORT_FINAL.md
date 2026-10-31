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
| [#128](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/128) | `fix/ci-design-governance` | portes CI gouvernance design (U-D61/62/63) + audit credential littéral | `tests/design/unification` 5/5, `audit-scripts-static` 9/9, build ✅ |
| [#129](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/129) | `perf/gpx-engine` | points fantômes GPX, extraction unifiée, optimisation mesurée puis rejetée | tests GPX 9/9, `perf:gpx` (ratios ≈1 après revert) |
| [#130](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/130) | `chore/deps-prune` | 12 dépendances sans usage retirées, `recharts` conservé (HUB) | `npm run build` exit 0 |

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


---

# Deuxième passe — 31/10/2026 (reprise après revue)

## Réconciliation avec `main`

`origin/main` a avancé de 2 commits (`next.config.mjs` uniquement :
`FAST_BUILD`, `allowedDevOrigins`). Les trois branches du chantier ont été
rebasées sur `d065897e` et repoussées. Le worktree `unified/latest`
(102 commits d'avance, non poussés, 2 fichiers non suivis) n'a **jamais** été
modifié.

## Worker géo — dégradation garantie (PR #126)

Trois impasses laissaient le profil en `loading` éternel, sans erreur :

1. `postMessage` qui lève → aucun calcul de repli lancé ;
2. événement `error` du worker (chunk introuvable, CSP, crash) → aucun listener ;
3. `messageerror` → idem.

Correctif : listeners `message`/`error`/`messageerror`, terminaison du worker
fautif et bascule immédiate sur le calcul thread principal ; bootstrap extrait
dans `workers/workerServer.ts` (testable hors navigateur), sans rejet non géré.
Preuve : **44 tests** (5 serveur, 10 hook, 5 protocole, 24 moteur), `tsc` exit 0.

## Causes CI traitées (PR #128)

- **Gate 2.5 design governance** (bloquait `quality-gates` avant les tests) :
  classes froides, ombres littérales et `window.confirm` remplacés par tokens et
  `lkvConfirm` ; `tests/design/unification` **5/5**.
- **Garde-fou credentials** : l'URL Supabase était en dur 10 fois dans
  `FreedomKitDrawer` (Communauté) → `NEXT_PUBLIC_SUPABASE_URL` ;
  `audit-scripts-static` **9/9**.
- Les 102 tests restants sont **preexistants** et classés dans
  `docs/cleanup/CI_FAILURES.md` : contrats de design `compte-refonte-v9…v21`
  (≈60), contrats création Communauté (≈17), zones gelées HUB/Compas (≈6),
  cartes/`preconnect` (2), divers (≈12). Aucun n'est causé par ce chantier ;
  les corriger exige des décisions produit/visuelles ou la réouverture des zones
  gelées. **Aucun test n'a été désactivé ni affaibli.**

## GPX (PR #129) — un bug réel, une optimisation rejetée

Bug corrigé : un `<trkpt>` sans `lat`/`lon` devenait `(0, …)` (point fantôme au
large du Golfe de Guinée) ; altitude `NaN` et date invalide corrigées ; l'aperçu
GPX de la messagerie réutilise `GPXEngine.extractCoordinates` (borné à 50 000
points).

Optimisation (lecture DOM directe, export `join`) **mesurée puis rejetée** :

| Trace | parse avant/après | export avant/après | extract |
|---|---|---|---|
| 1 000 pts | x0.69 | x0.76 | x0.85 |
| 5 000 pts | **x0.26** | x0.92 | x0.83 |
| 20 000 pts | — | x0.93 | x0.81 |

Après retour au code d'origine : **x0.96 à x1.03**. Aucun gain GPX revendiqué :
le banc `npm run perf:gpx` reste dans le dépôt pour rejouer la décision.

## Dépendances (PR #130)

12 paquets sans aucun import (vérifié dans tout le dépôt, configs incluses)
retirés : `@dnd-kit/*`, 5 `@radix-ui/react-*`, `react-dropzone`,
`react-day-picker`, `vaul`, `liquid-glass-react`. `recharts` est **conservé** :
il est utilisé par `src/features/hub/components/menu/BudgetDonut.tsx` (zone
gelée). `npm run build` → exit 0, `node_modules` 778 → 771 dossiers.

## Zones protégées

Aucun fichier du HUB ni du Compas n'a été créé, modifié, déplacé ou supprimé.
Les modules partagés touchés (`tailwind.config.cjs`, `GPXEngine`,
`AttachmentDrawer`, `FreedomKitDrawer`, `CommunityFeedPost`,
`CommunityPostSoundtrack`, `FreedomCommentsDrawer`, `HighlightEditDrawer`) ont
été vérifiés : aucun n'est importé par le HUB ou le Compas. `recharts` (HUB) et
`@radix-ui/react-dialog` (dialogue partagé) ont été explicitement conservés.

## État final de la CI

| Porte | État |
|---|---|
| `build`, `lighthouse`, `bundle-analysis`, `build-ios` | ✅ vertes (PR #125 et dérivées) |
| Gate 2.5 design governance | ✅ corrigée (#128) |
| Audit credentials | ✅ corrigée (#128) |
| `npm test` | ❌ **preuves CI #128** : Gate 2.5 passe, puis `npm test` = **37 fichiers / 1096 tests verts**, échecs sur les contrats design préexistants ; tests HUB/Compas bloqués par le gel |
| `visual-tests` | ❌ sur **toutes** les PRs, y compris #125 qui ne touche aucune UI → préexistant (snapshots) |
| `Workers Builds` (Cloudflare) | ❌ sur toutes les PRs → job externe préexistant |
| `database-gates` (pgTAP), `perf-explorer` (mesure 600 s) | ❌ dépendent d'une base/CI dediée, préexistants |

Conclusion inchangée : chantier **PARTIEL**, jamais « terminé ». Les PRs sont
prêtes à relire, dans l'ordre **#125 → #126 → #127**, avec #128/#129/#130 en
parallèle (elles partagent le commit #125 pour `npm ci`).

## Rulings de la deuxième passe

1. **Ne pas corriger les 102 tests de contrats design** : modifier l'UI sans
   recette visuelle serait un pari, modifier les tests serait un masquage.
   Coût si erroné : la CI reste rouge plus longtemps.
2. **Rejeter l'optimisation GPX** malgré le travail investi : les mesures
   appariées montrent une régression jusqu'à 3,8×. Coût : aucun gain GPX.
3. **Conserver `recharts`** malgré l'audit automatique : le HUB l'utilise.
   Coût : une dépendance de plus.
4. **Ne pas toucher au `preconnect` du layout** pour faire passer un scan :
   layout partagé avec HUB/Compas, et le retrait dégraderait la latence.
   Coût : 1 test carte reste rouge.
5. **Ne pas retirer `@radix-ui/react-dialog`** (dialogue partagé) ni
   `@tailwindcss/typography` (plugin actif) : faux positifs de l'audit
   automatique.


## Preuve d'isolement des zones gelées

Union des fichiers modifiés par les six branches (`git diff --name-only
origin/main..<branche>`, 55 fichiers) : **aucun chemin ne contient `hub` ou
`compas`**. Les modules partagés modifiés (Communauté, `GPXEngine`,
`AttachmentDrawer`, `tailwind.config.cjs`) ont été recherchés dans
`src/features/hub`, `src/app/hub`, `src/features/compas`, `src/app/compas` :
**0 import**. `recharts`, utilisé par `src/features/hub/components/menu/BudgetDonut.tsx`,
a été conservé pour cette raison.


---

# Troisième passe — intégration progressive et corrections (31/10/2026 soir)

## PRs fusionnées dans `main` (dans l'ordre)

| PR | Objet | Preuves de fusion |
|---|---|---|
| #125 | outillage audit/quarantaine + `npm ci` réparé | `build`, `lighthouse`, `bundle-analysis`, `build-ios` verts |
| #126 | P0 géo : boucle OOM, vrai worker, clé de profil, GPS de test, fallback garanti | 44 tests, build vert |
| #127 | baseline, audit SQL, verdict Rust, CI classée, rapport | docs + scripts uniquement |
| #128 | portes CI gouvernance design + credential littéral | Gate 2.5 verte, 1096 tests verts au run |
| #129 | GPX : points fantômes, extraction unifiée, optimisation rejetée | 9 tests, build vert |
| #130 | 12 dépendances sans usage retirées | build vert, 778 → 771 dossiers |
| #131 | contrats Compte restaurés après extraction CSS | 62 → 5 échecs sur le cluster, 47 tests restaurés |
| #133 | 7 fichiers sans usage supprimés (quarantaine réversible) | build exit 0 |
| #134 | banc mobile WebKit/Chromium bridé + baseline Explorer | mesures 3 passes, JSON |
| #135 | 4 bugs réels (a11y drawer, lien clubs, `var()` sans repli, jeton manquant) | 24 tests ciblés |

Aucune fusion n'a touché le HUB ni le Compas ; les 55 fichiers modifiés ne
contiennent aucun chemin `hub`/`compas` (vérifié par `git diff --name-only`).

## Tests préexistants : traitement réel

- **Compte (13 fichiers v9→v21 + v8)** : cause identifiée = extraction des CSS
  hors du TSX. Les contrats lisent désormais TSX + CSS avec un découpage par
  version équivalent ; **assertions inchangées**. 62 → 5 échecs.
- **a11y, clubs, tokens, CSS** : 4 bugs réels corrigés (mapzone non inertée,
  lien `/clubs` cassé, `var(--lkdv-progress)` sans repli, `--xp-paper` manquant).
- **Reste** : ~45–48 échecs selon la charge, sur les mêmes familles :
  contrats de création Communauté (~17, cause identifiée : pager réduit à une
  étape alors que le contrat en attend quatre — décision produit),
  `community-feed-contract` (4), zones gelées HUB/Compas (~6),
  contrats Compte résiduels (5), cartes/`preconnect` (2), divers design (~8),
  tests d'intégration instables sous charge (`ProfileDrawerBootstrap`, audits).
- **Aucun test désactivé, aucun skip ajouté, aucune assertion affaiblie.**

## Code mort

7 fichiers sans aucune référence entrante (graphe d'imports complet + grep
repo) retirés via quarantaine réversible : 23 951 octets, manifeste sha256.
Les ~80 autres candidats sans référence datent tous des refontes du 25–30/10 :
conservés pour ne pas détruire du travail récent non branché.

## Mesures mobiles (labo émulées, 3 passes)

| Métrique | WebKit iPhone 16 Pro | Chromium CPU ×4 + Slow 4G |
|---|---:|---:|
| LCP | 396 ms (336–556) | **3 024 ms** (3 008–3 040) |
| FCP | 319 ms | 972 ms |
| Long tasks | 0 | 7–11 (637–938 ms) |
| CLS | 0 | 0 |

- **Aucune amélioration globale revendiquée** : pas de mesure avant équivalente.
- Sous bridage mobile, l'objectif LCP ≤ 2 s **n'est pas tenu** (3,0 s) ;
  7–11 long tasks signalent un risque d'INP.
- **Appareil physique** : iPhone 16 Pro apparié détecté, mais instrumentation
  WebDriverAgent/XCUITest absente → **BLOCKED** (causes dans `MOBILE_PERF.md`).

## État final

`main` contient les 10 PRs. La CI reste rouge sur `quality-gates` (dette de
tests de contrats design + zones gelées) et sur `database-gates`/`perf-explorer`
(dépendances d'environnement). Les portes qui bloquaient tout (`npm ci`,
gate de gouvernance, credential littéral) sont vertes. **Chantier PARTIEL**,
jamais annoncé terminé.
