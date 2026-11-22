import { describe, expect, it } from 'vitest';
import { arrivalVsSunset, localStageDate, sunTimes, zonedTimeToUtc } from '../daylight';

const ANNECY = { lat: 45.899, lon: 6.129 };
const minutesBetween = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 60000;

describe('sunTimes (NOAA)', () => {
  it('Annecy, 21 juin : lever 03:45 UTC, coucher 19:29 UTC (±3 min)', () => {
    const s = sunTimes(ANNECY.lat, ANNECY.lon, '2026-06-21')!;
    expect(minutesBetween(s.sunrise!, new Date('2026-06-21T03:45:00Z'))).toBeLessThanOrEqual(3);
    expect(minutesBetween(s.sunset!, new Date('2026-06-21T19:29:00Z'))).toBeLessThanOrEqual(3);
  });
  it('Annecy, 21 décembre : lever 07:14 UTC, coucher 15:53 UTC (±3 min)', () => {
    const s = sunTimes(ANNECY.lat, ANNECY.lon, '2026-12-21')!;
    expect(minutesBetween(s.sunrise!, new Date('2026-12-21T07:14:00Z'))).toBeLessThanOrEqual(3);
    expect(minutesBetween(s.sunset!, new Date('2026-12-21T15:53:00Z'))).toBeLessThanOrEqual(3);
  });
  it('nuit polaire : pas de lever, et date invalide : null', () => {
    const s = sunTimes(78.2, 15.6, '2026-12-21')!;
    expect(s.sunrise).toBeNull();
    expect(s.polar).toBe('polar_night');
    expect(sunTimes(45, 6, 'pas-une-date')).toBeNull();
  });
});

describe('localStageDate / changement d’heure', () => {
  it('passage à l’heure d’hiver : journée de 25 h', () => {
    const d = localStageDate('2026-10-25', 'Europe/Paris')!;
    expect(d.dayLengthHours).toBe(25);
    expect(d.dstChange).toBe('back');
    expect(d.offsetMinutes).toBe(60);
  });
  it('passage à l’heure d’été : journée de 23 h ; jour ordinaire : 24 h', () => {
    expect(localStageDate('2026-03-29', 'Europe/Paris')!.dayLengthHours).toBe(23);
    expect(localStageDate('2026-07-10', 'Europe/Paris')!.dstChange).toBeNull();
  });
  it('zonedTimeToUtc : 08:00 à Paris en juillet = 06:00 UTC', () => {
    expect(zonedTimeToUtc('2026-07-10', '08:00', 'Europe/Paris')!.toISOString()).toBe('2026-07-10T06:00:00.000Z');
  });
});

describe('arrivalVsSunset', () => {
  it('marge positive en été', () => {
    const r = arrivalVsSunset({ dateIso: '2026-06-21', ...ANNECY }, '08:00', 8 * 60, 'Europe/Paris');
    expect(r.known).toBe(true);
    expect(r.arrivalLocal).toBe('16:00');
    expect(r.late).toBe(false);
    expect(r.marginMin).toBeGreaterThan(300);
  });
  it('en retard en décembre', () => {
    const r = arrivalVsSunset({ dateIso: '2026-12-21', ...ANNECY }, '09:00', 8 * 60, 'Europe/Paris');
    expect(r.arrivalLocal).toBe('17:00');
    expect(r.late).toBe(true);
    expect(r.marginMin).toBeLessThan(0);
  });
  it('heure d’arrivée correcte au changement d’heure (nuit de 25 h)', () => {
    const r = arrivalVsSunset({ dateIso: '2026-10-25', ...ANNECY }, '00:30', 240, 'Europe/Paris');
    expect(r.arrivalLocal).toBe('03:30');
  });
  it('donnée inconnue : known=false, jamais « en retard » par défaut', () => {
    expect(arrivalVsSunset({ dateIso: null, ...ANNECY }, '08:00', 300, 'Europe/Paris')).toMatchObject({ known: false, late: false, marginMin: null });
    expect(arrivalVsSunset({ dateIso: '2026-06-21', lat: null, lon: null }, '08:00', 300, 'Europe/Paris').known).toBe(false);
    expect(arrivalVsSunset({ dateIso: '2026-06-21', ...ANNECY }, '08:00', null, 'Europe/Paris').reason).toBe('durée inconnue');
  });
});
