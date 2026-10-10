import 'server-only';

import type { OfficialAlert } from '../engine/danger';
import {
  digestMeteoalarm,
  readDigest,
  withinPublishedHorizon,
  type AlertsStatus,
  type FeedDigest,
} from '../engine/officialAlerts';
import { METEOALARM_FEEDS, feedUrl, type MeteoalarmFeed } from '../engine/meteoalarmFeeds';
import { localToday, safeTimeZone } from '../engine/zone';
import { appUserAgent } from '@/lib/userAgent';

/**
 * Compas — alertes officielles du voyage (Meteoalarm : services nationaux
 * d'Europe, conditions d'usage lues le 2026-10-10, voir `meteoalarmFeeds.ts`).
 *
 * 1. Pays et unités administratives du premier point : Nominatim, coordonnées
 *    arrondies (~1 km), User-Agent de l'application (jamais une donnée
 *    personnelle), cache 30 j. Les noms sont ceux du pays (pas traduits) : ce
 *    sont ceux que les services nationaux emploient pour leurs zones.
 * 2. Pays absent de la table des flux : « non_couvert », rien n'est affirmé.
 * 3. Départ au-delà du lendemain : « pas_encore_publiees », sans appel réseau.
 * 4. Sinon le flux du pays est lu (cache de 5 minutes) et la zone du lieu y est
 *    cherchée : contour qui couvre le lieu, ou nom exact d'une unité
 *    administrative. Zone introuvable : « zone_non_rapprochee ». Jamais une
 *    absence d'alerte supposée.
 * Toute panne rend « indisponibles ».
 *
 * FRAÎCHEUR. Meteoalarm exige que l'information soit redonnée « en temps réel » :
 * retard moyen inférieur à 5 minutes, jamais plus de 10 (conditions, § 5).
 * Le cache de données de Next/Vercel sert une entrée périmée pendant qu'il la
 * renouvelle (stale-while-revalidate) : un voyageur pouvait alors lire des
 * alertes vieilles de plusieurs heures. Les flux sont donc lus `no-store` et
 * gardés ici, en mémoire de l'instance, 5 minutes exactement ; une panne du
 * flux ne ressert JAMAIS une lecture de plus de 10 minutes. Un seul appel par
 * pays à la fois (les appels simultanés partagent la même requête). Les flux
 * pèsent jusqu'à 5 Mo (Israël) : le cache de Next les refuse au-delà de 2 Mo,
 * et on ne garde que la réduction (`digestMeteoalarm`).
 */

/** Âge au-delà duquel un flux est relu (conditions : moyenne < 5 min). */
export const FEED_TTL_MS = 5 * 60_000;
/** Âge limite absolu d'une lecture servie quand le flux ne répond plus (conditions : jamais > 10 min). */
export const FEED_MAX_STALE_MS = 10 * 60_000;
const FEED_TIMEOUT_MS = 12_000;

const USER_AGENT = appUserAgent('Compas, alertes');
const TIME_ZONE = 'Europe/Paris';

