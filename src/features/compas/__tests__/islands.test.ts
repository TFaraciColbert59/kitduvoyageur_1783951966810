import { describe, expect, it } from 'vitest';
import {
  COAST_TOLERANCE_KM,
  ISLAND_MIN_RELIEF_PLACES,
  isIslandAnchor,
  onIslandContour,
  parseIslandContour,
  isLargeIsland,
  pickIslandZone,
  type IslandContour,
  type IslandZoneInput,
} from '../engine/islands';
import { planItinerary, planningZoneKm, type AreaPlace } from '../engine/itinerary';
import { distanceKm } from '../engine/places';

/**
 * Plan 4.5 : une grande île (Sardaigne, ~180 km de rayon) se randonne à pied dans
 * son massif, pas en voiture d'étape en étape. Lieux simulés, sans réseau : un
 * anneau de bourgs côtiers au ras de l'eau, des villages de l'intérieur, et des
 * massifs que seules leurs altitudes distinguent.
 */

const LAT0 = 40;
const LON0 = 9;
const K = Math.cos((LAT0 * Math.PI) / 180);
const ISLAND = { lat: LAT0, lon: LON0, halfExtentKm: 180 };
const at = (id: string, northKm: number, eastKm: number, eleM: number | null, kind: AreaPlace['kind'] = 'village', population: number | null = null): AreaPlace => ({
  id,
  name: `Village ${id}`,
  lat: LAT0 + northKm / 111,
  lon: LON0 + eastKm / (111 * K),
  kind,
  population,
  eleM,
});

/** Un massif : `n` villages à moins de `spreadKm` d'un point, entre `lowM` et `highM`. */
function massif(prefix: string, northKm: number, eastKm: number, n: number, lowM: number, highM: number, spreadKm = 12): AreaPlace[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    const r = spreadKm * ((i % 3) + 1) / 3;
    return at(`${prefix}${i}`, northKm + r * Math.cos(a), eastKm + r * Math.sin(a), Math.round(lowM + ((highM - lowM) * i) / Math.max(1, n - 1)));
  });
}

/** L'île : un anneau de bourgs au ras de l'eau, des villages d'intérieur de basse altitude, deux massifs. */
function island(): AreaPlace[] {
  const out: AreaPlace[] = [];
  for (let i = 0; i < 40; i += 1) {
    const a = (2 * Math.PI * i) / 40;
    out.push(at(`c${i}`, 150 * Math.cos(a), 150 * Math.sin(a), 5 + (i % 6) * 20, 'town', 5_000 + i * 100));
  }
  for (let i = 0; i < 25; i += 1) out.push(at(`i${i}`, ((i * 37) % 200) - 100, ((i * 53) % 140) - 70, 150 + (i % 5) * 60));
  // Le grand massif, au centre-est : douze villages entre 600 et 1000 m.
  out.push(...massif('g', 5, 25, 12, 600, 1000));
  // Un massif plus petit et moins haut au nord.
  out.push(...massif('n', 110, 20, 5, 500, 650));
  return out;
}

/** Un contour carré de `halfKm` autour d'un point (GeoJSON Polygon, sommets [lon, lat]). */
function square(c: { lat: number; lon: number }, halfKm: number): IslandContour {
  const dLat = halfKm / 111;
  const dLon = halfKm / (111 * Math.cos((c.lat * Math.PI) / 180));
  const ring = [
    [c.lon - dLon, c.lat - dLat],
    [c.lon + dLon, c.lat - dLat],
    [c.lon + dLon, c.lat + dLat],
    [c.lon - dLon, c.lat + dLat],
    [c.lon - dLon, c.lat - dLat],
  ];
  return parseIslandContour({ type: 'Polygon', coordinates: [ring] })!;
}

/** L'île du jeu d'essai : un carré de 200 km autour de son centre (les bourgs côtiers sont à 150 km). */
const ISLAND_CONTOUR = square(ISLAND, 200);

