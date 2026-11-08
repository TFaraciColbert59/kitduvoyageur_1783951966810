# Lignes exactes à appliquer par le Lead (fichiers hors de mon scope d'écriture)

Je ne modifie ni `playwright.config.ts`, ni `.github/workflows/ci.yml`, ni
`package.json` (scope réservé). Voici les ajouts **minimaux et exacts** pour que
les preuves v2 soient comptées en CI, sans dépendre de `LKDV_E2E_ENABLED`
(absent des variables du dépôt) : les specs `@ui-mock` ne demandent ni base ni
session réelle.

## 1. `playwright.config.ts` — `testMatch`

Après la ligne `'tests/e2e/carnet-v2*.spec.ts',` :

```ts
    // Communauté v2 (05-QUALITE-ET-TESTS.md § 2) : Explorer, Création, invité,
    // drapeau. Les specs de données réelles se sautent sans LKDV_E2E_DB=test.
    'tests/e2e/communaute-v2*.spec.ts',
```

## 2. `.github/workflows/ci.yml` — `quality-gates`

### 2a. Gate 4 (build) : monter la v2 dans l'artefact

Dans `env:` de l'étape `Gate 4 — Next.js Production Build`, ajouter :

```yaml
          NEXT_PUBLIC_COMMUNAUTE_V2: 'true'
```

> C'est aussi l'état cible de la prod (drapeau `true` à la fusion, `06` § 4.3) :
> le build CI couvre donc le bundle réellement livré.

### 2b. Nouvelle étape **inconditionnelle** après la Gate 4 (et avant la Gate 5)

Ajouter juste après l'étape « Conserver le build pour l'E2E du Compas » :

```yaml
      # Communauté v2 — parcours UI déterministes (@ui-mock) : données servies
      # par `page.route` (aucune base, aucune session réelle, aucun réseau).
      # Le webServer Playwright démarre `npm run start` sur le build de Gate 4.
      - name: Gate 4c — Communauté v2 : parsecours UI @ui-mock (sans base)
        run: npx playwright test tests/e2e/communaute-v2-explorer.spec.ts tests/e2e/communaute-v2-creation.spec.ts tests/e2e/communaute-v2-invite.spec.ts --project=mobile-webkit --project=mobile-chromium
        env:
          CI: true
          NEXT_PUBLIC_COMMUNAUTE_V2: 'true'
          NEXT_PUBLIC_SUPABASE_URL: https://fixture.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: fixture-anon-key
```

Notes :
- **ne pas** poser `PW_BASE_URL` dans cette étape : sans lui, le `webServer` du
  config démarre `npm run start` sur 4028 (build de la Gate 4) ;
- l'URL Supabase fictive est identique à celle du build : le harnais calcule le
  nom du cookie de session (`sb-fixture-auth-token`) à partir de la variable ;
- un seul projet mobile suffit en CI pour le quota runner ; `--project=mobile-webkit`
  teste le moteur Safari, `mobile-chromium` est déjà couvert localement (les deux
  sont listés ci-dessus, retirer l'un si le temps de job est trop long).

### 2c. Accessibilité v2 (Gate G6)

Après l'étape `Gate G6 — Accessibilité axe (zéro critical/serious)` :

```yaml
      - name: Gate G6.1 — Accessibilité Communauté v2 (@ui-mock)
        run: npx playwright test tests/a11y/e2e/communaute-v2-a11y.spec.ts --project=iphone-14-pro
        env:
          CI: true
          NEXT_PUBLIC_COMMUNAUTE_V2: 'true'
          NEXT_PUBLIC_SUPABASE_URL: https://fixture.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: fixture-anon-key
```

La config `playwright.a11y.config.ts` démarre `npm run dev` sur 4000 si
`PW_BASE_URL` est absent ; aucune base n'est appelée (mock réseau).

### 2d. Visuel v2 (`visual-gates`)

Le job est déjà conditionné par `LKDV_E2E_ENABLED` ; quand il est activé :

```yaml
    env:
      NEXT_PUBLIC_COMMUNAUTE_V2: 'true'
      NEXT_PUBLIC_SUPABASE_URL: https://fixture.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: fixture-anon-key
```

au niveau du job `visual-gates` (le `webServer` est `npm run dev`). Les références
`tests/visual/communaute-v2-visual.spec.ts-snapshots/*.png` doivent être
commitées après génération locale (commande dans le README du dossier recette).

### 2e. Données réelles (optionnel, plus tard)

Quand une base de test migrée existera :

```yaml
      - name: Gate 5.4 — Communauté v2 : créations réelles (base de test)
        if: ${{ vars.LKDV_E2E_ENABLED == 'true' }}
        run: npx playwright test tests/e2e/communaute-v2-db.spec.ts --project=mobile-chromium
        env:
          CI: true
          LKDV_E2E_DB: test
          LKDV_E2E_AUTH: '1'
          AUDIT_EMAIL: ${{ secrets.LKDV_E2E_EMAIL }}
          AUDIT_PASSWORD: ${{ secrets.LKDV_E2E_PASSWORD }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_TEST_ANON_KEY }}
```

> Jamais la prod (`00` § 4.8) : sortie et club uniquement sur base de test.

## 3. Commandes locales de vérification (avant commit)

```bash
NEXT_PUBLIC_COMMUNAUTE_V2=true NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key npm run build
npm run start   # 4028

PW_BASE_URL=http://127.0.0.1:4028 npx playwright test \
  --config=docs/audit/communaute-v2-2026-11-08/recette/playwright.communaute-v2.config.ts \
  --project=mobile-webkit --project=mobile-chromium
```

La config de recette (`recette/playwright.communaute-v2.config.ts`) existe pour
compter les specs **avant** l'ajout au `testMatch` racine ; une fois le § 1
appliqué, la commande standard du dépôt suffit.
