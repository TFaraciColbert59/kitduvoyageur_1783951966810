// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { makeApi, makeData, makeInput, TRIP, U, WithApi } from './fixtures';
import type { V5Api } from '../context';
import type { CompasData } from '../../server/getCompasData';

/* Frontières réseau uniquement : les actions serveur. Le tiroir, les modèles et le moteur sont les vrais. */
const budgetActions = vi.hoisted(() => ({
  addExpenseAction: vi.fn(async (_prev: unknown, _fd: FormData) => ({ success: true }) as { success: boolean; error?: string }),
  updateExpenseAction: vi.fn(async (_prev: unknown, _fd: FormData) => ({ success: true }) as { success: boolean; error?: string }),
  settleExpenseAction: vi.fn(async (_prev: unknown, _fd: FormData) => ({ success: true }) as { success: boolean; error?: string }),
  deleteExpenseAction: vi.fn(async (_t: string, _e: string, _s?: string) => ({ success: true }) as { success: boolean; error?: string }),
}));
vi.mock('@/app/voyages/budget-actions', () => budgetActions);
const compas = vi.hoisted(() => ({
  compasSetBudgetAction: vi.fn(async (_input: unknown) => ({ success: true })),
}));
vi.mock('../../server/compasActions', () => compas);

import { budgetDrawer } from '../drawers/budget';

const Body = budgetDrawer.Body;
const SLUG = 'vercors-novembre';
const fields = (fd: FormData) => Object.fromEntries(fd.entries());

const show = (api: V5Api) => render(<WithApi api={api}><Body /></WithApi>);

function soloData(expenses = makeInput().expenses): CompasData {
  const i = makeInput();
  return makeData({ trip: { ...i.trip, partySize: 1 }, members: [i.members[0]], expenses });
}
const withPlanned = () => [
  ...makeInput().expenses,
  { id: 'e3', title: 'Gîte du Royans', amount: 90, category: 'hébergement', isPlanned: true, payerId: U.tony, splitType: 'equal' },
];
const noEnvelope = (expenses = makeInput().expenses) => makeData({ trip: { ...makeInput().trip, estimatedBudget: null }, expenses });

beforeEach(() => {
  [...Object.values(budgetActions), ...Object.values(compas)].forEach((m) => m.mockClear());
});
afterEach(() => cleanup());

describe('Budget : capsule et titres', () => {
  it('trois onglets pour un groupe, deux en solo, sans texte visible (icônes + nom accessible)', () => {
    expect(budgetDrawer.tabs(makeApi()).map((t) => [t.icon, t.label])).toEqual([
      ['pie', 'Aperçu du budget'],
      ['receipt', 'Dépenses'],
      ['swap', 'Qui doit quoi'],
    ]);
    expect(budgetDrawer.tabs(makeApi({ solo: true, people: 1 }, { data: soloData() })).map((t) => t.label)).toEqual(['Aperçu du budget', 'Dépenses']);
  });
  it('titre de l’onglet et total prévu', () => {
    expect(budgetDrawer.title(makeApi({ tab: 0 }))).toBe('Budget');
    expect(budgetDrawer.title(makeApi({ tab: 1 }))).toBe('Dépenses');
    expect(budgetDrawer.title(makeApi({ tab: 2 }))).toBe('Qui doit quoi');
    expect(budgetDrawer.subtitle(makeApi())).toMatch(/80\s€ prévus/);
    expect(budgetDrawer.subtitle(makeApi({}, { data: makeData({ expenses: [] }) }))).toBeNull();
  });
  it('en solo, un troisième index retombe sur Dépenses (jamais un corps vide)', () => {
    show(makeApi({ solo: true, people: 1, tab: 2 }, { data: soloData() }));
    expect(screen.getByText('Payées')).toBeTruthy();
  });
});

