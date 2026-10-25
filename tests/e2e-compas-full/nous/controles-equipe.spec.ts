import { C, addFreeItem, closeSheet, expect, findRow, num, openAt, openSheet, removeItem, sbtn, seg, selectTab, test, toast, uniq } from './fx';
import { expectNoHorizontalScroll, detailsButton, expectStep, flowTab, sheet, stepButton } from '../_lib/compas';

/**
 * Nous · carte « Nous », capsule, tiroir Équipe / Qui / Bouteille : nombre de personnes,
 * ligne de membre, objets communs sans porteur, liens vers le Hub, onglets.
 * L'annonce « Bouteille à la mer » ne se lance pas depuis un espace d'essai (confiance 50 < 65) :
 * les contrôles de son formulaire sont listés « non testables » dans constats/nous-kit.md.
 */
const CARD = (s: string) => C(`CompasCards.tsx::NousCard::button::${s}`);
const STEP = (id: string) => C(`CompasSheets.tsx::StepSheet::button::compas.sheets.step.flows:nous.${id}`);

test.describe('@etape:nous équipe et carte', () => {
  test('capsule → Nous, puis la carte : voir qui, budget engagé, l’équipe et ses sacs', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openAt(page, 'kit');
    await cover.click(
      stepButton(page, 'nous'),
      'la capsule passe sur Nous : la carte de l’équipe et du budget s’affiche',
      async () => {
        await expectStep(page, 'nous');
        await expect(page.locator('.cp-bigsum')).toBeVisible();
      },
      { control: C('CompasScreen.tsx::CompasScreen::button::COMPAS_STEPS:nous') }
    );

    await cover.click(page.locator('button.cp-avadd'), 'le tiroir s’ouvre sur « Qui » : la liste des membres', async () => {
      await expect(seg(sheet(page), 'Qui')).toHaveAttribute('aria-pressed', 'true');
      await expect(sheet(page)).toContainText('Dans le voyage');
    }, { control: CARD('compas.cards.seeWho') });
    await closeSheet(page);

    await cover.click(page.locator('button.cp-bigsum'), 'le tiroir s’ouvre sur « Budget » : enveloppe, prévu, dépensé', async () => {
      await expect(seg(sheet(page), 'Budget')).toHaveAttribute('aria-pressed', 'true');
      await expect(sheet(page).locator('dl.cp-kv')).toContainText('Dépensé');
    }, { control: CARD('compas.cards.plannedSpent') });
    await closeSheet(page);

    await cover.click(
      page.locator('.compas button.cp-btn--soft').filter({ hasText: 'L’équipe et ses sacs' }),
      'le tiroir s’ouvre sur « Équipe » : les membres et leur charge',
      async () => {
        await expect(seg(sheet(page), 'Équipe')).toHaveAttribute('aria-pressed', 'true');
        await expect(sheet(page)).toContainText('Dans le voyage');
      },
      { control: CARD('compas.cards.teamBags') }
    );
  });

  test('Équipe : une personne de plus / de moins, la ligne du membre ouvre son sac', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openSheet(page, 'nous');
    const count = () => sheet(page).getByText(/personnes? dans ce voyage/).first();
    const size = async () => num(await count().innerText());
    const before = await size();
    expect(before).toBeGreaterThanOrEqual(2);

    await cover.click(
      sheet(page).getByRole('button', { name: 'Une personne de plus' }),
      `le groupe passe de ${before} à ${before + 1} personnes`,
      async () => {
        await expect(toast(page)).toContainText('Nombre de personnes mis à jour');
        await expect.poll(size).toBe(before + 1);
      },
      { control: C('CompasSheets.tsx::PartySize::button::compas.sheets.party.more') }
    );
    await cover.click(
      sheet(page).getByRole('button', { name: 'Une personne de moins' }),
      `le groupe revient à ${before} personnes`,
      async () => {
        await expect.poll(size).toBe(before);
      },
      { control: C('CompasSheets.tsx::PartySize::button::compas.sheets.party.less') }
    );

    await cover.click(
      sheet(page).locator('button.cp-mem').first(),
      'le sac de la personne s’ouvre (« Mon sac »), avec sa charge',
      async () => {
        await expect(sheet(page)).toHaveAttribute('aria-label', 'Mon sac');
        await expect(sheet(page)).toContainText(/capacité|kg| g/);
      },
      { control: C('CompasMembers.tsx::MemberRow::button::compas.members.me') }
    );
  });

  test('Équipe : « objet commun sans porteur » renvoie aux Sacs du Kit', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    const name = uniq('Commun');
    await openSheet(page, 'kit', 'Tout');
    await addFreeItem(page, name);
    await (await findRow(page, name)).locator('button.cp-row__main').click();
    await sbtn(page, 'Porteur').click();
    await seg(sheet(page), 'Commun au groupe').click();
    await sbtn(page, 'Personne pour l’instant').click();
    await expect(toast(page)).toContainText(/sans porteur/);
    await closeSheet(page);

    await openAt(page, 'nous');
    await expectStep(page, 'nous');
    await detailsButton(page, 'nous').click();
    await expect(sheet(page)).toBeVisible();
    await expect(seg(sheet(page), 'Équipe')).toHaveAttribute('aria-pressed', 'true');
    await cover.click(
      sheet(page).locator('button.cp-alertline'),
      'le tiroir du Kit s’ouvre sur « Sacs » et liste l’objet commun sans porteur',
      async () => {
        await expect(seg(sheet(page), 'Sacs')).toHaveAttribute('aria-pressed', 'true');
        await expect(sheet(page)).toContainText(name);
      },
      { control: C('CompasSheets.tsx::EquipeFlow::button::compas.sheets.team.unassignedOne') }
    );
    await selectTab(page, 'Tout');
    await removeItem(page, name);
  });

  test('les quatre parcours du tiroir Nous s’ouvrent chacun sur leur contenu', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openSheet(page, 'nous');
    const tab = (id: string, label: string, effet: string, content: () => Promise<unknown>) =>
      cover.click(flowTab(page, label), effet, async () => {
        await expect(flowTab(page, label)).toHaveAttribute('aria-pressed', 'true');
        await content();
        await expectNoHorizontalScroll(page);
      }, { control: STEP(id) });

    await tab('qui', 'Qui', '« Qui » est actif : les membres et le renvoi vers le Hub, en lecture', () =>
      expect(sheet(page)).toContainText(/Inviter, retirer ou changer un rôle se fait dans le Hub/)
    );
    await tab('budget', 'Budget', '« Budget » est actif : l’enveloppe, le prévu, le dépensé et « Ajouter une dépense »', async () => {
      await expect(sheet(page).locator('dl.cp-kv')).toContainText('Enveloppe');
      await expect(sbtn(page, /Ajouter une dépense/)).toBeVisible();
    });
    await tab('annonce', 'Bouteille', '« Bouteille » est actif : l’état de l’annonce (membres, places) et la règle de confiance sont dits', async () => {
      await expect(sheet(page)).toContainText(/membre/);
      await expect(sheet(page).getByRole('link', { name: /Inviter quelqu’un que je connais/ })).toBeVisible();
    });
    await tab('equipe', 'Équipe', '« Équipe » est actif : le nombre de personnes et la ligne de chaque membre', () =>
      expect(sheet(page)).toContainText(/personnes? dans ce voyage/)
    );
  });

  test('Équipe : « Gérer le groupe dans le Hub » mène à la gestion du groupe', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openSheet(page, 'nous');
    await cover.click(
      sheet(page).getByRole('link', { name: /Gérer le groupe dans le Hub/ }),
      'la gestion du groupe du Hub s’ouvre (/hub/groupe)',
      () => expect(page).toHaveURL(/\/hub\/groupe/),
      { control: C('CompasMembers.tsx::HubGroupLink::a::compas.members.hubLink') }
    );
  });

  test('Bouteille : « Inviter quelqu’un que je connais, dans le Hub » mène à la gestion du groupe', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openSheet(page, 'nous', 'Bouteille');
    await cover.click(
      sheet(page).getByRole('link', { name: /Inviter quelqu’un que je connais/ }),
      'la gestion du groupe du Hub s’ouvre (/hub/groupe)',
      () => expect(page).toHaveURL(/\/hub\/groupe/),
      { control: C('CompasSheets.tsx::AnnonceFlow::a::compas.sheets.bottle.inviteKnown') }
    );
  });
});
