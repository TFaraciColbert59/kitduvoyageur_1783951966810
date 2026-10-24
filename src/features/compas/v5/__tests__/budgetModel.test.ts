import { describe, expect, it } from 'vitest';
import {
  EXPENSE_MAX,
  addFormData,
  budgetTabAt,
  budgetTabs,
  budgetTotal,
  canRestore,
  envelopeView,
  expenseGroups,
  fxViews,
  parseAmount,
  parseEnvelope,
  postOf,
  postRows,
  proposeEnvelope,
  restoreFields,
  settleFormData,
  settleView,
  stepEnvelope,
  updateFormData,
  validateExpenseDraft,
} from '../model/budget';
import { settleExpenses } from '../../engine/crew';
import { makeData, TRIP, U } from './fixtures';

const ctx = { tripId: TRIP, slug: 'vercors-novembre', currency: 'EUR' };

describe('budget : onglets', () => {
  it('trois onglets en groupe, deux en solo', () => {
    expect(budgetTabs(false)).toEqual(['overview', 'expenses', 'settle']);
    expect(budgetTabs(true)).toEqual(['overview', 'expenses']);
  });
  it('un index hors liste est ramené dans les bornes', () => {
    expect(budgetTabAt(true, 2)).toBe('expenses');
    expect(budgetTabAt(false, 2)).toBe('settle');
    expect(budgetTabAt(false, -4)).toBe('overview');
    expect(budgetTabAt(false, Number.NaN)).toBe('overview');
  });
});

describe('budget : enveloppe proposée', () => {
  it('arrondit à la cinquantaine supérieure', () => {
    expect(proposeEnvelope(574)).toBe(600);
    expect(proposeEnvelope(601)).toBe(650);
    expect(proposeEnvelope(600)).toBe(600);
    expect(proposeEnvelope(0.5)).toBe(50);
  });
  it('ne propose rien sans montant', () => {
    expect(proposeEnvelope(0)).toBeNull();
    expect(proposeEnvelope(-10)).toBeNull();
    expect(proposeEnvelope(Number.NaN)).toBeNull();
  });
  it('proposée tant que personne n’en a fixé une, fixée ensuite', () => {
    const proposed = envelopeView({ target: null, planned: 400, spent: 80 });
    expect(proposed).toMatchObject({ total: 480, amount: 500, proposed: true, fixed: null, usedPct: 96, over: false, gap: 20 });
    const fixed = envelopeView({ target: 450, planned: 400, spent: 80 });
    expect(fixed).toMatchObject({ amount: 450, proposed: false, fixed: 450, over: true, gap: 30, barPct: 100 });
    expect(fixed.usedPct).toBe(107);
  });
  it('sans rien de prévu : aucune enveloppe, aucune barre', () => {
    expect(envelopeView({ target: null, planned: 0, spent: 0 })).toMatchObject({ amount: null, usedPct: null, gap: null, over: false });
  });
  it('une enveloppe à 0 compte comme non fixée', () => {
    expect(envelopeView({ target: 0, planned: 120, spent: 0 })).toMatchObject({ fixed: null, proposed: true, amount: 150 });
  });
  it('le total est prévu + déjà payé, au centime', () => {
    expect(budgetTotal({ planned: 10.1, spent: 20.2 })).toBe(30.3);
  });
  it('le stepper garde un pas minimum et le plafond du serveur', () => {
    expect(stepEnvelope(600, 1)).toBe(650);
    expect(stepEnvelope(60, -1)).toBe(50);
    expect(stepEnvelope(10_000_000, 1)).toBe(10_000_000);
  });
  it('la saisie d’enveloppe refuse 0, le négatif, le texte et le trop grand', () => {
    expect(parseEnvelope('750')).toEqual({ ok: true, amount: 750 });
    expect(parseEnvelope('1 200,5')).toEqual({ ok: true, amount: 1200.5 });
    for (const bad of ['', '0', '-5', 'abc', '1e9', '10000001']) expect(parseEnvelope(bad).ok, bad).toBe(false);
  });
});

