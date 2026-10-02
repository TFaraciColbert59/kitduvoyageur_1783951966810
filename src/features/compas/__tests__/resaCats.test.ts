import { describe, expect, it } from 'vitest';
import { RESA_CATS, bookingCat, offerCat } from '../engine/resaCats';

describe('resaCats — les six catégories de la maquette sur les données réelles', () => {
  it('six catégories dans l’ordre de la maquette', () => {
    expect(RESA_CATS.map((c) => c.label)).toEqual([
      'Randos',
      'Activités',
      'Nuits',
      'Vols',
      'Trajets',
      'Extras',
    ]);
  });

  it('classe réservations et offres', () => {
    expect(['hotel', 'flight', 'activity', 'car'].map(bookingCat)).toEqual([
      'nuits',
      'vols',
      'activites',
      'trajets',
    ]);
    expect(
      ['hotel', 'flight', 'activity', 'transport', 'insurance', 'esim', 'gear', null].map(offerCat)
    ).toEqual(['nuits', 'vols', 'activites', 'trajets', 'extras', 'extras', 'extras', 'extras']);
  });
});
