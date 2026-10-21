import { C, addFreeItem, backSheet, expect, findRow, openSheet, removeItem, sbtn, seg, test, toast, uniq } from '../nous/fx';
import { sheet } from '../_lib/compas';
import type { Page } from '@playwright/test';

/**
 * Kit · « Trouver » un objet : Emprunter / Louer / Acheter, recherche, « Choisir » (bouton et
 * double-touche), liens (panier, location, Hub, fiche produit). AUCUN achat : « Choisir » relie
 * un produit à l'objet et le met au panier local ; la commande n'est jamais lancée.
 */
const ACQ = (s: string) => C(`CompasSheets.tsx::AcquireSheet::${s}`);
const PRODUCT = (s: string) => C(`CompasSheets.tsx::ProductRow::${s}`);
const productRows = (page: Page) => sheet(page).locator('.cp-list__page .cp-row, [role="group"] .cp-row').filter({ has: page.locator('button.cp-btn--soft') });

/** Ouvre le tiroir « Trouver : … » d'un objet jetable, sur un mode (hors couverture). */
async function openAcquire(page: Page, name: string | null, mode: 'Emprunter' | 'Louer' | 'Acheter') {
  await openSheet(page, 'kit', 'Tout');
  if (name) {
    await addFreeItem(page, name);
    await (await findRow(page, name)).locator('button.cp-row__main').click();
  } else {
    // Sans créer d'objet : la première ligne du kit (la navigation qui suit ne laisse rien à nettoyer).
    await sheet(page).locator('button.cp-row__main').first().click();
  }
  await sheet(page).getByRole('group', { name: 'Trouver cet objet' }).locator('button').filter({ hasText: mode }).click();
  await expect(sheet(page)).toHaveAttribute('aria-label', /Trouver : /);
}

