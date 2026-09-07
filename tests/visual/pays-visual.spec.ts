import { test, expect, Page } from '@playwright/test';

async function setupDeterministicEnvironment(page: Page): Promise<void> {
  // Prérégler le consentement des cookies pour masquer la bannière
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

  // Emuler prefers-reduced-motion pour figer les animations et couper la vidéo en boucle
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function waitForPaysReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('main', { timeout: 15_000 }).catch(() => {});
  await page.waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
}

test.describe('Pays Detail — Régression visuelle cockpit', () => {
  test('pays-detail — /pays/fr visual fidelity', async ({ page }) => {
    await setupDeterministicEnvironment(page);
    await page.goto('/pays/fr');
    await waitForPaysReady(page);

    const hasContent = await page.locator('main').count();
    expect(hasContent).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('pays-fr.png', {
      fullPage: false,
      mask: [page.locator('canvas'), page.locator('img')],
      threshold: 0.02,
      maxDiffPixels: 300,
    });
  });
});
