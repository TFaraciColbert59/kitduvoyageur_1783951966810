import { describe, expect, it } from 'vitest';
import { backtrackShare } from '../engine/autofill';
import { sampleRoute } from '../engine/elevation';
import { areaBox, areaBoxes } from '../engine/geoPlaces';
import {
  areaTiles,
  buildAreaQuery,
  mainAxis,
  planItinerary,
  zoneSpreadKm,
  type AreaPlace,
} from '../engine/itinerary';
import {
  extentIsWorldwide,
  extentWidthDeg,
  lonDelta,
  lonInExtent,
  lonOrFilter,
  meanLon,
  splitLonRange,
  wrapLon,
} from '../engine/longitude';
import { destinationRadiusKm, distanceKm, pickNatural, type CompasPlace } from '../engine/places';
import { riverQuery } from '../engine/river';

/**
 * Plan 100, 4.5 : emprises qui traversent l'antiméridien (Fidji). Tout calcul
 * de longitude passe la coupure à ±180°, sans réseau.
 *
 * Les emprises ci-dessous sont celles que Photon a RENDUES le 11 octobre 2026
 * pour « Fidji », « Taveuni » (île de 40 km) : la boîte minimale d'une forme
 * coupée par l'antiméridien couvre tout le globe, [-180, nord, 180, sud].
 */
const FIDJI_EXTENT: [number, number, number, number] = [-180, -12.2613866, 180, -21.9434274];
const TAVEUNI_EXTENT: [number, number, number, number] = [-180, -16.6857287, 180, -17.0118282];
/** Une vraie emprise qui franchit la coupure : ouest > est (Vanua Levu → Taveuni, arrondie). */
const COUPEE: [number, number, number, number] = [176.9, -16.1, -178.9, -18.3];

const fidji = (extent: CompasPlace['extent']): CompasPlace => ({
  name: 'Fidji',
  lat: -18.12,
  lon: 179.01,
  countryCode: 'FJ',
  country: 'Fidji',
  kind: 'country',
  extent,
});

/** Grille de lieux autour de (lat0, lon0) dont les longitudes sont ramenées dans [-180, 180]. */
function wrappedGrid(opts: { lat0: number; lon0: number; cols: number; rows: number; stepKm: number }): AreaPlace[] {
  const out: AreaPlace[] = [];
  const k = Math.cos((opts.lat0 * Math.PI) / 180);
  for (let c = 0; c < opts.cols; c += 1)
    for (let r = 0; r < opts.rows; r += 1)
      out.push({
        id: `n${c * 100 + r}`,
        name: `Lieu ${c}-${r}`,
        lat: opts.lat0 + ((r - (opts.rows - 1) / 2) * opts.stepKm) / 111,
        lon: wrapLon(opts.lon0 + ((c - (opts.cols - 1) / 2) * opts.stepKm) / (111 * k)),
        kind: 'village',
        population: null,
        eleM: null,
      });
  return out;
}

const legs = (st: Array<{ lat: number; lon: number }>) => st.slice(1).map((s, i) => distanceKm(st[i], s));
const inside = (b: [number, number, number, number], p: { lat: number; lon: number }) =>
  p.lon >= b[0] && p.lon <= b[2] && p.lat >= b[1] && p.lat <= b[3];
const covered = (boxes: Array<[number, number, number, number]>, p: { lat: number; lon: number }) =>
  boxes.some((b) => inside(b, p));

