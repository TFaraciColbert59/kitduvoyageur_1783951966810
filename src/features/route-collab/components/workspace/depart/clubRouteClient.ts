/**
 * Appels de « Proposer à la sortie du club » (10.5) : `/api/itineraire/club-route`. `fetch` injectable. Une panne ou
 * une session absente rend « aucune sortie » : le bouton n'est alors pas proposé (jamais un faux droit).
 */
export interface ClubEventChoice {
  readonly id: string;
  readonly title: string;
  readonly startsAt: string | null;
  readonly visibility: string | null;
}

type Res = { ok: boolean; status?: number; json(): Promise<unknown> };
export type ClubFetch = (url: string, init?: { method?: string; credentials?: 'include'; headers?: Record<string, string>; body?: string }) => Promise<Res>;
const defaultFetch: ClubFetch = (url, init) => fetch(url, init);

export async function fetchOrganizerEvents(f: ClubFetch = defaultFetch): Promise<ClubEventChoice[]> {
  try {
    const res = await f('/api/itineraire/club-route', { credentials: 'include' });
    if (!res.ok) return [];
    const d = (await res.json()) as { events?: ClubEventChoice[] };
    return Array.isArray(d.events) ? d.events.filter((e) => typeof e?.id === 'string') : [];
  } catch {
    return [];
  }
}

export type ClubProposeOutcome =
  | { readonly kind: 'ok'; readonly revision: number; readonly unchanged: boolean }
  | { readonly kind: 'refused' | 'error'; readonly message: string };

const REFUSAL: Record<string, string> = {
  organisateur_et_proprietaire_requis: 'Réservé à l’organisateur de la sortie qui possède aussi cet itinéraire.',
  no_published: 'Publie d’abord une version de l’itinéraire.',
  no_pack: 'Publie de nouveau l’itinéraire : sa copie hors ligne manque.',
  unavailable: 'Cette sortie est annulée ou cet itinéraire archivé.',
  invalid: 'Le tracé publié ne peut pas être proposé (distance inconnue ou zone privée seule).',
};

export async function proposeToClubEvent(workspaceId: string, eventId: string, f: ClubFetch = defaultFetch): Promise<ClubProposeOutcome> {
  try {
    const res = await f('/api/itineraire/club-route', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, eventId }),
    });
    const d = (await res.json()) as { status?: string; revision?: number; unchanged?: boolean; error?: string };
    if (res.ok && d.status === 'ok' && typeof d.revision === 'number') return { kind: 'ok', revision: d.revision, unchanged: d.unchanged === true };
    return { kind: 'refused', message: (d.error && REFUSAL[d.error]) || 'La proposition n’a pas pu être enregistrée.' };
  } catch {
    return { kind: 'error', message: 'Hors ligne : la proposition n’a pas été envoyée.' };
  }
}
