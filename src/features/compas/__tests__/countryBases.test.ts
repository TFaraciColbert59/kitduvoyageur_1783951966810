import { describe, expect, it } from 'vitest';
import { backtrackShare } from '../engine/autofill';
import {
  COUNTRY_POOL_MAX,
  MAX_COUNTRY_BASES,
  WAYPOINT_BONUS,
  countryBaseCount,
  keepCountry,
  pickCountryBases,
  spreadDays,
  transferLegs,
  type CountryBasesInput,
} from '../engine/countryBases';
import { planItinerary, type AreaPlace } from '../engine/itinerary';
import { distanceKm } from '../engine/places';
import { untangleStages } from '../engine/stageOrder';

/**
 * Plan 4.5 : l'échelle d'un pays sans les noms de l'IA. Les bases viennent des
 * lieux RÉELS que la carte ou le référentiel ont rendus pour la zone (ici
 * simulés, sans réseau) : classées par notoriété, à une distance de trajet
 * raisonnable pour l'activité, sans retour en arrière.
 */

const LAT0 = 39.5;
const LON0 = -8;
const K = Math.cos((LAT0 * Math.PI) / 180);
/** Un lieu à `northKm` au nord et `eastKm` à l'est du centre de la bande. */
function spot(id: string, northKm: number, eastKm: number, kind: AreaPlace['kind'] = 'town', population: number | null = null): AreaPlace {
  return { id, name: `Lieu ${id}`, lat: LAT0 + northKm / 111, lon: LON0 + eastKm / (111 * K), kind, population, eleM: null };
}

/** Un pays en bande de 560 km (nord-sud) sur 80 km de large : un bourg tous les 35 km, trois grandes villes. */
function strip(): AreaPlace[] {
  const out: AreaPlace[] = [];
  for (let r = 0; r <= 16; r += 1)
    for (let c = 0; c < 3; c += 1) out.push(spot(`s${r}-${c}`, (r - 8) * 35, (c - 1) * 40));
  const city = (id: string, pop: number) => {
    const i = out.findIndex((p) => p.id === id);
    out[i] = { ...out[i], kind: 'city', population: pop };
  };
  city('s0-1', 400_000);
  city('s8-1', 600_000);
  city('s16-0', 300_000);
  return out;
}
const ANCHOR = { lat: LAT0, lon: LON0, radiusKm: 330 };
const roadtrip = (over: Partial<CountryBasesInput> = {}): CountryBasesInput => ({
  places: strip(),
  days: 10,
  activity: 'roadtrip',
  anchor: ANCHOR,
  ...over,
});
const legsOf = (b: Array<{ lat: number; lon: number }>) => b.slice(1).map((s, i) => distanceKm(b[i], s));

describe('countryBaseCount — combien de bases', () => {
  it('le séjour par base de l’activité, deux bases dès une semaine dans un pays, six au plus', () => {
    // 3 jours par base en séjour culturel : 12 jours = 4 bases.
    expect(countryBaseCount('cultural', 12)).toBe(4);
    // 4 jours par base à pied : 12 jours = 3 bases, une semaine = 2.
    expect(countryBaseCount('hiking', 12)).toBe(3);
    expect(countryBaseCount('hiking', 5)).toBe(2);
    expect(countryBaseCount('hiking', 3)).toBe(1);
    // 2 jours par base en road trip.
    expect(countryBaseCount('roadtrip', 4)).toBe(2);
    expect(countryBaseCount('roadtrip', 3)).toBe(1);
    expect(countryBaseCount('roadtrip', 14)).toBe(MAX_COUNTRY_BASES);
    expect(countryBaseCount('hiking', 40)).toBe(MAX_COUNTRY_BASES);
    // Une base de plus dès que les jours dépassent un séjour entier (arrondi par le haut).
    expect(countryBaseCount('cultural', 7)).toBe(3);
    expect(countryBaseCount('hiking', 9)).toBe(3);
    expect(countryBaseCount('roadtrip', 9)).toBe(5);
    // Un jour, ou une durée absurde : une seule base.
    expect(countryBaseCount('hiking', 1)).toBe(1);
    expect(countryBaseCount('hiking', 0)).toBe(1);
    expect(countryBaseCount('hiking', 2.5)).toBe(1);
  });
});

