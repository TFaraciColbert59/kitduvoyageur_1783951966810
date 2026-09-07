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

async function waitForSlugReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('main', { timeout: 15_000 }).catch(() => {});
  await page.waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
}

test.describe('Voyage [slug] — Régression visuelle cockpit 3 colonnes', () => {
  test('voyage-slug — /voyages/fdgb-3c3a92 visual fidelity', async ({ page }) => {
    await setupDeterministicEnvironment(page);
    await page.goto('/voyages/fdgb-3c3a92');
    await waitForSlugReady(page);

    const mainContentCount = await page.locator('main').count();
    expect(mainContentCount).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('voyage-slug.png', {
      fullPage: false,
      mask: [page.locator('canvas')],
      threshold: 0.02,
      maxDiffPixels: 300,
    });
  });
});
