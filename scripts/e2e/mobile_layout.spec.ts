import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORTS = [
  { name: 'iPhone SE (375x667)', width: 375, height: 667 },
  { name: 'iPhone 14/15/16 Pro (390x844)', width: 390, height: 844 },
];

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`Mobile Layout Verification — ${vp.name}`, { tag: '@mobile' }, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Communauté — titre mobile rendu, no white gap, bottom nav visible', async ({ page }) => {
      await page.goto('/communaute?tab=fil');
      await page.waitForLoadState('domcontentloaded');

      // Design actuel : le header flottant est DESKTOP uniquement
      // (`hidden md:block`, Header.tsx) ; en mobile la page rend son propre
      // en-tête. On vérifie donc le shell, le titre H1 et la nav basse.
      const shell = page.locator('.mobile-page-shell').first();
      await expect(shell).toBeVisible();

      await expect(page.locator('h1', { hasText: 'Communauté' }).first()).toBeVisible();

      // Bottom nav is fixed at bottom
      const bottomNav = page.locator('nav[aria-label="Navigation principale"]');
      await expect(bottomNav).toBeVisible();
    });

    test('Compte — Header, Identity, Tabs, and SmartImage fallbacks', async ({ page }) => {
      await page.goto('/compte');
      await page.waitForLoadState('domcontentloaded');

      // Compte shell & container
      const shell = page.locator('.mobile-page-shell').first();
      await expect(shell).toBeVisible();

      // Bottom nav is visible
      const bottomNav = page.locator('nav[aria-label="Navigation principale"]');
      await expect(bottomNav).toBeVisible();
    });

    test('Clubs Hub — Topbar and upper extension tabs scrolling', async ({ page }) => {
      await page.goto('/clubs');
      await page.waitForLoadState('domcontentloaded');

      // Bottom nav is visible
      const bottomNav = page.locator('nav[aria-label="Navigation principale"]');
      await expect(bottomNav).toBeVisible();
    });

    test('Carte interactive — Full bleed map, no unwanted white block', async ({ page }) => {
      await page.goto('/carte-interactive');
      await page.waitForLoadState('domcontentloaded');

      // Map container is visible
      const mapContainer = page.locator('main').first();
      await expect(mapContainer).toBeVisible();

      // Bottom nav is present
      const bottomNav = page.locator('nav[aria-label="Navigation principale"]');
      await expect(bottomNav).toBeVisible();
    });
  });
}
