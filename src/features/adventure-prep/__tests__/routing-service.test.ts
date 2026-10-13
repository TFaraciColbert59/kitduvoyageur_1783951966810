/**
 * Service de routage — normaliseurs purs verifies contre la forme reelle des
 * reponses. Le contrat tient en une regle : une reponse mal formee vaut
 * `null`, jamais un zero ni une distance approchee.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  geoapifyRouteUrl,
  normalizeElevation,
  normalizeGeoapifyRouteDetailed,
} from '../routingService';
import type { RoutePoint } from '../routingService';
import { geoapifyReply, isGeoapify, jsonResponse, valhallaReply } from './fakeRouters';

const DEPART: RoutePoint = { lat: 45.923, lon: 6.869 };
const MILIEU: RoutePoint = { lat: 45.923, lon: 6.899 };
const ARRIVEE: RoutePoint = { lat: 45.93, lon: 6.95 };

/** Reponse Geoapify : deux points, un troncon (forme reelle, `MultiLineString`). */
const GEOAPIFY_OK = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        mode: 'hike',
        distance: 2398.2,
        time: 2159.5,
        legs: [{ distance: 2398.2, time: 2159.5, steps: [] }],
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: [[[6.869, 45.923], [6.884, 45.9232], [6.899, 45.923]]],
      },
    },
  ],
};

/** Trois points, deux troncons : la forme multi-etapes du preparateur. */
const GEOAPIFY_TWO_LEGS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        distance: 7000,
        time: 6300,
        legs: [
          { distance: 2400, time: 2160 },
          { distance: 4600, time: 4140 },
        ],
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [[6.869, 45.923], [6.899, 45.923]],
          [[6.899, 45.923], [6.92, 45.927], [6.95, 45.93]],
        ],
      },
    },
  ],
};

