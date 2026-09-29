// @vitest-environment jsdom
/**
 * H5 (raccord navigateur) — l altitude ET la meteo nomment LEUR fournisseur,
 * de la route a l ecran.
 *
 * Le lot precedent (`h5-serie-providers.test.ts`, 13 tests) a livre le
 * VOCABULAIRE : `readMeasureProvider`, `elevationDataSource`,
 * `weatherDataSource`, `metricDataSource`, `describeDataSource`. Son en-tete
 * nomme ce qui manquait encore, et c est precisement ce fichier :
 *
 *     /api/weather   ──provider──▶  (rien lu)  ──▶  « source inconnue »
 *     /api/elevation ──provider──▶  (rien lu)  ──▶  « source inconnue »
 *
 * Les deux routes nommaient leur fournisseur, et PERSONNE ne le lisait :
 * `readElevationResponse` destructurait `{ status, elevations }` et jetait
 * `provider`, le runner `elevation` rendait un tableau de nombres sans nom,
 * et `browserMeasurementRunners` ne routait son callback que vers le
 * routage. Meme defaut que le routage avait eprouve avant d etre raccorde.
 *
 * Ces tests prennent le chemin LE PLUS LONG, et le seul qui prouve quelque
 * chose : le gestionnaire REEL de la route Next repond (son service reseau
 * etant mocke, donc sans reseau), le client navigateur lit SON corps, le
 * moteur en tire une valeur REELLE, et la ligne rendue par `PrepDataSource`
 * nomme le fournisseur. La reponse qui doit reussir n est jamais bricolee :
 * un `{ status: 'ok' }` avec un `provider` plogue prouverait que le lecteur
 * sait lire un objet, pas que la chaine est raccordee.
 *
 * LA REGLE QUI FAIT TOUT CE FICHIER : une mesure absente, ou repondue par
 * quelqu un qui ne se nomme pas, ne recoit AUCUN credit. Pas de
 * `?? 'open-meteo'`, pas de source par defaut, pas de source deduite du fait
 * qu on ait appele la route. H5R-05 paie ce lot : des altitudes REELLES, un
 * corps reel dont on a RETIRE le `provider`, et une ligne qui dit quand meme
 * « source inconnue » — parce que le chiffre, lui, reste honnete.
 *
 * CE QUE CE FICHIER NE FAIT PAS, et qui reste ouvert : le passage de la
 * mesure a l etat de l ecran. `ItineraryStep.tsx` doit recevoir le
 * `MeasureProviderId` et le transmettre a `buildProvenance`, qui ne sait
 * aujourd hui nommer que la distance. Ce fichier s arrete donc juste avant,
 * ou la chaine est complete et le composant d affichage est le vrai.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, waitFor } from '@testing-library/react';

import { ItineraryStepScreen } from '../components/ItineraryStep';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';

import { PrepDataSource } from '../components/PrepDataSource';
import {
  browserMeasurementRunners,
  readElevationProvider,
} from '../browserMeasurements';
import { readWeatherProvider } from '../weatherClient';
import { buildItinerary } from '../engine/itinerary';
import type { MeasurementRunners } from '../engine/measurements';
import { metricsFor, type PrepMetric } from '../engine/metrics';
import { assignPlaces, type PlaceCandidate } from '../engine/places';
import {
  SOURCE_INCONNUE,
  describeDataSource,
  metricDataSource,
  type DataSourceEntry,
  type MeasureProviderId,
} from '../engine/provenance';
import { withUnit } from '../engine/trust';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

const mocks = vi.hoisted(() => ({
  fetchDayWeather: vi.fn(),
  elevationsAt: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/features/adventure-prep/weatherService', () => ({
  fetchDayWeather: mocks.fetchDayWeather,
}));
vi.mock('@/features/adventure-prep/routingService', async (importOriginal) => {
  // `importOriginal` et non un objet fige : `browserMeasurements.ts` importe
  // aussi `isTravelMode` et `MAX_ROUTE_POINTS` de ce module. Un mock qui ne
  // les reexporte pas casserait le routage, et le test echouerait pour une
  // raison qui n a rien a voir avec la provenance.
  const reel = await importOriginal<typeof import('../routingService')>();
  return { ...reel, elevationsAt: mocks.elevationsAt };
});
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: mocks.enforceRateLimit }));

import { GET as weatherGet } from '@/app/api/weather/route';
import { GET as elevationGet } from '@/app/api/elevation/route';

/* ------------------------------------------------------------------ */
/* Les mocks du PLAN COMPOSANT (le plan precedent n'en a pas besoin, il */
/* n'importe pas l'ecran) : le moteur de generation et l'inventaire de  */
/* lieux sont remplaces, le ROUTAGE et les runners de mesure ne le sont  */
/* pas.                                                              */
/* ------------------------------------------------------------------ */

