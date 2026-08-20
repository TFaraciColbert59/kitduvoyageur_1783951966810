import { defineConfig, devices } from '@playwright/test';

/**
 * LKDV — Tests navigateur (Playwright).
 * Le serveur est démarré par le config (build requis : `npm run build` d'abord,
 * ou `npm start` local). Seuls les parcours critiques du cockpit Mon Matériel
 * sont couverts ici en CI ; les scénarios complets vivent dans
 * `scripts/pw_mon_materiel_v3.ts` (venv local Chromium).
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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: process.env.PW_BASE_URL ? 'echo using existing server' : 'npm run start',
    url: process.env.PW_BASE_URL || 'http://localhost:4028',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});