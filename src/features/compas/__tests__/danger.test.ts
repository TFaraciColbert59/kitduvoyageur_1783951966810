import { describe, expect, it } from 'vitest';
import { assessDanger, mergeDangerIntoVerdict, type OfficialAlert } from '../engine/danger';
import type { CompasDayPlan } from '../engine/compasModel';
import type { DayForecast } from '../engine/weather';

const plan = (over: Partial<CompasDayPlan> = {}): CompasDayPlan => ({
  day: 1,
  date: '2026-10-12',
  title: 'Jour 1',
  distanceKm: 12,
  gainM: 600,
  lossM: 400,
  lat: 45,
  lon: 6,
  stay: null,
  walkMin: 300,
  ...over,
});

const forecast = (over: Partial<DayForecast> = {}): DayForecast => ({
  date: '2026-10-12',
  tMin: 4,
  tMax: 18,
  precipPct: 20,
  precipMm: 1,
  gustMax: 30,
  code: 1,
  sunrise: '2026-10-12T07:40',
  sunset: '2026-10-12T19:00',
  hours: [],
  ...over,
});

const run = (p: CompasDayPlan, f: DayForecast | null, alerts: OfficialAlert[] = []) =>
  assessDanger({
    dayPlans: [p],
    forecasts: [{ day: 1, date: '2026-10-12', forecast: f }],
    alerts,
  });

describe('assessDanger', () => {
  it('journée sereine : axes évalués sans signal', () => {
    const d = run(plan(), forecast());
    expect(d.signals).toEqual([]);
    expect(d.axes.physique.level).toBe('ok');
    expect(d.axes.conjoncturel.level).toBe('ok');
  });

  it('sans prévision ni parcours chiffré, les axes sont non évalués, pas « sans danger »', () => {
    const d = run(plan({ walkMin: null, gainM: null, lossM: null, distanceKm: null }), null);
    expect(d.axes.physique.level).toBe('non_evalue');
    expect(d.axes.technique.level).toBe('non_evalue');
    expect(d.axes.conjoncturel.level).toBe('non_evalue');
  });

  it('marche plus longue que le jour : vigilance physique datée et sourcée', () => {
    const d = run(plan({ walkMin: 700 }), forecast());
    const s = d.signals.find((x) => x.id === 'physique-light-1');
    expect(s?.severity).toBe('warn');
    expect(s?.asOf).toBe('2026-10-12');
    expect(s?.source).toContain('DIN 33466');
    expect(s?.label).toContain('11 h 40');
  });

  it('rafales : warn puis block selon le seuil', () => {
    expect(run(plan(), forecast({ gustMax: 70 })).axes.conjoncturel.level).toBe('vigilance');
    expect(run(plan(), forecast({ gustMax: 95 })).axes.conjoncturel.level).toBe('bloque');
  });

  it('pente moyenne forte → technique', () => {
    const d = run(plan({ distanceKm: 6, gainM: 1100 }), forecast());
    expect(d.axes.technique.level).toBe('vigilance');
  });

  it('une alerte rouge bloque, une jaune reste une information', () => {
    const alert = (level: OfficialAlert['level']): OfficialAlert => ({
      id: level,
      source: 'Météo-France via Meteoalarm',
      hazard: 'orages',
      level,
      area: 'Isère',
      onset: null,
      expires: null,
      fetchedAt: '2026-10-01T09:00:00Z',
    });
    expect(run(plan(), forecast(), [alert('rouge')]).axes.conjoncturel.level).toBe('bloque');
    const yellow = run(plan(), forecast(), [alert('jaune')]);
    expect(yellow.axes.conjoncturel.level).toBe('ok');
    expect(yellow.signals[0].severity).toBe('info');
  });
});

describe('mergeDangerIntoVerdict', () => {
  const verdict = { level: 'go' as const, reasons: [] };
  it('une vigilance fait passer go à vigilance', () => {
    const d = run(plan(), forecast({ gustMax: 70 }));
    expect(mergeDangerIntoVerdict(verdict, d).level).toBe('vigilance');
  });
  it('un blocage l’emporte', () => {
    const d = run(plan(), forecast({ gustMax: 95 }));
    expect(mergeDangerIntoVerdict({ ...verdict, level: 'vigilance' as const }, d).level).toBe(
      'bloque'
    );
  });
  it('n’ajoute pas les infos aux raisons', () => {
    const d = run(plan(), forecast());
    expect(mergeDangerIntoVerdict(verdict, d)).toEqual(verdict);
  });
});