describe('longitudes — la coupure à ±180°', () => {
  it('ramène une longitude dans [-180, 180] sans toucher une valeur déjà valide', () => {
    expect(wrapLon(179.5)).toBe(179.5);
    expect(wrapLon(-180)).toBe(-180);
    expect(wrapLon(180)).toBe(180);
    expect(wrapLon(180.5)).toBeCloseTo(-179.5, 9);
    expect(wrapLon(-181)).toBeCloseTo(179, 9);
    expect(wrapLon(540.25)).toBeCloseTo(-179.75, 9);
  });

  it('la différence va par le plus court chemin', () => {
    expect(lonDelta(179, -179)).toBeCloseTo(2, 9);
    expect(lonDelta(-179, 179)).toBeCloseTo(-2, 9);
    expect(lonDelta(10, 20)).toBeCloseTo(10, 9);
  });

  it('la moyenne de 179,9 et -179,9 est 180, pas 0', () => {
    expect(Math.abs(meanLon([179.9, -179.9]))).toBeCloseTo(180, 6);
    expect(meanLon([10, 20, 30])).toBeCloseTo(20, 9);
    expect(meanLon([])).toBe(0);
  });

  it('largeur d’une emprise : franchit-elle la coupure, ou est-ce un globe entier ?', () => {
    expect(extentWidthDeg(COUPEE)).toBeCloseTo(4.2, 6);
    expect(extentWidthDeg([5.2, 45.3, 5.9, 44.8])).toBeCloseTo(0.7, 9);
    expect(extentIsWorldwide(FIDJI_EXTENT)).toBe(true);
    expect(extentIsWorldwide(TAVEUNI_EXTENT)).toBe(true);
    expect(extentIsWorldwide(COUPEE)).toBe(false);
    expect(extentIsWorldwide([5.2, 45.3, 5.9, 44.8])).toBe(false);
  });

  it('un lieu est dans une emprise coupée s’il est d’un côté ou de l’autre, pas entre les deux', () => {
    expect(lonInExtent(178, COUPEE, 0)).toBe(true);
    expect(lonInExtent(-179.5, COUPEE, 0)).toBe(true);
    expect(lonInExtent(180, COUPEE, 0)).toBe(true);
    expect(lonInExtent(0, COUPEE, 0)).toBe(false);
    expect(lonInExtent(170, COUPEE, 0)).toBe(false);
    expect(lonInExtent(176, COUPEE, 1)).toBe(true);
  });

  it('une plage de longitudes coupée en segments valides', () => {
    expect(splitLonRange(170, 175)).toEqual([[170, 175]]);
    expect(splitLonRange(176.9, -178.9)).toEqual([
      [176.9, 180],
      [-180, -178.9],
    ]);
    const past = splitLonRange(178, 182);
    expect(past).toHaveLength(2);
    expect(past[0]).toEqual([178, 180]);
    expect(past[1][0]).toBe(-180);
    expect(past[1][1]).toBeCloseTo(-178, 9);
    expect(splitLonRange(-180, 180)).toEqual([[-180, 180]]);
    expect(splitLonRange(-200, 200)).toEqual([[-180, 180]]);
  });
});

describe('distances et rayon d’une destination de part et d’autre de la coupure', () => {
  it('Levuka (179,83 E) et Waiyevo (179,98 O) : une centaine de km, pas le tour du monde', () => {
    const km = distanceKm({ lat: -17.68, lon: 179.83 }, { lat: -16.82, lon: -179.98 });
    expect(km).toBeGreaterThan(80);
    expect(km).toBeLessThan(120);
  });

  it('Fidji : le rayon vient de la hauteur de l’emprise, plafonné ; Taveuni garde son minimum', () => {
    const r = destinationRadiusKm(fidji(FIDJI_EXTENT));
    expect(r).toBeGreaterThan(400);
    expect(r).toBeLessThan(700);
    expect(destinationRadiusKm({ ...fidji(TAVEUNI_EXTENT), name: 'Taveuni', kind: 'other' })).toBe(60);
  });

  it('une emprise coupée (ouest > est) a le rayon de la même boîte loin de la coupure, pas celui d’un globe', () => {
    // Même largeur (4,2°) et mêmes latitudes, au large de l’Afrique : 446 km × 244 km, demi-diagonale 254 km + 30.
    const ailleurs: [number, number, number, number] = [10, -16.1, 14.2, -18.3];
    const r = destinationRadiusKm({ ...fidji(COUPEE), kind: 'other' });
    expect(r).toBeCloseTo(destinationRadiusKm({ ...fidji(ailleurs), kind: 'other' }), 3);
    expect(r).toBeGreaterThan(270);
    expect(r).toBeLessThan(300);
  });
});

