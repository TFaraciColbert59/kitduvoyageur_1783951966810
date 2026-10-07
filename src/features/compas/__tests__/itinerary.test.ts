import { describe, expect, it } from 'vitest';
import { distanceKm } from '../engine/places';
import {
  areaTiles,
  buildAreaQuery,
  keepAdminArea,
  keepHighlands,
  keepHomeCountry,
  parsePhotonArea,
  photonIncludes,
  mainAxis,
  parseAreaPlaces,
  planItinerary,
  planningZoneKm,
  shapeFor,
  type AreaPlace,
  type AreaPlaceKind,
} from '../engine/itinerary';

/** Grille de lieux réels simulés : `cols` × `rows`, pas en km, autour de (lat0, lon0). */
function grid(opts: { lat0: number; lon0: number; cols: number; rows: number; stepKm: number; kind?: AreaPlaceKind; ele?: (c: number, r: number) => number | null }): AreaPlace[] {
  const out: AreaPlace[] = [];
  const k = Math.cos((opts.lat0 * Math.PI) / 180);
  for (let c = 0; c < opts.cols; c += 1)
    for (let r = 0; r < opts.rows; r += 1)
      out.push({
        id: `n${c * 100 + r}`,
        name: `Lieu ${c}-${r}`,
        lat: opts.lat0 + ((r - (opts.rows - 1) / 2) * opts.stepKm) / 111,
        lon: opts.lon0 + ((c - (opts.cols - 1) / 2) * opts.stepKm) / (111 * k),
        kind: opts.kind ?? 'village',
        population: null,
        eleM: opts.ele ? opts.ele(c, r) : null,
      });
  return out;
}

const legs = (st: Array<{ lat: number; lon: number }>) => st.slice(1).map((s, i) => distanceKm(st[i], s));

describe('planItinerary — trek en traversée', () => {
  const places = grid({ lat0: 42.8, lon0: 0.5, cols: 16, rows: 4, stepKm: 5 });
  const input = { days: 7, activity: 'trekking', center: { lat: 42.8, lon: 0.5 }, radiusKm: 45, places, shape: 'traverse' as const };

  it('un lieu réel par soir, qui avance d’ouest en est, à distance d’une journée à pied', () => {
    const plan = planItinerary(input)!;
    expect(plan.shape).toBe('traverse');
    expect(plan.stages).toHaveLength(7);
    expect(plan.distinct).toBe(7);
    const ids = new Set(places.map((p) => p.id));
    for (const st of plan.stages) expect(ids.has(st.placeId!)).toBe(true);
    for (let i = 1; i < plan.stages.length; i += 1) expect(plan.stages[i].lon).toBeGreaterThan(plan.stages[i - 1].lon);
    for (const km of legs(plan.stages)) {
      expect(km).toBeGreaterThanOrEqual(6);
      expect(km).toBeLessThanOrEqual(15);
    }
    expect(plan.stages.slice(1).every((s) => s.move === 'marche')).toBe(true);
  });

  it('même entrée → même itinéraire (déterministe, ordre des lieux indifférent)', () => {
    const a = planItinerary(input)!;
    const b = planItinerary({ ...input, places: [...places].reverse() })!;
    expect(b.stages).toEqual(a.stages);
  });

  it('passe par une étape voulue', () => {
    const want = places.find((p) => p.name === 'Lieu 8-0')!;
    const plan = planItinerary({ ...input, waypoints: [{ name: 'Étape voulue', lat: want.lat, lon: want.lon }] })!;
    expect(plan.stages.some((s) => distanceKm(s, want) < 3)).toBe(true);
  });
});

describe('planItinerary — boucle', () => {
  it('revient au départ le dernier soir', () => {
    const places = grid({ lat0: 45.9, lon0: 6.9, cols: 9, rows: 9, stepKm: 5 });
    const plan = planItinerary({ days: 6, activity: 'hiking', center: { lat: 45.9, lon: 6.9 }, radiusKm: 25, places, shape: 'loop' })!;
    expect(plan.shape).toBe('loop');
    const last = plan.stages[plan.stages.length - 1];
    expect(plan.start).not.toBeNull();
    expect(distanceKm(last, plan.start!)).toBeLessThan(0.01);
    expect(plan.stages[0].note).toContain('Départ de');
    expect(plan.distinct).toBeGreaterThanOrEqual(4);
  });
});

