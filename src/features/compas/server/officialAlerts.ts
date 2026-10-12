import 'server-only';

import type { OfficialAlert } from '../engine/danger';
import {
  cleanText,
  digestMeteoalarm,
  normalizeArea,
  readDigest,
  withinPublishedHorizon,
  type AlertsStatus,
  type FeedDigest,
} from '../engine/officialAlerts';
import { METEOALARM_FEEDS, feedUrl, type MeteoalarmFeed } from '../engine/meteoalarmFeeds';
import { localToday, safeTimeZone } from '../engine/zone';
import { appUserAgent } from '@/lib/userAgent';
import { nominatimJson } from './locationIq';
import { cached } from './sharedCache';

/**
 * Compas — alertes officielles du voyage (Meteoalarm : services nationaux
 * d'Europe, conditions d'usage lues le 2026-10-10 et relues le 2026-10-11, voir
 * `meteoalarmFeeds.ts`).
 *
 * 1. Pays et unités administratives du premier point : la carte Nominatim, par le
 *    client commun du site (`locationIq.ts` : LocationIQ avec la clé, jamais le
 *    serveur public en trafic courant ; plan 1.3), coordonnées arrondies (~1 km),
 *    User-Agent de l'application (jamais une donnée personnelle), cache 30 j
 *    partagé. Les noms sont ceux du pays (pas traduits) : ce sont ceux que les
 *    services nationaux emploient pour leurs zones.
 * 2. Pays absent de la table des flux : « non_couvert », rien n'est affirmé. Les
 *    départements d'outre-mer, que la carte nomme aussi « fr », sont dans ce cas :
 *    seul le flux France MÉTROPOLITAINE existe.
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
 * pays à la fois (les appels simultanés partagent la même requête), et un flux
 * qui vient d'échouer n'est pas rappelé avant une minute. Les flux
 * pèsent jusqu'à 5 Mo (Israël) : le cache de Next les refuse au-delà de 2 Mo,
 * et on ne garde que la réduction (`digestMeteoalarm`).
 *
 * ENTRÉE NON FIABLE. Le flux est celui d'un tiers : sa taille est bornée avant
 * d'être lue en entier (`FEED_MAX_BYTES`), il n'est jamais interprété comme du
 * HTML, et `digestMeteoalarm` borne et nettoie chaque texte et chaque adresse.
 * Un flux vide, illisible, trop gros ou en erreur n'est jamais pris pour un
 * pays calme : « indisponibles ». L'heure de lecture du flux (`readAt`) est
 * donnée à l'écran avec l'avertissement de Meteoalarm.
 */

/** Âge au-delà duquel un flux est relu (conditions : moyenne < 5 min). */
export const FEED_TTL_MS = 5 * 60_000;
/** Âge limite absolu d'une lecture servie quand le flux ne répond plus (conditions : jamais > 10 min). */
export const FEED_MAX_STALE_MS = 10 * 60_000;
/**
 * Après un échec (panne, flux vide, trop gros, illisible), le flux n'est pas redemandé
 * avant cette durée : sans cela, chaque ouverture du Compas rappellerait un service en
 * difficulté. Aucune fréquence n'est chiffrée par Meteoalarm ; une minute au plus.
 */
export const FEED_RETRY_AFTER_FAILURE_MS = 60_000;
const FEED_TIMEOUT_MS = 12_000;
/**
 * Taille maximale d'un flux lu : le plus gros relevé le 11 oct. 2026 pèse 4,9 Mo
 * (Israël), le suivant 3 Mo (Allemagne). Au-delà de 12 Mo, le flux est refusé
 * sans être lu jusqu'au bout.
 */
export const FEED_MAX_BYTES = 12 * 1024 * 1024;

const USER_AGENT = appUserAgent('Compas, alertes');
const TIME_ZONE = 'Europe/Paris';

