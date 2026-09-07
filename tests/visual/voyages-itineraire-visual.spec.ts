import { test, expect } from '@playwright/test';
import { prepareVisualPage, expectVisualSnapshot } from './_helpers/prepareVisualPage';

test.describe('Voyage [slug]/itineraire — Régression visuelle planificateur', () => {
  test('voyage-itineraire — /voyages/fdgb-3c3a92/itineraire visual fidelity', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/fdgb-3c3a92/itineraire');

    const mainContentCount = await page.locator('main').count();
    expect(mainContentCount).toBeGreaterThan(0);

    await expectVisualSnapshot(page, 'voyage-itineraire.png');
  });
});