/**
 * Le faux moteur ne fait qu'une chose de plus que de repondre : il EXERCE
 * les runners de mesure que l'ecran lui a passes.
 *
 * C'est tout l'objet du plan composant. Sans cet appel, le composant
 * construirait ses propres `browserMeasurementRunners` sans jamais les
 * utiliser : les callbacks de fournisseur ne seraient declenches par
 * PERSONNE, l'etat resterait `null`, et la ligne afficherait « source
 * inconnue » — exactement comme un composant qui n aurait recu aucun
 * canal. Ce faux moteur est donc un RELAIS, pas une source de donnees :
 * chaque mesure sort de `fetchRoutage`, donc des gestionnaires de route
 * REELS et de leurs services.
 */
const faux = vi.hoisted(() => ({ run: vi.fn() }));

vi.mock('../engine/itineraryPhases', async (importOriginal) => {
  const reel = await importOriginal<typeof import('../engine/itineraryPhases')>();
  // `rejectionMessage` reste le vrai : l'ecran s'en sert hors generation.
  return { ...reel, runItineraryGeneration: faux.run };
});

vi.mock('../placeSource', () => ({
  anchorsOf: () => [],
  loadPlaceInventoryFor: () => async () => ({ places: [], truncated: false }),
  resolvePlacesFor: () => async () => null,
  warmAmenitiesFor: () => undefined,
}));

vi.mock('@/app/prepare/actions', () => ({ fetchItineraryProposal: vi.fn() }));

/* ------------------------------------------------------------------ */
/* Les lieux, et le brouillon sur lequel on mesure                    */
/* ------------------------------------------------------------------ */

