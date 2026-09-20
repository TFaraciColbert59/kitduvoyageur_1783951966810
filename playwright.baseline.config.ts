import { defineConfig, devices } from '@playwright/test';

/**
 * LKDV — Captures de référence « avant » (Phase 1 → Phase 2).
 *
 * Matrice minimale de validation : iPhone 16 Pro (Dynamic Island), petit
 * iPhone, Android mobile, desktop web. Les captures alimentent
 * `docs/design-system/baseline-screenshots/` et servent de comparaison
 * visuelle au protocole Phase 2 (voir docs/design-system/PHASE2_READINESS.md).
 *
 * Utilisation : npx playwright test --config=playwright.baseline.config.ts
 * Le serveur de production est démarré automatiquement (build requis).
 */
export default defineConfig({
  testDir: './scripts/design/baseline',
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  reporter: [['list']],
  timeout: 180_000,
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:4028',
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'iphone-16-pro',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'iphone-se',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'android-pixel',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop-1440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://localhost:4028',
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
