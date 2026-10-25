import 'server-only';

import {
  ecccUrl,
  nwsUrl,
  readEcccAlerts,
  readNwsAlerts,
  type WorldAlertService,
  type WorldReading,
} from '../engine/worldAlerts';
import { appUserAgent } from '@/lib/userAgent';
import { readBodyBounded } from './officialAlerts';

/**
 * Compas — lecture des services d'alertes hors Europe (plan 4.9) : NWS
 * (États-Unis) et ECCC (Canada). Conditions et formes de réponse : voir
 * `engine/worldAlerts.ts`.
 *
 * - Interrupteur `COMPAS_ALERTS_WORLD` (« 1 », « on », « true ») : éteint par
 *   défaut, et rien ne change éteint (les deux pays restent « non couverts »).
 * - Une requête par point (le NWS répond pour la zone du point, ECCC pour une
 *   petite boîte testée contour par contour), `User-Agent` de l'application
 *   (exigé par le NWS ; jamais une donnée personnelle), délai de 8 s.
 * - Cache en mémoire de l'instance : 5 minutes par point (alertes émises ou levées
 *   à toute heure ; le NWS sert ses alertes avec `max-age=5`, ECCC ne chiffre
 *   rien), au plus 500 points gardés. Un appel à la fois par point ; un échec
 *   n'est pas rappelé avant une minute (le NWS lève ses limites « typically
 *   within 5 seconds », ECCC demande moins de 86 400 requêtes par jour). Une
 *   lecture de plus de 10 minutes n'est jamais resservie.
 * - Toute panne, erreur HTTP, corps trop gros ou illisible : null, que
 *   l'appelant dit « indisponibles ». Jamais « aucune alerte ».
 */

export function worldAlertsEnabled(): boolean {
  const v = (process.env.COMPAS_ALERTS_WORLD ?? '').trim().toLowerCase();
  return v === '1' || v === 'on' || v === 'true';
}

export const WORLD_TTL_MS = 5 * 60_000;
export const WORLD_MAX_STALE_MS = 10 * 60_000;
export const WORLD_RETRY_AFTER_FAILURE_MS = 60_000;
export const WORLD_TIMEOUT_MS = 8_000;
/** Une réponse par point pèse quelques ko (16 ko pour Calgary, contours compris) ; au-delà de 4 Mo, refusée. */
export const WORLD_MAX_BYTES = 4 * 1024 * 1024;
const MAX_KEPT = 500;

const USER_AGENT = appUserAgent('Compas, alertes');

interface Kept {
  at: number;
  json: unknown;
}

const lastRead = new Map<string, Kept>();
const inFlight = new Map<string, Promise<Kept | null>>();
const lastFailure = new Map<string, number>();

/** Vide le cache (tests). */
export function resetWorldAlertsCache(): void {
  lastRead.clear();
  inFlight.clear();
  lastFailure.clear();
}

function keep(url: string, read: Kept): void {
  lastRead.delete(url);
  lastRead.set(url, read);
  while (lastRead.size > MAX_KEPT) lastRead.delete(lastRead.keys().next().value as string);
}

const URLS: Record<WorldAlertService, (p: { lat: number; lon: number }) => string> = {
  nws: nwsUrl,
  eccc: ecccUrl,
};

async function download(service: WorldAlertService, url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: service === 'nws' ? 'application/geo+json' : 'application/json',
        'User-Agent': USER_AGENT,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(WORLD_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn('[compas] alertes', service, res.status);
      await res.body?.cancel().catch(() => undefined);
      return null;
    }
    const text = await readBodyBounded(res, WORLD_MAX_BYTES);
    if (text == null) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

const readerOf = (
  service: WorldAlertService,
  json: unknown,
  opts: {
    from: string;
    to: string;
    now: Date;
    fetchedAt: string;
    point: { lat: number; lon: number };
  }
): WorldReading | null =>
  service === 'nws' ? readNwsAlerts(json, opts) : readEcccAlerts(json, opts);

/**
 * Les alertes du service pour un point et des dates, avec l'instant de lecture ;
 * null si le service n'a pas répondu de façon lisible.
 */
export async function readWorldAlerts(
  service: WorldAlertService,
  point: { lat: number; lon: number },
  dates: { from: string; to: string }
): Promise<{ reading: WorldReading; readAt: string } | null> {
  const url = URLS[service](point);
  const read = (kept: Kept) => {
    const fetchedAt = new Date(kept.at).toISOString();
    const reading = readerOf(service, kept.json, { ...dates, now: new Date(), fetchedAt, point });
    return reading ? { reading, readAt: fetchedAt } : null;
  };

  const kept = lastRead.get(url);
  if (kept && Date.now() - kept.at < WORLD_TTL_MS) return read(kept);
  const failedAt = lastFailure.get(url);
  if (failedAt == null || Date.now() - failedAt >= WORLD_RETRY_AFTER_FAILURE_MS) {
    let call = inFlight.get(url);
    if (!call) {
      call = download(service, url)
        .then((json) => {
          // Un corps qui ne se lit pas comme une collection d'alertes n'est jamais gardé.
          const ok =
            json != null &&
            readerOf(service, json, { ...dates, now: new Date(), fetchedAt: '', point }) != null;
          if (!ok) {
            lastFailure.set(url, Date.now());
            return null;
          }
          lastFailure.delete(url);
          const fresh = { at: Date.now(), json };
          keep(url, fresh);
          return fresh;
        })
        .finally(() => inFlight.delete(url));
      inFlight.set(url, call);
    }
    const fresh = await call;
    if (fresh) return read(fresh);
  }
  // Le service ne répond plus : la dernière lecture ne sert que si elle a moins de 10 minutes.
  return kept && Date.now() - kept.at < WORLD_MAX_STALE_MS ? read(kept) : null;
}