describe('planItinerary — base fixe', () => {
  it('ski : une seule base, près du centre', () => {
    const places = grid({ lat0: 45.3, lon0: 6.6, cols: 5, rows: 5, stepKm: 4 });
    const plan = planItinerary({ days: 6, activity: 'ski', center: { lat: 45.3, lon: 6.6 }, radiusKm: 15, places })!;
    expect(plan.shape).toBe('base');
    expect(plan.distinct).toBe(1);
    expect(distanceKm(plan.stages[0], { lat: 45.3, lon: 6.6 })).toBeLessThan(3);
    expect(plan.stages.every((s) => s.move === 'aucun')).toBe(true);
  });

  it('séjour culturel de 12 jours dans un grand pays : plusieurs bases espacées, importantes', () => {
    const places = grid({ lat0: 16, lon0: 106, cols: 8, rows: 8, stepKm: 80, kind: 'town' });
    places[0] = { ...places[0], kind: 'city', population: 8_000_000 };
    const plan = planItinerary({ days: 12, activity: 'cultural', center: { lat: 16, lon: 106 }, radiusKm: 400, places })!;
    expect(plan.distinct).toBe(4);
    expect(plan.stages.some((s) => s.placeId === places[0].id)).toBe(true);
    // Trois jours par base, changement en véhicule.
    expect(plan.stages.filter((s) => s.move === 'voiture')).toHaveLength(3);
  });
});

describe('planItinerary — altitude', () => {
  it('une journée d’acclimatation après trois nuits au-dessus de 3 000 m', () => {
    const places = grid({ lat0: 28.3, lon0: 84, cols: 14, rows: 3, stepKm: 5, kind: 'hamlet', ele: (c) => 2800 + c * 120 });
    const plan = planItinerary({ days: 10, activity: 'trekking', center: { lat: 28.3, lon: 84 }, radiusKm: 40, places, shape: 'traverse' })!;
    expect(plan.stages.some((s) => /acclimatation/.test(s.note ?? ''))).toBe(true);
  });
});

describe('planItinerary — repli', () => {
  it('null sans lieux réels (l’appelant se replie, jamais d’invention)', () => {
    expect(planItinerary({ days: 5, activity: 'trekking', center: { lat: 0, lon: 0 }, radiusKm: 30, places: [] })).toBeNull();
    expect(planItinerary({ days: 0, activity: 'ski', center: { lat: 0, lon: 0 }, radiusKm: 30, places: [] })).toBeNull();
  });
});

describe('shapeFor', () => {
  it('base pour les activités sur place, traversée si la zone est longue, sinon boucle', () => {
    expect(shapeFor({ activity: 'beach', days: 7, radiusKm: 30 })).toBe('base');
    expect(shapeFor({ activity: 'trekking', days: 7, radiusKm: 60 })).toBe('traverse');
    expect(shapeFor({ activity: 'trekking', days: 7, radiusKm: 8 })).toBe('loop');
    expect(shapeFor({ activity: 'trekking', days: 7, radiusKm: 60, shape: 'loop' })).toBe('loop');
  });
});

describe('mainAxis', () => {
  it('donne la direction de la zone, sens ouest → est', () => {
    const a = mainAxis([{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 2 }]);
    expect(a.dx).toBeCloseTo(1);
  });
});