const base = (over: Partial<IslandZoneInput> = {}): IslandZoneInput => ({
  places: island(),
  island: ISLAND,
  contour: ISLAND_CONTOUR,
  activity: 'hiking',
  days: 7,
  ...over,
});

describe('isIslandAnchor', () => {
  it('une île par sa nature (Nominatim, Geoapify) ou par son étiquette OSM (Photon la range sous « other »)', () => {
    expect(isIslandAnchor({ kind: 'island' })).toBe(true);
    expect(isIslandAnchor({ kind: 'islet' })).toBe(true);
    expect(isIslandAnchor({ kind: 'other', osmTag: 'place=island' })).toBe(true);
    expect(isIslandAnchor({ kind: 'other', osmTag: 'place=islet' })).toBe(true);
  });

  it('ni un massif, ni un pays, ni un archipel (le centre d’un archipel est en mer), ni une étiquette absente', () => {
    for (const a of [
      { kind: 'other', osmTag: 'natural=mountain_range' },
      { kind: 'country', osmTag: 'boundary=administrative' },
      { kind: 'other', osmTag: 'place=archipelago' },
      { kind: 'archipelago' },
      { kind: 'other' },
      { kind: null, osmTag: null },
      {},
    ])
      expect(isIslandAnchor(a), JSON.stringify(a)).toBe(false);
  });
});

describe('contour d’une île : lecture et appartenance', () => {
  const ring = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ];

  it('un Polygon ou un MultiPolygon GeoJSON est lu ; le reste ne donne rien', () => {
    expect(parseIslandContour({ type: 'Polygon', coordinates: [ring] })?.polygons).toHaveLength(1);
    expect(
      parseIslandContour({ type: 'MultiPolygon', coordinates: [[ring], [ring.map(([x, y]) => [x + 20, y])]] })?.polygons
    ).toHaveLength(2);
    for (const bad of [
      null,
      undefined,
      'Polygon',
      { type: 'Point', coordinates: [1, 2] },
      { type: 'LineString', coordinates: ring },
      { type: 'Polygon', coordinates: [] },
      { type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] },
      { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 'x'], [0, 0]]] },
      { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 95], [0, 0]]] },
      { type: 'MultiPolygon', coordinates: [] },
    ])
      expect(parseIslandContour(bad), JSON.stringify(bad)).toBeNull();
  });

  it('un contour démesuré (plus de 60 000 sommets) est écarté', () => {
    const big = Array.from({ length: 60_001 }, (_, i) => [(i % 360) - 180, ((i * 7) % 170) - 85]);
    expect(parseIslandContour({ type: 'Polygon', coordinates: [[...big, big[0]]] })).toBeNull();
  });

  it('un lieu est sur l’île s’il est dans un de ses polygones, hors des trous', () => {
    const lake = [
      [4, 4],
      [6, 4],
      [6, 6],
      [4, 6],
      [4, 4],
    ];
    const c = parseIslandContour({ type: 'Polygon', coordinates: [ring, lake] })!;
    expect(onIslandContour(c, { lat: 2, lon: 2 })).toBe(true);
    expect(onIslandContour(c, { lat: 5, lon: 5 })).toBe(false);
    expect(onIslandContour(c, { lat: 12, lon: 5 })).toBe(false);
    expect(onIslandContour(c, { lat: 5, lon: -3 })).toBe(false);
  });

  it('un archipel (MultiPolygon) : chaque terre compte, la mer entre elles non', () => {
    const c = parseIslandContour({ type: 'MultiPolygon', coordinates: [[ring], [ring.map(([x, y]) => [x + 20, y])]] })!;
    expect(onIslandContour(c, { lat: 5, lon: 25 })).toBe(true);
    expect(onIslandContour(c, { lat: 5, lon: 15 })).toBe(false);
  });

  it('un lieu côtier à quelques centaines de mètres du trait reste sur l’île, pas à 2 km', () => {
    const c = parseIslandContour({ type: 'Polygon', coordinates: [ring] })!;
    const metersToDeg = (m: number) => m / 111_000;
    expect(onIslandContour(c, { lat: 5, lon: 10 + metersToDeg(300) })).toBe(true);
    expect(onIslandContour(c, { lat: 5, lon: 10 + metersToDeg((COAST_TOLERANCE_KM + 1.5) * 1000) })).toBe(false);
  });

  it('l’antiméridien ne coupe pas une île (Fidji, Taveuni) : appartenance correcte des deux côtés', () => {
    const taveuni = [
      [179.8, -16.7],
      [-179.8, -16.7],
      [-179.8, -17.1],
      [179.8, -17.1],
      [179.8, -16.7],
    ];
    const c = parseIslandContour({ type: 'Polygon', coordinates: [taveuni] })!;
    expect(onIslandContour(c, { lat: -16.9, lon: 179.95 })).toBe(true);
    expect(onIslandContour(c, { lat: -16.9, lon: -179.95 })).toBe(true);
    expect(onIslandContour(c, { lat: -16.9, lon: 178 })).toBe(false);
    expect(onIslandContour(c, { lat: -16.9, lon: -178 })).toBe(false);
  });
});