describe('Geoapify', () => {
  it('convertit metres et secondes en kilometres et minutes', () => {
    const r = normalizeGeoapifyRouteDetailed(GEOAPIFY_OK, [DEPART, MILIEU]);
    expect(r.reason).toBeNull();
    expect(r.provider).toBe('geoapify');
    expect(r.legs?.[0].distanceKm).toBeCloseTo(2.3982, 4);
    expect(r.legs?.[0].durationMin).toBeCloseTo(35.99, 1);
  });

  it('conserve la geometrie reelle de chaque troncon, au format [lon, lat]', () => {
    const r = normalizeGeoapifyRouteDetailed(GEOAPIFY_OK, [DEPART, MILIEU]);
    expect(r.legs?.[0].geometry).toEqual([
      [6.869, 45.923],
      [6.884, 45.9232],
      [6.899, 45.923],
    ]);
  });

  it('une ligne par troncon : chacun garde la sienne, jamais le trace entier', () => {
    const r = normalizeGeoapifyRouteDetailed(GEOAPIFY_TWO_LEGS, [DEPART, MILIEU, ARRIVEE]);
    expect(r.legs).toHaveLength(2);
    expect(r.legs?.map((l) => l.distanceKm)).toEqual([2.4, 4.6]);
    expect(r.legs?.[0].geometry.at(-1)).toEqual(r.legs?.[1].geometry[0]);
    expect(r.legs?.[1].geometry).toHaveLength(3);
  });

  it('une LineString seule vaut un troncon', () => {
    const one = structuredClone(GEOAPIFY_OK) as typeof GEOAPIFY_OK;
    (one.features[0].geometry as { type: string; coordinates: unknown }) = {
      type: 'LineString',
      coordinates: [[6.869, 45.923], [6.899, 45.923]],
    };
    expect(normalizeGeoapifyRouteDetailed(one, [DEPART, MILIEU]).legs).toHaveLength(1);
  });

  it('une reponse d erreur (cle, credits) est une panne, pas une mesure', () => {
    for (const body of [
      { statusCode: 401, error: 'Unauthorized', message: 'Invalid apiKey' },
      { statusCode: 429, error: 'Too Many Requests' },
      { type: 'FeatureCollection', features: [] },
      null,
    ]) {
      expect(normalizeGeoapifyRouteDetailed(body, [DEPART, MILIEU])).toEqual({
        legs: null,
        reason: 'provider_unavailable',
      });
    }
  });

  it('un nombre de troncons incoherent avec les points est refuse', () => {
    expect(normalizeGeoapifyRouteDetailed(GEOAPIFY_OK, [DEPART, MILIEU, ARRIVEE]).legs).toBeNull();
    expect(normalizeGeoapifyRouteDetailed(GEOAPIFY_TWO_LEGS, [DEPART, MILIEU]).legs).toBeNull();
  });

  it('une geometrie non finie ou absente est refusee plutot que propagee', () => {
    const broken = structuredClone(GEOAPIFY_OK);
    broken.features[0].geometry.coordinates = [[[6.869, Number.NaN], [6.899, 45.923]]];
    expect(normalizeGeoapifyRouteDetailed(broken, [DEPART, MILIEU]).reason).toBe('provider_unavailable');
    const none = structuredClone(GEOAPIFY_OK) as unknown as { features: Array<{ geometry?: unknown }> };
    delete none.features[0].geometry;
    expect(normalizeGeoapifyRouteDetailed(none, [DEPART, MILIEU]).reason).toBe('provider_unavailable');
  });

  it('une duree ou une distance non finie est refusee', () => {
    const noTime = structuredClone(GEOAPIFY_OK) as unknown as {
      features: Array<{ properties: { legs: Array<Record<string, unknown>> } }>;
    };
    noTime.features[0].properties.legs[0].time = 'bientot';
    expect(normalizeGeoapifyRouteDetailed(noTime, [DEPART, MILIEU]).reason).toBe('provider_unavailable');
  });

  it('zero kilometre ne vaut pas zero : « vous y etes deja » ment', () => {
    const zero = structuredClone(GEOAPIFY_OK);
    zero.features[0].properties.legs[0].distance = 0;
    expect(normalizeGeoapifyRouteDetailed(zero, [DEPART, MILIEU])).toEqual({ legs: null, reason: 'off_network' });
  });

  it('le garde-fou d arrivee : un trace qui s arrete loin du lieu est off_network', () => {
    const loin: RoutePoint = { lat: 45.95, lon: 6.899 };
    expect(normalizeGeoapifyRouteDetailed(GEOAPIFY_OK, [DEPART, loin])).toEqual({
      legs: null,
      reason: 'off_network',
    });
    const autreDepart: RoutePoint = { lat: 45.9, lon: 6.869 };
    expect(normalizeGeoapifyRouteDetailed(GEOAPIFY_OK, [autreDepart, MILIEU]).reason).toBe('off_network');
  });

  it('l URL nomme le mode, les unites, et les points en lat,lon', () => {
    const url = new URL(geoapifyRouteUrl([DEPART, MILIEU], 'pieton', 'k'));
    expect(url.origin + url.pathname).toBe('https://api.geoapify.com/v1/routing');
    expect(url.searchParams.get('waypoints')).toBe('45.923,6.869|45.923,6.899');
    expect(url.searchParams.get('mode')).toBe('hike');
    expect(url.searchParams.get('units')).toBe('metric');
    expect(new URL(geoapifyRouteUrl([DEPART, MILIEU], 'velo', 'k')).searchParams.get('mode')).toBe('bicycle');
    expect(new URL(geoapifyRouteUrl([DEPART, MILIEU], 'voiture', 'k')).searchParams.get('mode')).toBe('drive');
  });
});

