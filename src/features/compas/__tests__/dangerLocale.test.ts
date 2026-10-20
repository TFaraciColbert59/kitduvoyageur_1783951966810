import { describe, expect, it } from 'vitest';
import { alertsGapOf, assessDanger } from '../engine/danger';

const plan = { day: 1, date: '2026-10-20', walkMin: 700, gainM: 1300, lossM: 1600, distanceKm: 5, lat: 45, lon: 6 };
const input = {
  dayPlans: [plan as never],
  forecasts: [
    { day: 1, date: '2026-10-20', forecast: { tMax: 35, tMin: -6, gustMax: 95, precipMm: 30, code: 95 } as never },
  ],
  alerts: [],
  alertsStatus: 'non_couvert' as const,
};

describe('danger dit dans la langue (plan 6.1)', () => {
  it('le français est identique avec ou sans locale', () => {
    expect(assessDanger({ ...input, locale: 'fr' })).toEqual(assessDanger(input));
    const fr = assessDanger(input);
    expect(fr.signals.map((s) => s.label)).toContain('Jour 1 : rafales à 95 km/h');
    expect(fr.signals.map((s) => s.label)).toContain('Jour 1 : 1300 m de montée');
  });

  it.each(['en', 'es', 'de', 'it'] as const)('%s : signaux, lacunes et notes sans français', (locale) => {
    const d = assessDanger({ ...input, locale });
    const text = JSON.stringify([d.signals.map((s) => s.label), Object.values(d.axes).map((a) => [a.note, a.partial])]);
    expect(text).not.toMatch(/Jour 1|rafales|montée|descente|chaleur|Non vérifié|orages annoncés/);
    expect(alertsGapOf('non_couvert', locale)).not.toMatch(/alertes officielles/);
    // les chiffres restent ceux du moteur
    expect(text).toContain('95');
    expect(d.signals.map((s) => s.id)).toEqual(assessDanger(input).signals.map((s) => s.id));
  });

  it('une alerte officielle est titrée dans la langue, texte officiel gardé', () => {
    const alert = {
      id: 'a1', source: 'Météo-France via Meteoalarm', hazard: 'Orages', level: 'orange' as const, area: 'Isère',
      sent: '2026-10-10T16:00:00Z', onset: '2026-10-11T04:00:00Z', expires: '2026-10-11T19:00:00Z',
      headline: 'Orages violents', fetchedAt: '2026-10-10T17:00:00Z', web: null,
    };
    const label = (locale: 'fr' | 'de') => assessDanger({ ...input, alerts: [alert as never], alertsStatus: 'lues', locale }).signals.find((s) => s.id === 'alert-a1')!.label;
    expect(label('fr')).toContain('Vigilance orange · Orages (Isère), émise le 10 oct. 2026, 16 h 00 UTC, valable du 11 oct. 2026, 4 h 00 UTC au');
    expect(label('de')).toMatch(/^Warnstufe orange · Orages \(Isère\), ausgegeben am .*UTC, gültig vom .* bis .*UTC — amtlicher Text: „Orages violents“$/);
  });
});
