'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_ORDER = [
  'forget',
  'dispo',
  'depart',
  'kits',
  'alertes',
] as const;

export type MaterielWidgetId = (typeof DEFAULT_ORDER)[number];

/** Normalise un ordre : garde les 5 zones connues, dédoublonne, ajoute les manquantes. */
export function normalizeOrder(order: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of [...order, ...DEFAULT_ORDER]) {
    if (DEFAULT_ORDER.includes(a as MaterielWidgetId) && !seen.has(a)) {
      seen.add(a);
      out.push(a);
    }
  }
  return out;
}

interface OrderState {
  order: string[];
  setOrder: (o: string[]) => void;
  move: (from: number, to: number) => void;
}

export const useMaterielOrder = create<OrderState>()(
  persist(
    (set) => ({
      order: [...DEFAULT_ORDER],
      setOrder: (o) => set({ order: normalizeOrder(o) }),
      move: (from, to) =>
        set((s) => {
          const order = [...s.order];
          const [item] = order.splice(from, 1);
          order.splice(to, 0, item);
          return { order: normalizeOrder(order) };
        }),
    }),
    { name: 'lkdv-materiel-cockpit-order-v3' }
  )
);