export interface OfficialAlertsResult {
  status: AlertsStatus;
  alerts: OfficialAlert[];
  /** Zone lue (affichée avec la source), null si le lieu n'a pas pu être situé. */
  area: string | null;
  /** Instant où le flux a été lu (ISO), null si aucun flux n'a servi. Affiché avec l'avertissement de Meteoalarm. */
  readAt?: string | null;
}

const unavailable = (area: string | null = null): OfficialAlertsResult => ({
  status: 'indisponibles',
  alerts: [],
  area,
  readAt: null,
});

/**
 * Le corps d'une réponse, lu par morceaux et abandonné dès qu'il dépasse `max`
 * octets (un `Content-Length` trop grand refuse avant toute lecture). Trop gros :
 * null.
 */
export async function readBodyBounded(res: Response, max: number): Promise<string | null> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!res.body) {
    const text = await res.text();
    return Buffer.byteLength(text) > max ? null : text;
  }
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  // TextDecoder retire l'éventuelle marque d'ordre des octets, que JSON.parse refuserait.
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Unités administratives que la carte donne, de la plus fine à la plus large. */
const ADDRESS_LEVELS = ['county', 'state_district', 'municipality', 'city', 'state'] as const;

export interface PlaceAreas {
  /** Code pays ISO alpha-2 en minuscules. */
  country: string;
  /** Noms des unités administratives du lieu, du plus fin au plus large. */
  names: string[];
  /**
   * Lieu « fr » pour la carte mais pas établi comme métropolitain (La Réunion,
   * Guadeloupe, Martinique, Guyane, Mayotte… : la carte leur donne aussi « fr »).
   * Le flux France ne nomme que les départements métropolitains.
   */
  overseas?: true;
}

/** Code ISO 3166-2 d'un département métropolitain (niveau 6) : « FR-74 », « FR-2B », « FR-69M ». Les outre-mer ont trois chiffres. */
const METROPOLITAN_DEPARTMENT = /^FR-(?:\d{2}|2[AB])[A-Z]?$/;

/**
 * France métropolitaine, Corse comprise : aucune terre d'outre-mer n'est dans ce
 * cadre (la plus proche, Saint-Pierre-et-Miquelon, est à 56° ouest). Ne sert qu'avec
 * un lieu déjà donné « fr » par la carte, quand son adresse ne dit pas autrement.
 */
export function inMetropolitanFrance(lat: number, lon: number): boolean {
  return lat >= 41.2 && lat <= 51.3 && lon >= -5.5 && lon <= 9.8;
}

/**
 * La carte place un lieu en France métropolitaine : `region` « France métropolitaine »
 * ou code de département. Une adresse qui ne porte NI l'un NI l'autre (LocationIQ ne
 * donne pas forcément ces clés de Nominatim) ne prouve rien : le point décide, par le
 * cadre de la métropole. Une adresse qui dit autre chose (« La Réunion ») reste outre-mer.
 */
function isMetropolitanFrance(address: Record<string, unknown>, at: { lat: number; lon: number }): boolean {
  const regionRaw = address.region;
  const department = address['ISO3166-2-lvl6'];
  if (typeof regionRaw !== 'string' && typeof department !== 'string') return inMetropolitanFrance(at.lat, at.lon);
  const region = typeof regionRaw === 'string' ? normalizeArea(regionRaw) : '';
  if (region === 'france metropolitaine' || region === 'metropolitan france') return true;
  return typeof department === 'string' && METROPOLITAN_DEPARTMENT.test(department);
}

