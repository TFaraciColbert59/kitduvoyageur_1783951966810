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
  await page.addStyleTag({
    content: 'nextjs-portal, [data-nextjs-toast], #nextjs-dev-tools, button[aria-label="Next.js DevTools"] { display: none !important; opacity: 0 !important; }'
  });
}

async function waitForListReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('main', { timeout: 15_000 }).catch(() => {});
  await page.waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
}

test.describe('Voyages Liste — Régression visuelle catalogue cockpit', () => {
  test('voyages-liste — /voyages visual fidelity', async ({ page }) => {
    await setupDeterministicEnvironment(page);
    await page.goto('/voyages');
    await waitForListReady(page);

    const count = await page.locator('main').count();
    expect(count).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('voyages-liste.png', {
      fullPage: false,
      mask: [page.locator('canvas')],
      threshold: 0.02,
      maxDiffPixels: 300,
    });
  });
});
