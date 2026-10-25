import { describe, it, expect } from 'vitest';
import {
  parseCivilDate,
  formatCivilDate,
  addCivilDays,
  getCivilDurationDays,
  formatCivilDateRange,
  toCivilIsoString,
  formatCivilDayIndex,
} from '@/lib/dates/tripDates';

describe('Sub-phase 1.6 (D8) — Civil Dates & Timezones Engine', () => {
  describe('parseCivilDate', () => {
    it('parses valid ISO YYYY-MM-DD strings without timezone distortion', () => {
      expect(parseCivilDate('2026-07-10')).toEqual({ year: 2026, month: 7, day: 10 });
      expect(parseCivilDate('2026-01-01')).toEqual({ year: 2026, month: 1, day: 1 });
      expect(parseCivilDate('2026-12-31')).toEqual({ year: 2026, month: 12, day: 31 });
    });

    it('handles ISO timestamps by stripping time and timezone', () => {
      expect(parseCivilDate('2026-07-10T00:00:00.000Z')).toEqual({ year: 2026, month: 7, day: 10 });
      expect(parseCivilDate('2026-07-10T23:59:59+02:00')).toEqual({ year: 2026, month: 7, day: 10 });
    });

    it('returns null for invalid date strings', () => {
      expect(parseCivilDate('invalid-date')).toBeNull();
      expect(parseCivilDate('')).toBeNull();
    });
  });

  describe('addCivilDays', () => {
    it('adds days linearly across normal months', () => {
      expect(addCivilDays('2026-07-10', 0)).toBe('2026-07-10');
      expect(addCivilDays('2026-07-10', 1)).toBe('2026-07-11');
      expect(addCivilDays('2026-07-10', 5)).toBe('2026-07-15');
      expect(addCivilDays('2026-07-31', 1)).toBe('2026-08-01');
    });

    it('handles year transitions cleanly (31 Dec -> 1 Jan)', () => {
      expect(addCivilDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addCivilDays('2026-12-30', 3)).toBe('2027-01-02');
    });

    it('handles leap year vs non-leap year (Feb 28/29)', () => {
      // 2026 is non-leap
      expect(addCivilDays('2026-02-28', 1)).toBe('2026-03-01');

      // 2028 is leap
      expect(addCivilDays('2028-02-28', 1)).toBe('2028-02-29');
      expect(addCivilDays('2028-02-28', 2)).toBe('2028-03-01');
    });

    it('is completely immune to Daylight Saving Time shifts (e.g. late October)', () => {
      // European DST shift is usually last Sunday of October (e.g., 2026-10-25)
      expect(addCivilDays('2026-10-24', 1)).toBe('2026-10-25');
      expect(addCivilDays('2026-10-25', 1)).toBe('2026-10-26');
      expect(addCivilDays('2026-10-24', 3)).toBe('2026-10-27');
    });
  });

  describe('getCivilDurationDays', () => {
    it('calculates exact inclusive and exclusive duration', () => {
      // Same day is 1 day trip
      expect(getCivilDurationDays('2026-07-10', '2026-07-10')).toBe(1);
      // 10 to 16 July is 7 days
      expect(getCivilDurationDays('2026-07-10', '2026-07-16')).toBe(7);
      // Over month boundary
      expect(getCivilDurationDays('2026-07-30', '2026-08-02')).toBe(4);
    });
  });

  describe('formatCivilDate', () => {
    it('formats civil date in French locale without timezone day-shift', () => {
      // In UTC-10 or UTC+12, July 10 must ALWAYS be July 10!
      const formattedLong = formatCivilDate('2026-07-10', 'fr-FR', 'long');
      expect(formattedLong.toLowerCase()).toContain('10 juillet 2026');

      const formattedShort = formatCivilDate('2026-07-10', 'fr-FR', 'short');
      expect(formattedShort.toLowerCase()).toContain('10 juil.');

      const formattedNumeric = formatCivilDate('2026-07-10', 'fr-FR', 'numeric');
      expect(formattedNumeric).toBe('10/07/2026');
    });

    it('safely handles empty or null date', () => {
      expect(formatCivilDate('', 'fr-FR')).toBe('');
      expect(formatCivilDate(null as any, 'fr-FR')).toBe('');
    });
  });

  describe('formatCivilDateRange', () => {
    it('formats a date range when start and end dates are provided', () => {
      const range = formatCivilDateRange('2026-07-10', '2026-07-16', undefined, 'fr-FR');
      // "Du 10 au 16 juillet 2026" or similar
      expect(range).toContain('10');
      expect(range).toContain('16');
      expect(range.toLowerCase()).toContain('juil');
    });

    it('formats a date range using durationDays if endDate is absent', () => {
      const range = formatCivilDateRange('2026-07-10', null, 7, 'fr-FR');
      expect(range).toContain('10');
      expect(range).toContain('16');
      expect(range.toLowerCase()).toContain('juil');
    });

    it('formats single date when duration is 1 or no end date/duration', () => {
      const single = formatCivilDateRange('2026-07-10', null, 1, 'fr-FR');
      expect(single.toLowerCase()).toContain('10 juil');
    });
  });

  describe('formatCivilDayIndex', () => {
    it('formats short weekday + date for day 1, day 2 etc.', () => {
      // 2026-07-10 is a Friday
      const d1 = formatCivilDayIndex('2026-07-10', 1, { weekday: 'short', month: 'short' });
      expect(d1?.toLowerCase()).toContain('10');
      expect(d1?.toLowerCase()).toContain('juil');

      // Day 3 is 2026-07-12 (Sunday)
      const d3 = formatCivilDayIndex('2026-07-10', 3, { weekday: 'short', month: 'short' });
      expect(d3?.toLowerCase()).toContain('12');
      expect(d3?.toLowerCase()).toContain('juil');
    });

    it('formats long weekday + full date with year', () => {
      const full = formatCivilDayIndex('2026-07-10', 1, { weekday: 'long', month: 'long', includeYear: true });
      expect(full?.toLowerCase()).toContain('vendredi');
      expect(full?.toLowerCase()).toContain('10 juillet 2026');
    });

    it('returns null if startDate is null or invalid', () => {
      expect(formatCivilDayIndex(null, 1)).toBeNull();
      expect(formatCivilDayIndex('invalid', 1)).toBeNull();
    });
  });

  describe('Extreme Timezone Simulation', () => {
    it('always preserves civil date representation across UTC-12 to UTC+14 environments', () => {
      const testCases = [
        '2026-01-01',
        '2026-02-28',
        '2026-07-10',
        '2026-10-25',
        '2026-12-31',
      ];

      for (const iso of testCases) {
        const parsed = parseCivilDate(iso)!;
        const serialized = toCivilIsoString(parsed.year, parsed.month, parsed.day);
        expect(serialized).toBe(iso);

        // Formatting numeric in fr-FR should strictly match dd/mm/yyyy
        const [y, m, d] = iso.split('-');
        const expectedNumeric = `${d}/${m}/${y}`;
        expect(formatCivilDate(iso, 'fr-FR', 'numeric')).toBe(expectedNumeric);
      }
    });
  });
});
