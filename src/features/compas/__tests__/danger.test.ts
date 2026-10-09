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

  it('lever et coucher en « HH:MM » (format réel) : « X de marche pour Y de jour »', () => {
    const d = run(plan({ walkMin: 700 }), forecast({ sunrise: '07:40', sunset: '19:00' }));
    expect(d.signals.find((x) => x.id === 'physique-light-1')?.label).toBe(
      'Jour 1 : 11 h 40 de marche pour 11 h 20 de jour'
    );
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

describe('assessDanger — évaluation partielle', () => {
  it('dénivelé inconnu : physique évalué sur la durée, mais dit ce qui manque', () => {
    const d = run(plan({ gainM: null }), forecast());
    expect(d.axes.physique.level).toBe('ok');
    expect(d.axes.physique.partial).toBe('Non vérifié : dénivelé (J1).');
    expect(d.axes.technique.partial).toContain('pente (J1)');
  });

  it('CONTRE-EXEMPLE — alertes officielles non lues : le conjoncturel ne prétend pas les couvrir', () => {
    const d = run(plan(), forecast());
    expect(d.axes.conjoncturel.level).toBe('ok');
    expect(d.axes.conjoncturel.partial).toBe('Non vérifié : alertes officielles.');
    const lu = assessDanger({
      dayPlans: [plan()],
      forecasts: [{ day: 1, date: '2026-10-12', forecast: forecast() }],
      alerts: [],
      alertsStatus: 'lues',
    });
    expect(lu.axes.conjoncturel.partial).toBeNull();
  });

  it('jour sans prévision : chaleur, froid et météo de ce jour non vérifiés', () => {
    const d = assessDanger({
      dayPlans: [plan(), plan({ day: 2, date: '2026-10-13' })],
      forecasts: [
        { day: 1, date: '2026-10-12', forecast: forecast() },
        { day: 2, date: '2026-10-13', forecast: null },
      ],
      alerts: [],
      alertsStatus: 'lues',
    });
    expect(d.axes.physique.partial).toBe('Non vérifié : chaleur et froid (J2).');
    expect(d.axes.conjoncturel.partial).toBe('Non vérifié : météo (J2).');
  });

  it('un axe non évalué ne porte pas de partiel', () => {
    const d = run(plan({ walkMin: null, gainM: null, lossM: null, distanceKm: null }), null);
    expect(d.axes.physique).toMatchObject({ level: 'non_evalue', partial: null });
  });
});

describe('assessDanger — état des alertes officielles', () => {
  const avec = (alertsStatus: Parameters<typeof assessDanger>[0]['alertsStatus']) =>
    assessDanger({
      dayPlans: [plan()],
      forecasts: [{ day: 1, date: '2026-10-12', forecast: forecast() }],
      alerts: [],
      alertsStatus,
    }).axes.conjoncturel.partial;

  it('dit pourquoi les alertes ne sont pas couvertes', () => {
    expect(avec('lues')).toBeNull();
    expect(avec('pas_encore_publiees')).toBe(
      'Non vérifié : alertes officielles (publiées la veille du départ).'
    );
    expect(avec('hors_france')).toBe('Non vérifié : alertes officielles (hors France, non couvertes).');
    expect(avec('indisponibles')).toBe('Non vérifié : alertes officielles.');
    expect(avec(undefined)).toBe('Non vérifié : alertes officielles.');
  });
});

describe('assessDanger — alerte officielle mise à jour depuis', () => {
  it('reste visible, en information « à vérifier », datée de son émission', () => {
    const d = assessDanger({
      dayPlans: [plan()],
      forecasts: [{ day: 1, date: '2026-10-12', forecast: forecast() }],
      alertsStatus: 'lues',
      alerts: [
        {
          id: 'r',
          source: 'Météo-France via Meteoalarm',
          hazard: 'inondations',
          level: 'rouge',
          area: 'Hérault',
          onset: '2026-10-01T00:00:00+02:00',
          expires: '2026-10-02T00:00:00+02:00',
          sent: '2026-09-30T14:04:23.000Z',
          updatedSince: '2026-09-30T20:05:48.000Z',
          fetchedAt: '2026-10-01T18:00:00.000Z',
        },
      ],
    });
    const s = d.signals.find((x) => x.id === 'alert-r');
    expect(s?.severity).toBe('info');
    expect(s?.label).toContain('à vérifier sur vigilance.meteofrance.fr');
    expect(s?.asOf).toBe('2026-09-30T14:04:23.000Z');
  });
});

