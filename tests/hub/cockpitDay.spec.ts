import { describe, expect, it } from 'vitest';
import { cockpitDayBudget, cockpitDayRoute, currentCockpitDay, momentClock } from '@/features/hub/cockpit/day';
import type { CockpitData, CockpitStep, Coordinate } from '@/features/hub/cockpit/model';

describe('jour du cockpit', () => {
  it('compte les jours civils du voyage et borne le jour à son intervalle', () => {
    expect(currentCockpitDay('2026-10-24', 4, '2026-10-23')).toBe(1);
    expect(currentCockpitDay('2026-10-24', 4, '2026-10-26')).toBe(3);
    expect(currentCockpitDay('2026-10-24T07:00:00Z', 4, '2026-11-01')).toBe(4);
  });

  it('garde les lignes du jour, les devises et le budget journalier enregistré', () => {
    const budget: NonNullable<CockpitData['budget']> = {
      planned: { amount: 300, currency: 'EUR' },
      expenses: [
        { id: 'a', title: 'A', date: '2026-11-19', amount: 15, currency: 'EUR' },
        { id: 'b', title: 'B', date: '2026-11-19', amount: 30, currency: 'GBP' },
        { id: 'c', title: 'C', date: '2026-11-19', amount: 80, currency: 'EUR', planned: true },
        { id: 'd', title: 'D', date: '2026-11-20', amount: 35, currency: 'EUR' },
      ],
    };
    const day = cockpitDayBudget(budget, '2026-11-18', 2, 4, '2026-11-19');
    expect(day.expenses.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(day.spent).toEqual([{ amount: 15, currency: 'EUR' }, { amount: 30, currency: 'GBP' }]);
    expect(day.planned).toEqual([{ amount: 80, currency: 'EUR' }]);
    expect(day.estimate).toBe(false);
    expect(cockpitDayBudget(budget, '2026-11-18', 3, 4, '2026-11-19').planned).toEqual([]);
  });

  it('répartit une enveloppe seule au centime en conservant son total', () => {
    const budget = { planned: { amount: 100, currency: 'EUR' }, expenses: [] };
    const days = [1, 2, 3].map((day) => cockpitDayBudget(budget, '2026-11-18', day, 3, '2026-11-19'));
    expect(days.map(({ planned }) => planned[0].amount)).toEqual([33.34, 33.33, 33.33]);
    expect(days.every(({ estimate }) => estimate)).toBe(true);
  });

  it('isole la portion géolocalisée de la journée', () => {
    const line: Coordinate[] = [[6.7, 44.7], [6.8, 44.7], [6.9, 44.7], [7, 44.7]];
    const step = (id: string, coordinate: Coordinate): CockpitStep => ({
      id, day: 2, title: 'Étape', coordinate, time: null, place: null, distance: null, elevation: null, description: null,
    });
    const steps = [step('s1', line[1]), step('s2', line[2])];
    expect(cockpitDayRoute([line], steps, 2, 3)).toEqual([[line[1], line[2]]]);
    expect(cockpitDayRoute([line], steps.slice(0, 1), 2, 3)).toEqual([]);
    expect(cockpitDayRoute([line], [], 1, 1)).toEqual([line]);
  });

  it('privilégie l’heure locale enregistrée pour un moment', () => {
    expect(momentClock('08:19:00', '2026-11-19T07:19:00Z')).toBe('08:19');
    expect(momentClock(null, '2026-11-19T10:42:00Z')).toBe('10:42');
    expect(momentClock(null, null)).toBeNull();
  });
});
