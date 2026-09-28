/**
 * P1.10 - un lieu de montagne doit avoir une VRAIE distance, sinon la phase
 * `trace` echoue et l adventure entiere affiche « a verifier ».
 *
 * Mesure a la source, le 2026-09-28, sur le couple
 * Chamonix (6.8693,45.9237) -> refuge des Grands Mulets (6.861252,45.86659) :
 *
 *     OSRM `routed-foot`  200 Ok  8 718 m / 124 min   arrivee a 2 878 m  refuse
 *     Valhalla pedestrian 200 0    9 128 m / 154 min   arrivee a 2 875 m  refuse
 *     BRouter trekking    200      14 424 m / 323 min / D+ 2 100 m, arrivee a 18 m
 *
 * Les deux premiers sont des graphes ROUTIER et PIETON : ils s accrochent au
 * point le plus proche de leur reseau, qui est 2,9 km plus bas. Le troisieme est
 * un moteur de RANDONNEE, construit pour l altitude, et il monte jusqu au lieu.
 *
 * LE PIEGE QUE CE LOT DOIT EMPECHER, et qui a presque ete livre :
 * Valhalla repond `200`, `trip.status = 0`, et sa derniere instruction dit
 * textuellement « You have arrived at your destination ». C'est FAUX : sa
 * polyline decodee s'arrete a 2 875 m. Un code qui croit l'instruction
 * afficherait 9 km / 2 h 35 vers un refuge a 2,9 km de distance. C'est pour cela
 * que la seule source d'arrivee admise ici reste la GEOMETRIE decodee, jamais le
 * texte du fournisseur.
 *
 * Les geometries des fixtures sont ECHANTILLONNEES a trois ou quatre points, comme
 * celles de `p019` : le garde-fou d'arrivee ne regarde que les extremites, et une
 * trace reelle en compte plusieurs centaines. Les ecarts d'arrivee sont eux REELS.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetRouteCache, routeAttempt } from '../routingService';
import type { RoutePoint } from '../routingService';

const CHAMONIX: RoutePoint = { lat: 45.9237, lon: 6.8693 };
const GRANDS_MULETS: RoutePoint = { lat: 45.86659, lon: 6.861252 };
const LES_HOUCHES: RoutePoint = { lat: 45.8917, lon: 6.7983 };

/**
 * OSRM `routed-foot` refuse les Grands Mulets : il repond Ok, mais son
 * `waypoint` s'accroche a `[6.837477, 45.886451]`, soit 2 878 m du refuge.
 * Reponse relevee le 2026-09-28, seule la forme utile est conservee ici.
 */
