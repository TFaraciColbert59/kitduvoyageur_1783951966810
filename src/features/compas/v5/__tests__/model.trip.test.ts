import { describe, expect, it } from 'vitest';
import { FR_T } from '../../components/compasTypes';
import { dayRangeLabel, moneyShort, weightShort } from '../model/format';
import { readiness, selectCountdown, selectDays, selectHeadline, selectPoints, splitStepTitle } from '../model/trip';
import { makeData } from './fixtures';

describe('v5 · modèle de vue du voyage', () => {
  it('splitStepTitle retire le préfixe « Jour n · » dans toute langue', () => {
    expect(splitStepTitle('Jour 2 · Corrençon-en-Vercors')).toBe('Corrençon-en-Vercors');
    expect(splitStepTitle('Day 3: La Chapelle')).toBe('La Chapelle');
    expect(splitStepTitle('Rencurel')).toBe('Rencurel');
  });

  it('selectDays : un jour par plan, la météo réelle du jour, le dernier jour repéré', () => {
    const data = makeData();
    const days = selectDays(data, 'fr');
    expect(days).toHaveLength(data.model.route.dayPlans.length);
    expect(days[0].index).toBe(0);
    expect(days.at(-1)?.isLast).toBe(true);
    expect(days.slice(0, -1).every((d) => !d.isLast)).toBe(true);
    // Chaque jour dont la date a une prévision la porte ; sinon null (jamais comblé).
    for (const d of days) {
      const real = data.model.weather.days.find((w) => w.date === d.date);
      expect(d.weather === null).toBe(!real);
      if (real && d.weather) {
        expect(d.weather.tMaxC).toBe(real.tempMaxC);
        expect(d.weather.code).toBe(real.weathercode);
      }
    }
  });

  it('selectDays : le départ du jour n est l arrivée du jour précédent', () => {
    const days = selectDays(makeData(), 'fr');
    for (let i = 1; i < days.length; i++) expect(days[i].from).toBe(days[i - 1].to);
  });

  it('selectCountdown : jours avant le départ, négatif si parti, null sans date', () => {
    expect(selectCountdown('2026-11-03', '2026-10-22')).toBe(12);
    expect(selectCountdown('2026-11-03', '2026-11-03')).toBe(0);
    expect(selectCountdown('2026-11-03', '2026-11-05')).toBe(-2);
    expect(selectCountdown(null, '2026-10-22')).toBeNull();
    expect(selectCountdown('pas une date', '2026-10-22')).toBeNull();
  });

  it('selectHeadline : les chiffres du voyage viennent du moteur', () => {
    const data = makeData();
    const head = selectHeadline(data);
    expect(head.people).toBe(4);
    expect(head.currency).toBe('EUR');
    expect(head.days).toBe(data.model.route.days || data.model.dates.days);
  });

  it('selectPoints : des faits sourcés avec leur geste, jamais une note', () => {
    const data = makeData();
    const points = selectPoints(data, FR_T, 'fr');
    // La trousse de secours vitale est à acheter : un point bloquant dirigé vers le sac.
    const vital = points.find((p) => p.id === 'vital');
    expect(vital?.severity).toBe('block');
    expect(vital?.action?.space).toBe('sac');
    expect(vital?.source.length).toBeGreaterThan(0);
    // Les deux objets communs sans porteur sont signalés.
    expect(points.find((p) => p.id === 'carriers')?.action).toEqual({ space: 'sac', tab: 2 });
    // Aucun point ne porte de score : seulement du texte, une sévérité et une source.
    for (const p of points) {
      expect(['info', 'warn', 'block']).toContain(p.severity);
      expect(p.source).toBeTruthy();
      expect(p.text).not.toMatch(/\b\d+\s*\/\s*100\b/);
    }
  });

  it('selectPoints : sans date de départ, le point « dates » mène à Voyage', () => {
    const noDate = makeData({
      trip: {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'sans-date',
        title: 'Sans date',
        destinationName: 'Vercors',
        startDate: null,
        endDate: null,
        primaryActivity: 'hiking',
        estimatedBudget: null,
        budgetCurrency: 'EUR',
        partySize: 1,
        ownerId: '22222222-2222-4222-8222-222222222222',
      },
    });
    const dates = selectPoints(noDate, FR_T, 'fr').find((p) => p.id === 'dates');
    expect(dates?.action).toEqual({ space: 'voyage', tab: 2 });
  });

  it('readiness : un compte de points ouverts, « bloqué » si un seul bloque, « prêt » sans rien', () => {
    expect(readiness([])).toEqual({ state: 'ready', count: 0 });
    expect(readiness([{ id: 'a', kind: 'toi', text: '', severity: 'info', action: null, source: 's' }])).toEqual({ state: 'ready', count: 0 });
    expect(readiness([{ id: 'a', kind: 'toi', text: '', severity: 'warn', action: null, source: 's' }])).toEqual({ state: 'almost', count: 1 });
    expect(
      readiness([
        { id: 'a', kind: 'toi', text: '', severity: 'warn', action: null, source: 's' },
        { id: 'b', kind: 'terrain', text: '', severity: 'block', action: null, source: 's' },
      ])
    ).toEqual({ state: 'blocked', count: 2 });
  });
});

describe('v5 · formats courts', () => {
  it('dayRangeLabel : plage dans un mois, entre deux mois, un seul jour, sans date', () => {
    expect(dayRangeLabel('2026-11-03', '2026-11-05', 'fr')).toBe('3–5 novembre');
    expect(dayRangeLabel('2026-10-28', '2026-11-02', 'fr')).toMatch(/28 oct\.? – 2 nov\.?/);
    expect(dayRangeLabel('2026-11-03', '2026-11-03', 'fr')).toBe('3 novembre');
    expect(dayRangeLabel('2026-11-03', null, 'fr')).toBe('3 novembre');
    expect(dayRangeLabel(null, null, 'fr')).toBeNull();
    expect(dayRangeLabel('n importe quoi', null, 'fr')).toBeNull();
  });

  it('moneyShort : sans décimales quand le montant est rond, selon la langue', () => {
    expect(moneyShort(150, 'EUR', 'fr')).toMatch(/^150\s?€$/);
    expect(moneyShort(150, 'EUR', 'en')).toMatch(/€150/);
    expect(moneyShort(149.5, 'EUR', 'fr')).toMatch(/149,50\s?€/);
  });

  it('weightShort : kilogrammes à une décimale', () => {
    expect(weightShort(3700, 'fr')).toBe('3,7 kg');
    expect(weightShort(3700, 'en')).toBe('3.7 kg');
    expect(weightShort(250, 'fr')).toBe('0,3 kg');
  });
});
