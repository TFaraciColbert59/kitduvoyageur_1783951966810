import { defineConfig, devices } from '@playwright/test';

/**
 * Config Playwright **de capture** — inventaire des écarts avec la maquette.
 *
 * Spec unique : `docs/audit/communaute-v2-2026-11-08/ecarts-maquette/capture-all.spec.ts`.
 * Cible le build V2 servi sur 4028 (données simulées par le harnais @ui-mock :
 * aucune requête réelle, aucune base). Captures 390×844 pour comparaison directe
 * avec `recette/captures-maquette/` (58 références 390×844).
 *
 * Usage :
 *   PW_BASE_URL=http://127.0.0.1:4028 npx playwright test \
 *     --config=docs/audit/communaute-v2-2026-11-08/ecarts-maquette/playwright.capture.config.ts
 */
export default defineConfig({
  testDir: '../../../..',
  testMatch: ['docs/audit/communaute-v2-2026-11-08/ecarts-maquette/*.spec.ts'],
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 300_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://127.0.0.1:4028',
    trace: 'off',
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  },
  projects: [
    {
      name: 'capture',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
});