/** Pays et unités administratives d'un point, ou null. */
export async function placeAreasOf(lat: number, lon: number): Promise<PlaceAreas | null> {
  const la = lat.toFixed(2);
  const lo = lon.toFixed(2);
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=8&addressdetails=1&lat=${la}&lon=${lo}`;
  // Gardé 30 jours pour tout le site (une zone ne change pas) ; une panne n'est jamais gardée.
  const json = (await cached('reverse', `areas:v1:${la},${lo}`, 30 * 86_400, () =>
    nominatimJson(url, { userAgent: USER_AGENT, timeoutMs: 6000 })
  )) as {
    address?: Record<string, unknown>;
  } | null;
  const address = json?.address;
  if (!address) return null;
  const country = typeof address.country_code === 'string' ? address.country_code.toLowerCase() : '';
  if (!country) return null;
  const names: string[] = [];
  for (const level of ADDRESS_LEVELS) {
    // Nom d'une carte tierce : nettoyé et borné, comme tout texte venu d'ailleurs.
    const v = cleanText(address[level], 200);
    if (v && !names.includes(v)) names.push(v);
  }
  return country === 'fr' && !isMetropolitanFrance(address, { lat: Number(la), lon: Number(lo) })
    ? { country, names, overseas: true }
    : { country, names };
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
/** Instant du dernier échec par flux (ms). */
const lastFailure = new Map<string, number>();

/** Vide le cache des flux (tests). */
export function resetOfficialAlertsCache(): void {
  lastRead.clear();
  inFlight.clear();
  lastFailure.clear();
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
    const text = await readBodyBounded(res, FEED_MAX_BYTES);
    if (text == null) {
      console.warn('[compas] Meteoalarm', feed.slug, 'flux trop gros, refusé');
      return null;
    }
    const digest = digestMeteoalarm(JSON.parse(text));
    // Un corps qui n'est pas un flux, ou dont rien n'a pu être lu : jamais gardé.
    if (!digest || digest.unreadable) return null;
    // Un flux sans aucun message n'est pas pris pour un pays calme : le flux JSON garde
    // l'historique des alertes finies (la Suisse en portait encore 57 deux jours après),
    // un flux entièrement vide ressemble donc à une panne. Même règle que pour les pays
    // exclus de la table (flux vides le 10 oct.).
    if (digest.rawCount === 0) {
      console.warn('[compas] Meteoalarm', feed.slug, 'flux vide, non pris pour un pays calme');
      return null;
    }
    return digest;
  } catch {
    return null;
  }
}

async function loadFeed(feed: MeteoalarmFeed): Promise<FeedRead | null> {
  const kept = lastRead.get(feed.slug);
  if (kept && Date.now() - kept.at < FEED_TTL_MS) return kept;
  const failedAt = lastFailure.get(feed.slug);
  const coolingDown = failedAt != null && Date.now() - failedAt < FEED_RETRY_AFTER_FAILURE_MS;
  let fresh: FeedRead | null = null;
  if (!coolingDown) {
    let call = inFlight.get(feed.slug);
    if (!call) {
      call = downloadFeed(feed)
        .then((digest) => {
          if (!digest) {
            lastFailure.set(feed.slug, Date.now());
            return null;
          }
          lastFailure.delete(feed.slug);
          const read = { at: Date.now(), digest };
          lastRead.set(feed.slug, read);
          return read;
        })
        .finally(() => inFlight.delete(feed.slug));
      inFlight.set(feed.slug, call);
    }
    fresh = await call;
  }
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
  // Outre-mer : « fr » pour la carte, mais absent du flux France, donc jamais « aucune alerte ».
  const feed = place.overseas ? undefined : METEOALARM_FEEDS[place.country];
  if (!feed) return { status: 'non_couvert', alerts: [], area: null, readAt: null };
  const today = localToday(safeTimeZone(input.timeZone) ?? TIME_ZONE);
  const area = place.names[0] ?? null;
  if (!withinPublishedHorizon(from, to, today)) {
    // Voyage passé : rien à lire ; voyage futur : publication la veille.
    return { status: to < today ? 'indisponibles' : 'pas_encore_publiees', alerts: [], area, readAt: null };
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
  return { status, alerts, area: alerts[0]?.area ?? area, readAt: new Date(read.at).toISOString() };
}
