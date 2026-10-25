import { describe, expect, it } from 'vitest';
import { localizeStoredNote } from '../engine/storedText';
import { dayTripNote, HOME_ORIGIN_NOTE, ON_SITE_NOTE, SAME_AIRPORT_NOTE, UNKNOWN_ORIGIN_NOTE } from '../engine/travel';

describe('notes de préparation rangées, relues dans la langue (plan 6.1)', () => {
  const stored = [UNKNOWN_ORIGIN_NOTE, ON_SITE_NOTE, SAME_AIRPORT_NOTE, HOME_ORIGIN_NOTE, dayTripNote(1, 200)!, dayTripNote(1, 200, false)!];

  it('en français, la sortie est l’entrée', () => {
    for (const n of stored) expect(localizeStoredNote(n, 'fr')).toBe(n);
    expect(localizeStoredNote('Une note retouchée à la main.', 'de')).toBe('Une note retouchée à la main.');
  });

  it.each(['en', 'es', 'de', 'it'] as const)('%s : plus aucun gabarit français', (locale) => {
    for (const n of stored) {
      const out = localizeStoredNote(n, locale);
      expect(out).not.toBe(n);
      expect(out).not.toMatch(/trajet|domicile|Tu es|écris|prévois/);
    }
  });

  it('la durée et la distance sont gardées, dites dans la langue', () => {
    expect(localizeStoredNote(dayTripNote(1, 200)!, 'en')).toBe('3 h 20 of travel each way for a single day: plan a night on site or choose somewhere closer.');
    expect(localizeStoredNote(dayTripNote(1, 200, false)!, 'de')).toContain('Mehr als 3 Std.');
  });
});