describe('Budget : aperçu', () => {
  it('prévu total et par personne, dépensé, enveloppe fixée', () => {
    const api = makeApi({ tab: 0 }, { data: makeData({ expenses: withPlanned() }) });
    show(api);
    expect(document.querySelector('.v5-big b')?.textContent).toMatch(/^170\s€$/);
    expect(screen.getByText(/prévus · 42,50\s€ par personne/)).toBeTruthy();
    expect(screen.getByText(/dont 80\s€ déjà dépensés/)).toBeTruthy();
    expect(screen.getByText(/Reste 430\s€ sur l’enveloppe/)).toBeTruthy();
    expect(screen.queryByText('proposée')).toBeNull();
    expect(screen.getByRole('img', { name: '28 % de l’enveloppe utilisés' })).toBeTruthy();
  });
  it('enveloppe PROPOSÉE : prévu arrondi à la cinquantaine supérieure, dite « proposée »', () => {
    show(makeApi({ tab: 0 }, { data: noEnvelope() }));
    expect(screen.getByText('proposée')).toBeTruthy();
    expect(screen.getByText(/Reste 20\s€ sur l’enveloppe/)).toBeTruthy();
    expect(screen.getByText(/arrondi au multiple de 50/)).toBeTruthy();
  });
  it('rien de prévu : pas d’enveloppe inventée', () => {
    show(makeApi({ tab: 0 }, { data: noEnvelope([]) }));
    expect(screen.getByText(/Pas d’enveloppe à proposer/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Aucune dépense ni montant prévu pour l’instant.')).toBeTruthy();
  });
  it('dépassement : le dit en mots, barre pleine', () => {
    const data = makeData({ trip: { ...makeInput().trip, estimatedBudget: 60 } });
    show(makeApi({ tab: 0 }, { data }));
    expect(screen.getByText(/Dépasse l’enveloppe de 20\s€/)).toBeTruthy();
    expect(screen.getByRole('img', { name: '133 % de l’enveloppe utilisés' })).toBeTruthy();
  });
  it('plus 50 sur la proposition la fixe ; annulable vers « non fixée »', async () => {
    const api = makeApi({ tab: 0 }, { data: noEnvelope() });
    show(api);
    await userEvent.click(screen.getByRole('button', { name: /^Plus 50/ }));
    expect(compas.compasSetBudgetAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, amount: 150 });
    await vi.mocked(api.ctl.run).mock.calls[0][2]!();
    expect(compas.compasSetBudgetAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, amount: null });
  });
  it('moins 50 sur une enveloppe fixée ; l’annulation remet l’ancienne', async () => {
    const api = makeApi({ tab: 0 });
    show(api);
    await userEvent.click(screen.getByRole('button', { name: /^Moins 50/ }));
    expect(compas.compasSetBudgetAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, amount: 550 });
    await vi.mocked(api.ctl.run).mock.calls[0][2]!();
    expect(compas.compasSetBudgetAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, amount: 600 });
  });
  it('« Garder cette proposition » fixe le montant proposé', async () => {
    show(makeApi({ tab: 0 }, { data: noEnvelope() }));
    await userEvent.click(screen.getByRole('button', { name: 'Garder cette proposition' }));
    expect(compas.compasSetBudgetAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, amount: 100 });
  });
  it('« Revenir à la proposition » efface l’enveloppe fixée', async () => {
    show(makeApi({ tab: 0 }));
    await userEvent.click(screen.getByRole('button', { name: 'Revenir à la proposition' }));
    expect(compas.compasSetBudgetAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, amount: null });
  });
  it('montant saisi : validé avant l’action, erreur annoncée', async () => {
    show(makeApi({ tab: 0 }));
    const input = screen.getByLabelText('Enveloppe en EUR') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Fixer' }));
    expect(screen.getByRole('alert').textContent).toMatch(/montant supérieur à 0/);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(compas.compasSetBudgetAction).not.toHaveBeenCalled();
    await userEvent.clear(input);
    await userEvent.type(input, '750,5');
    await userEvent.click(screen.getByRole('button', { name: 'Fixer' }));
    expect(compas.compasSetBudgetAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, amount: 750.5 });
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('prévu par poste : postes regroupés, part de chacun, dépensé', () => {
    show(makeApi({ tab: 0 }, { data: makeData({ expenses: withPlanned() }) }));
    const row = (label: string) => screen.getByText(label).closest('.v5-li') as HTMLElement;
    expect(within(row('Hébergement')).getByText(/90\s€/)).toBeTruthy();
    expect(within(row('Hébergement')).getByText('53 % du prévu')).toBeTruthy();
    expect(within(row('Repas')).getByText(/48\s€/)).toBeTruthy();
    expect(within(row('Trajet')).getByText(/32\s€/)).toBeTruthy();
    expect(screen.getByText(/dépensé 80\s€/)).toBeTruthy();
  });
  it('les totaux recalculés sont annoncés poliment', () => {
    const api = makeApi({ tab: 0 });
    const view = show(api);
    const live = screen.getByRole('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toMatch(/Prévu : 80\s€, soit 20\s€ par personne/);
    const next = makeApi({ tab: 0 }, { data: makeData({ expenses: withPlanned() }) });
    view.rerender(<WithApi api={next}><Body /></WithApi>);
    expect(screen.getByRole('status').textContent).toMatch(/Prévu : 170\s€, soit 42,50\s€ par personne/);
  });
  it('solo : pas de « par personne »', () => {
    show(makeApi({ solo: true, people: 1, tab: 0 }, { data: soloData() }));
    expect(screen.queryByText(/par personne/)).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/^Prévu : 80\s€\.$/);
  });
  it('autres devises : montants, taux, date et source affichés ; un taux manquant est dit indisponible', () => {
    const budgetFx = {
      targets: [
        { currency: 'CHF', kinds: ['voyageur' as const] },
        { currency: 'JPY', kinds: ['destination' as const] },
      ],
      rates: { CHF: { base: 'EUR' as const, currency: 'CHF', rate: 0.94, date: '2026-10-21', source: 'Frankfurter' } },
    };
    show(makeApi({ tab: 0 }, { data: makeData({}, { budgetFx }) }));
    const chf = screen.getByTestId('fx-CHF');
    expect(within(chf).getByText('Dans ta devise (CHF)')).toBeTruthy();
    expect(within(chf).getByText(/≈.*564.*CHF/)).toBeTruthy();
    expect(within(chf).getByText(/1 EUR = 0,94 CHF · taux du 21 oct\. 2026 · Frankfurter/)).toBeTruthy();
    const jpy = screen.getByTestId('fx-JPY');
    expect(within(jpy).getByText('Dans la devise du pays (JPY)')).toBeTruthy();
    expect(within(jpy).getByText(/Conversion en JPY indisponible/)).toBeTruthy();
  });
  it('lecture seule : raison dite, contrôles désactivés, rien d’écrit', async () => {
    show(makeApi({ tab: 0, canEdit: false }));
    expect(screen.getByText(/Lecture seule : tu ne peux pas modifier le budget/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Plus 50/ }).matches(':disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Fixer' }).matches(':disabled')).toBe(true);
    expect(screen.getByLabelText('Enveloppe en EUR').matches(':disabled')).toBe(true);
    expect(compas.compasSetBudgetAction).not.toHaveBeenCalled();
  });
});