describe('transferLegs — la distance d’un changement de base selon l’activité', () => {
  it('road trip et van : leur propre journée de route, ramenée à vol d’oiseau', () => {
    expect(transferLegs('roadtrip')).toEqual({ move: 'voiture', minKm: 90, targetKm: 150, maxKm: 210 });
    expect(transferLegs('vanlife')).toEqual({ move: 'voiture', minKm: 60, targetKm: 112.5, maxKm: 172.5 });
  });

  it('à pied, à vélo, en séjour : la voiture d’un séjour sur base (on ne marche pas d’une base à l’autre)', () => {
    for (const a of ['hiking', 'trekking', 'cycling', 'cultural', 'beach'])
      expect(transferLegs(a), a).toEqual({ move: 'voiture', minKm: 75, targetKm: 150, maxKm: 225 });
  });
});

describe('spreadDays', () => {
  it('répartit les jours le plus également possible, sans en perdre', () => {
    expect(spreadDays(14, 6)).toEqual([3, 2, 2, 3, 2, 2]);
    expect(spreadDays(12, 4)).toEqual([3, 3, 3, 3]);
    expect(spreadDays(7, 1)).toEqual([7]);
    for (const [d, c] of [[5, 2], [9, 3], [13, 4], [30, 6]] as const) {
      const out = spreadDays(d, c);
      expect(out.reduce((t, v) => t + v, 0)).toBe(d);
      expect(Math.max(...out) - Math.min(...out)).toBeLessThanOrEqual(1);
    }
  });

  it('toutes les durées de 1 à 60 jours sur 1 à 6 bases : aucun jour perdu, aucune base vide, au plus un jour d’écart', () => {
    for (let days = 1; days <= 60; days += 1)
      for (let count = 1; count <= Math.min(6, days); count += 1) {
        const out = spreadDays(days, count);
        expect(out.reduce((t, v) => t + v, 0), `${days} j / ${count}`).toBe(days);
        expect(Math.min(...out), `${days} j / ${count}`).toBeGreaterThanOrEqual(1);
        expect(Math.max(...out) - Math.min(...out), `${days} j / ${count}`).toBeLessThanOrEqual(1);
      }
  });
});

