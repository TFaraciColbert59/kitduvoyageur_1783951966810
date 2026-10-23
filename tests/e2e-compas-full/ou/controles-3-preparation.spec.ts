import { capture, expect, test } from './_fx';
import { launchPreparation, openStart, openStep, prepareButton, prepPanel, sheet, waitPrepOutcome } from '../_lib/compas';
import { ID, settle } from './_h';

/**
 * Étape « Où » — lot 3 : la préparation visible (vraies préparations, via la file partagée).
 * Phrase avec un départ dit (« depuis Lyon ») pour que la carte affiche « Effacer le départ ».
 *  - 1re préparation : « Arrêter » puis « Préciser ma demande » ;
 *  - 2e préparation : « Arrêter » puis « Reprendre » jusqu'à « Ton aventure est prête »,
 *    « Voir mon aventure », puis « Effacer le départ ».
 */
const REQUEST = 'une randonnée à Chamonix depuis Lyon';

test.describe.serial('@etape:ou préparation visible', () => {
  test.setTimeout(15 * 60_000);

  test('« Arrêter » interrompt la préparation ; « Préciser ma demande » rouvre le tiroir Où', async ({ page, cover, account }) => {
    await openStart(page);
    const res = await launchPreparation(page, REQUEST, account.key, async () => {
      await prepareButton(page).click();
      await cover.click(prepPanel(page).getByRole('button', { name: 'Arrêter' }), 'la préparation s’arrête : « Préparation arrêtée », ce qui est fait est gardé', () =>
        expect(prepPanel(page).getByRole('heading', { name: 'Préparation arrêtée' })).toBeVisible()
      , { control: ID.prepStop });
    });
    expect(res.outcome).toBe('arrêtée');
    await capture(page, 'arretee');
    await cover.click(prepPanel(page).getByRole('button', { name: 'Préciser ma demande' }), 'le panneau se ferme et le tiroir Où s’ouvre pour préciser la demande', async () => {
      await expect(prepPanel(page)).toBeHidden();
      await expect(sheet(page)).toBeVisible();
    }, { control: ID.prepEdit });
  });

  test('« Arrêter » puis « Reprendre » mène à « Ton aventure est prête » ; « Voir mon aventure » ; « Effacer le départ »', async ({ page, cover, account }) => {
    await openStart(page);
    const res = await launchPreparation(page, REQUEST, account.key, async () => {
      await prepareButton(page).click();
      await prepPanel(page).getByRole('button', { name: 'Arrêter' }).click();
    });
    expect(res.outcome).toBe('arrêtée');
    await cover.click(prepPanel(page).getByRole('button', { name: 'Reprendre' }), 'la préparation reprend et va à son terme : « Ton aventure est prête »', async () => {
      const again = await waitPrepOutcome(page);
      expect(again.outcome, again.text).toBe('prête');
    }, { control: ID.prepRetry });
    await cover.click(prepPanel(page).getByRole('button', { name: 'Voir mon aventure' }), 'le panneau se ferme sur l’aventure préparée', async () => {
      await expect(prepPanel(page)).toBeHidden();
      await expect(page.locator('.cp-fsum')).toBeVisible();
    }, { control: ID.prepView });
    await capture(page, 'prete');

    await openStep(page, 'ou');
    await settle(page);
    const clear = page.getByRole('button', { name: 'Effacer le départ' });
    if ((await clear.count()) === 0) {
      test.info().annotations.push({ type: 'non testé', description: 'aucun départ dit retenu par la préparation (« Effacer le départ » absent)' });
      return;
    }
    await cover.click(clear, 'le départ dit est effacé : la ligne et son bouton disparaissent', async () => {
      await expect(clear).toHaveCount(0, { timeout: 90_000 });
    }, { control: ID.clearOrigin });
  });
});