describe('Budget : dépenses', () => {
  const api = (over: Partial<V5Api> = {}, data: CompasData = makeData({ expenses: withPlanned() })) => makeApi({ tab: 1, ...over }, { data });

  it('liste les dépenses payées et prévues, distinguées, avec le payeur', () => {
    show(api());
    expect(screen.getByText('Payées')).toBeTruthy();
    expect(screen.getByText('Prévues')).toBeTruthy();
    const essence = screen.getByText('Essence, aller').closest('.v5-li') as HTMLElement;
    expect(within(essence).getByText(/Trajet · Payé par Tony · partagée à 4/)).toBeTruthy();
    const gite = screen.getByText('Gîte du Royans').closest('.v5-li') as HTMLElement;
    expect(within(gite).getByText(/Hébergement · Prévue · saisie au nom de Tony/)).toBeTruthy();
    expect(within(gite).getByRole('button', { name: /Marquer « Gîte du Royans » comme réglée/ })).toBeTruthy();
    expect(within(essence).queryByRole('button', { name: /réglée/ })).toBeNull();
  });
  it('état vide', () => {
    show(api({}, makeData({ expenses: [] })));
    expect(screen.getByText('Aucune dépense pour l’instant.')).toBeTruthy();
  });

  describe('ajout', () => {
    it('refuse un formulaire vide : deux erreurs annoncées, aucune action', async () => {
      show(api());
      await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
      const alerts = screen.getAllByRole('alert').map((a) => a.textContent);
      expect(alerts).toEqual(['Le libellé doit avoir de 2 à 80 caractères.', 'Écris un montant supérieur à 0.']);
      expect(document.activeElement).toBe(screen.getByLabelText('Libellé'));
      expect(budgetActions.addExpenseAction).not.toHaveBeenCalled();
    });
    it('refuse un montant nul, négatif, textuel ou trop grand', async () => {
      show(api());
      await userEvent.type(screen.getByLabelText('Libellé'), 'Courses');
      for (const [value, message] of [
        ['0', /supérieur à 0/],
        ['-5', /supérieur à 0/],
        ['abc', /supérieur à 0/],
        ['100000,01', /ne peut pas dépasser 100\s000\s€/],
      ] as const) {
        const amount = screen.getByLabelText('Montant en EUR');
        await userEvent.clear(amount);
        await userEvent.type(amount, value);
        await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
        expect(screen.getByRole('alert').textContent).toMatch(message);
      }
      expect(budgetActions.addExpenseAction).not.toHaveBeenCalled();
    });
    it('refuse un libellé de 81 caractères collé (la limite se vérifie aussi hors saisie)', async () => {
      show(api());
      fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: 'x'.repeat(81) } });
      await userEvent.type(screen.getByLabelText('Montant en EUR'), '5');
      await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
      expect(screen.getByRole('alert').textContent).toMatch(/de 2 à 80 caractères/);
      expect(budgetActions.addExpenseAction).not.toHaveBeenCalled();
    });
    it('ajoute : libellé, montant, qui a payé, poste ; l’annonce porte le libellé', async () => {
      const a = api();
      show(a);
      await userEvent.type(screen.getByLabelText('Libellé'), 'Courses Villard');
      await userEvent.type(screen.getByLabelText('Montant en EUR'), '48,20');
      const payer = screen.getByRole('group', { name: 'Payé par' });
      await userEvent.click(within(payer).getByRole('button', { name: 'Claire' }));
      const post = screen.getByRole('group', { name: 'Poste' });
      await userEvent.click(within(post).getByRole('button', { name: 'Repas' }));
      await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
      await waitFor(() => expect(budgetActions.addExpenseAction).toHaveBeenCalledTimes(1));
      const [prev, fd] = budgetActions.addExpenseAction.mock.calls[0];
      expect(prev).toBeNull();
      expect(fields(fd)).toEqual({
        tripId: TRIP,
        tripSlug: SLUG,
        title: 'Courses Villard',
        amount: '48.2',
        currency: 'EUR',
        category: 'nourriture',
        splitType: 'equal',
        isPlanned: 'false',
        payerId: U.claire,
      });
      expect(vi.mocked(a.ctl.run).mock.calls[0][0]).toBe('« Courses Villard » ajoutée');
      await waitFor(() => expect((screen.getByLabelText('Libellé') as HTMLInputElement).value).toBe(''));
    });
    it('une dépense prévue est envoyée comme prévue', async () => {
      show(api());
      await userEvent.type(screen.getByLabelText('Libellé'), 'Refuge');
      await userEvent.type(screen.getByLabelText('Montant en EUR'), '120');
      await userEvent.click(within(screen.getByRole('group', { name: 'État' })).getByRole('button', { name: 'Prévue' }));
      await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
      expect(fields(budgetActions.addExpenseAction.mock.calls[0][1]).isPlanned).toBe('true');
    });
    it('le payeur par défaut est la personne connectée', async () => {
      show(api());
      const payer = screen.getByRole('group', { name: 'Payé par' });
      expect(within(payer).getByRole('button', { name: 'Tony' }).getAttribute('aria-pressed')).toBe('true');
      expect(within(payer).getByRole('button', { name: 'Claire' }).getAttribute('aria-pressed')).toBe('false');
    });
    it('échec côté serveur : la personne le lit, le formulaire garde sa saisie', async () => {
      budgetActions.addExpenseAction.mockResolvedValueOnce({ success: false, error: 'Permission refusée' });
      const a = api();
      vi.mocked(a.ctl.run).mockImplementationOnce(async (_m, action) => (await action()).success);
      show(a);
      await userEvent.type(screen.getByLabelText('Libellé'), 'Courses');
      await userEvent.type(screen.getByLabelText('Montant en EUR'), '12');
      await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
      await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('La dépense n’a pas pu être enregistrée.'));
      expect((screen.getByLabelText('Libellé') as HTMLInputElement).value).toBe('Courses');
    });
    it('solo : pas de choix du payeur, aucun payeur envoyé', async () => {
      show(makeApi({ solo: true, people: 1, tab: 1 }, { data: soloData() }));
      expect(screen.queryByRole('group', { name: 'Payé par' })).toBeNull();
      await userEvent.type(screen.getByLabelText('Libellé'), 'Essence');
      await userEvent.type(screen.getByLabelText('Montant en EUR'), '30');
      await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
      expect(fields(budgetActions.addExpenseAction.mock.calls[0][1]).payerId).toBeUndefined();
    });
    it('un libellé HTML est écrit tel quel et rendu comme du texte, jamais interprété', async () => {
      const data = makeData({ expenses: [{ id: 'x1', title: '<img src=x onerror=alert(1)>', amount: 5, category: null, isPlanned: false, payerId: U.tony, splitType: 'equal' }] });
      const { container } = show(api({}, data));
      expect(container.querySelector('img')).toBeNull();
      expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    });
    it('lecture seule : formulaire désactivé, boutons des dépenses désactivés, rien d’écrit', async () => {
      show(api({ canEdit: false }));
      expect(screen.getByLabelText('Libellé').matches(':disabled')).toBe(true);
      expect(screen.getByRole('button', { name: 'Ajouter' }).matches(':disabled')).toBe(true);
      expect(screen.getByRole('button', { name: 'Supprimer « Essence, aller »' }).matches(':disabled')).toBe(true);
      expect(screen.getByRole('button', { name: 'Modifier « Essence, aller »' }).matches(':disabled')).toBe(true);
      expect(screen.getByText(/tu ne peux pas modifier le budget/)).toBeTruthy();
    });
  });

  describe('suppression et modification', () => {
    it('supprime, avec « Annuler » qui recrée la dépense à l’identique', async () => {
      const a = api();
      show(a);
      await userEvent.click(screen.getByRole('button', { name: 'Supprimer « Essence, aller »' }));
      expect(budgetActions.deleteExpenseAction).toHaveBeenCalledWith(TRIP, 'e1', SLUG);
      expect(vi.mocked(a.ctl.run).mock.calls[0][0]).toBe('« Essence, aller » supprimée');
      const undo = vi.mocked(a.ctl.run).mock.calls[0][2]!;
      await undo();
      expect(fields(budgetActions.addExpenseAction.mock.calls[0][1])).toMatchObject({
        title: 'Essence, aller',
        amount: '32',
        category: 'transport',
        payerId: U.tony,
        isPlanned: 'false',
        splitType: 'equal',
      });
    });
    it('parts libres : confirmation d’abord, aucune annulation promise', async () => {
      const data = makeData({ expenses: [{ id: 'c1', title: 'Cadeaux', amount: 60, category: 'divers', isPlanned: false, payerId: U.tony, splitType: 'custom' }] });
      const a = api({}, data);
      show(a);
      await userEvent.click(screen.getByRole('button', { name: 'Supprimer « Cadeaux »' }));
      expect(budgetActions.deleteExpenseAction).not.toHaveBeenCalled();
      expect(screen.getByText(/ne pourra pas être annulée/)).toBeTruthy();
      await userEvent.click(screen.getByRole('button', { name: 'Supprimer « Cadeaux »' }));
      expect(budgetActions.deleteExpenseAction).toHaveBeenCalledWith(TRIP, 'c1', SLUG);
      expect(vi.mocked(a.ctl.run).mock.calls[0][2]).toBeUndefined();
    });
    it('« Garder » abandonne la suppression', async () => {
      const data = makeData({ expenses: [{ id: 'c1', title: 'Cadeaux', amount: 60, category: 'divers', isPlanned: false, payerId: U.tony, splitType: 'custom' }] });
      show(api({}, data));
      await userEvent.click(screen.getByRole('button', { name: 'Supprimer « Cadeaux »' }));
      await userEvent.click(screen.getByRole('button', { name: 'Garder' }));
      expect(budgetActions.deleteExpenseAction).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Supprimer « Cadeaux »' })).toBeTruthy();
    });
    it('modifie le montant, annulable vers les valeurs d’avant', async () => {
      const a = api();
      show(a);
      await userEvent.click(screen.getByRole('button', { name: 'Modifier « Essence, aller »' }));
      const form = screen.getByRole('form', { name: 'Modifier la dépense' });
      const amount = within(form).getByLabelText('Montant en EUR');
      await userEvent.clear(amount);
      await userEvent.type(amount, '35,5');
      await userEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));
      await waitFor(() => expect(budgetActions.updateExpenseAction).toHaveBeenCalledTimes(1));
      expect(fields(budgetActions.updateExpenseAction.mock.calls[0][1])).toMatchObject({
        tripId: TRIP,
        expenseId: 'e1',
        title: 'Essence, aller',
        amount: '35.5',
        category: 'transport',
        payerId: U.tony,
      });
      expect(vi.mocked(a.ctl.run).mock.calls[0][0]).toBe('« Essence, aller » modifiée');
      await vi.mocked(a.ctl.run).mock.calls[0][2]!();
      expect(fields(budgetActions.updateExpenseAction.mock.calls[1][1])).toMatchObject({ amount: '32', title: 'Essence, aller', category: 'transport' });
    });
    it('la modification est validée comme l’ajout', async () => {
      show(api());
      await userEvent.click(screen.getByRole('button', { name: 'Modifier « Essence, aller »' }));
      const form = screen.getByRole('form', { name: 'Modifier la dépense' });
      await userEvent.clear(within(form).getByLabelText('Libellé'));
      await userEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));
      expect(within(form).getByRole('alert').textContent).toMatch(/de 2 à 80 caractères/);
      expect(budgetActions.updateExpenseAction).not.toHaveBeenCalled();
      await userEvent.click(within(form).getByRole('button', { name: 'Annuler' }));
      expect(screen.queryByRole('form', { name: 'Modifier la dépense' })).toBeNull();
    });
    it('un poste libre est conservé à la modification', async () => {
      const data = makeData({ expenses: [{ id: 'p1', title: 'Cadeaux', amount: 20, category: 'Souvenirs', isPlanned: false, payerId: U.tony, splitType: 'equal' }] });
      show(api({}, data));
      await userEvent.click(screen.getByRole('button', { name: 'Modifier « Cadeaux »' }));
      const post = within(screen.getByRole('form', { name: 'Modifier la dépense' })).getByRole('group', { name: 'Poste' });
      expect(within(post).getByRole('button', { name: 'Souvenirs' }).getAttribute('aria-pressed')).toBe('true');
      await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
      await waitFor(() => expect(budgetActions.updateExpenseAction).toHaveBeenCalled());
      expect(fields(budgetActions.updateExpenseAction.mock.calls[0][1]).category).toBe('Souvenirs');
    });
  });

  describe('réglé', () => {
    it('en solo, « Réglé » règle la dépense prévue d’un geste ; annulable', async () => {
      const a = makeApi({ solo: true, people: 1, tab: 1 }, { data: soloData(withPlanned()) });
      show(a);
      await userEvent.click(screen.getByRole('button', { name: /Marquer « Gîte du Royans » comme réglée/ }));
      expect(budgetActions.settleExpenseAction).toHaveBeenCalledTimes(1);
      expect(fields(budgetActions.settleExpenseAction.mock.calls[0][1])).toEqual({ tripId: TRIP, tripSlug: SLUG, expenseId: 'e3' });
      expect(vi.mocked(a.ctl.run).mock.calls[0][0]).toBe('« Gîte du Royans » réglée');
      await vi.mocked(a.ctl.run).mock.calls[0][2]!();
      expect(fields(budgetActions.updateExpenseAction.mock.calls[0][1])).toMatchObject({ expenseId: 'e3', isPlanned: 'true', payerId: U.tony });
    });
    it('en groupe, on dit qui a payé avant de confirmer', async () => {
      show(api());
      await userEvent.click(screen.getByRole('button', { name: /Marquer « Gîte du Royans » comme réglée/ }));
      expect(budgetActions.settleExpenseAction).not.toHaveBeenCalled();
      const who = screen.getByRole('group', { name: 'Qui a payé ?' });
      await userEvent.click(within(who).getByRole('button', { name: 'Maya' }));
      await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
      expect(fields(budgetActions.settleExpenseAction.mock.calls[0][1])).toEqual({ tripId: TRIP, tripSlug: SLUG, expenseId: 'e3', payerId: U.maya });
    });
  });
});

