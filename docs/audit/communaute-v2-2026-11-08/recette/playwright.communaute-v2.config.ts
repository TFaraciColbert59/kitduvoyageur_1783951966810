import { defineConfig, devices } from '@playwright/test';

/**
 * Config Playwright **de recette locale** — Communauté v2.
 *
 * Le `playwright.config.ts` du dépôt garde un `testMatch` fermé ; cette config
 * de dossier (`docs/audit/…/recette/`) permet d'exécuter les specs v2 AVANT que
 * les lignes de `testMatch` ne soient ajoutées par le Lead (voir PREUVES.md et
 * le message de passation). Projets et webServer alignés sur le config racine.
 *
 * Usage (build v2 déjà fait, serveur démarré OU laissé au webServer) :
 *   npx playwright test --config=docs/audit/communaute-v2-2026-11-08/recette/playwright.communaute-v2.config.ts \
 *     --project=mobile-webkit --project=mobile-chromium
 *
 * Avec un serveur déjà lancé sur 4028 :
 *   PW_BASE_URL=http://127.0.0.1:4028 npx playwright test --config=…
 */
export default defineConfig({
  testDir: '../../../..',
  testMatch: ['tests/e2e/communaute-v2*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:4028',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Le service worker de l'app court-circuite `page.route` (surtout WebKit) :
    // les mocks @ui-mock exigent un contexte sans SW.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'desktop-chromium',
      grepInvert: /@mobile|@webkit/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-webkit',
      grepInvert: /@local-web/,
      use: { ...devices['iPhone 14 Pro'] },
    },
    {
      name: 'mobile-chromium',
      grepInvert: /@local-web|@webkit/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 430, height: 932 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://localhost:4028',
        reuseExistingServer: true,
        timeout: 120_000,
        env: { PORT: '4028' },
      },
});
