import { describe, expect, it } from 'vitest';
import type { FxRate } from '../engine/currency';
import { budgetInOtherCurrencies, fxTargets, type BudgetFxData } from '../engine/budgetFx';

/**
 * Budget affiché aussi dans la devise du voyageur (profil) et dans celle du pays de
 * destination (PLAN-100 4.2 et 4.6) : le calcul reste en euros, la conversion se dit avec son
 * taux, sa date et sa source, et n'est jamais stockée.
 */

const rate = (currency: string, value: number, date = '2026-10-09', source = 'Frankfurter (banques centrales)'): FxRate => ({
  base: 'EUR',
  currency,
  rate: value,
  date,
  source,
});

describe('fxTargets — les devises à montrer en plus', () => {
  it('la devise du voyageur d’abord, puis celle du pays de destination', () => {
    expect(fxTargets({ tripCurrency: 'EUR', traveller: 'CHF', destination: 'JPY' })).toEqual([
      { currency: 'CHF', kinds: ['voyageur'] },
      { currency: 'JPY', kinds: ['destination'] },
    ]);
  });

  it('jamais la devise du voyage (déjà affichée), ni deux fois la même', () => {
    expect(fxTargets({ tripCurrency: 'EUR', traveller: 'EUR', destination: 'EUR' })).toEqual([]);
    expect(fxTargets({ tripCurrency: 'USD', traveller: 'USD', destination: 'USD' })).toEqual([]);
    expect(fxTargets({ tripCurrency: 'EUR', traveller: 'CHF', destination: 'CHF' })).toEqual([
      { currency: 'CHF', kinds: ['voyageur', 'destination'] },
    ]);
  });

  it('une devise inconnue, mal écrite ou absente est ignorée (rien n’est deviné)', () => {
    expect(fxTargets({ tripCurrency: 'EUR', traveller: null, destination: null })).toEqual([]);
    expect(fxTargets({ tripCurrency: 'EUR', traveller: 'chf', destination: 'EURO' })).toEqual([]);
    expect(fxTargets({ tripCurrency: 'EUR', traveller: 'ZZZ', destination: 'XXX' })).toEqual([]);
  });

  it('voyage en dollars, voyageur suisse : le franc est montré, le dollar non', () => {
    expect(fxTargets({ tripCurrency: 'USD', traveller: 'CHF', destination: 'USD' })).toEqual([
      { currency: 'CHF', kinds: ['voyageur'] },
    ]);
  });
});

describe('budgetInOtherCurrencies — le montant converti, avec son taux, sa date et sa source', () => {
  const fx: BudgetFxData = {
    targets: [
      { currency: 'CHF', kinds: ['voyageur'] },
      { currency: 'JPY', kinds: ['destination'] },
    ],
    rates: { CHF: rate('CHF', 0.93), JPY: rate('JPY', 176.2, '2026-10-08', 'currency-api') },
  };
  const items = [
    { label: 'prévu', amount: 1000 },
    { label: 'par personne', amount: 250 },
  ];

  it('convertit chaque montant et dit le taux, la date et la source à côté', () => {
    const [chf, jpy] = budgetInOtherCurrencies(items, 'EUR', fx);
    expect(chf.currency).toBe('CHF');
    expect(chf.title).toBe('Dans ta devise (CHF)');
    expect(chf.parts.map((p) => `${p.label} ${p.text}`)).toEqual([
      expect.stringMatching(/^prévu ≈ 930\s(CHF|Fr\.?)/),
      expect.stringMatching(/^par personne ≈ 233\s(CHF|Fr\.?)/),
    ]);
    expect(chf.note).toBe('1 € = 0,93 CHF · taux du 9 octobre 2026 · Frankfurter (banques centrales)');
    expect(jpy.title).toBe('Dans la devise du pays (JPY)');
    expect(jpy.parts[0].text).toMatch(/176[\s ]200/);
    expect(jpy.note).toBe('1 € = 176,2 JPY · taux du 8 octobre 2026 · currency-api');
  });

  it('une devise à la fois celle du voyageur et celle du pays le dit', () => {
    const both: BudgetFxData = {
      targets: [{ currency: 'CHF', kinds: ['voyageur', 'destination'] }],
      rates: { CHF: rate('CHF', 0.93) },
    };
    expect(budgetInOtherCurrencies(items, 'EUR', both)[0].title).toBe('Dans ta devise et celle du pays (CHF)');
  });

  it('un montant absent (enveloppe non fixée) n’est pas converti en zéro', () => {
    const lines = budgetInOtherCurrencies([{ label: 'enveloppe', amount: null }, { label: 'prévu', amount: 100 }], 'EUR', fx);
    expect(lines[0].parts).toHaveLength(1);
    expect(lines[0].parts[0].label).toBe('prévu');
  });

  it('rien à convertir : aucune ligne', () => {
    expect(budgetInOtherCurrencies([{ label: 'prévu', amount: null }], 'EUR', fx)).toEqual([]);
    expect(budgetInOtherCurrencies([{ label: 'prévu', amount: 0 }], 'EUR', fx)).toEqual([]);
    expect(budgetInOtherCurrencies(items, 'EUR', null)).toEqual([]);
    expect(budgetInOtherCurrencies(items, 'EUR', { targets: [], rates: {} })).toEqual([]);
  });

  it('taux indisponible : la ligne le dit, aucun montant deviné', () => {
    const lines = budgetInOtherCurrencies(items, 'EUR', { targets: fx.targets, rates: { CHF: rate('CHF', 0.93) } });
    expect(lines[0].unavailable).toBe(false);
    expect(lines[1]).toMatchObject({ currency: 'JPY', unavailable: true, parts: [] });
    expect(lines[1].note).toBe('Conversion en JPY indisponible : taux de change non joignable pour l’instant.');
  });

  it('voyage en dollars : le passage par l’euro est dit avec la date du plus ancien des taux', () => {
    const usd: BudgetFxData = {
      targets: [{ currency: 'CHF', kinds: ['voyageur'] }],
      rates: { USD: rate('USD', 1.1, '2026-10-07', 'currency-api'), CHF: rate('CHF', 0.93, '2026-10-09') },
    };
    const [chf] = budgetInOtherCurrencies([{ label: 'prévu', amount: 110 }], 'USD', usd);
    expect(chf.parts[0].text).toMatch(/^≈ 93\s(CHF|Fr\.?)/);
    expect(chf.note).toBe('1 USD = 0,8455 CHF · taux du 7 octobre 2026 · currency-api · Frankfurter (banques centrales)');
  });

  it('voyage en dollars sans le taux du dollar : indisponible, jamais un calcul à moitié', () => {
    const usd: BudgetFxData = { targets: [{ currency: 'CHF', kinds: ['voyageur'] }], rates: { CHF: rate('CHF', 0.93) } };
    expect(budgetInOtherCurrencies([{ label: 'prévu', amount: 110 }], 'USD', usd)[0].unavailable).toBe(true);
  });

  it('une somme sous 100 garde ses centimes, une plus grande est arrondie à l’unité', () => {
    const [chf] = budgetInOtherCurrencies(
      [
        { label: 'petit', amount: 3 },
        { label: 'grand', amount: 1234.56 },
      ],
      'EUR',
      { targets: [{ currency: 'CHF', kinds: ['voyageur'] }], rates: { CHF: rate('CHF', 0.93) } }
    );
    expect(chf.parts[0].text).toMatch(/^≈ 2,79\s/);
    expect(chf.parts[1].text).toMatch(/^≈ 1[\s ]148\s/);
  });
});