function osrmAccroche(): Response {
  return new Response(
    JSON.stringify({
      code: 'Ok',
      routes: [
        {
          legs: [{ distance: 8718.2, duration: 7444.2, steps: [], weight: 884.24, summary: '' }],
          geometry: {
            type: 'LineString',
            coordinates: [
              [6.869204, 45.923615],
              [6.837477, 45.886451],
            ],
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/**
 * BRouter, profil `trekking`, reponse relevee le 2026-09-28 :
 * `track-length` 14 424 m, `filtered ascend` 2 100 m, `total-time` 19 383 s,
 * 881 points, arrivee a 18 m du refuge.
 *
 * Les trois proprietes sont des CHAINES dans la vraie reponse, et le nom de la
 * denivele contient un espace : c'est reproduit ici, parce que l'oublier
 * ferait silencieusement disparaitre le denivele de l'ecran.
 */
function brouterGrandeMulets(): Response {
  return new Response(
    JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [6.8693, 45.9237],
              [6.8512, 45.8951],
              [6.861252, 45.866428],
            ],
          },
          properties: {
            creator: 'BRouter-1.7.10',
            name: 'brouter_trekking_0',
            'track-length': '14424',
            'filtered ascend': '2100',
            'plain-ascend': '17',
            'total-time': '19383',
            cost: '39124',
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/**
 * Le Gouter, meme moteur, meme journee : 23 262 m, D+ 2 874 m, 27 103 s, mais
 * une trace qui s'arrete a **870 m** du refuge demande. C'est au-dela des 500 m
 * de `ARRIVAL_TOLERANCE_M`, donc refuse — et c'est ce refus qui prouve que le
 * garde-fou n'est pas un tampon.
 */
function brouterTropLoin(): Response {
  return new Response(
    JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [6.8693, 45.9237],
              [6.861252, 45.858775],
            ],
          },
          properties: {
            creator: 'BRouter-1.7.10',
            'track-length': '23262',
            'filtered ascend': '2874',
            'total-time': '27103',
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/** Deux points identiques : reelle, BRouter rend 0 m et un seul point. */
function brouterZero(): Response {
  return new Response(
    JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[6.8693, 45.9237]] },
          properties: { 'track-length': '0', 'filtered ascend': '0', 'total-time': '0' },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/** Reelle : hors zone, BRouter refuse par un `400` et un `datafile not found`. */
function brouterHorsZone(): Response {
  return new Response('datafile W145_N50.rd5 not found', { status: 400 });
}

/** Une panne du service : une page d'HTML, comme le FOSSGIS du P1.9. */
function panneHtml(): Response {
  return new Response('<html>502 Bad Gateway</html>', { status: 502 });
}

/** Reelle : OSRM affirme que son graphe ne relie pas ces points (`400`). */
function noRouteOSRM(): Response {
  return new Response(JSON.stringify({ code: 'NoRoute' }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Grands Mulets -> Les Houches, mesure le 2026-09-28 sur le meme moteur :
 * `track-length` 20 275 m, `filtered ascend` 107 m, `total-time` 2 731 s,
 * 1 140 points, premier `[6.861097, 45.866471]`, dernier
 * `[6.798367, 45.891652, 1000.5]`.
 *
 * Le troisieme nombre de chaque point est l altitude : BRouter renvoie du 3D.
 * Le lecteur doit donc ignorer cette coordonnee au lieu de la prendre pour une
 * longitude, ce qui est exactement le genre de faute de lecture qui donne un
 * trajet de l autre cote de la planete.
 */
function brouterLesHouches(): Response {
  return new Response(
    JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [6.861097, 45.866471, 3037.5],
              [6.83, 45.88, 2100.0],
              [6.798367, 45.891652, 1000.5],
            ],
          },
          properties: {
            creator: 'BRouter-1.7.10',
            'track-length': '20275',
            'filtered ascend': '107',
            'total-time': '2731',
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/** Le `lonlats` de l'URL BRouter, decode, pour repondre par troncon. */
function lonlatsDe(url: string): string {
  const found = /lonlats=([^&]+)/.exec(url);
  return found ? decodeURIComponent(found[1]) : '';
}

function fetchQuiRepond(cette: (url: string) => Response) {
  return vi.fn(async (url: string) => cette(String(url)));
}

beforeEach(() => {
  __resetRouteCache();
  vi.unstubAllGlobals();
});

describe('P1.10 - un refuge de montagne a une vraie distance', () => {
  it('P110-01 : le refuge que les deux autres fournisseurs refusent est mesure', async () => {
    const mock = fetchQuiRepond((url) =>
      url.includes('brouter.de') ? brouterGrandeMulets() : osrmAccroche(),
    );
    vi.stubGlobal('fetch', mock);

    const attempt = await routeAttempt([CHAMONIX, GRANDS_MULETS], 'pieton');

    expect(attempt.reason).toBeNull();
    expect(attempt.legs).toHaveLength(1);
    // Les trois chiffres viennent du moteur, on ne les recalcule pas.
    expect(attempt.legs?.[0].distanceKm).toBeCloseTo(14.424, 3);
    expect(attempt.legs?.[0].durationMin).toBeCloseTo(323.05, 2);
  });

  it('P110-02 : le denivele positif REEL remonte, personne ne le calculait', async () => {
    vi.stubGlobal(
      'fetch',
      fetchQuiRepond((url) => (url.includes('brouter.de') ? brouterGrandeMulets() : osrmAccroche())),
    );

    const attempt = await routeAttempt([CHAMONIX, GRANDS_MULETS], 'pieton');

    // Ni OSRM ni Valhalla ne savoirent le denivele : c est le prix de l ajout.
    expect(attempt.legs?.[0].ascentM).toBe(2100);
  });

  it('P110-03 : un off_network fait consulter un moteur de RANDONNEE', async () => {
    const mock = fetchQuiRepond((url) =>
      url.includes('brouter.de') ? brouterGrandeMulets() : osrmAccroche(),
    );
    vi.stubGlobal('fetch', mock);

    await routeAttempt([CHAMONIX, GRANDS_MULETS], 'pieton');

    const urls = mock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('routed-foot'))).toBe(true);
    expect(urls.some((u) => u.includes('brouter.de'))).toBe(true);
    // Le profil doit etre celui de la randonnee, pas celui de la route.
    expect(urls.some((u) => u.includes('profile=trekking'))).toBe(true);
  });

  it('P110-04 : le garde-fou d arrivee tient sur le moteur de randonnee', async () => {
    // C est LE test de securite du lot : BRouter est le dernier recours, donc
    // c est lui qu il ne faut pas croire aveuglement. Une trace qui s arrete a
    // 870 m doit etre refusee, sinon on afficherait 23 km / 7 h 32 vers un
    // refuge que l on n atteint pas.
    vi.stubGlobal(
      'fetch',
      fetchQuiRepond((url) => (url.includes('brouter.de') ? brouterTropLoin() : osrmAccroche())),
    );

    const attempt = await routeAttempt([CHAMONIX, GRANDS_MULETS], 'pieton');

    expect(attempt.legs).toBeNull();
    expect(attempt.reason).toBe('off_network');
  });

  it('P110-05 : si BRouter echoue, on garde la MESURE deja obtenue', async () => {
    // Le pire serait de perdre le refus d OSRM et de rendre `provider_unavailable` :
    // on afficherait « le service est tombe » la ou l on sait que le refuge est
    // hors reseau. Une mesure ne s efface pas parce qu un second fournisseur
    // n a pas su.
    for (const second of [brouterTropLoin, brouterZero, brouterHorsZone, panneHtml]) {
      __resetRouteCache();
      vi.stubGlobal(
        'fetch',
        fetchQuiRepond((url) => (url.includes('brouter.de') ? second() : osrmAccroche())),
      );

      const attempt = await routeAttempt([CHAMONIX, GRANDS_MULETS], 'pieton');

      expect(attempt.reason).toBe('off_network');
    }
  });

  it('P110-06 : un zero kilometre reste refuse - « vous y etes deja » ment', async () => {
    vi.stubGlobal(
      'fetch',
      fetchQuiRepond((url) => (url.includes('brouter.de') ? brouterZero() : osrmAccroche())),
    );

    const attempt = await routeAttempt([CHAMONIX, GRANDS_MULETS], 'pieton');

    expect(attempt.legs).toBeNull();
    expect(attempt.reason).toBe('off_network');
  });

  it('P110-07 : la voiture et le velo n appellent JAMAIS la randonnee', async () => {
    // Un profil de randonnee sur une voiture serait exactement le mensonge du
    // debut : des kilometres exacts pour un trajet que personne ne fait.
    for (const mode of ['voiture', 'velo'] as const) {
      __resetRouteCache();
      const mock = fetchQuiRepond(() => osrmAccroche());
      vi.stubGlobal('fetch', mock);

      await routeAttempt([CHAMONIX, GRANDS_MULETS], mode);

      const urls = mock.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('brouter.de'))).toBe(false);
    }
  });

  it('P110-08 : quand le premier fournisseur repond, on ne ralentit rien', async () => {
    const mock = fetchQuiRepond(() =>
      new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [
            {
              legs: [{ distance: 7284, duration: 1133, steps: [], weight: 1, summary: '' }],
              geometry: {
                type: 'LineString',
                coordinates: [
                  [6.8693, 45.9237],
                  [6.7983, 45.8917],
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', mock);

    const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    expect(attempt.reason).toBeNull();
    const urls = mock.mock.calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('routed-foot');
  });

  it('P110-09 : un trajet de plusieurs etapes est decoupe, un appel par troncon', async () => {
    // BRouter ne renvoie aucun index de jalon : un appel multi-points serait
    // inexploitable pour attribuer une distance a chaque etape. On appelle donc
    // chaque paire separement, et c est aussi ce qui donne un denivele PAR JOUR.
    // OSRM refuse les DEUX troncons d un coup : un `NoRoute` reel suffit, et on
    // evite d avoir a fabriquer une reponse a deux troncons juste pour tester
    // le decoupage.
    const mock = fetchQuiRepond((url) => {
      if (!url.includes('brouter.de')) return noRouteOSRM();
      return lonlatsDe(url).includes('45.8917') ? brouterLesHouches() : brouterGrandeMulets();
    });
    vi.stubGlobal('fetch', mock);

    const attempt = await routeAttempt([CHAMONIX, GRANDS_MULETS, LES_HOUCHES], 'pieton');

    expect(attempt.legs).toHaveLength(2);
    // Chaque jour porte SA distance, mesuree sur SON troncon : c est tout
    // l interet du decoupage, et c est ce qu un appel multi-points interdisait.
    expect(attempt.legs?.[0].distanceKm).toBeCloseTo(14.424, 3);
    expect(attempt.legs?.[1].distanceKm).toBeCloseTo(20.275, 3);
    expect(attempt.legs?.[0].ascentM).toBe(2100);
    expect(attempt.legs?.[1].ascentM).toBe(107);
    const brouterCalls = mock.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('brouter.de'));
    expect(brouterCalls).toHaveLength(2);
  });

  it('P110-10 : une trace sans proprietes mesurables ne vaut rien', async () => {
    // Reponse cassee : la geometrie est la, les chiffres n y sont pas. Sans
    // `track-length`, il n y a pas de distance, et une distance inventee serait
    // exactement ce que ce projet interdit.
    const sansMesures = () =>
      new Response(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: [[6.8693, 45.9237], [6.861252, 45.866428]] },
              properties: { creator: 'BRouter-1.7.10' },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    vi.stubGlobal(
      'fetch',
      fetchQuiRepond((url) => (url.includes('brouter.de') ? sansMesures() : osrmAccroche())),
    );

    const attempt = await routeAttempt([CHAMONIX, GRANDS_MULETS], 'pieton');

    expect(attempt.legs).toBeNull();
    expect(attempt.reason).toBe('off_network');
  });
});
