import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  testMatch: 'glass-contract.spec.ts',
  workers: 1,
  reporter: [['list']],
  use: { viewport: { width: 390, height: 844 } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
});
