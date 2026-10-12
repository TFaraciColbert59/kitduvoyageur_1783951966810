import { describe, expect, it } from 'vitest';
import { ISLAND_MIN_RELIEF_PLACES, isIslandAnchor, pickIslandZone, type IslandZoneInput } from '../engine/islands';
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

const base = (over: Partial<IslandZoneInput> = {}): IslandZoneInput => ({ places: island(), island: ISLAND, activity: 'hiking', days: 7, ...over });

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
    const zone = pickIslandZone({ places, island: { ...c, halfExtentKm: 130 }, activity: 'hiking', days: 6 })!;
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
