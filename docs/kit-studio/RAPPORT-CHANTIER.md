# Rapport de chantier — Kit Studio (P0 → P6)

Branche de travail : `chantier/kit-studio-finition`
Commit de base : `fb4f1a6` (arbre de code identique à `21a4b11` du bundle, à trois fichiers de documentation près)
Bundle de référence : `kit-studio-bundle/` version du 7 novembre 2026
Agent : DeepSeek Harness (`opencode-go/deepseek-v4.1-flash`)
Début : 2026-11-07

Ce rapport se remplit phase par phase. Chaque porte n'est cochée qu'avec sa sortie réelle collée.

---

## §0 — Lecture la plus raisonnable (décisions prises, à valider par Tony)

1. **Le dossier `kit-studio-bundle/` est aussi un dépôt de fixtures.** Deux tests livrés lisent des
   fichiers du bundle du 5 novembre : `catalog.test.ts` lit
   `kit-studio-bundle/reference/Kit_Studio_actuel.html` et `glyphs.test.tsx` lit
   `kit-studio-bundle/reference/Kit_Studio_v2.html`. Remplacer le bundle par celui du 7 novembre a
   donc cassé 12 tests (402 au lieu de 414). **Décision : conserver les fichiers du bundle du 5
   novembre et superposer celui du 7 novembre** (aucune suppression). C'est la seule façon de tenir
   la porte « 414 verts » du bundle sans modifier des tests livrés.
2. **`pngjs`, `pixelmatch` et `@types/pngjs` ajoutés en `devDependencies`.** Le banc de parité du
   bundle (`kit-studio-bundle/tests/kit-studio/parity.spec.ts`) les importe ; sans eux,
   `npx tsc --noEmit -p .` échoue (porte P0). Ils seront de toute façon nécessaires en P5.
3. **`.env.local` local, non commité**, avec les deux variables placeholder déjà utilisées par la CI
   (`.github/workflows/ci.yml`) : `NEXT_PUBLIC_SUPABASE_URL=https://ci-build-placeholder.supabase.co`
   et une clé anon placeholder. Aucun secret réel n'est écrit, aucun fichier suivi n'est modifié.
4. **`npm run test:unit` n'existe pas dans le dépôt**, ni à `21a4b11` (vérifié via l'API GitHub).
   `CLAUDE.md` §1.5 et la porte P6 le citent pourtant. **Décision : ajouter l'alias
   `"test:unit": "vitest run"`** (équivalent exact de `npm test`), pour que la porte P6 soit
   littéralement exécutable, et le dire ici.
5. **`scripts/verify-kit-studio.sh` rouge au départ pour deux raisons** (le bundle n'en cite qu'une) :
   six warnings ESLint (dont 5 dans des fichiers supprimés en P3/P4) **et** une injection
   `innerHTML` dans `scene/BagScene.tsx:325`, fichier supprimé en P3. Aucune des deux n'est causée par
   ce chantier.
6. **Le bundle du 7 novembre n'est pas commité en l'état dans `main` avant ce chantier** : il l'est
   avec ce commit P0, comme matériel de travail, à l'image du bundle du 5 novembre qui, lui, était
   déjà suivi.

> Trailer de commit : `CLAUDE.md` §1.6 prescrit `Co-Authored-By: Claude Sonnet 5.5`. L'agent qui
> exécute ce chantier n'est pas Claude ; le trailer employé est
> `Co-Authored-By: DeepSeek Harness (deepseek-v4.1-flash) <noreply@deepseek.ai>`, pour ne pas
> falsifier l'attribution.

---

## §1 — P0 · Mesure de départ (aucun code applicatif touché)

### Résultats

| Contrôle | Attendu (bundle, `21a4b11`) | Mesuré | Écart |
| --- | --- | --- | --- |
| `npx tsc --noEmit -p .` | 0 erreur | **0 erreur** (exit 0) | conforme |
| `npm run lint` | 0 erreur | **0 erreur** (exit 0, 582 avertissements) | conforme |
| `npx vitest run src/features/kit-studio src/features/hub` | 414 verts | **414 verts / 41 fichiers** | conforme |
| `npx vitest run` (suite complète) | 33 fichiers / 47 tests rouges, 13 665 verts | **36 fichiers / 53 tests rouges, 13 665 verts**, 41 skip | +3 fichiers / +6 tests rouges, verts identiques |
| `npm run build` | vert | **vert** — `✓ Compiled successfully in 91s`, 59/59 pages statiques | conforme |
| `npm run perf:budget` | `/hub` 762 Ko / plafond 590, 8 autres ok | **`/hub` 762 Ko / 590 — DÉPASSE**, 8 autres ok | conforme (dépassement préexistant) |
| `bash scripts/verify-kit-studio.sh` | ROUGE | **ROUGE (exit 1)** : `innerHTML` 1 + ESLint 6 warnings ; typage/vitest/identité ok | rouge attendu, 2 causes |

