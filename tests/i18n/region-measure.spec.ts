import { describe, expect, it } from 'vitest';
import { measurePrefsFor, regionOf, weekStartFor, weekdaysInOrder } from '@/lib/i18n/region';
import {
  formatDistanceIn,
  formatElevationIn,
  formatNumericDateIn,
  formatTemperatureIn,
  formatWeightIn,
} from '@/lib/i18n/measure';
import { formatKg, formatKm, formatMeters } from '@/features/compas/engine/format';

/** PLAN-100 6.3 : dates, nombres et unités selon la langue ET la région. */
describe('région', () => {
  it('région d’une balise, ou celle de la langue', () => {
    expect(regionOf('en-GB')).toBe('GB');
    expect(regionOf('fr_CA')).toBe('CA');
    expect(regionOf('fr')).toBe('FR');
    expect(regionOf('en')).toBe('US');
    expect(regionOf('')).toBeNull();
  });

  it('semaine selon la région (CLDR) : lundi en France, dimanche aux États-Unis, samedi en Égypte', () => {
    expect(weekStartFor('fr')).toBe(1);
    expect(weekStartFor('en-GB')).toBe(1);
    expect(weekStartFor('en')).toBe(7);
    expect(weekStartFor('fr-CA')).toBe(7);
    expect(weekStartFor('ar-EG')).toBe(6);
    expect(weekStartFor('xx')).toBe(1);
    expect(weekdaysInOrder('en-US')).toEqual([7, 1, 2, 3, 4, 5, 6]);
    expect(weekdaysInOrder('fr')).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('unités selon la région, le réglage de la personne l’emporte', () => {
    expect(measurePrefsFor('fr')).toEqual({ distance: 'km', elevation: 'm', weight: 'kg', temperature: 'c' });
    expect(measurePrefsFor('en-US')).toEqual({ distance: 'mi', elevation: 'ft', weight: 'lb', temperature: 'f' });
    expect(measurePrefsFor('en-GB')).toEqual({ distance: 'mi', elevation: 'm', weight: 'kg', temperature: 'c' });
    expect(measurePrefsFor('en-US', 'metric').distance).toBe('km');
    expect(measurePrefsFor('fr', 'imperial').temperature).toBe('f');
  });
});

describe('mesures', () => {
  it('en français métrique : la sortie du moteur, au caractère près', () => {
    for (const km of [0.4, 12.5, 1234.56]) expect(formatDistanceIn(km, 'fr')).toBe(formatKm(km));
    for (const m of [80, 1200, 4808]) expect(formatElevationIn(m, 'fr')).toBe(formatMeters(m));
    for (const g of [850, 1200, 15400]) expect(formatWeightIn(g, 'fr')).toBe(formatKg(g));
  });

  it('impérial aux États-Unis, séparateurs anglais', () => {
    expect(formatDistanceIn(12.5, 'en')).toBe('7.8 mi');
    expect(formatElevationIn(1200, 'en')).toBe('3,937 ft');
    expect(formatWeightIn(850, 'en')).toBe('1.9 lb');
    expect(formatWeightIn(200, 'en')).toBe('7 oz');
    expect(formatTemperatureIn(12, 'en')).toBe('54 °F');
    expect(formatTemperatureIn(-3.4, 'fr')).toBe('-3 °C');
  });

  it('anglais britannique : miles, mais mètres, kilos et degrés Celsius', () => {
    expect(formatDistanceIn(16.09344, 'en-GB')).toBe('10 mi');
    expect(formatElevationIn(1200, 'en-GB')).toBe('1,200 m');
    expect(formatWeightIn(1200, 'en-GB')).toBe('1.2 kg');
    expect(formatTemperatureIn(12, 'en-GB')).toBe('12 °C');
  });

  it('valeur absente : « — », jamais zéro', () => {
    expect(formatDistanceIn(null, 'en')).toBe('—');
    expect(formatElevationIn(Number.NaN, 'fr')).toBe('—');
    expect(formatTemperatureIn(undefined, 'fr')).toBe('—');
  });

  it('date numérique dans l’ordre de la région', () => {
    expect(formatNumericDateIn('2026-10-17', 'fr')).toBe('17/10/2026');
    expect(formatNumericDateIn('2026-10-17', 'en')).toBe('10/17/2026');
    expect(formatNumericDateIn('2026-10-17', 'en-GB')).toBe('17/10/2026');
    expect(formatNumericDateIn('pas une date', 'fr')).toBe('pas une date');
  });
});