test.describe('@etape:kit trouver', () => {
  test('modes Emprunter / Louer / Acheter, recherche, « Choisir » par bouton puis par double-touche', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    const name = uniq('Trouver');
    await openAcquire(page, name, 'Acheter');

    await cover.click(
      seg(sheet(page), 'Louer'),
      'le mode « Louer » est actif : la liste des locations (ou son absence) s’affiche',
      async () => {
        await expect(seg(sheet(page), 'Louer')).toHaveAttribute('aria-pressed', 'true');
        await expect(sheet(page)).toContainText(/location/i);
      },
      { control: ACQ('button::compas.sheets.acquire.modes:louer') }
    );
    await cover.click(
      seg(sheet(page), 'Emprunter'),
      'le mode « Emprunter » est actif : la consigne d’emprunt à l’équipe s’affiche',
      async () => {
        await expect(seg(sheet(page), 'Emprunter')).toHaveAttribute('aria-pressed', 'true');
        await expect(sheet(page)).toContainText(/Quelqu’un de l’équipe l’a/);
      },
      { control: ACQ('button::compas.sheets.acquire.modes:emprunter') }
    );
    await cover.click(
      seg(sheet(page), 'Acheter'),
      'le mode « Acheter » est actif : des produits de la boutique, chacun avec « Choisir »',
      async () => {
        await expect(seg(sheet(page), 'Acheter')).toHaveAttribute('aria-pressed', 'true');
        await expect(sheet(page).getByRole('button', { name: /^Choisir$/ }).first()).toBeVisible();
      },
      { control: ACQ('button::compas.sheets.acquire.modes:acheter') }
    );

    // Recherche : un mot du premier produit ne laisse que des produits qui le contiennent.
    const firstTitle = (await sheet(page).locator('.cp-row__t b').first().innerText()).trim();
    const term = firstTitle.split(/[\s/–-]+/).filter((w) => w.length >= 4).sort((a, b) => b.length - a.length)[0] ?? firstTitle.slice(0, 4);
    await cover.fill(
      sheet(page).locator('input[type="search"]'),
      term,
      `la liste ne garde que des produits contenant « ${term} »`,
      async () => {
        await expect(sheet(page).locator('input[type="search"]')).toHaveValue(term);
        const titles = sheet(page).locator('.cp-row__t b');
        await expect(titles.first()).toBeVisible();
        for (const t of await titles.allInnerTexts()) expect(t.toLowerCase()).toContain(term.toLowerCase());
      },
      { control: C('CompasSheets.tsx::SearchField::input::anonyme') }
    );
    await sheet(page).locator('input[type="search"]').fill('');

    // « Choisir » : un produit autre que celui déjà choisi → le bouton devient « Choisi ».
    const rows = sheet(page).locator('.cp-row').filter({ has: page.getByRole('button', { name: /^Choisir$/ }) });
    await expect(rows.first()).toBeVisible();
    const first = rows.first();
    const firstName = (await first.locator('.cp-row__t b').innerText()).trim();
    await cover.click(
      first.getByRole('button', { name: /^Choisir$/ }),
      `« ${firstName} » est choisi : son bouton devient « Choisi » (désactivé) et l’annonce « Ajouté au panier et relié au kit » s’affiche`,
      async () => {
        await expect(toast(page)).toContainText('Ajouté au panier et relié au kit');
        const done = sheet(page).locator('.cp-row').filter({ hasText: firstName }).getByRole('button', { name: /^Choisi$/ });
        await expect(done.first()).toBeDisabled();
      },
      { control: PRODUCT('button::cls:cp-btn') }
    );

    // Double-touche sur un autre produit : même effet que « Choisir ».
    const other = sheet(page).locator('.cp-row').filter({ has: page.getByRole('button', { name: /^Choisir$/ }) }).first();
    const otherName = (await other.locator('.cp-row__t b').innerText()).trim();
    await cover.doubleTap(
      other.locator('.cp-row__t'),
      `la double-touche choisit « ${otherName} » : son bouton devient « Choisi »`,
      async () => {
        const done = sheet(page).locator('.cp-row').filter({ hasText: otherName }).getByRole('button', { name: /^Choisi$/ });
        await expect(done.first()).toBeDisabled();
      },
      { control: PRODUCT('geste::geste:double-touche:compas.sheets.product.used') }
    );

    await backSheet(page);
    await backSheet(page);
    await removeItem(page, name);
  });

  test('liens de « Louer » : « Voir la location » mène à /location', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openAcquire(page, null, 'Louer');
    const link = sheet(page).getByRole('link', { name: 'Voir la location' });
    test.skip((await link.count()) === 0, 'des locations existent en boutique : le lien « Voir la location » (état vide) n’apparaît pas');
    await cover.click(link, 'la page de location s’ouvre (/location)', () => expect(page).toHaveURL(/\/location/), {
      control: ACQ('a::compas.sheets.acquire.seeRental'),
    });
  });

  test('liens d’« Emprunter » : « Inviter depuis le Hub » mène au groupe du Hub', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openAcquire(page, null, 'Emprunter');
    const link = sheet(page).getByRole('link', { name: 'Inviter depuis le Hub' });
    test.skip((await link.count()) === 0, 'des coéquipiers existent : le lien (état « personne d’autre ») n’apparaît pas');
    await cover.click(link, 'la gestion du groupe du Hub s’ouvre (/hub/groupe)', () => expect(page).toHaveURL(/\/hub\/groupe/), {
      control: ACQ('a::compas.sheets.acquire.inviteHub'),
    });
  });

  test('liens d’« Acheter » : « Voir le panier » et la fiche d’un produit', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openAcquire(page, null, 'Acheter');
    const fiche = sheet(page).getByRole('link', { name: /^Fiche produit : / }).first();
    await cover.click(fiche, 'la page du produit s’ouvre (/produit/…)', () => expect(page).toHaveURL(/\/produit\/[^/]+/), {
      control: PRODUCT('a::compas.sheets.product.pageOf'),
    });
    await openAcquire(page, null, 'Acheter');
    await cover.click(sheet(page).getByRole('link', { name: 'Voir le panier' }), 'le panier s’ouvre (/panier), sans commande lancée', async () => {
      await expect(page).toHaveURL(/\/panier/);
    }, { control: ACQ('a::compas.sheets.acquire.seeCart') });
  });
});

// Ce lot ne conclut jamais une commande ; ce fichier n'utilise pas ces aides, importées pour typage.
void sbtn;
