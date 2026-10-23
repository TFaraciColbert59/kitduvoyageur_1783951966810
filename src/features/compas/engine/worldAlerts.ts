/**
 * Compas — alertes officielles hors Europe (plan 4.9) : États-Unis et Canada.
 * Fonctions pures : réponse d'un service national → alertes dans la MÊME forme
 * que celles de Meteoalarm (`OfficialAlert` : service, heure d'émission, période,
 * texte officiel, lien), plus ce que la lecture prouve de la zone du lieu.
 *
 * ÉTATS-UNIS — National Weather Service (NOAA), https://api.weather.gov
 * Lu le 2026-10-17 : https://www.weather.gov/documentation/services-web-api et
 * le schéma https://api.weather.gov/openapi.json (version 3.12.2) :
 * - « A User Agent is required to identify your application » (le serveur pose
 *   `appUserAgent`, jamais une donnée personnelle) ; « reasonable rate limits »,
 *   chiffre non publié, levée « typically within 5 seconds » ;
 * - `/alerts/active?point=lat,lon` (motif `^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$`) :
 *   les alertes en vigueur dont la zone contient le point. Une liste vide est
 *   donc une réponse sur la zone du lieu. Hors des États-Unis : 400 « out of
 *   bounds » (relevé le 17 oct.) ;
 * - champs lus, tous dans le schéma `Alert` : `id`, `areaDesc`, `sent`,
 *   `effective`, `onset`, `expires` (« expiry time of the information »), `ends`
 *   (« expected end time of the subject event »), `status` (Actual, Exercise,
 *   System, Test, Draft), `messageType` (Alert, Update, Cancel, Ack, Error),
 *   `severity` (Extreme, Severe, Moderate, Minor, Unknown), `event`, `senderName`,
 *   `headline`, `description`, `instruction`, `language`, `web`.
 * Conditions (https://www.weather.gov/disclaimer, lue le 2026-10-17, page sans
 * date) : « in the public domain, unless specifically noted otherwise, and may
 * be used without charge for any lawful purpose so long as you do not: 1) claim
 * it is your own [...], 2) use it in a manner that implies an endorsement or
 * affiliation with NOAA/NWS, or 3) modify its content and then present it as
 * official government material. » Le texte officiel est donc redonné tel quel,
 * et la couleur du Compas est dite comme une lecture du Compas (pas un niveau
 * NWS), avec chaque alerte (`WorldAlertNotice`).
 *
 * CANADA — Environnement et Changement climatique Canada (MSC GeoMet, OGC API)
 * https://api.weather.gc.ca/collections/weather-alerts (lue le 2026-10-17) :
 * GeoJSON, propriétés publiées par `/queryables` et `/schema` du même jour
 * (`alert_name_en|fr`, `alert_text_en|fr`, `alert_type`, `publication_datetime`,
 * `validity_datetime`, `event_end_datetime`, `expiration_datetime`,
 * `feature_name_en|fr`, `risk_colour_en|fr`, `status_en|fr`…). Aucune page ne
 * décrit le sens des dates : `validity_datetime` est lu comme le début de
 * validité et `event_end_datetime` comme la fin de l'événement (noms des champs ;
 * relevé : publication 17 h 32, validité 17 h 25, fin 00 h 00, expiration
 * 02 h 00), `status_en: ended` comme une alerte terminée.
 * Licence (https://eccc-msc.github.io/open-data/licence/readme_en/, « Version
 * 2.1.1 - August 2026 », lue le 2026-10-17) : usage commercial permis ; « In the
 * case of weather alerts (i.e. watches/warnings), any information shall be
 * reproduced in such a way that there is no alteration of the content or intent
 * of the alert » ; attribution « Data Source: Environment and Climate Change
 * Canada » (`ECCC_ATTRIBUTION`) avec, si possible, un lien vers la licence ;
 * aucune « official status » ni approbation suggérée. Politique d'usage
 * (https://eccc-msc.github.io/open-data/usage-policy/readme_en/) : au-delà de
 * 86 400 requêtes par jour (≈ 1 par seconde), contacter le MSC.
 *
 * Le corps vient d'un tiers : textes nettoyés et bornés (`cleanText`), adresses en
 * https seulement, listes bornées. Un message qu'on ne sait pas lire est compté :
 * la zone n'est alors plus prouvée calme.
 */

import { covers, type CapRing } from './capGeometry';
import type { OfficialAlert, OfficialAlertText } from './danger';
import { LIMITS, cleanText, safeHttpsUrl, type ZoneKnowledge } from './officialAlerts';

export type WorldAlertService = 'nws' | 'eccc';

/** Clé : code pays ISO 3166-1 alpha-2 en minuscules (celui que rend la carte). Seule liste hors Europe. */
export const WORLD_ALERT_SERVICES: Record<string, WorldAlertService> = { us: 'nws', ca: 'eccc' };

