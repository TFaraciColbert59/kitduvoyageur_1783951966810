# VERIFY_LAST · Explorer v2

- Exécuté : 2026-10-28 15:00–15:20 (Europe/Paris)
- Commande : `node scripts/explorer-v2/verify-all.mjs` (ou `npm run explorer:verify`)
- Mode : courant (pas `--final`)

## Résultats mesurés

| # | Étape | Code | Durée | Détail |
|---|---|---|---|---|
| 1 | `npx tsc --noEmit` | 0 | 9,5 s | aucune erreur |
| 2 | `npx next lint` | 0 | 3,5 s | warnings préexistants uniquement |
| 3 | `npx vitest run explorer-v2` | 0 | 2,5 s | **14/14 verts** |
| 4 | `npx next build` | 0 | 278,8 s | `ƒ /explorer 20.4 kB 141 kB` (budget 170 Ko) |
| 5 | Playwright `@explorer-v2` (chromium + webkit) | 0 | 29 s + 27 s | **20/20 verts** (10 tests × 2 projets) |
| 6 | Inventaire de clics | ⏭ | — | réservé à `--final` (mesure longue) |
| 7 | axe (a11y) | 0 | — | dernier test Playwright : aucune violation sérieuse |
| 8 | Greps bloquants | 0 | — | E4501C, TODO/mock, SERVICE_ROLE, projet fantôme, compas : propres |
| 9 | Intrusion RLS | 0 | 4 s | **11/11 contrôles verts** (`docs/explorer-v2/RLS_INTRUSION.md`) |
| 10 | Checklist | — | — | affichée sans échec (non bloquante hors `--final`) |

## Corrections apportées au script pendant la recette

1. Build de recette : `EXPLORER_V2_E2E=1` + `NEXT_PUBLIC_EXPLORER_SCENES=1` sont
   passés au `next build` (sinon les scènes `?scene=` ne sont pas embarquées et
   les tests navigateur échouent).
2. **Serveur neuf après le build** : `startFreshServer()` tue l'ancien
   `next-server` et relance `npm run start` sur le build courant. Sans cela, le
   serveur servait des chunks périmés (écrans vides) et les tests expiraient.
3. Playwright lancé par le binaire local (`node_modules/.bin/playwright`) avec
   `stdio: 'inherit'` : `npx` + sortie pipée ne rendait pas la main dans cet
   environnement, et `CI=1` figeait le lanceur.
4. Étape a11y : elle visait `tests/explorer-v2/a11y.spec.ts` (inexistant) ;
   elle exécute désormais le test `a11y` de la suite principale.

## Limites connues

1. `click-inventory.mjs` mesure ~38 % de couverture : il compte aussi des
   boutons décoratifs (poignée, mini-sélecteur inactif) et le comptage dépend
   du dernier `.xp-root` monté. À fiabiliser avant d'en faire une gate.
2. `--final` (checklist à 100 % + budget de bundle strict) reste rouge : 61
   cases de `07_CHECKLIST.md` ne sont pas faites (voir `ETAT_DES_POINTS.md`).
