import { test, expect } from '@playwright/test';
import { prepareVisualPage, expectVisualSnapshot } from './_helpers/prepareVisualPage';

test.describe('Voyage [slug] — Régression visuelle phase 3 raconter', () => {
  test('voyage-recount — /voyages/fdgb-3c3a92?phase=recount visual fidelity', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/fdgb-3c3a92?phase=recount');

    const buttonCount = await page.locator('button').count();
    expect(buttonCount).toBeGreaterThan(0);

    await expectVisualSnapshot(page, 'voyage-recount.png');
  });
});
