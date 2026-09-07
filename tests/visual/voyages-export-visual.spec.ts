import { test, expect } from '@playwright/test';
import { prepareVisualPage, expectVisualSnapshot } from './_helpers/prepareVisualPage';

test.describe('Voyage [slug]/export — Régression visuelle export & feuille de route', () => {
  test('voyage-export — /voyages/fdgb-3c3a92/export visual fidelity', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/fdgb-3c3a92/export');

    const buttonCount = await page.locator('button, a').count();
    expect(buttonCount).toBeGreaterThan(0);

    await expectVisualSnapshot(page, 'voyage-export.png');
  });
});
