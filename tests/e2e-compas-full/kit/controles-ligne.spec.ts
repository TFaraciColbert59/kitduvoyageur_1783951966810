import { C, addFreeItem, backSheet, closeSheet, coverAct, expect, findRow, openAt, openSheet, rowsNamed, sbtn, test, toast, uniq } from '../nous/fx';
import { expectStep, sheet, stepButton } from '../_lib/compas';

/**
 * Kit · carte du Kit, capsule et ligne d'objet (toucher, zone, appui long, glisser,
 * « Retirer », emballer). Chaque contrôle est crédité par `cover.*` avec l'assertion de
 * son effet ; l'identifiant d'inventaire est donné quand le nom est entièrement calculé.
 */
test.describe('@etape:kit carte et ligne', () => {
  test('capsule → Kit, puis la carte : « prêt ? », conseils, sac d’une personne', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openAt(page, 'nous');
    await cover.click(
      stepButton(page, 'kit'),
      'la capsule passe sur Kit : la carte Kit (barre de poids, « prêt ? ») s’affiche',
      async () => {
        await expectStep(page, 'kit');
        await expect(page.locator('.cp-ready')).toBeVisible();
      },
      { control: C('CompasScreen.tsx::CompasScreen::button::COMPAS_STEPS:kit') }
    );

    await cover.click(
      page.locator('.cp-ready'),
      'le tiroir du Kit s’ouvre sur le parcours qui répond à l’état du sac (Trouver, Emballer ou Mes kits)',
      async () => {
        await expect(sheet(page)).toBeVisible();
        await expect(sheet(page).locator('.cp-seg [aria-pressed="true"]').first()).toHaveText(/^\s*(Trouver|Emballer|Mes kits)\s*$/);
      }
    );
    await closeSheet(page);

    await cover.click(
      page.locator('.compas button.cp-btn--soft').filter({ hasText: /Conseils|conseil/ }).first(),
      'le tiroir s’ouvre sur « Conseils »',
      async () => {
        await expect(sheet(page)).toBeVisible();
        await expect(sheet(page).locator('.cp-seg [aria-pressed="true"]').first()).toHaveText(/Conseils/);
      }
    );
    await closeSheet(page);

    await cover.click(page.locator('button.cp-mb').first(), 'le sac de la personne s’ouvre (« Mon sac »)', async () => {
      await expect(sheet(page)).toBeVisible();
      await expect(sheet(page)).toHaveAttribute('aria-label', /sac/i);
      await expect(sheet(page)).toContainText(/capacité|kg|g/);
    });
  });

  test('ligne d’objet : toucher, zone de la ligne, appui long, glisser puis « Retirer », emballer', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    const name = uniq('Jetable');
    await openSheet(page, 'kit', 'Tout');
    await addFreeItem(page, name);

    // Toucher : le bouton principal de la ligne (la commande clavier) ouvre la fiche.
    let row = await findRow(page, name);
    await cover.click(
      row.locator('button.cp-row__main'),
      'la fiche de l’objet s’ouvre (titre = nom de l’objet)',
      () => expect(sheet(page)).toHaveAttribute('aria-label', name),
      { control: C('CompasCards.tsx::KitRow::button::compas.cards.vital') }
    );
    await backSheet(page);

    // Zone de la ligne : un toucher dans la marge de la ligne, hors du bouton, ouvre aussi la fiche.
    row = await findRow(page, name);
    await coverAct(
      cover,
      row,
      'clic',
      'un toucher sur la zone de la ligne (hors bouton) ouvre la fiche',
      async () => {
        const onRow = await row.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return document.elementFromPoint(r.left + 3, r.top + 3) === el;
        });
        expect(onRow, 'le point touché est bien la ligne elle-même, pas son bouton').toBe(true);
        await row.click({ position: { x: 3, y: 3 } });
      },
      () => expect(sheet(page)).toHaveAttribute('aria-label', name),
      { control: C('CompasCards.tsx::KitRow::div::compas.cards.vital') }
    );
    await backSheet(page);

    // Appui long : la fiche s’ouvre en grand.
    row = await findRow(page, name);
    await cover.longPress(
      row,
      'l’appui long ouvre la fiche EN GRAND',
      async () => {
        await expect(sheet(page)).toHaveAttribute('aria-label', name);
        await expect(sheet(page)).toHaveAttribute('data-detent', 'large');
      },
      { control: C('CompasCards.tsx::KitRow::geste::geste:appui long:compas.cards.vital') }
    );
    await backSheet(page);

    // Glisser à gauche : « Retirer » apparaît ; le retrait demande ce second geste.
    row = await findRow(page, name);
    await cover.drag(
      row,
      { dx: -140 },
      'glisser la ligne vers la gauche fait apparaître « Retirer du kit : … »',
      () => expect(row.getByRole('button', { name: new RegExp(`Retirer du kit : .*${name}`) })).toBeVisible(),
      { control: C('CompasCards.tsx::KitRow::geste::geste:glisser:cp-row') }
    );
    await expect(rowsNamed(page, name)).toHaveCount(1);

    // Emballer / déballer : le rond de la ligne (le glissement a replié « Retirer » ou non, il reste là).
    await cover.click(
      row.locator('button.cp-ibtn'),
      'le rond passe à « emballé » (aria-pressed) et la ligne dit « Déballer »',
      async () => {
        await expect(row.locator('button.cp-ibtn')).toHaveAttribute('aria-pressed', 'true');
        await expect(row.locator('button.cp-ibtn')).toHaveAttribute('aria-label', /Déballer/);
      },
      { control: C('CompasCards.tsx::KitRow::button::cls:cp-ibtn') }
    );
    await row.locator('button.cp-ibtn').click();
    await expect(row.locator('button.cp-ibtn')).toHaveAttribute('aria-pressed', 'false');

    // « Retirer » : l’objet quitte le kit.
    await cover.click(
      row.getByRole('button', { name: new RegExp(`Retirer du kit : .*${name}`) }),
      'l’objet disparaît de la liste et l’annonce « retiré du kit » s’affiche',
      async () => {
        await expect(rowsNamed(page, name)).toHaveCount(0);
        await expect(toast(page)).toContainText('retiré du kit');
      },
      { control: C('CompasCards.tsx::KitRow::button::compas.cards.removeFromKit') }
    );
  });
});
