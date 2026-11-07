import { defineConfig } from '@playwright/test';

const useServer = !!process.env.KS_APP_URL && process.env.KS_APP_URL.startsWith('http://localhost');

export default defineConfig({
  testDir: './tests/kit-studio',
  testMatch: /parity\.spec\.ts/,
  timeout: 20 * 60 * 1000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/kit-studio' }]],
  use: {
    browserName: 'chromium',
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] },
  },
  webServer: useServer ? { command: 'npm run dev', url: process.env.KS_APP_URL, reuseExistingServer: true, timeout: 180000 } : undefined,
});
