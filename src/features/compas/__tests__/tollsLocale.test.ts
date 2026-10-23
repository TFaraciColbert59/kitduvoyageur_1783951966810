import { describe, expect, it } from 'vitest';
import { perKmHint, tollsBasis, tripTolls } from '../engine/tolls';
import { localizeExpenseTitle } from '../engine/storedText';

const base = { country: 'CH', days: 10, cars: 2, start: '2026-11-01', today: '2026-10-12', rates: {} };

describe('péages et vignettes dits dans la langue (plan 6.1)', () => {
  it('le français est inchangé', () => {
    const fr = tripTolls({ ...base, locale: 'fr', country: 'AT' });
    expect(fr).toEqual(tripTolls({ ...base, country: 'AT' }));
    expect(fr.line?.title).toBe('Vignette autrichienne · 10 jours × 2 voitures');
  });

  it.each(['en', 'es', 'de', 'it'] as const)('%s : titre et base sans français', (locale) => {
    const t = tripTolls({ ...base, country: 'AT', locale });
    expect(t.line?.title).not.toMatch(/Vignette autrichienne|voitures/);
    expect(t.line?.basis).not.toMatch(/tarif officiel|voyage du|pays de destination/);
    expect(tollsBasis('PE', locale)).not.toContain('péages');
  });

  it('une vignette rangée en français est relue dans la langue, sans réécrire la base', () => {
    const stored = tripTolls({ ...base, country: 'AT' }).line!.title;
    expect(localizeExpenseTitle(stored, 'fr')).toBe(stored);
    expect(localizeExpenseTitle(stored, 'en')).toBe('Motorway vignette · Austria · 10 days × 2 cars');
    expect(localizeExpenseTitle(stored, 'de')).toContain('Österreich');
  });

  it('le barème au kilomètre est chiffré dans la langue', () => {
    expect(perKmHint('FR', 'en')).toMatch(/c€\/km incl\. VAT/);
    expect(perKmHint('FR', 'fr')).toMatch(/c€\/km TTC/);
  });
});