describe('zone de recherche des lieux à cheval sur la coupure', () => {
  const center = { lat: -17.5, lon: 179.9 };

  it('Fidji (emprise du globe) : deux boîtes valides autour du pays, jamais la bande de latitude du monde', () => {
    const boxes = areaBoxes({ center: { lat: -18.12, lon: 179.01 }, radiusKm: 570, extent: FIDJI_EXTENT, activity: 'hiking' });
    expect(boxes).toHaveLength(2);
    for (const b of boxes) {
      expect(b[0]).toBeGreaterThanOrEqual(-180);
      expect(b[2]).toBeLessThanOrEqual(180);
      expect(b[0]).toBeLessThan(b[2]);
    }
    // Nadi, Labasa, Taveuni sont couverts ; l’Afrique et le Brésil, à la même latitude, non.
    expect(covered(boxes, { lat: -17.8, lon: 177.42 })).toBe(true);
    expect(covered(boxes, { lat: -16.43, lon: 179.38 })).toBe(true);
    expect(covered(boxes, { lat: -16.82, lon: -179.98 })).toBe(true);
    expect(covered(boxes, { lat: -17.8, lon: 25 })).toBe(false);
    expect(covered(boxes, { lat: -17.8, lon: -47 })).toBe(false);
  });

  it('une emprise coupée est scindée à ±180', () => {
    const boxes = areaBoxes({ center, radiusKm: 100, extent: COUPEE, activity: 'hiking' });
    expect(boxes).toEqual([
      [176.9, -18.3, 180, -16.1],
      [-180, -18.3, -178.9, -16.1],
    ]);
  });

  it('un rayon qui dépasse 180° est scindé de l’autre côté', () => {
    const boxes = areaBoxes({ center, radiusKm: 100, activity: 'hiking' });
    expect(boxes).toHaveLength(2);
    expect(boxes[0][2]).toBe(180);
    expect(boxes[1][0]).toBe(-180);
    expect(covered(boxes, { lat: -17.5, lon: -179.5 })).toBe(true);
    expect(covered(boxes, { lat: -17.5, lon: 179.2 })).toBe(true);
  });

  it('CONTRE-EXEMPLE — une zone loin de la coupure reste une seule boîte inchangée', () => {
    const q = { center: { lat: 45, lon: 5.5 }, radiusKm: 30, extent: [5.2, 45.3, 5.9, 44.8] as [number, number, number, number], activity: 'rando' };
    expect(areaBoxes(q)).toEqual([[5.2, 44.8, 5.9, 45.3]]);
    expect(areaBox(q)).toEqual([5.2, 44.8, 5.9, 45.3]);
  });

  it('Overpass : l’emprise du globe devient un rayon, une emprise coupée deux boîtes', () => {
    const world = buildAreaQuery({ center: { lat: -18.12, lon: 179.01 }, radiusKm: 570, extent: FIDJI_EXTENT, activity: 'hiking' });
    expect(world).toContain('around:400000,-18.1200,179.0100');
    expect(world).not.toContain('-180.000');
    const cut = buildAreaQuery({ center, radiusKm: 100, extent: COUPEE, activity: 'hiking' });
    expect(cut).toContain('(-18.300,176.900,-16.100,180.000)');
    expect(cut).toContain('(-18.300,-180.000,-16.100,-178.900)');
  });

  it('Photon : les tuiles restent dans [-180, 180] et couvrent les deux côtés', () => {
    const tiles = areaTiles(center, 40);
    expect(tiles.length).toBeGreaterThanOrEqual(4);
    for (const t of tiles) {
      expect(t[0]).toBeGreaterThanOrEqual(-180);
      expect(t[2]).toBeLessThanOrEqual(180);
      expect(t[0]).toBeLessThanOrEqual(t[2]);
    }
    expect(covered(tiles, { lat: -17.5, lon: 179.7 })).toBe(true);
    expect(covered(tiles, { lat: -17.5, lon: -179.8 })).toBe(true);
  });
});

