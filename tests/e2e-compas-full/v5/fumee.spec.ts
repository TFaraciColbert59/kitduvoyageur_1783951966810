import { capture, expect, test } from '../_lib/fixtures';
import { gotoRetry } from '../_lib/net';
import { BASE_URL } from '../_lib/env';
import { expectNoHorizontalScroll } from '../_lib/compas';

/**
 * Fumée de l'écran v5 (carte vivante), EN LIGNE : du Compas vide à l'aventure préparée, puis chaque tiroir.
 * Un seul passage par worker (une préparation réelle coûte du quota) : les contrôles s'enchaînent sur la même aventure.
 * Les scénarios de l'ancien écran (`ou`, `nous`, `resa`, `verdict`, `kit`) visent `?v5=0`.
 */
const PHRASE = 'Randonnée en itinérance dans le Vercors, 3 jours à 2, départ le 12 novembre';

test.describe('@v5 fumée', () => {
  test('Compas vide → préparation visible → card, tiroirs, carte, réglages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // 1. Une seule question.
    await gotoRetry(page, `${BASE_URL}/compas?nouvelle=1`);
    const ask = page.getByRole('textbox', { name: 'Ta destination, en une phrase' });
    await expect(ask).toBeVisible({ timeout: 90_000 });
    await expectNoHorizontalScroll(page);
    await capture(page, 'v5-depart');
    await ask.fill(PHRASE);
    await ask.press('Enter');

    // 2. La préparation se voit dans l'îlot, puis annonce sa fin.
    const island = page.locator('.v5-island');
    await expect(island).toHaveAttribute('data-s', /live|note/, { timeout: 120_000 });
    await expect(island).toContainText(/Ton aventure est prête|La préparation s’est arrêtée|Préparation arrêtée/, { timeout: 340_000 });
    await expect(island).toContainText('Ton aventure est prête');
    await capture(page, 'v5-prete');
    await island.getByRole('button', { name: 'Voir' }).click();

    // 3. La card : un jour par tuile, les bulles, jamais de défilement horizontal.
    const tiles = page.locator('.v5-card .v5-tile');
    await expect(tiles.first()).toBeVisible();
    expect(await tiles.count()).toBeGreaterThanOrEqual(3);
    await expectNoHorizontalScroll(page);

    // 4. Chaque bulle ouvre son tiroir ; Échap le ferme et rend le focus.
    const bubbles: Array<[RegExp, RegExp]> = [
      [/^Nous/, /Seul|Avec d’autres|Personnes/],
      [/^Budget|prévus|€/, /Budget|Prévu/],
      [/^Sac/, /Ton sac/],
      [/^À prévoir/, /À réserver|À acheter/],
      [/^Vérif/, /Prêt à partir/],
      [/^Météo/, /Météo/],
    ];
    for (const [label, expected] of bubbles) {
      await page.locator('.v5-bubs').getByRole('button', { name: label }).first().click();
      const sheet = page.locator('.v5-sheet[data-open]');
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText(expected);
      await expectNoHorizontalScroll(page);
      await page.keyboard.press('Escape');
      await expect(page.locator('.v5-sheet[data-open]')).toHaveCount(0);
    }

    // 5. Un jour : ses chiffres réels, ses nuits (ou la raison de leur absence), la carte suit.
    await tiles.nth(1).click();
    const day = page.locator('.v5-sheet[data-open]');
    await expect(day).toContainText(/Jour 2/);
    await expect(day).toContainText(/Ce soir|Dernier jour/i);
    await expect(page.locator('.v5-map')).toBeVisible();
    await capture(page, 'v5-jour');
    await day.getByRole('button', { name: 'Fermer' }).first().click();

    // 6. « Dis-le » s'ouvre et se referme sans rien écrire.
    await page.getByRole('button', { name: 'Dis-le pour changer quoi que ce soit' }).click();
    await expect(page.getByRole('textbox', { name: 'Dis-le pour changer quoi que ce soit' })).toBeVisible();
    await page.keyboard.press('Escape');

    // 7. Les réglages du voyage rouvrent les parcours éprouvés.
    await page.getByRole('button', { name: 'Plus d’options' }).click();
    await page.getByRole('button', { name: /Réglages du voyage/ }).click();
    await expect(page.locator('.v5-legacy .cp-sheet[role="dialog"]')).toBeVisible();
    await capture(page, 'v5-reglages');

    expect(errors, 'erreurs JavaScript de la page').toEqual([]);
  });
});
