/**
 * Contexte du voyage — LA lecture unique des réglages d'un projet.
 *
 * Avant : le nombre de jours était recalculé à six endroits (préremplissage,
 * empreinte, modèle d'écran, données de page…), le groupe valait
 * `party_size ?? 1` d'un côté et `?? membres` de l'autre. Chaque écart donnait
 * un plan différent pour le même voyage. Ici, une seule règle, pure et testée ;
 * tout le reste la consomme.
 */

/** Plus long voyage préparé d'un bloc (au-delà, la durée retenue est bornée). */
export const MAX_TRIP_DAYS = 60;
/** Les recherches de réservation n'acceptent pas plus de voyageurs. */
export const MAX_PARTY = 20;

const MS_DAY = 86_400_000;

function isoNoon(iso: string | null | undefined): number {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return NaN;
  return Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);
}

/**
 * Nombre de jours du voyage, toujours la même règle :
 * 1. des dates valides (fin ≥ début ; fin absente = un jour) ;
 * 2. sinon la durée retenue sans date (`planned_days`, entier ≥ 1) ;
 * 3. sinon inconnu.
 * Bornée à {@link MAX_TRIP_DAYS}.
 */
export function tripLengthDays(
  start: string | null | undefined,
  end: string | null | undefined,
  planned?: unknown
): number | null {
  const a = isoNoon(start);
  const b = isoNoon(end ?? start);
  if (Number.isFinite(a) && Number.isFinite(b) && b >= a)
    return Math.min(MAX_TRIP_DAYS, Math.round((b - a) / MS_DAY) + 1);
  const p = Number(planned);
  if (Number.isInteger(p) && p >= 1) return Math.min(MAX_TRIP_DAYS, p);
  return null;
}

/**
 * Taille du groupe : `party_size` s'il est posé, sinon le nombre de membres
 * connus (propriétaire compris), au moins 1, au plus {@link MAX_PARTY}.
 */
export function partySizeOf(partySize: number | null | undefined, memberCount?: number | null): number {
  const declared = Number(partySize);
  if (Number.isFinite(declared) && declared >= 1) return Math.min(MAX_PARTY, Math.round(declared));
  const members = Number(memberCount);
  return Math.max(1, Math.min(MAX_PARTY, Number.isFinite(members) ? Math.round(members) : 1));
}

export interface TripAnchor {
  name: string;
  lat: number;
  lon: number;
}

/** Ancre (lieu retenu sur la carte) lue depuis `metadata.compas.anchor`, sinon null. */
export function anchorOf(raw: unknown): TripAnchor | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const lat = Number(a.lat);
  const lon = Number(a.lon);
  if (a.lat == null || a.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { name: String(a.name ?? ''), lat, lon };
}

/** Lieu de départ dit (« depuis Lyon »), rangé dans `metadata.compas.origin`. */
export interface TripOrigin {
  name: string;
  /** Arrondis à 0,01° (~1 km) à l'écriture : jamais un point plus fin. */
  lat: number;
  lon: number;
  countryCode: string | null;
  source: 'dit';
}

/** Départ dit lu depuis `metadata.compas.origin` (lecture défensive), sinon null. */
export function originOf(raw: unknown): TripOrigin | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  // Des nombres, rien d'autre : `Number('')` ou `Number(false)` feraient un faux point (0, 0)
  // (les éditeurs d'un voyage peuvent écrire `metadata`).
  const { lat, lon } = o;
  if (!name || typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon))
    return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const cc = typeof o.countryCode === 'string' ? o.countryCode.trim().toUpperCase() : '';
  return { name: name.slice(0, 80), lat, lon, countryCode: /^[A-Z]{2}$/.test(cc) ? cc : null, source: 'dit' };
}

export interface TripContextInput {
  startDate: string | null;
  endDate: string | null;
  /** `metadata.compas.planned_days` tel quel (non validé). */
  plannedDays?: unknown;
  partySize: number | null;
  /** Membres connus (propriétaire + personnes ajoutées), si on les a. */
  memberCount?: number | null;
  destinationName: string | null;
  countryCode?: string | null;
  /** `metadata.compas.anchor` tel quel (non validé). */
  anchor?: unknown;
  activity: string | null;
  /** Durée en heures pour une sortie de moins d'un jour. */
  durationHours?: number | null;
}

export interface TripContext {
  /** Jours du voyage (dates, sinon durée retenue), null si inconnu. */
  days: number | null;
  /** Nuits = jours − 1 (0 pour une sortie à la journée). */
  nights: number;
  /** Vrai si les jours viennent de dates réelles (et non d'une durée sans date). */
  dated: boolean;
  startDate: string | null;
  endDate: string | null;
  /** Sortie de moins d'un jour : sa durée en heures, sinon null. */
  hours: number | null;
  party: number;
  destination: {
    name: string | null;
    countryCode: string | null;
    anchor: TripAnchor | null;
  };
  activity: string | null;
}

/** Durée en heures d'une sortie de moins d'un jour (sinon null) : la même partout. */
export function shortHoursOf(days: number | null, durationHours: unknown): number | null {
  const h = Number(durationHours);
  if (durationHours == null || !Number.isFinite(h)) return null;
  return h > 0 && h < 24 && (days == null || days === 1) ? h : null;
}

/** Construit le contexte une fois ; pur, aucune I/O. */
export function buildTripContext(input: TripContextInput): TripContext {
  const datedDays = tripLengthDays(input.startDate, input.endDate, null);
  const days = datedDays ?? tripLengthDays(null, null, input.plannedDays);
  const hours = shortHoursOf(days, input.durationHours);
  const cc = (input.countryCode ?? '').trim().toUpperCase();
  const name = (input.destinationName ?? '').trim();
  return {
    days,
    nights: days == null ? 0 : Math.max(0, days - 1),
    dated: datedDays != null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    hours,
    party: partySizeOf(input.partySize, input.memberCount),
    destination: {
      name: name || null,
      countryCode: /^[A-Z]{2}$/.test(cc) ? cc : null,
      anchor: anchorOf(input.anchor),
    },
    activity: input.activity ?? null,
  };
}

/** Raccourci pour une ligne `trips` (+ métadonnées Compas). */
export function tripContextFromRow(
  trip: {
    start_date: string | null;
    end_date: string | null;
    destination_name: string | null;
    destination_country_code?: string | null;
    party_size: number | null;
    metadata: Record<string, unknown> | null;
  },
  extra: { activity: string | null; memberCount?: number | null; durationHours?: number | null }
): TripContext {
  const meta = (trip.metadata ?? {}) as Record<string, unknown>;
  const c = (meta.compas && typeof meta.compas === 'object' ? meta.compas : {}) as Record<string, unknown>;
  return buildTripContext({
    startDate: trip.start_date,
    endDate: trip.end_date,
    plannedDays: c.planned_days,
    partySize: trip.party_size,
    memberCount: extra.memberCount,
    destinationName: trip.destination_name,
    countryCode: trip.destination_country_code ?? null,
    anchor: c.anchor,
    activity: extra.activity,
    durationHours: extra.durationHours,
  });
}