describe('itinéraire de part et d’autre de la coupure', () => {
  // 16 colonnes de 5 km autour de 180° E : 8 à l’est de la coupure, 8 à l’ouest.
  const places = wrappedGrid({ lat0: -17.5, lon0: 180, cols: 16, rows: 4, stepKm: 5 });

  it('sanity : la grille traverse bien la coupure', () => {
    expect(places.some((p) => p.lon > 179)).toBe(true);
    expect(places.some((p) => p.lon < -179)).toBe(true);
  });

  it('le rayon d’étalement des lieux est de quelques dizaines de km, pas 10 000', () => {
    expect(zoneSpreadKm(places)).toBeLessThan(60);
  });

  it('l’axe principal est l’axe est-ouest de la grille', () => {
    const a = mainAxis(places);
    expect(a.dx).toBeGreaterThan(0.95);
    expect(Math.abs(Math.abs(a.lon) - 180)).toBeLessThan(0.5);
  });

  it('traversée de 7 jours : un lieu par soir, vers l’est, par-dessus la coupure, à une journée à pied', () => {
    const plan = planItinerary({
      days: 7,
      activity: 'trekking',
      center: { lat: -17.5, lon: 180 },
      radiusKm: 45,
      places,
      shape: 'traverse',
    });
    expect(plan).not.toBeNull();
    expect(plan!.shape).toBe('traverse');
    expect(plan!.stages).toHaveLength(7);
    expect(plan!.distinct).toBe(7);
    for (const km of legs(plan!.stages)) {
      expect(km).toBeGreaterThanOrEqual(6);
      expect(km).toBeLessThanOrEqual(15);
    }
    // Le sens est constant : chaque étape est à l’est (ou à l’ouest) de la précédente, sans demi-tour.
    const signs = plan!.stages.slice(1).map((s, i) => Math.sign(lonDelta(plan!.stages[i].lon, s.lon)));
    expect(new Set(signs).size).toBe(1);
    // Et la coupure est franchie : des étapes des deux côtés.
    expect(plan!.stages.some((s) => s.lon > 0)).toBe(true);
    expect(plan!.stages.some((s) => s.lon < 0)).toBe(true);
  });

  it('boucle de 6 jours autour de la coupure : revient au départ, chaque étape reste une longitude valide', () => {
    const square = wrappedGrid({ lat0: -17.5, lon0: 180, cols: 9, rows: 9, stepKm: 5 });
    const plan = planItinerary({
      days: 6,
      activity: 'hiking',
      center: { lat: -17.5, lon: 180 },
      radiusKm: 25,
      places: square,
      shape: 'loop',
    });
    expect(plan).not.toBeNull();
    const last = plan!.stages[plan!.stages.length - 1];
    expect(distanceKm(last, plan!.start!)).toBeLessThan(1);
    for (const s of plan!.stages) {
      expect(s.lon).toBeGreaterThanOrEqual(-180);
      expect(s.lon).toBeLessThanOrEqual(180);
    }
    for (const km of legs(plan!.stages)) expect(km).toBeLessThan(25);
  });

  it('une emprise du globe ou coupée ne rejette aucun lieu de la grille', () => {
    for (const extent of [FIDJI_EXTENT, [177.5, -16.5, -177.5, -18.5] as [number, number, number, number]]) {
      const plan = planItinerary({
        days: 7,
        activity: 'trekking',
        center: { lat: -17.5, lon: 180 },
        radiusKm: 45,
        places,
        shape: 'traverse',
        extent,
      });
      expect(plan).not.toBeNull();
      expect(plan!.distinct).toBe(7);
    }
  });

  it('même entrée → même itinéraire (ordre des lieux indifférent)', () => {
    const input = { days: 7, activity: 'trekking', center: { lat: -17.5, lon: 180 }, radiusKm: 45, shape: 'traverse' as const };
    const a = planItinerary({ ...input, places })!;
    const b = planItinerary({ ...input, places: [...places].reverse() })!;
    expect(b.stages).toEqual(a.stages);
  });
});