describe('pickIslandZone — le massif d’une grande île, à pied', () => {
  it('une île de 180 km de rayon : une zone de 48 km au plus, centrée sur le grand massif', () => {
    const zone = pickIslandZone(base())!;
    expect(zone).not.toBeNull();
    expect(zone.why).toBe('altitude');
    expect(zone.radiusKm).toBeLessThanOrEqual(48);
    // Le rayon est celui que le planificateur donne à un lieu naturel sans emprise : le reste du calcul ne change pas.
    expect(zone.radiusKm).toBe(planningZoneKm({ activity: 'hiking', days: 7, halfExtentKm: null, settlement: false }));
    // Le centre est au cœur du grand massif, pas au centre géométrique de l'île ni sur le massif du nord.
    const grand = { lat: LAT0 + 5 / 111, lon: LON0 + 25 / (111 * K) };
    expect(distanceKm(zone.center, grand)).toBeLessThan(10);
    expect(distanceKm(zone.center, ISLAND)).toBeGreaterThan(15);
    expect(zone.highestM).toBe(1000);
    expect(zone.around).toMatch(/^Village g/);
    // Les villages du massif sont dans la zone, l'anneau côtier à 150 km n'y est pas.
    expect(zone.places).toBeGreaterThanOrEqual(12);
  });

  it('plusieurs lieux hauts ensemble font un massif : deux villages isolés, très hauts, n’en font pas un', () => {
    const lonely = [at('x1', -110, -100, 1500), at('x2', -118, -95, 1450)];
    const zone = pickIslandZone(base({ places: [...island(), ...lonely] }))!;
    expect(distanceKm(zone.center, { lat: LAT0 + 5 / 111, lon: LON0 + 25 / (111 * K) })).toBeLessThan(10);
  });

  it('la zone suit la durée : un week-end est plus étroit qu’une semaine, jamais plus de 48 km', () => {
    const weekend = pickIslandZone(base({ days: 3 }))!;
    const trek = pickIslandZone(base({ days: 14 }))!;
    expect(weekend.radiusKm).toBeLessThan(trek.radiusKm);
    expect(trek.radiusKm).toBeLessThanOrEqual(48);
  });

  it('même entrée → même zone, quel que soit l’ordre des lieux', () => {
    const a = pickIslandZone(base())!;
    const b = pickIslandZone(base({ places: [...island()].reverse() }))!;
    expect(b).toEqual(a);
  });

  it('une île qui tient dans sa zone n’a pas de massif à choisir : null (le centre convient)', () => {
    expect(pickIslandZone(base({ island: { ...ISLAND, halfExtentKm: 30 } }))).toBeNull();
    // À la borne : l'île n'est pas plus grande que la zone.
    const radius = planningZoneKm({ activity: 'hiking', days: 7, halfExtentKm: null, settlement: false });
    expect(pickIslandZone(base({ island: { ...ISLAND, halfExtentKm: radius } }))).toBeNull();
    expect(pickIslandZone(base({ island: { ...ISLAND, halfExtentKm: radius + 1 } }))).not.toBeNull();
  });

  it('sans relief connu on ne choisit rien : null, jamais un massif deviné', () => {
    const flat = island().map((p) => ({ ...p, eleM: null }));
    expect(pickIslandZone(base({ places: flat }))).toBeNull();
    // Pas assez d'altitudes pour parler du relief de l'île.
    const few = island().map((p, i) => (i < ISLAND_MIN_RELIEF_PLACES - 1 ? p : { ...p, eleM: null }));
    expect(pickIslandZone(base({ places: few }))).toBeNull();
    const enough = island().map((p, i) => (i < ISLAND_MIN_RELIEF_PLACES ? p : { ...p, eleM: null }));
    expect(pickIslandZone(base({ places: enough }))).not.toBeNull();
  });

  it('sans contour de l’île on ne choisit rien : null (jamais un lieu du continent pris pour un lieu de l’île)', () => {
    expect(pickIslandZone(base({ contour: null }))).toBeNull();
    // Même avec un lieu dit : sans contour, on ne sait pas s'il est sur l'île.
    expect(pickIslandZone(base({ contour: null, near: { name: 'Supramonte', lat: LAT0, lon: LON0 } }))).toBeNull();
  });

  it('les lieux sans altitude ne comptent pas, ceux d’autres terres non plus (continent à 400 km, très haut)', () => {
    const mainland = massif('m', 400, 0, 8, 2000, 2800);
    const zone = pickIslandZone(base({ places: [...island(), ...mainland] }))!;
    expect(distanceKm(zone.center, ISLAND)).toBeLessThan(80);
    expect(zone.highestM).toBe(1000);
  });

  it('refuges et campings ne disent pas où est le massif : seuls les lieux habités comptent', () => {
    const huts = massif('h', -110, -100, 10, 2000, 2500).map((p) => ({ ...p, kind: 'hut' as const }));
    const zone = pickIslandZone(base({ places: [...island(), ...huts] }))!;
    expect(distanceKm(zone.center, { lat: LAT0 + 5 / 111, lon: LON0 + 25 / (111 * K) })).toBeLessThan(10);
  });

  it('un lieu dit par la personne sur l’île : la zone s’y centre, même sans altitudes', () => {
    const flat = island().map((p) => ({ ...p, eleM: null }));
    const near = { name: 'Supramonte', lat: LAT0 + 60 / 111, lon: LON0 - 40 / (111 * K) };
    const zone = pickIslandZone(base({ places: flat, near }))!;
    expect(zone.why).toBe('lieu dit');
    expect(zone.center).toEqual({ lat: near.lat, lon: near.lon });
    expect(zone.around).toBe('Supramonte');
    expect(zone.radiusKm).toBeLessThanOrEqual(48);
  });

  it('un lieu dit hors de l’île (continent) est ignoré : on choisit le massif', () => {
    const zone = pickIslandZone(base({ near: { name: 'Ailleurs', lat: LAT0 + 5, lon: LON0 } }))!;
    expect(zone.why).toBe('altitude');
  });

  it('en montagne (escalade, alpinisme), la zone est celle d’une base : ≤ 40 km, jamais l’île entière', () => {
    const zone = pickIslandZone(base({ activity: 'climbing', days: 5 }))!;
    expect(zone.radiusKm).toBeLessThanOrEqual(40);
    expect(distanceKm(zone.center, { lat: LAT0 + 5 / 111, lon: LON0 + 25 / (111 * K) })).toBeLessThan(10);
  });

  it('Sicile : le volcan et ses villages hauts, pas la plaine du centre de l’île', () => {
    // Centre (37.5 N, 14 E), 130 km de rayon ; l'Etna à l'est, des villages à 600-950 m.
    const c = { lat: 37.5, lon: 14 };
    const k = Math.cos((c.lat * Math.PI) / 180);
    const sp = (id: string, n: number, e: number, ele: number): AreaPlace => ({ id, name: id, lat: c.lat + n / 111, lon: c.lon + e / (111 * k), kind: 'village', population: null, eleM: ele });
    const places: AreaPlace[] = [];
    for (let i = 0; i < 30; i += 1) places.push(sp(`p${i}`, ((i * 29) % 160) - 80, ((i * 41) % 240) - 120, 100 + (i % 7) * 40));
    for (let i = 0; i < 9; i += 1) places.push(sp(`etna${i}`, 5 + (i % 3) * 6, 100 + (i % 3) * 7, 600 + i * 45));
    const zone = pickIslandZone({ places, island: { ...c, halfExtentKm: 130 }, contour: square(c, 160), activity: 'hiking', days: 6 })!;
    expect(distanceKm(zone.center, { lat: c.lat + 11 / 111, lon: c.lon + 107 / (111 * k) })).toBeLessThan(12);
    expect(zone.around).toMatch(/^etna/);
  });
});

