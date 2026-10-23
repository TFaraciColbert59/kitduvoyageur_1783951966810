import { C, addFreeItem, backSheet, expect, findRow, openSheet, removeItem, rowsNamed, sbtn, seg, selectTab, test, toast, uniq } from '../nous/fx';
import { sheet } from '../_lib/compas';
import type { Page } from '@playwright/test';

/**
 * Kit · ajouter un objet (« Ajouter au kit » : inventaire, boutique, objet libre), le formulaire
 * d'objet libre champ par champ, l'inventaire (catégories, fiche, ajout au kit), et l'ajout
 * depuis un conseil. Tout objet créé porte un nom unique et le kit est remis dans son état.
 */
const ADD = (s: string) => C(`CompasSheets.tsx::AddSheet::${s}`);
const FREE = (s: string) => C(`CompasSheets.tsx::FreeItemForm::${s}`);
const INV = (s: string) => C(`CompasSheets.tsx::InventaireFlow::${s}`);

/** « Tout (n) » du filtre de catégories de l'inventaire (distinct du parcours « Tout » du tiroir). */
const categoryAll = (page: Page) =>
  sheet(page).getByRole('group', { name: 'Catégorie' }).locator('button').filter({ hasText: /^\s*Tout \(/ });

async function openAddSheet(page: Page) {
  await sbtn(page, /Ajouter au kit/).click();
  await expect(sheet(page)).toHaveAttribute('aria-label', 'Ajouter au kit');
}

test.describe('@etape:kit ajouter', () => {
  test('« Ajouter au kit » : onglets de source, objet libre champ par champ, puis il est dans le kit', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    const name = uniq('Libre');
    await openSheet(page, 'kit', 'Tout');
    await cover.click(
      sbtn(page, /Ajouter au kit/),
      'le tiroir « Ajouter au kit » s’ouvre avec ses sources (Inventaire, Boutique, Autre)',
      async () => {
        await expect(sheet(page)).toHaveAttribute('aria-label', 'Ajouter au kit');
        await expect(seg(sheet(page), 'Boutique')).toBeVisible();
        await expect(seg(sheet(page), 'Autre')).toBeVisible();
      },
      { control: C('CompasSheets.tsx::KitListFlow::button::compas.sheets.common.addToKit') }
    );

    await cover.click(
      seg(sheet(page), 'Boutique'),
      'la source « Boutique » est active : des produits à ajouter sont listés',
      async () => {
        await expect(seg(sheet(page), 'Boutique')).toHaveAttribute('aria-pressed', 'true');
        await expect(sheet(page).locator('.cp-row').first()).toBeVisible();
      },
      { control: ADD('button::groupe:options') }
    );
    await cover.click(
      seg(sheet(page), 'Autre'),
      'la source « Autre » est active : le formulaire d’objet libre s’affiche',
      async () => {
        await expect(seg(sheet(page), 'Autre')).toHaveAttribute('aria-pressed', 'true');
        await expect(sheet(page).locator('input[name="itemName"]')).toBeVisible();
      },
      { control: ADD('button::groupe:options') }
    );

    const form = sheet(page).locator('form');
    await cover.fill(form.locator('input[name="itemName"]'), name, 'le nom est écrit', () =>
      expect(form.locator('input[name="itemName"]')).toHaveValue(name)
    , { control: FREE('input::compas.sheets.common.name') });
    await cover.select(form.locator('select[name="category"]'), 'tech', 'la catégorie « Électronique » est choisie', () =>
      expect(form.locator('select[name="category"]')).toHaveValue('tech')
    , { control: FREE('select::compas.sheets.common.category') });
    await cover.fill(form.locator('input[name="weightGrams"]'), '120', 'le poids 120 g est écrit', () =>
      expect(form.locator('input[name="weightGrams"]')).toHaveValue('120')
    , { control: FREE('input::compas.sheets.add.weight') });
    await cover.check(form.locator('input[name="isVital"]'), 'la case « Vital » est cochée', () =>
      expect(form.locator('input[name="isVital"]')).toBeChecked()
    , { control: FREE('input::compas.sheets.item.vital') });
    await cover.check(form.locator('input[name="isConsumable"]'), 'la case « Consommable » est cochée', () =>
      expect(form.locator('input[name="isConsumable"]')).toBeChecked()
    , { control: FREE('input::compas.sheets.item.consumable') });
    await cover.fill(form.locator('input[name="quantity"]'), '3', 'la quantité 3 est écrite', () =>
      expect(form.locator('input[name="quantity"]')).toHaveValue('3')
    , { control: FREE('input::compas.sheets.add.quantity') });
    await cover.click(
      form.locator('button[type="submit"]'),
      'l’objet est ajouté au kit : annonce « … ajouté au kit » et le formulaire est vidé',
      async () => {
        await expect(toast(page)).toContainText(`${name} ajouté au kit`);
        await expect(form.locator('input[name="itemName"]')).toHaveValue('');
      },
      { control: FREE('button::compas.sheets.common.add') }
    );

    await backSheet(page);
    const row = await findRow(page, name);
    await expect(row).toContainText(`3 × ${name}`);
    await expect(row).toContainText(/vital/);
    await removeItem(page, name);
  });

  test('boutique : « Ajouter » un produit au kit ; « Voir toute la boutique » après une recherche sans résultat', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openSheet(page, 'kit', 'Tout');
    await openAddSheet(page);
    await selectTab(page, 'Tout').catch(() => undefined);
    await seg(sheet(page), 'Boutique').click();

    const first = sheet(page).locator('.cp-row').filter({ has: page.locator('button.cp-btn--soft') }).first();
    const productName = (await first.locator('.cp-row__t b').innerText()).trim();
    await cover.click(
      first.locator('button.cp-btn--soft'),
      `« ${productName} » est ajouté au kit : annonce « … ajouté au kit »`,
      () => expect(toast(page)).toContainText('ajouté au kit'),
      { control: C('CompasSheets.tsx::ProductRow::button::cls:cp-btn') }
    );

    const search = sheet(page).locator('input[type="search"]');
    await search.fill('zzqqxx');
    await expect(sheet(page)).toContainText(/Aucun produit ne correspond/);
    await cover.click(
      sbtn(page, 'Voir toute la boutique'),
      'la recherche est effacée et les produits reviennent',
      async () => {
        await expect(search).toHaveValue('');
        await expect(sheet(page).locator('.cp-row').first()).toBeVisible();
      },
      { control: ADD('button::compas.sheets.add.seeAllShop') }
    );

    await backSheet(page);
    await removeItem(page, productName.slice(0, 40));
  });

  test('inventaire : ajouter à l’inventaire, l’ajouter au kit, catégories, fiche d’un objet déjà dans le kit', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    const a = uniq('Inv sécu');
    const b = uniq('Inv tech');

    // 1. Inventaire vide (espace neuf) : le lien « Ajouter à l’inventaire » de l’onglet Inventaire.
    await openSheet(page, 'kit', 'Inventaire');
    const empty = (await sheet(page).getByText('Ton inventaire est vide.').count()) > 0;
    if (empty) {
      await cover.click(
        sbtn(page, 'Ajouter à l’inventaire'),
        'le tiroir « Ajouter à l’inventaire » s’ouvre',
        () => expect(sheet(page)).toHaveAttribute('aria-label', 'Ajouter à l’inventaire'),
        { control: INV('button::compas.sheets.common.addToInventory') }
      );
      await backSheet(page);
    } else {
      test.info().annotations.push({
        type: 'etat',
        description: 'inventaire déjà rempli (espace réutilisé) : les deux liens « inventaire vide » ne sont exercés que sur un espace neuf',
      });
    }

    // 2. Dans « Ajouter au kit › Inventaire » (vide) : le même lien, côté tiroir d’ajout.
    await selectTab(page, 'Tout');
    await openAddSheet(page);
    await seg(sheet(page), 'Inventaire').click();
    if (empty) {
      await cover.click(
        sbtn(page, 'Ajouter à l’inventaire'),
        'le tiroir « Ajouter à l’inventaire » s’ouvre depuis la source Inventaire vide',
        () => expect(sheet(page)).toHaveAttribute('aria-label', 'Ajouter à l’inventaire'),
        { control: ADD('button::compas.sheets.common.addToInventory') }
      );
    } else {
      // Inventaire déjà rempli : on atteint le même tiroir par « Sources » du Verdict.
      await openSheet(page, 'verdict', 'Sources');
      await sbtn(page, 'Ajouter à l’inventaire').click();
    }
    // 3. Deux objets d'inventaire de catégories différentes (formulaire libre, cible inventaire).
    await expect(sheet(page)).toHaveAttribute('aria-label', 'Ajouter à l’inventaire');
    for (const [label, cat] of [[a, 'safety'], [b, 'tech']] as const) {
      await seg(sheet(page), 'Autre').click();
      const form = sheet(page).locator('form');
      await form.locator('input[name="itemName"]').fill(label);
      await form.locator('select[name="category"]').selectOption(cat);
      await form.locator('button[type="submit"]').click();
      await expect(toast(page)).toContainText(`${label} ajouté à l’inventaire`);
      // Le formulaire se vide une fois l'ajout fini : la saisie suivante ne doit pas être effacée par cette remise à zéro.
      await expect(form.locator('input[name="itemName"]')).toHaveValue('');
    }
    await backSheet(page);

    // 4. Onglet Inventaire : catégories, « Ajouter au kit : … », « Fiche : … ».
    await openSheet(page, 'kit', 'Inventaire');
    await cover.click(
      categoryAll(page),
      'l’onglet « Tout (n) » du filtre de catégories est actif : tous les objets d’inventaire sont listés',
      async () => {
        await expect(categoryAll(page)).toHaveAttribute('aria-pressed', 'true');
        await expect(sheet(page)).toContainText(a);
        await expect(sheet(page)).toContainText(b);
      },
      { control: INV('button::compas.sheets.common.category:all') }
    );
    const rowA = sheet(page).locator('div.cp-row').filter({ hasText: a });
    await cover.click(
      rowA.getByRole('button', { name: new RegExp(`Ajouter au kit : .*${a}`) }),
      `« ${a} » entre dans le kit : annonce « ajouté au kit » et le bouton devient « Fiche : … »`,
      async () => {
        await expect(toast(page)).toContainText(`${a} ajouté au kit`);
        await expect(rowA.getByRole('button', { name: new RegExp(`Fiche : .*${a}`) })).toBeVisible();
      },
      { control: INV('button::compas.sheets.inventory.addOf') }
    );
    await cover.click(
      rowA.getByRole('button', { name: new RegExp(`Fiche : .*${a}`) }),
      'la fiche de l’objet du kit s’ouvre',
      () => expect(sheet(page)).toHaveAttribute('aria-label', a),
      { control: INV('button::compas.sheets.inventory.itemOf') }
    );
    await backSheet(page);

    // 5. Source Inventaire du tiroir d'ajout : « Ajouter » (le second objet).
    await selectTab(page, 'Tout');
    await openAddSheet(page);
    await seg(sheet(page), 'Inventaire').click();
    const rowB = sheet(page).locator('.cp-row').filter({ hasText: b });
    await cover.click(
      rowB.locator('button.cp-btn--soft'),
      `« ${b} » entre dans le kit : annonce « ajouté au kit »`,
      () => expect(toast(page)).toContainText(`${b} ajouté au kit`),
      { control: ADD('button::compas.sheets.common.add') }
    );
    await backSheet(page);
    await removeItem(page, a);
    await removeItem(page, b);
  });

  test('conseil de kit non couvert : « Ajouter » ouvre l’ajout en grand, déjà cherché ; le kit est remis en état', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openSheet(page, 'kit', 'Conseils');
    const add = () => sheet(page).locator('.cp-row--tall button.cp-btn--soft').filter({ hasText: /^\s*Ajouter\s*$/ });
    // Tant que le conseil est couvert, l'objet qui le couvre est retiré (il peut y en avoir plusieurs).
    for (let i = 0; i < 8 && (await add().count()) === 0; i += 1) {
      const covered = (await sheet(page).innerText()).match(/couvert par « (.+?) »/)?.[1];
      expect(covered, 'un conseil couvert dit quel objet le couvre').toBeTruthy();
      await selectTab(page, 'Tout');
      await removeItem(page, (covered as string).slice(0, 30));
      await selectTab(page, 'Conseils');
      await page.waitForTimeout(800);
    }
    await expect(add().first()).toBeVisible({ timeout: 30_000 });
    await cover.click(
      add().first(),
      'l’ajout s’ouvre EN GRAND, titré « Ajouter au kit », la boutique déjà cherchée sur le mot du conseil',
      async () => {
        await expect(sheet(page)).toHaveAttribute('aria-label', 'Ajouter au kit');
        await expect(sheet(page)).toHaveAttribute('data-detent', 'large');
        await expect(sheet(page).locator('input[type="search"]')).not.toHaveValue('');
      },
      { control: C('CompasSheets.tsx::ConseilsFlow::button::compas.sheets.common.add') }
    );
    // Remise en état : un produit trouvé par ce mot est ajouté, le conseil redevient couvert.
    const rows = sheet(page).locator('.cp-row').filter({ has: page.locator('button.cp-btn--soft') });
    if (await rows.count()) {
      await rows.first().locator('button.cp-btn--soft').click();
      await expect(toast(page)).toContainText('ajouté au kit');
    } else {
      await seg(sheet(page), 'Autre').click();
      await sheet(page).locator('form button[type="submit"]').click();
      await expect(toast(page)).toContainText('ajouté au kit');
    }
    void rowsNamed;
    void addFreeItem;
  });
});
