import type { RequestPrecisions } from './request';

const PENDING_START_KEY = 'lkdv:compas:pendingStartDraft:v1';
let memoryDraft: PendingStartDraft | null = null;

export interface PendingStartDraft {
  text: string;
  precise?: RequestPrecisions;
  savedAt: string;
}

export function savePendingStartDraft(draft: Omit<PendingStartDraft, 'savedAt'>): void {
  const payload: PendingStartDraft = {
    text: draft.text.slice(0, 280),
    precise: draft.precise,
    savedAt: new Date().toISOString(),
  };
  memoryDraft = payload;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_START_KEY, JSON.stringify(payload));
  } catch {
    /* ignore storage quota / private mode errors */
  }
}

export function readPendingStartDraft(): PendingStartDraft | null {
  if (typeof window === 'undefined') return memoryDraft;
  try {
    const raw = window.sessionStorage.getItem(PENDING_START_KEY);
    if (!raw) return memoryDraft;
    const parsed = JSON.parse(raw) as Partial<PendingStartDraft>;
    if (typeof parsed.text !== 'string' || !parsed.text.trim()) return null;
    return {
      text: parsed.text.slice(0, 280),
      precise: parsed.precise && typeof parsed.precise === 'object' ? parsed.precise : undefined,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return memoryDraft;
  }
}

export function clearPendingStartDraft(): void {
  memoryDraft = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_START_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------- Brouillon d'itinéraire (/compas/itineraire) ---------- */

/**
 * Brouillon d'itinéraire tracé sans compte : il survit à `/connexion` (y compris quand le courriel de
 * confirmation s'ouvre dans un autre onglet, d'où `localStorage` et non `sessionStorage`). Il ne porte que
 * l'état de l'atelier ; une durée de vie de 24 h limite ce qui reste sur un appareil partagé, et il est
 * effacé dès qu'il est repris ou enregistré.
 */
const PENDING_ROUTE_KEY = 'lkdv:itineraire:pendingRouteDraft:v1';
const PENDING_ROUTE_MAX_AGE_MS = 24 * 3600_000;
const PENDING_ROUTE_MAX_CHARS = 2_500_000;
let memoryRouteDraft: PendingRouteDraft | null = null;

export interface PendingRouteDraft {
  /** État de l'atelier (JSON) ; relu et validé par l'appelant. */
  workspace: unknown;
  tripId: string | null;
  savedAt: string;
}

export type SavePendingRouteResult = 'saved' | 'too_large' | 'unavailable';

export function savePendingRouteDraft(draft: Omit<PendingRouteDraft, 'savedAt'>): SavePendingRouteResult {
  const payload: PendingRouteDraft = { ...draft, savedAt: new Date().toISOString() };
  memoryRouteDraft = payload;
  if (typeof window === 'undefined') return 'unavailable';
  try {
    const raw = JSON.stringify(payload);
    if (raw.length > PENDING_ROUTE_MAX_CHARS) return 'too_large';
    window.localStorage.setItem(PENDING_ROUTE_KEY, raw);
    return 'saved';
  } catch {
    return 'unavailable';
  }
}

export function readPendingRouteDraft(now: number = Date.now()): PendingRouteDraft | null {
  const fresh = (d: PendingRouteDraft | null): PendingRouteDraft | null => {
    if (!d) return null;
    const at = Date.parse(d.savedAt);
    return Number.isFinite(at) && now - at <= PENDING_ROUTE_MAX_AGE_MS ? d : null;
  };
  if (typeof window === 'undefined') return fresh(memoryRouteDraft);
  try {
    const raw = window.localStorage.getItem(PENDING_ROUTE_KEY);
    if (!raw) return fresh(memoryRouteDraft);
    const parsed = JSON.parse(raw) as Partial<PendingRouteDraft>;
    if (!parsed || typeof parsed !== 'object' || parsed.workspace == null || typeof parsed.savedAt !== 'string') return null;
    return fresh({
      workspace: parsed.workspace,
      tripId: typeof parsed.tripId === 'string' ? parsed.tripId : null,
      savedAt: parsed.savedAt,
    });
  } catch {
    return fresh(memoryRouteDraft);
  }
}

export function clearPendingRouteDraft(): void {
  memoryRouteDraft = null;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PENDING_ROUTE_KEY);
  } catch {
    /* ignore */
  }
}
