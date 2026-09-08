import { test, expect } from '@playwright/test';
import { prepareVisualPage, expectVisualSnapshot } from './_helpers/prepareVisualPage';

test.describe('Pays Detail — Régression visuelle cockpit', () => {
  test('pays-detail — /pays/fr visual fidelity', async ({ page }) => {
    // Horloge figée active (timeouts gérés côté Node.js dans prepareVisualPage).
    await prepareVisualPage(page, '/pays/fr');

    const hasContent = await page.locator('main').count();
    expect(hasContent).toBeGreaterThan(0);

    await expectVisualSnapshot(page, 'pays-fr.png');
  });
});
