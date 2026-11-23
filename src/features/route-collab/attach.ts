/**
 * Rattachement à un voyage (1.1) : sans `?trip=`, la page propose de choisir ou de créer le voyage.
 * Pur : la lecture des voyages se fait côté serveur sous RLS (`server/listAttachableTrips.ts`).
 * Aucune donnée privée du voyage ne sort d'ici : titre, lieu, dates, rôle.
 */
import type { RouteSport } from '@/features/adventure-prep/routeProfiles';

export interface AttachTripChoice {
  readonly id: string;
  readonly title: string;
  readonly destinationName: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly role: 'owner' | 'editor';
  /** Un itinéraire est déjà rattaché à ce voyage : le choisir l'ouvre (un seul tracé par voyage). */
  readonly hasRoute: boolean;
}

export interface AttachTripRow {
  readonly id: string;
  readonly title: string | null;
  readonly destination_name: string | null;
  readonly start_date: string | null;
  readonly end_date: string | null;
}

const MAX_CHOICES = 30;
const UNTITLED = 'Voyage sans titre';

/**
 * Choix présentés : seuls les voyages que la personne peut modifier (propriétaire, éditeur), ceux qui n'ont
 * pas encore d'itinéraire d'abord, puis l'ordre reçu (plus récent d'abord).
 */
export function buildAttachChoices(
  rows: ReadonlyArray<AttachTripRow>,
  roles: ReadonlyMap<string, string>,
  tripsWithRoute: ReadonlySet<string> = new Set(),
): AttachTripChoice[] {
  const out: AttachTripChoice[] = [];
  for (const row of rows) {
    const role = roles.get(row.id);
    if (role !== 'owner' && role !== 'editor') continue;
    out.push({
      id: row.id,
      title: row.title?.trim() || row.destination_name?.trim() || UNTITLED,
      destinationName: row.destination_name?.trim() || null,
      startDate: row.start_date,
      endDate: row.end_date,
      role,
      hasRoute: tripsWithRoute.has(row.id),
    });
  }
  const free = out.filter((c) => !c.hasRoute);
  const taken = out.filter((c) => c.hasRoute);
  return [...free, ...taken].slice(0, MAX_CHOICES);
}

/** Activité du Compas qui correspond au profil de routage (création d'un voyage depuis le tracé). */
export function activityForRouteSport(sport: RouteSport): 'hiking' | 'cycling' | 'roadtrip' {
  if (sport === 'marche') return 'hiking';
  if (sport === 'enduro') return 'roadtrip';
  return 'cycling';
}
