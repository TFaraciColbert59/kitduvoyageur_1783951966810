import { describe, expect, it } from 'vitest';
import {
  formatDistanceIn,
  formatElevationIn,
  formatTemperatureIn,
  formatWeightIn,
} from '@/lib/i18n/measure';
import { measurePrefsFor } from '@/lib/i18n/region';
import { parseUnitSystem, readUnitSystem, unitPrefsFor } from '@/lib/i18n/unitSetting';
import { compasFormat } from '@/features/compas/engine/compasI18n';
import { formatKg, formatKm, formatMeters } from '@/features/compas/engine/format';

/** PLAN-100 6.3 : conversions exactes, arrondis lisibles, réglage explicite prioritaire. */
const imperial = { system: 'imperial' as const };

describe('conversions exactes (définitions légales)', () => {
  it('1 mi = 1,609344 km', () => {
    expect(formatDistanceIn(1.609344, 'en', imperial)).toBe('1 mi');
    expect(formatDistanceIn(160.9344, 'en', imperial)).toBe('100 mi');
    expect(formatDistanceIn(42.195, 'en', imperial)).toBe('26.2 mi');
  });

  it('1 ft = 0,3048 m (pas l’approximation 3,28084)', () => {
    expect(formatElevationIn(0.3048, 'en', imperial)).toBe('1 ft');
    expect(formatElevationIn(304.8, 'en', imperial)).toBe('1,000 ft');
    // 8 848,86 m / 0,3048 = 29 031,69 ft.
    expect(formatElevationIn(8848.86, 'en', imperial)).toBe('29,032 ft');
    expect(formatElevationIn(4808, 'fr', imperial)).toBe('15 774 ft');
  });

  it('1 lb = 0,45359237 kg ; sous la livre, des onces', () => {
    expect(formatWeightIn(453.59237, 'en', imperial)).toBe('1 lb');
    expect(formatWeightIn(4535.9237, 'en', imperial)).toBe('10 lb');
    expect(formatWeightIn(28.349523125, 'en', imperial)).toBe('1 oz');
    expect(formatWeightIn(1850, 'fr', imperial)).toBe('4,1 lb');
  });

  it('°F = °C × 9/5 + 32, arrondi au degré, jamais « -0 »', () => {
    expect(formatTemperatureIn(100, 'en', imperial)).toBe('212 °F');
    expect(formatTemperatureIn(0, 'en', imperial)).toBe('32 °F');
    expect(formatTemperatureIn(-40, 'en', imperial)).toBe('-40 °F');
    expect(formatTemperatureIn(37, 'en', imperial)).toBe('99 °F');
    expect(formatTemperatureIn(-17.9, 'en', imperial)).toBe('0 °F');
  });
});

describe('réglage d’unités du compte (navigateur)', () => {
  it('lit `unitSystem` dans l’enregistrement des réglages, sinon rien', () => {
    expect(parseUnitSystem(JSON.stringify({ unitSystem: 'imperial', language: 'fr' }))).toBe(
      'imperial'
    );
    expect(parseUnitSystem(JSON.stringify({ unitSystem: 'metric' }))).toBe('metric');
    expect(parseUnitSystem(JSON.stringify({ unitSystem: 'nautique' }))).toBeNull();
    expect(parseUnitSystem('{abîmé')).toBeNull();
    expect(parseUnitSystem('null')).toBeNull();
    expect(parseUnitSystem(null)).toBeNull();
  });

  it('hors navigateur : aucun réglage, aucune exception', () => {
    expect(readUnitSystem()).toBeNull();
  });

  it('le réglage explicite l’emporte sur la région, en entier', () => {
    expect(unitPrefsFor('en', null)).toEqual(measurePrefsFor('en-US'));
    expect(unitPrefsFor('en', 'metric')).toEqual(measurePrefsFor('fr'));
    expect(unitPrefsFor('fr', 'imperial')).toEqual(measurePrefsFor('en-US'));
    expect(unitPrefsFor('fr', null).distance).toBe('km');
  });

  it('la langue du navigateur apporte la région seulement si elle parle la langue du site', () => {
    expect(unitPrefsFor('en', null, 'en-GB')).toEqual({
      distance: 'mi',
      elevation: 'm',
      weight: 'kg',
      temperature: 'c',
    });
    expect(unitPrefsFor('en', null, 'en-AU').distance).toBe('km');
    // Un navigateur américain ne rend pas impérial un site lu en français.
    expect(unitPrefsFor('fr', null, 'en-US').distance).toBe('km');
    expect(unitPrefsFor('en', 'metric', 'en-US').distance).toBe('km');
  });
});

describe('compasFormat dans les unités de la personne', () => {
  const values = { km: [0.4, 12.4, 1234.56], m: [80, 900, 4808], g: [850, 1850, 15400] };

  it('métrique en français : les formats du moteur, au caractère près', () => {
    for (const units of [undefined, null, measurePrefsFor('fr')]) {
      const f = compasFormat('fr', units);
      for (const km of values.km) expect(f.km(km)).toBe(formatKm(km));
      for (const m of values.m) expect(f.meters(m)).toBe(formatMeters(m));
      for (const g of values.g) expect(f.kg(g)).toBe(formatKg(g));
      expect(f.meters(0)).toBe('—');
      expect(f.temp(-3.4)).toBe('-3 °C');
      expect(f.temp(-0.2)).toBe('0 °C');
      expect(f.degrees(12.6)).toBe('13°');
      expect(f.temp(null)).toBe('—');
    }
  });

  it('impérial : mi, ft, lb, °F, séparateurs de la langue', () => {
    const en = compasFormat('en', measurePrefsFor('en-US'));
    expect(en.km(12.4)).toBe('7.7 mi');
    expect(en.meters(900)).toBe('2,953 ft');
    expect(en.meters(0)).toBe('—');
    expect(en.kg(1850)).toBe('4.1 lb');
    expect(en.kg(200)).toBe('7 oz');
    expect(en.temp(12)).toBe('54 °F');
    expect(en.degrees(12)).toBe('54°F');
    expect(en.km(null)).toBe('—');

    const fr = compasFormat('fr', measurePrefsFor('fr', 'imperial'));
    expect(fr.km(12.4)).toBe('7,7 mi');
    expect(fr.meters(900)).toBe('2 953 ft');
    expect(fr.kg(1850)).toBe('4,1 lb');
    // Le reste ne bouge pas : durées, montants, dates.
    expect(fr.duration(95)).toBe(compasFormat('fr').duration(95));
    expect(fr.money(12)).toBe(compasFormat('fr').money(12));
  });

  it('anglais britannique : miles seulement', () => {
    const gb = compasFormat('en', unitPrefsFor('en', null, 'en-GB'));
    expect(gb.km(16.09344)).toBe('10 mi');
    expect(gb.meters(1200)).toBe('1,200 m');
    expect(gb.kg(1200)).toBe('1.2 kg');
    expect(gb.temp(12)).toBe('12 °C');
  });
});
