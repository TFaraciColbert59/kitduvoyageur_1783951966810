// @vitest-environment jsdom

/*
 * PLAN-100 phase 6, lot 4 : formateurs des tiroirs du Compas. En français, chaque
 * valeur s'écrit EXACTEMENT comme avant (formateurs du moteur, `String(n).replace('.', ',')`,
 * `Intl.DateTimeFormat('fr-FR')`) ; en anglais, les mêmes valeurs suivent la locale.
 */

import { describe, expect, it } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { formatDayMonth, formatKg, formatMoney } from '../engine/format';
import {
  dayMonthIn,
  decimalIn,
  kgIn,
  litersIn,
  moneyIn,
  rich,
  weekdayDayIn,
} from '../components/sheetsI18n';

describe('formateurs des tiroirs : français inchangé', () => {
  it('poids : identique à formatKg', () => {
    for (const g of [null, undefined, Number.NaN, 0, 12, 999.6, 1000, 1234, 15_500, 1_234_567]) {
      expect(kgIn('fr', g)).toBe(formatKg(g));
    }
  });

  it('montants : identiques à formatMoney (devise, centimes, absence)', () => {
    for (const [a, c] of [
      [12, 'EUR'],
      [12.5, 'EUR'],
      [1234.56, 'CHF'],
      [null, 'EUR'],
      [99, 'USD'],
      [5, 'XXX-invalide'],
    ] as const) {
      expect(moneyIn('fr', a, c)).toBe(formatMoney(a, c));
    }
    expect(moneyIn('fr', 7)).toBe(formatMoney(7));
  });

  it('dates : « sam. 12 oct. » comme formatDayMonth', () => {
    for (const iso of ['2026-10-17', '2026-02-01', '2026-08-15', 'pas-une-date']) {
      expect(dayMonthIn('fr', iso)).toBe(formatDayMonth(iso));
    }
  });

  it('jour météo : identique à Intl fr-FR (jour court, quantième, mois court, UTC)', () => {
    const wx = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    expect(weekdayDayIn('fr', '2026-10-17')).toBe(wx.format(new Date('2026-10-17T12:00:00Z')));
  });

  it('décimales et litres : virgule, sans espace de milliers, comme String(n).replace', () => {
    for (const v of [0.1, 1.0834, 4.5, 2, 12345, 0.75]) {
      expect(decimalIn('fr', v)).toBe(String(v).replace('.', ','));
      expect(litersIn('fr', v)).toBe(`${String(v).replace('.', ',')} L`);
    }
  });
});

describe('formateurs des tiroirs : anglais', () => {
  it('suivent la locale', () => {
    expect(kgIn('en', 1234)).toBe('1.2 kg');
    expect(kgIn('en', 1_234_567)).toBe('1,234.6 kg');
    expect(moneyIn('en', 12)).toBe('€12');
    expect(moneyIn('en', 12.5, 'USD')).toBe('$12.50');
    expect(moneyIn('en', null)).toBe('—');
    expect(dayMonthIn('en', '2026-10-17')).toBe('Sat, Oct 17');
    expect(decimalIn('en', 4.5)).toBe('4.5');
    expect(litersIn('en', 1.5)).toBe('1.5 L');
  });
});

describe('rich : un gabarit avec des emplacements riches', () => {
  it('remplace chaque {nom} par son nœud, garde le texte autour', () => {
    const { container } = render(
      <p>{rich('{count} personnes dans ce voyage', { count: <b>3</b> })}</p>
    );
    expect(container.innerHTML).toBe('<p><b>3</b> personnes dans ce voyage</p>');
  });

  it('plusieurs emplacements, ordre libre (anglais)', () => {
    const { container } = render(
      <p>
        {rich('{from} owes {to} {amount}', { from: <b>Léa</b>, to: <b>Tom</b>, amount: '12 €' })}
      </p>
    );
    expect(container.textContent).toBe('Léa owes Tom 12 €');
    expect(container.querySelectorAll('b')).toHaveLength(2);
  });

  it('un emplacement inconnu reste lisible tel quel', () => {
    const { container } = render(<p>{rich('a {x} b', {})}</p>);
    expect(container.textContent).toBe('a {x} b');
  });
});
