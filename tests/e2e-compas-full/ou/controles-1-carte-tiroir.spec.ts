import { capture, expect, test } from './_fx';
import { detailsButton, expectStep, flowTab, openCompas, openStep, sheet, stepButton } from '../_lib/compas';
import { ID, openLink, pill, settle, tabId } from './_h';

/**
 * Étape « Où » — lot 1 : lecture et navigation, sur l'aventure de référence (Vercors)
 * réellement préparée. Rien n'est modifié ici : capsule d'étapes, six onglets du tiroir,
 * « Sur place », « Dis-le » de la carte, parcours (sources, recherche, fiche d'un parcours,
 * lien partenaire), jours du « Quand ». Les gestes qui modifient l'aventure sont au lot 2.
 * Le rattachement à l'inventaire est toujours explicite (`{ control }`).
 */
test.describe('@etape:ou lecture et navigation', () => {
  test('capsule « Où » → ≡ → les six onglets du tiroir s’ouvrent l’un après l’autre', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openCompas(page);

    await cover.click(stepButton(page, 'ou'), 'l’étape « Où » devient l’étape courante, sa carte est affichée', async () => {
      await expectStep(page, 'ou');
      await expect(page.locator('.cp-fsum')).toBeVisible();
    }, { control: ID.stepOu });
    await detailsButton(page, 'ou').click();
    await expect(sheet(page)).toBeVisible();

    const tabs: Array<[string, string, () => Promise<unknown>]> = [
      ['activite', 'Activité', () => expect(sheet(page).locator('.cp-tile')).toHaveCount(17)],
      ['parcours', 'Parcours', () => expect(sheet(page).getByRole('searchbox', { name: 'Chercher un parcours' })).toBeVisible()],
      ['quand', 'Quand', () => expect(sheet(page).getByLabel('Unité de durée')).toBeVisible()],
      ['preferences', 'Préférences', () => expect(sheet(page).getByRole('button', { name: 'Soutenu', exact: true })).toBeVisible()],
      ['sac', 'Sac', () => expect(sheet(page).getByRole('button', { name: 'Créer mon kit' })).toBeVisible()],
      ['trace', 'Sur place', () => expect(sheet(page).getByRole('button', { name: /^Tout \(\d+\)$/ })).toBeVisible()],
    ];
    for (const [flow, label, shows] of tabs) {
      await cover.click(
        flowTab(page, label),
        `l’onglet « ${label} » devient actif et montre son contenu`,
        async () => {
          await expect(flowTab(page, label)).toHaveAttribute('aria-pressed', 'true');
          await shows();
        },
        { control: tabId('ou', flow) }
      );
    }
    await capture(page, 'onglets');
  });

  test('« Sur place » → « Tout » : la liste de tous les lieux le long de l’aventure', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await detailsButton(page, 'ou').click();
    await flowTab(page, 'Sur place').click();
    const all = sheet(page).getByRole('button', { name: /^Tout \(\d+\)$/ });
    await expect(all).toBeVisible();
    await cover.click(all, 'le filtre « Tout » est actif et la liste des lieux est affichée', async () => {
      await expect(all).toHaveAttribute('aria-pressed', 'true');
      await expect(sheet(page).locator('.cp-list .cp-row').first()).toBeVisible();
    }, { control: ID.traceAll });
  });

  test('« Dis-le » de la carte garde la phrase, puis ouvre le tiroir Où qui la lit', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await settle(page);
    const say = page.locator('#cp-intent-input');
    await cover.type(say, '4 jours à 3, départ samedi', 'la phrase tapée reste dans le champ', () => expect(say).toHaveValue('4 jours à 3, départ samedi'), {
      control: ID.say,
    });
    await say.press('Enter');
    await expect(sheet(page)).toBeVisible();
    // Le « Dis-le » du tiroir reçoit la phrase : rien n’est appliqué sans coche.
    await expect(sheet(page).getByRole('textbox', { name: /Dis-le/ })).toHaveValue(/4 jours à 3/);
    await expect(sheet(page).locator('.cp-tile')).toHaveCount(17);
  });

  test('« Parcours » : sources, recherche, fiche d’un parcours et retour', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await settle(page);
    await detailsButton(page, 'ou').click();
    await flowTab(page, 'Parcours').click();
    const s = sheet(page);

    // « Mes randos » : la source change, la liste suit (vide pour un espace d’essai neuf).
    await cover.click(pill(page, /^Mes randos$/), 'la source « Mes randos » est active et « Étapes » ne l’est plus', async () => {
      await expect(pill(page, /^Mes randos$/)).toHaveAttribute('aria-pressed', 'true');
      await expect(pill(page, /^Étapes/)).toHaveAttribute('aria-pressed', 'false');
    }, { control: ID.routeMode });

    // Recherche : le bouton s’active à trois lettres, la liste répond à la requête.
    const box = s.getByRole('searchbox', { name: 'Chercher un parcours' });
    const go = s.getByRole('button', { name: 'Chercher', exact: true });
    await expect(go).toBeDisabled();
    await cover.fill(box, 'lac', 'le champ garde la requête et « Chercher » s’active', async () => {
      await expect(box).toHaveValue('lac');
      await expect(go).toBeEnabled();
    }, { control: ID.routeSearch });
    await cover.click(go, 'la recherche répond : des parcours du catalogue, ou « Aucun parcours ne correspond »', async () => {
      await expect(s.locator('button.cp-row').first().or(s.getByText('Aucun parcours ne correspond à cette recherche.'))).toBeVisible({ timeout: 60_000 });
    }, { control: ID.routeSearchBtn });

    // Le catalogue de l'aperçu est clairsemé : on cherche un parcours parmi quelques mots.
    let row = s.locator('button.cp-row').first();
    for (const q of ['Mont Blanc', 'tour', 'Lac', 'sentier']) {
      if (await row.count()) break;
      await box.fill(q);
      await go.click();
      await page.waitForTimeout(4000);
    }
    if ((await row.count()) === 0) {
      test.info().annotations.push({ type: 'non testé', description: 'le catalogue de parcours ne renvoie aucun résultat depuis le départ de cette aventure (fiche d’un parcours et « Retour » non exercés)' });
    } else {
      // Fiche d’un parcours : distance, dénivelé, durée annoncée ; « Retour » ramène à la liste.
      await cover.click(row, 'la fiche du parcours s’ouvre : distance, dénivelé et « Choisir ce parcours »', async () => {
        await expect(s.getByRole('button', { name: 'Choisir ce parcours' })).toBeVisible();
        await expect(s.locator('.cp-kv')).toContainText('Distance');
      }, { control: ID.routeRow });
      await capture(page, 'fiche-parcours');
      await cover.click(s.getByRole('button', { name: 'Retour' }), 'la fiche se ferme, la liste des résultats revient', async () => {
        await expect(s.getByRole('button', { name: 'Choisir ce parcours' })).toHaveCount(0);
        await expect(s.locator('button.cp-row').first()).toBeVisible();
      }, { control: ID.routeBack });
    }

    // « Autour » : parcours proches (ou, à défaut, les activités partenaires de la zone).
    await cover.click(pill(page, /^Autour/), 'la source « Autour » est active', () =>
      expect(pill(page, /^Autour/)).toHaveAttribute('aria-pressed', 'true')
    , { control: ID.routeMode });
    await expect(s.locator('a.cp-row, .cp-sub, .cp-note').first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(4000);

    // Lien partenaire (activité guidée) : ouvert chez le partenaire, balisé, jamais suivi pour de bon.
    const link = s.locator('a.cp-row').first();
    if ((await link.count()) === 0) {
      test.info().annotations.push({ type: 'non testé', description: 'aucune activité partenaire proposée autour de ce lieu (ParcoursFlow › lien partenaire)' });
    } else {
      await expect(s.getByText('Liens partenaires', { exact: true })).toBeVisible();
      await openLink(page, link, ID.routePartner, cover, 'le lien partenaire s’ouvre dans un nouvel onglet, balisé « sponsored nofollow »');
    }
  });

  test('« Quand » : les boutons J1, J2… montrent le détail de chaque jour', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await settle(page);
    await detailsButton(page, 'ou').click();
    await flowTab(page, 'Quand').click();
    const s = sheet(page);
    const j2 = s.locator('.cp-pill').filter({ hasText: /^J2$/ });
    await expect(j2).toBeVisible();
    await cover.click(j2, 'le jour 2 devient le jour détaillé (marche, lumière, départ conseillé)', async () => {
      await expect(j2).toHaveAttribute('aria-pressed', 'true');
      await expect(s.locator('.cp-dayd__h')).toContainText('J2');
    }, { control: ID.whenDayPill });
    await capture(page, 'quand-j2');
  });
});
