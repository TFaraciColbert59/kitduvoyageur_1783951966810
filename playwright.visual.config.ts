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
    baseURL: process.env.PW_BASE_URL || 'http://localhost:4000',
    trace: 'on-first-retry',
    // Le service worker de l'app prend le contrôle de la page après le premier
    // chargement et sert les GET lui-même : `page.route` ne les voit plus et les
    // specs à fixture réseau (fil Communauté) échouent en `net::ERR_FAILED`
    // après un rechargement. Les tests visuels doivent rester hermétiques.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      // M10 — gabarit iPhone 14 Pro rendu par CHROMIUM, pas par Safari : le
      // nom l'affirme pour éviter toute confusion avec WebKit. Le runtime natif
      // WKWebView de l'app Capacitor n'est PAS couvert par ce projet — seule
      // une validation sur appareil/simulateur iOS le démontre.
      name: 'iphone-14-pro-chromium',
      use: {
        ...devices['iPhone 14 Pro'],
        defaultBrowserType: 'chromium',
        viewport: { width: 430, height: 932 },
      },
    },
    {
      // Ajouté (e866bada) pour la matrice sociale 393/430/834/1440 : seule
      // community-social.spec.ts lit cette largeur. Les autres specs n'ont aucune
      // référence à 393 px (elles échouaient toutes, « snapshot manquant ») et
      // doublaient le gabarit téléphone déjà couvert à 430 px.
      name: 'iphone-393-chromium',
      testMatch: /community-feed\.spec\.ts$/,
      use: {
        ...devices['iPhone 14 Pro'],
        defaultBrowserType: 'chromium',
        viewport: { width: 393, height: 852 },
      },
    },
    {
      // Y0.5 — la tablette est le point de rupture entre mobile et cockpit 3 colonnes.
      name: 'ipad-portrait',
      use: {
        ...(devices['iPad (gen 7)'] ?? devices['iPad Mini']),
        defaultBrowserType: 'chromium',
        viewport: { width: 834, height: 1194 },
      },
    },
  ],
  webServer: {
    command: process.env.PW_BASE_URL ? 'echo using existing server' : 'npm run dev',
    url: process.env.PW_BASE_URL || 'http://localhost:4000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
