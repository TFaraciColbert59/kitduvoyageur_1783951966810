import { appUserAgent } from '@/lib/userAgent';

/**
 * MET Norway (plan 1.8), le seul point d'accès du site. Conditions d'usage :
 * User-Agent qui identifie l'application, 20 requêtes par seconde au plus,
 * ne pas redemander une prévision avant son `Expires`.
 *
 * - Une seule identité, une seule URL : un User-Agent unique (`USER_AGENT`) et
 *   un seul constructeur d'URL (`metnoForecastUrl`, point arrondi à 0,01°).
 *   Le cache de données de Next/Vercel calcule sa clé à partir de l'URL ET des
 *   en-têtes : si un appelant changeait l'un ou l'autre, le même point aurait
 *   deux entrées de cache, donc deux requêtes à MET avant `Expires`. Tous les
 *   appelants (Compas, pages pays, matériel, préparation) partagent donc une
 *   seule entrée par point.
 * - Rythme : au plus 20 départs dans toute fenêtre d'une seconde, par instance
 *   de fonction. À l'échelle du site, le cache de données partagé de Vercel
 *   absorbe les répétitions (même point, même URL, mêmes en-têtes).
 * - Cache : `Expires` tombe ~32 min après la réponse (mesuré le 9 oct.). Les 45
 *   min (`METNO_REVALIDATE_S`) sont donc FIXÉES d'après cette mesure, pas lues
 *   dans l'en-tête `Expires` de chaque réponse ; elles restent au-delà tant que
 *   MET garde un `Expires` inférieur à 45 min, à revérifier si cela change.
 */
export const METNO_MAX_PER_SECOND = 20;
export const METNO_REVALIDATE_S = 2700;

const FORECAST = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const USER_AGENT = appUserAgent('meteo');

const at2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2);

/** URL de prévision d'un point, arrondi à 0,01° (~1 km) : le même point donne toujours la même URL. */
export function metnoForecastUrl(lat: number, lon: number): string {
  return `${FORECAST}?lat=${at2(lat)}&lon=${at2(lon)}`;
}

let sent: number[] = [];

/** Attend, si besoin, qu'un départ soit permis par la fenêtre glissante d'une seconde. */
export async function metnoSlot(
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<void> {
  for (;;) {
    const t = now();
    sent = sent.filter((s) => t - s < 1000);
    if (sent.length < METNO_MAX_PER_SECOND) {
      sent.push(t);
      return;
    }
    await sleep(1000 - (t - sent[0]) + 1);
  }
}

/** Remet la fenêtre à zéro (tests). */
export function resetMetnoSlots(): void {
  sent = [];
}

/** GET JSON vers MET Norway ; null si la réponse n'est pas exploitable. */
export async function metnoGet(
  url: string,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<unknown | null> {
  await metnoSlot();
  try {
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? 6000);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      next: { revalidate: METNO_REVALIDATE_S },
      signal,
    } as RequestInit);
    if (!res.ok) {
      console.warn('[meteo] MET Norway', res.status);
      return null;
    }
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}
