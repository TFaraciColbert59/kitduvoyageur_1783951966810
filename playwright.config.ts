import { defineConfig, devices } from '@playwright/test';

/**
 * LKDV — Tests navigateur (Playwright).
 * Le serveur est démarré par le config (build requis : `npm run build` d'abord,
 * ou `npm start` local). Seuls les parcours critiques du cockpit Mon Matériel
 * sont couverts ici en CI ; les scénarios complets vivent dans
 * `scripts/pw_mon_materiel_v3.ts` (venv local Chromium).
 *
 * M10 — matrice nommée précisément :
 * - `desktop-chromium` : Desktop Chrome (Chromium) ;
 * - `mobile-webkit`    : iPhone 14 Pro — WebKit réel (moteur de Safari) ;
 * - `mobile-chromium`  : 430×932, Chromium mobile (≠ Safari, ≠ WKWebView).
 *
 * Le runtime natif WKWebView de l'app Capacitor n'est PAS couvert par ces
 * projets : seule une validation sur appareil/simulateur iOS le démontre.
 */
export default defineConfig({
  testDir: './scripts/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:4028',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    // iPhone 14 Pro : le device Playwright sélectionne WebKit (moteur Safari).
    { name: 'mobile-webkit', use: { ...devices['iPhone 14 Pro'] } },
    // Même gabarit tactile en Chromium — ne remplace pas une preuve Safari.
    {
      name: 'mobile-chromium',
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
      },
});