describe('Overpass', () => {
  it('requête par emprise ou par rayon, natures selon la taille de la zone', () => {
    const small = buildAreaQuery({ center: { lat: 45, lon: 6 }, radiusKm: 30, activity: 'trekking' });
    expect(small).toContain('around:30000,45.0000,6.0000');
    expect(small).toContain('alpine_hut');
    const country = buildAreaQuery({ center: { lat: 16, lon: 106 }, radiusKm: 800, extent: [102, 23.4, 109.5, 8.5], activity: 'roadtrip' });
    expect(country).toContain('(8.500,102.000,23.400,109.500)');
    expect(country).toContain('^(city|town)$');
    expect(country).not.toContain('hut');
  });

  it('lit les lieux (nom français d’abord, population, altitude), ignore le reste', () => {
    const places = parseAreaPlaces({
      elements: [
        { type: 'node', id: 2, lat: 27.7, lon: 85.3, tags: { place: 'city', name: 'काठमाडौं', 'name:fr': 'Katmandou', population: '1 442 271' } },
        { type: 'way', id: 9, center: { lat: 28.1, lon: 84.1 }, tags: { tourism: 'alpine_hut', name: 'Refuge X', ele: '4130' } },
        { type: 'node', id: 3, lat: 1, lon: 1, tags: { place: 'locality', name: 'Lieu-dit' } },
        { type: 'node', id: 4, lat: 1, lon: 1, tags: { place: 'village' } },
      ],
    });
    expect(places).toEqual([
      { id: 'n2', name: 'Katmandou', lat: 27.7, lon: 85.3, kind: 'city', population: 1442271, eleM: null },
      { id: 'w9', name: 'Refuge X', lat: 28.1, lon: 84.1, kind: 'hut', population: null, eleM: 4130 },
    ]);
    expect(parseAreaPlaces(null)).toEqual([]);
  });
});

describe('planningZoneKm — la zone où tient le voyage', () => {
  it('week-end vélo autour d’un lac : l’emprise du lac + une demi-étape, pas 60 km', () => {
    const z = planningZoneKm({ activity: 'cycling', days: 2, halfExtentKm: 8, settlement: false });
    expect(z).toBeGreaterThanOrEqual(30);
    expect(z).toBeLessThan(45);
  });
  it('trek de 5 jours dans un massif sans emprise : ~30 km', () => {
    const z = planningZoneKm({ activity: 'trekking', days: 5, halfExtentKm: null, settlement: false });
    expect(z).toBeGreaterThanOrEqual(25);
    expect(z).toBeLessThanOrEqual(35);
  });
  it('bornée par le moyen de progression', () => {
    expect(planningZoneKm({ activity: 'trekking', days: 20, halfExtentKm: 300, settlement: false })).toBe(45);
    expect(planningZoneKm({ activity: 'roadtrip', days: 7, halfExtentKm: 170, settlement: false })).toBeLessThanOrEqual(250);
  });
  it('lieu naturel : boucle par défaut (« autour du lac »)', () => {
    expect(shapeFor({ activity: 'cycling', days: 2, radiusKm: 35, natural: true })).toBe('loop');
    expect(shapeFor({ activity: 'cycling', days: 2, radiusKm: 35, natural: true, shape: 'traverse' })).toBe('traverse');
  });
  it('grande zone : pas de hameaux ni de campings dans la requête', () => {
    expect(buildAreaQuery({ center: { lat: 45, lon: 5.4 }, radiusKm: 33, activity: 'trekking' })).not.toContain('hamlet');
    expect(buildAreaQuery({ center: { lat: 45, lon: 5.4 }, radiusKm: 20, activity: 'trekking' })).toContain('hamlet');
  });
});

describe('planningZoneKm — séjour sur une base', () => {
  it('alpinisme au pied d’un sommet : une base à moins de 40 km, jamais 190', () => {
    expect(planningZoneKm({ activity: 'mountaineering', days: 3, halfExtentKm: 0.01, settlement: false })).toBe(12);
    expect(planningZoneKm({ activity: 'ski', days: 6, halfExtentKm: null, settlement: false })).toBe(35);
    expect(planningZoneKm({ activity: 'citytrip', days: 3, halfExtentKm: 60, settlement: true })).toBe(40);
  });
});

