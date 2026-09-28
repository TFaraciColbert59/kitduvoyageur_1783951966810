/**
 * P0.23 - Le repli GEOCODAGE, et pourquoi il est garde.
 *
 * MESURE, 2026-09-28, sur le corridor de Chamonix :
 *
 *   - l inventaire `/api/pois` + `/api/amenities` rend 18 + 374 lieux sur la
 *     boite du trajet. `Refuge des Grands Mulets` n y est PAS : la base ne
 *     couvre pas les refuges de haute montagne. Les etapes qui le citent
 *     restaient donc sans position, et toute la chaine de mesure tombait.
 *   - le geocodeur, lui, repond : `Refuge des Grands Mulets` ->
 *     45.8665895 / 6.8612515, fournisseur Photon. 6,4 km de Chamonix.
 *
 * MAIS LE MEME FOURNISSEUR SE TROMPE, et c est la raison de ce fichier :
 *
 *   - `Le Brevent`      -> 45.76699 / 6.40971   soit ~45 km a l west.
 *     Le vrai Brevent est a 6 km de Chamonix. Le sommet duGauge a ete place
 *     dans le Jura.
 *   - `Restaurant Les Cimes` -> 45.4173945 / 6.6529844, ~60 km, avec un nom
 *     compose de trois etablissements.
 *
 * Un repli naif ajouterait donc de FAUSSES positions a l ecran - exactement ce
 * que l interdiction de donnee inventeee interdit. Le repli n estAccepted que
 * si le lieu tombe dans le RAYON D ATTEINTE du trajet, et l appariement ignore
 * les articles francais, que le redacteur ecrit volontiers sans.
 *
 * Garanties : un lieu absent de la base mais proche recoit sa position REELLE ;
 * un lieu trop eloigne n en recoit AUCUNE ; un geocode muet n invente rien ;
 * et le garde-fou d arrivee reste intact, donc un refuge que l on ne peut pas
 * rejoindre a pied ne produit TOUJOURS pas de kilometres.
 */
import { describe, expect, it } from 'vitest';
import { GEOCODE_REACH_KM, geocodeCandidateFor } from '../engine/placeGeocode';
import { matchNamedPlace, type PlaceCandidate } from '../engine/places';
import { haversineKm } from '../engine/routing';
import { CHAMONIX } from './fixtures';

const ANCHOR = { lat: CHAMONIX.lat, lon: CHAMONIX.lon };

