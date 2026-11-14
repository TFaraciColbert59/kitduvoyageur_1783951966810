/**
 * Compas · liens de RECHERCHE profonds pour « À prévoir » (fonctions pures).
 *
 * Un lien ouvre la recherche d'un site public déjà remplie (lieu, dates, nombre de voyageurs) quand ces
 * valeurs sont connues, et sans elles sinon : rien n'est deviné. Aucune clé, aucun compte, aucun identifiant
 * d'affiliation : ce sont des liens directs, que la personne ouvre elle-même. Seul le https est produit, et
 * chaque valeur passe par `encodeURIComponent`.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 120;
const MAX_WEBSITE = 300;
const MAX_ADULTS = 30;

const clean = (v: string | null | undefined): string => (v ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
const enc = encodeURIComponent;

const plain = (v: string): string => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Une date ISO (AAAA-MM-JJ) qui existe au calendrier, sinon null. */
export function isoDate(value: string | null | undefined): string | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? value : null;
}

/** Date ISO décalée de `days` jours (calendrier civil, sans fuseau) ; null si la date de départ n'existe pas. */
export function addDaysIso(value: string | null | undefined, days: number): string | null {
  const start = isoDate(value ?? null);
  if (!start) return null;
  const [y, m, d] = start.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Site web d'un lieu (tag OSM `website`) : https seulement, jamais un schéma exécutable. */
export function safeWebsite(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v || v.length > MAX_WEBSITE || !/^https:\/\//i.test(v) || !URL.canParse(v)) return null;
  return v;
}

/** Recherche Booking.com sur un lieu, avec les dates et le groupe quand ils sont connus. Sans lieu : null. */
export function bookingSearchUrl(input: {
  place: string | null;
  checkIn: string | null;
  checkOut: string | null;
  adults: number | null;
}): string | null {
  const place = clean(input.place);
  if (!place) return null;
  const parts = [`ss=${enc(place)}`];
  const checkIn = isoDate(input.checkIn);
  const checkOut = isoDate(input.checkOut);
  // Les deux dates ensemble, dans l'ordre : une seule, ou à l'envers, ne dit rien d'utile.
  if (checkIn && checkOut && checkOut > checkIn) parts.push(`checkin=${checkIn}`, `checkout=${checkOut}`);
  const adults = input.adults;
  if (adults != null && Number.isInteger(adults) && adults >= 1 && adults <= MAX_ADULTS) parts.push(`group_adults=${adults}`);
  return `https://www.booking.com/searchresults.html?${parts.join('&')}`;
}

/** Recherche web du lieu (nom, localité, mot de réservation) quand son site n'est pas connu. */
export function webSearchUrl(input: { name: string; place: string | null; keyword?: string }): string | null {
  const name = clean(input.name);
  if (!name) return null;
  const place = clean(input.place);
  const words = [name];
  if (place && !plain(name).includes(plain(place))) words.push(place);
  words.push(clean(input.keyword) || 'réservation');
  return `https://duckduckgo.com/?q=${enc(words.join(' '))}`;
}

export type StayDeepKind = 'hebergement' | 'refuge' | 'camping' | 'bivouac';

/**
 * Lien de réservation d'une nuit : recherche Booking.com sur le lieu de l'étape pour un hébergement
 * marchand ; pour un refuge ou un camping, le site du lieu s'il est connu (OpenStreetMap), sinon une
 * recherche web. Un bivouac ne se réserve pas : aucun lien.
 */
export function stayDeepLink(input: {
  kind: StayDeepKind;
  name: string;
  place: string | null;
  website: string | null;
  checkIn: string | null;
  checkOut: string | null;
  adults: number | null;
  keyword?: string;
}): string | null {
  if (input.kind === 'bivouac') return null;
  if (input.kind === 'hebergement')
    return bookingSearchUrl({ place: clean(input.place) || clean(input.name), checkIn: input.checkIn, checkOut: input.checkOut, adults: input.adults });
  return safeWebsite(input.website) ?? webSearchUrl({ name: input.name, place: input.place, keyword: input.keyword });
}

/** Google Flights : « Flights from X to Y on DATE through DATE » (sans date ni départ quand ils manquent). Sans destination : null. */
export function flightSearchUrl(input: {
  origin: string | null;
  destination: string | null;
  depart: string | null;
  back: string | null;
}): string | null {
  const to = clean(input.destination);
  if (!to) return null;
  const from = clean(input.origin);
  const depart = isoDate(input.depart);
  const back = isoDate(input.back);
  let q = from ? `Flights from ${from} to ${to}` : `Flights to ${to}`;
  if (depart) q += ` on ${depart}`;
  if (depart && back && back >= depart) q += ` through ${back}`;
  return `https://www.google.com/travel/flights?q=${enc(q)}`;
}

/** Itinéraire Google Maps (transports en commun ou voiture). Sans destination : null. */
export function mapsDirectionsUrl(input: { origin: string | null; destination: string | null; mode: 'transit' | 'driving' }): string | null {
  const to = clean(input.destination);
  if (!to) return null;
  const from = clean(input.origin);
  return `https://www.google.com/maps/dir/?api=1${from ? `&origin=${enc(from)}` : ''}&destination=${enc(to)}&travelmode=${input.mode}`;
}

export type TransportDeepMode = 'car' | 'train' | 'carpool' | 'bus' | 'flight' | 'foot';

/**
 * Lien de recherche du trajet d'approche : avion → Google Flights ; train et bus → itinéraire en transports
 * en commun (aucun site de train n'accepte un lien profond fiable) ; voiture → itinéraire en voiture.
 * Covoiturage et « à pied » : aucun lien de recherche (le covoiturage n'a que celui d'un partenaire).
 */
export function transportDeepLink(input: {
  mode: TransportDeepMode;
  origin: string | null;
  destination: string | null;
  depart: string | null;
  back: string | null;
}): string | null {
  switch (input.mode) {
    case 'flight':
      return flightSearchUrl(input);
    case 'train':
    case 'bus':
      return mapsDirectionsUrl({ origin: input.origin, destination: input.destination, mode: 'transit' });
    case 'car':
      return mapsDirectionsUrl({ origin: input.origin, destination: input.destination, mode: 'driving' });
    default:
      return null;
  }
}

/** Recherche d'activités à réserver sur un lieu (GetYourGuide) : sans lieu, rien. Aucun identifiant d'affiliation. */
export function activitiesSearchUrl(place: string | null | undefined): string | null {
  const q = clean(place);
  return q ? `https://www.getyourguide.com/s/?q=${enc(q)}` : null;
}

/**
 * Location de voiture : aucun format de recherche profond, public et fiable (lieu, dates) n'est confirmé chez un
 * loueur ou un comparateur ; la recherche web préremplie porte donc le lieu de prise (aéroport d'arrivée, sinon
 * localité) et les dates du voyage. Aucun identifiant d'affiliation.
 */
export function carRentalUrl(input: { label: string; place?: string | null; start?: string | null; end?: string | null }): string {
  const start = isoDate(input.start);
  const end = isoDate(input.end);
  const words = [input.label, clean(input.place), start, start && end && end >= start ? end : null].filter(Boolean).join(' ');
  return objectSearchUrl(words, null) ?? 'https://duckduckgo.com/';
}

/**
 * Recherche web d'un objet à réserver sur un lieu (« location vélo Chamonix »). Sans lieu, l'objet seul ;
 * sans objet, rien. Aucun mot n'est ajouté : l'objet porte déjà l'intention.
 */
export function objectSearchUrl(object: string | null | undefined, place: string | null | undefined): string | null {
  const what = clean(object);
  if (!what) return null;
  const where = clean(place);
  const words = where && !plain(what).includes(plain(where)) ? `${what} ${where}` : what;
  return `https://duckduckgo.com/?q=${enc(words)}`;
}
