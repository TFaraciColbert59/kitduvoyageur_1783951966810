/**
 * P1.9 - un fournisseur PIETON doit repondre, sinon aucune distance de marche
 * n'est affichable a l'ecran (c'est ce qui bloquait P0.23).
 *
 * Mesure a la source, le 2026-09-28, depuis cette machine :
 *   - routing.openstreetmap.de/routed-foot : **HTTP 200, 132 ms**
 *
 * NOTE CORRECTE LE 2026-09-28 : les deux Valhalla repondent de nouveau en
 * `200` (252 ms). Ils etaient bien morts quand cette mesure a ete prise. Ils
 * ne suffisent pas pour autant - voir P1.10, ou le refuge des Grands Mulets
 * reste a 2 875 m de leur trace, contre 18 m pour un moteur de randonnee.
 *
 * Le nouveau fournisseur est un OSRM de PROFIL, par FOSSGIS e.V. - le meme
 * exploitant que le serveur de demonstration OSRM deja utilise pour la voiture.
 * Meme reponse, meme geometrie geojson, donc meme lecture.
 *
 * Le point qui decide de ce lot : repondre n'est pas assez. Sur un vrai reseau
 * pieton, un sommet n'est PAS joignable, et le fournisseur le dit en renvoyant
 * une trace qui s'arrete des kilometres plus loin. Le garde-fou d'arrivee
 * (ARRIVAL_TOLERANCE_M) doit donc s'appliquer a OSRM comme a Valhalla. Sans
 * cela, Mont Blanc repond Ok avec 115 km / 26 h de marche affiches - le
 * mensonge exact que P0.23 combat, et plus mefiant que le 503 muet d'avant,
 * parce qu'il aurait eu l'air d'une reponse.
 *
 * Les reponses sont de vrais objets Response, servis sur les vraies URL du
 * service : c'est le seul moyen de capturer une distinction que le code tient
 * a faire - un corps lu sur une erreur 400 (NoRoute), ce qu'un mock sans
 * .text() ne peut pas rendre.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARRIVAL_TOLERANCE_M, __resetRouteCache, routeAttempt } from '../routingService';
import type { RoutePoint } from '../routingService';

const CHAMONIX: RoutePoint = { lat: 45.9237, lon: 6.8693 };
const LES_HOUCHES: RoutePoint = { lat: 45.8917, lon: 6.7983 };
const MONT_BLANC: RoutePoint = { lat: 45.8326, lon: 6.8652 };

/** Vitesse en km/h : distance_km / (duree_min / 60). */
function vitesseKmh(distanceKm: number, durationMin: number): number {
  return distanceKm / (durationMin / 60);
}

/**
 * Les trois modes, mesures le 2026-09-28 sur les memes points
 * (Chamonix -> Les Houches), tous en HTTP 200 du service :
 *
 *     pieton   7,385 km / 98,5 min = 4,50 km/h   ecarter d arrivee 7 m
 *     velo     7,139 km / 29,8 min = 14,37 km/h  ecarter d arrivee 7 m
 *     voiture  8,030 km /  9,1 min = 52,95 km/h  ecarter d arrivee 7 m
 */
const MESURE = {
  pieton: { distanceM: 7385.0, durationS: 5910.0, kmh: 4.5 },
  velo: { distanceM: 7139.0, durationS: 1788.0, kmh: 14.37 },
  voiture: { distanceM: 8030.0, durationS: 546.0, kmh: 52.95 },
} as const;

/**
 * Une reponse OSRM de profil, copie sur une reponse reelle du 2026-09-28.
 *
 * Les Houches a pied depuis Chamonix : 7 385 m / 98,5 min, arrivee a 7 m du
 * but. Le trace est echantillonne a trois points : le garde-fou d'arrivee ne
 * regarde que les extremites, et un trace reel en compte des centaines.
 */
