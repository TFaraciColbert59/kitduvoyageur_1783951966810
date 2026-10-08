import { describe, expect, it } from 'vitest';
import { distanceKm } from '../engine/places';
import { chainRiver, parseRiverWays, planRiverDescent, riverNamePattern } from '../engine/river';
import type { AreaPlace } from '../engine/itinerary';
import type { LngLat } from '../engine/track';

// Rivière simulée : 120 km d'ouest en est (le courant), un point par km.
const LAT = 44.85;
const kmLon = 1 / (111 * Math.cos((LAT * Math.PI) / 180));
const main: LngLat[] = Array.from({ length: 121 }, (_, i) => [1 + i * kmLon, LAT]);
// Découpée en tronçons OSM, dans le désordre, plus un bras secondaire.
const ways: LngLat[][] = [main.slice(60, 91), main.slice(0, 31), main.slice(90), main.slice(30, 61)];
const branch: LngLat[] = [main[40], [1 + 41 * kmLon, LAT + 0.01], [1 + 42 * kmLon, LAT]];

const village = (i: number, atKm: number, offKm = 0.4, kind: AreaPlace['kind'] = 'village'): AreaPlace => ({
  id: `n${String(i).padStart(3, '0')}`,
  name: `Bord ${atKm}`,
  lat: LAT + offKm / 111,
  lon: 1 + atKm * kmLon,
  kind,
  population: null,
  eleM: null,
});
const places: AreaPlace[] = [
  ...[3, 12, 21, 30, 39, 48, 57, 66, 75, 84, 93, 102, 111].map((k, i) => village(i, k)),
  // Une ville à 25 km de la rivière (Périgueux) : jamais une étape.
  { id: 'n900', name: 'Ville loin', lat: LAT + 25 / 111, lon: 1 + 60 * kmLon, kind: 'town', population: 30000, eleM: null },
];

describe('chainRiver', () => {
  it('remet les tronçons bout à bout, de l’amont vers l’aval, sans le bras secondaire', () => {
    const line = chainRiver([...ways, branch]);
    expect(line[0]).toEqual(main[0]);
    expect(line[line.length - 1]).toEqual(main[120]);
    expect(line).toHaveLength(121);
  });
  it('lit une réponse Overpass « out geom »', () => {
    const w = parseRiverWays({ elements: [{ type: 'way', geometry: [{ lat: 44.8, lon: 1 }, { lat: 44.8, lon: 1.01 }] }, { type: 'node', lat: 1, lon: 1 }] });
    expect(w).toEqual([[[1, 44.8], [1.01, 44.8]]]);
  });
});

describe('planRiverDescent — 3 jours de canoë', () => {
  const line = chainRiver(ways);
  const center = { lat: LAT, lon: 1 + 60 * kmLon };
  const plan = planRiverDescent({ line, places, days: 3, center })!;

  it('trois soirs au bord de l’eau, vers l’aval, ~18 km par jour', () => {
    expect(plan.stages).toHaveLength(3);
    expect(plan.stages.every((s) => s.move === 'pagaie')).toBe(true);
    let lon = plan.start.lon;
    for (const s of plan.stages) {
      expect(s.lon).toBeGreaterThan(lon);
      lon = s.lon;
      expect(s.riverKm).toBeGreaterThanOrEqual(12);
      expect(s.riverKm).toBeLessThanOrEqual(24);
      expect(s.geometry!.length).toBeGreaterThanOrEqual(2);
    }
    expect(plan.sectionKm).toBeGreaterThanOrEqual(45);
    expect(plan.sectionKm).toBeLessThanOrEqual(60);
  });

  it('centrée sur la destination, jamais la ville loin de la rivière', () => {
    expect(distanceKm(plan.start, center)).toBeLessThan(40);
    expect(plan.stages.some((s) => s.name === 'Ville loin')).toBe(false);
    expect(plan.stages[0].note).toBe(`Mise à l’eau à ${plan.start.name}.`);
  });

  it('même entrée → même descente', () => {
    expect(planRiverDescent({ line, places: [...places].reverse(), days: 3, center })).toEqual(plan);
  });

  it('aucun lieu au bord de l’eau : null (l’appelant se replie)', () => {
    expect(planRiverDescent({ line, places: [places[places.length - 1]], days: 3, center })).toBeNull();
  });

  it('trou dans les rives : journée sur place dite, jamais un lieu inventé', () => {
    const sparse = places.filter((p) => !['Bord 66', 'Bord 75', 'Bord 84'].includes(p.name));
    const p = planRiverDescent({ line, places: sparse, days: 3, center: { lat: LAT, lon: 1 + 57 * kmLon } })!;
    expect(p.stages.some((s) => s.move === 'aucun' && /journée sur place/.test(s.note ?? ''))).toBe(true);
  });
});

describe('riverNamePattern', () => {
  // Motif tel qu'écrit dans la requête Overpass, où la barre oblique inverse est doublée.
  const matches = (pattern: string, name: string) => new RegExp(pattern.replace(/\\\\/g, '\\'), 'i').test(name);
  it('accepte le nom OSM avec article (« La Dordogne », « L’Ardèche », « Le Tarn »)', () => {
    expect(matches(riverNamePattern('Dordogne')!, 'La Dordogne')).toBe(true);
    expect(matches(riverNamePattern('Dordogne')!, 'Dordogne')).toBe(true);
    expect(matches(riverNamePattern('Ardèche')!, "L'Ardèche")).toBe(true);
    expect(matches(riverNamePattern('Ardèche')!, 'L’Ardèche')).toBe(true);
    expect(matches(riverNamePattern('le Tarn')!, 'Le Tarn')).toBe(true);
  });
  it('jamais une autre rivière qui contient le nom', () => {
    expect(matches(riverNamePattern('Dordogne')!, 'Petite Dordogne')).toBe(false);
    expect(matches(riverNamePattern('Tarn')!, 'Tarnon')).toBe(false);
  });
  it('échappe les caractères spéciaux, rien pour un nom vide', () => {
    expect(riverNamePattern('St. Lawrence')).toContain('St\\\\. Lawrence');
    expect(riverNamePattern('  ')).toBeNull();
  });
});
