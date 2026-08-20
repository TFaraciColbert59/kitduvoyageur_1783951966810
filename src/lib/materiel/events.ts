'use client';

/**
 * LKDV — Events bus « Mon Matériel »
 * `window.dispatchEvent(new CustomEvent('lkdv:materiel', { detail }))`
 * écouté par terrain, communauté, boutique pour badge/toast/refetch.
 */

export type MaterielEventType =
  | 'gear-added'
  | 'gear-updated'
  | 'gear-deleted'
  | 'kit-created'
  | 'kit-updated'
  | 'kit-deleted'
  | 'kit-restored'
  | 'loan-created'
  | 'loan-returned'
  | 'order-received'
  | 'departure-created'
  | 'departure-validated'
  | 'alert-resolved'
  | 'sync-complete'
  | 'scan-complete';

export interface MaterielEventDetail {
  type: MaterielEventType;
  entityId?: string;
  payload?: unknown;
  timestamp: number;
}

export const MATERIEL_EVENT = 'lkdv:materiel';

export function emitMaterielEvent(type: MaterielEventType, payload?: unknown, entityId?: string) {
  if (typeof window === 'undefined') return;
  const detail: MaterielEventDetail = { type, payload, entityId, timestamp: Date.now() };
  window.dispatchEvent(new CustomEvent<MaterielEventDetail>(MATERIEL_EVENT, { detail }));
}

export function onMaterielEvent(listener: (detail: MaterielEventDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<MaterielEventDetail>).detail;
    if (detail) listener(detail);
  };
  window.addEventListener(MATERIEL_EVENT, handler);
  return () => window.removeEventListener(MATERIEL_EVENT, handler);
}

export function emitGearEvent(
  type: MaterielEventType,
  meta?: { label?: string; toast?: string }
) {
  emitMaterielEvent(type, meta);
  const toastLabel = meta?.toast;
  if (toastLabel && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('lkdv:toast', { detail: { text: toastLabel, type: 'success' } })
    );
  }
}