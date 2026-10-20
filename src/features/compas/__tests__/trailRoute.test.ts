import { describe, expect, it } from 'vitest';
import {
  chainTrail,
  parseTrailRelations,
  pickTrailLine,
  planTrailTrek,
  trailLineQuery,
  trailNamePattern,
  trailRefPattern,
  trailWindow,
  TRAIL_OFF_KM,
} from '../engine/trailRoute';
import type { AreaPlace } from '../engine/itinerary';
import type { LngLat } from '../engine/track';

/** 1 degré de latitude ≈ 111,19 km : un tracé plein nord, un point par km. */
const KM_DEG = 1 / 111.19;
function northLine(km: number, lon = 9): LngLat[] {
  return Array.from({ length: km + 1 }, (_, i) => [lon, 42 + i * KM_DEG] as LngLat);
}
const placeAt = (id: string, name: string, km: number, kind: AreaPlace['kind'] = 'village', offLon = 0): AreaPlace => ({
  id,
  name,
  lat: 42 + km * KM_DEG,
  lon: 9 + offLon,
  kind,
  population: null,
  eleM: null,
});

describe('requête et lecture d’un itinéraire OSM', () => {
  it('la référence accepte « GR20 », « GR 20 », « GR-20 »', () => {
    const re = new RegExp(trailRefPattern('GR20')!, 'i');
    for (const ok of ['GR20', 'GR 20', 'gr-20']) expect(re.test(ok)).toBe(true);
    expect(re.test('GR201')).toBe(false);
    expect(trailRefPattern('')).toBeNull();
    expect(trailRefPattern('!!!')).toBeNull();
  });

  it('le nom accepte tiret ou espace, refuse un nom trop court', () => {
    // Le motif est écrit pour Overpass (barres obliques doublées dans la requête) : on le relit tel qu'Overpass le recevra.
    const re = new RegExp(trailNamePattern('Tour du Mont-Blanc')!, 'i');
    expect(re.test('Tour du Mont Blanc')).toBe(true);
    expect(re.test('Tour du Mont-Blanc')).toBe(true);
    expect(trailNamePattern('GR')).toBeNull();
  });

  it('la requête cherche une relation de randonnée, par référence (réseaux iwn ou nwn) ou par nom', () => {
    const q = trailLineQuery({ ref: 'GR20', extent: [8.5, 42.7, 9.6, 41.3] })!;
    expect(q).toContain('rel["route"="hiking"]["network"~"^(iwn|nwn)$"]["ref"~');
    expect(q).toContain('out geom;');
    const byName = trailLineQuery({ name: 'Tour du Mont-Blanc', extent: [6.5, 46.2, 7.2, 45.7] })!;
    expect(byName).toContain('["name"~');
    expect(byName).not.toContain('"network"');
  });

  it('ni référence ni nom, ou une emprise du globe entier : pas de requête', () => {
    expect(trailLineQuery({ extent: [8.5, 42.7, 9.6, 41.3] })).toBeNull();
    expect(trailLineQuery({ ref: 'GR20', extent: [-180, 90, 180, -90] })).toBeNull();
  });

  it('une emprise qui franchit l’antiméridien se lit en deux boîtes', () => {
    const q = trailLineQuery({ name: 'Tour de Taveuni', extent: [179.5, -16.5, -179.5, -17.2] })!;
    expect(q.match(/rel\[/g)).toHaveLength(2);
  });

  it('seules les relations de randonnée avec des tronçons dessinés sont lues, sans variantes', () => {
    const payload = {
      elements: [
        {
          type: 'relation',
          tags: { route: 'hiking', ref: 'GR20', name: 'GR 20' },
          members: [
            { type: 'way', role: '', geometry: [{ lat: 42, lon: 9 }, { lat: 42.1, lon: 9 }] },
            { type: 'way', role: 'alternative', geometry: [{ lat: 42, lon: 9 }, { lat: 42, lon: 9.1 }] },
            { type: 'node', geometry: [] },
            { type: 'way', role: '', geometry: [{ lat: 42.1, lon: 9 }] },
          ],
        },
        { type: 'relation', tags: { route: 'bicycle' }, members: [{ type: 'way', geometry: [{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }] }] },
        { type: 'way', geometry: [] },
      ],
    };
    const rels = parseTrailRelations(payload);
    expect(rels).toHaveLength(1);
    expect(rels[0].ways).toHaveLength(1);
    expect(rels[0].ref).toBe('GR20');
    expect(parseTrailRelations(null)).toEqual([]);
  });
});

describe('chaînage du tracé (sens et ordre quelconques)', () => {
  it('recolle des tronçons mélangés et retournés en une seule ligne continue', () => {
    const full = northLine(9);
    const a = full.slice(0, 4);
    const b = full.slice(3, 7).reverse(); // retourné
    const c = full.slice(6);
    const chained = chainTrail([c, b, a]);
    expect(chained).toHaveLength(10);
    const lats = chained.map((p) => p[1]);
    const asc = [...lats].sort((x, y) => x - y);
    const monotone = JSON.stringify(lats) === JSON.stringify(asc) || JSON.stringify(lats) === JSON.stringify([...asc].reverse());
    expect(monotone).toBe(true);
  });

  it('une variante plus courte est laissée de côté ; une liste vide donne une ligne vide', () => {
    const main = northLine(20);
    const spur: LngLat[] = [main[10], [9.05, main[10][1]]];
    expect(chainTrail([main, spur]).length).toBe(21);
    expect(chainTrail([])).toEqual([]);
  });

  it('une boucle se parcourt sans tourner à l’infini', () => {
    const loop: LngLat[] = [[9, 42], [9.1, 42], [9.1, 42.1], [9, 42.1], [9, 42]];
    expect(chainTrail([loop]).length).toBe(5);
  });

  it('entre deux relations, la plus longue est retenue', () => {
    const picked = pickTrailLine([
      { ref: 'A', name: null, ways: [northLine(5)] },
      { ref: 'B', name: 'Grand', ways: [northLine(30)] },
    ])!;
    expect(picked.ref).toBe('B');
    expect(picked.line).toHaveLength(31);
    expect(pickTrailLine([])).toBeNull();
  });
});

const DAYKM: [number, number, number] = [10, 16, 22];

describe('une marche sur le tracé entier', () => {
  const line = northLine(80);
  const places = [
    placeAt('n1', 'Alpha', 0),
    placeAt('n2', 'Bravo', 21),
    placeAt('n3', 'Charlie', 40, 'hut'),
    placeAt('n4', 'Delta', 61),
    placeAt('n5', 'Echo', 80),
    placeAt('n6', 'Loin', 42, 'village', 0.2), // ~16 km du tracé : jamais choisi
  ];
  const plan = planTrailTrek({ line, places, days: 4, center: { lat: 42.4, lon: 9 }, dayKm: DAYKM, label: 'GR20' })!;

  it('80 km en 4 jours : tout le tracé, un lieu réel par soir, dans l’ordre du tracé', () => {
    expect(plan.whole).toBe(true);
    expect(plan.totalKm).toBeCloseTo(80, 0);
    expect(plan.stages.map((s) => s.name)).toEqual(['Bravo', 'Charlie', 'Delta', 'Echo']);
    expect(plan.stages.every((s) => s.move === 'marche' && s.placeId)).toBe(true);
    expect(plan.start.name).toBe('Alpha');
    expect(plan.sectionKm).toBeCloseTo(80, 0);
  });

  it('chaque jour porte ses kilomètres de tracé et la géométrie de la veille à ce soir', () => {
    const km = plan.stages.map((s) => s.trailKm!);
    expect(km.reduce((t, k) => t + k, 0)).toBeCloseTo(plan.sectionKm, 0);
    expect(plan.stages[0].geometry![0]).toEqual(line[0]);
    expect(plan.stages[1].geometry![0]).toEqual(plan.stages[0].geometry![plan.stages[0].geometry!.length - 1]);
  });

  it('un lieu hors du tracé (plus de 3 km) n’est jamais une étape', () => {
    expect(plan.stages.map((s) => s.name)).not.toContain('Loin');
    expect(TRAIL_OFF_KM).toBe(3);
  });

  it('déterministe : même entrée, même plan, quel que soit l’ordre des lieux', () => {
    const again = planTrailTrek({ line, places: [...places].reverse(), days: 4, center: { lat: 42.4, lon: 9 }, dayKm: DAYKM, label: 'GR20' });
    expect(again).toEqual(plan);
  });
});

describe('un tracé plus long que la marche : un tronçon centré', () => {
  const line = northLine(300);
  const places = Array.from({ length: 31 }, (_, i) => placeAt(`v${i}`, `Village ${i}`, i * 10));
  it('3 jours sur 300 km : 16 km par jour environ autour du lieu visé, pas tout le tracé', () => {
    const plan = planTrailTrek({ line, places, days: 3, center: { lat: 42 + 150 * KM_DEG, lon: 9 }, dayKm: DAYKM, label: 'TMB' })!;
    expect(plan.whole).toBe(false);
    expect(plan.sectionKm).toBeLessThanOrEqual(60);
    expect(plan.sectionKm).toBeGreaterThan(25);
    const lats = plan.stages.map((s) => s.lat);
    expect(lats[0]).toBeGreaterThan(42 + 100 * KM_DEG);
    expect(lats[2]).toBeLessThan(42 + 200 * KM_DEG);
    expect([...lats].sort((a, b) => a - b)).toEqual(lats);
  });
});

describe('rien d’inventé quand aucun lieu n’est à portée du tracé', () => {
  const line = northLine(60);
  it('sans aucun lieu : des points calculés sur le tracé, sans identifiant, avec la note', () => {
    const plan = planTrailTrek({ line, places: [], days: 3, center: { lat: 42.2, lon: 9 }, dayKm: DAYKM, label: 'GR20' })!;
    expect(plan).not.toBeNull();
    expect(plan.start.name).toContain('GR20');
    for (const s of plan.stages) {
      expect(s.placeId).toBeNull();
      expect(s.name).toMatch(/^GR20 · km \d+$/);
      expect(s.note).toMatch(/à choisir sur place/);
      expect(s.note).toMatch(/règles locales à vérifier/);
    }
  });

  it('un nom commun n’est pas un nom de lieu', () => {
    const plan = planTrailTrek({ line, places: [placeAt('g', 'Refuge', 20)], days: 3, center: { lat: 42.2, lon: 9 }, dayKm: DAYKM, label: 'GR20' })!;
    expect(plan.stages.every((s) => s.placeId === null)).toBe(true);
  });

  it('tracé trop court, jours invalides : null', () => {
    expect(planTrailTrek({ line: northLine(2), places: [], days: 2, center: { lat: 42, lon: 9 }, dayKm: DAYKM, label: 'X' })).toBeNull();
    expect(planTrailTrek({ line, places: [], days: 0, center: { lat: 42, lon: 9 }, dayKm: DAYKM, label: 'X' })).toBeNull();
    expect(planTrailTrek({ line: [], places: [], days: 2, center: { lat: 42, lon: 9 }, dayKm: DAYKM, label: 'X' })).toBeNull();
  });
});

describe('zone de recherche des lieux', () => {
  it('couvre le tronçon visé', () => {
    const line = northLine(300);
    const w = trailWindow(line, 3, { lat: 42 + 150 * KM_DEG, lon: 9 }, DAYKM)!;
    expect(w.center.lat).toBeCloseTo(42 + 150 * KM_DEG, 1);
    expect(w.radiusKm).toBeGreaterThanOrEqual(24 + TRAIL_OFF_KM);
    expect(w.radiusKm).toBeLessThanOrEqual(200);
    expect(trailWindow([], 3, { lat: 0, lon: 0 }, DAYKM)).toBeNull();
  });
});
