# Task 3 Brief — Tests visuels Playwright sur iPhone 14 Pro

## Context
Le Kit du Voyageur (Next.js 15 + TypeScript). Playwright est déjà installé.

Le fichier `playwright.config.ts` actuel pointe vers `scripts/e2e/` et utilise un projet `chromium` Desktop. 

**Objectif :** Créer des tests de régression visuelle dans `tests/visual/shell.spec.ts` avec un viewport iPhone 14 Pro. Ces tests capturent l'état actuel (bugs compris) comme **baseline de référence**.

## Ruling pré-établi

Le `playwright.config.ts` actuel sert les tests e2e existants (dans `scripts/e2e/`). Pour ne pas casser ces tests, on va **créer un fichier séparé** `playwright.visual.config.ts` dédié aux tests visuels, plutôt que de modifier `playwright.config.ts`.

## Fichiers à créer

### 1. `playwright.visual.config.ts` — nouveau fichier à la racine

```ts
import { defineConfig, devices } from '@playwright/test';

/**
 * Config Playwright pour les tests de régression visuelle du shell mobile LKDV.
 * Utiliser : npx playwright test --config=playwright.visual.config.ts
 */
export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:4028',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'iphone-14-pro',
      use: {
        ...devices['iPhone 14 Pro'],
        viewport: { width: 430, height: 932 },
      },
    },
  ],
  webServer: {
    command: process.env.PW_BASE_URL ? 'echo using existing server' : 'npm run start',
    url: process.env.PW_BASE_URL || 'http://localhost:4028',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

### 2. `tests/visual/shell.spec.ts` — tests de régression visuelle

```ts
import { test, expect, Page } from '@playwright/test';

/**
 * Tests de régression visuelle — Shell Mobile LKDV
 * Viewport : iPhone 14 Pro (430 × 932)
 *
 * Première exécution : génère les baselines (état actuel, bugs compris).
 * Les phases suivantes du plan feront converger les screenshots vers un état propre.
 */

// Routes publiques ne nécessitant pas d'authentification
const PUBLIC_ROUTES = [
  { path: '/pays',              name: 'pays-globe' },
  { path: '/communaute',        name: 'communaute' },
  { path: '/carte-interactive', name: 'carte-interactive' },
];

async function waitForShellReady(page: Page): Promise<void> {
  // Attendre la stabilisation du réseau
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
    // Certaines pages ont des WebSocket persistants — on continue
  });
  // Attendre la disparition des spinners de chargement
  await page.waitForSelector('[class*="animate-spin"]', {
    state: 'hidden',
    timeout: 15_000,
  }).catch(() => {
    // Pas de spinner = déjà chargé
  });
  // Pause pour les transitions CSS/Framer Motion
  await page.waitForTimeout(800);
}

// Tests de screenshot pour chaque route publique
for (const route of PUBLIC_ROUTES) {
  test(`shell visuel — ${route.name} (iPhone 14 Pro)`, async ({ page }) => {
    await page.goto(route.path);
    await waitForShellReady(page);

    // Vérifier qu'il y a du contenu (pas d'écran blanc total)
    const elementCount = await page.locator('body *').count();
    expect(elementCount).toBeGreaterThan(10);

    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      fullPage: false,
      threshold: 0.01,
      maxDiffPixels: 500,
    });
  });
}

test('pays — skeleton visible pendant le chargement du globe (réseau ralenti)', async ({ page }) => {
  // Intercepter le GeoJSON local et le retarder de 2 secondes
  await page.route('/data/countries-110m.geojson', async route => {
    await new Promise<void>(resolve => setTimeout(resolve, 2_000));
    await route.continue();
  });

  await page.goto('/pays');

  // Le spinner DOIT être visible immédiatement
  await expect(page.locator('[class*="animate-spin"]').first()).toBeVisible({ timeout: 5_000 });

  // Screenshot du skeleton (avec le spinner présent)
  await expect(page).toHaveScreenshot('pays-skeleton-loading.png', {
    threshold: 0.03,
  });
});
```

### 3. Mettre à jour `package.json` — ajouter le script de test visuel

Dans `package.json`, dans la section `"scripts"`, ajouter après `"test:e2e"` :

```json
"test:visual": "playwright test --config=playwright.visual.config.ts",
"test:visual:update": "playwright test --config=playwright.visual.config.ts --update-snapshots"
```

## Vérifications

```powershell
# Vérifier que TypeScript accepte le nouveau config
npx tsc --noEmit

# Vérifier que le fichier de spec est syntaxiquement valide
npx tsc --noEmit --allowJs tests/visual/shell.spec.ts
```

**NOTE IMPORTANTE :** Ne pas exécuter les tests Playwright eux-mêmes (ils nécessitent un serveur `npm run start` en cours, ce qui n'est pas faisable dans cette tâche d'implémentation). La génération des baselines sera faite manuellement ou en CI.

## Commit

```powershell
git add playwright.visual.config.ts
git add tests/visual/shell.spec.ts
git add package.json
git commit -m "test(visual): add Playwright visual regression tests for iPhone 14 Pro shell"
```

## Contraintes globales

- TypeScript strict — `tsc --noEmit` doit passer
- `npm run lint` doit passer
- Ne pas modifier `playwright.config.ts` (pour ne pas casser les tests e2e existants)
- Ne pas dispatcher de sous-agents
- Ne pas exécuter les tests Playwright (pas de serveur disponible)

## Rapport

Écrire dans `.superpowers/sdd/implementation_plan/task-3-report.md` :
- Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- Fichiers créés/modifiés
- Commits créés
- Résultat `tsc --noEmit`
- Concerns éventuels
