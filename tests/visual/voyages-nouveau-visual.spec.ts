import { test, expect } from '@playwright/test';
import { prepareVisualPage, expectVisualSnapshot } from './_helpers/prepareVisualPage';

test.describe('Voyages Nouveau — Régression visuelle wizard cockpit', () => {
  test('voyages-nouveau — /voyages/nouveau visual fidelity', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/nouveau');

    const count = await page.locator('button, input, select').count();
    expect(count).toBeGreaterThan(0);

    await expectVisualSnapshot(page, 'voyages-nouveau.png');
  });
});
