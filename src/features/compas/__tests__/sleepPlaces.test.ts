import { describe, expect, it } from 'vitest';
import { parsePhoton, sleepPlaceFix } from '../engine/places';

/**
 * Plan 4.5, défaut ouvert de la Patagonie : une nuit « au Canal de Beagle ».
 * Un détroit, une baie ou la mer ne sont pas un lieu où dormir ; un lac,
 * lui, reste une étape possible (bivouac, refuge voisin : test existant).
 */
const photon = (name: string, key: string, value: string, type: string) =>
  parsePhoton({
    features: [
      {
        geometry: { coordinates: [-68.3, -54.88] },
        properties: { name, osm_key: key, osm_value: value, type, countrycode: 'AR' },
      },
    ],
  })[0];

describe('sleepPlaceFix — l’eau libre n’est pas un lieu où dormir', () => {
  it('un détroit, une baie ou la mer : cherchés comme lieu de nuit (le plus proche village), pas gardés tels quels', () => {
    expect(sleepPlaceFix(photon('Canal Beagle', 'natural', 'strait', 'other'))).toEqual({ search: 'Canal Beagle' });
    expect(sleepPlaceFix(photon('Bahía Lapataia', 'natural', 'bay', 'other'))).toEqual({ search: 'Bahía Lapataia' });
    expect(sleepPlaceFix(photon('Mer d’Iroise', 'place', 'sea', 'other'))).toEqual({ search: 'Mer d’Iroise' });
  });

  it('CONTRE-EXEMPLES — un lac, un sommet, un refuge, un village et un camping restent l’étape', () => {
    expect(sleepPlaceFix(photon('Lago di Misurina', 'water', 'lake', 'other'))).toBeNull();
    expect(sleepPlaceFix(photon('Laguna de los Tres', 'natural', 'water', 'other'))).toBeNull();
    expect(sleepPlaceFix(photon('Fitz Roy', 'natural', 'peak', 'other'))).toBeNull();
    expect(sleepPlaceFix(photon('Refugio Poincenot', 'tourism', 'alpine_hut', 'house'))).toBeNull();
    expect(sleepPlaceFix(photon('El Chaltén', 'place', 'village', 'district'))).toBeNull();
    expect(sleepPlaceFix(photon('Camping Bahía Lapataia', 'tourism', 'camp_site', 'house'))).toBeNull();
  });
});