export const NWS_HOME = 'https://www.weather.gov/';
/** Page officielle de l'API lue (api.weather.gov). */
export const NWS_API_DOC = 'https://www.weather.gov/documentation/services-web-api';
/** Collection lue sur MSC GeoMet. */
export const ECCC_API_PAGE = 'https://api.weather.gc.ca/collections/weather-alerts';
export const NWS_ALERTS_PAGE = 'https://www.weather.gov/alerts';
export const NWS_TERMS = 'https://www.weather.gov/disclaimer';
export const ECCC_HOME_EN = 'https://weather.gc.ca/';
export const ECCC_HOME_FR = 'https://meteo.gc.ca/';
export const ECCC_LICENCE_EN = 'https://eccc-msc.github.io/open-data/licence/readme_en/';
export const ECCC_LICENCE_FR = 'https://eccc-msc.github.io/open-data/licence/readme_fr/';

/** Attribution exigée par la licence d'ECCC (§ 3), mot pour mot. */
export const ECCC_ATTRIBUTION = 'Data Source: Environment and Climate Change Canada';
/** La même, dans la version française de la licence. */
export const ECCC_ATTRIBUTION_FR =
  'Source des données : Environnement et Changement climatique Canada';

const NWS_NAME = 'National Weather Service';
/** « National Weather Service (NWS San Diego CA) » : le service et le bureau émetteur. */
export const nwsSource = (office: string | null) => (office ? `${NWS_NAME} (${office})` : NWS_NAME);
export const ECCC_SOURCE = 'Environment and Climate Change Canada (ECCC)';

/** Le service hors Europe d'une alerte, d'après sa source ; null pour une autre. */
export function worldAlertServiceOf(source: string): WorldAlertService | null {
  if (source === NWS_NAME || source.startsWith(`${NWS_NAME} (`)) return 'nws';
  if (source === ECCC_SOURCE) return 'eccc';
  return null;
}

const coord = (v: number) => String(Math.round(v * 10_000) / 10_000);

/** `/alerts/active?point=lat,lon` (4 décimales : ~10 m, le motif du schéma). */
export function nwsUrl(point: { lat: number; lon: number }): string {
  return `https://api.weather.gov/alerts/active?point=${coord(point.lat)},${coord(point.lon)}`;
}

/** Demi-côté de la boîte de recherche ECCC (degrés) : le point est ensuite testé dans chaque contour. */
const ECCC_BOX = 0.01;
/** Au plus autant de zones par requête ; au-delà, la réponse est tronquée et dite telle. */
export const ECCC_LIMIT = 100;

export function ecccUrl(point: { lat: number; lon: number }): string {
  const bbox = [
    point.lon - ECCC_BOX,
    point.lat - ECCC_BOX,
    point.lon + ECCC_BOX,
    point.lat + ECCC_BOX,
  ]
    .map(coord)
    .join(',');
  return `https://api.weather.gc.ca/collections/weather-alerts/items?f=json&limit=${ECCC_LIMIT}&bbox=${bbox}`;
}

export interface WorldReadOptions {
  from: string;
  to: string;
  now: Date;
  /** Instant de la lecture du service (ISO), affiché avec l'alerte. */
  fetchedAt: string;
}

export interface WorldReading {
  alerts: OfficialAlert[];
  /** `complete` : liste vide = aucune alerte active au lieu ; `aucune` : rien n'est affirmé. */
  knowledge: ZoneKnowledge;
}

const ORDER = { rouge: 0, orange: 1, jaune: 2 } as const;

function finish(alerts: OfficialAlert[], dropped: boolean): WorldReading {
  alerts.sort(
    (a, b) => ORDER[a.level] - ORDER[b.level] || (a.onset ?? '').localeCompare(b.onset ?? '')
  );
  return { alerts, knowledge: dropped ? (alerts.length ? 'partielle' : 'aucune') : 'complete' };
}

const iso = (v: unknown): string | null => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null;
  return Number.isFinite(Date.parse(v)) ? v : null;
};

