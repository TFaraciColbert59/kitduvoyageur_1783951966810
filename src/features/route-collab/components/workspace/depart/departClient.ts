/**
 * Appels de l'onglet Départ : sac et liste du HUB (`/api/itineraire/depart`), sorties liées
 * (`/api/itineraire/sorties`), contacts de sécurité du suivi en direct (`/api/live-tracking/safety-contacts`).
 * `fetch` injectable. Une panne rend `null` pour la partie concernée : l'écran dit « non lu ».
 */
import type { RecordedSession } from '../../../depart/carnetCompare';
import type { TripItemRow } from '../../../depart/tripKit';

export interface ChecklistRow {
  readonly id: string;
  readonly label: string;
  readonly due_offset_days: number;
  readonly done: boolean;
  readonly done_at: string | null;
  readonly position: number;
}

export interface DepartData {
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly kit: readonly TripItemRow[] | null;
  readonly checklist: readonly ChecklistRow[] | null;
  readonly fetchedAt: string | null;
}

export const NO_DEPART: DepartData = { status: 'idle', kit: null, checklist: null, fetchedAt: null };

type Res = { ok: boolean; status?: number; json(): Promise<unknown> };
export type DepartFetch = (url: string, init?: { method?: string; credentials?: 'include'; headers?: Record<string, string>; body?: string }) => Promise<Res>;
const defaultFetch: DepartFetch = (url, init) => fetch(url, init);

export async function fetchDepart(tripId: string, f: DepartFetch = defaultFetch): Promise<DepartData> {
  try {
    const res = await f(`/api/itineraire/depart?tripId=${encodeURIComponent(tripId)}`, { credentials: 'include' });
    if (!res.ok) return { ...NO_DEPART, status: 'error' };
    const d = (await res.json()) as Partial<{ kit: TripItemRow[] | null; checklist: ChecklistRow[] | null; fetchedAt: string }>;
    return { status: 'ready', kit: Array.isArray(d.kit) ? d.kit : null, checklist: Array.isArray(d.checklist) ? d.checklist : null, fetchedAt: d.fetchedAt ?? null };
  } catch {
    return { ...NO_DEPART, status: 'error' };
  }
}

export async function patchChecklist(tripId: string, itemId: string, done: boolean, f: DepartFetch = defaultFetch): Promise<boolean> {
  try {
    const res = await f('/api/itineraire/depart', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, itemId, done }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchSafetyContacts(f: DepartFetch = defaultFetch): Promise<number | null> {
  try {
    const res = await f('/api/live-tracking/safety-contacts', { credentials: 'include' });
    if (!res.ok) return null;
    const d = (await res.json()) as { contacts?: unknown };
    return Array.isArray(d.contacts) ? d.contacts.length : null;
  } catch {
    return null;
  }
}

export async function fetchSessions(workspaceId: string, f: DepartFetch = defaultFetch): Promise<{ sessions: RecordedSession[] | null; reason: string | null }> {
  try {
    const res = await f(`/api/itineraire/sorties?workspaceId=${encodeURIComponent(workspaceId)}`, { credentials: 'include' });
    if (!res.ok) return { sessions: null, reason: 'Sorties non lues.' };
    const d = (await res.json()) as { status?: string; sessions?: RecordedSession[]; reason?: string };
    if (d.status === 'unavailable') return { sessions: [], reason: d.reason ?? 'Sorties liées non lisibles pour l’instant.' };
    return { sessions: Array.isArray(d.sessions) ? d.sessions : [], reason: null };
  } catch {
    return { sessions: null, reason: 'Sorties non lues.' };
  }
}