describe('budget : postes', () => {
  it('reconnaît les écritures de l’écran actuel et de la maquette', () => {
    expect(postOf('hébergement').key).toBe('lodging');
    expect(postOf('Nuits').key).toBe('lodging');
    expect(postOf('repas').key).toBe('food');
    expect(postOf('nourriture').key).toBe('food');
    expect(postOf('Activités').key).toBe('activities');
    expect(postOf('matériel').key).toBe('gear');
    expect(postOf(null)).toEqual({ key: 'misc', label: null });
    expect(postOf('Autre').key).toBe('misc');
  });
  it('un poste libre reste tel que la personne l’a écrit', () => {
    expect(postOf('  Cadeaux ')).toEqual({ key: 'custom', label: 'Cadeaux' });
  });
  it('regroupe les écritures d’un même poste et classe par montant', () => {
    const rows = postRows([
      { category: 'repas', amount: 48 },
      { category: 'transport', amount: 32 },
      { category: 'nourriture', amount: 12 },
      { category: 'Cadeaux', amount: 20 },
      { category: 'divers', amount: 0 },
    ]);
    expect(rows.map((r) => [r.key, r.amount])).toEqual([
      ['food', 60],
      ['transport', 32],
      ['custom', 20],
    ]);
    expect(rows.reduce((s, r) => s + r.pct, 0)).toBeGreaterThanOrEqual(99);
    expect(rows[0].pct).toBe(54);
  });
  it('sans dépense, aucun poste', () => {
    expect(postRows([])).toEqual([]);
  });
});

describe('budget : dépenses', () => {
  it('sépare payées et prévues, avec le nom du payeur ou null', () => {
    const { model } = makeData({
      expenses: [
        { id: 'a', title: 'Essence', amount: 32, category: 'transport', isPlanned: false, payerId: U.tony, splitType: 'equal' },
        { id: 'b', title: 'Refuge', amount: 90, category: 'hébergement', isPlanned: true, payerId: 'parti', splitType: 'equal' },
      ],
    });
    const nameOf = (id: string) => model.crew.loads.find((m) => m.userId === id)?.name ?? null;
    const g = expenseGroups(
      [
        { id: 'a', title: 'Essence', amount: 32, category: 'transport', isPlanned: false, payerId: U.tony, splitType: 'equal' },
        { id: 'b', title: 'Refuge', amount: 90, category: 'hébergement', isPlanned: true, payerId: 'parti', splitType: 'equal' },
      ],
      nameOf
    );
    expect(g.paid).toHaveLength(1);
    expect(g.paid[0]).toMatchObject({ title: 'Essence', payerName: 'Tony', post: 'transport' });
    expect(g.planned[0]).toMatchObject({ title: 'Refuge', payerName: null, post: 'lodging' });
  });
});

