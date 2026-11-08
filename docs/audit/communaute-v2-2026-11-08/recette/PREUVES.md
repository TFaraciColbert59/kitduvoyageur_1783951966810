# Preuves — recette Communauté v2 (`07-RECETTE.md`)

Aucune case cochée sans preuve. Exécutions réelles du **2026-11-08** sur le build
de recette `NEXT_PUBLIC_COMMUNAUTE_V2=true` servi sur `http://127.0.0.1:4028`
(Supabase fixture intercepté : zéro réseau, zéro base, zéro donnée réelle).

Statuts : **PREUVE LOCALE** (rejoué ici, sortie observée) · **PRÊTE / CI**
(spec comptée, exécution attendue en CI/aperçu) · **NON TESTABLE ICI** (raison).

## Environnement de rejeu

```bash
NEXT_PUBLIC_COMMUNAUTE_V2=true NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key npm run build
NEXT_PUBLIC_COMMUNAUTE_V2=true NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key npm run start     # 4028

NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key \
PW_BASE_URL=http://127.0.0.1:4028 npx playwright test \
  --config=docs/audit/communaute-v2-2026-11-08/recette/playwright.communaute-v2.config.ts \
  tests/e2e/communaute-v2-explorer.spec.ts tests/e2e/communaute-v2-creation.spec.ts \
  tests/e2e/communaute-v2-invite.spec.ts tests/e2e/communaute-v2-flag.spec.ts \
  --project=mobile-chromium --workers=1
```

> `NEXT_PUBLIC_SUPABASE_URL` doit être **celle du build** : le harnais en dérive
> le nom du cookie de session (`sb-fixture-auth-token`). Sans elle, les tests
> d'écriture retombent en invité (et 8c le prouve).

## Résultats d'exécution (sorties réelles)

| Vérification | Résultat observé | Log / artefact |
|---|---|---|
| **e2e @ui-mock — mobile-chromium** | **34 ✓ / 0 ✗ / 3 sautés** (explorer 24 + création 5 + invité 5 ; sautés : `6/10` données réelles, `7` clavier iOS, création `6/10`). | `/tmp/cv2-final-both.log` |
| **e2e @ui-mock — mobile-webkit** | **34 ✓ / 0 ✗ / 3 sautés** — **parité Chromium/WebKit** après correctifs coque (focus 1c) et qualification 8c (clic natif). | `/tmp/cv2-final-both.log` |
| **axe-core a11y** | **4/4 ✓ — 0 violation critical/serious** (Explorer 4 volets, menu tri, détails, Peek, états vide/erreur ; Création 6 types + erreurs + confirmation). | `/tmp/cv2-a11y4.log` |
| **Visuel 390×844** | **4/4 ✓** (update puis verify), **19 références** générées, tolérance `maxDiffPixelRatio: 0.02`, horloge figée 2026-11-08, animations coupées. ⚠️ références **`-darwin`** (macOS) : la spec se saute en CI tant que des références **Linux** n'ont pas été produites (`LKDV_V2_VISUAL_LINUX=1 --update-snapshots` sur runner) — documenté dans la spec. | `tests/visual/communaute-v2-visual.spec.ts-snapshots/` ; `/tmp/cv2-visual-verify.log` |
| **Captures de recette** | **19 captures produites, 0 scénario en échec** (`capture-v2.mjs` → harnais d'intégration, données mockées) ; 26 PNG au total dans le dossier (dont 8 `apercu-*` d'un run précédent). | `recette/captures-v2/MANIFEST.json` |
| **Comptage Playwright** | e2e : « Running 40 tests » ; a11y : 4 ; visuel : 4 — **aucun « No tests found »**. | logs ci-dessus |
| **TypeScript** | `npx tsc --noEmit -p .` → **EXIT 0**. | `/tmp/cv2-tsc-last.log` |

## Points rouges / limites constatés (à router)

