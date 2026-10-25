/**
 * I5 — le debit de routage est borne, et le refus est HONNETE.
 *
 * `MAX_ROUTE_POINTS = 12` borne la taille d UNE requete. Rien ne boundait le
 * nombre de requetes : une journee de N etapes, regeneree apres chaque
 * ajustement, pouvait aligner le quota d un routeur public (Valhalla
 * FOSSGIS), partage avec tous ses autres utilisateurs. Un quota epuise ne rend pas de
 * donnee fausse, il rend une panne : la regle du service est qu un refus vaut
 * `null`, jamais une distance approchee. C est ce que ces tests verrouillent.
 *
 * Aucun test ici n ecrit un nombre de requetes en dur : ils lisent
 * `RATE_BURST` et `RATE_REFILL_PER_SEC`. Une constante dimentionnee sur un
 * trajet de sept jours ne doit pas pouvoir casser un test ecrit pour un
 * week-end — ni l inverse. Les points de controle sont, eux, volontairement
 * loin du numbered range du seau : sinon ils retomberaient dans le CACHE, et
 * le test mesurerait une reponse memorizee au lieu du debit.
 *
 * L horloge est simulee. Un limiteur de debit teste avec le temps reel dort
 * erait jusqu au prochain run, et un test qui dort ne prouve rien.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RATE_BURST,
  RATE_REFILL_PER_SEC,
  __resetRouteCache,
  __resetRouteLimiter,
  routeAttempt,
} from '../routingService';
import type { RoutePoint } from '../routingService';
import { geoapifyReply, isGeoapify, jsonResponse, valhallaReply } from './fakeRouters';

const CHAMONIX: RoutePoint = { lat: 45.9237, lon: 6.8693 };
const LES_HOUCHES: RoutePoint = { lat: 45.8917, lon: 6.7983 };

/** Aucune de ces sondes ne peut tomber dans le cache du seau. */
const HORS_CACHE = 100_000;

/** Chaque URL reellement demandee, dans l ordre. */
let urls: string[] = [];

/**
 * La geometrie est RECONSTITUEE depuis les points demandes (`fakeRouters`) :
 * un routeur rend toujours la trace du trajet qu on lui a demande. Sans cle
 * Geoapify, chaque mesure part vers Valhalla, en UNE requete : le compte des
 * URL est donc le compte des mesures.
 */
function installerFetch() {
  urls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const texte = String(url);
      urls.push(texte);
      return jsonResponse(isGeoapify(texte) ? geoapifyReply(texte) : valhallaReply(texte));
    }),
  );
}

/** Deux points differents a chaque fois, pour ne pas toucher le cache. */
function pointsDecales(index: number): RoutePoint[] {
  const decale = index * 1e-5;
  return [
    { lat: CHAMONIX.lat + decale, lon: CHAMONIX.lon + decale },
    { lat: LES_HOUCHES.lat + decale, lon: LES_HOUCHES.lon + decale },
  ];
}

