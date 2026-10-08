/**
 * P1.9, revu au plan 1.5 (8 octobre) - un fournisseur PIETON doit repondre,
 * sinon aucune distance de marche n'est affichable a l'ecran.
 *
 * Les fournisseurs ont change : le serveur de demonstration d'OSRM et
 * `routing.openstreetmap.de` (non autorises pour un usage commercial, ou sans
 * conditions publiees) ont laisse la place a Geoapify Routing (cle, offre
 * gratuite, usage commercial permis) puis a Valhalla FOSSGIS en repli,
 * identifie par `X-Client-Id`.
 *
 * Ce qui ne change pas, et que ces tests verrouillent :
 *   - repondre n'est pas assez : un sommet n'est PAS joignable, et le
 *     fournisseur le dit en renvoyant une trace qui s'arrete des kilometres
 *     plus loin. Le garde-fou d'arrivee (ARRIVAL_TOLERANCE_M) s'applique a
 *     Geoapify comme a Valhalla. Sans lui, le Mont Blanc repondrait 115 km /
 *     26 h de marche - le mensonge exact que P0.23 combat ;
 *   - un refus mesure (`off_network`) ne se confond jamais avec une panne
 *     (`provider_unavailable`), et seule la panne fait consulter le repli ;
 *   - le mode ne se negocie jamais : `pieton` part en `hike`, jamais en `drive`.
 *
 * Les reponses ont la forme REELLE de Geoapify (GeoJSON, une ligne par
 * troncon, metres et secondes) ; les chiffres de distance et de duree sont
 * ceux mesures le 2026-09-28 sur les memes points (Chamonix -> Les Houches).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ARRIVAL_TOLERANCE_M,
  __resetRouteCache,
  __resetRouteLimiter,
  __setGeoapifyBudgetForTests,
  routeAttempt,
} from '../routingService';
import type { RoutePoint } from '../routingService';
import { geoapifyMode, isGeoapify, isValhalla, valhallaCosting, valhallaReply } from './fakeRouters';

const CHAMONIX: RoutePoint = { lat: 45.9237, lon: 6.8693 };
const LES_HOUCHES: RoutePoint = { lat: 45.8917, lon: 6.7983 };
const MONT_BLANC: RoutePoint = { lat: 45.8326, lon: 6.8652 };

/** Vitesse en km/h : distance_km / (duree_min / 60). */
function vitesseKmh(distanceKm: number, durationMin: number): number {
  return distanceKm / (durationMin / 60);
}

/**
 * Les trois modes, mesures le 2026-09-28 sur les memes points
 * (Chamonix -> Les Houches) :
 *
 *     pieton   7,385 km / 98,5 min = 4,50 km/h
 *     velo     7,139 km / 29,8 min = 14,37 km/h
 *     voiture  8,030 km /  9,1 min = 52,95 km/h
 */
const MESURE = {
  pieton: { distanceM: 7385.0, durationS: 5910.0, kmh: 4.5 },
  velo: { distanceM: 7139.0, durationS: 1788.0, kmh: 14.37 },
  voiture: { distanceM: 8030.0, durationS: 546.0, kmh: 52.95 },
} as const;

type LonLat = [number, number];

/** Une reponse Geoapify d'un troncon (forme reelle : FeatureCollection, MultiLineString). */
function geoapify(distanceM: number, durationS: number, line: LonLat[], status = 200): Response {
  return new Response(
    JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            distance: distanceM,
            time: durationS,
            legs: [{ distance: distanceM, time: durationS, steps: [] }],
          },
          geometry: { type: 'MultiLineString', coordinates: [line] },
        },
      ],
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

/** Les Houches a pied depuis Chamonix : trois points, l'arrivee a quelques metres du but. */
function marcheReelle(distanceM = 7385.4, durationS = 5912.0): Response {
  return geoapify(distanceM, durationS, [
    [6.8693, 45.9237],
    [6.8331, 45.9044],
    [6.7983, 45.8917],
  ]);
}