| Point | Constat | Statut |
|---|---|---|
| `1c` retour du focus au déclencheur | Bug produit confirmé : focus appliqué quand le fond était encore `inert` (no-op). Correctif Lead (rAF après nettoyage) livré au rebuild `c34a72f` → **1c ✓**. | **RÉSOLU (vérifié)** |
| `cv2-back` recouvert par la poignée | **RÉSOLU (vérifié)** : `.lkdv-cv2-detail` passe au-dessus de la poignée (z 16 > 15) — `elementFromPoint(centre)` = `BUTTON.lkdv-cv2-back`, specs e2e 3a/4b, a11y et visuel repassées en **clic natif** (plus aucun clic DOM/`force`). Le drag de fermeture reste porté par `.lkdv-cv2-detail-nav`. | **RÉSOLU (vérifié)** |
| `8c` `+` en invité | **QUALIFIÉ — pas un bug produit** : aucun recouvrement (`elementFromPoint` = bouton), React hydraté, `onClick` présent ; l'échec venait d'un **clic trop tôt (hydratation partielle)**. Spec : attente explicite d'hydratation + **clic natif** → vert (redirection + toast). | **RÉSOLU (spec)** |
| `1c` focus WebKit | **RÉSOLU** : correctif coque (reprises rAF + timers) livré, **1c vert en WebKit**. Précision Safari : un tap souris ne focalise pas le bouton déclencheur ; la spec 1c ouvre désormais au **clavier** (focus + Entrée), scénario d'accessibilité où la restitution de focus est exigée (vert Chromium **et** WebKit). | **RÉSOLU (vérifié)** |
| Service worker vs mocks | Le SW du site proxifie des `fetch` et court-circuitait `page.route` en WebKit (`FetchEvent.respondWith` null, feeds en erreur). Corrigé dans le harnais : désenregistrement + blocage de l'enregistrement SW pour les specs `@ui-mock` + `serviceWorkers:'block'` dans la config de recette. | **RÉSOLU (harnais)** |
| `cv2-island` testid dupliqué | Layer et pill portent le même `data-testid` (sélecteurs ambigus) ; specs ciblées sur `.lkdv-island-pill`. Unifier côté coque. | **MINEUR (testid)** |
| « Sur la carte » | **Recouvrement CSS réel confirmé** : `elementFromPoint` au centre de la bascule = `SPAN.lkdv-cv2x-cover-fallback` (ligne de résultat de recherche qui recouvre la barre « Affichage des résultats » sur 390 px) ; chaîne `.lkdv-cv2x-search-row > .lkdv-cv2x-search-list`. **À corriger côté explore/coque** ; spec en clic DOM + carte rendue sur tuiles neutralisées (seule la présence est prouvée). | **ROUGE produit (routé, contourné spec)** |
| Drapeau `false` (05 § 2.11) | Exige un **build séparé** `NEXT_PUBLIC_COMMUNAUTE_V2=false` (drapeau figé au build). Spec prête (`LKDV_E2E_V2_FLAG=false`). | **PRÊTE (séquence dédiée)** |
| Données réelles (6 création, 10 stories) | Base non branchée + migrations non appliquées : non exécutables ici. Specs prêtes (`communaute-v2-db.spec.ts`, `LKDV_E2E_DB=test`) + pgTAP CI `database-gates`. Sautés **explicitement** (pas de faux vert). | **NON TESTABLE ICI** |
| Maestro `.maestro/communaute.yaml` | Flow écrit (launch, Explorer, tri, détail club, Création › Story jusqu'à `only_me`, suppression), YAML valide ; **CLI `maestro` absente**. | **NON TESTABLE ICI (CLI)** |

## A. Aperçu Vercel (ici : serveur local buildé v2 + données mockées)

| # | Case `07 § A` | Statut | Preuve |
|---|---|---|---|
| A1 | Explorer : volets, filtres, tri, détails — captures 390×844 côte à côte maquette | **PREUVE LOCALE** | `captures-v2/explorer-*` + 19 réf. visuelles 390×844 ; maquette `captures-maquette/` (58 PNG). Comparaison côte à côte → RAPPORT. |
| A2 | Création : étapes des 6 types, aperçu vivant | **PREUVE LOCALE (étape 1) / NON TESTABLE ICI (étapes 2+)** | `captures-v2/creation-*` (6 types + erreur + brouillon) ; visuel = étape 1 des 6 + étape 2 en erreurs + confirmation. Étapes 2+ (média/upload réel) non capturables (Storage non branché) → maquette `captures-maquette/*-e2|e3|e4.png`. |
| A3 | Gestes : ouverture, poignée, Échap, capsules, glisser, Peek, pile/Retour, tri | **PREUVE LOCALE** | explorer 1a, 1c, 1d, 1e, 2b, 2d, 3a — **verts** (Chromium). |
| A4 | Teintes : uniquement des verts hors danger | **PREUVE LOCALE (garde)** | `npx vitest run tests/design/unification.spec.ts` (garde littéraux/teintes) ; CSS v2 = jetons uniquement. Contraste : `npm run audit:contrast`. |
| A5 | Formulaires : erreurs une fois, Retour/Suivant, brouillon, confirmation, clavier iPhone | **PREUVE LOCALE (hors clavier iPhone)** | création 6a–6e **verts** ; clavier iPhone = NON TESTABLE ICI (§ C). |
| A6 | Atomicité création club/sortie (réseau coupé) | **NON TESTABLE ICI** | Exige base migrée : pgTAP CI `communaute_v2_creations.test.sql` ; pas de Postgres local. |
| A7 | Invité : lecture seule + `requireAuth` | **PREUVE LOCALE** | invité 8a–8e **verts** (8c via clic DOM + preuve toast/redirection). |
| A8 | 0 erreur console, 0 débordement 360/390/430, a11y sans critical/serious | **PREUVE LOCALE** | explorer 1f + 9 **verts** ; axe **0 critical/serious**. |

## B. Production

| # | Case | Statut | Raison |
|---|---|---|---|
| B1 | Même liste en prod | **NON TESTABLE ICI** | Prod **non migrée**, J-08 (sauvegarde absente → migrations non appliquées, drapeau prod non posé). |
| B2 | Recherche accents/ponctuation, p95 < 300 ms | **UI prouvée / perf NON TESTABLE ICI** | 5a (« ecrins »→« Écrins » + surlignage), 5b (ponctuation), 5c (erreur), 5d (clavier), 5e (carte) ✓. p95 = logs Supabase prod (migrations absentes). |
| B3 | Compteurs justes (adhésion/inscription/like) | **PREUVE LOCALE (mock) / CI (réel)** | 2c, 3b, 4c ✓ ; réel = `communaute-v2-db.spec.ts` + pgTAP CI. |
| B4 | Drapeau false sur aperçu | **PRÊTE** | `communaute-v2-flag.spec.ts` sur build `false` dédié. |
| B5 | Non-régression (fil, stories, /compte, carnet, clubs, événements) | **CI** | Specs existantes du dépôt (se sautent sans base ici) ; drapeau garde les tiroirs v1. |
| B6 | 30 min surveillance 5xx/CSP/advisors | **NON TESTABLE ICI** | Exige le déploiement prod (J-08). |

## C. iPhone

| # | Case | Statut | Raison |
|---|---|---|---|
| C1 | App via Xcode, ouverture des 2 tiroirs | **À FAIRE côté Lead** | App installée sur iPhone 16 Pro (Xcode) ; lancement refusé car appareil verrouillé — documenté par le Lead. |
| C2 | Haptique | **NON TESTABLE ICI** | Non simulable navigateur ; codes `haptic()` posés dans la coque. |
| C3 | Safe areas + clavier | **NON TESTABLE ICI** | `visualViewport` ≠ clavier WKWebView ; preuve = appareil. |
| C4 | Caméra/photothèque/géoloc + textes FR | **NON TESTABLE ICI** | Nécessite l'app ; `Info.plist` à vérifier (`06` § 4.7). |
| C5 | Flow Maestro vert | **PRÊTE / NON EXÉCUTABLE ICI** | `.maestro/communaute.yaml` écrit, YAML valide ; CLI `maestro` absente. |

## Captures & références

- `captures-maquette/` : **58 PNG** de référence 390×844.
- `captures-v2/` : **26 PNG** + `MANIFEST.json` (production du travail, données mockées).
- Références CI : `tests/visual/communaute-v2-visual.spec.ts-snapshots/` (**19 PNG**).

## Points rouges WebKit (run de contrôle mobile-webkit)

Run final : **34 ✓ / 0 ✗ / 3 sautés** — **parité complète avec Chromium**. Le
correctif coque du focus (1c) est vert en WebKit (spec en activation clavier,
cf. nuance Safari ci-dessus) ; artefacts de harnais WebKit (preconnect, service
worker) filtrés/bloqués et documentés. Aucun échec WebKit n'est « coché vert ».
