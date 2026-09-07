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

async function waitForKitReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('main, .max-w-7xl', { timeout: 15_000 }).catch(() => {});
  await page.waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; opacity: 0 !important; visibility: hidden !important; }',
  });
  await page.waitForTimeout(1000);
}

test.describe('Voyage [slug]/kit — Régression visuelle kit & sac à dos', () => {
  test('voyage-kit — /voyages/fdgb-3c3a92/kit visual fidelity', async ({ page }) => {
    await setupDeterministicEnvironment(page);
    await page.goto('/voyages/fdgb-3c3a92/kit');
    await waitForKitReady(page);

    const buttonCount = await page.locator('button').count();
    expect(buttonCount).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('voyage-kit.png', {
      fullPage: false,
      mask: [page.locator('canvas'), page.locator('nextjs-portal')],
      threshold: 0.02,
      maxDiffPixels: 300,
    });
  });
});
