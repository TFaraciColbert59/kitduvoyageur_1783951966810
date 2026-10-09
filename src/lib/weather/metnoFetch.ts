import tzLookup from '@photostructure/tz-lookup';
import { metnoToOpenMeteo, type OpenMeteoLike } from './metnoCompat';
import { appUserAgent } from '@/lib/userAgent';

/**
 * Prévision MET Norway au format Open-Meteo, côté serveur. MET demande un
 * User-Agent qui identifie l'application et un cache : coordonnées arrondies à
 * 0,01° pour que tout le monde partage les mêmes réponses (cache de données
 * Vercel, 30 min). Échec : null, l'appelant dit « indisponible ».
 */
const FORECAST = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const USER_AGENT = appUserAgent('meteo');

export async function fetchMetnoAsOpenMeteo(
  lat: number,
  lon: number,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<OpenMeteoLike | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const la = (Math.round(lat * 100) / 100).toFixed(2);
  const lo = (Math.round(lon * 100) / 100).toFixed(2);
  let zone = 'UTC';
  try {
    zone = tzLookup(lat, lon) || 'UTC';
  } catch {
    zone = 'UTC';
  }
  try {
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? 6000);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    const res = await fetch(`${FORECAST}?lat=${la}&lon=${lo}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      next: { revalidate: 1800 },
      signal,
    });
    if (!res.ok) return null;
    return metnoToOpenMeteo(await res.json(), zone);
  } catch {
    return null;
  }
}
