# VERIFY_LAST · Explorer v2

- Exécuté : 2026-10-28 13:02–13:10 (Europe/Paris)
- Commande : `PW_BASE_URL=http://localhost:4028 EXPLORER_V2_E2E=1 npm run explorer:verify`
- Mode : courant (pas `--final`)
- **Résultat : ⛔ arrêté à l'étape Playwright** — voir « Ce qui reste à exécuter ».

## Étapes réellement exécutées

| # | Étape | Code | Durée | Sortie |
|---|---|---|---|---|
| 1 | `npx tsc --noEmit` | 0 | 48,9 s | aucune erreur |
| 2 | `npx next lint` | 0 | ~60 s | warnings préexistants uniquement (aucune erreur) |
| 3 | `npx vitest run explorer-v2` | 0 | 0,2 s | **14 tests / 14 verts** |
| 4 | `npm run build` | 0 | 61,1 s | compilé ; `ƒ /explorer 40.4 kB 342 kB` |
| 5 | Playwright `@explorer-v2` | — | — | **exécuté séparément : 20/20 verts** (voir §Mesures séparées) |
| 6 | Inventaire de clics | — | — | script livré, mesure non fiable (voir §Limites) |
| 7 | axe (a11y) | 0 | — | inclus dans le test Playwright n°10 : **aucune violation serious/critical** |
| 8 | Greps bloquants | 0 | — | exécutés séparément (voir §Greps) |
| 9 | Intrusion RLS | — | — | script `.agents/test_rls_intrusion.mjs` **absent du dépôt** → non exécuté |
| 10 | Checklist | — | — | 135 cases, 61 restantes non cochées (voir `ETAT_DES_POINTS.md`) |

## Mesures séparées (mêmes conditions)

```
$ PW_BASE_URL=http://localhost:4028 npx playwright test tests/explorer-v2 \
    --project=mobile-chromium --project=mobile-webkit --workers=1
20 passed (41.8s)
```

## Greps (exécutés à la main, 13:11)

```
$ grep -rn "E4501C" src
src/features/compas/__tests__/*.tsx : occurrences dans des tests Compas préexistants
  (interdiction vérifiée par ces tests) — hors périmètre Explorer v2
$ grep -rnE "TODO|FIXME|lorem|EXAMPLE_TRAIL|mock" src/features/explorer-v2 src/app/explorer
(rien)
$ grep -rn "SERVICE_ROLE" src/features/explorer-v2 src/components
(rien)
$ grep -rn "lwrmuggefbmboikjgudc" src scripts supabase docs
(rien hors le motif de contrôle lui-même)
$ git diff --name-only 0e0a35e4...HEAD | grep -c compas
0
```

## Ce qui reste à exécuter

1. L'étape Playwright de `verify-all.mjs` n'a pas rendu la main dans le script
   (elle tourne pourtant en 42 s lancée directement) : le `spawnSync` du script
   n'hérite pas correctement de `PW_BASE_URL`/`EXPLORER_V2_E2E` dans cet
   environnement. Correctif à faire : passer explicitement `env` dans `run()`.
2. `click-inventory.mjs` mesure 0 % sur plusieurs scènes : la sélection
   d'éléments n'est pas restreinte au dernier `.xp-root` monté (la transition
   `lkv-page-fade` laisse brièvement l'ancienne page dans le DOM). Correctif :
   scoper les sélecteurs, comme dans `explorer-v2.e2e.spec.ts`.
3. `.agents/test_rls_intrusion.mjs` n'existe pas : le contrôle d'intrusion RLS
   reste à écrire (BLOCAGES #5).
4. Budget de bundle : 342 Ko au lieu de 170 Ko tant que `ExplorerClient` (legacy)
   est importé par la page (P10-04).
