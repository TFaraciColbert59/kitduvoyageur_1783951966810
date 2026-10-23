import { capture, expect, test } from './_fx';
import { detailsButton, flowTab, openStep, sheet } from '../_lib/compas';
import { ID, closeSheet, pill, quiet, reopenIfPicker, settle, tileId } from './_h';

/**
 * Étape « Où » — lot 2 : les gestes qui MODIFIENT l'aventure de référence. Ordre fixe (série) :
 *  1. « Annuler la préparation » : l'aventure n'est plus préremplie, donc plus réadaptée à chaque
 *     retouche (sinon chaque changement relance un calcul serveur de 1 à 3 minutes et grise les
 *     contrôles) ;
 *  2. tuiles d'activité, préférences, « Quand », règle de durée ;
 *  3. « Tout préparer pour moi » : l'aventure est préremplie de nouveau (les scénarios suivants,
 *     dont Résa, retrouvent une aventure complète).
 */
const ACTIVITIES: Array<[string, string]> = [
  ['trekking', 'Trek'],
  ['trail', 'Trail'],
  ['running', 'Course à pied'],
  ['bivouac', 'Bivouac'],
  ['cycling', 'Vélo'],
  ['mountaineering', 'Alpinisme'],
  ['climbing', 'Escalade'],
  ['ski', 'Ski'],
  ['water', 'Eau'],
  ['roadtrip', 'Road trip'],
  ['vanlife', 'Van'],
  ['cultural', 'Culturel'],
  ['citytrip', 'City trip'],
  ['beach', 'Plage'],
  ['bushcraft', 'Bushcraft'],
  ['mixed', 'Mixte'],
  ['hiking', 'Randonnée'],
];

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

