import { appUserAgent } from '@/lib/userAgent';

/**
 * MET Norway (plan 1.8), le seul point d'accès du site. Conditions d'usage :
 * User-Agent qui identifie l'application, 20 requêtes par seconde au plus,
 * ne pas redemander une prévision avant son `Expires`.
 *
 * - Rythme : au plus 20 départs dans toute fenêtre d'une seconde, par instance
 *   de fonction. À l'échelle du site, le cache de données partagé de Vercel
 *   absorbe les répétitions (même point arrondi à 0,01°, même URL).
 * - Cache : `Expires` tombe ~32 min après la réponse (mesuré le 9 oct.) ; le
 *   cache garde 45 min, donc rien n'est redemandé avant `Expires`.
 */
export const METNO_MAX_PER_SECOND = 20;
export const METNO_REVALIDATE_S = 2700;

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
  opts: { purpose: string; timeoutMs?: number; signal?: AbortSignal }
): Promise<unknown | null> {
  await metnoSlot();
  try {
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? 6000);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    const res = await fetch(url, {
      headers: { 'User-Agent': appUserAgent(opts.purpose), Accept: 'application/json' },
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