describe('Open-Meteo altitude', () => {
  it('aligne les altitudes sur les points demandes', () => {
    expect(normalizeElevation({ elevation: [1041, 4206, 4792] }, 3)).toEqual([1041, 4206, 4792]);
  });

  it('une altitude manquante reste un trou, jamais un zero', () => {
    expect(normalizeElevation({ elevation: [1041, null, 4792] }, 3)).toEqual([1041, null, 4792]);
  });

  it('une reponse trop courte ou deforme vaut absence', () => {
    expect(normalizeElevation({ elevation: [1041] }, 3)).toBeNull();
    expect(normalizeElevation({}, 3)).toBeNull();
  });
});
// ---------------------------------------------------------------------------
// ===========================================================================
// I4 — le cache de routage SURVIT AU REDEPLOIEMENT.
//
// La preuve demandee n est pas « le code appelle une table » : c est
// « la reponse survit a la perte du Map en memoire ». Le test simule donc un
// redeploiement REEL : le processus repart, le `Map` est vide, le budget est
// rendu, et la seule chose qui puisse encore repondre est la base.
//
// LE CACHE PASSE MAINTENANT PAR UNE ROUTE HANDLER, ET LE TEST LE REFLECHIT.
// `routingService` ne touche plus la base : il appelle
// `GET/POST /api/route/cache`, qui relaie `get_route_cache`/`set_route_cache`.
// Ce test double donc `fetch`, pas `serviceClient`, et reproduit fidelement le
// CONTRAT de la Route Handler : 404 = miss, 200 = hit, 503 = panne. Le double
// est UNIQUE et PERSISTANT, comme une base survit a un redemarrage : un double
// reinitialise avec le processus ne prouverait rien.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

interface EntreeBase {
  payload: unknown;
  expires_at: number;
}

/** Le contenu de la table, indexe par cle — l analogue de `route_cache`. */
const base = new Map<string, EntreeBase>();
/** Les requetes vues, pour prouver QUAND et vers QUOI la base est interrogee. */
const requetesVues: { methode: string; url: string; corps?: string }[] = [];
/** Erreur forcee sur la prochaine lecture — pour tester le repli. */
let panne: string | null = null;
/** La reponse de la Route Handler pour une ECRITURE. */
let refuseEcriture = false;

const CHAMONIX: RoutePoint = { lat: 45.9237, lon: 6.8693 };
const LES_HOUCHES: RoutePoint = { lat: 45.8917, lon: 6.7983 };

/** La cle telle que le service la compose : `route:<mode>:<points>`. */
function routeCacheKey(points: readonly RoutePoint[], mode: string): string {
  const c = (lon: number, lat: number) =>
    Math.round(lon * 1e6) / 1e6 + ',' + (Math.round(lat * 1e6) / 1e6);
  return 'route:' + mode + ':' + points.map((p) => c(p.lon, p.lat)).join(';');
}

/** Une reponse de Route Handler, au meme format que `NextResponse.json`. */
function reponseRoute(statut: number, corps: unknown): Response {
  return {
    ok: statut >= 200 && statut < 300,
    status: statut,
    json: async () => corps,
  } as unknown as Response;
}

/**
 * Le faux `fetch` : il rejoue le contrat de `/api/route/cache`.
 *
 * Une entree ABSENTE ou EXPIREE vaut 404 (miss) — exactement ce que repond la
 * Route Handler, qui traduit le NULL de `get_route_cache` en miss. Le contrat
 * est donc REJOUE, pas invente.
 */
async function fetchRoute(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const methode = (init?.method ?? 'GET').toUpperCase();
  requetesVues.push({ methode, url, corps: init?.body as string | undefined });

  if (methode === 'GET') {
    if (panne) return reponseRoute(503, { status: 'unavailable', reason: panne });
    const cle = new URL(url, 'http://localhost').searchParams.get('key');
    const entree = cle === null ? undefined : base.get(cle);
    if (!entree || entree.expires_at <= Date.now()) {
      return reponseRoute(404, { status: 'miss', payload: null });
    }
    return reponseRoute(200, { status: 'hit', payload: entree.payload });
  }

  if (methode === 'POST') {
    if (panne || refuseEcriture) {
      return reponseRoute(503, { status: 'unavailable', reason: 'cache_unavailable' });
    }
    const corps = JSON.parse(String(init?.body)) as {
      key: string;
      legs: unknown;
      provider: string | null;
    };
    // Comme la vraie route : une ecriture non signee est refusee (403).
    const signature = new Headers(init?.headers).get('x-route-cache-signature');
    if (signature !== `sig:${corps.key}`) {
      return reponseRoute(403, { status: 'forbidden', reason: 'signature_expected' });
    }
    base.set(corps.key, { payload: { ...corps, reason: null }, expires_at: Date.now() + 3_600_000 });
    return reponseRoute(200, { status: 'stored' });
  }

  throw new Error('methode inattendue : ' + methode);
}

