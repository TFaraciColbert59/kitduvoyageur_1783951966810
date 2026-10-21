import { capture, expect, test } from '../_lib/fixtures';
import { detailsButton, expectNoHorizontalScroll, expectStep, flowTab, openStep, sheet } from '../_lib/compas';

/**
 * Fumée — étape « Verdict » : le tiroir (Météo, Sources), le bouton plein
 * écran / taille moyenne de l'en-tête, puis l'affichage « plein soleil ».
 * Lot Verdict+Kit : ajouter ici les scénarios de l'étape.
 */
test.describe('@etape:verdict fumée', () => {
  test('≡ → « Météo » → « Sources » ; plein écran puis taille moyenne ; « Affichage » → mode plein soleil', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'verdict');
    await expectStep(page, 'verdict');
    await expectNoHorizontalScroll(page);

    await cover.click(detailsButton(page, 'verdict'), 'le tiroir du verdict s’ouvre', () => expect(sheet(page)).toBeVisible());
    await cover.click(flowTab(page, 'Météo'), 'l’onglet « Météo » devient actif', () =>
      expect(flowTab(page, 'Météo')).toHaveAttribute('aria-pressed', 'true')
    );
    await cover.click(flowTab(page, 'Sources'), 'l’onglet « Sources » devient actif', () =>
      expect(flowTab(page, 'Sources')).toHaveAttribute('aria-pressed', 'true')
    );
    await capture(page, 'sources');

    // L'en-tête : « Plein écran » (moyen → grand), puis « Taille moyenne » (grand → moyen).
    if ((await sheet(page).getAttribute('data-detent')) === 'large')
      await cover.click(sheet(page).getByRole('button', { name: 'Taille moyenne' }), 'le tiroir revient à la hauteur moyenne', () =>
        expect(sheet(page)).toHaveAttribute('data-detent', 'medium')
      );
    await cover.click(sheet(page).getByRole('button', { name: 'Plein écran' }), 'le tiroir passe en grand', () =>
      expect(sheet(page)).toHaveAttribute('data-detent', 'large')
    );
    await cover.click(sheet(page).getByRole('button', { name: 'Taille moyenne' }), 'le tiroir revient à la hauteur moyenne', () =>
      expect(sheet(page)).toHaveAttribute('data-detent', 'medium')
    );
    await sheet(page).getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(page.locator('.cp-sheet[role="dialog"]')).toHaveCount(0);

    await cover.click(page.getByRole('button', { name: 'Affichage : plein soleil et transparence du verre' }), 'le réglage « Affichage » s’ouvre', () =>
      expect(page.getByRole('dialog', { name: 'Affichage' })).toBeVisible()
    );
    const sun = page.getByRole('switch', { name: 'Mode plein soleil' });
    const was = (await sun.getAttribute('aria-checked')) === 'true';
    await cover.click(sun, 'le mode plein soleil change d’état et l’écran le suit', async () => {
      await expect(sun).toHaveAttribute('aria-checked', String(!was));
      if (!was) await expect(page.locator('.compas[data-outdoor="1"]')).toHaveCount(1);
      else await expect(page.locator('.compas[data-outdoor="1"]')).toHaveCount(0);
    });
    await capture(page, 'plein-soleil');
    // Remise en état : le réglage est gardé par le navigateur (localStorage) du compte de test.
    await sun.click();
    await expect(sun).toHaveAttribute('aria-checked', String(was));
  });
});