/** Ce que `/api/geocode` rend pour un nom trouve. */
function match(name: string, lat: number, lon: number, precision = 'inexact') {
  return {
    id: `geo-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    lat,
    lon,
    country: 'France',
    precision,
  };
}

// Le refuge est reel, et il est a 6,4 km de Chamonix : c est la mesure du
// 2026-09-28, pas une estimation.
const GRANDS_MULETS = match('Refuge des Grands Mulets', 45.8665895, 6.8612515);

describe('P0.23 - le repli geocodage, garde par la distance', () => {
  it('GF-01 un lieu absent de la base mais proche recoit sa position reelle', () => {
    const candidat = geocodeCandidateFor('refuge Grands Mulets', GRANDS_MULETS, ANCHOR);
    expect(candidat).not.toBeNull();
    expect(candidat?.lat).toBeCloseTo(45.8665895, 6);
    expect(candidat?.lon).toBeCloseTo(6.8612515, 6);
    // Le nom reste celui du FOURNISSEUR : l ecran ne doit pas afficher un nom
    // que personne n a mesure.
    expect(candidat?.name).toBe('Refuge des Grands Mulets');
  });

  it('GF-02 la position attribuee est bien celle du fournisseur, a la metre pres', () => {
    const candidat = geocodeCandidateFor('refuge Grands Mulets', GRANDS_MULETS, ANCHOR);
    expect(haversineKm(ANCHOR, { lat: candidat!.lat, lon: candidat!.lon })).toBeCloseTo(6.4, 0);
  });

  it('GF-03 le piege du Brevent : trop loin, donc AUCUNE position', () => {
    // Mesure 2026-09-28 : le geocodeur place le Brevent a ~45 km.
    const brevent = match('Le Brévent', 45.76699, 6.40971, 'commune');
    expect(geocodeCandidateFor('Le Brévent', brevent, ANCHOR)).toBeNull();
  });

  it('GF-04 meme provider, meme commune : le rayon tranche', () => {
    const loin = match('Commune lointaine', 45.76699, 6.40971, 'commune');
    const pres = match('Commune proche', 45.9, 6.8, 'commune');
    expect(geocodeCandidateFor('loin', loin, ANCHOR)).toBeNull();
    expect(geocodeCandidateFor('pres', pres, ANCHOR)).not.toBeNull();
  });

  it('GF-05 le rayon est mesure, pas arbitraire', () => {
    expect(GEOCODE_REACH_KM).toBeGreaterThan(6.4);
    expect(GEOCODE_REACH_KM).toBeLessThan(45);
  });

  it('GF-06 un geocode muet n invente rien', () => {
    expect(geocodeCandidateFor('Refuge des Grands Mulets', null, ANCHOR)).toBeNull();
  });

  it('GF-07 un nom vide ne se fait pas geocoder', () => {
    expect(geocodeCandidateFor('   ', GRANDS_MULETS, ANCHOR)).toBeNull();
  });

  it('GF-08 des coordonnees hors des bornes de la terre sont refusees', () => {
    const impossible = { ...GRANDS_MULETS, lat: 999, lon: 999 };
    expect(geocodeCandidateFor('refuge Grands Mulets', impossible, ANCHOR)).toBeNull();
  });
});

describe('P0.23 - l appariement sans article', () => {
  it('GA-01 le redacteur ecrit sans article, le fournisseur avec : meme lieu', () => {
    const candidat = geocodeCandidateFor('refuge Grands Mulets', GRANDS_MULETS, ANCHOR)!;
    expect(matchNamedPlace([candidat], 'refuge Grands Mulets')).not.toBeNull();
  });

  it('GA-02 le nom du fournisseur matche aussi le titre complet', () => {
    const candidat = geocodeCandidateFor('refuge Grands Mulets', GRANDS_MULETS, ANCHOR)!;
    expect(matchNamedPlace([candidat], 'Refuge des Grands Mulets')).not.toBeNull();
  });

  it('GA-03 deux lieux differents ne se confondent pas', () => {
    const gouter = geocodeCandidateFor('refuge du Gouter', match('Refuge du Goûter', 45.8510838, 6.830592), ANCHOR)!;
    const blanc = geocodeCandidateFor('lac Blanc', match('Lac Blanc', 45.9, 6.8), ANCHOR)!;
    expect(matchNamedPlace([gouter, blanc], 'lac Blanc')?.name).toBe('Lac Blanc');
    expect(matchNamedPlace([gouter, blanc], 'refuge du Gouter')?.name).toBe('Refuge du Goûter');
  });

  it('GA-04 l appariement exact reste prioritaire : pas de substitution', () => {
    const loin = geocodeCandidateFor('x', match('Bivouac Lac Blanc', 45.7, 6.3), ANCHOR);
    const candidates: PlaceCandidate[] = [
      { id: 'a', name: 'Bivouac Lac Blanc', category: 'refuge', lat: 45.7, lon: 6.3, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
      { id: 'b', name: 'Lac Blanc', category: 'lac', lat: 45.9, lon: 6.8, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
    ];
    expect(matchNamedPlace(candidates, 'Lac Blanc')?.name).toBe('Lac Blanc');
    expect(loin?.lat ?? 45.9).toBeCloseTo(45.9, 6);
  });
});

/* ------------------------------------------------------------------ */
/* P0.23 - le CABLE : de la cite au refuge, de bout en bout           */
/* ------------------------------------------------------------------ */

import { resolvePlacesFor } from '../placeSource';
import type { ItineraryModel, ItineraryStep } from '../types';

function step(over: Partial<ItineraryStep> & Pick<ItineraryStep, 'id' | 'kind' | 'title'>): ItineraryStep {
  return {
    day: 1,
    order: 0,
    placeName: null,
    startTime: null,
    durationMin: null,
    reason: null,
    price: { amount: null, currency: 'EUR', state: 'a_reserver' },
    state: 'a_reserver',
    kept: false,
    icon: 'pin',
    lat: null,
    lon: null,
    ...over,
  };
}

/**
 * Le modele du cas reel : une journee de refuge, ou le refuge est CITE par son
 * nom et ne se trouve dans aucune table locale.
 */
const MODELE: ItineraryModel = {
  days: 1,
  steps: [
    step({ id: 'j1-trajet', kind: 'trajet', order: 0, title: 'Depart vers le refuge' }),
    step({ id: 'j1-refuge', kind: 'nuit', order: 1, title: 'Montee refuge Grands Mulets', placeName: 'refuge Grands Mulets' }),
  ],
  notes: [],
  perDay: [],
  totals: { distanceKm: null, durationMin: null, elevGainM: null, elevLossM: null, budget: null },
} as unknown as ItineraryModel;

const DRAFT = {
  route: { origin: CHAMONIX, destination: null, shape: 'boucle' as const },
} as never;

function fetchStub(geocode: unknown, pois: unknown = [] as unknown[]) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/geocode')) {
      return { ok: true, status: 200, json: async () => geocode } as Response;
    }
    // Le depot et les amenites ne couvrent pas les refuges : c est le cas reel.
    if (url.includes('/api/pois') || url.includes('/api/amenities')) {
      return { ok: true, status: 200, json: async () => pois } as Response;
    }
    // La sonde de marchabilite : muette, elle ne dit rien du lieu.
    if (url.includes('/api/route')) {
      return { ok: false, status: 503, json: async () => ({ reason: 'provider_unavailable' }) } as Response;
    }
    throw new Error(`requete inattendue : ${url}`);
  }) as unknown as typeof fetch;
}

const GEOCODE_OK = {
  status: 'ok',
  provider: 'photon',
  matches: [
    {
      id: 'geo-refuge-des-grands-mulets-france-45.867-6.861',
      name: 'Refuge des Grands Mulets',
      context: 'Auvergne-Rhone-Alpes',
      country: 'France',
      lat: 45.8665895,
      lon: 6.8612515,
      provider: 'photon',
      precision: 'inexact',
    },
  ],
};

const GEOCODE_FAR = {
  status: 'ok',
  provider: 'photon',
  matches: [
    {
      id: 'geo-brevent',
      name: 'Le Brevent',
      country: 'France',
      lat: 45.76699,
      lon: 6.40971,
      provider: 'photon',
      precision: 'commune',
    },
  ],
};

describe('P0.23 - le cable, de la cite au refuge', () => {
  it('GW-01 le refuge absent des tables locales recoit sa position reelle', async () => {
    const modele = await resolvePlacesFor(fetchStub(GEOCODE_OK))(DRAFT, MODELE, new AbortController().signal);
    const refuge = modele.steps.find((s) => s.id === 'j1-refuge');
    expect(refuge?.lat).toBeCloseTo(45.8665895, 6);
    expect(refuge?.lon).toBeCloseTo(6.8612515, 6);
  });

  it('GW-02 le titre affiche devient le nom du fournisseur', async () => {
    const modele = await resolvePlacesFor(fetchStub(GEOCODE_OK))(DRAFT, MODELE, new AbortController().signal);
    expect(modele.steps.find((s) => s.id === 'j1-refuge')?.title).toBe('Refuge des Grands Mulets');
  });

  it('GW-03 un geocode trop eloigne ne donne AUCUNE position', async () => {
    const modele = await resolvePlacesFor(fetchStub(GEOCODE_FAR))(DRAFT, MODELE, new AbortController().signal);
    expect(modele.steps.find((s) => s.id === 'j1-refuge')?.lat ?? null).toBeNull();
  });

  it('GW-04 un geocode muet ne donne AUCUNE position', async () => {
    const modele = await resolvePlacesFor(fetchStub({ status: 'no_result', matches: [] }))(
      DRAFT, MODELE, new AbortController().signal,
    );
    expect(modele.steps.find((s) => s.id === 'j1-refuge')?.lat ?? null).toBeNull();
  });

  it('GW-05 le depart garde la position du lieu choisi', async () => {
    const modele = await resolvePlacesFor(fetchStub(GEOCODE_OK))(DRAFT, MODELE, new AbortController().signal);
    const trajet = modele.steps.find((s) => s.id === 'j1-trajet');
    expect(trajet?.lat).toBeCloseTo(CHAMONIX.lat, 6);
    expect(trajet?.lon).toBeCloseTo(CHAMONIX.lon, 6);
  });

  it('GW-06 le repli ne leve jamais : un depot muet laisse le modele intact', async () => {
    const casse = (async () => { throw new Error('reseau tombe'); }) as unknown as typeof fetch;
    const modele = await resolvePlacesFor(casse)(DRAFT, MODELE, new AbortController().signal);
    expect(modele.steps.every((s) => s.lat === null)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Le redacteur et le geocodeur ne disent pas les mots pareil          */
/* ------------------------------------------------------------------ */

/**
 * Mesure du 2026-09-28, generation reelle « randonnee refuge Chamonix 2 j » :
 * l etape s appelait « Grand Mulets », le geocodeur repond « Refuge des
 * Grands Mulets » a 6,4 km. Les deux noms designent le meme refuge, mais
 * aucune des quatre passes d appariement ne les rapprochait — l etape restait
 * donc sans position, et TOUT le kilometrage avec elle.
 *
 * Le passage ajoute ici se fonde sur les mots SIGNIFICATIFS COMMUNS, et exige
 * DEUX : un seul mot commun ne prouve rien, puisque « Aiguille du Midi » et
 * « Aiguille des Glaciers » en partagent un sans designer la meme montagne.
 */
describe('P0.23 - l appariement par mots significatifs', () => {
  const REFUGE = geocodeCandidateFor(
    'Grand Mulets',
    match('Refuge des Grands Mulets', 45.8665895, 6.8612515),
    ANCHOR,
  )!;

  it('GN-01 le cas reel : « Grand Mulets » retrouve « Refuge des Grands Mulets »', () => {
    expect(matchNamedPlace([REFUGE], 'Grand Mulets')).toBe(REFUGE);
  });

  it('GN-02 le singulier et le pluriel designent le meme refuge', () => {
    const lesGrands = geocodeCandidateFor(
      'Grand Mulets',
      match('Les Grands Mulets', 45.8671178, 6.8615768),
      ANCHOR,
    )!;
    expect(matchNamedPlace([lesGrands], 'Grand Mulets')).toBe(lesGrands);
  });

  it('GN-03 garde-fou : un seul mot commun ne suffit PAS', () => {
    // Le pic le plus vise du massif. Les deux noms partagent « aiguille » et
    // rien d autre : les confondre enverrait la journee au mauvais sommet.
    const midi = geocodeCandidateFor('Aiguille du Midi', match('Aiguille du Midi', 45.8785, 6.8873), ANCHOR)!;
    const glaciers = geocodeCandidateFor(
      'Aiguille des Glaciers',
      match('Aiguille des Glaciers', 45.8997, 6.9194),
      ANCHOR,
    )!;
    expect(matchNamedPlace([midi, glaciers], 'Aiguille des Glaciers')).toBe(glaciers);
    expect(matchNamedPlace([glaciers], 'Aiguille du Midi')).toBeNull();
  });

  it('GN-04 l egalite exacte reste prioritaire : aucune substitution', () => {
    // Le nom de requete doit etre un VRAI nom : `geocodeCandidateFor` refuse
    // sous `MIN_NAME = 3`, et le `!` d un premier jet masquait ce refus. Une
    // fixture qui ment sur une garde de securite ne teste pas le code.
    const exact = geocodeCandidateFor('Lac Blanc', match('Lac Blanc', 45.9, 6.8), ANCHOR)!;
    const autre = geocodeCandidateFor('Lac Blanc Sud', match('Lac Blanc Sud', 45.89, 6.81), ANCHOR)!;
    expect(exact).not.toBeNull();
    expect(autre).not.toBeNull();
    expect(matchNamedPlace([exact, autre], 'Lac Blanc')).toBe(exact);
  });

  it('GN-05 parmi plusieurs correspondances, le nom le plus long gagne', () => {
    const court = geocodeCandidateFor('Grands Mulets', match('Grands Mulets', 45.867, 6.861), ANCHOR)!;
    const long = geocodeCandidateFor(
      'Refuge des Grands Mulets',
      match('Refuge des Grands Mulets', 45.8666, 6.8613),
      ANCHOR,
    )!;
    expect(court).not.toBeNull();
    expect(long).not.toBeNull();
    // « Refuge des Grands Mulets » est le plus precis : c est lui, comme le
    // veut la regle du plus long nom deja appliquee aux autres passages.
    expect(matchNamedPlace([court, long], 'Grand Mulets')).toBe(long);
  });
});
