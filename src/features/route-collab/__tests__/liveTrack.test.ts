import { describe, expect, it } from 'vitest';
import { bearingDeg, describeLive, headingOf, type LiveFix } from '../liveTrack';

const fix = (lat: number, lon: number, headingDeg: number | null = null): LiveFix => ({ lat, lon, accuracyM: 12, headingDeg, timestamp: 0 });

describe('liveTrack · position en direct, cap, écart au tracé (2.9)', () => {
  it('cap du capteur d’abord, ramené à 0–360', () => {
    expect(headingOf(null, fix(45, 6, -90))).toBe(270);
    expect(headingOf(null, fix(45, 6, 45))).toBe(45);
  });

  it('sans capteur, le cap se calcule seulement si l’on a vraiment bougé', () => {
    const a = fix(45, 6);
    expect(headingOf(a, fix(45, 6.00001))).toBeNull();
    const north = headingOf(a, fix(45.001, 6));
    expect(north).not.toBeNull();
    expect(Math.round(north as number)).toBe(0);
    expect(Math.round(bearingDeg({ lat: 45, lon: 6 }, { lat: 45, lon: 6.01 }))).toBe(90);
    expect(headingOf(null, fix(45, 6))).toBeNull();
  });

  it('dit l’écart au tracé en mètres ou en km, et « sur le tracé » avec le km parcouru', () => {
    expect(describeLive({ distanceM: 12, offTrack: false, alongKm: 12.4 }, 45, 10)).toEqual({
      tone: 'on_track',
      text: 'Sur le tracé · km 12,4 · cap NE · précision ± 10 m',
    });
    const off = describeLive({ distanceM: 180, offTrack: true, alongKm: 3 }, null, null);
    expect(off.tone).toBe('off_track');
    expect(off.text).toBe('À 180 m du tracé');
    expect(describeLive({ distanceM: 1800, offTrack: true, alongKm: 3 }, null, null).text).toBe('À 1,8 km du tracé');
  });

  it('sans tracé, l’écart est inconnu (jamais 0 m)', () => {
    const s = describeLive(null, null, null);
    expect(s.tone).toBe('unknown');
    expect(s.text).toContain('inconnu');
    expect(s.text).not.toMatch(/\b0 m\b/);
  });
});