/** Le corridor Chamonix — Argentiere, releve le 28/09/2026. */
const LIEUX: PlaceCandidate[] = [
  { id: 'o-mont-blanc', name: 'Mont Blanc', category: 'summit', lat: 45.8326, lon: 6.8652, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
  { id: 'o-gouter', name: 'Refuge du Gouter', category: 'refuge', lat: 45.8447, lon: 6.8427, description: null, region: null, country: 'France', pricePerNight: 75, phone: null, website: null, isVerifiable: true },
  { id: 'o-midi', name: 'Aiguille du Midi', category: 'viewpoint', lat: 45.879, lon: 6.8873, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
  { id: 'o-plan', name: 'Refuge du Plan de l Aiguille', category: 'refuge', lat: 45.8934, lon: 6.8756, description: null, region: null, country: 'France', pricePerNight: 48, phone: null, website: null, isVerifiable: true },
  { id: 'o-lac-blanc', name: 'Lac Blanc', category: 'water', lat: 45.9123, lon: 6.9012, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
  { id: 'o-bivouac', name: 'Bivouac Lac Blanc', category: 'camping', lat: 45.91, lon: 6.9, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
];

/**
 * UNE journee, et les dates en dur.
 *
 * Une seule journee parce que le denivele TOTAL est une somme connue : sur
 * trois journees, `assignPlaces` ne localise qu une journee, et le total
 * resterait `null` — honnete, mais incapable de prouver qu un credit
 * s affiche sous un chiffre reel.
 */
function brouillon(): AdventurePrepDraft {
  const base = fullDraft();
  return fullDraft({
    ...base,
    calendar: {
      startDate: '2026-07-11',
      startDateIsSuggested: false,
      durationDays: 1,
      durationIsSuggested: false,
      returnDate: null,
    },
  });
}

/** Le modele d etape 2, localise : sans position, aucune chaine a router. */
function localise(draft: AdventurePrepDraft): ItineraryModel {
  const base = buildItinerary(draft);
  if (!base) throw new Error('modele attendu');
  return assignPlaces(base, LIEUX, draft.route.origin, draft.route.destination);
}

/* ------------------------------------------------------------------ */
/* Un `fetch` qui appelle les DEUX gestionnaires de route, pour de vrai */
/* ------------------------------------------------------------------ */

function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

type Mesure = 'reelle' | 'sans-credit' | 'desalignee';

interface Options {
  /** Le nom que `/api/route` met dans son corps ; absent = corps muet. */
  readonly routeProvider?: string;
  readonly elevation?: Mesure;
  readonly weather?: Mesure;
}

/**
 * Le corps REEL de la route, avec une seule modification, nommee.
 *
 * C est la que reside la preuve : la reponse qui doit reussir sort du
 * gestionnaire lui-meme. On ne peut donc pas passer en verifiant qu un
 * `provider` bricole a ete recopie — c est la valeur du serveur qui arrive.
 */
async function defausser(response: Response, mode: Mesure): Promise<Response> {
  const body = (await response.json()) as Record<string, unknown>;
  if (mode === 'reelle') return json(body, response.status);
  if (mode === 'sans-credit') {
    const { provider: _ignore, ...reste } = body;
    return json(reste, response.status);
  }
  // Une serie refusee par le client, mais qui porte quand meme un credit :
  // c est le cas qui distingue « la mesure a ete acceptee » de « la route
  // repondait ».
  if (Array.isArray(body.elevations)) {
    return json({ ...body, elevations: body.elevations.slice(0, -1) }, 200);
  }
  const days = (body.days as Array<Record<string, unknown>>).map((jour) => ({
    ...jour,
    date: '1999-01-01',
  }));
  return json({ ...body, days }, 200);
}

function fetchRoutage(options: Options = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/route')) {
      const points = (url.split('points=')[1] ?? '').split(';').filter(Boolean).length;
      const corps: Record<string, unknown> = {
        status: 'ok',
        legs: Array.from({ length: Math.max(0, points - 1) }, (_, index) => ({
          distanceKm: 2.4 + index * 0.3,
          durationMin: 38 + index * 4,
          geometry: [
            [6.86 + index * 0.012, 45.92 + index * 0.012],
            [6.866 + index * 0.012, 45.926 + index * 0.012],
          ],
        })),
      };
      if (options.routeProvider) corps.provider = options.routeProvider;
      return json(corps);
    }
    if (url.startsWith('/api/elevation')) {
      return defausser(
        await elevationGet(new NextRequest(`http://localhost${url}`)),
        options.elevation ?? 'reelle',
      );
    }
    if (url.startsWith('/api/weather')) {
      return defausser(
        await weatherGet(new NextRequest(`http://localhost${url}`)),
        options.weather ?? 'reelle',
      );
    }
    return json({ status: 'inconnu' }, 404);
  }) as unknown as typeof fetch;
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x2019;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();
}

/** La ligne rendue telle que l ecran la rend, a partir de la mesure. */
function ligne(metric: DataSourceEntry['metric'], metrique: PrepMetric | undefined, source: MeasureProviderId | null): string {
  const entry: DataSourceEntry = {
    metric,
    value: metrique ? metrique.value : null,
    unit: metrique ? metrique.unit : 'm',
    source: metricDataSource(metric, source),
  };
  return visible(renderToStaticMarkup(React.createElement(PrepDataSource, { entry })));
}

const SIG = (): AbortSignal => new AbortController().signal;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceRateLimit.mockResolvedValue(null);
  // Un profil altimetrique monotone et REAListe : le denivele affiche sort
  // donc de ces nombres, calcule par `elevationProfile`, et non d une valeur
  // ecrite a la main dans le test.
  mocks.elevationsAt.mockImplementation((points: unknown[]) =>
    points.map((_point, index) => 1035 + index * 7),
  );
  mocks.fetchDayWeather.mockImplementation(
    (_lat: number, _lon: number, dates: string[]) =>
      dates.map((date) => ({
        date,
        tMaxC: 14,
        tMinC: 6,
        precipMm: 0,
        precipProbPct: 5,
        windMaxKmh: 9,
        code: 3,
        label: 'Partiellement nuageux',
      })),
  );
});

