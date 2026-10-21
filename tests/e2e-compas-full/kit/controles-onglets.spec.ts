import { C, addFreeItem, backSheet, expect, findRow, openSheet, removeItem, sbtn, seg, selectTab, test, toast, uniq } from '../nous/fx';
import { expectNoHorizontalScroll, flowTab, sheet } from '../_lib/compas';

/**
 * Kit · les huit parcours du tiroir (Conseils, Mes kits, Inventaire, Trouver, Emballer, Tout,
 * Sacs, Eau) et « Mes kits » : créer un kit depuis le voyage (nom, saison), puis l'appliquer.
 */
const STEP = (id: string) => C(`CompasSheets.tsx::StepSheet::button::compas.sheets.step.flows:kit.${id}`);
const KITS = (s: string) => C(`CompasSheets.tsx::MesKitsFlow::${s}`);

test.describe('@etape:kit onglets et Mes kits', () => {
  test('les huit parcours du tiroir Kit s’ouvrent chacun sur leur contenu', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openSheet(page, 'kit');
    const on = (label: string) => expect(flowTab(page, label)).toHaveAttribute('aria-pressed', 'true');
    const tab = (id: string, label: string, effet: string, content: () => Promise<unknown>) =>
      cover.click(flowTab(page, label), effet, async () => {
        await on(label);
        await content();
        await expectNoHorizontalScroll(page);
      }, { control: STEP(id) });

    await tab('conseils', 'Conseils', '« Conseils » est actif : les repères du kit s’affichent', () =>
      expect(sheet(page)).toContainText(/Des repères tirés de la météo/)
    );
    await tab('mes-kits', 'Mes kits', '« Mes kits » est actif : le bouton de création et la consigne d’application s’affichent', async () => {
      await expect(sheet(page)).toContainText(/Appliquer un kit ajoute au voyage/);
    });
    await tab('inventaire', 'Inventaire', '« Inventaire » est actif : l’inventaire (ou son absence) est dit', () =>
      expect(sheet(page)).toContainText(/inventaire/i)
    );
    await tab('trouver', 'Trouver', '« Trouver » est actif : seuls les objets « À trouver » (ou « rien à trouver ») sont listés', async () => {
      const rows = sheet(page).locator('div.cp-row').filter({ has: page.locator('button.cp-row__main') });
      if (await rows.count()) for (const t of await rows.locator('.cp-row__t span').allInnerTexts()) expect(t).not.toMatch(/\bEmballé\b/);
      await expect(sheet(page).locator('[role="group"], .cp-note').first()).toBeVisible();
    });
    await tab('emballer', 'Emballer', '« Emballer » est actif : seuls les objets non emballés sont listés, chacun avec son rond', async () => {
      const balls = sheet(page).locator('div.cp-row button.cp-ibtn');
      for (const b of await balls.all()) await expect(b).toHaveAttribute('aria-pressed', 'false');
    });
    await tab('tout', 'Tout', '« Tout » est actif : tout le kit et « Ajouter au kit »', () =>
      expect(sbtn(page, /Ajouter au kit/)).toBeVisible()
    );
    await tab('sacs', 'Sacs', '« Sacs » est actif : le sac de chaque personne est listé', () =>
      expect(sheet(page)).toContainText(/Sac de /)
    );
    await tab('eau', 'Eau', '« Eau » est actif : le besoin en eau par personne et les contenants s’affichent', () =>
      expect(sheet(page)).toContainText(/Eau par personne|Durée de marche non renseignée/)
    );
  });

  test('Mes kits : créer un kit (nom, saison) depuis le voyage, puis l’appliquer quand il manque un objet', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    const tmp = uniq('Pour kit');
    const kitName = uniq('Kit banc');
    await openSheet(page, 'kit', 'Tout');
    await addFreeItem(page, tmp);
    await selectTab(page, 'Mes kits');

    await cover.click(
      sbtn(page, 'Créer mon kit'),
      'le formulaire de création du kit s’ouvre (nom, saison)',
      async () => {
        await expect(sheet(page).locator('form[aria-label="Créer mon kit"]')).toBeVisible();
        await expect(sbtn(page, 'Créer mon kit')).toHaveCount(0);
      },
      { control: KITS('button::compas.sheets.kits.create') }
    );
    const form = sheet(page).locator('form[aria-label="Créer mon kit"]');
    await cover.fill(form.locator('input[name="kitName"]'), kitName, 'le nom du kit est écrit', () =>
      expect(form.locator('input[name="kitName"]')).toHaveValue(kitName)
    , { control: KITS('input::compas.sheets.common.name') });
    await cover.select(form.locator('select[name="season"]'), 'ete', 'la saison « Été » est choisie', () =>
      expect(form.locator('select[name="season"]')).toHaveValue('ete')
    , { control: KITS('select::compas.sheets.kits.season') });
    // Le même bouton dit « Ajoute d’abord des objets » (désactivé) tant que le voyage est vide.
    await cover.click(
      form.locator('button[type="submit"]'),
      'le kit est créé : annonce « Kit « … » créé » et il apparaît dans « Mes kits » avec sa saison',
      async () => {
        await expect(toast(page)).toContainText(`Kit « ${kitName} » créé`);
        await expect(sheet(page).locator('.cp-row--tall').filter({ hasText: kitName })).toContainText(/été/);
      },
      { control: KITS('button::compas.sheets.kits.addFirst') }
    );

    // Un objet du kit manque au voyage : le même bouton devient « Appliquer » (au lieu de « Déjà complet »).
    const kitRow = () => sheet(page).locator('.cp-row--tall').filter({ hasText: kitName });
    await expect(kitRow().locator('button')).toBeDisabled();
    await expect(kitRow()).toContainText(/0 à ajouter/);
    await selectTab(page, 'Tout');
    await removeItem(page, tmp);
    await selectTab(page, 'Mes kits');
    await expect(kitRow()).toContainText(/1 à ajouter/);
    await cover.click(
      kitRow().locator('button'),
      'l’objet manquant est ajouté au voyage : annonce « 1 objet ajouté », le kit devient « Déjà complet »',
      async () => {
        await expect(toast(page)).toContainText('1 objet ajouté');
        await expect(kitRow()).toContainText(/0 à ajouter/);
        await expect(kitRow().locator('button')).toBeDisabled();
        await expect(kitRow().locator('button')).toHaveText(/Déjà complet/);
      },
      { control: KITS('button::compas.sheets.kits.complete') }
    );

    await selectTab(page, 'Tout');
    await removeItem(page, tmp);
    void backSheet;
    void findRow;
    void seg;
  });
});