/** Les appels vers les ROUTEURS : Geoapify d'abord, Valhalla en repli, meme mesure. */
async function fetchFournisseur(input: string | URL | Request): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const options = { meters: 2398.2, speedKmh: 4 };
  return jsonResponse(isGeoapify(url) ? geoapifyReply(url, options) : valhallaReply(url, options));
}

/** Un `fetch` unique : cache vers la Route Handler, le reste vers les routeurs. */
function installerFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return url.includes('/api/route/cache') ? fetchRoute(input, init) : fetchFournisseur(input);
    }),
  );
}

type Service = typeof import('../routingService');

/**
 * Le service, avec un point d arrivee explicite.
 *
 * `cacheBaseUrl` est ce que `/api/route` passe (`request.nextUrl.origin`) :
 * sans lui, cote serveur, le service ne consulte que sa memoire.
 */
async function chargerService(): Promise<Service> {
  const mod = await import('../routingService');
  mod.__resetRouteCache();
  mod.__resetRouteLimiter();
  mod.__setGeoapifyBudgetForTests(async () => true);
  return mod;
}

/** L origine que le service utilise pour joindre la Route Handler. */
const ORIGINE = 'http://localhost:4000';
/** La signature serveur d'une cle (ce que `/api/route` passe : `signRouteCacheKey`). */
const SIGNE = (key: string) => `sig:${key}`;

