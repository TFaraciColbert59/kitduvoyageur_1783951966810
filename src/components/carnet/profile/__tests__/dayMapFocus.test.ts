import { describe, expect, it } from 'vitest';
import { clampDayPage, dayForPage, dayMapFocus, isDayHighlight } from '../dayMapFocus';
import type { CarnetDay, CarnetDayPoint } from '@/features/carnet/detail/types';

const pt = (lng: number, lat: number): CarnetDayPoint => ({ lng, lat, at: '2026-07-01T08:00:00Z' });

function day(index: number, points: CarnetDayPoint[]): CarnetDay {
  return {
    index,
    date: '2026-07-01',
    distanceKm: null,
    elevationM: null,
    durationS: null,
    moments: [],
    points,
  } as unknown as CarnetDay;
}

describe('dayMapFocus — page de jour → cadrage de la carte', () => {
  it('Résumé (pas de points) : aucun focus, aucune atténuation', () => {
    expect(dayMapFocus(null)).toBeNull();
    expect(dayMapFocus(undefined)).toBeNull();
    expect(isDayHighlight(null)).toBe(false);
    expect(isDayHighlight(undefined)).toBe(false);
  });

  it('jour avec trace : ligne, départ, arrivée et bornes réels', () => {
    const focus = dayMapFocus([pt(6.8, 45.8), pt(6.9, 45.9), pt(7.0, 45.85)]);
    expect(focus).not.toBeNull();
    expect(focus?.start).toEqual({ lng: 6.8, lat: 45.8 });
    expect(focus?.end).toEqual({ lng: 7.0, lat: 45.85 });
    expect(focus?.bounds).toEqual([6.8, 45.8, 7.0, 45.9]);
    expect(focus?.line.length).toBeGreaterThanOrEqual(2);
    expect(isDayHighlight([pt(6.8, 45.8)])).toBe(true);
  });

  it('jour sans points : aucun focus mais atténuation du tracé global, rien d’inventé', () => {
    expect(dayMapFocus([])).toBeNull();
    expect(isDayHighlight([])).toBe(true);
  });

  it('un seul point (ou des doublons) ne fait pas une ligne', () => {
    expect(dayMapFocus([pt(6.8, 45.8)])).toBeNull();
    expect(dayMapFocus([pt(6.8, 45.8), pt(6.8, 45.8)])).toBeNull();
  });

  it('ignore les coordonnées invalides sans déplacer le départ/arrivée', () => {
    const focus = dayMapFocus([
      pt(Number.NaN, 45),
      pt(6.8, 45.8),
      pt(999, 45),
      pt(6.9, 45.9),
      pt(7.1, Number.POSITIVE_INFINITY),
    ]);
    expect(focus?.start).toEqual({ lng: 6.8, lat: 45.8 });
    expect(focus?.end).toEqual({ lng: 6.9, lat: 45.9 });
    expect(focus?.bounds).toEqual([6.8, 45.8, 6.9, 45.9]);
  });

  it('conserve l’ordre reçu : le départ est le premier point, pas le plus à l’ouest', () => {
    const focus = dayMapFocus([pt(7.0, 45.0), pt(6.0, 46.0)]);
    expect(focus?.start).toEqual({ lng: 7.0, lat: 45.0 });
    expect(focus?.end).toEqual({ lng: 6.0, lat: 46.0 });
  });

  it('simplifie une longue trace mais garde départ et arrivée exacts', () => {
    const many = Array.from({ length: 2000 }, (_, i) => pt(6 + i * 0.0005, 45 + Math.sin(i / 20) * 0.01));
    const focus = dayMapFocus(many);
    expect(focus).not.toBeNull();
    expect(focus!.line.length).toBeLessThanOrEqual(120);
    expect(focus!.start).toEqual({ lng: many[0].lng, lat: many[0].lat });
    expect(focus!.end).toEqual({ lng: many[1999].lng, lat: many[1999].lat });
  });
});

describe('page → jour', () => {
  const days = [day(1, []), day(2, [pt(1, 1), pt(2, 2)])];

  it('borne la page entre 0 et le nombre de jours', () => {
    expect(clampDayPage(-3, 2)).toBe(0);
    expect(clampDayPage(1, 2)).toBe(1);
    expect(clampDayPage(9, 2)).toBe(2);
    expect(clampDayPage(5, 0)).toBe(0);
    expect(clampDayPage(Number.NaN, 2)).toBe(0);
  });

  it('page 0 = Résumé, page n = jour n', () => {
    expect(dayForPage(days, 0)).toBeNull();
    expect(dayForPage(days, 1)).toBe(days[0]);
    expect(dayForPage(days, 2)).toBe(days[1]);
    expect(dayForPage(days, 99)).toBe(days[1]);
  });

  it('carnet sans jour : toujours le Résumé', () => {
    expect(dayForPage([], 3)).toBeNull();
    expect(dayForPage(undefined, 1)).toBeNull();
  });
});
