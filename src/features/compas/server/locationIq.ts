import 'server-only';
import { rateLimit, type RateLimitResult } from '@/lib/rate-limit';

/**
 * LocationIQ (offre gratuite : 5 000 requêtes par jour, 2 par seconde ; usage
 * commercial autorisé avec un lien visible vers locationiq.com, vérifié le
 * 8 octobre, `docs/compas/SERVICES-GRATUITS.md`). Même moteur et mêmes
 * données que Nominatim (OpenStreetMap), dont le serveur public interdit le
 * trafic régulier d'une application (« periodic requests from apps are
 * considered bulk geocoding »).
 *
 * UN SEUL CLIENT pour tout le site (plan 1.3, lot AA) : `nominatimJson` est
 * le seul code qui appelle Nominatim ou LocationIQ ; le Compas (`placeLookup`),
 * les alertes officielles (`officialAlerts`) et le géocodage du préparateur
 * (`adventure-prep/geocodeService`) y passent. Avec la clé
 * `LOCATIONIQ_API_KEY`, tout part chez LocationIQ (2 requêtes par seconde pour
 * tout le site, une à la fois par instance).
 *
 * SANS CLÉ (développement, tests, déploiement sans compte LocationIQ) : le
 * comportement d'avant est gardé, c'est-à-dire le serveur public de Nominatim,
 * une requête à la fois, au plus une par seconde, avec le User-Agent de
 * l'application. Ce repli n'est PAS un régime de production : la clé doit être
 * posée (`/api/compas/sources` dit si elle est lue).
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/';
const LOCATIONIQ = 'https://eu1.locationiq.com/v1/';

export function locationIqKey(env: Record<string, string | undefined> = process.env): string | null {
  const k = env.LOCATIONIQ_API_KEY?.trim();
  return k ? k : null;
}

/**
 * L'adresse LocationIQ d'une requête Nominatim (`search` ou `reverse`), ou
 * null si ce n'en est pas une. Paramètres identiques ; `format=json` (LocationIQ
 * ne connaît pas `jsonv2`) et la clé en plus.
 */
export function locationIqUrl(nominatimUrl: string, key: string): string | null {
  if (!nominatimUrl.startsWith(NOMINATIM)) return null;
  const url = new URL(nominatimUrl);
  const path = url.pathname.replace(/^\/+/, '');
  if (path !== 'search' && path !== 'reverse') return null;
  const params = new URLSearchParams(url.search);
  params.set('format', 'json');
  params.set('key', key);
  return `${LOCATIONIQ}${path}?${params.toString()}`;
}

/**
 * Les lignes LocationIQ dans la forme `jsonv2` que lit `parseNominatim` : le
 * nom (absent du format `json`), la catégorie et le type d'adresse.
 */
export function normalizeLocationIq(payload: unknown): Array<Record<string, unknown>> {
  const rows = Array.isArray(payload) ? payload : payload && typeof payload === 'object' ? [payload] : [];
  return (rows as Array<Record<string, unknown>>).map((r) => {
    const details = (r.namedetails ?? {}) as Record<string, unknown>;
    const first = typeof r.display_name === 'string' ? r.display_name.split(',')[0]?.trim() : '';
    const name =
      (typeof r.name === 'string' && r.name.trim()) ||
      (typeof details.name === 'string' && details.name.trim()) ||
      first ||
      '';
    return {
      ...r,
      name,
      category: r.category ?? r.class,
      addresstype: r.addresstype ?? r.type,
    };
  });
}

/**
 * Un créneau LocationIQ pour tout le site : l'offre gratuite accepte 2
 * requêtes par seconde pour la clé, quel que soit le nombre d'instances
 * Vercel (au-delà : 429). Le compteur partagé en base décide ; une seconde
 * pleine fait attendre la suivante, quatre fois au plus. Sans créneau :
 * false, l'appelant passe au service suivant (Geoapify).
 */
