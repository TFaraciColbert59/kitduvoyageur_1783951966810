import { test, expect } from '@playwright/test';
import { prepareVisualPage, expectVisualSnapshot } from './_helpers/prepareVisualPage';

test.describe('Pays Detail — Régression visuelle cockpit', () => {
  test('pays-detail — /pays/fr visual fidelity', async ({ page }) => {
    // clock:false — pas de compteurs J-N sur la fiche pays, et l'horloge figée
    // bloque l'évaluation d'images sur cette page (voir helper).
    await prepareVisualPage(page, '/pays/fr', { clock: false });

    const hasContent = await page.locator('main').count();
    expect(hasContent).toBeGreaterThan(0);

    await expectVisualSnapshot(page, 'pays-fr.png');
  });
});
