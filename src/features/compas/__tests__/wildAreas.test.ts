import { describe, expect, it } from 'vitest';
import type { NightPlan } from '../engine/autofill';
import {
  BIVOUAC_PREFIX,
  areaKinds,
  buildAreaQuery,
  isBivouacStage,
  isWildZone,
  markComputedBivouacs,
  planItinerary,
  type AreaPlace,
} from '../engine/itinerary';
import { distanceKm } from '../engine/places';

/**
 * Plan 4.5 : espaces sauvages, densité de lieux adaptée (refuges, campings,
 * bivouac annoncé). Une zone où les lieux habités sont à plusieurs journées de
 * marche les uns des autres n'est pas un itinéraire de « journées sur place ».
 * Sans réseau : lieux simulés, jamais de lieu inventé (un bivouac est un point
 * CALCULÉ entre deux lieux réels, dit comme tel).
 */

const LAT = 64.9;
const K = Math.cos((LAT * Math.PI) / 180);
/** Un lieu à `km` kilomètres à l'est du point d'origine. */
const at = (id: string, name: string, km: number, kind: AreaPlace['kind'] = 'village', population: number | null = 120): AreaPlace => ({
  id,
  name,
  lat: LAT,
  lon: 17 + km / (111 * K),
  kind,
  population,
  eleM: null,
});

const CAMP_NAMES = ['Lägerplats A', 'Lägerplats B', 'Lägerplats C', 'Lägerplats D', 'Lägerplats E', 'Lägerplats F'];
const base = { activity: 'trekking', center: { lat: LAT, lon: 17 + 38 / (111 * K) }, radiusKm: 45, shape: 'traverse' as const };
const legs = (st: Array<{ lat: number; lon: number }>) => st.slice(1).map((s, i) => distanceKm(st[i], s));

describe('bivouac annoncé entre deux lieux trop éloignés', () => {
  // Trois villages à 38 km l'un de l'autre : aucun lieu où dormir à une journée de marche.
  const places = [at('n1', 'Västra', 0), at('n2', 'Mitten', 38), at('n3', 'Östra', 76)];

  it('cinq jours : des bivouacs calculés entre les villages, au lieu de cinq journées au même endroit', () => {
    const plan = planItinerary({ ...base, days: 5, places })!;
    expect(plan).not.toBeNull();
    expect(plan.stages).toHaveLength(5);
    // Avant : « Journée sur place » cinq fois, sans avancer.
    expect(plan.distinct).toBe(5);
    const bivouacs = plan.stages.filter((s) => isBivouacStage(s.name));
    expect(bivouacs.length).toBeGreaterThanOrEqual(3);
    for (const s of plan.stages) expect(s.move).toBe('marche');
    // Chaque étape avance vers l'est.
    for (let i = 1; i < plan.stages.length; i += 1) expect(plan.stages[i].lon).toBeGreaterThan(plan.stages[i - 1].lon);
    // Une journée de marche entre deux soirs.
    for (const km of legs(plan.stages)) {
      expect(km).toBeGreaterThanOrEqual(6);
      expect(km).toBeLessThanOrEqual(16);
    }
    // Le village du milieu est atteint, les autres soirs sont des bivouacs.
    expect(plan.stages.some((s) => s.name === 'Mitten')).toBe(true);
  });

  it('le bivouac est un point calculé sur la ligne entre deux lieux RÉELS, nommé d’après eux, sans identifiant de lieu', () => {
    const plan = planItinerary({ ...base, days: 5, places })!;
    const real = new Map(places.map((p) => [p.name, p]));
    for (const s of plan.stages.filter((st) => isBivouacStage(st.name))) {
      expect(s.name.startsWith(BIVOUAC_PREFIX)).toBe(true);
      expect(s.placeId).toBeNull();
      // « Bivouac entre A et B (2/3) » : le rang de la nuit dans le trou, quand il y en a plusieurs.
      const m = /^Bivouac entre (.+?) et (.+?)(?: \(\d\/\d\))?$/.exec(s.name)!;
      expect(real.has(m[1])).toBe(true);
      expect(real.has(m[2])).toBe(true);
      // Sur la ligne (même latitude) et entre les deux lieux.
      expect(s.lat).toBeCloseTo(LAT, 4);
      expect(s.lon).toBeGreaterThan(Math.min(real.get(m[1])!.lon, real.get(m[2])!.lon));
      expect(s.lon).toBeLessThan(Math.max(real.get(m[1])!.lon, real.get(m[2])!.lon));
    }
  });

  it('la note l’annonce : pas de lieu où dormir, emplacement à choisir sur place, règles à vérifier', () => {
    const plan = planItinerary({ ...base, days: 5, places })!;
    const s = plan.stages.find((st) => isBivouacStage(st.name))!;
    expect(s.note).toMatch(/Bivouac/);
    expect(s.note).toMatch(/aucun lieu où dormir/);
    expect(s.note).toMatch(/emplacement à choisir sur place/);
    expect(s.note).toMatch(/règles/);
  });

  it('une personne qui veut un hébergement n’a pas de bivouac : le plan reste sur place, dit comme avant', () => {
    const plan = planItinerary({ ...base, days: 5, places, nights: 'hebergement' })!;
    expect(plan.stages.some((s) => isBivouacStage(s.name))).toBe(false);
    expect(plan.stages.some((s) => /aucun lieu où dormir/.test(s.note ?? ''))).toBe(true);
  });

  it('trop loin (plus de trois journées de marche sans lieu) : pas de bivouac inventé', () => {
    const far = [at('n1', 'Västra', 0), at('n2', 'Östra', 120)];
    const plan = planItinerary({ ...base, center: { lat: LAT, lon: 17 + 60 / (111 * K) }, radiusKm: 70, days: 4, places: far });
    if (plan) expect(plan.stages.some((s) => isBivouacStage(s.name))).toBe(false);
  });

  it('même entrée → même itinéraire', () => {
    const a = planItinerary({ ...base, days: 5, places })!;
    const b = planItinerary({ ...base, days: 5, places: [...places].reverse() })!;
    expect(b.stages).toEqual(a.stages);
  });
});

