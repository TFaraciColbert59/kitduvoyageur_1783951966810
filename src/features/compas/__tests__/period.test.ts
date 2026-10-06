import { describe, expect, it } from 'vitest';
import { bestPeriod, monthName } from '../engine/period';

const today = '2026-10-06';

describe('Meilleure période sans date', () => {
  it('« 7 jours en Allemagne » (randonnée) : septembre de l’an prochain, départ un samedi', () => {
    const p = bestPeriod({ activity: 'hiking', lat: 51.17, today, days: 7 });
    expect(p).toMatchObject({ month: 9, start: '2027-09-04', end: '2027-09-10' });
    expect(new Date(`${p!.start}T12:00:00Z`).getUTCDay()).toBe(6);
    expect(p!.why).toMatch(/moins de monde/);
  });

  it('« 10 jours en Norvège » : juillet, jours les plus longs', () => {
    expect(bestPeriod({ activity: 'trekking', lat: 61, today, days: 10 })).toMatchObject({
      month: 7,
      why: 'sentiers déneigés, jours les plus longs',
    });
  });

  it('ski dans les Alpes : février ; en Patagonie : août (hémisphère sud)', () => {
    expect(bestPeriod({ activity: 'ski', lat: 45.9, today, days: 6 })?.month).toBe(2);
    expect(bestPeriod({ activity: 'ski', lat: -41, today, days: 6 })?.month).toBe(8);
  });

  it('Patagonie en trek : saison australe (mars)', () => {
    expect(bestPeriod({ activity: 'trekking', lat: -51, today, days: 8 })?.month).toBe(3);
  });

  it('ville : mai, avant l’affluence', () => {
    expect(bestPeriod({ activity: 'citytrip', lat: 41.9, today, days: 3 })?.month).toBe(5);
  });

  it('tropiques : aucune période inventée', () => {
    expect(bestPeriod({ activity: 'hiking', lat: 9.7, today, days: 7 })).toBeNull();
  });

  it('jamais moins de trois semaines devant', () => {
    const p = bestPeriod({ activity: 'hiking', lat: 45, today: '2026-05-25', days: 3 });
    expect(p!.start).toBe('2026-06-20');
    expect(monthName(p!.month)).toBe('juin');
  });
});