test.describe('@etape:ou retouches de l’aventure', () => {
  test.setTimeout(40 * 60_000);

  test('« Annuler la préparation » défait le prérempli et propose « Tout préparer pour moi »', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await settle(page);
    const undo = page.getByRole('button', { name: 'Annuler la préparation' });
    let sawPicker = false;
    const again = page.getByRole('button', { name: 'Tout préparer pour moi' });
    // Rejeu : une aventure déjà « annulée » (passage précédent interrompu) est d'abord reprise.
    if (await again.count()) {
      await again.click();
      await expect(undo).toBeVisible({ timeout: 900_000 });
      await settle(page);
    }
    await cover.click(undo, 'le prérempli est défait : « Tout préparer pour moi » est proposé', async () => {
      const picker = page.getByText('Quelle aventure préparer ?');
      await expect(again.or(picker)).toBeVisible({ timeout: 120_000 });
      if (await picker.isVisible()) {
        sawPicker = true;
        // Constat O-01 : l'aventure n'est plus « active » après l'annulation ; on la rouvre pour poursuivre.
        test.info().annotations.push({ type: 'constat', description: 'O-01' });
        await reopenIfPicker(page);
      }
      await expect(again).toBeVisible({ timeout: 120_000 });
      await expect(undo).toHaveCount(0);
    }, { control: ID.undoPrep });
    await capture(page, 'prepa-annulee');
    // Constat O-01 : le geste a défait le prérempli, mais l'aventure n'est plus ouverte ensuite.
    expect(sawPicker, 'O-01 : après « Annuler la préparation », /compas affiche « Quelle aventure préparer ? » au lieu de l’aventure').toBe(false);
  });

  test('chaque tuile d’activité devient l’activité de l’aventure ; « Randonnée » la rétablit', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await reopenIfPicker(page);
    await settle(page);
    await detailsButton(page, 'ou').click();
    await flowTab(page, 'Activité').click();
    const tiles = sheet(page).locator('.cp-tile');
    await expect(tiles).toHaveCount(17);
    for (const [key, label] of ACTIVITIES) {
      await quiet(page, tiles.first());
      const tile = tiles.filter({ has: page.locator('span').getByText(label, { exact: true }) });
      await cover.click(
        tile,
        `la tuile « ${label} » est la seule activée et la note sous la grille la nomme`,
        async () => {
          await expect(tile).toHaveAttribute('aria-pressed', 'true');
          await expect(sheet(page).locator('.cp-tile[aria-pressed="true"]')).toHaveCount(1);
          await expect(sheet(page).locator('.cp-note').first()).toContainText(label);
        },
        { control: tileId(key) }
      );
    }
    await capture(page, 'activites');
  });

  test('« Préférences » : rythme, nuits, niveau, terrain, voiture, nuits dehors, poids max, éviter et envies', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await reopenIfPicker(page);
    await settle(page);
    await detailsButton(page, 'ou').click();
    await flowTab(page, 'Préférences').click();
    const s = sheet(page);
    const ready = s.getByRole('button', { name: 'Normal', exact: true });
    const toggle = async (text: RegExp, label: string, control: string) => {
      await quiet(page, ready);
      const p = pill(page, text);
      await cover.click(p, `« ${label} » est choisi (bouton enfoncé) puis, retouché, se décoche`, async () => {
        await expect(p).toHaveAttribute('aria-pressed', 'true');
      }, { control });
      await quiet(page, ready);
      await p.click(); // rangement : on décoche (« comme mon profil » / indécis)
      await expect(p).toHaveAttribute('aria-pressed', 'false');
    };

    // Rythme (segments)
    await quiet(page, ready);
    const brisk = s.getByRole('button', { name: 'Soutenu', exact: true });
    await cover.click(brisk, 'le rythme « Soutenu » est actif, « Normal » ne l’est plus', async () => {
      await expect(brisk).toHaveAttribute('aria-pressed', 'true');
      await expect(ready).toHaveAttribute('aria-pressed', 'false');
    }, { control: ID.pace });
    await quiet(page, ready);
    await ready.click();
    await expect(ready).toHaveAttribute('aria-pressed', 'true');

    await toggle(/^Refuge$/, 'Refuge', ID.nights);
    await toggle(/^Régulier$/, 'Régulier', ID.level);
    await toggle(/^Montagne$/, 'Montagne', ID.terrain);
    await toggle(/^Sans voiture$/, 'Sans voiture', ID.carFree);

    // Nuits dehors : « 1 » puis « Libre » (le second rétablit le réglage libre).
    await quiet(page, ready);
    const one = pill(page, /^1$/);
    if (await one.count()) {
      await cover.click(one, 'une nuit dehors est choisie', () => expect(one).toHaveAttribute('aria-pressed', 'true'), { control: ID.outdoor });
      await quiet(page, ready);
      const free = pill(page, /^Libre$/);
      await cover.click(free, 'le réglage redevient « Libre »', () => expect(free).toHaveAttribute('aria-pressed', 'true'), { control: ID.outdoor });
    } else {
      test.info().annotations.push({ type: 'non testé', description: 'une aventure sans nuit n’offre pas « Nuits dehors »' });
    }

    // Poids max : la valeur est écrite à Entrée, puis effacée.
    await quiet(page, ready);
    const kg = s.getByLabel('Poids max du sac de base (kg)');
    if (await kg.count()) {
      await cover.fill(kg, '9', 'la valeur est écrite à Entrée et annoncée', async () => {
        await kg.press('Enter');
        await expect(kg).toHaveValue('9');
        await expect(page.locator('.cp-island')).toBeVisible();
      }, { control: ID.maxPack });
      await quiet(page, ready);
      await kg.fill('');
      await kg.press('Enter');
    } else {
      test.info().annotations.push({ type: 'non testé', description: '« Poids max » n’est offert qu’aux sacs complets' });
    }

    // Éviter / Envies : saisie libre + bouton +, suggestion, retrait.
    const addInput = s.getByRole('textbox', { name: 'Ajouter : Éviter' });
    await quiet(page, ready);
    await cover.fill(addInput, 'orties', 'la saisie active « Ajouter à Éviter »', () =>
      expect(s.getByRole('button', { name: 'Ajouter à Éviter' })).toBeEnabled()
    , { control: ID.tagInput });
    await cover.click(s.getByRole('button', { name: 'Ajouter à Éviter' }), '« orties » devient une pastille retirable', () =>
      expect(s.getByRole('button', { name: 'Retirer orties' })).toBeVisible()
    , { control: ID.tagAdd });
    await quiet(page, ready);
    await cover.click(s.getByRole('button', { name: 'Retirer orties' }), 'la pastille « orties » disparaît', () =>
      expect(s.getByRole('button', { name: 'Retirer orties' })).toHaveCount(0)
    , { control: ID.tagRemove });

    await quiet(page, ready);
    const wish = pill(page, /^Lac$/);
    await cover.click(wish, 'la suggestion « Lac » devient une envie retirable', () =>
      expect(s.getByRole('button', { name: 'Retirer Lac' })).toBeVisible()
    , { control: ID.tagSuggest });

    // L'envie apparaît dans « Parcours » comme une source : la toucher lance la recherche.
    await quiet(page, ready);
    await flowTab(page, 'Parcours').click();
    const wishSource = s.locator('.cp-pill').filter({ hasText: /^Lac$/ });
    await cover.click(wishSource, 'l’envie « Lac » devient la requête de recherche', async () => {
      await expect(wishSource).toHaveAttribute('aria-pressed', 'true');
      await expect(s.getByRole('searchbox', { name: 'Chercher un parcours' })).toHaveValue('Lac');
    }, { control: ID.routeWish });

    // Rangement : l'envie est retirée.
    await flowTab(page, 'Préférences').click();
    await quiet(page, ready);
    await s.getByRole('button', { name: 'Retirer Lac' }).click();
    await expect(s.getByRole('button', { name: 'Retirer Lac' })).toHaveCount(0);
    await capture(page, 'preferences');
  });

  test('« Quand » : unité, nombre d’heures et de jours, départ, « Enregistrer » et case du calendrier', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await reopenIfPicker(page);
    await settle(page);
    await detailsButton(page, 'ou').click();
    await flowTab(page, 'Quand').click();
    const s = sheet(page);
    const unit = s.getByLabel('Unité de durée');
    const days = s.getByLabel('Nombre de jours');
    const hours = s.getByLabel('Nombre d’heures');
    const start = s.locator('input[type="date"]');
    const save = s.getByRole('button', { name: 'Enregistrer', exact: true });

    await cover.select(unit, 'hours', 'l’unité « heures » remplace le nombre de jours par un nombre d’heures', async () => {
      await expect(hours).toBeVisible();
      await expect(days).toHaveCount(0);
    }, { control: ID.whenUnit });
    await cover.fill(hours, '6', 'le nombre d’heures est gardé', () => expect(hours).toHaveValue('6'), { control: ID.whenHours });
    await cover.select(unit, 'days', 'l’unité « jours » revient avec son nombre', () => expect(days).toBeVisible(), { control: ID.whenUnit });
    await cover.fill(days, '2', 'le nombre de jours est gardé et le résumé donne la fenêtre', async () => {
      await expect(days).toHaveValue('2');
      await expect(s.locator('.cp-when__note')).toContainText('→');
    }, { control: ID.whenDays });

    await cover.fill(start, inDays(20), 'le départ est écrit et « Enregistrer » s’active', () => expect(save).toBeEnabled(), { control: ID.whenStart });
    await cover.click(save, 'les dates sont enregistrées : « Enregistrer » se désactive, aucune erreur', async () => {
      await expect(save).toBeDisabled({ timeout: 90_000 });
      await expect(page.locator('.cp-island[data-tone="bad"]')).toHaveCount(0);
    }, { control: ID.whenSave });

    await settle(page);
    const cell = s.locator('.cp-cal__d:not([disabled])').nth(10);
    if (await cell.count()) {
      await cover.click(cell, 'le jour touché devient le départ (case enfoncée) et les dates sont enregistrées', async () => {
        await expect(cell).toHaveAttribute('aria-pressed', 'true', { timeout: 90_000 });
        await expect(page.locator('.cp-island[data-tone="bad"]')).toHaveCount(0);
      }, { control: ID.calCell });
    } else {
      test.info().annotations.push({ type: 'non testé', description: 'calendrier de conditions indisponible (météo) : case du calendrier non exercée' });
    }
    await capture(page, 'quand');
  });

  test('règle de durée : toucher, glisser, annuler puis appliquer une durée', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await reopenIfPicker(page);
    await settle(page);
    await closeSheet(page);
    const track = page.locator('.cp-ruler__track');
    const apply = page.getByRole('button', { name: /^Appliquer/ });
    const cancel = page.locator('.cp-ruler__ask').getByRole('button', { name: 'Annuler' });
    const shown = page.locator('.cp-ruler__h b').first();
    const before = await shown.innerText();

    await cover.click(track, 'toucher la règle propose une durée : « Appliquer » et « Annuler » apparaissent', () => expect(apply).toBeVisible(), { control: ID.rulerSlider });
    await cover.click(cancel, 'la proposition est abandonnée : la durée d’origine revient', async () => {
      await expect(apply).toHaveCount(0);
      await expect(shown).toHaveText(before);
    }, { control: ID.rulerCancel });

    const proposed = async () => (await page.locator('.cp-ruler__ask b').innerText().catch(() => '')).trim();
    await cover.drag(track, { dx: 70 }, 'glisser le curseur propose une autre durée', async () => {
      await expect(apply).toBeVisible();
      expect(await proposed()).not.toBe('');
    }, { control: ID.rulerDrag });
    await cover.click(apply, 'la durée proposée est appliquée : la proposition disparaît, aucune erreur', async () => {
      await expect(apply).toHaveCount(0, { timeout: 90_000 });
      await expect(page.locator('.cp-island[data-tone="bad"]')).toHaveCount(0);
    }, { control: ID.rulerApply });
    await capture(page, 'regle');
  });

  test('« Tout préparer pour moi » préremplit de nouveau l’aventure', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await reopenIfPicker(page);
    await settle(page);
    const again = page.getByRole('button', { name: 'Tout préparer pour moi' });
    await expect(again).toBeVisible();
    await cover.click(again, 'le prérempli est refait : l’itinéraire revient (« Parcours » chiffré) et le bouton « Tout préparer pour moi » disparaît', async () => {
      await expect(page.locator('.cp-fr', { hasText: 'Parcours' })).toContainText(/\d+(,\d+)? km/, { timeout: 600_000 });
      await expect(again).toHaveCount(0, { timeout: 600_000 });
    }, { control: ID.prepareAll });
    // L'état « préparé » doit revenir : « Annuler la préparation » est de nouveau proposé.
    await expect(page.getByRole('button', { name: 'Annuler la préparation' })).toBeVisible({ timeout: 120_000 });
    await capture(page, 'reprepare');
  });
});
