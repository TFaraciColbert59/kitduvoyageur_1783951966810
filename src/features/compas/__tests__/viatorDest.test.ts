import { describe, expect, it } from 'vitest';
import { nearestViatorDestination, parseViatorDestinations } from '../engine/viatorDest';

const payload = {
  destinations: [
    { destinationId: 77, name: 'France', type: 'COUNTRY', center: { latitude: 46.6, longitude: 2.4 } },
    { destinationId: 479, name: 'Paris', type: 'CITY', center: { latitude: 48.8566, longitude: 2.3522 } },
    { destinationId: 5003, name: 'Grenoble', type: 'CITY', center: { latitude: 45.1885, longitude: 5.7245 } },
    { destinationId: 511, name: 'Rome', type: 'CITY', center: { latitude: 41.9028, longitude: 12.4964 } },
    { destinationId: 'x', name: 'Cassé', type: 'CITY', center: {} },
  ],
};

describe('Destination Viator choisie par la carte', () => {
  const list = parseViatorDestinations(payload);
  it('liste compacte, entrées illisibles écartées', () => {
    expect(list.map((d) => d.id)).toEqual(['77', '479', '5003', '511']);
    expect(parseViatorDestinations(null)).toEqual([]);
  });
  it('Vercors → Grenoble, jamais Paris par défaut', () => {
    expect(nearestViatorDestination(list, { lat: 45.05, lon: 5.45 })?.name).toBe('Grenoble');
  });
  it('Rome → Rome', () => {
    expect(nearestViatorDestination(list, { lat: 41.89, lon: 12.49 })?.id).toBe('511');
  });
  it('rien à portée : aucune destination (pas d’activités à l’autre bout du pays)', () => {
    expect(nearestViatorDestination(list, { lat: 43.3, lon: -0.37 })).toBeNull();
  });
  it('voyage à l’échelle d’un pays sans ville proche : le pays', () => {
    expect(nearestViatorDestination(list, { lat: 46.6, lon: 0.4 }, { broad: true })?.name).toBe('France');
  });
});
