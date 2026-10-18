import { capture, expect, test } from '../_lib/fixtures';
import { detailsButton, expectStep, flowTab, grab, openStep, sheet } from '../_lib/compas';

/**
 * Fumée — étape « Nous » sur une aventure réellement préparée : ouvrir l'étape
 * par le lien `?etape=nous`, son tiroir par ≡, un onglet, les hauteurs du
 * tiroir au toucher de la poignée, fermer.
 * Lot Nous+Résa : ajouter ici les scénarios de l'étape.
 */
test.describe('@etape:nous fumée', () => {
  test('≡ ouvre le tiroir « Équipe », l’onglet « Budget » s’affiche, la poignée change la hauteur, « Fermer » ferme', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'nous');
    await expectStep(page, 'nous');

    await cover.click(detailsButton(page, 'nous'), 'le tiroir de l’étape s’ouvre sur « Équipe »', async () => {
      await expect(sheet(page)).toBeVisible();
      await expect(flowTab(page, 'Équipe')).toHaveAttribute('aria-pressed', 'true');
    });
    await cover.click(flowTab(page, 'Budget'), 'l’onglet « Budget » devient actif', async () => {
      await expect(flowTab(page, 'Budget')).toHaveAttribute('aria-pressed', 'true');
      await expect(flowTab(page, 'Équipe')).toHaveAttribute('aria-pressed', 'false');
    });
    await capture(page, 'budget');

    // Toucher la poignée : petit → moyen → grand → moyen (selon la hauteur de départ).
    const before = await sheet(page).getAttribute('data-detent');
    const expected = before === 'small' ? 'medium' : before === 'medium' ? 'large' : 'medium';
    await cover.click(grab(page), `toucher la poignée fait passer le tiroir de ${before} à ${expected}`, () =>
      expect(sheet(page)).toHaveAttribute('data-detent', expected)
    );

    await cover.click(sheet(page).getByRole('button', { name: 'Fermer', exact: true }), 'le tiroir se ferme', () =>
      expect(page.locator('.cp-sheet[role="dialog"]')).toHaveCount(0)
    );
  });
});
