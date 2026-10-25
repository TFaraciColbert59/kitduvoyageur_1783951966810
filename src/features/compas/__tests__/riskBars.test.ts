import { describe, expect, it } from 'vitest';
import { assessDanger, type DangerAssessment, type OfficialAlert } from '../engine/danger';
import type { CompasDayPlan } from '../engine/compasModel';
import type { DayForecast } from '../engine/weather';
import {
  RISK_AXES,
  RISK_LEVEL_TEXT,
  RISK_SEGMENTS,
  formatRiskDate,
  riskBars,
  riskLevelOfAxis,
  sourceLine,
} from '../engine/riskBars';

/*
 * Barres de risque par axe : pas de score unique, quatre niveaux écrits (faible,
 * modéré, élevé, non évalué), chaque niveau cite sa source et sa date. Un axe sans
 * donnée est « non évalué » (barre vide), jamais « faible ».
 */

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
  sunrise: '07:40',
  sunset: '19:00',
  hours: [],
  ...over,
});

const alert = (level: OfficialAlert['level'], over: Partial<OfficialAlert> = {}): OfficialAlert => ({
  id: level,
  source: 'Météo-France via Meteoalarm',
  hazard: 'orages',
  level,
  area: 'Isère',
  onset: null,
  expires: null,
  sent: '2026-10-11T08:00:00+02:00',
  // Lu le lendemain de l'émission : la date de l'alerte est celle d'émission, pas celle de la lecture.
  fetchedAt: '2026-10-12T06:30:00Z',
  ...over,
});

const assess = (p: CompasDayPlan, f: DayForecast | null, alerts: OfficialAlert[] = []): DangerAssessment =>
  assessDanger({ dayPlans: [p], forecasts: [{ day: p.day, date: p.date ?? '', forecast: f }], alerts, alertsStatus: 'lues' });

const bar = (d: DangerAssessment, axis: (typeof RISK_AXES)[number]) => riskBars(d).find((b) => b.axis === axis)!;

