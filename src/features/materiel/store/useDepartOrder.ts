'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_DEPART_ORDER = [
  'weather',
  'kit',
  'checklist',
  'map',
  'consumables',
  'participants',
] as const;

export type DepartWidgetId = (typeof DEFAULT_DEPART_ORDER)[number];

/** Normalise un ordre : garde les widgets connus, dédoublonne, ajoute les manquants. */
export function normalizeDepartOrder(order: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...order, ...DEFAULT_DEPART_ORDER]) {
    if (DEFAULT_DEPART_ORDER.includes(id as DepartWidgetId) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

interface DepartOrderState {
  order: string[];
  setOrder: (o: string[]) => void;
}

export const useDepartOrder = create<DepartOrderState>()(
  persist(
    (set) => ({
      order: [...DEFAULT_DEPART_ORDER],
      setOrder: (o) => set({ order: normalizeDepartOrder(o) }),
    }),
    { name: 'lkdv-depart-order' }
  )
);