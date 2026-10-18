import { capture, expect, test } from '../_lib/fixtures';
import { detailsButton, expectStep, flowTab, grab, openCompas, sheet, stepButton } from '../_lib/compas';

/**
 * Fumée — étape « Résa » : y aller par la capsule d'étapes, ouvrir son tiroir,
 * l'onglet « Nuits », puis GLISSER la poignée (haut : agrandir ; bas : réduire).
 * Lot Nous+Résa : ajouter ici les scénarios de l'étape.
 */
test.describe('@etape:resa fumée', () => {
  test('capsule « Résa » → ≡ → « Nuits » ; la poignée se glisse vers le haut puis vers le bas', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openCompas(page);

    await cover.click(stepButton(page, 'resa'), 'l’étape « Résa » devient l’étape courante', async () => {
      await expectStep(page, 'resa');
      await expect(page.getByRole('region', { name: 'Mes réservations' })).toBeVisible();
    });
    await cover.click(detailsButton(page, 'resa'), 'le tiroir des réservations s’ouvre', () => expect(sheet(page)).toBeVisible());
    await cover.click(flowTab(page, 'Nuits'), 'l’onglet « Nuits » devient actif', () =>
      expect(flowTab(page, 'Nuits')).toHaveAttribute('aria-pressed', 'true')
    );

    // Hauteur moyenne d'abord (le tiroir s'ouvre en grand si son contenu déborde).
    if ((await sheet(page).getAttribute('data-detent')) === 'large')
      await sheet(page).getByRole('button', { name: 'Taille moyenne' }).click();
    await expect(sheet(page)).toHaveAttribute('data-detent', 'medium');

    await cover.drag(grab(page), { dy: -70 }, 'glisser la poignée vers le haut agrandit le tiroir', () =>
      expect(sheet(page)).toHaveAttribute('data-detent', 'large')
    );
    await capture(page, 'nuits-grand');
    await cover.drag(grab(page), { dy: 70 }, 'glisser la poignée vers le bas le ramène à la hauteur moyenne', () =>
      expect(sheet(page)).toHaveAttribute('data-detent', 'medium')
    );
  });
});
