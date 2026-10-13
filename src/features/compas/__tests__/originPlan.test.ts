import { describe, expect, it, vi } from 'vitest';

/**
 * Le départ dit, une fois rangé, arrive là où on le lit : l'empreinte des
 * réglages (`tripBasis`, qui dit quoi réadapter) et l'écran (`compasPlan`, qui
 * sert aussi « Annuler »).
 */
vi.mock('server-only', () => ({}));

import { staleParts } from '../engine/dependencies';
import { tripBasis } from '../server/compasServer';
import { compasPlan } from '../server/getCompasData';

const LYON = { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR', source: 'dit' };

const trip = (compas: Record<string, unknown> | null) => ({
  start_date: '2027-06-01',
  end_date: '2027-06-03',
  destination_name: 'Vercors',
  party_size: 2,
  metadata: compas ? { compas: { anchor: { name: 'Vercors', lat: 45.07, lon: 5.55 }, ...compas } } : null,
});

describe('tripBasis lit le départ dit rangé sur le voyage', () => {
  it('le départ rangé entre dans l’empreinte, arrondi à ~1 km', () => {
    expect(tripBasis(trip({ origin: LYON }), 'hiking').origin).toBe('Lyon@45.76,4.83');
  });

  it('sans départ, ou avec un départ illisible : null', () => {
    expect(tripBasis(trip({}), 'hiking').origin).toBeNull();
    expect(tripBasis(trip(null), 'hiking').origin).toBeNull();
    expect(tripBasis(trip({ origin: { name: 'Lyon', lat: '', lon: '' } }), 'hiking').origin).toBeNull();
    expect(tripBasis(trip({ origin: 'Lyon' }), 'hiking').origin).toBeNull();
  });

  it('un départ dit après le préremplissage, ou changé, réadapte trajet et budget', () => {
    const before = tripBasis(trip({}), 'hiking');
    const lyon = tripBasis(trip({ origin: LYON }), 'hiking');
    expect(staleParts(before, lyon)).toEqual(['transport', 'budget']);
    const grenoble = tripBasis(trip({ origin: { ...LYON, name: 'Grenoble', lat: 45.19, lon: 5.72 } }), 'hiking');
    expect(staleParts(lyon, grenoble)).toEqual(['transport', 'budget']);
    expect(staleParts(lyon, tripBasis(trip({ origin: LYON }), 'hiking'))).toEqual([]);
  });
});

describe('compasPlan donne le départ dit à l’écran', () => {
  it('nom et point exact rangé (déjà arrondi), sans la source', () => {
    const plan = compasPlan({ compas: { anchor: { name: 'Vercors' }, origin: { ...LYON, countryCode: 'fr' } } });
    expect(plan.originName).toBe('Lyon');
    expect(plan.originSaid).toEqual({ name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' });
    expect(plan.anchorName).toBe('Vercors');
  });

  it('pays inconnu : null, jamais deviné', () => {
    expect(compasPlan({ compas: { origin: { name: 'Lyon', lat: 45.76, lon: 4.83 } } }).originSaid).toEqual({
      name: 'Lyon',
      lat: 45.76,
      lon: 4.83,
      countryCode: null,
    });
  });

  it('sans départ, ou départ illisible : null partout', () => {
    for (const metadata of [null, {}, { compas: {} }, { compas: { origin: { name: 'Lyon', lat: '', lon: '' } } }]) {
      const plan = compasPlan(metadata);
      expect(plan.originName).toBeNull();
      expect(plan.originSaid).toBeNull();
    }
  });
});