/** Dernier jour couvert : une fin à minuit (heure du message) appartient au jour précédent. */
function lastDay(end: string): string {
  const day = end.slice(0, 10);
  if (!/T00:00(:00(\.0+)?)?/.test(end)) return day;
  const t = Date.parse(`${day}T12:00:00Z`) - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** La période touche-t-elle les dates du voyage, et l'alerte court-elle encore ? */
function inTrip(onset: string, end: string, opts: WorldReadOptions): boolean {
  if (Date.parse(end) <= opts.now.getTime()) return false;
  return onset.slice(0, 10) <= opts.to && lastDay(end) >= opts.from;
}

/* ------------------------------------------------------------------ */
/* National Weather Service                                            */
/* ------------------------------------------------------------------ */

/**
 * Couleur du Compas d'après la sévérité CAP déclarée (le NWS n'a pas de couleur) :
 * « Extreme » rouge, « Severe » orange, « Moderate », « Minor » et « Unknown » jaune.
 */
const NWS_LEVELS: Record<string, OfficialAlert['level']> = {
  Extreme: 'rouge',
  Severe: 'orange',
  Moderate: 'jaune',
  Minor: 'jaune',
  Unknown: 'jaune',
};

/** Le lien du message : https tel quel ; « http://www.weather.gov » (valeur réelle du champ) repris en https. */
function nwsWeb(v: unknown): string | null {
  const safe = safeHttpsUrl(v);
  if (safe) return safe;
  if (typeof v !== 'string') return null;
  try {
    const url = new URL(v.trim());
    const official = url.hostname === 'weather.gov' || url.hostname.endsWith('.weather.gov');
    if (url.protocol === 'http:' && official && !url.username && !url.password) {
      url.protocol = 'https:';
      return url.toString();
    }
  } catch {
    /* adresse illisible */
  }
  return null;
}

/** Réponse de `/alerts/active?point=` → alertes du lieu. Corps qui n'est pas une collection : null. */
export function readNwsAlerts(json: unknown, opts: WorldReadOptions): WorldReading | null {
  const body = json as { type?: unknown; features?: unknown } | null;
  if (
    !body ||
    typeof body !== 'object' ||
    body.type !== 'FeatureCollection' ||
    !Array.isArray(body.features)
  )
    return null;
  let dropped = body.features.length > LIMITS.warnings;
  const out: OfficialAlert[] = [];
  const seen = new Set<string>();
  for (const f of body.features.slice(0, LIMITS.warnings)) {
    const p = (f as { properties?: Record<string, unknown> })?.properties;
    if (!p || typeof p !== 'object') {
      dropped = true;
      continue;
    }
    // CAP : seul « Actual » est une alerte ; une annulation n'en est pas une.
    if (
      p.status !== 'Actual' ||
      p.messageType === 'Cancel' ||
      p.messageType === 'Ack' ||
      p.messageType === 'Error'
    )
      continue;
    const id = cleanText(p.id, LIMITS.areaName);
    const sent = iso(p.sent);
    const onset = iso(p.onset) ?? iso(p.effective);
    const end = iso(p.ends) ?? iso(p.expires);
    const level = typeof p.severity === 'string' ? NWS_LEVELS[p.severity] : undefined;
    const hazard = cleanText(p.event, LIMITS.headline);
    const area = cleanText(p.areaDesc, LIMITS.areaName);
    if (!id || !sent || !onset || !end || !level || !hazard || !area) {
      dropped = true; // illisible : jamais montré, jamais pris pour un calme
      continue;
    }
    if (seen.has(id) || !inTrip(onset, end, opts)) continue;
    seen.add(id);
    const headline = cleanText(p.headline, LIMITS.headline);
    const description = cleanText(p.description, LIMITS.text);
    const instruction = cleanText(p.instruction, LIMITS.text);
    const lang =
      typeof p.language === 'string' && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(p.language)
        ? p.language
        : '';
    const texts: OfficialAlertText[] =
      headline || description || instruction ? [{ lang, headline, description, instruction }] : [];
    const web = nwsWeb(p.web);
    const office = cleanText(p.senderName, LIMITS.areaName);
    out.push({
      id,
      source: nwsSource(office),
      sent: new Date(Date.parse(sent)).toISOString(),
      updatedSince: null,
      hazard,
      level,
      area,
      onset,
      expires: end,
      fetchedAt: opts.fetchedAt,
      ...(headline ? { headline } : {}),
      ...(web ? { web } : {}),
      ...(texts.length ? { texts } : {}),
    });
  }
  return finish(out, dropped);
}

/* ------------------------------------------------------------------ */
/* Environnement et Changement climatique Canada                       */
/* ------------------------------------------------------------------ */

/** Couleur de risque publiée par ECCC ; un bulletin sans couleur (`statement`) est lu jaune par le Compas. */
const ECCC_LEVELS: Record<string, OfficialAlert['level']> = {
  yellow: 'jaune',
  orange: 'orange',
  red: 'rouge',
};

/** Borne des sommets d'un contour reçu (le plus gros relevé le 17 oct. 2026 : ~1 400 points). */
const MAX_RING_POINTS = 20_000;

function ringOf(coords: unknown): CapRing | null {
  if (!Array.isArray(coords) || coords.length < 4 || coords.length > MAX_RING_POINTS) return null;
  const pts: number[] = [];
  let minLat = 90;
  let minLon = 180;
  let maxLat = -90;
  let maxLon = -180;
  for (const c of coords) {
    if (!Array.isArray(c)) return null;
    const [lon, lat] = c as unknown[];
    if (
      typeof lat !== 'number' ||
      typeof lon !== 'number' ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      return null;
    pts.push(lat, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }
  return { pts, bbox: [minLat, minLon, maxLat, maxLon] };
}

/**
 * Le point est-il dans la géométrie GeoJSON (Polygon ou MultiPolygon, trous
 * exclus) ? Autre type, ou contour illisible : false (une zone n'est jamais devinée).
 */
export function geoJsonCovers(geometry: unknown, lat: number, lon: number): boolean {
  const g = geometry as { type?: unknown; coordinates?: unknown } | null;
  if (!g || !Array.isArray(g.coordinates)) return false;
  const polygons =
    g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return (polygons as unknown[]).some((poly) => {
    if (!Array.isArray(poly) || poly.length === 0) return false;
    const [outer, ...holes] = poly.map(ringOf);
    if (!outer || !covers({ rings: [outer], circles: [] }, lat, lon)) return false;
    return !holes.some((h) => h != null && covers({ rings: [h], circles: [] }, lat, lon));
  });
}

/** Réponse de la collection `weather-alerts` (boîte autour du point) → alertes du lieu. Corps inattendu : null. */
export function readEcccAlerts(
  json: unknown,
  opts: WorldReadOptions & { point: { lat: number; lon: number } }
): WorldReading | null {
  const body = json as {
    type?: unknown;
    features?: unknown;
    numberMatched?: unknown;
    numberReturned?: unknown;
  } | null;
  if (
    !body ||
    typeof body !== 'object' ||
    body.type !== 'FeatureCollection' ||
    !Array.isArray(body.features)
  )
    return null;
  // Réponse tronquée (plus de zones que de zones rendues) : d'autres alertes ont pu échapper.
  let dropped =
    body.features.length > ECCC_LIMIT ||
    (typeof body.numberMatched === 'number' &&
      body.numberMatched >
        (typeof body.numberReturned === 'number' ? body.numberReturned : body.features.length));
  const out: OfficialAlert[] = [];
  const seen = new Set<string>();
  for (const f of body.features.slice(0, ECCC_LIMIT)) {
    const feature = f as { id?: unknown; geometry?: unknown; properties?: Record<string, unknown> };
    const p = feature?.properties;
    if (!p || typeof p !== 'object') {
      dropped = true;
      continue;
    }
    if (p.status_en === 'ended') continue; // terminée : gardée dans la collection jusqu'à son expiration
    if (!feature.geometry) {
      dropped = true; // zone sans contour : impossible de dire si elle couvre le lieu
      continue;
    }
    if (!geoJsonCovers(feature.geometry, opts.point.lat, opts.point.lon)) continue;
    const id = cleanText(feature.id, LIMITS.areaName);
    const sent = iso(p.publication_datetime);
    const onset = iso(p.validity_datetime) ?? sent;
    const end = iso(p.event_end_datetime) ?? iso(p.expiration_datetime);
    const hazardFr = cleanText(p.alert_name_fr, LIMITS.headline);
    const hazardEn = cleanText(p.alert_name_en, LIMITS.headline);
    const area =
      cleanText(p.feature_name_en, LIMITS.areaName) ??
      cleanText(p.feature_name_fr, LIMITS.areaName);
    if (!id || !sent || !onset || !end || !(hazardFr || hazardEn) || !area) {
      dropped = true;
      continue;
    }
    // Une même alerte et une même zone ne comptent qu'une fois.
    const key = `${id.split('_')[0]}|${String(p.alert_code ?? '')}|${area}`;
    if (seen.has(key) || !inTrip(onset, end, opts)) continue;
    seen.add(key);
    const colour = typeof p.risk_colour_en === 'string' ? p.risk_colour_en.toLowerCase() : '';
    const texts: OfficialAlertText[] = [
      {
        lang: 'fr-CA',
        headline: hazardFr,
        description: cleanText(p.alert_text_fr, LIMITS.text),
        instruction: null,
      },
      {
        lang: 'en-CA',
        headline: hazardEn,
        description: cleanText(p.alert_text_en, LIMITS.text),
        instruction: null,
      },
    ].filter((t) => t.headline || t.description);
    out.push({
      id,
      source: ECCC_SOURCE,
      sent: new Date(Date.parse(sent)).toISOString(),
      updatedSince: null,
      hazard: (hazardFr ?? hazardEn) as string,
      level: ECCC_LEVELS[colour] ?? 'jaune',
      area,
      onset,
      expires: end,
      fetchedAt: opts.fetchedAt,
      headline: hazardFr ?? hazardEn,
      web: ECCC_HOME_EN,
      ...(texts.length ? { texts } : {}),
    });
  }
  return finish(out, dropped);
}
