import { test, expect } from '@playwright/test';
import { prepareVisualPage, expectVisualSnapshot } from './_helpers/prepareVisualPage';

test.describe('Voyages Liste — Régression visuelle catalogue cockpit', () => {
  test('voyages-liste — /voyages visual fidelity', async ({ page }) => {
    await prepareVisualPage(page, '/voyages');

    const count = await page.locator('main').count();
    expect(count).toBeGreaterThan(0);

    await expectVisualSnapshot(page, 'voyages-liste.png');
  });
});
