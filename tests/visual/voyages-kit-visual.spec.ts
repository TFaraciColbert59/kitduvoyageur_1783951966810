import { test, expect } from '@playwright/test';
import { prepareVisualPage, expectVisualSnapshot } from './_helpers/prepareVisualPage';

test.describe('Voyage [slug]/kit — Régression visuelle kit & sac à dos', () => {
  test('voyage-kit — /voyages/fdgb-3c3a92/kit visual fidelity', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/fdgb-3c3a92/kit');

    const buttonCount = await page.locator('button').count();
    expect(buttonCount).toBeGreaterThan(0);

    await expectVisualSnapshot(page, 'voyage-kit.png');
  });
});