beforeEach(() => {
  base.clear();
  requetesVues.length = 0;
  panne = null;
  refuseEcriture = false;
  vi.stubEnv('GEOAPIFY_API_KEY', 'cle-de-test');
  installerFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('I4 — le cache de routage survit a un redeploiement', () => {
  it('I4-CACHE-01: une trace mesuree est persistee en base, provider compris', async () => {
    const svc = await chargerService();
    const mesure = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    expect(mesure.legs).not.toBeNull();

    // La base a ete ecrite, et l ENTREE porte le provider : c est la base de
    // H5, le credit de la source. Le perdre au redemarrage serait une
    // regression de tracabilite.
    const ecriture = requetesVues.find((r) => r.methode === 'POST');
    expect(ecriture).toBeDefined();
    expect(ecriture?.url).toContain('/api/route/cache');
    expect(base.size).toBe(1);
    const entree = [...base.values()][0];
    expect(entree.payload).toMatchObject({ provider: 'geoapify', reason: null });
    expect((entree.payload as { legs: unknown }).legs).toHaveLength(1);
  });

  it('I4-CACHE-01b: sans signature serveur (navigateur), la mesure reste en memoire, rien en base', async () => {
    const svc = await chargerService();
    const mesure = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE);
    expect(mesure.legs).not.toBeNull();
    expect(requetesVues.some((r) => r.methode === 'POST')).toBe(false);
    expect(base.size).toBe(0);
    // La lecture de la base, elle, reste ouverte : une mesure du serveur sert a tous.
    expect(requetesVues.some((r) => r.methode === 'GET' && r.url.includes('/api/route/cache'))).toBe(true);
  });

  it('I4-CACHE-02: le Map vide, la reponse vient de la base et NON du reseau', async () => {
    const svc = await chargerService();
    const premier = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    expect(premier.legs?.[0].distanceKm).toBeCloseTo(2.3982, 4);

    // REDEPLOIEMENT SIMULE : le Map repart a zero, le budget est rendu. C est
    // la seule fois ou la base peut encore repondre.
    svc.__resetRouteCache();
    svc.__resetRouteLimiter();

    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchSpy.mockClear();

    const relu = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    expect(relu.legs?.[0].distanceKm).toBeCloseTo(2.3982, 4);
    // La preuve : la reponse a traverse la Route Handler, et AUCUN
    // fournisseur n a ete appele — sinon elle aurait ete RE-MESUREE.
    expect(requetesVues.some((r) => r.methode === 'GET' && r.url.includes('/api/route/cache'))).toBe(
      true,
    );
    const versFournisseur = fetchSpy.mock.calls.filter((c) => {
      const u = String(c[0]);
      return !u.includes('/api/route/cache');
    });
    expect(versFournisseur).toHaveLength(0);
  });

  it('I4-CACHE-03: la base est interrogee AVANT le debit et avant le reseau', async () => {
    const svc = await chargerService();
    // Budget epuise : la seule voie qui doit encore repondre est le cache.
    for (let i = 0; i < 200; i++) {
      svc.__resetRouteCache();
      await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    }
    svc.__resetRouteCache();
    svc.__resetRouteLimiter();
    await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);

    // La lecture de la base est la PREMIERE requete de cette derniere passe :
    // elle passe donc avant le limiteur et avant tout appel fournisseur.
    const dernier = requetesVues[requetesVues.length - 2];
    expect(dernier?.methode).toBe('GET');
    expect(dernier?.url).toContain('/api/route/cache');
  });

  it('I4-CACHE-04: un echec n est JAMAIS servi depuis le cache', async () => {
    const svc = await chargerService();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/api/route/cache')) return fetchRoute(input);
        return {
          ok: false,
          text: async () => JSON.stringify({ code: 'NoRoute', message: 'no route' }),
        } as unknown as Response;
      }),
    );

    const refus = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    expect(refus.legs).toBeNull();
    expect(refus.reason).not.toBeNull();

    // Ni en memoire, ni en base : une panne de cinq minutes ne doit pas etre
    // republiee comme une MESURE pendant toute la duree du TTL.
    expect(base.size).toBe(0);
    svc.__resetRouteCache();
    const relu = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    expect(relu.legs).toBeNull();
    expect(relu.provider).toBeUndefined();
  });

  it('I4-CACHE-05: une entree en erreur deja presente en base n est jamais servie', async () => {
    const svc = await chargerService();
    // Defense en profondeur : meme si une entree corrompue existait — migration
    // manuelle, ancien code, ecriture partielle — elle ne doit JAMAIS devenir
    // une distance affichee. On la plante sous la VRAIE cle de la demande.
    base.set(routeCacheKey([CHAMONIX, LES_HOUCHES], 'pieton'), {
      payload: { legs: null, reason: 'provider_unavailable' },
      expires_at: Date.now() + 3_600_000,
    });

    const mesure = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);

    // L entree refusee est traitee comme ABSENTE : le service remesure, et la
    // reponse vient du fournisseur — jamais d un echec memorise.
    expect(mesure.legs).not.toBeNull();
    expect(mesure.legs?.[0].distanceKm).toBeCloseTo(2.3982, 4);
    expect(mesure.reason).toBeNull();
  });

  it('I4-CACHE-06: une entree EXPIREE vaut absence, meme si elle est encore la', async () => {
    const svc = await chargerService();
    await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    // L entree est la, et sa charge utile est honnete — seule l expiration
    // compte. Le TTL doit rester RESPECTE cote base, pas seulement en memoire :
    // sinon une mesure d il y a deux heures serait republiée comme neuve.
    for (const entree of base.values()) entree.expires_at = Date.now() - 1;

    svc.__resetRouteCache();
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchSpy.mockClear();

    const apres = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    // Elle a donc ete remesuree : c est la seule preuve que le TTL compte.
    expect(fetchSpy).toHaveBeenCalled();
    expect(apres.legs).not.toBeNull();
  });

  it('I4-CACHE-07: base en panne, le service REPOND quand meme', async () => {
    const svc = await chargerService();
    // Le repli doit etre teste comme un comportement, pas suppose : une base
    // en panne ne doit JAMAIS faire perdre une mesure. C est le seul echec que
    // ce module n a pas le droit de produire, donc on l ecrit.
    panne = 'connection refused';
    const mesure = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    expect(mesure.legs).not.toBeNull();
    expect(mesure.legs?.[0].distanceKm).toBeCloseTo(2.3982, 4);

    // Et il continue de fonctionner en memoire derriere l echec.
    const relu = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    expect(relu.legs).not.toBeNull();
  });

  it('I4-CACHE-08: l ecriture refusee ne fait perdre NI la mesure NI la reponse', async () => {
    const svc = await chargerService();
    // L ACCELERATION future se perd, jamais la mesure : le service doit
    // repondre, et la reponse doit rester juste.
    refuseEcriture = true;
    const mesure = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    expect(mesure.legs).not.toBeNull();
    expect(mesure.legs?.[0].distanceKm).toBeCloseTo(2.3982, 4);
    // Et rien n a ete ecrit : pas de trace fantome en base.
    expect(base.size).toBe(0);
  });

  it('I4-CACHE-09: le provider survit au redemarrage — la base de H5', async () => {
    const svc = await chargerService();
    const premier = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    expect(premier.provider).toBe('geoapify');

    svc.__resetRouteCache();
    svc.__resetRouteLimiter();
    const relu = await svc.routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton', undefined, ORIGINE, SIGNE);
    // Le provider relu n est pas undefined : il vient bien de la base. Perdre
    // ce credit de source au redemarrage serait une regression de H5.
    expect(relu.provider).toBe('geoapify');
    expect(relu.reason).toBeNull();
  });
});