/* ------------------------------------------------------------------ */

describe('H5R-1 — la chaine complete, de la route a la ligne rendue', () => {
  it('H5R-01 : l altitude dit Open-Meteo, et la ligne rendue le nomme', async () => {
    const annonce: MeasureProviderId[] = [];
    const draft = brouillon();
    const runners = browserMeasurementRunners(
      fetchRoutage({ routeProvider: 'osrm' }),
      undefined,
      (provider) => annonce.push(provider),
    );

    const mesure = await runners.trace(draft, localise(draft), SIG());

    // Garde-fou : sans valeur reelle, la ligne n aurait rien a crediter, et
    // le test passerait pour une raison qui ne prouve rien.
    expect(mesure.totals.elevGainM, 'aucun denivele releve').not.toBeNull();
    expect(mesure.totals.elevGainM).toBeGreaterThan(0);
    expect(annonce.length, 'aucun fournisseur annonce').toBeGreaterThan(0);
    expect(new Set(annonce), 'un autre fournisseur que la reponse').toEqual(
      new Set(['open-meteo']),
    );

    const metrique = metricsFor(mesure, 'aventure').find((m) => m.id === 'denivele');
    expect(metrique).toBeDefined();
    const text = ligne('denivele', metrique, annonce[annonce.length - 1]);
    expect(text).toContain('Dénivelé');
    expect(text).toContain(withUnit(metrique!.value, 'm', 0));
    expect(text).toContain('Open-Meteo (altitudes)');
    // Le piege de precision : `METEO_PROVIDER` et `ELEVATION_PROVIDER` sont
    // litteralement le meme objet, donc un denivele ne doit jamais s afficher
    // comme une prevision.
    expect(text).not.toContain('prévisions');
  });

  it('H5R-02 : la meteo dit Open-Meteo, et la ligne rendue le nomme', async () => {
    const annonce: MeasureProviderId[] = [];
    const draft = brouillon();
    const runners = browserMeasurementRunners(fetchRoutage(), undefined, (provider) =>
      annonce.push(provider),
    );

    const mesure = await runners.weather(draft, localise(draft), SIG());

    // Garde-fou : la meteo doit etre la, sinon on pourrait crediter une
    // absence.
    const jour = mesure.weather[0];
    expect(jour, 'aucune meteo mesuree').toBeTruthy();
    expect(jour?.tMaxC).toBe(14);
    expect(annonce).toEqual(['open-meteo']);

    const text = ligne('meteo', { id: 'duree', label: 'Meteo', value: jour!.tMaxC, unit: '°C', state: 'connue', formatted: '' } as PrepMetric, annonce[0]);
    expect(text).toContain('Météo');
    expect(text).toContain('14 °C');
    expect(text).toContain('Open-Meteo (prévisions)');
  });

  it('H5R-03 : le routeur ne se glisse jamais dans le canal des series', async () => {
    const routeur: string[] = [];
    const series: MeasureProviderId[] = [];
    const draft = brouillon();
    const runners = browserMeasurementRunners(
      fetchRoutage({ routeProvider: 'valhalla' }),
      (provider) => routeur.push(provider),
      (provider) => series.push(provider),
    );

    const trace = await runners.trace(draft, localise(draft), SIG());
    await runners.weather(draft, trace, SIG());

    expect(routeur).toContain('valhalla');
    // Un canal unique passerait ici : le routeur se retrouverait dans le
    // tableau des series, et le denivele afficherait le nom d un moteur qui ne
    // mesure aucune altitude.
    expect(series).not.toContain('valhalla');
    expect(new Set(series)).toEqual(new Set(['open-meteo']));
    // Et l inverse : le service de mesure ne crédite pas la distance.
    expect(metricDataSource('distance', series[0] as MeasureProviderId)).toBeNull();
  });
});

