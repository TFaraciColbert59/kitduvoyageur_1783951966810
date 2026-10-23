import { capture, expect, test } from '../_lib/fixtures';
import { aiState, launchPreparation, openStart, prepareButton, prepPanel, requestBox } from '../_lib/compas';
import { REFERENCE_REQUEST } from '../_lib/env';

/**
 * Fumée — étape « Où » : du Compas vide à l'aventure préparée, en vrai.
 * Lot Où : ajouter ici les scénarios de l'étape (un `test` par geste ou par
 * parcours), avec `cover.*` pour chaque contrôle exercé.
 */
test.describe('@etape:ou fumée', () => {
  test('« Ta demande » → « Préparer mon aventure » → préparation prête → « Voir mon aventure »', async ({ page, cover, account }) => {
    await openStart(page);
    test.info().annotations.push({ type: 'compte', description: account.mode }, { type: 'IA', description: await aiState(page) });

    // La phrase est lue à la frappe, sans réseau : « Voici ce que j'ai compris ».
    await cover.type(requestBox(page), REFERENCE_REQUEST, 'le résumé compris affiche le lieu et la durée', async () => {
      const understood = page.locator('.cp-fsum');
      await expect(understood).toContainText('Vercors');
      await expect(understood).toContainText('3 jours');
      await expect(prepareButton(page)).toBeEnabled();
    });
    await capture(page, 'demande');

    const res = await launchPreparation(page, REFERENCE_REQUEST, account.key, () =>
      cover.click(prepareButton(page), 'le panneau de préparation s’ouvre', () => expect(prepPanel(page)).toBeVisible({ timeout: 90_000 }))
    );
    test.info().annotations.push({ type: 'préparation', description: `${res.outcome} en ${res.seconds} s (file : ${Math.round(res.waitedMs / 1000)} s)` });
    await capture(page, `issue-${res.outcome}`);
    expect(res.outcome, res.text).toBe('prête');
    await expect(prepPanel(page)).toContainText(/Budget\s+\d/);

    await cover.click(prepPanel(page).getByRole('button', { name: 'Voir mon aventure' }), 'le panneau se ferme sur l’aventure, un lieu par jour', async () => {
      await expect(prepPanel(page)).toBeHidden();
      const compas = page.locator('.compas');
      await expect(compas.getByText(/^Jour 1 · /).first()).toBeVisible();
    });
    const days = await page.locator('.compas').getByText(/^Jour \d+ · /).count();
    test.info().annotations.push({ type: 'jours affichés', description: String(days) });
    await capture(page, 'aventure');
  });
});
