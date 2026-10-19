import { capture, expect, test } from './_fx';
import { detailsButton, expectStep, flowTab, openCompas, sheet, stepButton } from '../_lib/compas';
import { ID, closeSheet, openLink, quiet, settle, tabId } from '../ou/_h';

/**
 * Étape « Résa » : carte, quatre onglets du tiroir, Nuits (saisie, recherche d'hébergement),
 * Offres (catégories, recherches en direct). Toute recherche est en LECTURE SEULE : rien n'est
 * réservé ni payé ; « Noter » ne fait que retenir un nom pour la nuit (défait en fin de
 * scénario). Les liens partenaires ne sont jamais suivis pour de bon (cible interceptée).
 * Le scénario s'adapte à l'aventure active (Vercors de référence, ou la préparation du lot Où).
 */
test.describe.serial('@etape:resa réservations', () => {
  test.setTimeout(60 * 60_000);

  test('capsule « Résa », catégories et jours de la carte, quatre onglets du tiroir', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openCompas(page);
    await cover.click(stepButton(page, 'resa'), 'l’étape « Résa » devient l’étape courante et sa carte « Mes réservations » s’affiche', async () => {
      await expectStep(page, 'resa');
      await expect(page.getByRole('region', { name: 'Mes réservations' })).toBeVisible();
    }, { control: ID.stepResa });
    await settle(page);

    const chip = page.locator('.cp-tchip:not([disabled])').filter({ hasText: /^Activités$/ });
    await cover.click(chip, 'la catégorie « Activités » ouvre le tiroir sur « Offres »', async () => {
      await expect(sheet(page)).toBeVisible();
      await expect(flowTab(page, 'Offres')).toHaveAttribute('aria-pressed', 'true');
    }, { control: ID.noOffer });
    await closeSheet(page);

    const day = page.locator('.cp-day').first();
    if (await day.count()) {
      await cover.click(day, 'un jour de la carte ouvre « Nuits » sur la nuit de ce jour', async () => {
        await expect(flowTab(page, 'Nuits')).toHaveAttribute('aria-pressed', 'true');
        await expect(sheet(page).locator('input[name="stay"]').first()).toBeVisible();
      }, { control: ID.cardDay });
    } else {
      test.info().annotations.push({ type: 'non testé', description: 'aucun jour sur la carte Résa (aventure sans itinéraire)' });
      await detailsButton(page, 'resa').click();
    }
    await expect(sheet(page)).toBeVisible();

    const tabs: Array<[string, string, () => Promise<unknown>]> = [
      ['nuits', 'Nuits', () => expect(sheet(page).getByText(/ne réserve rien|nuit/i).first()).toBeVisible()],
      ['reservations', 'Réservations', () => expect(sheet(page).locator('.cp-list, .cp-note').first()).toBeVisible()],
      ['offres', 'Offres', () => expect(sheet(page).getByRole('button', { name: 'Extras', exact: true })).toBeVisible()],
      ['etats', 'États', () => expect(sheet(page).getByText('Brouillon').or(sheet(page).getByText(/à réserver/i)).first()).toBeVisible()],
    ];
    for (const [flow, label, shows] of tabs) {
      await cover.click(flowTab(page, label), `l’onglet « ${label} » devient actif et montre son contenu`, async () => {
        await expect(flowTab(page, label)).toHaveAttribute('aria-pressed', 'true');
        await shows();
      }, { control: tabId('resa', flow) });
    }
    await capture(page, 'onglets');
  });

  test('« Nuits » : noter un hébergement à la main, chercher (lecture seule), « Noter », double-touche', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openCompas(page);
    await stepButton(page, 'resa').click();
    await settle(page);
    await detailsButton(page, 'resa').click();
    await flowTab(page, 'Nuits').click();
    const s = sheet(page);
    const stay = s.locator('input[name="stay"]').first();
    if ((await stay.count()) === 0) {
      test.info().annotations.push({ type: 'non testé', description: 'aucune nuit à renseigner (aventure sans nuit) : Nuits non exercé' });
      return;
    }
    const ok = s.getByRole('button', { name: 'OK', exact: true }).first();
    // La carte Résa (derrière le tiroir) dit l'hébergement retenu de chaque nuit.
    const slot = (name: string) => page.locator(`.cp-day [role="img"][aria-label*="${name}"]`);
    const initial = await stay.inputValue();
    if (initial) test.info().annotations.push({ type: 'constat', description: `O-03 : la nuit 1 est « Noté » avant toute saisie (« ${initial} »)` });

    await quiet(page, ok, 900_000);
    await cover.fill(stay, 'Gîte du banc', 'la saisie est gardée dans le champ de la nuit', () => expect(stay).toHaveValue('Gîte du banc'), { control: ID.nightStay });
    await cover.click(ok, 'l’hébergement est noté : la carte Résa dit « Noté : Gîte du banc (non réservé) »', () => expect(slot('Gîte du banc')).toHaveCount(1, { timeout: 90_000 }), { control: ID.nightOk });
    await quiet(page, ok, 900_000);
    // Rangement : la valeur d'origine est rétablie.
    await s.locator('input[name="stay"]').first().fill(initial);
    await ok.click();
    await expect(slot('Gîte du banc')).toHaveCount(0, { timeout: 90_000 });
    await quiet(page, ok, 900_000);

    // Recherche d'hébergement (partenaire) : lecture seule.
    const sel = s.getByLabel('Chercher un hébergement pour');
    if ((await sel.count()) === 0) {
      test.info().annotations.push({ type: 'non testé', description: 'recherche d’hébergement en direct éteinte sur cet aperçu (RouteStack désactivé)' });
    } else {
      const firstValue = await sel.locator('option').first().getAttribute('value');
      await cover.select(sel, firstValue as string, 'la nuit choisie est celle de la recherche', () => expect(sel).toHaveValue(firstValue as string), { control: ID.stayFor });
      const go = s.getByRole('button', { name: 'Chercher', exact: true });
      await cover.click(go, 'la recherche répond : offres de lecture (« tarif à revalider ») ou message, rien n’est réservé', async () => {
        await expect(s.getByRole('button', { name: 'Noter', exact: true }).first().or(s.locator('[role="alert"]')).or(s.getByText(/Aucune offre|aucune offre/))).toBeVisible({ timeout: 90_000 });
      }, { control: ID.staySearch });
      await capture(page, 'recherche-nuit');
      const note = s.getByRole('button', { name: 'Noter', exact: true });
      if ((await note.count()) === 0) {
        test.info().annotations.push({ type: 'non testé', description: 'la recherche n’a rendu aucune offre : « Noter », double-touche et « Voir l’offre » non exercés' });
      } else {
        await expect(s.getByText('tarif à revalider').first()).toBeVisible();
        const title0 = ((await s.locator('.cp-row--tall .cp-row__t b').first().innerText()) ?? '').trim().replace(/"/g, '');
        await cover.click(note.first(), 'l’hébergement de la nuit est noté : la carte Résa porte le nom de l’offre, sans rien réserver', () =>
          expect(slot(title0.slice(0, 20))).toHaveCount(1, { timeout: 90_000 })
        , { control: ID.stayNote });
        await quiet(page, ok, 900_000);
        const tall = s.locator('.cp-row--tall').nth(1);
        const title1 = ((await tall.locator('.cp-row__t b').innerText()) ?? '').trim().replace(/"/g, '');
        await cover.doubleTap(tall, 'la double-touche note l’hébergement de la ligne : la carte Résa porte son nom', () =>
          expect(slot(title1.slice(0, 20))).toHaveCount(1, { timeout: 90_000 })
        , { control: ID.stayDouble });
        await quiet(page, ok, 900_000);
        const see = s.locator('a.cp-btn', { hasText: 'Voir l’offre' }).first();
        if (await see.count()) await openLink(page, see, ID.staySee, cover, 'le lien « Voir l’offre » s’ouvre chez le partenaire, balisé');
        else test.info().annotations.push({ type: 'non testé', description: 'les offres rendues n’ont pas d’adresse : « Voir l’offre » absent' });
        // Rangement : la valeur d'origine est rétablie.
        await s.locator('input[name="stay"]').first().fill(initial);
        await ok.click();
      }
    }

    const partner = s.locator('a.cp-row').first();
    if (await partner.count()) await openLink(page, partner, ID.nightPartner, cover, 'le lien partenaire de Nuits s’ouvre chez le partenaire, balisé');
    else test.info().annotations.push({ type: 'non testé', description: 'aucun lien partenaire d’hébergement pour ce lieu (Nuits › lien partenaire)' });
  });

  test('« Offres » : catégories, « Chercher un hébergement nuit par nuit », recherches en direct', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openCompas(page);
    await stepButton(page, 'resa').click();
    await settle(page);
    await detailsButton(page, 'resa').click();
    await flowTab(page, 'Offres').click();
    const s = sheet(page);
    const cats = s.locator('.cp-seg').nth(1);
    const cat = (name: string) => cats.getByRole('button', { name, exact: true });
    const pick = (name: string) =>
      cover.click(cat(name), `la catégorie « ${name} » est active`, () => expect(cat(name)).toHaveAttribute('aria-pressed', 'true'), { control: ID.offerCat });

    const live = async (label: string) => {
      const go = s.getByRole('button', { name: /Chercher en direct$/ });
      if (!(await go.isEnabled().catch(() => false))) {
        test.info().annotations.push({ type: 'non testé', description: `recherche en direct « ${label} » inactive (dates du voyage à choisir)` });
        return;
      }
      await cover.click(go, `la recherche « ${label} » répond (offres, exemples ou message), rien n’est réservé`, async () => {
        await expect(go).toBeEnabled({ timeout: 90_000 });
        await expect(s.locator('[role="alert"], .cp-disc, .cp-list .cp-row').first()).toBeVisible({ timeout: 90_000 });
      }, { control: ID.liveGo });
      const row = s.locator('a.cp-row').first();
      if (await row.count()) await openLink(page, row, ID.liveRow, cover, `le lien d’une offre « ${label} » s’ouvre chez le partenaire, balisé`);
    };

    await pick('Activités');
    await live('Activités');
    await pick('Vols');
    const from = s.getByLabel('Départ de');
    await cover.fill(from, 'Annecy', 'la ville de départ est gardée dans le champ', () => expect(from).toHaveValue('Annecy'), { control: ID.liveFrom });
    await live('Vols');
    await pick('Trajets');
    const to = s.getByLabel('Prise du véhicule à');
    await cover.fill(to, 'Lyon', 'le lieu de prise du véhicule est gardé dans le champ', () => expect(to).toHaveValue('Lyon'), { control: ID.liveTo });
    await live('Trajets');
    await pick('Extras');
    const extrasPartner = s.locator('a.cp-row').first();
    if (await extrasPartner.count()) await openLink(page, extrasPartner, ID.offerPartner, cover, 'le lien partenaire d’Extras s’ouvre chez le partenaire, balisé');
    else test.info().annotations.push({ type: 'non testé', description: 'aucune offre partenaire (Extras) pour ce voyage : lien partenaire d’Offres non exercé' });

    await pick('Nuits');
    await cover.click(s.getByRole('button', { name: 'Chercher un hébergement nuit par nuit' }), 'le parcours « Nuits » s’ouvre avec la recherche d’hébergement', () =>
      expect(flowTab(page, 'Nuits')).toHaveAttribute('aria-pressed', 'true')
    , { control: ID.offerNightly });
    await capture(page, 'offres');
  });
});