describe('H5R-2 — une mesure absente ou muette ne recoit AUCUN credit', () => {
  it('H5R-04 : un 503 de la route d altitude ne nomme personne', async () => {
    mocks.elevationsAt.mockResolvedValue(null);
    const annonce: MeasureProviderId[] = [];
    const draft = brouillon();
    const runners = browserMeasurementRunners(fetchRoutage(), undefined, (provider) =>
      annonce.push(provider),
    );

    const mesure = await runners.trace(draft, localise(draft), SIG());

    // Le refus laisse le denivele a `null` — jamais 0, ce qui serait un
    // denivele invente et affiche comme mesure.
    expect(mesure.totals.elevGainM).toBeNull();
    expect(annonce, 'un 503 ne nomme personne').toEqual([]);

    const metrique = metricsFor(mesure, 'aventure').find((m) => m.id === 'denivele');
    const text = ligne('denivele', metrique, null);
    expect(text).toContain(SOURCE_INCONNUE);
    expect(text).not.toContain('Open-Meteo');
  });

  it('H5R-05 : des altitudes REELLES sans credit dans le corps restent sans source', async () => {
    // Le cas le plus important du fichier, et celui qu un `?? 'open-meteo'`
    // ferait passer : la reponse est la VRAIE reponse de la route, il n y a
    // que le credit qui a ete retire. Le denivele est donc affiche — et il
    // reste honnete — mais sa provenance est inconnue, parce que personne ne
    // s est nommé.
    const annonce: MeasureProviderId[] = [];
    const draft = brouillon();
    const runners = browserMeasurementRunners(
      fetchRoutage({ elevation: 'sans-credit' }),
      undefined,
      (provider) => annonce.push(provider),
    );

    const mesure = await runners.trace(draft, localise(draft), SIG());

    // Le nombre, lui, est la : c'est la preuve que le test ne passe pas par
    // une absence qui masquerait tout.
    expect(mesure.totals.elevGainM, 'le denivele disparait avec le credit').not.toBeNull();
    expect(annonce, 'un corps muet ne nomme personne').toEqual([]);

    const metrique = metricsFor(mesure, 'aventure').find((m) => m.id === 'denivele');
    const text = ligne('denivele', metrique, null);
    expect(text).toContain(withUnit(metrique!.value, 'm', 0));
    expect(text).toContain(SOURCE_INCONNUE);
    expect(text).not.toContain('Open-Meteo');
  });

  it('H5R-06 : une serie d altitude refusee ne nomme personne, meme avec un credit', async () => {
    // Le corps porte `provider`, et la serie est trop courte : le client la
    // refuse. Annoncer quand meme le fournisseur crediterait un denivele qui
    // n existe pas — exactement le piege que le routage evite deja en
    // annonçant apres `readRouteResponse`.
    const annonce: MeasureProviderId[] = [];
    const draft = brouillon();
    const runners = browserMeasurementRunners(
      fetchRoutage({ elevation: 'desalignee' }),
      undefined,
      (provider) => annonce.push(provider),
    );

    const mesure = await runners.trace(draft, localise(draft), SIG());

    expect(mesure.totals.elevGainM).toBeNull();
    expect(annonce, 'une serie refusee ne nomme personne').toEqual([]);
  });

  it('H5R-07 : une serie meteo decalee ne nomme personne, meme avec un credit', async () => {
    const annonce: MeasureProviderId[] = [];
    const draft = brouillon();
    const runners = browserMeasurementRunners(
      fetchRoutage({ weather: 'desalignee' }),
      undefined,
      (provider) => annonce.push(provider),
    );

    const mesure = await runners.weather(draft, localise(draft), SIG());

    // Le decalage doit rester entierement refuse : aucune meteo ne passe.
    expect(mesure.weather[0] ?? null).toBeNull();
    expect(annonce, 'une serie decalee ne nomme personne').toEqual([]);
  });

  it('H5R-11 : des previsions REELLES sans credit dans le corps restent sans source', async () => {
    // Le pendant meteo de H5R-05, ajoute apres une morsance qui l a revele
    // manquante. H5R-07 ne le couvreait pas : une serie DECALEE fait que le
    // client sort avant d appeler le lecteur, donc un defaut du type
    // `?? 'open-meteo'` dans `readWeatherProvider` y passerait tranquillement.
    // L angle mort, c est le corps muet mais VALIDE : la serie est acceptee,
    // le lecteur est donc appele, et la seule question qui reste est celle-la
    // : a-t-on le droit de nommer quand meme ?
    const annonce: MeasureProviderId[] = [];
    const draft = brouillon();
    const runners = browserMeasurementRunners(
      fetchRoutage({ weather: 'sans-credit' }),
      undefined,
      (provider) => annonce.push(provider),
    );

    const mesure = await runners.weather(draft, localise(draft), SIG());

    // Le nombre, lui, est la : c est ce qui interdit au test de passer par
    // une absence qui masquerait tout.
    const jour = mesure.weather[0];
    expect(jour, 'la meteo disparait avec le credit').toBeTruthy();
    expect(jour?.tMaxC).toBe(14);
    expect(annonce, 'un corps muet ne nomme personne').toEqual([]);

    const text = ligne(
      'meteo',
      {
        id: 'duree',
        label: 'Meteo',
        value: jour!.tMaxC,
        unit: '°C',
        state: 'connue',
        formatted: '',
      } as PrepMetric,
      null,
    );
    expect(text).toContain('Météo');
    expect(text).toContain('14 °C');
    expect(text).toContain(SOURCE_INCONNUE);
    expect(text).not.toContain('Open-Meteo');
  });
});

