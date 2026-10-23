import { capture, expect, test } from '../_lib/fixtures';
import { detailsButton, expectStep, flowTab, openStep, sheet } from '../_lib/compas';

/**
 * Fumée — étape « Kit » : le tiroir et ses onglets, PUIS hors ligne (état
 * « hors ligne » du banc) : l'écran déjà chargé reste utilisable, le tiroir
 * s'ouvre sans réseau.
 * Lot Verdict+Kit : ajouter ici les scénarios de l'étape.
 */
test.describe('@etape:kit fumée', () => {
  test('≡ → « Tout » → « Emballer » ; hors ligne, le tiroir s’ouvre encore et « Conseils » répond', async ({ page, cover, preparedTrip, goOffline }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'kit');
    await expectStep(page, 'kit');

    await cover.click(detailsButton(page, 'kit'), 'le tiroir du kit s’ouvre', () => expect(sheet(page)).toBeVisible());
    await cover.click(flowTab(page, 'Tout'), 'l’onglet « Tout » devient actif', () =>
      expect(flowTab(page, 'Tout')).toHaveAttribute('aria-pressed', 'true')
    );
    await cover.click(flowTab(page, 'Emballer'), 'l’onglet « Emballer » devient actif', () =>
      expect(flowTab(page, 'Emballer')).toHaveAttribute('aria-pressed', 'true')
    );
    await capture(page, 'emballer');
    await sheet(page).getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(page.locator('.cp-sheet[role="dialog"]')).toHaveCount(0);

    await goOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await detailsButton(page, 'kit').click();
    await expect(sheet(page)).toBeVisible();
    await cover.click(flowTab(page, 'Conseils'), 'hors ligne, l’onglet « Conseils » s’affiche quand même', () =>
      expect(flowTab(page, 'Conseils')).toHaveAttribute('aria-pressed', 'true')
    );
    await capture(page, 'hors-ligne-conseils');
    await goOffline(false);
  });
});
