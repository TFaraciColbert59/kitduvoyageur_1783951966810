import { describe, it, expect } from 'vitest';
import { formatArea, formatAreaShort, formatDistance, formatElevation, formatDateRange, relativeDate, plural, joinMeta, formatPopulation } from '../formatPays';

describe('formatage fiche pays', () => {
  it('sépare les milliers par une espace insécable', () => {
    expect(formatArea(643801)).toBe('643\u202F801 km²');
  });

  it('accepte une chaîne déjà formatée', () => {
    expect(formatArea('643 801')).toBe('643\u202F801 km²');
  });

  it('rend null sur une surface absente ou nulle', () => {
    expect(formatArea(null)).toBeNull();
    expect(formatArea(0)).toBeNull();
    expect(formatArea('—')).toBeNull();
  });

  it('arrondit la stat superficie à la centaine de milliers', () => {
    expect(formatAreaShort(643801)).toBe('600\u202F000 km');
    expect(formatAreaShort('551 695')).toBe('600\u202F000 km');
    expect(formatAreaShort(null)).toBeNull();
  });

  it('colle l’unité à la décimale', () => {
    expect(formatDistance(27.4)).toBe('27,4 km');
    expect(formatDistance(12)).toBe('12 km');
  });

  it('formate un dénivelé', () => {
    expect(formatElevation(1620)).toBe('1\u202F620 m');
  });

  it('accorde le pluriel', () => {
    expect(plural(1, 'activité', 'activités')).toBe('1 activité');
    expect(plural(3, 'activité', 'activités')).toBe('3 activités');
  });

  it('rend une date relative', () => {
    expect(relativeDate(new Date(Date.now() - 2 * 864e5).toISOString())).toBe('il y a 2 j');
    expect(relativeDate(new Date(Date.now() - 3 * 36e5).toISOString())).toBe('il y a 3 h');
  });

  it('rend une plage de dates courte', () => {
    expect(formatDateRange('2025-10-01', '2025-10-22')).toBe('1 → 22 oct. 2025');
    expect(formatDateRange('2025-12-28', '2026-01-04')).toBe('28 déc. 2025 → 4 janv. 2026');
  });

  it('ne laisse aucun séparateur orphelin', () => {
    expect(joinMeta(['4 h', null, '', 'Difficile'])).toBe('4 h · Difficile');
    expect(joinMeta([null, ''])).toBeNull();
  });

  it('formate une population', () => {
    expect(formatPopulation(68_000_000)).toBe('68,0 M hab.');
  });
});
