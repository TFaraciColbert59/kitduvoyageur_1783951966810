import { describe, expect, it } from 'vitest';
import { cubicBezierEasing } from '@/components/map/engine/camera';
import {
  DAY_FLIGHT_BEZIER,
  DAY_FLIGHT_MS,
  DAY_FLIGHT_PITCH,
  SUMMARY_FOCUS_KEY,
  dayFocusKey,
  dayTrace,
  dayTraceFlight,
} from '../dayTrace';

const CARNET_TRACE = {
  type: 'LineString',
  coordinates: [
    [6.86, 45.83],
    [6.9, 45.9],
  ],
};

describe('dayTrace — tracé de la page affichée', () => {
  it('rend le tracé complet du carnet sur le Résumé', () => {
    expect(dayTrace(CARNET_TRACE, null)).toBe(CARNET_TRACE);
  });

  it('rend le segment du jour seul, dans l’ordre longitude / latitude', () => {
    expect(
      dayTrace(CARNET_TRACE, [
        { lat: 45.9, lng: 6.86 },
        { lat: 45.93, lng: 6.9 },
      ]),
    ).toEqual({
      type: 'LineString',
      coordinates: [
        [6.86, 45.9],
        [6.9, 45.93],
      ],
    });
  });

  it('ne fabrique aucun tracé pour un jour sans point GPS', () => {
    expect(dayTrace(CARNET_TRACE, [])).toBeNull();
    expect(dayTrace(CARNET_TRACE, [{ lat: 45.9, lng: 6.86 }])).toBeNull();
  });

  it('écarte les coordonnées hors du monde réel', () => {
    expect(
      dayTrace(null, [
        { lat: 200, lng: 6.86 },
        { lat: 45.93, lng: 6.9 },
      ]),
    ).toBeNull();
  });

  it('reste honnête sur un carnet sans trace quand la page est le Résumé', () => {
    expect(dayTrace(null, null)).toBeNull();
    expect(dayTrace(undefined, null)).toBeNull();
  });
});

describe('dayFocusKey — identifiant stable de page', () => {
  it('nomme le Résumé et les jours d’après leur numéro réel', () => {
    expect(dayFocusKey(null)).toBe(SUMMARY_FOCUS_KEY);
    expect(dayFocusKey(undefined)).toBe('resume');
    expect(dayFocusKey(1)).toBe('j1');
    expect(dayFocusKey(7)).toBe('j7');
  });

  it('refuse un numéro qui n’en est pas un', () => {
    expect(dayFocusKey(0)).toBe(SUMMARY_FOCUS_KEY);
    expect(dayFocusKey(-2)).toBe(SUMMARY_FOCUS_KEY);
    expect(dayFocusKey(Number.NaN)).toBe(SUMMARY_FOCUS_KEY);
  });
});

describe('dayTraceFlight — vol vers le segment', () => {
  it('vole en 900 ms, pitch 45, courbe cubic-bezier(.22,1,.36,1)', () => {
    const flight = dayTraceFlight('j1');
    expect(flight.key).toBe('j1');
    expect(flight.duration).toBe(DAY_FLIGHT_MS);
    expect(flight.duration).toBe(900);
    expect(flight.pitch).toBe(DAY_FLIGHT_PITCH);
    expect(DAY_FLIGHT_BEZIER).toEqual([0.22, 1, 0.36, 1]);
    /* La courbe reste une progression : 0 au départ, 1 à l'arrivée, monotone. */
    expect(flight.easing(0)).toBe(0);
    expect(flight.easing(1)).toBe(1);
    expect(flight.easing(0.5)).toBeGreaterThan(0.5);
  });
});

describe('cubicBezierEasing — courbe CSS → progression MapLibre', () => {
  const ease = cubicBezierEasing(0.22, 1, 0.36, 1);

  it('passe par les extrémités', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  it('accélère franchement : 80 % du chemin à mi-durée', () => {
    expect(ease(0.5)).toBeGreaterThan(0.8);
    expect(ease(0.25)).toBeGreaterThan(0.5);
  });

  it('reste monotone et borné', () => {
    let previous = 0;
    for (let step = 0; step <= 20; step += 1) {
      const value = ease(step / 20);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
  });

  it('retombe sur le linéaire hors bornes CSS', () => {
    expect(cubicBezierEasing(1.4, 0, 0.36, 1)(0.5)).toBeCloseTo(0.5, 6);
    expect(cubicBezierEasing(0.22, 1, Number.NaN, 1)(0.5)).toBeCloseTo(0.5, 6);
  });
});