describe('riskBars : les trois axes, quatre niveaux écrits', () => {
  it('toujours trois barres, dans l’ordre physique · technique · conjoncturel, jamais de note globale', () => {
    const bars = riskBars(assess(plan(), forecast()));
    expect(bars.map((b) => b.axis)).toEqual(['physique', 'technique', 'conjoncturel']);
    expect(bars.map((b) => b.label)).toEqual(['Physique', 'Technique', 'Conjoncturel']);
    expect(JSON.stringify(bars)).not.toMatch(/\bscore\b|\/\s*100|sur 100/i);
  });

  it('les niveaux du moteur deviennent faible, modéré, élevé, non évalué', () => {
    expect(riskLevelOfAxis('ok')).toBe('faible');
    expect(riskLevelOfAxis('vigilance')).toBe('modere');
    expect(riskLevelOfAxis('bloque')).toBe('eleve');
    expect(riskLevelOfAxis('non_evalue')).toBe('non_evalue');
    expect(RISK_LEVEL_TEXT).toEqual({ faible: 'faible', modere: 'modéré', eleve: 'élevé', non_evalue: 'non évalué' });
    expect(RISK_SEGMENTS).toEqual({ non_evalue: 0, faible: 1, modere: 2, eleve: 3 });
  });

  it('SANS DONNÉE : tout est « non évalué », barre vide, aucune source, jamais « faible »', () => {
    const d = assessDanger({ dayPlans: [], forecasts: [], alerts: [] });
    for (const b of riskBars(d)) {
      expect(b.level, b.axis).toBe('non_evalue');
      expect(b.levelText).toBe('non évalué');
      expect(b.segments).toBe(0);
      expect(b.sources).toEqual([]);
      expect(b.note).toBeTruthy();
      expect(b.inPart).toBe(false);
      expect(b.summary).toContain('non évalué');
      expect(b.summary).toContain('aucun segment plein');
    }
  });

  it('un axe sans donnée à côté d’axes évalués reste « non évalué » (technique sans pente)', () => {
    const d = assess(plan({ distanceKm: null, gainM: null, lossM: null }), forecast());
    expect(bar(d, 'technique').level).toBe('non_evalue');
    expect(bar(d, 'technique').segments).toBe(0);
    expect(bar(d, 'conjoncturel').level).toBe('faible');
  });

  it('journée sereine : faible (1 segment), avec ce qui a été lu et sa date', () => {
    const d = assess(plan(), forecast());
    const physique = bar(d, 'physique');
    expect(physique.level).toBe('faible');
    expect(physique.segments).toBe(1);
    expect(physique.sources).toEqual([
      'Source : DIN 33466 · 12 oct. 2026',
      'Source : étapes du voyage · 12 oct. 2026',
      'Source : MET Norway · 12 oct. 2026',
    ]);
    expect(bar(d, 'technique').sources).toEqual(['Source : étapes du voyage · 12 oct. 2026']);
    expect(bar(d, 'conjoncturel').sources).toEqual(['Source : MET Norway · 12 oct. 2026']);
  });

  it('rafales 70 km/h : conjoncturel modéré (2 segments), la source du signal et son jour', () => {
    const b = bar(assess(plan(), forecast({ gustMax: 70 })), 'conjoncturel');
    expect(b.level).toBe('modere');
    expect(b.levelText).toBe('modéré');
    expect(b.segments).toBe(2);
    expect(b.sources).toEqual(['Source : MET Norway · 12 oct. 2026']);
    expect(b.signals).toBe(1);
  });

  it('rafales 95 km/h : élevé (3 segments)', () => {
    const b = bar(assess(plan(), forecast({ gustMax: 95 })), 'conjoncturel');
    expect(b.level).toBe('eleve');
    expect(b.segments).toBe(3);
    expect(b.summary).toBe('Conjoncturel : niveau élevé, 3 segments sur 3');
  });

  it('alerte rouge : élevé, avec le service national et le JOUR D’ÉMISSION de l’alerte', () => {
    const b = bar(assess(plan(), forecast(), [alert('rouge')]), 'conjoncturel');
    expect(b.level).toBe('eleve');
    expect(b.sources).toEqual(['Source : Météo-France via Meteoalarm · 11 oct. 2026']);
  });

  it('alerte orange sans heure d’émission : la date de lecture du flux fait foi', () => {
    const b = bar(assess(plan(), forecast(), [alert('orange', { sent: null })]), 'conjoncturel');
    expect(b.level).toBe('modere');
    expect(b.sources).toEqual(['Source : Météo-France via Meteoalarm · 12 oct. 2026']);
  });

  it('alerte jaune seule : « faible » (information), la source de l’alerte est citée avec ce qui a été lu', () => {
    const b = bar(assess(plan(), forecast(), [alert('jaune')]), 'conjoncturel');
    expect(b.level).toBe('faible');
    expect(b.sources).toContain('Source : Météo-France via Meteoalarm · 11 oct. 2026');
    expect(b.sources).toContain('Source : MET Norway · 12 oct. 2026');
  });

  it('la météo est citée pour l’axe physique dès qu’une température est lue (minimale seule, maximale seule)', () => {
    for (const over of [{ tMin: null }, { tMax: null }]) {
      const d = assess(plan(), forecast(over));
      expect(bar(d, 'physique').sources, JSON.stringify(over)).toContain('Source : MET Norway · 12 oct. 2026');
    }
    const none = assess(plan(), forecast({ tMin: null, tMax: null }));
    expect(bar(none, 'physique').sources.join('|')).not.toContain('MET Norway');
  });

  it('un niveau modéré ne cite que les sources des signaux qui le fixent', () => {
    // Rafales (MET Norway) et pente (étapes du voyage) : chacun son axe.
    const d = assess(plan({ distanceKm: 6, gainM: 1100 }), forecast({ gustMax: 70 }));
    expect(bar(d, 'technique').level).toBe('modere');
    expect(bar(d, 'technique').sources).toEqual(['Source : étapes du voyage · 12 oct. 2026']);
    expect(bar(d, 'conjoncturel').sources).toEqual(['Source : MET Norway · 12 oct. 2026']);
  });

  it('le niveau cite le signal le plus grave : une alerte jaune ne vole pas la source d’une rafale', () => {
    const d = assess(plan(), forecast({ gustMax: 70 }), [alert('jaune')]);
    expect(bar(d, 'conjoncturel').level).toBe('modere');
    expect(bar(d, 'conjoncturel').sources).toEqual(['Source : MET Norway · 12 oct. 2026']);
  });

  it('bloquant et vigilance ensemble : seule la source du bloquant est citée', () => {
    const d = assess(plan(), forecast({ gustMax: 70 }), [alert('rouge')]);
    expect(bar(d, 'conjoncturel').level).toBe('eleve');
    expect(bar(d, 'conjoncturel').sources).toEqual(['Source : Météo-France via Meteoalarm · 11 oct. 2026']);
  });

  it('plusieurs jours : la plage de dates de la source', () => {
    const d = assessDanger({
      dayPlans: [plan({ day: 1, date: '2026-10-12' }), plan({ day: 2, date: '2026-10-14' })],
      forecasts: [
        { day: 1, date: '2026-10-12', forecast: forecast({ gustMax: 70 }) },
        { day: 2, date: '2026-10-14', forecast: forecast({ date: '2026-10-14', gustMax: 80 }) },
      ],
      alerts: [],
      alertsStatus: 'lues',
    });
    expect(bar(d, 'conjoncturel').sources).toEqual(['Source : MET Norway · du 12 oct. 2026 au 14 oct. 2026']);
    expect(bar(d, 'conjoncturel').signals).toBe(2);
  });

  it('évalué en partie : le niveau le dit, avec ce qui n’a pas été vérifié', () => {
    const b = bar(assess(plan({ gainM: null }), forecast()), 'physique');
    expect(b.level).toBe('faible');
    expect(b.inPart).toBe(true);
    expect(b.note).toBe('Non vérifié : dénivelé (J1).');
    expect(b.summary).toContain('évalué en partie');
  });

  it('un axe évalué en entier n’a pas de note', () => {
    const b = bar(assess(plan(), forecast()), 'physique');
    expect(b.inPart).toBe(false);
    expect(b.note).toBeNull();
  });

  it('un axe non évalué ne porte jamais de « en partie », même si une évaluation ancienne en écrit un', () => {
    const d = assess(plan(), forecast());
    const odd: DangerAssessment = {
      ...d,
      axes: { ...d.axes, technique: { level: 'non_evalue', note: 'Pas de cotation.', partial: 'Non vérifié : pente.' } },
    };
    const b = bar(odd, 'technique');
    expect(b.inPart).toBe(false);
    expect(b.note).toBe('Pas de cotation.');
    expect(b.summary).not.toContain('en partie');
  });

  it('évaluation sans le champ evidence mais avec un signal d’information : la source du signal est citée', () => {
    const d = assess(plan(), forecast(), [alert('jaune')]);
    const old: DangerAssessment = {
      ...d,
      axes: { ...d.axes, conjoncturel: { level: 'ok', note: '', partial: null } },
    };
    expect(bar(old, 'conjoncturel').sources).toEqual(['Source : Météo-France via Meteoalarm · 11 oct. 2026']);
  });

  it('évaluation sans le champ evidence (écran plus ancien) : la barre le dit, sans inventer de source', () => {
    const d = assess(plan(), forecast());
    const old: DangerAssessment = {
      ...d,
      axes: {
        physique: { level: 'ok', note: '', partial: null },
        technique: { level: 'ok', note: '', partial: null },
        conjoncturel: { level: 'ok', note: '', partial: null },
      },
    };
    for (const b of riskBars(old)) {
      expect(b.level).toBe('faible');
      expect(b.sources).toEqual([]);
    }
  });
});