describe('Photon — lieux d’une emprise', () => {
  it('quatre tuiles au-delà de 25 km, une en deçà', () => {
    expect(areaTiles({ lat: 45, lon: 5.5 }, 20)).toHaveLength(1);
    const t = areaTiles({ lat: 45, lon: 5.5 }, 40);
    expect(t).toHaveLength(4);
    expect(t[0][0]).toBeLessThan(5.5);
    expect(t[3][3]).toBeGreaterThan(45);
  });
  it('catégories : lieux habités et abris séparés', () => {
    expect(photonIncludes(['town', 'village', 'hut'])).toEqual({
      places: 'osm.place.town,osm.place.village',
      shelters: 'osm.tourism.alpine_hut,osm.tourism.wilderness_hut',
    });
    expect(photonIncludes(['city', 'town']).shelters).toBeNull();
  });
  it('lit les lieux, le rang donne un ordre de grandeur, le pays est gardé', () => {
    const places = parsePhotonArea({
      features: [
        { geometry: { coordinates: [5.55, 45.07] }, properties: { osm_type: 'R', osm_id: 225502, osm_key: 'place', osm_value: 'village', name: 'Villard-de-Lans', countrycode: 'FR' } },
        { geometry: { coordinates: [5.6, 45.1] }, properties: { osm_type: 'N', osm_id: 9, osm_key: 'tourism', osm_value: 'alpine_hut', name: 'Refuge X', countrycode: 'FR' } },
        { geometry: { coordinates: [5.6, 45.1] }, properties: { osm_type: 'N', osm_id: 10, osm_key: 'place', osm_value: 'locality', name: 'Lieu-dit' } },
      ],
    });
    expect(places.map((p) => [p.id, p.kind, p.countryCode])).toEqual([
      ['r225502', 'village', 'FR'],
      ['n9', 'hut', 'FR'],
    ]);
    expect(places[0].population).toBeGreaterThan(places[1].population!);
  });
  it('garde le pays de la destination quand la zone y est presque entière', () => {
    const mk = (id: string, cc: string): AreaPlace => ({ id, name: id, lat: 0, lon: 0, kind: 'village', population: null, eleM: null, countryCode: cc });
    const jura = [...Array.from({ length: 9 }, (_, i) => mk(`f${i}`, 'FR')), mk('morges', 'CH')];
    expect(keepHomeCountry(jura, 'FR').some((p) => p.id === 'morges')).toBe(false);
    const pyr = [...Array.from({ length: 5 }, (_, i) => mk(`f${i}`, 'FR')), ...Array.from({ length: 5 }, (_, i) => mk(`e${i}`, 'ES'))];
    expect(keepHomeCountry(pyr, 'FR')).toHaveLength(10);
  });
});

describe('zone : région administrative et massif', () => {
  const mk = (id: string, extra: Partial<AreaPlace>): AreaPlace => ({ id, name: id, lat: 0, lon: 0, kind: 'village', population: null, eleM: null, ...extra });
  it('« Bretagne » garde les lieux de la région Bretagne', () => {
    const list = [...Array.from({ length: 6 }, (_, i) => mk(`b${i}`, { region: 'Bretagne' })), mk('saintlo', { region: 'Normandie' })];
    expect(keepAdminArea(list, 'Bretagne', 'region').map((p) => p.id)).not.toContain('saintlo');
    expect(keepAdminArea(list.slice(5), 'Bretagne', 'region')).toHaveLength(2);
  });
  it('à pied, la moitié haute quand plaine et montagne se mêlent', () => {
    const list = Array.from({ length: 20 }, (_, i) => mk(`v${i}`, { eleM: i < 12 ? 300 : 900 + i * 20 }));
    const high = keepHighlands(list);
    expect(high.every((p) => (p.eleM ?? 0) >= 300)).toBe(true);
    expect(high.length).toBeLessThan(list.length);
    const flat = Array.from({ length: 20 }, (_, i) => mk(`f${i}`, { eleM: 200 + i * 10 }));
    expect(keepHighlands(flat)).toHaveLength(20);
  });
});

describe('séjour sans activité dite', () => {
  it('« 3 jours à Rome » (mixed) : base fixe, jamais une traversée de banlieue', () => {
    expect(shapeFor({ activity: 'mixed', days: 3, radiusKm: 25 })).toBe('base');
  });
});
