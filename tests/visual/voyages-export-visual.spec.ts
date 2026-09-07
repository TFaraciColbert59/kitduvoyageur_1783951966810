import { test, expect, Page } from '@playwright/test';

async function setupDeterministicEnvironment(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'lkdv_cookie_consent',
      JSON.stringify({
        necessary: true,
        analytics: false,
        marketing: false,
        version: '1',
      })
    );
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function waitForExportReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('main, .max-w-4xl', { timeout: 15_000 }).catch(() => {});
  await page.waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; opacity: 0 !important; visibility: hidden !important; }',
  });
  await page.waitForTimeout(1000);
}

test.describe('Voyage [slug]/export — Régression visuelle export & feuille de route', () => {
  test('voyage-export — /voyages/fdgb-3c3a92/export visual fidelity', async ({ page }) => {
    await setupDeterministicEnvironment(page);
    await page.goto('/voyages/fdgb-3c3a92/export');
    await waitForExportReady(page);

    const buttonCount = await page.locator('button, a').count();
    expect(buttonCount).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('voyage-export.png', {
      fullPage: false,
      mask: [page.locator('canvas'), page.locator('nextjs-portal')],
      threshold: 0.02,
      maxDiffPixels: 300,
    });
  });
});