export interface OfficialAlertsResult {
  status: AlertsStatus;
  alerts: OfficialAlert[];
  /** Zone lue (affichée avec la source), null si le lieu n'a pas pu être situé. */
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

/** Unités administratives que la carte donne, de la plus fine à la plus large. */
const ADDRESS_LEVELS = ['county', 'state_district', 'municipality', 'city', 'state'] as const;

export interface PlaceAreas {
  /** Code pays ISO alpha-2 en minuscules. */
  country: string;
  /** Noms des unités administratives du lieu, du plus fin au plus large. */
  names: string[];
}

/** Pays et unités administratives d'un point, ou null. */
export async function placeAreasOf(lat: number, lon: number): Promise<PlaceAreas | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=8&addressdetails=1` +
    `&lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`;
  const json = (await fetchJson(url, 30 * 86_400, { 'User-Agent': USER_AGENT })) as {
    address?: Record<string, unknown>;
  } | null;
  const address = json?.address;
  if (!address) return null;
  const country = typeof address.country_code === 'string' ? address.country_code.toLowerCase() : '';
  if (!country) return null;
  const names: string[] = [];
  for (const level of ADDRESS_LEVELS) {
    const v = address[level];
    if (typeof v === 'string' && v.trim() && !names.includes(v.trim())) names.push(v.trim());
  }
  return { country, names };
}

/* ------------------------------------------------------------------ */
/* Flux : cache de 5 minutes par instance, un appel à la fois par pays */
/* ------------------------------------------------------------------ */

interface FeedRead {
  /** Instant de la lecture (ms). */
  at: number;
  digest: FeedDigest;
}

const lastRead = new Map<string, FeedRead>();
const inFlight = new Map<string, Promise<FeedRead | null>>();

/** Vide le cache des flux (tests). */
export function resetOfficialAlertsCache(): void {
  lastRead.clear();
  inFlight.clear();
}

async function downloadFeed(feed: MeteoalarmFeed): Promise<FeedDigest | null> {
  try {
    const res = await fetch(feedUrl(feed), {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      cache: 'no-store',
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn('[compas] Meteoalarm', feed.slug, res.status);
      return null;
    }
    const digest = digestMeteoalarm(await res.json());
    // Un corps qui n'est pas un flux, ou dont rien n'a pu être lu : jamais gardé.
    return digest && !digest.unreadable ? digest : null;
  } catch {
    return null;
  }
}

async function loadFeed(feed: MeteoalarmFeed): Promise<FeedRead | null> {
  const kept = lastRead.get(feed.slug);
  if (kept && Date.now() - kept.at < FEED_TTL_MS) return kept;
  let call = inFlight.get(feed.slug);
  if (!call) {
    call = downloadFeed(feed)
      .then((digest) => {
        if (!digest) return null;
        const read = { at: Date.now(), digest };
        lastRead.set(feed.slug, read);
        return read;
      })
      .finally(() => inFlight.delete(feed.slug));
    inFlight.set(feed.slug, call);
  }
  const fresh = await call;
  if (fresh) return fresh;
  // Le flux ne répond plus : la dernière lecture ne sert que si elle a moins de 10 minutes.
  return kept && Date.now() - kept.at < FEED_MAX_STALE_MS ? kept : null;
}

export async function getOfficialAlerts(input: {
  point: { lat: number; lon: number } | null;
  from: string | null;
  to: string | null;
  /** Fuseau de la destination : le « aujourd'hui » de l'horizon publié. */
  timeZone?: string | null;
}): Promise<OfficialAlertsResult> {
  const { point, from, to } = input;
  if (!point || !from || !to) return unavailable();
  const place = await placeAreasOf(point.lat, point.lon);
  if (!place) return unavailable();
  const feed = METEOALARM_FEEDS[place.country];
  if (!feed) return { status: 'non_couvert', alerts: [], area: null };
  const today = localToday(safeTimeZone(input.timeZone) ?? TIME_ZONE);
  const area = place.names[0] ?? null;
  if (!withinPublishedHorizon(from, to, today)) {
    // Voyage passé : rien à lire ; voyage futur : publication la veille.
    return { status: to < today ? 'indisponibles' : 'pas_encore_publiees', alerts: [], area };
  }
  const read = await loadFeed(feed);
  if (!read) return unavailable(area);
  const { alerts, knowledge } = readDigest(read.digest, {
    names: place.names,
    point,
    from,
    to,
    now: new Date(),
    // L'heure de lecture du flux, pas celle de l'affichage : c'est elle qui date l'information.
    fetchedAt: new Date(read.at).toISOString(),
    feed,
  });
  const status: AlertsStatus =
    knowledge === 'complete' ? 'lues' : knowledge === 'partielle' ? 'partielles' : 'zone_non_rapprochee';
  return { status, alerts, area: alerts[0]?.area ?? area };
}
