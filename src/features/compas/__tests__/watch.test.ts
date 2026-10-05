import { describe, expect, it } from 'vitest';
import { proposeShift, watchRules } from '../engine/watch';
import type { DangerSignal } from '../engine/danger';
import type { CalendarDay, Quality } from '../engine/weather';

const sig = (id: string, label: string, day?: number): DangerSignal => ({
  id,
  axis: id.startsWith('alert') ? 'conjoncturel' : (id.split('-')[0] as DangerSignal['axis']),
  severity: 'warn',
  label,
  source: 'MET Norway',
  asOf: '2026-10-10',
  ...(day != null ? { day } : {}),
});

describe('watchRules — les seuils réels du moteur, avec ce qu’ils déclenchent', () => {
  it('rattache chaque signal à sa règle, alertes officielles comprises', () => {
    const rules = watchRules([
      sig('conjoncturel-gust-2', 'Jour 2 : rafales à 64 km/h', 2),
      sig('physique-long-1', 'Jour 1 : 11 h 00 de marche', 1),
      sig('alert-x', 'Vigilance orange · orages (Isère)'),
    ]);
    const by = Object.fromEntries(rules.map((r) => [r.id, r]));
    expect(by.gust.hits.map((h) => h.day)).toEqual([2]);
    expect(by.light.hits).toHaveLength(1);
    expect(by.alert.hits[0].label).toContain('Vigilance orange');
    expect(by.thunder.hits).toEqual([]);
  });

  it('affiche les seuils du moteur, jamais des valeurs écrites à la main', () => {
    const labels = watchRules([]).map((r) => r.label).join(' | ');
    expect(labels).toContain('60 km/h');
    expect(labels).toContain('20 mm');
    expect(labels).toContain('1200 m');
  });
});

const day = (date: string, quality: Quality | null, kind: CalendarDay['kind'] = 'prevision', reasons: string[] = []): CalendarDay => ({
  date,
  kind,
  quality,
  reasons,
  tMin: null,
  tMax: null,
});

describe('proposeShift — l’agent propose, la personne décide', () => {
  const cal = [
    day('2026-10-08', 'bon'),
    day('2026-10-09', 'bon'),
    day('2026-10-10', 'mauvais', 'prevision', ['orages']),
    day('2026-10-11', 'moyen'),
    day('2026-10-12', 'bon'),
    day('2026-10-13', 'bon'),
  ];

  it('propose la fenêtre la plus proche sans jour mauvais', () => {
    const p = proposeShift({ start: '2026-10-10', end: '2026-10-11', calendar: cal });
    expect(p).toMatchObject({ offsetDays: 1, startDate: '2026-10-11', endDate: '2026-10-12', then: 'moyen' });
    expect(p?.now).toEqual(['orages']);
  });

  it('ne propose rien quand la fenêtre actuelle n’a pas de jour mauvais', () => {
    expect(proposeShift({ start: '2026-10-12', end: '2026-10-13', calendar: cal })).toBeNull();
  });

  it('CONTRE-EXEMPLE — une tendance des années passées ne suffit pas à conseiller', () => {
    const trend = [
      day('2026-10-10', 'mauvais', 'prevision', ['orages']),
      day('2026-10-11', 'bon', 'tendance'),
      day('2026-10-12', 'bon', 'tendance'),
    ];
    expect(proposeShift({ start: '2026-10-10', end: '2026-10-10', calendar: trend })).toBeNull();
  });

  it('ne propose jamais une date passée', () => {
    const p = proposeShift({ start: '2026-10-10', end: '2026-10-10', calendar: cal.slice(2) });
    expect(p?.offsetDays).toBe(1);
  });
});
