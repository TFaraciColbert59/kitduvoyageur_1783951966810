'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_KITS_ORDER = [
  'kpi',
  'preparation',
  'builder',
  'kit',
  'templates',
] as const;

export type KitsWidgetId = (typeof DEFAULT_KITS_ORDER)[number];

/** Normalise un ordre pour les kits : garde les widgets connus, dédoublonne, ajoute les manquants. */
export function normalizeKitsOrder(order: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...order, ...DEFAULT_KITS_ORDER]) {
    if (DEFAULT_KITS_ORDER.includes(id as KitsWidgetId) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

interface KitsOrderState {
  order: string[];
  setOrder: (o: string[]) => void;
}

export const useKitsOrder = create<KitsOrderState>()(
  persist(
    (set) => ({
      order: [...DEFAULT_KITS_ORDER],
      setOrder: (o) => set({ order: normalizeKitsOrder(o) }),
    }),
    { name: 'lkdv-kits-cockpit-order' }
  )
);
