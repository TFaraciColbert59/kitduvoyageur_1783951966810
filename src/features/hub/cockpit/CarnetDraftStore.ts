'use client';

export interface CarnetLocalDraft {
  tripId: string;
  day: number;
  caption: string;
  place: string;
  capturedAt: string;
  timeZone: string;
  updatedAt: string;
}

const PREFIX = 'lkdv_hub_carnet_draft_v1:';
const memoryDrafts = new Map<string, CarnetLocalDraft>();

function storage(): Storage | null {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') return window.localStorage;
  return null;
}

export function saveCarnetDraft(draft: Omit<CarnetLocalDraft, 'updatedAt'>): CarnetLocalDraft {
  const full: CarnetLocalDraft = { ...draft, updatedAt: new Date().toISOString() };
  const key = PREFIX + draft.tripId;
  memoryDrafts.set(key, full);
  try {
    storage()?.setItem(key, JSON.stringify(full));
  } catch {
    // quota or private mode fallback
  }
  return full;
}

export function loadCarnetDraft(tripId: string): CarnetLocalDraft | null {
  const key = PREFIX + tripId;
  try {
    const raw = storage()?.getItem(key);
    if (raw) return JSON.parse(raw) as CarnetLocalDraft;
  } catch {
    // ignore
  }
  return memoryDrafts.get(key) ?? null;
}

export function clearCarnetDraft(tripId: string): void {
  const key = PREFIX + tripId;
  memoryDrafts.delete(key);
  try {
    storage()?.removeItem(key);
  } catch {
    // ignore
  }
}
