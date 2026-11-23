import { describe, expect, it } from 'vitest';
import { assessDanger } from '@/features/compas/engine/danger';
import { dayPlansForChecks, weatherDaysOf, type ChecksDay } from '../sharedChecksModel';

const day = (over: Partial<ChecksDay> = {}): ChecksDay => ({
  day: 1, dateIso: '2026-12-01', title: 'Jour 1', lat: 45.1, lon: 6.1, distanceKm: 14, gainM: 900, lossM: 300, walkMin: 360, stay: null, ...over,
});

describe('Vérifications partagées avec le Compas (10.7)', () => {
  it('ne garde pour la météo que les jours datés ET situés', () => {
    const plans = dayPlansForChecks([day(), day({ day: 2, dateIso: null }), day({ day: 3, lat: null }), day({ day: 4, dateIso: 'demain' })]);
    expect(weatherDaysOf(plans).map((d) => d.day)).toEqual([1]);
  });

  it('un itinéraire sans prévision ni alerte laisse les axes non évalués (jamais « sans danger »)', () => {
    const plans = dayPlansForChecks([day({ dateIso: null })]);
    const danger = assessDanger({ dayPlans: plans, forecasts: [], alerts: [], alertsStatus: 'indisponibles' });
    expect(danger.axes.conjoncturel.level).toBe('non_evalue');
  });
});
