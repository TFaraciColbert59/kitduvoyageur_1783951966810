import { describe, expect, it } from 'vitest';
import { planApplication, type ApplyCurrent } from '../engine/intent';
import { samePlaceName } from '../engine/places';
import { applyCurrent } from '../components/compasApply';
import type { CompasCtl } from '../components/compasTypes';

const current: ApplyCurrent = {
  startDate: null,
  endDate: null,
  days: null,
  shortHours: null,
  preferences: { pace: 'normal', nights: null, avoid: [], wishes: [] },
  hasRoute: false,
};
const said = [{ type: 'set_origin' as const, place: 'Lyon' }];

describe('redire le même départ ne le cherche pas une seconde fois', () => {
  it('même nom (sans tenir compte de la casse ni des accents) : aucune opération', () => {
    expect(planApplication(said, { ...current, originName: 'Lyon' })).toEqual([]);
    expect(planApplication(said, { ...current, originName: 'lyon' })).toEqual([]);
    expect(planApplication([{ type: 'set_origin', place: 'Genève' }], { ...current, originName: 'Geneve' })).toEqual([]);
  });

  it('trait d’union et apostrophe ne changent pas le nom (« Bourg en Bresse » = « Bourg-en-Bresse »)', () => {
    const bourg = [{ type: 'set_origin' as const, place: 'Bourg en Bresse' }];
    expect(planApplication(bourg, { ...current, originName: 'Bourg-en-Bresse' })).toEqual([]);
    expect(planApplication(bourg, { ...current, originName: 'Bourg-en-Bresse-sud' })).toEqual([
      { op: 'origin', place: 'Bourg en Bresse' },
    ]);
  });

  it('autre nom, ou aucun départ rangé : l’opération est émise', () => {
    expect(planApplication(said, { ...current, originName: 'Grenoble' })).toEqual([{ op: 'origin', place: 'Lyon' }]);
    expect(planApplication(said, { ...current, originName: null })).toEqual([{ op: 'origin', place: 'Lyon' }]);
    expect(planApplication(said, current)).toEqual([{ op: 'origin', place: 'Lyon' }]);
  });

  it('le reste de la phrase est appliqué malgré tout', () => {
    const ops = planApplication(
      [
        { type: 'set_destination', place: 'Vercors' },
        { type: 'set_origin', place: 'Lyon' },
      ],
      { ...current, originName: 'Lyon' }
    );
    expect(ops).toEqual([{ op: 'destination', place: 'Vercors' }]);
  });

  it('applyCurrent donne le nom du départ rangé sur le voyage', () => {
    const ctl = (originSaid: { name: string; lat: number; lon: number; countryCode: string | null } | null) =>
      ({
        data: {
          model: { dates: { start: null, end: null, days: null, hours: null }, preferences: current.preferences },
          plannedDays: null,
          route: { id: null },
          originSaid,
        },
      }) as unknown as CompasCtl;
    expect(applyCurrent(ctl({ name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' })).originName).toBe('Lyon');
    expect(applyCurrent(ctl(null)).originName).toBeNull();
  });
});

describe('samePlaceName', () => {
  it('même nom écrit autrement : accents, casse, trait d’union, apostrophe', () => {
    expect(samePlaceName('Bourg en Bresse', 'Bourg-en-Bresse')).toBe(true);
    expect(samePlaceName('Châlons en Champagne', 'chalons-en-champagne')).toBe(true);
    expect(samePlaceName("L'Isle-sur-la-Sorgue", 'L’Isle sur la Sorgue')).toBe(true);
  });

  it('l’article du début ne compte pas : « depuis le havre » retrouve « Le Havre »', () => {
    expect(samePlaceName('Le Havre', 'Havre')).toBe(true);
    expect(samePlaceName('La Roche-sur-Yon', 'Roche sur Yon')).toBe(true);
    expect(samePlaceName("L'Isle-sur-la-Sorgue", 'Isle sur la Sorgue')).toBe(true);
    const havre = [{ type: 'set_origin' as const, place: 'Havre' }];
    expect(planApplication(havre, { ...current, originName: 'Le Havre' })).toEqual([]);
  });

  it('un nom plus long ou différent n’est pas le même, ni le vide', () => {
    expect(samePlaceName('Lyon', 'Lyon en Corse')).toBe(false);
    expect(samePlaceName('Bourg', 'Bourg-en-Bresse')).toBe(false);
    expect(samePlaceName('', '')).toBe(false);
    expect(samePlaceName('--', '  ')).toBe(false);
    expect(samePlaceName('Le', 'La')).toBe(false);
  });
});
