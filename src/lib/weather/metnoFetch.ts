import tzLookup from '@photostructure/tz-lookup';
import { metnoToOpenMeteo, type OpenMeteoLike } from './metnoCompat';
import { metnoGet } from './metnoRequest';

/**
 * Prévision MET Norway au format Open-Meteo, côté serveur. MET demande un
 * User-Agent qui identifie l'application et un cache : coordonnées arrondies à
 * 0,01° pour que tout le monde partage les mêmes réponses (cache de données
 * Vercel, `METNO_REVALIDATE_S`, au-delà d'`Expires`). Le User-Agent, le rythme
 * et le cache vivent dans `metnoRequest`. Échec : null, l'appelant dit
 * « indisponible ».
 */
const FORECAST = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';

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
  const json = await metnoGet(`${FORECAST}?lat=${la}&lon=${lo}`, {
    purpose: 'meteo',
    timeoutMs: opts.timeoutMs,
    signal: opts.signal,
  });
  if (!json) return null;
  try {
    return metnoToOpenMeteo(json, zone);
  } catch {
    // Une réponse mal formée ne doit jamais faire échouer l'appelant : « indisponible ».
    return null;
  }
}