describe('I4 — le module reste client-safe (le 500 ne revient pas)', () => {
  const source = readFileSync(new URL('../routingService.ts', import.meta.url), 'utf8');

  /**
   * Le code SANS commentaires.
   *
   * Ce filet analyse le texte du module, donc il doit juger le CODE. Or le
   * fichier documente justamente le piege qu il surveille : les mots
   * `serviceClient` et `import(` apparaissent dans ses propres commentaires,
   * et un `not.toMatch` brutal rougirait sur la documentation au lieu du
   * defaut reel. On retire donc les commentaires avant d' asserter : ce qui
   * reste est exactement ce que webpack resout.
   */
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

  it('I4-BUNDLE-01: aucune reference a serviceClient, ni statique ni dynamique', () => {
    // C est le filet anti-500. Le piege est mesuré : un `import()` PARSEUX ne
    // suffit PAS, webpack resout le litteral dans le graphe STATIQUE et
    // `server-only` fait tomber `/`, `/hub` et `/prepare` (ModuleBuildError,
    // 29/09/2026). Ce module est PARTAGE avec le navigateur, donc il ne doit
    // contenir AUCUNE trace du client service-role.
    const coupables = [
      /@\/lib\/ai\/serviceClient/,
      /\bserviceClient\b/,
      /lib\/ai\/serviceClient/,
      /getServiceSupabase/,
    ];
    for (const motif of coupables) {
      expect(code, `routingService.ts ne doit jamais contenir ${motif}`).not.toMatch(motif);
    }
  });

  it('I4-BUNDLE-02: le passage par la base passe par la Route Handler, pas par un import', () => {
    // Le cache persistant doit transiter par `/api/route/cache`. Si quelqu un
    // reintroduit un import direct du client service-role, ce test rougit et le
    // 500 revient AVANT qu un navigateur ne le signale.
    expect(source).toContain('/api/route/cache');
    expect(code, 'routingService.ts ne doit contenir aucun import()').not.toMatch(/import\s*\(/);
  });
});