describe('formatRiskDate, sourceLine', () => {
  it('le jour tel qu’il est écrit, au format lisible', () => {
    expect(formatRiskDate('2026-10-11')).toBe('11 oct. 2026');
    expect(formatRiskDate('2026-10-11T08:00:00+02:00')).toBe('11 oct. 2026');
    expect(formatRiskDate('2026-01-01')).toBe('1 janv. 2026');
    expect(formatRiskDate('2026-12-31T23:59:00Z')).toBe('31 déc. 2026');
  });

  it('illisible : null (jamais « Invalid Date » ni une date inventée)', () => {
    for (const v of [null, undefined, '', 'hier', '2026-13-01', '2026-00-10', '2026-10-00', '2026-10-32', '11/10/2026'])
      expect(formatRiskDate(v as string | null), String(v)).toBeNull();
  });

  it('la ligne de source : date, plage, ou « date non précisée »', () => {
    expect(sourceLine('MET Norway', '2026-10-12', '2026-10-12')).toBe('Source : MET Norway · 12 oct. 2026');
    expect(sourceLine('MET Norway', '2026-10-12', '2026-10-14')).toBe('Source : MET Norway · du 12 oct. 2026 au 14 oct. 2026');
    expect(sourceLine('MET Norway', '2026-10-12', null)).toBe('Source : MET Norway · 12 oct. 2026');
    expect(sourceLine('MET Norway', null, '2026-10-14')).toBe('Source : MET Norway · 14 oct. 2026');
    expect(sourceLine('MET Norway', null, null)).toBe('Source : MET Norway · date non précisée');
  });
});

describe('assessDanger : ce qui a été lu (evidence)', () => {
  it('un axe non évalué ne cite rien', () => {
    const d = assessDanger({ dayPlans: [], forecasts: [], alerts: [] });
    for (const axis of RISK_AXES) expect(d.axes[axis].evidence).toEqual([]);
  });

  it('chaque source garde le premier et le dernier jour lus', () => {
    const d = assessDanger({
      dayPlans: [plan({ day: 1, date: '2026-10-14' }), plan({ day: 2, date: '2026-10-12' })],
      forecasts: [
        { day: 1, date: '2026-10-14', forecast: forecast({ date: '2026-10-14' }) },
        { day: 2, date: '2026-10-12', forecast: forecast() },
      ],
      alerts: [],
    });
    const met = d.axes.conjoncturel.evidence?.find((e) => e.source === 'MET Norway');
    expect(met).toEqual({ source: 'MET Norway', from: '2026-10-12', to: '2026-10-14' });
  });

  it('une source sans date garde des dates nulles', () => {
    const d = assessDanger({
      dayPlans: [plan({ date: null })],
      forecasts: [{ day: 1, date: '', forecast: null }],
      alerts: [],
    });
    expect(d.axes.physique.evidence?.[0]).toEqual({ source: 'DIN 33466', from: null, to: null });
  });
});
