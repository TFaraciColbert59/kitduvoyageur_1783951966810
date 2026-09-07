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

async function waitForPrepareReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('main', { timeout: 15_000 }).catch(() => {});
  await page.waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; opacity: 0 !important; visibility: hidden !important; }',
  });
  await page.waitForTimeout(1000);
}

test.describe('Voyage [slug] — Régression visuelle phase 1 préparer', () => {
  test('voyage-prepare — /voyages/fdgb-3c3a92 prepare phase visual fidelity', async ({ page }) => {
    await setupDeterministicEnvironment(page);
    await page.goto('/voyages/fdgb-3c3a92');
    await waitForPrepareReady(page);

    const buttonCount = await page.locator('button').count();
    expect(buttonCount).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('voyage-prepare.png', {
      fullPage: false,
      mask: [page.locator('canvas'), page.locator('nextjs-portal')],
      threshold: 0.02,
      maxDiffPixels: 300,
    });
  });
});