describe('tracés et allers-retours de part et d’autre de la coupure', () => {
  it('l’échantillonnage d’un tracé qui franchit la coupure ne repasse pas par le méridien 0', () => {
    const s = sampleRoute(
      [
        [-17, 179.8],
        [-17, -179.8],
      ],
      9
    );
    expect(s).toHaveLength(9);
    for (const p of s) expect(Math.abs(p.lon)).toBeGreaterThan(179.7);
    expect(s[0].lon).toBeCloseTo(179.8, 4);
    expect(s[8].lon).toBeCloseTo(-179.8, 4);
    // 0,4° de longitude à 17° S ≈ 42 km.
    expect(s[8].km).toBeGreaterThan(40);
    expect(s[8].km).toBeLessThan(45);
  });

  it('une traversée qui avance de part et d’autre de la coupure n’a aucun recul', () => {
    const pts = [
      { lat: -17, lon: 179.6 },
      { lat: -17, lon: 179.9 },
      { lat: -17, lon: -179.8 },
      { lat: -17, lon: -179.5 },
    ];
    expect(backtrackShare(pts)).toBe(0);
    expect(backtrackShare([...pts, { lat: -17, lon: 179.7 }])).toBeGreaterThan(0.5);
  });
});

describe('tracé d’une rivière dont l’emprise touche la coupure', () => {
  it('une rivière loin de la coupure : la requête d’avant, une seule boîte', () => {
    const q = riverQuery('^Dordogne$', [0.5, 45.2, 1.9, 44.7])!;
    expect(q.match(/\(44\.700,0\.500,45\.200,1\.900\)/g)).toHaveLength(2);
  });

  it('une rivière coupée par l’antiméridien : une boîte de chaque côté, jamais une bande du monde', () => {
    const q = riverQuery('^Rewa$', [176.9, -16.1, -178.9, -18.3])!;
    expect(q).toContain('(-18.300,176.900,-16.100,180.000)');
    expect(q).toContain('(-18.300,-180.000,-16.100,-178.900)');
  });

  it('la boîte d’un globe entier ne dit rien de la rivière : pas de requête sur tout un parallèle', () => {
    expect(riverQuery('^Rewa$', FIDJI_EXTENT)).toBeNull();
  });
});

describe('lecture en base autour d’un point proche de la coupure (refuges à 3 km)', () => {
  it('à 179,95° E, la fenêtre de 0,12° déborde : deux plages, jamais une borne au-delà de 180', () => {
    const segs = splitLonRange(179.95 - 0.12, 179.95 + 0.12);
    expect(segs).toHaveLength(2);
    expect(lonOrFilter('lng', segs)).toBe('and(lng.gte.179.83,lng.lte.180),and(lng.gte.-180,lng.lte.-179.93)');
  });

  it('loin de la coupure : une plage, l’intervalle ordinaire', () => {
    expect(lonOrFilter('longitude', splitLonRange(5.4, 5.6))).toBe('and(longitude.gte.5.4,longitude.lte.5.6)');
  });
});

describe('choix du lieu naturel : l’étendue d’une emprise coupée', () => {
  const parc = (extent: CompasPlace['extent']): CompasPlace => ({
    name: 'Parc de Vanua',
    lat: -16.8,
    lon: 179.5,
    countryCode: 'FJ',
    country: 'Fidji',
    kind: 'other',
    landmark: true,
    osmTag: 'boundary=national_park',
    extent,
  });

  it('le parc de 1,5° × 1,5° l’emporte sur celui dont la boîte est un globe entier (largeur inconnue)', () => {
    const vrai = parc([178, -16, 179.5, -17.5]);
    const coupe = { ...parc([-180, -16, 180, -17]), lat: -16.5, lon: -179.9 };
    expect(pickNatural([coupe, vrai], 'Parc de Vanua', 'FJ')).toBe(vrai);
    expect(pickNatural([vrai, coupe], 'Parc de Vanua', 'FJ')).toBe(vrai);
  });

  it('un parc coupé de 4,2° × 2,2° l’emporte sur un parc de 1° × 1° : sa largeur est 4,2°, pas 355,8°', () => {
    const petit = parc([10, 0, 11, -1]);
    const coupe = parc(COUPEE);
    expect(pickNatural([petit, coupe], 'Parc de Vanua', 'FJ')).toBe(coupe);
    // Et il ne dépasse pas un vrai géant de 5° × 5° : avant, 355,8° × 2,2° le plaçait devant.
    const geant = parc([10, 0, 15, -5]);
    expect(pickNatural([coupe, geant], 'Parc de Vanua', 'FJ')).toBe(geant);
  });
});
