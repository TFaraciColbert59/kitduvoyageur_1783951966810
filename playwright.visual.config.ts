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
      name: 'iphone-14-pro',
      use: {
        ...devices['iPhone 14 Pro'],
        defaultBrowserType: 'chromium',
        viewport: { width: 430, height: 932 },
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