export async function locationIqSlot(
  deps: {
    consume?: () => Promise<Pick<RateLimitResult, 'allowed' | 'retryAfterSeconds'>>;
    sleep?: (ms: number) => Promise<void>;
  } = {}
): Promise<boolean> {
  const consume =
    deps.consume ?? (() => rateLimit({ key: 'locationiq:site', limit: 2, windowMs: 1000, failMode: 'open' }));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slot = await consume();
    if (slot.allowed) return true;
    await sleep(Math.max(250, Math.min(1000, slot.retryAfterSeconds * 1000)));
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Le client : Nominatim ou LocationIQ, une requête à la fois          */
/* ------------------------------------------------------------------ */

/** Intervalle entre deux requêtes de cette instance : 2 par seconde chez LocationIQ. */
export const LOCATIONIQ_GAP_MS = 550;
/** Intervalle chez Nominatim public (sans clé) : au plus une requête par seconde. */
export const NOMINATIM_GAP_MS = 1100;
const DEFAULT_TIMEOUT_MS = 8000;

let chain: Promise<unknown> = Promise.resolve();
let lastStartAt = 0;

/** Réservé aux tests : remet à zéro l'horloge de cadence (état de module, partagé par tous les appelants). */
export function resetNominatimClock(): void {
  lastStartAt = 0;
}

export interface NominatimCallOptions {
  /** `appUserAgent(...)` : l'application nommée, avec un moyen de la joindre. */
  userAgent: string;
  /** Si fourni, c'est LUI qui borne la requête (le minuteur de l'appelant) ; sinon `timeoutMs`. */
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Réservé aux tests. */
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  slot?: () => Promise<boolean>;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Une requête de géocodage Nominatim (`search` ou `reverse`, mêmes paramètres
 * que le Nominatim public), rendue dans la forme `jsonv2` que lisent tous les
 * appelants : la liste (`search`) ou l'objet (`reverse`) avec `name`,
 * `category`, `addresstype`, que LocationIQ ne donne pas en `json`.
 *
 * - avec la clé : LocationIQ, après un créneau du site (2 par seconde) ; pas de
 *   créneau, c'est comme une panne ;
 * - sans clé : Nominatim public, au plus une requête par seconde, avec le
 *   User-Agent de l'application ;
 * - un appel à la fois dans cette instance (file unique, quel que soit
 *   l'appelant), jamais d'exception : tout échec (réseau, statut, corps qui
 *   n'est pas du JSON, délai) rend null, et la file continue.
 *
 * La clé est dans l'adresse envoyée à LocationIQ : elle n'est jamais journalisée
 * (seul l'hôte l'est).
 */
export function nominatimJson(url: string, opts: NominatimCallOptions): Promise<unknown | null> {
  const run = () => nominatimNow(url, opts);
  const next = chain.then(run, run);
  chain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function nominatimNow(url: string, opts: NominatimCallOptions): Promise<unknown | null> {
  // Ce client ne parle qu'à Nominatim (ou à LocationIQ à sa place) : aucune autre adresse.
  if (!url.startsWith(NOMINATIM)) return null;
  const key = locationIqKey(opts.env);
  const via = key ? locationIqUrl(url, key) : null;
  const target = via ?? url;
  let host = 'nominatim';
  try {
    host = new URL(target).host;
  } catch {
    return null;
  }
  if (via && !(await (opts.slot ?? locationIqSlot)())) {
    console.warn('[carte] LocationIQ : pas de créneau libre');
    return null;
  }
  const wait = lastStartAt + (via ? LOCATIONIQ_GAP_MS : NOMINATIM_GAP_MS) - Date.now();
  if (wait > 0) await (opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))))(wait);
  if (opts.signal?.aborted) return null;
  lastStartAt = Date.now();
  try {
    const res = await (opts.fetchImpl ?? globalThis.fetch)(target, {
      headers: { Accept: 'application/json', 'User-Agent': opts.userAgent },
      signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('[carte]', host, res.status);
      return null;
    }
    const payload: unknown = await res.json();
    if (!via) return payload;
    // La recherche rend une liste, le géocodage inverse un seul lieu.
    const rows = normalizeLocationIq(payload);
    return Array.isArray(payload) ? rows : (rows[0] ?? null);
  } catch (err) {
    console.warn('[carte] injoignable', host, err instanceof Error ? err.message : 'erreur');
    return null;
  }
}