describe('Budget : qui doit quoi', () => {
  const api = (over: Partial<V5Api> = {}, data: CompasData = makeData({ expenses: withPlanned() })) => makeApi({ tab: 2, ...over }, { data });

  it('virements simplifiés du moteur, dits pour le lecteur ; soldes ; le Compas ne déplace jamais d’argent', () => {
    show(api());
    expect(document.querySelector('.v5-big b')?.textContent).toMatch(/^80\s€$/);
    expect(screen.getByText(/dépensés · 20\s€ par personne/)).toBeTruthy();
    expect(screen.getByText(/Léo doit 20\s€ à Claire/)).toBeTruthy();
    expect(screen.getByText(/Maya te doit 12\s€/)).toBeTruthy();
    expect(screen.getByText(/Maya doit 8\s€ à Claire/)).toBeTruthy();
    const tony = screen.getAllByText('Tony').map((n) => n.closest('.v5-li') as HTMLElement).find((li) => li.textContent?.includes('payé'))!;
    expect(within(tony).getByText(/payé 32\s€ · part 20\s€/)).toBeTruthy();
    expect(within(tony).getByText(/\+12\s€/)).toBeTruthy();
    expect(screen.getByText(/Il ne déplace jamais d’argent/)).toBeTruthy();
    expect(screen.getByText(/ne sont pas enregistrés ici/)).toBeTruthy();
  });
  it('le lecteur qui doit de l’argent le lit à la deuxième personne', () => {
    show(api({}, makeData({ expenses: [{ id: 'z', title: 'Tout', amount: 100, category: null, isPlanned: false, payerId: U.claire, splitType: 'equal' }] })));
    expect(screen.getByText(/Tu dois 25\s€ à Claire/)).toBeTruthy();
  });
  it('les dépenses prévues attendent leur règlement et ne comptent pas', () => {
    show(api());
    expect(screen.getByText('Prévues, pas encore réglées')).toBeTruthy();
    expect(screen.getByText(/entre dans le calcul de qui doit quoi/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Marquer « Gîte du Royans » comme réglée/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Modifier/ })).toBeNull();
  });
  it('tout le monde est quitte', () => {
    const data = makeData({ expenses: [{ id: 'z', title: 'Chacun le sien', amount: 40, category: null, isPlanned: false, payerId: U.tony, splitType: 'individual' }] });
    show(api({}, data));
    expect(screen.getByText('Tout le monde est quitte')).toBeTruthy();
  });
  it('aucune dépense payée : rien à rembourser', () => {
    show(api({}, makeData({ expenses: [] })));
    expect(screen.getByText(/Aucune dépense payée pour l’instant/)).toBeTruthy();
  });
  it('parts libres : comptées à part, dites', () => {
    const data = makeData({ expenses: [{ id: 'c1', title: 'Cadeaux', amount: 60, category: null, isPlanned: false, payerId: U.tony, splitType: 'custom' }] });
    show(api({}, data));
    expect(screen.getByText(/1 dépense à parts libres n’est pas dans le calcul \(60\s€\)/)).toBeTruthy();
  });
});

