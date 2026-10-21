import { C, addFreeItem, backSheet, closeSheet, expect, findRow, openSheet, removeItem, sbtn, seg, selectTab, test, toast, uniq } from '../nous/fx';
import { sheet } from '../_lib/compas';

/**
 * Kit · porteur d'un objet (commun au groupe / personnel, « moi », « personne pour
 * l'instant »), puis ses conséquences : alerte « objet commun sans porteur » de la carte Kit,
 * onglet « Sacs » (qui porte ? / sac de …).
 */
const CAR = (s: string) => C(`CompasSheets.tsx::CarrierSheet::${s}`);

test.describe('@etape:kit porteur et sacs', () => {
  test('porteur : Commun / Personnel, « moi porte », « Personne pour l’instant » ; alerte de la carte ; Sacs', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    const name = uniq('Porté');
    await openSheet(page, 'kit', 'Tout');
    await addFreeItem(page, name);
    await (await findRow(page, name)).locator('button.cp-row__main').click();
    await sbtn(page, 'Porteur').click();
    await expect(sheet(page)).toHaveAttribute('aria-label', new RegExp(`Qui porte : .*${name}`));

    await cover.click(
      seg(sheet(page), 'Personnel'),
      'l’onglet « Personnel » est actif : « Personne pour l’instant » disparaît',
      async () => {
        await expect(seg(sheet(page), 'Personnel')).toHaveAttribute('aria-pressed', 'true');
        await expect(sbtn(page, 'Personne pour l’instant')).toHaveCount(0);
      },
      { control: CAR('button::compas.sheets.carrier.type:perso') }
    );
    await cover.click(
      seg(sheet(page), 'Commun au groupe'),
      'l’onglet « Commun au groupe » est actif : « Personne pour l’instant » apparaît',
      async () => {
        await expect(seg(sheet(page), 'Commun au groupe')).toHaveAttribute('aria-pressed', 'true');
        await expect(sbtn(page, 'Personne pour l’instant')).toBeVisible();
      },
      { control: CAR('button::compas.sheets.carrier.type:commun') }
    );

    // Moi : porte l'objet, commun au groupe.
    await cover.click(
      sheet(page).locator('button.cp-row').filter({ hasText: '(moi)' }).first(),
      'je porte l’objet : annonce « … porte … », retour à la fiche, porteur = moi',
      async () => {
        await expect(toast(page)).toContainText(/porte/);
        await expect(sheet(page)).toHaveAttribute('aria-label', name);
        await expect(sheet(page).locator('dt', { hasText: 'Porteur' }).locator('+ dd')).not.toHaveText(/chacun le sien|personne pour l’instant/);
      },
      { control: CAR('button::compas.sheets.common.withMe') }
    );

    // Personne pour l'instant : l'objet commun n'a plus de porteur.
    await sbtn(page, 'Porteur').click();
    await cover.click(
      sbtn(page, 'Personne pour l’instant'),
      'l’objet n’a plus de porteur : annonce « sans porteur », fiche = « personne pour l’instant »',
      async () => {
        await expect(toast(page)).toContainText(/sans porteur/);
        await expect(sheet(page).locator('dl.cp-kv')).toContainText('personne pour l’instant');
      },
      { control: CAR('button::compas.sheets.carrier.nobody') }
    );
    await closeSheet(page);

    // La carte Kit alerte : « objet commun sans porteur » ouvre l'onglet Sacs.
    await expect(page.locator('.compas button.cp-alertline')).toBeVisible();
    await cover.click(
      page.locator('.compas button.cp-alertline').first(),
      'le tiroir s’ouvre sur « Sacs » et liste l’objet commun sans porteur',
      async () => {
        await expect(seg(sheet(page), 'Sacs')).toHaveAttribute('aria-pressed', 'true');
        await expect(sheet(page)).toContainText('Commun sans porteur');
      },
      { control: C('CompasCards.tsx::KitCard::button::cls:cp-alertline') }
    );

    // Sacs : « Qui porte ? » ouvre le porteur ; « Sac de … » ouvre le sac.
    const unassigned = sheet(page).locator('button.cp-row').filter({ hasText: name });
    await cover.click(
      unassigned,
      'la fiche « Qui porte : … » s’ouvre pour l’objet sans porteur',
      () => expect(sheet(page)).toHaveAttribute('aria-label', new RegExp(`Qui porte : .*${name}`)),
      { control: C('CompasSheets.tsx::SacsFlow::button::compas.sheets.bags.unassigned') }
    );
    await backSheet(page);
    await cover.click(
      sheet(page).locator('button.cp-row').filter({ hasText: /^\s*(VÀ|[A-ZÀ-Ý]{1,2})?\s*Sac de / }).first(),
      'le sac de la personne s’ouvre avec son poids et son contenu',
      async () => {
        await expect(sheet(page)).toHaveAttribute('aria-label', /sac/i);
        await expect(sheet(page)).toContainText(/capacité|kg|g/);
      },
      { control: C('CompasSheets.tsx::SacsFlow::button::compas.sheets.title.bagOf') }
    );
    await backSheet(page);
    await selectTab(page, 'Tout');
    await removeItem(page, name);
  });
});
