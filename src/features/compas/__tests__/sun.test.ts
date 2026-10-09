import { describe, expect, it } from 'vitest';
import { clockMinutes, daylightClock } from '../engine/sun';

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
    expect(clockMinutes('')).toBeNull();
    expect(clockMinutes(null)).toBeNull();
    expect(clockMinutes(undefined)).toBeNull();
  });
});

describe('daylightClock au fuseau de la destination', () => {
  it('Tongariro, 12 octobre : lever vers 6 h 36 à Auckland, pas 19 h 36 (heure de Paris)', () => {
    expect(daylightClock(-39.2, 175.58, '2026-10-12', 'Pacific/Auckland').sunrise).toMatch(/^06:/);
    expect(daylightClock(-39.2, 175.58, '2026-10-12', 'Europe/Paris').sunrise).toMatch(/^19:/);
  });
});
