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
 *
 * Phase 3 clôture locale — suites séparées par tags (voir scripts/e2e/*.spec.ts) :
 * - `@local-web` : parcours web applicables localement (Chromium desktop, sans
 *   auth Supabase ni service externe). Commande : `npm run test:e2e:local`.
 * - `@mobile`    : parcours dont l'invariant est l'expérience mobile (projets mobiles uniquement).
 * - `@webkit`    : parcours spécifiques au moteur WebKit (projet mobile-webkit uniquement).
 * - `@staging-auth` : session Supabase réelle requise (skip explicite hors staging).
 * - `@external`  : service externe réel requis (projet Supabase de test, IA ; skip explicite en local).
 *
 * Le filtrage par projet évite d'exécuter des parcours desktop sur les projets
 * mobiles (et inversement) — cause historique d'échecs non produits.
 */
export default defineConfig({
  testDir: './scripts/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 8 workers par défaut (16 vCPU) saturaient le serveur Next unique : le rendu
  // SSR dépassait les timeouts d'assertion (échecs A10/HUB-3/depart non produits).
  workers: process.env.CI ? 1 : 4,
  reporter: [['list']],
  timeout: 60_000,
  expect: {
    // Marge pour le SSR sous charge locale (défaut Playwright : 5 s).
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:4028',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      grepInvert: /@mobile|@webkit/,
      use: { ...devices['Desktop Chrome'] },
    },
    // iPhone 14 Pro : le device Playwright sélectionne WebKit (moteur Safari).
    {
      name: 'mobile-webkit',
      grepInvert: /@local-web/,
      use: { ...devices['iPhone 14 Pro'] },
    },
    // Même gabarit tactile en Chromium — ne remplace pas une preuve Safari.
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
      },
});