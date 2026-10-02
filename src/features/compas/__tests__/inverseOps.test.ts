import { describe, expect, it } from 'vitest';
import { inverseOps } from '../components/compasApply';
import type { CompasCtl } from '../components/compasTypes';

const ctl = (over: Record<string, unknown> = {}) =>
  ({
    data: {
      model: {
        dates: { start: '2026-10-10', end: '2026-10-12', hours: null, days: 3 },
        preferences: { pace: 'normal', nights: null, avoid: [], wishes: [] },
        activity: 'hiking',
        budget: { target: 300 },
        ...over,
      },
    },
  }) as unknown as CompasCtl;

describe('inverseOps — l’état d’avant, jamais une valeur supposée', () => {
  it('rétablit dates, activité, préférences et budget, dans l’ordre inverse', () => {
    const inv = inverseOps(ctl(), [
      {
        op: 'dates',
        startDate: '2026-10-11',
        endDate: '2026-10-13',
        durationHours: null,
        resplit: false,
      },
      { op: 'activity', activity: 'trekking' },
      { op: 'budget', amount: 500 },
    ]);
    expect(inv).toEqual([
      { op: 'budget', amount: 300 },
      { op: 'activity', activity: 'hiking' },
      {
        op: 'dates',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        durationHours: null,
        resplit: false,
      },
    ]);
  });

  it('CONTRE-EXEMPLES — pas d’annulation quand l’inverse n’est pas sûr', () => {
    // Dates redécoupées en étapes : le découpage d'avant n'est pas restituable.
    expect(
      inverseOps(ctl(), [
        {
          op: 'dates',
          startDate: '2026-10-11',
          endDate: '2026-10-13',
          durationHours: null,
          resplit: true,
        },
      ])
    ).toBeNull();
    // Objet ajouté, nombre de personnes : pas d'inverse.
    expect(inverseOps(ctl(), [{ op: 'item', name: 'Gourde', quantity: 1 }])).toBeNull();
    expect(inverseOps(ctl(), [{ op: 'party', partySize: 4 }])).toBeNull();
    // Rien avant : rien à rétablir.
    expect(
      inverseOps(ctl({ activity: null }), [{ op: 'activity', activity: 'trekking' }])
    ).toBeNull();
    expect(inverseOps(ctl({ budget: { target: null } }), [{ op: 'budget', amount: 9 }])).toBeNull();
  });
});