describe('campings dans un espace sauvage', () => {
  // Trois villages à 40 km, un camping tous les 10 km entre eux.
  const villages = [at('v1', 'Västra', 0), at('v2', 'Mitten', 40), at('v3', 'Östra', 80)];
  const camps = [10, 20, 30, 50, 60, 70].map((km, i) => at(`c${i}`, CAMP_NAMES[i], km, 'camp', null));
  const places = [...villages, ...camps];
  const wild = { ...base, center: { lat: LAT, lon: 17 + 40 / (111 * K) }, radiusKm: 48, days: 6 };

  it('sans préférence de nuit, une zone clairsemée utilise ses campings', () => {
    const plan = planItinerary({ ...wild, places })!;
    expect(plan).not.toBeNull();
    expect(plan.distinct).toBe(6);
    expect(plan.stages.filter((s) => /^Lägerplats/.test(s.name)).length).toBeGreaterThanOrEqual(3);
    expect(plan.stages.some((s) => isBivouacStage(s.name))).toBe(false);
  });

  it('avec « hébergement », les campings restent écartés', () => {
    const plan = planItinerary({ ...wild, places, nights: 'hebergement' })!;
    expect(plan.stages.some((s) => /^Lägerplats/.test(s.name))).toBe(false);
  });

  it('CONTRE-EXEMPLE — une zone dense n’utilise pas les campings sans que la personne les veuille', () => {
    const dense: AreaPlace[] = [];
    for (let i = 0; i < 16; i += 1) dense.push(at(`v${i}`, `Byn Nummer${'abcdefghijklmnop'[i]}`, i * 5));
    dense.push(...[7, 12, 22, 33, 47].map((km, i) => at(`c${i}`, CAMP_NAMES[i], km, 'camp', null)));
    const plan = planItinerary({ ...base, center: { lat: LAT, lon: 17 + 37 / (111 * K) }, radiusKm: 45, days: 6, places: dense })!;
    expect(plan.stages.some((s) => /^Lägerplats/.test(s.name))).toBe(false);
    expect(plan.stages.some((s) => isBivouacStage(s.name))).toBe(false);
  });
});

describe('la nuit d’un bivouac calculé est un bivouac, pas un hébergement à réserver', () => {
  it('quel que soit le profil qui a posé le type de la nuit', () => {
    const plan: NightPlan[] = [
      { night: 1, type: 'hebergement', reason: 'ton profil : confort ; aucun refuge connu à proximité' },
      { night: 2, type: 'refuge', reason: 'ta préférence' },
      { night: 3, type: 'hebergement', reason: 'ta préférence' },
    ];
    const names = ['Bivouac entre Västra et Mitten (1/3)', 'Mitten', null];
    const out = markComputedBivouacs(plan, (n) => names[n - 1]);
    expect(out[0]).toMatchObject({ night: 1, type: 'bivouac' });
    expect(out[0].reason).toMatch(/aucun lieu où dormir/);
    // Un vrai lieu ou une étape inconnue garde son type.
    expect(out[1]).toEqual(plan[1]);
    expect(out[2]).toEqual(plan[2]);
  });
});

describe('un espace sauvage se reconnaît à ses lieux, et la recherche descend alors aux hameaux et aux campings', () => {
  const center = { lat: LAT, lon: 17 + 38 / (111 * K) };

  it('moins de lieux habités dans la zone que de jours à dormir : sauvage ; les campings ne comptent pas', () => {
    const three = [at('n1', 'Västra', 0), at('n2', 'Mitten', 38), at('n3', 'Östra', 76)];
    expect(isWildZone({ places: three, center, radiusKm: 45, days: 5 })).toBe(true);
    expect(isWildZone({ places: [...three, ...CAMP_NAMES.map((n, i) => at(`c${i}`, n, 10 + i * 10, 'camp', null))], center, radiusKm: 45, days: 5 })).toBe(true);
    const dense = Array.from({ length: 12 }, (_, i) => at(`d${i}`, `Byn Nummer${'abcdefghijkl'[i]}`, i * 6));
    expect(isWildZone({ places: dense, center, radiusKm: 45, days: 5 })).toBe(false);
    // Les lieux hors de la zone ne comptent pas.
    expect(isWildZone({ places: [...three, ...dense.map((p) => ({ ...p, lat: p.lat + 3 }))], center, radiusKm: 45, days: 5 })).toBe(true);
  });

  it('à pied, une zone sauvage de 20 à 90 km cherche aussi hameaux et campings (avant : villes, villages, refuges)', () => {
    const q = { center, radiusKm: 48, activity: 'trekking' };
    expect(areaKinds(q)).toEqual(['town', 'village', 'hut']);
    expect(areaKinds({ ...q, wild: true })).toEqual(['town', 'village', 'hamlet', 'hut', 'camp']);
    expect(buildAreaQuery({ ...q, wild: true })).toContain('tourism=camp_site');
    expect(buildAreaQuery(q)).not.toContain('tourism=camp_site');
    // Ni à vélo ni en voiture, ni sur un pays entier.
    expect(areaKinds({ ...q, activity: 'cycling', wild: true })).toEqual(['city', 'town', 'village']);
    expect(areaKinds({ ...q, radiusKm: 300, wild: true })).toEqual(['city', 'town']);
  });
});
