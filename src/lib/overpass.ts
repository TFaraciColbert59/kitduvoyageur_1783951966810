import { appUserAgent } from '@/lib/userAgent';

/**
 * Overpass — la règle du site, en un seul endroit (plan 1.4, lots B et AA).
 *
 * UN SEUL SERVEUR : overpass.private.coffee, le seul dont les conditions
 * autorisent l'usage commercial (« including commercial use », vérifié le
 * 8 octobre, `docs/compas/SERVICES-GRATUITS.md`). Le serveur principal du projet
 * Overpass et ses miroirs renvoient les usages commerciaux vers leurs propres
 * serveurs : aucun n'est appelé, aucune course entre plusieurs instances.
 *
 * UNE REQUÊTE À LA FOIS : l'opérateur demande d'éviter les requêtes simultanées.
 * Toute requête Overpass de cette instance (étapes du Compas, lieux d'une zone,
 * rivières, commodités de « Partir librement », explorateur OSM, points d'eau
 * des voyages) passe par la même file, `serializeOverpass`. La file est celle de
 * l'instance : plusieurs instances Vercel peuvent encore s'en servir en même temps,
 * mais jamais une même instance en parallèle (la limite est dite, pas cachée).
 *
 * Le garde `overpassEndpoints.test.ts` fait échouer le build si une autre instance
 * Overpass est référencée n'importe où dans `src/`.
 */
export const OVERPASS_ENDPOINTS = ['https://overpass.private.coffee/api/interpreter'] as const;

/** Une requête restée trop longtemps dans la file n'est pas envoyée : l'appelant passe à autre chose. */
export class OverpassBusyError extends Error {
  readonly code = 'OVERPASS_BUSY';
  constructor() {
    super('Overpass occupé : file d’attente trop longue');
    this.name = 'OverpassBusyError';
  }
}

let chain: Promise<unknown> = Promise.resolve();

/**
 * Réservé aux tests : une requête restée suspendue dans un test (serveur muet
 * simulé) ne doit pas retenir la file du test suivant. Les requêtes déjà parties
 * vont à leur terme, mais celles qui viennent ensuite ne les attendent plus.
 */
export function resetOverpassQueue(): void {
  chain = Promise.resolve();
}

/**
 * Exécute `task` quand toutes les requêtes Overpass de l'instance qui la précèdent
 * sont finies (réussies ou non : la file ne reste jamais bloquée par un échec).
 * `task` doit rendre la main APRÈS avoir lu la réponse, et armer son propre délai
 * quand son tour vient (jamais avant : attendre dans la file ne consomme pas le
 * délai de la requête). `maxWaitMs` : si le tour arrive plus tard que cela, la
 * requête n'est pas envoyée (`OverpassBusyError`).
 */
export function serializeOverpass<T>(task: () => Promise<T>, opts: { maxWaitMs?: number } = {}): Promise<T> {
  const queuedAt = Date.now();
  const run = async (): Promise<T> => {
    if (opts.maxWaitMs != null && Date.now() - queuedAt > opts.maxWaitMs) throw new OverpassBusyError();
    return task();
  };
  const next = chain.then(run, run);
  chain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export interface OverpassPostOptions {
  /** `appUserAgent(...)` : Overpass refuse les requêtes sans User-Agent identifiant l'application. */
  userAgent?: string;
  /** Borne la requête (par exemple `AbortSignal.timeout(...)` armé à l'entrée dans la tâche). */
  signal?: AbortSignal;
  /** Réservé aux tests et aux appelants qui reçoivent un `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * La requête elle-même (POST, requête Overpass QL dans `data`). À appeler DANS
 * `serializeOverpass`, jamais seule. Le statut et le corps restent à l'appelant.
 */
export function overpassPost(query: string, opts: OverpassPostOptions = {}): Promise<Response> {
  return (opts.fetchImpl ?? globalThis.fetch)(OVERPASS_ENDPOINTS[0], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': opts.userAgent ?? appUserAgent('Overpass'),
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: opts.signal,
    cache: 'no-store',
  });
}
