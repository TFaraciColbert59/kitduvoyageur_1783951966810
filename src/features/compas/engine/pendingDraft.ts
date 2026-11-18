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