describe('pickCountryBases — des bases réelles, classées, espacées, sans retour en arrière', () => {
  it('road trip de 10 jours dans un pays en bande : cinq bases, les trois grandes villes en font partie', () => {
    const plan = pickCountryBases(roadtrip())!;
    expect(plan.wanted).toBe(5);
    expect(plan.bases).toHaveLength(5);
    const ids = plan.bases.map((b) => b.placeId);
    // Les villes les plus importantes passent devant les bourgs quand la route le permet.
    for (const city of ['s0-1', 's8-1', 's16-0']) expect(ids).toContain(city);
    // Chaque base est un lieu de la carte (jamais un point inventé).
    const known = new Set(strip().map((p) => p.id));
    for (const id of ids) expect(known.has(id!)).toBe(true);
    // Deux jours par base, tous les jours posés.
    expect(plan.bases.map((b) => b.days)).toEqual([2, 2, 2, 2, 2]);
    expect(plan.move).toBe('voiture');
  });

  it('chaque changement de base est à une journée de route : ni trop près, ni trop loin', () => {
    const plan = pickCountryBases(roadtrip())!;
    const { minKm, maxKm } = transferLegs('roadtrip');
    for (const km of legsOf(plan.bases)) {
      expect(km).toBeGreaterThanOrEqual(minKm);
      expect(km).toBeLessThanOrEqual(maxKm);
    }
    // La distance annoncée de chaque base est celle qui la sépare de la précédente.
    expect(plan.bases[0].legKm).toBeNull();
    plan.bases.slice(1).forEach((b, i) => expect(b.legKm).toBe(Math.round(distanceKm(plan.bases[i], b))));
  });

  it('jamais de retour en arrière : les bases avancent sur le pays, l’ordre est déjà le plus court', () => {
    const plan = pickCountryBases(roadtrip())!;
    const lats = plan.bases.map((b) => b.lat);
    const sorted = [...lats].sort((a, b) => a - b);
    // La bande est nord-sud : le sens importe peu, la monotonie oui.
    expect(lats.every((v, i) => v === sorted[i]) || lats.every((v, i) => v === sorted[sorted.length - 1 - i])).toBe(true);
    expect(backtrackShare(plan.bases)).toBeLessThan(0.05);
    // L'ordre du moteur d'ordre des étapes ne trouve rien à gagner.
    const stages = plan.bases.map((b, i) => ({ day: i + 1, name: b.name, lat: b.lat, lon: b.lon }));
    expect(untangleStages(stages).reordered).toBe(false);
  });

  it('deux bases quelconques sont à un changement de base au moins l’une de l’autre', () => {
    const plan = pickCountryBases(roadtrip({ days: 12 }))!;
    const { minKm } = transferLegs('roadtrip');
    for (let i = 0; i < plan.bases.length; i += 1)
      for (let j = i + 1; j < plan.bases.length; j += 1) expect(distanceKm(plan.bases[i], plan.bases[j])).toBeGreaterThanOrEqual(minKm);
  });

  it('même entrée → même résultat, quel que soit l’ordre des lieux', () => {
    const a = pickCountryBases(roadtrip())!;
    const b = pickCountryBases(roadtrip({ places: [...strip()].reverse() }))!;
    const shuffled = strip().sort((x, y) => (x.id.length - y.id.length) * 3 + (x.id < y.id ? 1 : -1));
    const c = pickCountryBases(roadtrip({ places: shuffled }))!;
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('à pied : on change de base en voiture, sur le barème d’un séjour sur base (75 à 225 km)', () => {
    const plan = pickCountryBases(roadtrip({ activity: 'hiking', days: 12 }))!;
    expect(plan.move).toBe('voiture');
    expect(plan.bases).toHaveLength(3);
    for (const km of legsOf(plan.bases)) {
      expect(km).toBeGreaterThanOrEqual(75);
      expect(km).toBeLessThanOrEqual(225);
    }
  });

  it('en van, la journée de route est plus courte : jamais plus de 172 km entre deux bases', () => {
    const plan = pickCountryBases(roadtrip({ activity: 'vanlife', days: 8 }))!;
    expect(plan.bases).toHaveLength(4);
    for (const km of legsOf(plan.bases)) {
      expect(km).toBeGreaterThanOrEqual(60);
      expect(km).toBeLessThanOrEqual(172.5);
    }
  });

  it('trop près pour changer de base : une grande ville à 50 km n’est pas une seconde base', () => {
    // Ni de « a » (50 km) ni de « b » (80 km) la grande ville n'est à une journée de route minimale (90 km) : seuls a et b se suivent.
    const places = [spot('a', 0, 0, 'town', 50_000), spot('proche', 50, 0, 'city', 5_000_000), spot('b', 130, 0, 'town', 40_000)];
    const plan = pickCountryBases({ places, days: 4, activity: 'roadtrip', anchor: { lat: LAT0 + 0.6, lon: LON0, radiusKm: 330 } })!;
    expect(plan.bases.map((b) => b.placeId)).toEqual(['a', 'b']);
  });

  it('trop loin pour une journée : deux bases à 300 km ne se suivent pas, une seule base est posée', () => {
    const places = [spot('a', 0, 0, 'town', 50_000), spot('loin', 300, 0, 'city', 2_000_000)];
    const plan = pickCountryBases({ places, days: 4, activity: 'roadtrip', anchor: { lat: LAT0 + 1.35, lon: LON0, radiusKm: 330 } })!;
    expect(plan.wanted).toBe(2);
    // Le lieu le mieux classé, seul : la carte ne permet pas deux bases à une journée l’une de l’autre.
    expect(plan.bases).toHaveLength(1);
    expect(plan.bases[0].placeId).toBe('loin');
    expect(plan.bases[0].days).toBe(4);
  });

  it('pays étroit : moins de bases que voulu (dit), les jours restants prolongent les séjours', () => {
    const places: AreaPlace[] = [];
    for (let r = 0; r <= 8; r += 1) places.push(spot(`e${r}`, (r - 4) * 35, 0));
    const plan = pickCountryBases({ places, days: 14, activity: 'roadtrip', anchor: { lat: LAT0, lon: LON0, radiusKm: 165 } })!;
    expect(plan.wanted).toBe(6);
    expect(plan.bases.length).toBeGreaterThanOrEqual(2);
    expect(plan.bases.length).toBeLessThan(plan.wanted);
    expect(plan.bases.reduce((t, b) => t + b.days, 0)).toBe(14);
    for (const km of legsOf(plan.bases)) expect(km).toBeGreaterThanOrEqual(90);
  });

  it('la distance cible départage deux chaînes de même notoriété (150 km plutôt que 100 en road trip)', () => {
    const places = [spot('a', 0, 0), spot('b', 100, 0), spot('c', 150, 0)];
    const plan = pickCountryBases({ places, days: 4, activity: 'roadtrip', anchor: { lat: LAT0 + 0.7, lon: LON0, radiusKm: 330 } })!;
    expect(plan.bases.map((b) => b.placeId).sort()).toEqual(['a', 'c']);
  });

  it('un lieu hors de la zone (plus de 110 % du rayon) n’est jamais une base', () => {
    const places = [...strip(), spot('lointain', 3000, 0, 'city', 20_000_000)];
    const plan = pickCountryBases(roadtrip({ places }))!;
    expect(plan.bases.map((b) => b.placeId)).not.toContain('lointain');
  });

  it('ni refuge ni camping : on ne fait pas une base d’un abri', () => {
    const places = [spot('abri', 0, 0, 'hut', 1_000_000), spot('tente', 10, 0, 'camp', 1_000_000)];
    expect(pickCountryBases({ places, days: 3, activity: 'hiking', anchor: ANCHOR })).toBeNull();
  });

  it('un lieu dit par la personne passe avant tout rang, s’il tient dans la chaîne', () => {
    const places = strip();
    const want = places.find((p) => p.id === 's5-2')!;
    const without = pickCountryBases(roadtrip({ places }))!;
    expect(without.bases.map((b) => b.placeId)).not.toContain('s5-2');
    const plan = pickCountryBases(roadtrip({ places, waypoints: [{ name: 'Étape voulue', lat: want.lat, lon: want.lon }] }))!;
    expect(plan.bases.map((b) => b.placeId)).toContain('s5-2');
    expect(WAYPOINT_BONUS).toBeGreaterThan(5 + 2);
  });

  it('un lieu dit loin de tout lieu de la carte est posé tel quel, sans identifiant (jamais confondu avec la carte)', () => {
    const places = [spot('a', 0, 0), spot('b', 150, 0)];
    const waypoint = { name: 'Col perdu', lat: LAT0 + 300 / 111, lon: LON0 };
    const plan = pickCountryBases({ places, days: 6, activity: 'roadtrip', anchor: { lat: LAT0 + 1.35, lon: LON0, radiusKm: 330 }, waypoints: [waypoint] })!;
    const dit = plan.bases.find((b) => b.name === 'Col perdu')!;
    expect(dit).toBeDefined();
    expect(dit.placeId).toBeNull();
  });

  it('un lieu dit hors de la zone du pays (plus de 110 % du rayon) est ignoré, même s’il se chaînerait', () => {
    const places = [spot('p0', -100, 0, 'town', 20_000), spot('p1', 0, 0, 'town', 20_000)];
    const horsZone = { name: 'Hors zone', lat: LAT0 + 150 / 111, lon: LON0 };
    const plan = pickCountryBases({ places, days: 6, activity: 'roadtrip', anchor: { lat: LAT0, lon: LON0, radiusKm: 100 }, waypoints: [horsZone] })!;
    // Trois bases voulues (6 jours, 2 par base) : sans lui, la carte n'en offre que deux.
    expect(plan.wanted).toBe(3);
    expect(plan.bases.map((b) => b.name)).toEqual(['Lieu p0', 'Lieu p1']);
  });

  it('rien d’exploitable : null, jamais une base inventée', () => {
    expect(pickCountryBases(roadtrip({ places: [] }))).toBeNull();
    expect(pickCountryBases(roadtrip({ days: 0 }))).toBeNull();
    expect(pickCountryBases(roadtrip({ days: 2.5 }))).toBeNull();
  });

  it('beaucoup de lieux : seuls les mieux classés sont étudiés, le résultat reste exact et rapide', () => {
    const many: AreaPlace[] = [];
    for (let i = 0; i < 2000; i += 1) many.push(spot(`m${String(i).padStart(4, '0')}`, ((i * 37) % 560) - 280, ((i * 91) % 160) - 80, 'town', 1_000 + (i % 50)));
    expect(many.length).toBeGreaterThan(COUNTRY_POOL_MAX);
    // Trois capitales le long du pays, noyées dans 2000 bourgs : les mieux classées sont étudiées, donc retenues.
    many.push(spot('capitale-sud', -280, 0, 'city', 5_000_000), spot('capitale-centre', 0, 0, 'city', 6_000_000), spot('capitale-nord', 280, 0, 'city', 4_000_000));
    const t0 = Date.now();
    const plan = pickCountryBases(roadtrip({ places: many }))!;
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(plan.bases).toHaveLength(5);
    for (const capitale of ['capitale-sud', 'capitale-centre', 'capitale-nord']) expect(plan.bases.map((b) => b.placeId)).toContain(capitale);
    for (const km of legsOf(plan.bases)) {
      expect(km).toBeGreaterThanOrEqual(90);
      expect(km).toBeLessThanOrEqual(210);
    }
  });

  it('cent pays tirés au hasard (graine fixe) : toujours des bases à portée, sans retour en arrière, jamais deux fois le même lieu', () => {
    let seed = 20261012;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    let withPlan = 0;
    let multi = 0;
    for (let country = 0; country < 100; country += 1) {
      const length = 250 + rnd() * 700;
      const width = 60 + rnd() * 300;
      const places: AreaPlace[] = [];
      const n = 20 + Math.floor(rnd() * 120);
      for (let i = 0; i < n; i += 1)
        places.push(spot(`r${i}`, (rnd() - 0.5) * length, (rnd() - 0.5) * width, rnd() < 0.2 ? 'city' : 'town', rnd() < 0.7 ? Math.floor(1000 + rnd() * 900_000) : null));
      const activity = ['roadtrip', 'vanlife', 'hiking', 'cycling', 'cultural'][country % 5];
      const days = 5 + Math.floor(rnd() * 20);
      const plan = pickCountryBases({ places, days, activity, anchor: { lat: LAT0, lon: LON0, radiusKm: Math.max(length, width) / 2 + 40 } });
      if (!plan) continue;
      withPlan += 1;
      if (plan.bases.length > 1) multi += 1;
      const { minKm, maxKm } = transferLegs(activity);
      expect(plan.bases.length, `pays ${country}`).toBeLessThanOrEqual(plan.wanted);
      expect(new Set(plan.bases.map((b) => b.placeId)).size, `pays ${country}`).toBe(plan.bases.length);
      expect(plan.bases.reduce((t, b) => t + b.days, 0), `pays ${country}`).toBe(days);
      for (const km of legsOf(plan.bases)) {
        expect(km, `pays ${country} ${activity}`).toBeGreaterThanOrEqual(minKm - 1e-6);
        expect(km, `pays ${country} ${activity}`).toBeLessThanOrEqual(maxKm + 1e-6);
      }
      for (let i = 0; i < plan.bases.length; i += 1)
        for (let j = i + 1; j < plan.bases.length; j += 1)
          expect(distanceKm(plan.bases[i], plan.bases[j]), `pays ${country} ${activity}`).toBeGreaterThanOrEqual(minKm - 1e-6);
    }
    // Le test ne doit pas passer à vide : presque tous les tirages donnent un plan, la plupart à plusieurs bases.
    expect(withPlan).toBeGreaterThanOrEqual(95);
    expect(multi).toBeGreaterThanOrEqual(70);
  });
});

describe('keepCountry — la destination est un pays', () => {
  const at = (id: string, countryCode: string | null) => ({ id, countryCode });
  it('écarte les lieux d’un autre pays connu, garde ceux sans pays', () => {
    const list = [at('pt', 'PT'), at('es', 'ES'), at('inconnu', null), at('pt2', 'PT')];
    expect(keepCountry(list, 'PT').map((p) => p.id)).toEqual(['pt', 'inconnu', 'pt2']);
    // Pays inconnu : rien n'est écarté.
    expect(keepCountry(list, null)).toHaveLength(4);
  });
});

describe('planItinerary — le chemin multi-bases de planBase, atteint par un pays entier', () => {
  const input = {
    days: 10,
    activity: 'roadtrip',
    center: { lat: LAT0, lon: LON0 },
    radiusKm: 330,
    places: strip(),
    shape: 'base' as const,
  };

  it('une base par groupe de jours, le moyen de l’activité au changement de base', () => {
    const plan = planItinerary(input)!;
    expect(plan.shape).toBe('base');
    expect(plan.stages).toHaveLength(10);
    expect(plan.distinct).toBe(5);
    // Un changement de base tous les deux jours, jamais au milieu d’un séjour.
    const moves = plan.stages.map((s) => s.move);
    expect(moves).toEqual(['aucun', 'aucun', 'voiture', 'aucun', 'voiture', 'aucun', 'voiture', 'aucun', 'voiture', 'aucun']);
    // Chaque jour dit où il est : un lieu de la carte, avec son identifiant.
    const known = new Set(strip().map((p) => p.id));
    for (const st of plan.stages) expect(known.has(st.placeId!)).toBe(true);
    expect(plan.stages[0].note).toBe('Première base du séjour.');
    expect(plan.stages[2].note).toMatch(/Changement de base .*\d+ km à vol d’oiseau/);
  });

  it('à pied, le changement de base se fait en voiture, et la note le dit', () => {
    const plan = planItinerary({ ...input, activity: 'hiking', days: 12 })!;
    expect(plan.distinct).toBe(3);
    const moved = plan.stages.filter((s) => s.move !== 'aucun');
    expect(moved).toHaveLength(2);
    for (const st of moved) {
      expect(st.move).toBe('voiture');
      expect(st.note).toMatch(/en véhicule/);
    }
  });

  it('un voyage dans un massif (rayon ≤ 150 km) garde sa base unique, choisie près du centre', () => {
    const plan = planItinerary({ ...input, activity: 'cultural', radiusKm: 100, days: 12 })!;
    expect(plan.distinct).toBe(1);
  });

  it('un pays pauvre en lieux : le lieu le mieux classé en base unique, jamais un point inventé', () => {
    const plan = planItinerary({ ...input, places: [spot('seul', 10, 0, 'town', 10_000)] })!;
    expect(plan.distinct).toBe(1);
    expect(plan.stages.every((s) => s.placeId === 'seul')).toBe(true);
  });

  it('un lieu dit loin de la carte entre dans la chaîne sans identifiant', () => {
    const plan = planItinerary({ ...input, waypoints: [{ name: 'Col dit', lat: LAT0 + 3.5 / 111, lon: LON0 + 100 / (111 * K) }] })!;
    expect(plan.stages.some((s) => s.name === 'Col dit' && s.placeId === null)).toBe(true);
  });
});
