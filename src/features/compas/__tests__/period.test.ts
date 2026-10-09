import { describe, expect, it } from 'vitest';
import { NORMALS_WHY, bestPeriod, driestMonth, monthName, needsDryNormals } from '../engine/period';

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

  it('tropiques : la saison sèche du pays, sinon aucune période inventée', () => {
    expect(bestPeriod({ activity: 'hiking', lat: 9.7, today, days: 7 })).toBeNull();
    expect(bestPeriod({ activity: 'hiking', lat: 9.7, countryCode: 'XX', today, days: 7 })).toBeNull();
    // Pérou (hémisphère sud) : juin, saison sèche andine — pas de décalage austral.
    expect(bestPeriod({ activity: 'trekking', lat: -9.2, countryCode: 'PE', today, days: 5 })).toMatchObject({
      month: 6,
      start: '2027-06-05',
      why: expect.stringMatching(/saison sèche/),
    });
    expect(bestPeriod({ activity: 'mixed', lat: 14.06, countryCode: 'VN', today, days: 14 })?.month).toBe(3);
  });

  it('jamais moins de trois semaines devant', () => {
    const p = bestPeriod({ activity: 'hiking', lat: 45, today: '2026-05-25', days: 3 });
    expect(p!.start).toBe('2026-06-20');
    expect(monthName(p!.month)).toBe('juin');
  });
});

/** Manaus, normales NASA POWER 2001-2020 (mm/jour, janvier → décembre), relevées le 9 oct. 2026. */
const MANAUS = [7.24, 8.36, 8.63, 8.72, 6.62, 3.97, 2.44, 1.61, 2.26, 3.33, 4.5, 6.87];

describe('Saison sèche par les normales NASA POWER (tropiques hors de la table)', () => {
  it('driestMonth : centre de la fenêtre de trois mois la plus sèche', () => {
    expect(driestMonth(MANAUS)).toBe(8);
    // En boucle sur l'année : décembre-janvier-février → janvier.
    expect(driestMonth([0.5, 0.6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0.4])).toBe(1);
  });

  it('Brésil (absent de la table) : le mois des normales, avec la source', () => {
    expect(
      bestPeriod({ activity: 'hiking', lat: -3.12, countryCode: 'BR', today, days: 7, normals: { precip: MANAUS } })
    ).toEqual({ month: 8, start: '2027-08-07', end: '2027-08-13', why: NORMALS_WHY });
    expect(NORMALS_WHY).toBe('mois le plus sec selon les normales 2001-2020 (NASA POWER)');
  });

  it('sans normales lisibles : toujours aucune période inventée', () => {
    const br = { activity: 'hiking', lat: -3.12, countryCode: 'BR', today, days: 7 };
    expect(bestPeriod(br)).toBeNull();
    expect(bestPeriod({ ...br, normals: null })).toBeNull();
    expect(bestPeriod({ ...br, normals: { precip: MANAUS.slice(0, 11) } })).toBeNull();
    expect(bestPeriod({ ...br, normals: { precip: [...MANAUS.slice(0, 11), Number.NaN] } })).toBeNull();
  });

  it('la table garde la priorité ; hors des tropiques, les normales ne changent rien', () => {
    expect(
      bestPeriod({ activity: 'trekking', lat: -9.2, countryCode: 'PE', today, days: 5, normals: { precip: MANAUS } })
        ?.month
    ).toBe(6);
    expect(bestPeriod({ activity: 'hiking', lat: 51.17, today, days: 7, normals: { precip: MANAUS } })?.month).toBe(9);
  });

  it('needsDryNormals : sous les tropiques, hors de la table, hors ski', () => {
    expect(needsDryNormals({ activity: 'hiking', lat: -3.12, countryCode: 'BR' })).toBe(true);
    expect(needsDryNormals({ activity: 'hiking', lat: -12.46, countryCode: 'au' })).toBe(true);
    expect(needsDryNormals({ activity: 'hiking', lat: -9.2, countryCode: 'PE' })).toBe(false);
    expect(needsDryNormals({ activity: 'hiking', lat: 45, countryCode: 'FR' })).toBe(false);
    expect(needsDryNormals({ activity: 'ski', lat: -3.12, countryCode: 'BR' })).toBe(false);
    expect(needsDryNormals({ activity: 'hiking', lat: null, countryCode: 'BR' })).toBe(false);
  });
});