describe('planItinerary dans la zone choisie — à pied, jamais en voiture', () => {
  it('une randonnée de 7 jours dans le massif choisi : des lieux réels de la zone, des étapes à pied', () => {
    const zone = pickIslandZone(base())!;
    const inZone = island().filter((p) => distanceKm(zone.center, p) <= zone.radiusKm * 1.15);
    const plan = planItinerary({ days: 7, activity: 'hiking', center: zone.center, radiusKm: zone.radiusKm, places: inZone, natural: true });
    expect(plan).not.toBeNull();
    expect(plan!.stages).toHaveLength(7);
    const known = new Set(island().map((p) => p.id));
    for (const st of plan!.stages) expect(known.has(st.placeId!)).toBe(true);
    // À pied : aucun déplacement en voiture, et aucune étape hors de la zone.
    expect(plan!.stages.some((s) => s.move === 'voiture')).toBe(false);
    for (const st of plan!.stages) expect(distanceKm(zone.center, st)).toBeLessThanOrEqual(zone.radiusKm * 1.15);
  });
});

/* =============================================================================
   Près du continent du même pays : l'emprise de l'île englobe des lieux qui n'y sont pas
   ============================================================================= */

const vp = (id: string, lat: number, lon: number, eleM: number, kind: AreaPlace['kind'] = 'village'): AreaPlace => ({
  id,
  name: id,
  lat,
  lon,
  kind,
  population: null,
  eleM,
});
/** `n` villages autour d'un point (à moins de `spreadKm`), d'altitude croissante de `lowM` à `highM`. */
function cluster(prefix: string, c: { lat: number; lon: number }, n: number, lowM: number, highM: number, spreadKm = 9): AreaPlace[] {
  const k = Math.cos((c.lat * Math.PI) / 180);
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    const r = (spreadKm * ((i % 3) + 1)) / 3;
    return vp(`${prefix}${i}`, c.lat + (r * Math.cos(a)) / 111, c.lon + (r * Math.sin(a)) / (111 * k), Math.round(lowM + ((highM - lowM) * i) / Math.max(1, n - 1)));
  });
}
/** Le cercle que l'on prenait pour l'île avant le contour : centre, demi-diagonale de l'emprise + 10 %. */
const circleOf = (c: { lat: number; lon: number; halfExtentKm: number }): IslandContour => {
  const r = c.halfExtentKm * 1.1;
  const ring = Array.from({ length: 73 }, (_, i) => {
    const a = (2 * Math.PI * (i % 72)) / 72;
    return [c.lon + (r * Math.sin(a)) / (111 * Math.cos((c.lat * Math.PI) / 180)), c.lat + (r * Math.cos(a)) / 111];
  });
  return parseIslandContour({ type: 'Polygon', coordinates: [ring] })!;
};
/** Demi-diagonale (km) d'une emprise, comme le serveur la calcule. */
const halfDiagonalKm = (e: [number, number, number, number]) => distanceKm({ lat: e[1], lon: e[0] }, { lat: e[3], lon: e[2] }) / 2;