/**
 * Un sommet : le trace s'arrete a 5 065 m du Mont Blanc (fin relevee le
 * 2026-09-28 : [6.914489, 45.80269]). Le fournisseur ne dit pas NON - il
 * repond OUI a une autre question. C'est le piege que le garde-fou ferme.
 */
function sommet(): Response {
  return geoapify(115429, 95274.0, [
    [6.869204, 45.923615],
    [6.914489, 45.80269],
  ]);
}

/** Un point a 330 m du but : DANS la tolerance de 500 m. */
function quasiArrivee(): Response {
  return geoapify(7385.4, 5912.0, [
    [6.8693, 45.9237],
    [6.7983, 45.8947],
  ]);
}

/** Hors reseau : 0 m / 0 s. */
function zero(): Response {
  return geoapify(0, 0, [
    [6.8693, 45.9237],
    [6.8693, 45.9237],
  ]);
}

/** Une erreur Geoapify (requete refusee) : un corps JSON, mais pas une mesure. */
function erreurGeoapify(): Response {
  return new Response(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'Route not found' }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}

/** Une panne du fournisseur : une page d'HTML, pas une reponse JSON. */
function panne(): Response {
  return new Response('<html>502 Bad Gateway</html>', { status: 502 });
}

/** Valhalla qui repond sur les points demandes (repli). */
function valhalla(url: string, stopShortDeg = 0): Response {
  return new Response(JSON.stringify(valhallaReply(url, { meters: 7612, speedKmh: 4.9, stopShortDeg })), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** Un mock qui repond selon l'URL, et note tous les appels (en-tetes compris). */
function fetchQuiRepond(cette: (url: string) => Response) {
  return vi.fn(async (url: string, _init?: RequestInit) => cette(String(url)));
}

function urlsDe(mock: ReturnType<typeof fetchQuiRepond>): string[] {
  return mock.mock.calls.map((c) => String(c[0]));
}

beforeEach(() => {
  __resetRouteCache();
  __resetRouteLimiter();
  __setGeoapifyBudgetForTests(async () => ({ allowed: true }));
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.stubEnv('GEOAPIFY_API_KEY', 'cle-de-test');
});

describe('P1.9 - le fournisseur pieton repond', () => {
  it('P019-01 : une marche reelle aboutit, et la distance vient du trace', async () => {
    vi.stubGlobal('fetch', fetchQuiRepond(() => marcheReelle()));

    const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    expect(attempt.reason).toBeNull();
    expect(attempt.provider).toBe('geoapify');
    expect(attempt.legs).toHaveLength(1);
    // La distance vient du fournisseur, on ne la recalcule pas.
    expect(attempt.legs?.[0].distanceKm).toBeCloseTo(7.3854, 4);
    expect(attempt.legs?.[0].durationMin).toBeCloseTo(98.53, 2);
  });

  it('P019-02 : la marche part en mode RANDONNEE, et Valhalla n est pas appele', async () => {
    const mock = fetchQuiRepond(() => marcheReelle());
    vi.stubGlobal('fetch', mock);

    await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    const urls = urlsDe(mock);
    expect(urls).toHaveLength(1);
    expect(isGeoapify(urls[0])).toBe(true);
    expect(geoapifyMode(urls[0])).toBe('hike');
    // Geoapify repond : rien ne justifie un second fournisseur.
    expect(urls.some(isValhalla)).toBe(false);
  });

  it('P019-03 : une trace qui n arrive pas a 5 km du but est refusee PAR LA MESURE', async () => {
    vi.stubGlobal('fetch', fetchQuiRepond(() => sommet()));

    const attempt = await routeAttempt([CHAMONIX, MONT_BLANC], 'pieton');

    expect(attempt.legs).toBeNull();
    expect(attempt.reason).toBe('off_network');
    expect(attempt.provider).toBeUndefined();
  });

  it('P019-04 : une arrivee a 330 m passe - le garde-fou n est pas un coupe-gorge', async () => {
    vi.stubGlobal('fetch', fetchQuiRepond(quasiArrivee));

    const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    expect(attempt.reason).toBeNull();
    expect(attempt.legs).toHaveLength(1);
    expect(ARRIVAL_TOLERANCE_M).toBe(500);
  });

  it('P019-05 : une erreur Geoapify n est pas une mesure - Valhalla tranche', async () => {
    // Un corps d'erreur ne dit rien de fiable sur le lieu : c'est le repli qui
    // mesure, et SON verdict hors reseau est garde tel quel.
    const mock = fetchQuiRepond((url) => (isGeoapify(url) ? erreurGeoapify() : valhalla(url, 0.05)));
    vi.stubGlobal('fetch', mock);

    const attempt = await routeAttempt([CHAMONIX, MONT_BLANC], 'pieton');

    expect(attempt.legs).toBeNull();
    expect(attempt.reason).toBe('off_network');
    expect(urlsDe(mock).some(isValhalla)).toBe(true);
  });

  it('P019-06 : un hors-reseau mesure ne declenche PAS de seconde opinion sur les memes donnees', async () => {
    // Geoapify et Valhalla lisent tous deux OpenStreetMap : demander a l'un
    // ce que l'autre vient de mesurer afficherait un trajet que le premier nie.
    const mock = fetchQuiRepond(() => sommet());
    vi.stubGlobal('fetch', mock);

    const attempt = await routeAttempt([CHAMONIX, MONT_BLANC], 'pieton');

    expect(attempt.reason).toBe('off_network');
    const urls = urlsDe(mock);
    expect(urls).toHaveLength(1);
    expect(isGeoapify(urls[0])).toBe(true);
  });

  it('P019-07 : une panne declenche le repli identifie, et se distingue d un refus', async () => {
    const mock = fetchQuiRepond(panne);
    vi.stubGlobal('fetch', mock);

    const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    expect(attempt.legs).toBeNull();
    expect(attempt.reason).toBe('provider_unavailable');
    const repli = mock.mock.calls.find((c) => isValhalla(String(c[0])));
    expect(repli).toBeDefined();
    // FOSSGIS demande que l'application s'identifie.
    const entetes = new Headers(repli?.[1]?.headers);
    expect(entetes.get('x-client-id')).toBe('koosmoweb.fr');
    expect(entetes.get('user-agent')).toContain('koosmoweb.fr');
    // La cle Geoapify ne part jamais chez un autre fournisseur.
    expect(String(repli?.[0])).not.toContain('cle-de-test');
  });

  it('P019-08 : une reponse a zero kilometre ne vaut pas zero', async () => {
    // Un zero affiche dirait « vous etes deja arrive » - le mensonge le plus
    // discret du lot, parce qu il a l air d une bonne nouvelle.
    vi.stubGlobal('fetch', fetchQuiRepond(zero));

    const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    expect(attempt.legs).toBeNull();
    expect(attempt.reason).toBe('off_network');
  });

  it('P019-09 : le velo a son PROPRE profil, chez Geoapify comme chez Valhalla', async () => {
    const mock = fetchQuiRepond(() => marcheReelle(7139.0, 1788.0));
    vi.stubGlobal('fetch', mock);

    const velo = await routeAttempt([CHAMONIX, LES_HOUCHES], 'velo');
    expect(velo.reason).toBeNull();
    expect(velo.legs?.[0].distanceKm).toBeCloseTo(7.139, 3);
    expect(geoapifyMode(urlsDe(mock)[0])).toBe('bicycle');

    __resetRouteCache();
    const enPanne = fetchQuiRepond((url) => (isGeoapify(url) ? panne() : valhalla(url)));
    vi.stubGlobal('fetch', enPanne);
    await routeAttempt([CHAMONIX, LES_HOUCHES], 'velo');
    const repli = urlsDe(enPanne).find(isValhalla);
    expect(repli && valhallaCosting(repli)).toBe('bicycle');
  });

  it('P019-10 : la voiture passe par la route, jamais par un sentier', async () => {
    const mock = fetchQuiRepond(() => marcheReelle(MESURE.voiture.distanceM, MESURE.voiture.durationS));
    vi.stubGlobal('fetch', mock);

    const voiture = await routeAttempt([CHAMONIX, LES_HOUCHES], 'voiture');
    expect(voiture.legs?.[0].distanceKm).toBeCloseTo(8.03, 3);

    const urls = urlsDe(mock);
    expect(geoapifyMode(urls[0])).toBe('drive');
    expect(urls.some((u) => geoapifyMode(u) === 'hike')).toBe(false);
  });

  it('P019-11 : chaque mode donne sa VITESSE, pas celle d un autre', async () => {
    // L invariant qui compte n est pas « la marche est plus longue que la
    // voiture » : c est FAUX sur ces points (7,4 km de sentier contre 8,0 km
    // de route). L invariant est la vitesse : un pieton qui avance a 53 km/h,
    // c est une voiture deguisee.
    const mesure = async (mode: 'pieton' | 'velo' | 'voiture') => {
      __resetRouteCache();
      const m = MESURE[mode];
      const mock = fetchQuiRepond(() => marcheReelle(m.distanceM, m.durationS));
      vi.stubGlobal('fetch', mock);
      const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], mode);
      const leg = attempt.legs?.[0];
      if (!leg) throw new Error('legs absents pour ' + mode);
      return vitesseKmh(leg.distanceKm, leg.durationMin);
    };

    const pieton = await mesure('pieton');
    const velo = await mesure('velo');
    const voiture = await mesure('voiture');

    expect(pieton).toBeCloseTo(MESURE.pieton.kmh, 1);
    expect(velo).toBeCloseTo(MESURE.velo.kmh, 1);
    expect(voiture).toBeCloseTo(MESURE.voiture.kmh, 1);
    expect(pieton).toBeGreaterThan(2);
    expect(pieton).toBeLessThan(25);
    expect(velo).toBeGreaterThan(pieton);
    expect(voiture).toBeGreaterThan(velo);
  });

  it('P019-12 : un mode inconnu ne part sur aucun fournisseur', async () => {
    const mock = fetchQuiRepond(() => marcheReelle());
    vi.stubGlobal('fetch', mock);

    const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], 'avion' as unknown as 'pieton');

    expect(attempt.reason).toBe('mode_expected');
    expect(mock).not.toHaveBeenCalled();
  });

  it('P019-13 : deux points, ou rien - un point seul ne decrit aucun trajet', async () => {
    const mock = fetchQuiRepond(() => marcheReelle());
    vi.stubGlobal('fetch', mock);

    const attempt = await routeAttempt([CHAMONIX], 'pieton');

    expect(attempt.reason).toBe('points_expected');
    expect(mock).not.toHaveBeenCalled();
  });

  it('P019-14 : une panne n est jamais memorisee comme une reponse', async () => {
    // Deux appels de suite sur le meme couple : si le 502 entrait dans le
    // cache, la deuxieme demande rendrait le meme echec pendant une heure.
    const mock = fetchQuiRepond(panne);
    vi.stubGlobal('fetch', mock);

    await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');
    const premier = mock.mock.calls.length;
    await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    expect(mock.mock.calls.length).toBeGreaterThan(premier);
  });

  it('P019-15 : sans cle Geoapify, Valhalla repond seul, et le dit', async () => {
    vi.stubEnv('GEOAPIFY_API_KEY', '');
    const mock = fetchQuiRepond((url) => valhalla(url));
    vi.stubGlobal('fetch', mock);

    const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    expect(attempt.reason).toBeNull();
    expect(attempt.provider).toBe('valhalla');
    const urls = urlsDe(mock);
    expect(urls).toHaveLength(1);
    expect(isValhalla(urls[0])).toBe(true);
    expect(valhallaCosting(urls[0])).toBe('pedestrian');
  });

  it('P019-16 : credits du jour epuises, Geoapify n est plus appele', async () => {
    // L'offre gratuite est partagee avec les lieux et le geocodage : le routage
    // s'arrete a son budget du jour, et Valhalla prend le relais.
    __setGeoapifyBudgetForTests(async () => ({ allowed: false }));
    const mock = fetchQuiRepond((url) => (isGeoapify(url) ? marcheReelle() : valhalla(url)));
    vi.stubGlobal('fetch', mock);

    const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    expect(attempt.provider).toBe('valhalla');
    expect(urlsDe(mock).some(isGeoapify)).toBe(false);
  });
});