describe('Budget : pas de note globale', () => {
  it.each([0, 1, 2])('onglet %i : aucun score ni note sur 10 ou 100', (tab) => {
    const { container } = show(makeApi({ tab }, { data: makeData({ expenses: withPlanned() }) }));
    expect(container.textContent).not.toMatch(/\bscore\b|\bnote globale\b|\/\s?(10|100)\b/i);
  });
});

describe('Budget : accessibilité (axe-core)', () => {
  const scan = async (root: Element) => {
    const res = await axe.run(root as HTMLElement, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false }, 'landmark-one-main': { enabled: false }, 'page-has-heading-one': { enabled: false } },
    });
    return res.violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
  };
  const budgetFx = {
    targets: [{ currency: 'CHF', kinds: ['voyageur' as const] }],
    rates: { CHF: { base: 'EUR' as const, currency: 'CHF', rate: 0.94, date: '2026-10-21', source: 'Frankfurter' } },
  };
  it.each([0, 1, 2])('groupe, onglet %i', async (tab) => {
    const { container } = show(makeApi({ tab }, { data: makeData({ expenses: withPlanned() }, { budgetFx }) }));
    expect(await scan(container)).toEqual([]);
  });
  it.each([0, 1])('solo, onglet %i', async (tab) => {
    const { container } = show(makeApi({ solo: true, people: 1, tab }, { data: soloData(withPlanned()) }));
    expect(await scan(container)).toEqual([]);
  });
  it('avec des erreurs affichées', async () => {
    const { container } = show(makeApi({ tab: 1 }));
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(await scan(container)).toEqual([]);
  });
  it('tous les boutons de texte portent la classe de 44 px', () => {
    const { container } = show(makeApi({ tab: 1 }, { data: makeData({ expenses: withPlanned() }) }));
    const small = [...container.querySelectorAll('.v5-mbtn')].filter((b) => !b.classList.contains('nb-btn'));
    expect(small).toEqual([]);
  });
});
