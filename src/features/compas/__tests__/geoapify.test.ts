import { describe, expect, it } from 'vitest';
import { parseGeoapify } from '../engine/places';
import { areaKinds, geoapifyCategories, parseGeoapifyArea } from '../engine/itinerary';
import search from './fixtures/geoapify-queyras.json';
import area from './fixtures/geoapify-queyras-area.json';

// Réponses Geoapify réelles (7 octobre 2026), enregistrées sans la clé.
describe('Geoapify : secours de la carte', () => {
  it('géocodage : villes et lieux naturels gardés, emprise convertie [ouest, nord, est, sud]', () => {
    const places = parseGeoapify(search);
    expect(places.length).toBeGreaterThan(0);
    const park = places.find((p) => /Parc naturel régional du Queyras/.test(p.name));
    expect(park).toMatchObject({ countryCode: 'FR', landmark: true });
    const [w, n, e, s] = park!.extent!;
    expect(w).toBeLessThan(e);
    expect(s).toBeLessThan(n);
    const town = places.find((p) => p.name === 'Molines-en-Queyras');
    expect(town).toMatchObject({ settlement: true, kind: 'city' });
  });

  it('géocodage : rien d’exploitable → liste vide, jamais d’exception', () => {
    expect(parseGeoapify(null)).toEqual([]);
    expect(parseGeoapify({ results: [{ name: 'Rue X', lat: 1, lon: 2, result_type: 'street', category: 'highway' }] })).toEqual([]);
  });

  it('lieux de zone : hameaux, villages et refuges réels, identifiants OSM, pas de bruit', () => {
    const places = parseGeoapifyArea(area);
    expect(places.length).toBeGreaterThan(20);
    expect(new Set(places.map((p) => p.kind))).toEqual(new Set(['hamlet', 'village', 'hut']));
    expect(places.every((p) => /^[nwr]\d+$/.test(p.id))).toBe(true);
    // Zone frontalière : versant français et italien (Coni), toujours avec pays et département.
    expect(new Set(places.map((p) => p.countryCode))).toEqual(new Set(['FR', 'IT']));
    expect(places.every((p) => !!p.county)).toBe(true);
    expect(places.some((p) => p.eleM != null && p.eleM > 1000)).toBe(true);
  });

  it('catégories demandées selon la zone et l’activité', () => {
    expect(geoapifyCategories(areaKinds({ center: { lat: 44.7, lon: 6.8 }, radiusKm: 15, activity: 'hiking' }))).toBe(
      'populated_place.town,populated_place.village,populated_place.hamlet,accommodation.hut,camping.camp_site'
    );
    expect(geoapifyCategories(areaKinds({ center: { lat: 44.7, lon: 6.8 }, radiusKm: 300, activity: 'roadtrip' }))).toBe(
      'populated_place.city,populated_place.town'
    );
  });
});
