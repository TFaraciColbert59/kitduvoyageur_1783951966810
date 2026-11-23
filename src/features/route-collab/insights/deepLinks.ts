export interface ItineraryDeepLink {
  readonly tripId?: string;
  readonly day?: number;
  readonly pointId?: string;
  readonly sectionId?: string;
}

type ParamSource =
  | URLSearchParams
  | string
  | Readonly<Record<string, string | readonly string[] | undefined>>;

const ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
export const ITINERARY_BASE_PATH = '/compas/itineraire';

function readParam(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  if (typeof source === 'string') return new URLSearchParams(source).get(key) ?? undefined;
  const v = source[key];
  if (Array.isArray(v)) return v[0];
  return typeof v === 'string' ? v : undefined;
}

function cleanId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  return ID_RE.test(v) ? v : undefined;
}

/** Lit `?trip=`, `?jour=`, `?point=`, `?troncon=`. Toute valeur invalide est ignorée, jamais corrigée. */
export function parseItineraryDeepLink(params: ParamSource): ItineraryDeepLink {
  const out: { tripId?: string; day?: number; pointId?: string; sectionId?: string } = {};
  const tripId = cleanId(readParam(params, 'trip'));
  if (tripId) out.tripId = tripId;
  const dayRaw = readParam(params, 'jour')?.trim();
  if (dayRaw && /^\d{1,3}$/.test(dayRaw)) {
    const day = Number(dayRaw);
    if (day >= 1 && day <= 366) out.day = day;
  }
  const pointId = cleanId(readParam(params, 'point'));
  if (pointId) out.pointId = pointId;
  const sectionId = cleanId(readParam(params, 'troncon'));
  if (sectionId) out.sectionId = sectionId;
  return out;
}

export function buildItineraryHref(link: ItineraryDeepLink = {}): string {
  const q = new URLSearchParams();
  const tripId = cleanId(link.tripId);
  if (tripId) q.set('trip', tripId);
  if (link.day != null && Number.isInteger(link.day) && link.day >= 1 && link.day <= 366) q.set('jour', String(link.day));
  const pointId = cleanId(link.pointId);
  if (pointId) q.set('point', pointId);
  const sectionId = cleanId(link.sectionId);
  if (sectionId) q.set('troncon', sectionId);
  const qs = q.toString();
  return qs ? `${ITINERARY_BASE_PATH}?${qs}` : ITINERARY_BASE_PATH;
}

/**
 * 9.10 : lien « Reprendre le tracé » d'un carnet. Le carnet est relu côté serveur (RLS, masques du lecteur) ;
 * `trip` est facultatif (sans lui, le voyage du carnet est retrouvé s'il appartient à la personne).
 */
export function buildCarnetReplayHref(carnetId: string, tripId?: string | null): string {
  const q = new URLSearchParams();
  const trip = cleanId(tripId ?? undefined);
  if (trip) q.set('trip', trip);
  q.set('from', 'carnet');
  q.set('carnetId', carnetId);
  return `${ITINERARY_BASE_PATH}?${q.toString()}`;
}