/** Vide le seau, et renvoie le nombre d URL parties. */
async function viderLeSeau(): Promise<number> {
  for (let i = 0; i < RATE_BURST; i += 1) {
    const mesure = await routeAttempt(pointsDecales(i + 1), 'pieton');
    expect(mesure.legs).not.toBeNull();
  }
  return urls.length;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-29T08:00:00Z'));
  __resetRouteCache();
  __resetRouteLimiter();
  vi.stubEnv('GEOAPIFY_API_KEY', '');
  installerFetch();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('I5 — le debit de routage est borne', () => {
  it('refuse une fois le budget epuise, sans partir sur le reseau', async () => {
    const urlsApresLeSeau = await viderLeSeau();
    expect(urlsApresLeSeau).toBe(RATE_BURST);

    // La seine est maintenant vide : plus aucune requete ne doit partir, et
    // repousser ne rend rien — le refus n attend pas, il compte.
    let dernier = await routeAttempt(pointsDecales(HORS_CACHE), 'pieton');
    for (let i = 0; i < 40; i += 1) {
      dernier = await routeAttempt(pointsDecales(HORS_CACHE + i + 1), 'pieton');
    }

    expect(dernier.legs).toBeNull();
    expect(dernier.reason).toBe('rate_limited');
    expect(urls.length).toBe(urlsApresLeSeau);
  });

  it('le nombre de requetes envoyees reste borne, meme en rafale', async () => {
    for (let i = 0; i < RATE_BURST; i += 1) {
      await routeAttempt(pointsDecales(i + 1), 'pieton');
    }
    // La capacite du seau, pas le nombre d appels. Sans limiteur : RATE_BURST.
    expect(urls.length).toBe(RATE_BURST);
  });

  it('un refus de debit ne renvoie JAMAIS de distance : il ne reste que null', async () => {
    for (let i = 0; i < RATE_BURST + 40; i += 1) {
      const attempt = await routeAttempt(pointsDecales(i + 1), 'pieton');
      if (attempt.reason === 'rate_limited') {
        expect(attempt.legs).toBeNull();
        expect(attempt.provider).toBeUndefined();
        return;
      }
    }
    throw new Error('le budget n a jamais ete epuise : le test ne prouve plus rien');
  });

  it('le budget se reconstitue avec le temps', async () => {
    await viderLeSeau();
    const bloque = await routeAttempt(pointsDecales(HORS_CACHE), 'pieton');
    expect(bloque.reason).toBe('rate_limited');

    // Une seconde rend RATE_REFILL_PER_SEC jetons : de quoi repartir, et pas
    // plus — la reprise est proportionnelle, elle n est pas une impasse.
    vi.advanceTimersByTime(1000);
    const repris = await routeAttempt(pointsDecales(HORS_CACHE + 1), 'pieton');
    expect(repris.reason).toBeNull();
    expect(repris.legs).not.toBeNull();
  });

  it('le temps qui s ecoule rend le seau PLEIN, jamais plus que sa capacite', async () => {
    await viderLeSeau();
    expect(urls.length).toBe(RATE_BURST);

    // Une immobilite d une heure recharge 3600 x RATE_REFILL_PER_SEC jetons.
    // Sans plafond, le credit interet de 72 000 jetons laisserait partir
    // soixante mille requetes d affilee : c est exactement ce que le seau
    // interdit. Il rend donc RATE_BURST jetons, ni un de plus.
    vi.advanceTimersByTime(3_600_000);
    for (let i = 0; i < RATE_BURST; i += 1) {
      const mesure = await routeAttempt(pointsDecales(HORS_CACHE + i), 'pieton');
      expect(mesure.reason).toBeNull();
    }
    expect(urls.length).toBe(RATE_BURST * 2);

    // La capacite, une fois atteinte, redevient un refus.
    const trop = await routeAttempt(pointsDecales(HORS_CACHE + RATE_BURST), 'pieton');
    expect(trop.reason).toBe('rate_limited');
    expect(urls.length).toBe(RATE_BURST * 2);
  });

  it('une reponse servie par le cache ne consomme aucun budget', async () => {
    const points = pointsDecales(1);
    const premier = await routeAttempt(points, 'pieton');
    expect(premier.legs).not.toBeNull();
    const urlsApresPremier = urls.length;

    // Meme demande, dix fois : le cache doit suffire, sinon on vide le budget
    // pour une information que l on a deja.
    for (let i = 0; i < 10; i += 1) {
      const identique = await routeAttempt(points, 'pieton');
      expect(identique.legs).not.toBeNull();
    }
    expect(urls.length).toBe(urlsApresPremier);
  });

  it('__resetRouteLimiter rend le budget : sans lui, aucun test ne serait isole', async () => {
    await viderLeSeau();
    __resetRouteLimiter();
    const apresReset = await routeAttempt(pointsDecales(HORS_CACHE), 'pieton');
    expect(apresReset.legs).not.toBeNull();
  });
});