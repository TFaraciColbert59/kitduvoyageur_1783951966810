import { rateLimit, type RateLimitResult } from '@/lib/rate-limit';

/**
 * Un créneau pour tout le site auprès d'un service public partagé (plan 1.3) :
 * `perSecond` requêtes par seconde au plus, quel que soit le nombre
 * d'instances Vercel (compteur partagé en base). Une seconde pleine fait
 * attendre la suivante, quatre fois au plus ; sans créneau : false, l'appelant
 * passe au service suivant. Compteur en panne : ouvert.
 */
export async function siteSlot(
  key: string,
  perSecond: number,
  deps: {
    consume?: () => Promise<Pick<RateLimitResult, 'allowed' | 'retryAfterSeconds'>>;
    sleep?: (ms: number) => Promise<void>;
  } = {}
): Promise<boolean> {
  const consume =
    deps.consume ?? (() => rateLimit({ key: `slot:${key}`, limit: perSecond, windowMs: 1000, failMode: 'open' }));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slot = await consume();
    if (slot.allowed) return true;
    await sleep(Math.max(250, Math.min(1000, slot.retryAfterSeconds * 1000)));
  }
  return false;
}

/**
 * Photon public (komoot) : pas de clause commerciale, « usage raisonnable ».
 * Trois requêtes par seconde pour tout le site, jamais plus.
 */
export const PHOTON_PER_SECOND = 3;

export function photonSlot(): Promise<boolean> {
  return siteSlot('photon', PHOTON_PER_SECOND);
}