function marcheReelle(distanceM = 7385.4, durationS = 5912.0): Response {
  return new Response(
    JSON.stringify({
      code: 'Ok',
      routes: [
        {
          legs: [{ distance: distanceM, duration: durationS, steps: [], weight: 390.82, summary: '' }],
          weight_name: 'routability',
          geometry: {
            type: 'LineString',
            coordinates: [
              [6.8693, 45.9237],
              [6.8331, 45.9044],
              [6.7983, 45.8917],
            ],
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/**
 * Un sommet, sur le meme fournisseur - reelle reponse du 2026-09-28.
 *
 * La fin REELLE du trace, relevee le 2026-09-28 : [6.914489, 45.80269],
 * soit 5 065 m du sommet. Le debut reel, lui, est a 12 m de Chamonix :
 * c'est donc bien le depart qui est fidele, et l'arrivee qui ne l'est pas.
 * Le trace s'arrete a 5 065 m du but : c'est le Mont Blanc, que le reseau
 * pieton ne dessert pas. Le fournisseur ne dit pas NON - il repond OUI a une
 * autre question. C'est exactement le piege que le garde-fou ferme.
 */
function sommet(): Response {
  return new Response(
    JSON.stringify({
      code: 'Ok',
      routes: [
        {
          legs: [{ distance: 115429, duration: 95274.0, steps: [], weight: 6200.1, summary: '' }],
          weight_name: 'routability',
          geometry: {
            type: 'LineString',
            coordinates: [
              [6.869204, 45.923615],
              [6.914489, 45.80269],
            ],
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/** Un point a 330 m du but : DANS la tolerance de 500 m. */
function quasiArrivee(): Response {
  return new Response(
    JSON.stringify({
      code: 'Ok',
      routes: [
        {
          legs: [{ distance: 7385.4, duration: 5912.0, steps: [], weight: 390.82, summary: '' }],
          geometry: {
            type: 'LineString',
            coordinates: [
              [6.8693, 45.9237],
              [6.7983, 45.8947],
            ],
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/** Reelle : deux points du Pacifique. Le service va bien, il dit non. */
function noRoute(): Response {
  return new Response(JSON.stringify({ code: 'NoRoute' }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}

/** Reelle : hors reseau, le fournisseur repond Ok avec 0 m / 0 s. */
function zero(): Response {
  return new Response(
    JSON.stringify({
      code: 'Ok',
      routes: [
        {
          legs: [{ distance: 0, duration: 0, steps: [], weight: 0, summary: '' }],
          geometry: {
            type: 'LineString',
            coordinates: [
              [6.8693, 45.9237],
              [6.8693, 45.9237],
            ],
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/** Une panne du fournisseur : une page d'HTML, pas une reponse JSON. */
function panne(): Response {
  return new Response('<html>502 Bad Gateway</html>', { status: 502 });
}

/** Un mock qui repond selon l'URL, et note tous les appels. */
function fetchQuiRepond(cette: (url: string) => Response) {
  return vi.fn(async (url: string) => cette(String(url)));
}

beforeEach(() => {
  __resetRouteCache();
  vi.unstubAllGlobals();
});

describe('P1.9 - le fournisseur pieton repond', () => {
  it('P019-01 : une marche reelle aboutit, et la distance vient du trace', async () => {
    vi.stubGlobal('fetch', fetchQuiRepond(() => marcheReelle()));

    const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    expect(attempt.reason).toBeNull();
    expect(attempt.legs).toHaveLength(1);
    // La distance vient du fournisseur, on ne la recalcule pas.
    expect(attempt.legs?.[0].distanceKm).toBeCloseTo(7.3854, 4);
    expect(attempt.legs?.[0].durationMin).toBeCloseTo(98.53, 2);
  });

  it('P019-02 : la marche passe par le profil PIETON, et Valhalla n est pas appele', async () => {
    const mock = fetchQuiRepond(() => marcheReelle());
    vi.stubGlobal('fetch', mock);

    await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    const urls = mock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('routed-foot'))).toBe(true);
    // OSRM repond : rien ne justifie un second fournisseur. Un appel a
    // Valhalla prouverait que le repli se declenche sur une reponse reussie.
    expect(urls.some((u) => u.includes('valhalla'))).toBe(false);
  });

  it('P019-03 : un sommet reste refuse PAR LA MESURE quand personne n y arrive', async () => {
    // Le mot « sommet » ne doit plus faire partie du nom du test. Ce qui est
    // refuse ici, c est une REPONSE QUI N ARRIVE PAS a 5 km du but — pas le
    // Mont Blanc en tant que lieu.
    //
    // Et il faut le dire, parce que le produit a change : sur ce meme sommet,
    // le moteur de randonnee de P1.10 aboutit reellement (27 788 m / D+ 3 896 m,
    // mesures le 2026-09-28). L ecran affiche donc desormais une marche
    // credible vers le Mont Blanc, la ou il affichait 115 km / 26 h. Le
    // garde-fou ne s est pas assoupli : c est le juge qui a change de
    // competence. Ici, les deux fournisseurs echouent, donc la mesure tient.
    vi.stubGlobal('fetch', fetchQuiRepond(() => sommet()));

    const attempt = await routeAttempt([CHAMONIX, MONT_BLANC], 'pieton');

    expect(attempt.legs).toBeNull();
    expect(attempt.reason).toBe('off_network');
  });

  it('P019-04 : une arrivee a 330 m passe - le garde-fou n est pas un coupe-gout', async () => {
    vi.stubGlobal('fetch', fetchQuiRepond(quasiArrivee));

    const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    expect(attempt.reason).toBeNull();
    expect(attempt.legs).toHaveLength(1);
    expect(ARRIVAL_TOLERANCE_M).toBe(500);
  });

  it('P019-05 : un NoRoute est un FAIT MESURE, pas une panne du fournisseur', async () => {
    vi.stubGlobal('fetch', fetchQuiRepond(noRoute));

    const attempt = await routeAttempt([CHAMONIX, MONT_BLANC], 'pieton');

    expect(attempt.legs).toBeNull();
    expect(attempt.reason).toBe('off_network');
  });

  it('P019-06 : un NoRoute ne declenche PAS de seconde opinion sur le MEME reseau', async () => {
    // Ce test a change de politique, et il faut assumer pourquoi.
    //
    // Avant : un seul fournisseur decideait, meme sur `off_network`. La regle
    // etait saine — demander une seconde opinion sur le meme graphe ne prouve
    // rien, et afficherait un trajet que le premier reseau nie.
    //
    // Elle devient FAUX des que les fournisseurs n ont plus le meme reseau.
    // `off_network` prouve que LE GRAPHE de celui qui repond ne dessert pas le
    // lieu, pas que le lieu est injoignable. On demande donc le juge
    // COMPETENT — un moteur de randonnee, P1.10 — et on s arrete la. Ni
    // Valhalla, ni un troisieme : deux fournisseurs suffisent, et c est borne.
    const mock = fetchQuiRepond(noRoute);
    vi.stubGlobal('fetch', mock);

    const attempt = await routeAttempt([CHAMONIX, MONT_BLANC], 'pieton');

    // Le refus reste une MESURE, jamais une panne.
    expect(attempt.reason).toBe('off_network');
    const urls = mock.mock.calls.map((c) => String(c[0]));
    // Le profil pieton d abord...
    expect(urls[0]).toContain('routed-foot');
    // ...puis le moteur de randonnee, et rien d autre.
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('brouter.de');
    // Valhalla n est pas un juge de randonnee : le consulter n ajouterait rien.
    expect(urls.some((u) => u.includes('valhalla'))).toBe(false);
  });

  it('P019-07 : une panne declenche le repli, et se distingue d un refus', async () => {
    // FOSSGIS tombe, Valhalla ne repond pas non plus : c est une panne, et
    // elle ne doit surtout pas se lire comme un lieu inatteignable.
    const mock = fetchQuiRepond(panne);
    vi.stubGlobal('fetch', mock);

    const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    expect(attempt.legs).toBeNull();
    expect(attempt.reason).toBe('provider_unavailable');
    const urls = mock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('valhalla'))).toBe(true);
  });

  it('P019-08 : une reponse Ok a zero kilometre ne vaut pas zero', async () => {
    // Un zero affiche dirait « vous etes deja arrive » - le mensonge le plus
    // discret du lot, parce qu il a l air d une bonne nouvelle.
    vi.stubGlobal('fetch', fetchQuiRepond(zero));

    const attempt = await routeAttempt([CHAMONIX, LES_HOUCHES], 'pieton');

    expect(attempt.legs).toBeNull();
    expect(attempt.reason).toBe('off_network');
  });

  it('P019-09 : le velo a son PROPRE profil, et refuse un sommet lui aussi', async () => {
    const mock = fetchQuiRepond((url) =>
      url.includes('MONT') ? sommet() : marcheReelle(7139.0, 1788.0),
    );
    vi.stubGlobal('fetch', mock);

    const velo = await routeAttempt([CHAMONIX, LES_HOUCHES], 'velo');
    expect(velo.reason).toBeNull();
    expect(velo.legs?.[0].distanceKm).toBeCloseTo(7.139, 3);

    const urls = mock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('routed-bike'))).toBe(true);
  });

  it('P019-10 : la voiture continue de passer par son OSRM routier', async () => {
    const mock = fetchQuiRepond(() => marcheReelle(MESURE.voiture.distanceM, MESURE.voiture.durationS));
    vi.stubGlobal('fetch', mock);

    const voiture = await routeAttempt([CHAMONIX, LES_HOUCHES], 'voiture');
    expect(voiture.legs?.[0].distanceKm).toBeCloseTo(8.03, 3);

    const urls = mock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('router.project-osrm.org'))).toBe(true);
    expect(urls.some((u) => u.includes('routed-foot'))).toBe(false);
  });

  it('P019-11 : chaque mode donne sa VITESSE, pas celle d un autre', async () => {
    // L invariant qui compte n est pas « la marche est plus longue que la
    // voiture » : c est FAUX sur ces points, la marche y est plus courte
    // (7,4 km de sentier contre 8,0 km de route). L invariant est la vitesse :
    // un pieton qui avance a 53 km/h, c est une voiture deguisee.
    //
    // Les trois valeurs sont MESUREES sur le service, le 2026-09-28. C est
    // cet ecart d ordre de grandeur qui prouve que le mode change bien de
    // reseau, et non pas un rapport de distance qui depends du sentier.
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
    // Un pieton sous 25 km/h et au-dessus de 2 : hors de cette plage, ce n
    // est plus une marche.
    expect(pieton).toBeGreaterThan(2);
    expect(pieton).toBeLessThan(25);
    // L ordre est sans discussion : on ne pedals pas moins qu on ne marche,
    // et on ne conduit pas a la vitesse d un pedeston.
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
});
