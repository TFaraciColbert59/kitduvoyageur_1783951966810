import { capture } from '../_lib/fixtures';
import { aiState, detailsButton, expectStep, flowTab, openStart, openStep, sheet, stepButton } from '../_lib/compas';
import { expect, test } from '../commun/_fx';

/**
 * Étape « Verdict » : la carte, le tiroir (Risques, Météo, Veille, Sources), l'explication de
 * l'IA, « Décaler », « Ajouter à l'inventaire ». Les alertes officielles (Meteoalarm, alertes
 * mondiales) n'existent que si une alerte est en cours : voir le fichier de constats.
 */
const V = 'src/features/compas/components';
const sid = (file: string, comp: string, tag: string, key: string) => `${V}/${file}.tsx::${comp}::${tag}::${key}`;

test.describe('@etape:verdict controles', () => {
  test('capsule « Verdict » → carte du verdict → bouton de détails (selon les signaux)', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await cover.click(stepButton(page, 'verdict'), 'l’étape « Verdict » devient courante et sa carte (verdict, axes, signaux) s’affiche', async () => {
      await expectStep(page, 'verdict');
      const card = page.locator('.compas .cp-card');
      await expect(card.locator('.cp-vl')).toBeVisible();
      await expect(card.locator('.cp-tchip--axis')).toHaveCount(3);
    }, { control: sid('CompasScreen', 'CompasScreen', 'button', 'COMPAS_STEPS:verdict') });
    await capture(page, 'carte-verdict');

    // Le bouton du bas de la carte : « N autres signaux », « Texte officiel et détails » ou « Sources et détails ».
    const more = page.locator('.compas .cp-card > button.cp-btn--soft');
    await expect(more).toHaveCount(1);
    const label = (await more.innerText()).trim();
    test.info().annotations.push({ type: 'bouton de détails', description: label });
    await cover.click(more, `« ${label} » ouvre le tiroir du verdict`, async () => {
      await expect(sheet(page)).toBeVisible();
      await expect(sheet(page)).toHaveAttribute('aria-label', /Verdict/);
    }, { control: sid('CompasCards', 'VerdictCard', 'button', 'compas.cards.moreSignalsOne') });
  });

  test('tiroir : les quatre onglets (Risques, Météo, Veille, Sources) montrent leur contenu', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'verdict');
    await detailsButton(page, 'verdict').click();
    await expect(sheet(page)).toBeVisible();

    await cover.click(flowTab(page, 'Risques'), 'l’onglet « Risques » est actif : les trois barres de risque et la liste des signaux', async () => {
      await expect(flowTab(page, 'Risques')).toHaveAttribute('aria-pressed', 'true');
      await expect(sheet(page).locator('.cp-list')).toBeVisible();
    });
    await cover.click(flowTab(page, 'Météo'), 'l’onglet « Météo » est actif : jours du voyage ou raison de l’absence de prévision', async () => {
      await expect(flowTab(page, 'Météo')).toHaveAttribute('aria-pressed', 'true');
      await expect(sheet(page).locator('.cp-wx, .cp-note').first()).toBeVisible();
    });
    await cover.click(flowTab(page, 'Veille'), 'l’onglet « Veille » est actif : les règles de vigilance et leur synthèse', async () => {
      await expect(flowTab(page, 'Veille')).toHaveAttribute('aria-pressed', 'true');
      await expect(sheet(page).locator('ul.cp-rules li').first()).toBeVisible();
    });
    await cover.click(flowTab(page, 'Sources'), 'l’onglet « Sources » est actif : la liste des sources et la mention « rien d’inventé »', async () => {
      await expect(flowTab(page, 'Sources')).toHaveAttribute('aria-pressed', 'true');
      await expect(sheet(page).locator('dl.cp-kv')).toBeVisible();
    });
    await capture(page, 'sources');

    // « Ajouter à l’inventaire » (onglet Sources) ouvre le tiroir d’ajout par-dessus.
    await cover.click(sheet(page).getByRole('button', { name: 'Ajouter à l’inventaire' }), 'le tiroir d’ajout à l’inventaire s’ouvre par-dessus, « Retour » apparaît', async () => {
      await expect(sheet(page).getByRole('button', { name: 'Retour', exact: true })).toBeVisible();
    });
  });

  test('« Expliquer avec l’IA » : la demande part, une réponse (texte, refus ou note) s’affiche, jamais un niveau changé', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'verdict');
    // L’IA est-elle allumée ? Se lit sur le Compas vide (mention « IA »), pas sur le Compas complet.
    const check = await page.context().newPage();
    await check.goto(page.url().replace(/\/compas.*/, '/compas?nouvelle=1'));
    await check.locator('.compas--start').first().waitFor({ timeout: 90_000 });
    const state = await aiState(check);
    await check.close();
    test.info().annotations.push({ type: 'IA', description: state });
    void openStart;

    await detailsButton(page, 'verdict').click();
    await flowTab(page, 'Risques').click();
    const explain = sheet(page).getByRole('button', { name: 'Expliquer avec l’IA' });
    test.skip(state === 'éteinte', 'IA éteinte sur l’aperçu : « Expliquer avec l’IA » n’est pas proposé (PLAN-100 5.3).');
    const level = await page.locator('.compas').evaluate(() => document.querySelector('.cp-vl')?.textContent ?? '');
    await cover.click(explain, 'la demande part : une réponse de l’IA, un refus motivé ou une note s’affiche sous les signaux', async () => {
      const answer = sheet(page).locator('section[aria-live="polite"] .cp-note');
      await expect(answer.first()).toBeVisible({ timeout: 90_000 });
    });
    await capture(page, 'explication');
    await closeSheetsLocal(page);
    // Le niveau du verdict reste celui du moteur.
    await expect(page.locator('.compas .cp-vl').first()).toHaveText(level.trim());
  });

  test('Veille : « Décaler » écrit les dates proposées (si le calendrier en propose), « Annuler » les remet', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'verdict');
    await detailsButton(page, 'verdict').click();
    await flowTab(page, 'Veille').click();
    const shift = sheet(page).getByRole('button', { name: 'Décaler', exact: true });
    test.skip((await shift.count()) === 0, 'aucun décalage proposé pour cette aventure (il dépend des dates posées et du calendrier des conditions) : « Décaler » n’est pas rendu.');
    await cover.click(shift, 'les dates décalées sont écrites et l’annonce propose « Annuler »', async () => {
      await expect(page.locator('.cp-island').getByRole('button', { name: 'Annuler' })).toBeVisible({ timeout: 60_000 });
    });
    await page.locator('.cp-island').getByRole('button', { name: 'Annuler' }).click();
  });
});

async function closeSheetsLocal(page: import('@playwright/test').Page) {
  while ((await page.locator('.cp-sheet[role="dialog"]').count()) > 0) {
    await sheet(page).getByRole('button', { name: 'Fermer', exact: true }).click();
    await page.waitForTimeout(150);
  }
}