describe('H5R-3 — les lecteurs ne nomment que ce qu ils connaissent', () => {
  it('H5R-08 : une forme qui n est pas la reponse de la route ne nomme personne', () => {
    for (const lire of [readElevationProvider, readWeatherProvider]) {
      expect(lire({ provider: { id: 'open-meteo', name: 'Open-Meteo', url: 'x' } })).toBe(
        'open-meteo',
      );
      // Le routage rend un `provider` en chaine ; la mesure rend un objet.
      // Lire l objet, c est se fier a la forme reelle de CETTE route.
      expect(lire({ provider: 'open-meteo' })).toBeNull();
      expect(lire({ provider: { id: 'meteo-france' } })).toBeNull();
      expect(lire({ provider: { id: '' } })).toBeNull();
      expect(lire({ provider: {} })).toBeNull();
      // Le contre-exemple du defaut : un corps qui porte la DONNEE et rien
      // d autre. Un `?? 'open-meteo'` le nommerait.
      expect(lire({ elevations: [1035, 1042] })).toBeNull();
      expect(lire({ days: [] })).toBeNull();
      expect(lire({ status: 'ok' })).toBeNull();
      expect(lire(null)).toBeNull();
      expect(lire(undefined)).toBeNull();
    }
  });

  it('H5R-09 : les deux series ne se confondent jamais a l affichage', () => {
    const identifiant: MeasureProviderId = 'open-meteo';
    // Meme identifiant, deux libelles : c est la route qui a repondu qui
    // tranche, jamais l identifiant brut.
    expect(metricDataSource('denivele', identifiant)).toBe('open-meteo-elevation');
    expect(metricDataSource('meteo', identifiant)).toBe('open-meteo');
    expect(metricDataSource('denivele', null)).toBeNull();
    expect(metricDataSource('meteo', undefined)).toBeNull();
    // Et la distance ne recoit jamais le credit d un service de mesure.
    expect(metricDataSource('distance', identifiant)).toBeNull();
  });

  it('H5R-10 : une source imposee a une mesure absente disparait a l affichage', () => {
    // Le garde-fou du moteur, rappele par ce lot : meme en cas d erreur de
    // raccordement — un fournisseur annonce par un run voisin, par exemple —
    // une mesure sans valeur n'affiche que « À vérifier ».
    const text = describeDataSource({
      metric: 'denivele',
      value: null,
      unit: 'm',
      source: 'open-meteo-elevation',
    });
    expect(text).toContain(SOURCE_INCONNUE);
    expect(text).not.toContain('Open-Meteo');
  });
});
/* ------------------------------------------------------------------ */

