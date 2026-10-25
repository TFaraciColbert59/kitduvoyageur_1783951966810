/**
 * Crédits du jour des services gratuits (plan 1.3) : `take_api_credits` en
 * base, un compteur par service et par jour (UTC), pris de façon atomique par
 * toutes les instances Vercel. Appelé par la clé de service, par PostgREST
 * (jamais `serviceClient` : ce module reste importable partout).
 *
 * Sans base configurée ou en panne : `failOpen` décide. Pour Geoapify, ouvert :
 * au-delà de son offre, Geoapify refuse lui-même (429), sans facture, et le
 * service suivant répond.
 */
import { isPostgresConfigured, readPostgresEnv } from '@/lib/rate-limit/postgresStore';

/** Geoapify, offre gratuite : 3 000 crédits par jour ; le site s'arrête à 2 700. */
export const GEOAPIFY_DAILY_CREDITS = 2700;

export interface TakeCreditsOptions {
  /** Réponse quand le compteur ne répond pas (défaut : true, ouvert). */
  failOpen?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Prend `cost` crédits de `service` si le total du jour reste sous `limit`. */
export async function takeApiCredits(
  service: string,
  cost: number,
  limit: number,
  options: TakeCreditsOptions = {}
): Promise<boolean> {
  const failOpen = options.failOpen ?? true;
  const credits = Math.max(1, Math.ceil(cost));
  if (credits > limit) return false;
  const env = readPostgresEnv();
  if (!isPostgresConfigured(env)) return failOpen;
  const baseUrl = (env.supabaseUrl ?? '').trim().replace(/\/+$/, '');
  const serviceKey = (env.serviceRoleKey ?? '').trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 1500);
  try {
    const response = await (options.fetchImpl ?? fetch)(`${baseUrl}/rest/v1/rpc/take_api_credits`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ p_service: service, p_cost: credits, p_limit: limit }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) return failOpen;
    const payload = (await response.json()) as unknown;
    return typeof payload === 'boolean' ? payload : failOpen;
  } catch {
    return failOpen;
  } finally {
    clearTimeout(timer);
  }
}