describe('budget : saisie d’une dépense', () => {
  it('accepte les écritures usuelles d’un montant', () => {
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('1 200')).toBe(1200);
    expect(parseAmount('3.40')).toBe(3.4);
    expect(parseAmount('0,005')).toBe(0.01);
  });
  it('refuse tout le reste', () => {
    for (const bad of ['', 'abc', '1,2,3', '1e3', '--4', '12 €', '1.2.3']) expect(parseAmount(bad), bad).toBeNull();
  });
  it('valide libellé et montant', () => {
    expect(validateExpenseDraft({ title: '  Courses   Villard ', amount: '48,20' })).toEqual({ ok: true, title: 'Courses Villard', amount: 48.2 });
  });
  it('libellé : 2 à 80 caractères, caractères de contrôle retirés', () => {
    expect(validateExpenseDraft({ title: 'a', amount: '5' })).toEqual({ ok: false, issues: { title: 'length' } });
    expect(validateExpenseDraft({ title: 'x'.repeat(81), amount: '5' })).toMatchObject({ ok: false, issues: { title: 'length' } });
    expect(validateExpenseDraft({ title: 'x'.repeat(80), amount: '5' }).ok).toBe(true);
    expect(validateExpenseDraft({ title: 'a\u0000b\nc', amount: '5' })).toMatchObject({ ok: true, title: 'a b c' });
  });
  it('montant : > 0 et plafonné', () => {
    expect(validateExpenseDraft({ title: 'Essence', amount: '0' })).toEqual({ ok: false, issues: { amount: 'invalid' } });
    expect(validateExpenseDraft({ title: 'Essence', amount: '' })).toEqual({ ok: false, issues: { amount: 'invalid' } });
    expect(validateExpenseDraft({ title: 'Essence', amount: String(EXPENSE_MAX + 1) })).toEqual({ ok: false, issues: { amount: 'max' } });
    expect(validateExpenseDraft({ title: 'Essence', amount: String(EXPENSE_MAX) }).ok).toBe(true);
  });
  it('les deux erreurs sont rendues ensemble', () => {
    expect(validateExpenseDraft({ title: '', amount: 'x' })).toEqual({ ok: false, issues: { title: 'length', amount: 'invalid' } });
  });
  it('un libellé HTML reste du texte (jamais interprété : il est rendu par React)', () => {
    const r = validateExpenseDraft({ title: '<img src=x onerror=alert(1)>', amount: '5' });
    expect(r).toMatchObject({ ok: true, title: '<img src=x onerror=alert(1)>' });
  });
});

describe('budget : corps des actions existantes', () => {
  it('addExpenseAction : tous les champs lus par l’action', () => {
    const fd = addFormData(ctx, { title: 'Courses', amount: 48.2, category: 'nourriture', payerId: U.claire, planned: false });
    expect(Object.fromEntries(fd.entries())).toEqual({
      tripId: TRIP,
      tripSlug: 'vercors-novembre',
      title: 'Courses',
      amount: '48.2',
      currency: 'EUR',
      category: 'nourriture',
      splitType: 'equal',
      isPlanned: 'false',
      payerId: U.claire,
    });
  });
  it('sans payeur choisi (solo), le champ n’est pas envoyé', () => {
    expect(addFormData(ctx, { title: 'Courses', amount: 5, category: 'divers', payerId: null, planned: true }).has('payerId')).toBe(false);
  });
  it('updateExpenseAction : seuls les champs fournis partent', () => {
    const fd = updateFormData(ctx, 'e1', { amount: 20 });
    expect([...fd.keys()].sort()).toEqual(['amount', 'expenseId', 'tripId', 'tripSlug']);
    expect(updateFormData(ctx, 'e1', { planned: true, payerId: U.leo }).get('isPlanned')).toBe('true');
  });
  it('settleExpenseAction : payeur facultatif', () => {
    expect(settleFormData(ctx, 'e1').has('payerId')).toBe(false);
    expect(settleFormData(ctx, 'e1', U.maya).get('payerId')).toBe(U.maya);
  });
  it('une dépense supprimée est recréée à l’identique, sauf parts libres', () => {
    const row = expenseGroups([{ id: 'a', title: 'Essence', amount: 32, category: 'transport', isPlanned: false, payerId: U.tony, splitType: 'equal' }], () => 'Tony').paid[0];
    expect(canRestore(row)).toBe(true);
    expect(restoreFields(row)).toMatchObject({ title: 'Essence', amount: 32, category: 'transport', payerId: U.tony, planned: false, splitType: 'equal' });
    expect(canRestore({ splitType: 'custom' })).toBe(false);
  });
});

