/**
 * Géométrie **réelle** d'un itinéraire, pour le hors-trace.
 *
 * `explorer_routes` renvoie volontairement une géométrie simplifiée pour
 * l'affichage (`st_simplifypreservetopology(..., 0.0008)`), dont l'écart peut
 * dépasser le seuil d'alerte de 40 m. Le hors-trace ne doit jamais mesurer sa
 * distance sur cette version : il charge la géométrie complète via
 * `get_route_geojson`, une seule fois par itinéraire armé.
 *
 * Une requête réseau ne doit jamais laisser la séance en `loading` pour
 * toujours : chaque tentative est bornée dans le temps et une erreur passagère
 * (503, coupure, délai dépassé) est retentée une fois. Un 404 reste définitif.
 *
 * Aucune dépendance React : ce module est appelé par l'écran Explorer et peut
 * être remplacé par un double dans les tests, sans réseau.
 */

export interface RouteGeometryResponse {
  geojson: unknown | null;
}

export interface FetchRouteGeometryOptions {
  /** Annulation par l'appelant (démontage, changement d'itinéraire). */
  signal?: AbortSignal;
  /** Délai maximal d'une tentative, en millisecondes. */
  timeoutMs?: number;
  /** Nombre total de tentatives (1 = aucun retry). */
  attempts?: number;
  /** Attente entre deux tentatives, en millisecondes. */
  retryDelayMs?: number;
}

export const ROUTE_GEOMETRY_TIMEOUT_MS = 6_000;
export const ROUTE_GEOMETRY_ATTEMPTS = 2;
export const ROUTE_GEOMETRY_RETRY_DELAY_MS = 400;

/** Une tentative a dépassé son délai : l'état doit passer à « indisponible ». */
export class RouteGeometryTimeoutError extends Error {
  constructor(routeId: string, timeoutMs: number) {
    super(`géométrie ${routeId} : délai de ${timeoutMs} ms dépassé`);
    this.name = 'RouteGeometryTimeoutError';
  }
}

function abortedError(): DOMException {
  return new DOMException('Requête annulée', 'AbortError');
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortedError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortedError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Une seule requête, bornée par `timeoutMs` et par le signal de l'appelant. */
async function fetchOnce(
  routeId: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<unknown | null> {
  if (signal?.aborted) throw abortedError();

  const controller = new AbortController();
  let rejectAbort: ((reason: unknown) => void) | null = null;
  const abortPromise = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => {
    controller.abort();
    rejectAbort?.(abortedError());
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new RouteGeometryTimeoutError(routeId, timeoutMs));
    }, timeoutMs);
  });

  try {
    const request = fetch(
      `/api/explorer/v2/routes/${encodeURIComponent(routeId)}/geometry`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    );
    const res = await Promise.race([request, timeoutPromise, abortPromise]);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`géométrie ${routeId} indisponible (${res.status})`);
    }
    const body = (await res.json()) as RouteGeometryResponse | null;
    return body?.geojson ?? null;
  } finally {
    clearTimeout(timer);
    rejectAbort = null;
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Renvoie `null` quand la route n'existe pas ou n'a pas de géométrie.
 *
 * Les erreurs passagères sont retentées (`attempts`, 2 par défaut) ; un délai
 * dépassé ou un abandon de l'appelant remonte immédiatement. Le dernier échec
 * est propagé pour que l'écran affiche un état « indisponible » explicite.
 */
export async function fetchRouteGeometry(
  routeId: string,
  options: FetchRouteGeometryOptions = {},
): Promise<unknown | null> {
  const {
    signal,
    timeoutMs = ROUTE_GEOMETRY_TIMEOUT_MS,
    attempts = ROUTE_GEOMETRY_ATTEMPTS,
    retryDelayMs = ROUTE_GEOMETRY_RETRY_DELAY_MS,
  } = options;

  const total = Number.isFinite(attempts) ? Math.max(1, Math.floor(attempts)) : 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < total; attempt += 1) {
    try {
      return await fetchOnce(routeId, timeoutMs, signal);
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      if (attempt < total - 1) await wait(retryDelayMs, signal);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('géométrie indisponible');
}