/* H5R-4 — le composant : la mesure entre dans son etat, et la ligne

/* nomme le fournisseur. C est le point que ce fichier ne faisait PAS. */

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* H5R-4 : le composant, de la reponse jusqu a la ligne RENDUE          */
/* ------------------------------------------------------------------ */

/*
 * Tout ce qui precede s arrete a `PrepDataSource` : on prouve que la chaine
 * produit la bonne entree, jamais que l'ECRAN l'affiche. Ce bloc ferme la
 * boucle — et il ne le fait pas en fabriquant une provenance : le composant
 * est monte, le moteur de generation est un RELAIS qui exerce les runners que
 * l'ECRAN lui a passes, chaque mesure sort des gestionnaires de route REELS,
 * et l'assertion porte sur le texte rendu.
 *
 * Un `buildProvenance` appele a la main prouverait la fonction, jamais le
 * raccordement : c'est exactement le defaut que ce bloc ferme.
 */
describe('H5R-4 — la mesure remonte de la reponse jusqu a la ligne rendue', () => {
  // jsdom ne fournit ni observateur ni media query, et l'ecran s'en sert des
  // son premier rendu. Sans ces brides, l'echec parlerait de
  // `IntersectionObserver is not defined` — pas de la provenance.
  beforeAll(() => {
    class ResizeObserverShim {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverShim;

    class IntersectionObserverShim {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds: readonly number[] = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      IntersectionObserverShim;

    if (!window.matchMedia) {
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    }

    window.scrollTo = (() => {}) as unknown as typeof window.scrollTo;
    window.Element.prototype.scrollTo = function scrollTo() {};
    window.Element.prototype.scrollIntoView = function scrollIntoView() {};
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    faux.run.mockReset();
  });

  /**
   * Le faux moteur, arme comme le vrai : il mesure, puis il REMET le modele
   * mesure.
   *
   * `runners` est le 5e argument, donc celui que l'ECRAN a construit. Le test
   * ne le fabrique pas : il le consomme. C'est ce qui rend la suite incapable
   * de passer sur un composant qui ne le construirait pas — ou qui construirait
   * des runners qui n'annoncent rien.
   *
   * Le modele rendu est celui d'APRES la meteo : sans cela l'ecran afficherait
   * « Météo indisponible » meme quand `/api/weather` a repondu, et le test
   * fenit passerait sur une absence.
   */
  function mesurePuisRapporte() {
    faux.run.mockImplementation(
      async (
        draft: AdventurePrepDraft,
        signal: AbortSignal,
        _proposition: unknown,
        _phase: unknown,
        runners: MeasurementRunners
      ) => {
        const trace = await runners.trace(draft, localise(draft), signal);
        const mesure = await runners.weather(draft, trace, signal);
        return {
          model: mesure,
          engineId: 'ai',
          degraded: false,
          message: null,
          rejectedReason: null,
          failure: null,
          suggestedStartDate: null,
          suggestedDurationDays: null,
          phases: [],
          infeasible: [],
          toVerify: [],
        };
      }
    );
  }

  /** Le brouillon de l'etape 2 : un parcours a construire, generation encore `idle`. */
  function poser() {
    useAdventurePrepStore.setState({ draft: brouillon() });
  }

  function ecran(): HTMLElement {
    render(React.createElement(ItineraryStepScreen, { onOpenSheet: () => undefined }));
    return document.body;
  }

  function texte(body: HTMLElement): string {
    return body.textContent ?? '';
  }

  it('H5R-12 : l altitude nomme Open-Meteo sur l ecran, la distance nomme son routeur', async () => {
    // Garde-fou : sans valeur reelle, une ligne « source inconnue » passerait
    // pour un raccordement qui marche. On exige donc les DEUX credits.
    vi.stubGlobal('fetch', fetchRoutage({ routeProvider: 'osrm' }));
    mesurePuisRapporte();
    poser();
    const body = ecran();

    // Le nom du routeur n'apparait QUE dans la ligne de provenance : c'est un
    // critere d'attente discriminant, la tuile ne le contient pas.
    await waitFor(() => expect(texte(body)).toContain('OpenStreetMap (OSRM)'));

    expect(texte(body)).toContain('Open-Meteo (altitudes)');
    // Et la precision : la meteo ne deborde pas sur la tuile du denivele.
    expect(texte(body)).not.toContain('Open-Meteo (prévisions)');
  });

  it('H5R-13 : l altitude muette ne nomme PERSONNE, meme quand la meteo parle', async () => {
    // Le 503 de `/api/elevation` : personne n'a mesure d'altitude, donc il n'y
    // a rien a crediter. La meteo, elle, repond et se nomme — et c'est
    // precisement ce qui rend ce test able : les deux routes rendent le meme
    // `open-meteo`, donc un composant qui n'ecouterait qu'un credit unique
    // afficherait « Open-Meteo (altitudes) » sous un denivele inexistant.
    mocks.elevationsAt.mockResolvedValue(null);
    vi.stubGlobal('fetch', fetchRoutage({ routeProvider: 'osrm' }));
    mesurePuisRapporte();
    poser();
    const body = ecran();

    await waitFor(() => expect(texte(body)).toContain('OpenStreetMap (OSRM)'));

    // La meteo, elle, a bien ete acceptee : son libelle est affiche. Sans
    // cette preuve, le test passerait aussi sur un composant qui n'ecouterait
    // aucune serie.
    expect(texte(body)).toContain('Partiellement nuageux');
    // Le denivele n'existe pas : ni credit, ni ligne. La tuile dit deja
    // « À vérifier », une seconde ligne ne dirait rien de plus.
    expect(texte(body)).not.toContain('Open-Meteo (altitudes)');
    expect(texte(body)).not.toMatch(/Dénivelé\s*:/);
    // Et le routeur garde le sien : les series sont des canaux independants.
    expect(texte(body)).toContain('OpenStreetMap (OSRM)');
  });

  it('H5R-14 : des altitudes REELLES sans credit dans le corps restent sans source', async () => {
    // Le contre-temoin le plus mordant, et le seul qui condamne un
    // `?? 'open-meteo'`. Le corps de la reponse a ete depouille de son
    // `provider` : la mesure est la, le nom ne l'est pas. Un composant qui
    // nommerait « parce qu'on appelle toujours cette route » afficherait
    // « Open-Meteo (altitudes) » — et passerait les deux tests precedents.
    vi.stubGlobal('fetch', fetchRoutage({ routeProvider: 'osrm', elevation: 'sans-credit' }));
    mesurePuisRapporte();
    poser();
    const body = ecran();

    await waitFor(() => expect(texte(body)).toContain('OpenStreetMap (OSRM)'));

    // Le denivele, lui, est REEL : la ligne existe donc, avec le chiffre et la
    // formulation de l'absence. C'est ce qui distingue « on n'a pas de source »
    // de « on n'a pas de mesure ».
    expect(texte(body)).toMatch(/Dénivelé\s*:\s*28 m\s*·\s*source inconnue/);
    expect(texte(body)).not.toContain('Open-Meteo (altitudes)');
  });

  it('H5R-15 : une meteo refusee ne vole pas le credit de l altitude', async () => {
    // Le symetrique de H5R-13, et le garde-fou de l'autre sens : une serie qui
    // echoue ne doit ni nommer, ni EFFACER le credit de l'autre. Un composant
    // qui viderait son etat de credit sur un echec de la meteo afficherait
    // « source inconnue » sous un denivele reellement releve.
    //
    // Le corps meteo est decale d'un jour : `readWeatherResponse` le refuse
    // entiere plutot que d'attribuer a un jour la meteo d'un autre, et donc
    // n'annonce personne.
    vi.stubGlobal('fetch', fetchRoutage({ routeProvider: 'osrm', weather: 'desalignee' }));
    mesurePuisRapporte();
    poser();
    const body = ecran();

    await waitFor(() => expect(texte(body)).toContain('OpenStreetMap (OSRM)'));

    // La meteo est bien refusee — preuve que l'echec a eu lieu.
    expect(texte(body)).toContain('Météo indisponible');
    // Et le denivele garde le credit de la serie qui l'a reellement releve.
    expect(texte(body)).toMatch(/Dénivelé\s*:\s*28 m\s*·\s*Open-Meteo \(altitudes\)/);
  });
});