describe('budget : qui doit quoi', () => {
  const members = [
    { userId: U.tony, name: 'Tony' },
    { userId: U.claire, name: 'Claire' },
    { userId: U.leo, name: 'Léo' },
    { userId: U.maya, name: 'Maya' },
  ];
  it('rend les virements du moteur, orientés vers le lecteur', () => {
    const st = settleExpenses(
      [
        { amount: 80, isPlanned: false, payerId: U.tony, splitType: 'equal' },
        { amount: 40, isPlanned: false, payerId: U.claire, splitType: 'equal' },
      ],
      members
    );
    const v = settleView(st, 4, U.tony, 120);
    expect(v.counted).toBe(120);
    expect(v.perPerson).toBe(30);
    expect(v.balanced).toBe(false);
    const total = v.debts.reduce((s, d) => s + d.amount, 0);
    expect(total).toBeCloseTo(60, 2);
    expect(v.debts.every((d) => d.toId === U.tony || d.toId === U.claire)).toBe(true);
    expect(v.debts.filter((d) => d.viewer === 'gets').every((d) => d.toId === U.tony)).toBe(true);
    expect(v.debts.some((d) => d.viewer === 'pays')).toBe(false);
  });
  it('le moins de virements possible : 3 débiteurs, 1 créancier, 3 virements', () => {
    const st = settleExpenses([{ amount: 100, isPlanned: false, payerId: U.tony, splitType: 'equal' }], members);
    expect(settleView(st, 4, null, 100).debts).toHaveLength(3);
  });
  it('tout le monde quitte ; aucune dépense ; parts libres comptées à part', () => {
    const even = settleExpenses([{ amount: 40, isPlanned: false, payerId: U.tony, splitType: 'individual' }], members);
    expect(settleView(even, 4, U.tony, 40).balanced).toBe(true);
    const none = settleExpenses([], members);
    expect(settleView(none, 4, U.tony, 0)).toMatchObject({ empty: true, perPerson: null, balances: [] });
    const custom = settleExpenses([{ amount: 30, isPlanned: false, payerId: U.tony, splitType: 'custom' }], members);
    expect(settleView(custom, 4, U.tony, 30)).toMatchObject({ excludedCount: 1, excludedAmount: 30, empty: false });
  });
  it('les dépenses prévues ne comptent pas', () => {
    const st = settleExpenses([{ amount: 500, isPlanned: true, payerId: U.tony, splitType: 'equal' }], members);
    expect(settleView(st, 4, U.tony, 0).empty).toBe(true);
  });
});

describe('budget : autres devises', () => {
  const fx = {
    targets: [
      { currency: 'CHF', kinds: ['voyageur' as const] },
      { currency: 'JPY', kinds: ['destination' as const] },
    ],
    rates: { CHF: { base: 'EUR' as const, currency: 'CHF', rate: 0.94, date: '2026-10-21', source: 'Frankfurter' } },
  };
  const items = [
    { id: 'planned' as const, amount: 600 },
    { id: 'spent' as const, amount: 80 },
    { id: 'envelope' as const, amount: null },
  ];
  it('convertit avec le taux, sa date et sa source', () => {
    const [chf] = fxViews(fx, 'EUR', items);
    expect(chf).toMatchObject({ currency: 'CHF', unavailable: false, rate: 0.94, date: '2026-10-21', source: 'Frankfurter' });
    expect(chf.parts).toEqual([
      { id: 'planned', amount: 564 },
      { id: 'spent', amount: 75.2 },
    ]);
  });
  it('un taux absent n’est jamais deviné : la devise est dite indisponible', () => {
    const jpy = fxViews(fx, 'EUR', items)[1];
    expect(jpy).toMatchObject({ currency: 'JPY', unavailable: true, rate: null, parts: [] });
  });
  it('sans devise à montrer ou sans montant, aucune ligne', () => {
    expect(fxViews(null, 'EUR', items)).toEqual([]);
    expect(fxViews(fx, 'EUR', [{ id: 'planned', amount: 0 }])).toEqual([]);
  });
});
