import { defineConfig } from '@playwright/test';
import { baseURL, loadEnvFiles } from './tests/support/env';

/**
 * Configuration Playwright du CRM Control.
 *
 * - `baseURL` : `CRM_BASE_URL` (aperçu Vercel de la branche) sinon `http://localhost:4100` ;
 * - deux projets d'exécution : bureau 1440 × 1040 et mobile 390 × 844 (maquette) ;
 * - projets dédiés : accessibilité, performance, contrat d'API, parité visuelle ;
 * - la production est refusée par `assertNotProduction` (garde-fous § 1) ;
 * - aucun `retry` : un test instable est un test rouge, pas un test à rejouer ;
 * - `forbidOnly` toujours actif : un `.only` oublié fait échouer la suite.
 *
 * Les scénarios qui exigent la base migrée et un compte `is_demo` sont marqués
 * `test.skip` motivé (identifiants absents) ou `test.fixme` « en attente de la page ».
 */

loadEnvFiles();

const url = baseURL();
// Le serveur local démarre dès qu'aucun aperçu n'est visé ; `/robots.txt` répond 200
// même sans variables Supabase, ce qui sert de sonde de disponibilité.
const useLocalServer = !process.env.CRM_BASE_URL;
const readinessUrl = `${url.replace(/\/$/, '')}/robots.txt`;

const DESKTOP_VIEWPORT = { width: 1440, height: 1040 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './bundle/etat/preuves/playwright/artefacts',
  timeout: 45_000,
  expect: { timeout: 7_500 },
  fullyParallel: false,
  workers: Number(process.env.CRM_E2E_WORKERS ?? 1),
  forbidOnly: true,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: './bundle/etat/preuves/playwright/rapport', open: 'never' }],
    ['json', { outputFile: './bundle/etat/preuves/playwright/resultats.json' }]
  ],
  use: {
    baseURL: url,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
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
      name: 'desktop',
      testDir: './tests/e2e',
      grepInvert: /@mobile/,
      use: { browserName: 'chromium', viewport: DESKTOP_VIEWPORT, deviceScaleFactor: 1, isMobile: false, hasTouch: false }
    },
    {
      name: 'mobile',
      testDir: './tests/e2e',
      grep: /@mobile/,
      use: { browserName: 'chromium', viewport: MOBILE_VIEWPORT, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    },
    {
      name: 'a11y',
      testDir: './tests/a11y',
      use: { browserName: 'chromium', viewport: DESKTOP_VIEWPORT, deviceScaleFactor: 1 }
    },
    {
      name: 'a11y-mobile',
      testDir: './tests/a11y',
      use: { browserName: 'chromium', viewport: MOBILE_VIEWPORT, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    },
    {
      name: 'perf',
      testDir: './tests/perf',
      use: { browserName: 'chromium', viewport: DESKTOP_VIEWPORT, deviceScaleFactor: 1 }
    },
    {
      name: 'api',
      testDir: './tests/api',
      use: { browserName: 'chromium', viewport: DESKTOP_VIEWPORT }
    },
    {
      name: 'visuel',
      testDir: './tests/visuel',
      use: { browserName: 'chromium', viewport: DESKTOP_VIEWPORT, deviceScaleFactor: 1 }
    }
  ]
});
