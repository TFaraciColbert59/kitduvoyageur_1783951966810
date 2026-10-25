import { defineConfig, devices } from '@playwright/test';

/**
 * Y0.5 — Config des scans d'accessibilité (porte G6).
 * Utiliser : npm run test:a11y
 * Critère : zéro violation axe de gravité critical ou serious par surface × viewport.
 */
export default defineConfig({
  testDir: './tests/a11y/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-a11y-report' }]],
  timeout: 60_000,
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:4000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'iphone-14-pro',
      use: {
        ...devices['iPhone 14 Pro'],
        defaultBrowserType: 'chromium',
        viewport: { width: 430, height: 932 },
      },
    },
    {
      name: 'ipad-portrait',
      use: {
        ...devices['iPad (gen 7)'] ?? devices['iPad Mini'],
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