### Sorties réelles

**1. Typage**

```
$ npx tsc --noEmit -p .
(exit 0, aucune sortie)
```

**2. Lint**

```
$ npm run lint
... (582 lignes « Warning: », 0 « Error »)
info  - Need to disable some ESLint rules? Learn more here: ...
(exit 0)
```

**3. Tests Kit Studio + Hub**

```
$ npx vitest run src/features/kit-studio src/features/hub
 Test Files  41 passed (41)
      Tests  414 passed (414)
   Duration  4.95s
```

**4. Suite complète**

```
$ npx vitest run
 Test Files  36 failed | 1160 passed | 5 skipped (1201)
      Tests  53 failed | 13665 passed | 41 skipped (13759)
```

Les 13 665 verts sont **exactement** le chiffre attendu par le bundle. Les 3 fichiers d'écart sont
hors kit-studio et hors hub, et préexistent à ce chantier :

- `tests/e2e-kit-studio/kit-studio.spec.ts` — spec Playwright importée par Vitest
  (`Error: Playwright Test did not expect test.beforeEach() to be called here`), aucun fichier du
  studio en cause ;
- `tests/design-system/motion-utilities.spec.ts` — `--dur-fast n'est plus référencé` ;
- `tests/features/hub/hubRedirects.spec.ts` — `matcher couvre /materiel/inventaire`.

Les 47 tests rouges attendus (tests/design/, tests/audit/, compte/map, carnet) sont bien présents ;
les 6 tests supplémentaires sont les trois fichiers ci-dessus. Non corrigés : hors périmètre, comme
demandé par le bundle.

**5. Build**

```
$ npm run build
✓ 160 glyphes SF-style générés dans public/icons/sf/
...
 ✓ Compiled successfully in 91s
 ✓ Generating static pages (59/59)
(exit 0)
```

**6. Budget JS**

```
$ npm run perf:budget

surface                 | JS gzip | plafond | fichiers | état
/                       |   377 Ko |   400 Ko |       30 | ok
/hub                    |   762 Ko |   590 Ko |       41 | DÉPASSE
/compas                 |   527 Ko |   560 Ko |       28 | ok
/clubs/[id]             |   454 Ko |   475 Ko |       31 | ok
/communaute             |   442 Ko |   460 Ko |       31 | ok
/compte                 |   436 Ko |   460 Ko |       25 | ok
/explorer               |   370 Ko |   390 Ko |       25 | ok
/kit-studio             |   397 Ko |   520 Ko |       25 | ok
(mise en page racine)   |   331 Ko |   350 Ko |       22 | ok

1 surface(s) au-delà du budget (docs/perf/PERFORMANCE.md).
(exit 1 — dépassement préexistant, /hub, non corrigé dans ce chantier)
```

**7. Porte `verify-kit-studio.sh`**

```
$ bash scripts/verify-kit-studio.sh
compas intact                      ok
couleurs littérales                ok
innerHTML / console.log            ÉCHEC (1)
orange interdit                    ok
typage                             ok
eslint                             ÉCHEC
src/features/kit-studio/__tests__/bag-scene-lifecycle.test.tsx
  3:10  warning  'afterEach' is defined but never used
  4:10  warning  'cleanup' is defined but never used
src/features/kit-studio/components/KitStudioView.tsx
  195:10  warning  'degradedReason' is assigned a value but never used
src/features/kit-studio/drawers/OptionsDrawer.tsx
  18:15  warning  'List' is defined but never used
  68:3   warning  'viewMode' is defined but never used
  98:9   warning  'handleToggleViewMode' is assigned a value but never used
✖ 6 problems (0 errors, 6 warnings)
ESLint found too many warnings (maximum: 0).
vitest                             ok
identity_compliance.mjs            ok
traveller_privacy.mjs              ok
(exit 1)
```

La violation `innerHTML` est `src/features/kit-studio/scene/BagScene.tsx:325` — fichier supprimé en P3.
Les warnings `bag-scene-lifecycle.test.tsx` et `KitStudioView.tsx` disparaissent en P3 ; ceux
d'`OptionsDrawer.tsx` sont traités en P4. La porte sera verte en P4.

### Porte P0

- [x] Les cinq sorties de commande sont consignées (ci-dessus).
- [x] L'écart de la suite complète est qualifié et documenté.
- [x] Aucune ligne de code applicatif modifiée en P0 (seuls : ajout de `test:unit`, devDeps du banc
      de parité, bundle de travail, `.env.local` ignoré).

---

## §2 — P1 · La couche de données

_(à remplir)_

## §3 — P3 · Unification — un seul studio

_(à remplir)_

## §4 — P4 · Dette de la revue indépendante

_(à remplir)_

## §5 — P5 · Banc de parité

_(à remplir)_

## §6 — P6 · Clôture

_(à remplir)_
