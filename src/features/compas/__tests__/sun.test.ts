import { describe, expect, it } from 'vitest';
import { clockMinutes, daylightClock, daylightMinutes } from '../engine/sun';

describe('clockMinutes', () => {
  it('« HH:MM » (format réel des prévisions du Compas)', () => {
    expect(clockMinutes('07:40')).toBe(460);
    expect(clockMinutes('19:00')).toBe(1140);
    expect(clockMinutes('00:00')).toBe(0);
  });

  it('horodatage ISO : l’heure telle qu’écrite', () => {
    expect(clockMinutes('2026-10-12T07:40')).toBe(460);
    expect(clockMinutes('2026-10-12T19:00:00+02:00')).toBe(1140);
  });

  it('illisible : null, jamais NaN', () => {
    expect(clockMinutes('25:00')).toBeNull();
    expect(clockMinutes('07:60')).toBeNull();
    expect(clockMinutes('7h40')).toBeNull();
    expect(clockMinutes('24:00')).toBeNull();
    expect(clockMinutes('7:5')).toBeNull();
    expect(clockMinutes('')).toBeNull();
    expect(clockMinutes(null)).toBeNull();
    expect(clockMinutes(undefined)).toBeNull();
  });
});

describe('daylightMinutes : durée du jour, sans fuseau', () => {
  it('8 novembre à 45° N : un peu moins de 10 h ; 21 juin : plus de 15 h', () => {
    const nov = daylightMinutes(45, 6, '2026-11-08');
    expect(nov).toBeGreaterThan(9 * 60);
    expect(nov).toBeLessThan(10 * 60);
    expect(daylightMinutes(45, 6, '2026-06-21')).toBeGreaterThan(15 * 60);
  });

  it('égale à coucher − lever de daylightClock, quel que soit le fuseau', () => {
    const c = daylightClock(-39.2, 175.58, '2026-10-12', 'Pacific/Auckland');
    const span = clockMinutes(c.sunset)! - clockMinutes(c.sunrise)!;
    expect(Math.abs(daylightMinutes(-39.2, 175.58, '2026-10-12')! - span)).toBeLessThanOrEqual(1);
  });

  it('nuit ou jour polaire, date ou coordonnées illisibles : null, jamais NaN', () => {
    expect(daylightMinutes(78.2, 15.6, '2026-12-15')).toBeNull();
    expect(daylightMinutes(78.2, 15.6, '2026-06-21')).toBeNull();
    expect(daylightMinutes(45, 6, 'demain')).toBeNull();
    expect(daylightMinutes(Number.NaN, 6, '2026-11-08')).toBeNull();
  });
});

describe('daylightClock au fuseau de la destination', () => {
  it('Tongariro, 12 octobre : lever vers 6 h 36 à Auckland, pas 19 h 36 (heure de Paris)', () => {
    expect(daylightClock(-39.2, 175.58, '2026-10-12', 'Pacific/Auckland').sunrise).toMatch(/^06:/);
    expect(daylightClock(-39.2, 175.58, '2026-10-12', 'Europe/Paris').sunrise).toMatch(/^19:/);
  });
});