describe('pickIslandZone — une île proche du continent du même pays : le contour, pas la boîte', () => {
  // Eubée (Grèce) : une bande NO-SE le long de la Béotie et de l'Attique, dans une emprise de 200 km de diagonale.
  const EUBEE = parseIslandContour({
    type: 'Polygon',
    coordinates: [[[23.0, 39.0], [23.3, 39.2], [23.8, 38.95], [24.1, 38.7], [24.6, 38.05], [24.35, 37.95], [24.0, 38.15], [23.7, 38.35], [23.5, 38.5], [23.2, 38.75], [23.0, 39.0]]],
  })!;
  const EUBEE_EXTENT: [number, number, number, number] = [23.0, 39.2, 24.6, 37.95];
  const EUBEE_CENTER = { lat: 38.58, lon: 23.8 };
  const DIRFYS = { lat: 38.62, lon: 23.85 };
  const BEOTIE = { lat: 38.28, lon: 23.55 };

  function eubee(): AreaPlace[] {
    const out: AreaPlace[] = [];
    // Bourgs côtiers de l'île et villages bas de l'intérieur (Chalcis, Eretria, Karystos…).
    for (let i = 0; i < 16; i += 1) {
      const t = i / 15;
      out.push(vp(`ev-c${i}`, 39.0 - t * 1.0, 23.1 + t * 1.3, 5 + (i % 5) * 20, 'town'));
    }
    for (let i = 0; i < 8; i += 1) out.push(vp(`ev-i${i}`, 38.8 - i * 0.07, 23.45 + i * 0.1, 120 + i * 30));
    // Le massif de l'île (Dirfys) : des villages entre 550 et 900 m.
    out.push(...cluster('ev-dirfys', DIRFYS, 12, 550, 900));
    // Le continent, dans la même emprise rectangulaire : la Béotie et ses villages de montagne, plus hauts.
    out.push(...cluster('beotie', BEOTIE, 12, 800, 1350));
    return out;
  }
  const island = { ...EUBEE_CENTER, halfExtentKm: halfDiagonalKm(EUBEE_EXTENT) };

  it('le jeu d’essai est réaliste : la Béotie est dans le cercle de l’île, hors de son contour', () => {
    expect(onIslandContour(circleOf(island), BEOTIE)).toBe(true);
    expect(onIslandContour(EUBEE, BEOTIE)).toBe(false);
    expect(onIslandContour(EUBEE, DIRFYS)).toBe(true);
    expect(isLargeIsland(island.halfExtentKm, 'hiking', 6)).toBe(true);
  });

  it('avec le contour : le massif de l’île (Dirfys), jamais les villages hauts de Béotie', () => {
    const zone = pickIslandZone({ places: eubee(), island, contour: EUBEE, activity: 'hiking', days: 6 })!;
    expect(zone).not.toBeNull();
    expect(distanceKm(zone.center, DIRFYS)).toBeLessThan(10);
    expect(distanceKm(zone.center, BEOTIE)).toBeGreaterThan(30);
    expect(zone.highestM).toBe(900);
    expect(zone.around).toMatch(/^ev-dirfys/);
    expect(onIslandContour(EUBEE, zone.center)).toBe(true);
  });

  it('contre-épreuve : le seul cercle de l’île choisirait la Béotie, hors de l’île', () => {
    const zone = pickIslandZone({ places: eubee(), island, contour: circleOf(island), activity: 'hiking', days: 6 })!;
    expect(distanceKm(zone.center, BEOTIE)).toBeLessThan(10);
    expect(onIslandContour(EUBEE, zone.center)).toBe(false);
  });

  it('un lieu dit homonyme du continent (Béotie) est ignoré ; le même lieu sur l’île centre la zone', () => {
    const ailleurs = { name: 'Profitis Ilias', ...BEOTIE };
    const zone = pickIslandZone({ places: eubee(), island, contour: EUBEE, activity: 'hiking', days: 6, near: ailleurs })!;
    expect(zone.why).toBe('altitude');
    expect(distanceKm(zone.center, DIRFYS)).toBeLessThan(10);
    const sur = { name: 'Profitis Ilias', lat: 38.5, lon: 23.55 };
    expect(onIslandContour(EUBEE, sur)).toBe(true);
    const dit = pickIslandZone({ places: eubee(), island, contour: EUBEE, activity: 'hiking', days: 6, near: sur })!;
    expect(dit.why).toBe('lieu dit');
    expect(dit.center).toEqual({ lat: sur.lat, lon: sur.lon });
  });

  // Sicile : la Calabre (Aspromonte, jusqu'à 1 450 m) est de l'autre côté d'un détroit de 3 km, à portée du cercle de l'île.
  const SICILE = parseIslandContour({
    type: 'Polygon',
    coordinates: [[[12.45, 37.95], [13.3, 38.2], [14.3, 38.05], [15.6, 38.3], [15.65, 38.2], [15.1, 37.4], [15.3, 37.0], [15.1, 36.65], [14.4, 36.8], [13.6, 37.25], [12.6, 37.55], [12.45, 37.95]]],
  })!;
  const SICILE_EXTENT: [number, number, number, number] = [12.45, 38.3, 15.65, 36.65];
  const SICILE_CENTER = { lat: 37.55, lon: 14.0 };
  const ETNA = { lat: 37.72, lon: 15.0 };
  const ASPROMONTE = { lat: 38.15, lon: 15.87 };

  function sicile(): AreaPlace[] {
    const out: AreaPlace[] = [];
    for (let i = 0; i < 24; i += 1) out.push(vp(`si-p${i}`, 37.2 + ((i * 29) % 70) / 100, 13.0 + ((i * 41) % 150) / 100, 80 + (i % 7) * 45));
    out.push(...cluster('etna', ETNA, 9, 600, 900, 8));
    out.push(...cluster('aspromonte', ASPROMONTE, 10, 1000, 1450, 8));
    return out;
  }
  const sicileIsland = { ...SICILE_CENTER, halfExtentKm: halfDiagonalKm(SICILE_EXTENT) };

  it('Sicile / Calabre : l’Aspromonte est dans le cercle de l’île, hors de son contour', () => {
    expect(distanceKm(sicileIsland, ASPROMONTE)).toBeLessThanOrEqual(sicileIsland.halfExtentKm * 1.1);
    expect(onIslandContour(SICILE, ASPROMONTE)).toBe(false);
    expect(onIslandContour(SICILE, ETNA)).toBe(true);
  });

  it('Sicile avec son contour : l’Etna, jamais la Calabre', () => {
    const zone = pickIslandZone({ places: sicile(), island: sicileIsland, contour: SICILE, activity: 'hiking', days: 6 })!;
    expect(distanceKm(zone.center, ETNA)).toBeLessThan(10);
    expect(zone.highestM).toBe(900);
    expect(zone.around).toMatch(/^etna/);
  });

  it('contre-épreuve : le seul cercle de l’île choisirait l’Aspromonte, en Calabre', () => {
    const zone = pickIslandZone({ places: sicile(), island: sicileIsland, contour: circleOf(sicileIsland), activity: 'hiking', days: 6 })!;
    expect(distanceKm(zone.center, ASPROMONTE)).toBeLessThan(10);
  });
});
