import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatElevation,
  formatElevationCompact,
  formatElevationExact,
  formatInteger,
  formatKm,
  formatNumber,
} from '../metrics';

describe('formatage des métriques', () => {
  it('garde les petites valeurs lisibles', () => {
    expect(formatNumber(950)).toBe('950');
    expect(formatKm(339)).toBe('339 km');
    expect(formatElevation(950)).toBe('950 m');
  });

  it('compacte les milliers avec un k', () => {
    expect(formatElevation(2200)).toBe('2,2 k m');
    expect(formatElevation(12870)).toBe('12,9 k m');
    expect(formatElevationCompact(12870)).toBe('12,9 k');
    expect(formatCount(12870)).toBe('12,9 k');
  });

  it('préserve une valeur exacte pour les fiches', () => {
    expect(formatElevationExact(12870)).toBe('12\u202f870 m');
    expect(formatInteger(12870)).toBe('12\u202f870');
  });
});
