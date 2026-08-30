# Task 8 Brief — Workflow CI GitHub Actions pour tests visuels

## Context
Le Kit du Voyageur. `.github/workflows/nextjs.yml` existe déjà (déploiement sur GitHub Pages). On crée un workflow séparé pour les tests visuels.

## Fichier à créer : `.github/workflows/visual-regression.yml`

```yaml
name: Visual Regression — Shell Mobile

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Build app
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          # Désactiver les routes nécessitant une auth pour le build CI
          NEXT_PUBLIC_CI: 'true'

      - name: Start app
        run: npm run start &
        env:
          PORT: 4028

      - name: Wait for app to be ready
        run: npx wait-on http://localhost:4028 --timeout 60000

      - name: Run visual regression tests
        run: npm run test:visual
        env:
          PW_BASE_URL: http://localhost:4028

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-visual-report
          path: playwright-report/
          retention-days: 7

      - name: Upload diff screenshots on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-visual-diffs
          path: test-results/
          retention-days: 7
```

## Vérification

```powershell
# Vérifier syntaxe YAML valide (si Python disponible)
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/visual-regression.yml'))" 2>&1
# Ou vérifier manuellement que le fichier est bien formaté
```

Vérifier aussi que `wait-on` est dans les devDependencies :
```powershell
npm list wait-on 2>&1
```
Si absent :
```powershell
npm install --save-dev wait-on
git add package.json package-lock.json
```

## Commit

```powershell
git add ".github/workflows/visual-regression.yml"
git commit -m "ci: add visual regression workflow for mobile shell (Playwright iPhone 14 Pro)"
```

## Contraintes globales

- Ne pas modifier `.github/workflows/nextjs.yml`
- Le workflow utilise `npm run test:visual` (créé à la Task 3)
- Ne pas dispatcher de sous-agents

## Rapport

Écrire dans `.superpowers/sdd/implementation_plan/task-8-report.md` :
- Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- Commit créé
- Vérification YAML (valide/invalide)
- Concerns éventuels (ex: `wait-on` manquant)
