import { C, closeSheet, expect, num, openAt, openSheet, sbtn, seg, test, toast, uniq } from './fx';
import { flowTab, sheet } from '../_lib/compas';

/**
 * Nous · Budget : l'enveloppe, l'alerte « au-dessus de l'enveloppe » de la carte, le formulaire
 * « Ajouter une dépense » (nom, montant, catégorie, groupe / par personne, prévue / payée), et
 * l'heure de départ du voyage (onglet « Quand » d'Où). L'enveloppe est remise à sa valeur d'origine.
 */
const BUD = (s: string) => C(`CompasSheets.tsx::BudgetFlow::${s}`);
const EXP = (s: string) => C(`CompasSheets.tsx::ExpenseForm::${s}`);
const kv = (page: import('@playwright/test').Page, label: string) =>
  sheet(page).locator('dl.cp-kv dt', { hasText: new RegExp(`^${label}$`) }).locator('+ dd').first();

test.describe('@etape:nous budget', () => {
  test('enveloppe : saisir puis « Enregistrer » ; trop petite, la carte alerte « au-dessus de l’enveloppe »', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openSheet(page, 'nous', 'Budget');
    const field = sheet(page).locator('input[name="amount"]').first();
    const original = await field.inputValue();
    const saveBtn = () => sheet(page).locator('form:not(.cp-expense):has(input[name="amount"])').locator('button[type="submit"]');
    let failure: unknown = null;
    try {
      await cover.fill(field, '25', 'le montant 25 est écrit dans le champ', () => expect(field).toHaveValue('25'), {
        control: BUD('input::compas.sheets.budget.field'),
      });
      await cover.click(
        saveBtn(),
        'l’enveloppe est enregistrée : annonce « Enveloppe enregistrée » et « Enveloppe » affiche 25',
        async () => {
          await expect(toast(page)).toContainText('Enveloppe enregistrée');
          await expect.poll(async () => num(await kv(page, 'Enveloppe').innerText())).toBe(25);
        },
        { control: BUD('button::compas.sheets.budget.save') }
      );
      await closeSheet(page);

      // Le prévu dépasse 25 € : la carte Nous le dit et mène au Budget.
      await expect(page.locator('.compas button.cp-alertline')).toBeVisible({ timeout: 30_000 });
      await cover.click(
        page.locator('.compas button.cp-alertline').first(),
        'le tiroir s’ouvre sur « Budget » (dépenses au-dessus de l’enveloppe)',
        () => expect(seg(sheet(page), 'Budget')).toHaveAttribute('aria-pressed', 'true'),
        { control: C('CompasCards.tsx::NousCard::button::compas.cards.overEnvelope') }
      );
    } catch (e) {
      failure = e;
    } finally {
      // Remise en état : l'enveloppe d'origine (ou aucune).
      await field.fill(original);
      await saveBtn().click();
      await expect(toast(page)).toContainText(/Enveloppe (enregistrée|retirée)/);
    }
    if (failure) throw failure;
  });

  test('« Ajouter une dépense » : nom, montant, catégorie, par personne, payée par moi, puis « Annuler »', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    const title = uniq('Parking');
    await openSheet(page, 'nous', 'Budget');
    const spentBefore = num(await kv(page, 'Dépensé').innerText());

    await cover.click(sbtn(page, /Ajouter une dépense/), 'le formulaire de dépense s’ouvre', async () => {
      await expect(sheet(page).locator('form.cp-expense')).toBeVisible();
    }, { control: EXP('button::compas.sheets.expense.open') });
    const form = sheet(page).locator('form.cp-expense');
    await cover.fill(form.locator('input[name="title"]'), title, 'le nom de la dépense est écrit', () =>
      expect(form.locator('input[name="title"]')).toHaveValue(title)
    , { control: EXP('input::compas.sheets.common.name') });
    await cover.fill(form.locator('input[name="amount"]'), '40', 'le montant 40 est écrit et le total « partagé à parts égales » s’affiche', async () => {
      await expect(form.locator('input[name="amount"]')).toHaveValue('40');
      await expect(form).toContainText(/40\s*€.*partagé à parts égales/);
    }, { control: EXP('input::compas.sheets.expense.amount') });
    await cover.select(form.locator('select[name="category"]'), 'transport', 'la catégorie « Transport » est choisie', () =>
      expect(form.locator('select[name="category"]')).toHaveValue('transport')
    , { control: EXP('select::compas.sheets.common.category') });

    const pressed = (l: import('@playwright/test').Locator) => expect(l).toHaveAttribute('aria-pressed', 'true');
    await cover.click(seg(form, 'Par pers.'), '« Par pers. » est actif : le total est multiplié par la taille du groupe', async () => {
      await pressed(seg(form, 'Par pers.'));
      await expect(form).toContainText(/Soit .* pour \d+ personnes?, partagé à parts égales/);
    }, { control: EXP('button::compas.sheets.expense.forLabel:pers') });
    await cover.click(seg(form, 'Groupe'), '« Groupe » est actif : le montant est le total du groupe', async () => {
      await pressed(seg(form, 'Groupe'));
      await expect(form).toContainText(/40\s*€, partagé à parts égales/);
    }, { control: EXP('button::compas.sheets.expense.forLabel:groupe') });
    await cover.click(seg(form, 'Payée par moi'), '« Payée par moi » est actif', () => pressed(seg(form, 'Payée par moi')), {
      control: EXP('button::compas.sheets.expense.state:payee'),
    });
    await cover.click(seg(form, 'Prévue'), '« Prévue » est actif', () => pressed(seg(form, 'Prévue')), {
      control: EXP('button::compas.sheets.expense.state:prevue'),
    });
    await seg(form, 'Par pers.').click();
    await seg(form, 'Payée par moi').click();
    const total = num((await form.locator('p.cp-note').first().innerText()).replace(/^.*?Soit/, ''));

    await cover.click(
      form.locator('button[type="submit"]'),
      'la dépense est ajoutée : annonce « Dépense ajoutée : … », « Dépensé » augmente du total, la catégorie Transport apparaît',
      async () => {
        await expect(toast(page)).toContainText(`Dépense ajoutée : ${title}`);
        await expect.poll(async () => num(await kv(page, 'Dépensé').innerText())).toBe(spentBefore + total);
        await expect(sheet(page).getByText(/transport/i).first()).toBeVisible();
      },
      { control: EXP('button::compas.sheets.common.add') }
    );

    await sbtn(page, /Ajouter une dépense/).click();
    await cover.click(
      sheet(page).locator('form.cp-expense button').filter({ hasText: /^\s*Annuler\s*$/ }),
      'le formulaire se referme sans rien ajouter',
      async () => {
        await expect(sheet(page).locator('form.cp-expense')).toHaveCount(0);
        await expect(sbtn(page, /Ajouter une dépense/)).toBeVisible();
      },
      { control: EXP('button::compas.sheets.common.cancel') }
    );
  });

  test('heure de départ (Où › Quand) : simuler, « Enregistrer cette heure », « Effacer l’heure enregistrée »', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openSheet(page, 'ou', 'Quand');
    const time = sheet(page).locator('section.cp-pass input[type="time"]');
    await expect(time).toBeVisible();
    // Un départ déjà enregistré (passage précédent) est d'abord effacé : la suite part d'un état connu.
    const clear = sheet(page).locator('section.cp-pass').getByRole('button', { name: /Effacer l’heure enregistrée/ });
    if (await clear.count()) {
      await clear.click();
      await expect(toast(page)).toContainText('Heure de départ effacée');
    }
    await cover.fill(
      time,
      '08:30',
      'la simulation à 08:30 est écrite et dite « non enregistrée »',
      async () => {
        await expect(time).toHaveValue('08:30');
        await expect(sheet(page).locator('section.cp-pass')).toContainText('Simulation : cette heure n’est pas enregistrée.');
      },
      { control: C('CompasPassage.tsx::PassageSection::input::compas.passage.departureLabel') }
    );
    await cover.click(
      sheet(page).locator('section.cp-pass').getByRole('button', { name: /Enregistrer cette heure/ }),
      'l’heure est enregistrée : annonce « Heure de départ enregistrée : 08:30 », la note dit « Enregistrée pour chaque jour »',
      async () => {
        await expect(toast(page)).toContainText('Heure de départ enregistrée : 08:30');
        await expect(sheet(page).locator('section.cp-pass')).toContainText('Enregistrée pour chaque jour du voyage');
      },
      { control: C('CompasPassage.tsx::PassageSection::button::compas.passage.save') }
    );
    await cover.click(
      sheet(page).locator('section.cp-pass').getByRole('button', { name: /Effacer l’heure enregistrée \(08:30\)/ }),
      'l’heure est effacée : annonce « Heure de départ effacée », la note dit « Aucune heure de départ »',
      async () => {
        await expect(toast(page)).toContainText('Heure de départ effacée');
        await expect(sheet(page).locator('section.cp-pass')).toContainText('Aucune heure de départ');
      },
      { control: C('CompasPassage.tsx::PassageSection::button::compas.passage.clear') }
    );
    void flowTab;
    void openAt;
  });
});
