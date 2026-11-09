import { defineConfig } from '@playwright/test';
import { baseURL, loadEnvFiles } from './tests/support/env';

/**
 * Configuration dédiée à l'accessibilité (couche 5 de 07_VERIFICATION).
 *
 * Objectif : 0 violation axe sur chaque écran et chaque état, aux deux tailles de la
 * maquette (1440 × 1040 et 390 × 844), plus les contrôles qui ne sont pas couverts par
 * axe : contraste calculé sur les jetons, focus visible, cibles ≥ 44 px, parcours
 * clavier complet.
 *
 * Lancement : `npx playwright test --config=playwright.a11y.config.ts` (ou `npm run test:a11y`,
 * qui utilise le projet `a11y` de la configuration principale).
 */

loadEnvFiles();

const url = baseURL();
const useLocalServer = !process.env.CRM_BASE_URL;
const readinessUrl = `${url.replace(/\/$/, '')}/robots.txt`;

export default defineConfig({
  testDir: './tests/a11y',
  outputDir: './bundle/etat/preuves/playwright/a11y-artefacts',
  timeout: 60_000,
  expect: { timeout: 7_500 },
  fullyParallel: false,
  workers: Number(process.env.CRM_E2E_WORKERS ?? 1),
  forbidOnly: true,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: './bundle/etat/preuves/playwright/a11y-rapport', open: 'never' }],
    ['json', { outputFile: './bundle/etat/preuves/playwright/a11y-resultats.json' }]
  ],
  use: {
    baseURL: url,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: useLocalServer
    ? {
        command: 'npm run dev',
        url: readinessUrl,
        reuseExistingServer: true,
        timeout: 180_000,
        stdout: 'ignore',
        stderr: 'pipe'
      }
    : undefined,
  projects: [
    {
      name: 'a11y',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 1040 }, deviceScaleFactor: 1 }
    },
    {
      name: 'a11y-mobile',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    }
  ]
});
