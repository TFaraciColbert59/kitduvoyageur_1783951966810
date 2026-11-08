# Preuves — recette Communauté v2 (`07-RECETTE.md`)

Règle : **aucune case n'est cochée sans preuve**. Statuts :

- **LOCALE** : commande rejouée dans ce worktree, sortie observée (colonne Preuve).
- **PRÊTE** : spec/commande écrite et comptée, exécution NON encore observée — à cocher après run.
- **CI/APERÇU** : prévue pour la CI ou l'aperçu migré ; pas exécutable dans ce worktree.
- **NON TESTABLE ICI** : impossible dans ce worktree, raison donnée (`00` § 4.8, J-08, absence iPhone).

Machine : `.env.local` = placeholders CI ; migrations **non appliquées** en prod
(`handoff/communaute-v2/JOURNAL.md` J-08 : `BACKUP_PASSPHRASE` absent, aucun
artefact `sauvegarde-base`). Le serveur de maquette est sur `:8765`, l'app v2 se
build avec `NEXT_PUBLIC_COMMUNAUTE_V2=true`.

## A. Aperçu Vercel (ou serveur local buildé v2 + données mockées)

| # | Case `07 § A` | Statut | Commande / spec / preuve |
|---|---|---|---|
| A1 | Explorer : chaque volet, filtre, menu de tri, détails empilés — captures 390×844 côte à côte maquette | PRÊTE | `node docs/audit/communaute-v2-2026-11-08/recette/capture-v2.mjs` → `captures-v2/` ; maquette dans `captures-maquette/` (58 PNG). E2E : `tests/e2e/communaute-v2-explorer.spec.ts` (1a–1e, 2a, 3a). |
| A2 | Création : chaque étape des 6 types, aperçu vivant — captures côte à côte | PARTIEL (PRÊTE) | `capture-v2.mjs` = étape 1 des 6 types + erreur/brouillon (harnais d'intégration) ; `tests/visual/communaute-v2-visual.spec.ts` = étapes 1 des 6 types, étape 2 Publication en erreur, confirmation. Étapes 2+ réelles (média/upload) non capturables ici : maquette `captures-maquette/*-e2|e3|e4.png` en référence, écarts à documenter dans le RAPPORT. |
| A3 | Gestes : ouverture, poignée (rubber-band/seuil), Échap, capsule, mini-capsule, glisser filtres, Peek, pile/Retour, menu de tri | PRÊTE | `tests/e2e/communaute-v2-explorer.spec.ts` : 1a (ouverture/capsule/clavier), 1c (Échap/focus), 1d (poignée), 1e (glisser 2 sens), 2b (Échap menu seul), 2d (Peek), 3a (pile + Retour). |
| A4 | Teintes : aucune couleur non verte hors danger (styles calculés) | PRÊTE | `npx vitest run tests/design/unification.spec.ts` (garde littéraux/teintes) + `npm run audit:contrast`. Les CSS v2 n'utilisent que des jetons (`tests/design/*`). |
| A5 | Formulaires : erreurs une seule fois, Retour/Suivant, brouillon, confirmation, clavier iPhone Safari | PARTIEL | Erreurs/étapes/brouillon/confirmation : `communaute-v2-creation.spec.ts` 6a–6d. **Clavier iPhone** : NON TESTABLE ICI (pas d'iPhone ; `visualViewport` ≠ clavier WKWebView) → § C. |
| A6 | Atomicité : réseau coupé au milieu d’une création de club/sortie → ni club sans admin, ni annonce sans sortie | NON TESTABLE ICI | Exige migrations appliquées + base de test (pgTAP CI `database-gates` : `supabase/tests/database/communaute_v2_creations.test.sql`). Pas de Postgres local sur cette machine. |
| A7 | Invité : lecture seule, `requireAuth` partout ailleurs | PRÊTE | `tests/e2e/communaute-v2-invite.spec.ts` (8a–8e). |
| A8 | 0 erreur console, 0 débordement 360/390/430, a11y sans critical/serious | PRÊTE | `communaute-v2-explorer.spec.ts` 1f + 9 ; `tests/a11y/e2e/communaute-v2-a11y.spec.ts` (0 critical/serious, `color-contrast` désactivé comme les autres scans, contraste mesuré par `audit:contrast`). |

## B. Production

| # | Case `07 § B` | Statut | Raison |
|---|---|---|---|
| B1 | Même liste qu’en A en prod, créations `only_me`/privées puis suppression | NON TESTABLE ICI | Prod non migrée : **J-08** (aucune sauvegarde disponible → aucune migration appliquée, `NEXT_PUBLIC_COMMUNAUTE_V2` non posé en prod). Sortie/club : jamais en prod (`00` § 4.8). |
| B2 | Recherche accents/fautes/ponctuation, RPC p95 < 300 ms | NON TESTABLE ICI | RPC non déployées (migrations non appliquées) ; le p95 vit dans les logs Supabase prod. Comportement UI prouvé sur mock (5a/5b) ; perfs SQL : `EXPLAIN` en CI/DB. |
| B3 | Compteurs justes après adhésion/inscription/like, état final = initial | NON TESTABLE ICI (prod) / PRÊTE (db) | Mock : compteur rendu vérifié (3b/2c). Réel : `tests/e2e/communaute-v2-db.spec.ts` (`LKDV_E2E_DB=test`) + pgTAP CI (compteurs). |
| B4 | Drapeau `false` testé sur un déploiement d’aperçu | PRÊTE | `tests/e2e/communaute-v2-flag.spec.ts` sur build `NEXT_PUBLIC_COMMUNAUTE_V2=false` (commande dans la spec). Aperçu : à faire par le Lead. |
| B5 | Non-régression : fil, stories, `/compte`, `/messagerie`, carnet, `/clubs/[id]`, onglet événements | NON TESTABLE ICI (base) | Les specs existantes (`carnet-v2`, `compte-drawer-v2`, visuels `community-*`) se sautent sans serveur/session/base. CI complète = preuve attendue. |
| B6 | 30 min de surveillance sans 5xx/CSP, advisors sans alerte | NON TESTABLE ICI | Exige le déploiement prod (J-08). |

## C. iPhone

| # | Case `07 § C` | Statut | Raison / commande |
|---|---|---|---|
| C1 | App installée via Xcode, ouverture des deux tiroirs | NON TESTABLE ICI | Pas d’iPhone/Xcode dans cette session ; coque Capacitor = site déployé (prod bloquée J-08). |
| C2 | Haptique (capsules, mini-capsules, tri, rejoindre, envoi) | NON TESTABLE ICI | Haptique réelle non simulable en navigateur. Codes posés (`haptic('selection'|'light'|'success')`) dans la coque. |
| C3 | Safe areas, clavier ne masque jamais pied/champ actif | NON TESTABLE ICI | `useKeyboardInsets` + `visualViewport` testés indirectement ; preuve = appareil. |
| C4 | Caméra/photothèque, géolocalisation, textes d’autorisation en français | NON TESTABLE ICI | Nécessite l’app installée. Textes `Info.plist` à vérifier par le Lead (`06` § 4.7). |
| C5 | Flow Maestro `.maestro/communaute.yaml` vert | PRÊTE | Flow écrit (lancement, Explorer, tri, détail club, Création › Story jusqu’à `only_me`, suppression). À exécuter sur appareil/simulateur. |

## Inventaire des tests ajoutés (comptage statique)

| Fichier | Tests | Projets | Rôle |
|---|---|---|---|
| `tests/e2e/communaute-v2.fixtures.ts` | — (harnais) | — | Mock réseau + session synthétique, données de `integration/fixtures.mjs` adaptées TS (`time` figé, état mutable) ; aucune spec. |
| `tests/e2e/communaute-v2-explorer.spec.ts` | 26 | `mobile-webkit`, `mobile-chromium` (`@mobile @ui-mock`) | 05 § 2 : 1, 2, 3, 4, 5, 7 (skip clavier iOS), 9. |
| `tests/e2e/communaute-v2-creation.spec.ts` | 6 | idem | 05 § 2 : 6 (UI mock : étapes, erreurs une fois, brouillon, confirmation, publication simulée). |
| `tests/e2e/communaute-v2-invite.spec.ts` | 5 | idem | 05 § 2 : 8 (invité/`requireAuth`). |
| `tests/e2e/communaute-v2-flag.spec.ts` | 3 | idem | 05 § 2 : 11 (build `NEXT_PUBLIC_COMMUNAUTE_V2=false`). |
| `tests/e2e/communaute-v2-db.spec.ts` | 6 | `mobile-chromium` | 05 § 2 : 6 et 10 sur base de test migrée (`LKDV_E2E_DB=test`) ; **sautés ici**. |
| `tests/a11y/e2e/communaute-v2-a11y.spec.ts` | 4 | `iphone-14-pro` (axe) | Deux tiroirs ouverts, détails, menu, Peek, 6 types, erreurs, confirmation. |
| `tests/visual/communaute-v2-visual.spec.ts` | 4 | `iphone-14-pro-chromium` | 390×844 : volets, tri, détails, recherche, Peek, états, 6 types, erreurs. |

Repères : les scénarios **clavier iOS** (05 § 2.7) et **prod** (07 § B) ne sont
pas testables ici et sont marqués comme tels ci-dessus ; aucune spec ne les
simule faussement. Le drapeau est figé au build : `communaute-v2-flag.spec.ts`
exige un build `false` séparé (`LKDV_E2E_V2_FLAG=false`).

## Vérifications d’exécution (à remplir après run)

| Vérification | Statut | Preuve (sortie exacte) |
|---|---|---|
| `npx tsc --noEmit -p .` | À FAIRE | — |
| Comptage Playwright e2e `communaute-v2*` (aucun « No tests found ») | À FAIRE | — |
| axe `communaute-v2-a11y` (0 critical/serious) | À FAIRE | — |
| Visuel 390×844 (références générées) | À FAIRE | — |
| Captures `capture-v2.mjs` | À FAIRE | — |

Commandes exactes prévues (build v2 + serveur 4028) :

```bash
# e2e (comptage + exécution)
PW_BASE_URL=http://127.0.0.1:4028 npx playwright test \
  --config=docs/audit/communaute-v2-2026-11-08/recette/playwright.communaute-v2.config.ts \
  --project=mobile-webkit --project=mobile-chromium
# a11y
PW_BASE_URL=http://127.0.0.1:4028 npx playwright test tests/a11y/e2e/communaute-v2-a11y.spec.ts \
  --config=playwright.a11y.config.ts --project=iphone-14-pro
# visuel (références)
PW_BASE_URL=http://127.0.0.1:4028 npx playwright test tests/visual/communaute-v2-visual.spec.ts \
  --config=playwright.visual.config.ts --project=iphone-14-pro-chromium --update-snapshots
# captures de recette
node docs/audit/communaute-v2-2026-11-08/recette/capture-v2.mjs
```
