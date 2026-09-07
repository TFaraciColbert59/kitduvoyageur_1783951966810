import { test, expect } from '@playwright/test';
import { prepareVisualPage, expectVisualSnapshot } from './_helpers/prepareVisualPage';

test.describe('Voyage [slug] — Régression visuelle phase 1 préparer', () => {
  test('voyage-prepare — /voyages/fdgb-3c3a92 prepare phase visual fidelity', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/fdgb-3c3a92');

    const buttonCount = await page.locator('button').count();
    expect(buttonCount).toBeGreaterThan(0);

    await expectVisualSnapshot(page, 'voyage-prepare.png');
  });
});
