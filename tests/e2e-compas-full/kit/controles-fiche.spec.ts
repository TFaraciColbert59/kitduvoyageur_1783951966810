import { C, addFreeItem, backSheet, expect, findRow, openItemWithProduct, openSheet, removeItem, rowsNamed, sbtn, seg, test, toast, uniq } from '../nous/fx';
import { sheet } from '../_lib/compas';

/**
 * Kit · fiche d'un objet : onglets Fiche / Historique, emballer, porteur, « trouver »,
 * retrait confirmé ou annulé, historique hors ligne puis « Réessayer », liens (fiche
 * produit, commandes). Les objets jetables portent un nom unique et sont retirés à la fin.
 */
const KIT = (s: string) => C(`CompasSheets.tsx::ItemSheet::${s}`);

test.describe('@etape:kit fiche objet', () => {
  test('onglets Historique / Fiche, emballer, « Trouver cet objet », porteur, retrait annulé puis confirmé', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    const name = uniq('Fiche');
    await openSheet(page, 'kit', 'Tout');
    await addFreeItem(page, name);
    await (await findRow(page, name)).locator('button.cp-row__main').click();
    await expect(sheet(page)).toHaveAttribute('aria-label', name);

    await cover.click(
      seg(sheet(page), 'Historique'),
      'l’onglet « Historique » est actif et l’historique de l’objet se lit',
      async () => {
        await expect(seg(sheet(page), 'Historique')).toHaveAttribute('aria-pressed', 'true');
        await expect(sheet(page).locator('.cp-hist')).toBeVisible();
        await expect(sheet(page).locator('.cp-hist')).toContainText(/Lecture|inventaire|Aucun|événement|prêt|voyage|commande/i);
      },
      { control: KIT('button::compas.sheets.item.tabs:historique') }
    );
    await cover.click(
      seg(sheet(page), 'Fiche'),
      'l’onglet « Fiche » est actif et le poids, le porteur et le statut s’affichent',
      async () => {
        await expect(seg(sheet(page), 'Fiche')).toHaveAttribute('aria-pressed', 'true');
        await expect(sheet(page).locator('dl.cp-kv')).toContainText('Poids');
        await expect(sheet(page).locator('dl.cp-kv')).toContainText('Porteur');
      },
      { control: KIT('button::compas.sheets.item.tabs:fiche') }
    );

    // Emballer → le bouton dit « Déballer », la pastille « Emballé » apparaît.
    await cover.click(
      sbtn(page, /Emballer|Déballer/).first(),
      'l’objet est emballé : la pastille « Emballé » apparaît et le bouton dit « Déballer »',
      async () => {
        await expect(sheet(page).locator('.cp-chip, [class*="chip"]').filter({ hasText: 'Emballé' }).first()).toBeVisible();
        await expect(sbtn(page, 'Déballer')).toBeVisible();
      },
      { control: KIT('button::compas.sheets.item.unpack') }
    );
    await sbtn(page, 'Déballer').click();
    await expect(sbtn(page, 'Emballer')).toBeVisible();

    // « Trouver cet objet » : Emprunter / Louer / Acheter ouvrent la recherche de l'objet.
    await cover.click(
      sheet(page).getByRole('group', { name: 'Trouver cet objet' }).locator('button').filter({ hasText: 'Acheter' }),
      'la fiche « Trouver : … » s’ouvre sur le mode Acheter',
      async () => {
        await expect(sheet(page)).toHaveAttribute('aria-label', new RegExp(`Trouver : .*${name}`));
        await expect(seg(sheet(page), 'Acheter')).toHaveAttribute('aria-pressed', 'true');
      },
      { control: KIT('button::anonyme') }
    );
    await backSheet(page);

    // Porteur.
    await cover.click(sbtn(page, 'Porteur'), 'la fiche « Porteur de … » s’ouvre', () =>
      expect(sheet(page)).toHaveAttribute('aria-label', new RegExp(`Qui porte : .*${name}`))
    );
    await backSheet(page);

    // Retrait : demande de confirmation, « Annuler » la referme, « Confirmer » retire.
    await cover.click(sbtn(page, 'Retirer du kit'), 'une confirmation du retrait apparaît (Confirmer / Annuler)', async () => {
      await expect(sbtn(page, 'Confirmer le retrait')).toBeVisible();
      await expect(sbtn(page, 'Annuler')).toBeVisible();
    });
    await cover.click(sbtn(page, 'Annuler'), 'la confirmation se referme, l’objet est toujours là', async () => {
      await expect(sbtn(page, 'Retirer du kit')).toBeVisible();
      await expect(sbtn(page, 'Confirmer le retrait')).toHaveCount(0);
    });
    await sbtn(page, 'Retirer du kit').click();
    await cover.click(sbtn(page, 'Confirmer le retrait'), 'l’objet est retiré du kit : retour à la liste, sans la ligne', async () => {
      await expect(toast(page)).toContainText('Retiré du kit');
      await expect(rowsNamed(page, name)).toHaveCount(0);
    });
  });

  test('historique hors ligne : l’erreur est dite, « Réessayer » relit une fois le réseau revenu', async ({ page, cover, preparedTrip, goOffline }) => {
    expect(preparedTrip.ok).toBe(true);
    const name = uniq('Hors ligne');
    await openSheet(page, 'kit', 'Tout');
    await addFreeItem(page, name);
    await (await findRow(page, name)).locator('button.cp-row__main').click();
    await expect(sheet(page)).toHaveAttribute('aria-label', name);

    await goOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await seg(sheet(page), 'Historique').click();
    await expect(sheet(page).locator('.cp-hist [role="alert"]')).toContainText(/Connexion perdue|réessaie|impossible/i);

    await goOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await cover.click(
      sheet(page).locator('.cp-hist [role="alert"] button'),
      'le réseau revenu, « Réessayer » relit l’historique : l’alerte d’erreur disparaît',
      async () => {
        await expect(sheet(page).locator('.cp-hist [role="alert"]')).toHaveCount(0);
        await expect(sheet(page).locator('.cp-hist')).not.toContainText(/Connexion perdue/);
      },
      { control: C('CompasItemHistory.tsx::ItemHistory::button::compas.history.retry') }
    );

    await backSheet(page);
    await removeItem(page, name);
  });

  test('historique d’un objet relié à un produit : « Voir mes commandes » mène à ses commandes', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openSheet(page, 'kit', 'Tout');
    await openItemWithProduct(page);
    await seg(sheet(page), 'Historique').click();
    const link = sheet(page).getByRole('link', { name: /Voir mes commandes/ });
    await cover.click(
      link,
      'le lien mène à la page de mes commandes (/compte, onglet commandes)',
      async () => {
        await expect(page).toHaveURL(/\/compte/);
        await expect(page).toHaveURL(/tab=commandes/);
      },
      { control: C('CompasItemHistory.tsx::ItemHistory::a::compas.history.orders') }
    );
  });

  test('fiche : « Fiche produit » mène à la page du produit choisi', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openSheet(page, 'kit', 'Tout');
    await openItemWithProduct(page);
    await cover.click(
      sheet(page).getByRole('link', { name: /^\s*(.*\s)?Fiche produit\s*$/ }),
      'la page du produit s’ouvre (/produit/…)',
      () => expect(page).toHaveURL(/\/produit\/[^/]+/),
      { control: KIT('a::compas.sheets.item.productPage') }
    );
    await expect(page.locator('main, body')).not.toContainText(/404|introuvable/i);
  });
});
