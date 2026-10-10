/**
 * Plan 4.8 : le kit lit les normales climatiques pour les jours que la prévision
 * ne couvre pas, et pour eux seuls.
 */
import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/power-climatology.json';
import { buildKitContext, datesWithoutForecast } from '../engine/kitContext';
import { powerClimateNormals } from '../engine/metno';

const plan = (day: number, date: string | null) => ({ day, date });
const fc = (day: number, covered: boolean) => ({ day, forecast: covered ? {} : null });

describe('datesWithoutForecast : les jours sans prévision', () => {
  it('garde les jours dont la prévision manque (au-delà de dix jours), pas les autres', () => {
    const dates = datesWithoutForecast({
      dayPlans: [plan(1, '2026-10-12'), plan(2, '2026-10-13'), plan(3, '2026-10-30')],
      forecasts: [fc(1, true), fc(2, true), fc(3, false)],
      startDate: '2026-10-12',
      endDate: '2026-10-30',
    });
    expect(dates).toEqual(['2026-10-30']);
  });

  it('un jour absent de la liste des prévisions n’a pas de prévision', () => {
    expect(
      datesWithoutForecast({
        dayPlans: [plan(1, '2027-03-02'), plan(2, '2027-03-03')],
        forecasts: [],
        startDate: '2027-03-02',
        endDate: '2027-03-03',
      })
    ).toEqual(['2027-03-02', '2027-03-03']);
  });

  it('sans étape datée : toutes les dates du voyage (au plus 62 jours)', () => {
    const dates = datesWithoutForecast({
      dayPlans: [],
      forecasts: [],
      startDate: '2027-01-30',
      endDate: '2027-02-02',
    });
    expect(dates).toEqual(['2027-01-30', '2027-01-31', '2027-02-01', '2027-02-02']);
    expect(
      datesWithoutForecast({ dayPlans: [], forecasts: [], startDate: '2027-01-01', endDate: '2027-12-31' })
    ).toHaveLength(62);
  });

  it('une seule date connue vaut une journée ; aucune date : rien', () => {
    expect(datesWithoutForecast({ dayPlans: [], forecasts: [], startDate: '2027-05-04', endDate: null })).toEqual([
      '2027-05-04',
    ]);
    expect(datesWithoutForecast({ dayPlans: [], forecasts: [], startDate: null, endDate: null })).toEqual([]);
    expect(
      datesWithoutForecast({ dayPlans: [plan(1, null)], forecasts: [], startDate: null, endDate: null })
    ).toEqual([]);
  });
});

describe('buildKitContext', () => {
  const normals = powerClimateNormals(fixtures.paris.payload);

  it('met le climat des dates dites, la latitude, l’altitude et l’activité', () => {
    const ctx = buildKitContext({
      lat: 48.85,
      maxAltitudeM: 120,
      activity: 'hiking',
      normals,
      dates: ['2027-12-30', '2028-01-02'],
    });
    expect(ctx.lat).toBe(48.85);
    expect(ctx.maxAltitudeM).toBe(120);
    expect(ctx.activity).toBe('hiking');
    expect(ctx.climate?.months.map((m) => m.month)).toEqual([12, 1]);
  });

  it('sans normales ou sans date : pas de climat, le reste est gardé', () => {
    expect(buildKitContext({ lat: 1, maxAltitudeM: null, activity: null, normals: null, dates: ['2027-12-30'] }).climate).toBeNull();
    expect(buildKitContext({ lat: 1, maxAltitudeM: null, activity: null, normals, dates: [] })).toMatchObject({
      lat: 1,
      climate: null,
    });
  });
});
