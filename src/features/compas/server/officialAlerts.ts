import 'server-only';

import type { OfficialAlert } from '../engine/danger';
import {
  parseMeteoalarm,
  withinPublishedHorizon,
  type AlertsStatus,
} from '../engine/officialAlerts';
import { appUserAgent } from '@/lib/userAgent';

/**
 * Compas — alertes officielles du voyage (France : Météo-France via Meteoalarm).
 *
 * 1. Département du premier point : Nominatim, coordonnées arrondies (~1 km),
 *    User-Agent de l'application (jamais une donnée personnelle), cache 30 j.
 * 2. Hors France : statut « hors_france », rien n'est affirmé.
 * 3. Départ au-delà du lendemain : « pas_encore_publiees », sans appel réseau.
 * 4. Sinon le flux France (cache 15 min) est lu pour ce département et ces dates.
 * Toute panne rend « indisponibles » : jamais une absence d'alerte supposée.
 */

const FEED_URL = 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-france';
const NOMINATIM_UA = appUserAgent('Compas, alertes');
const TIME_ZONE = 'Europe/Paris';

export interface OfficialAlertsResult {
  status: AlertsStatus;
  alerts: OfficialAlert[];
  /** Département lu (affiché avec la source), null s'il n'a pas pu l'être. */
  area: string | null;
}

const unavailable = (area: string | null = null): OfficialAlertsResult => ({
  status: 'indisponibles',
  alerts: [],
  area,
});

async function fetchJson(url: string, revalidate: number, headers?: Record<string, string>) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      next: { revalidate },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok ? ((await res.json()) as unknown) : null;
  } catch {
    return null;
  }
}

/** Département (nom) et pays d'un point, ou null. */
export async function departementOf(
  lat: number,
  lon: number
): Promise<{ country: string; area: string | null } | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=8&addressdetails=1` +
    `&accept-language=fr&lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`;
  const json = (await fetchJson(url, 30 * 86_400, { 'User-Agent': NOMINATIM_UA })) as {
    address?: Record<string, unknown>;
  } | null;
  const address = json?.address;
  if (!address) return null;
  const country = typeof address.country_code === 'string' ? address.country_code : '';
  const pick = (k: string) => (typeof address[k] === 'string' ? (address[k] as string) : null);
  // Paris n'a pas de « county » : la ville est alors le département.
  return { country, area: pick('county') ?? pick('state_district') ?? pick('city') };
}

const todayIn = (timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());

export async function getOfficialAlerts(input: {
  point: { lat: number; lon: number } | null;
  from: string | null;
  to: string | null;
}): Promise<OfficialAlertsResult> {
  const { point, from, to } = input;
  if (!point || !from || !to) return unavailable();
  const place = await departementOf(point.lat, point.lon);
  if (!place) return unavailable();
  if (place.country !== 'fr') return { status: 'hors_france', alerts: [], area: null };
  if (!place.area) return unavailable();
  const today = todayIn(TIME_ZONE);
  if (!withinPublishedHorizon(from, to, today)) {
    // Voyage passé : rien à lire ; voyage futur : publication la veille.
    return {
      status: to < today ? 'indisponibles' : 'pas_encore_publiees',
      alerts: [],
      area: place.area,
    };
  }
  const feed = await fetchJson(FEED_URL, 900);
  if (!feed) return unavailable(place.area);
  return {
    status: 'lues',
    alerts: parseMeteoalarm(feed, {
      area: place.area,
      from,
      to,
      now: new Date(),
      fetchedAt: new Date().toISOString(),
    }),
    area: place.area,
  };
}
