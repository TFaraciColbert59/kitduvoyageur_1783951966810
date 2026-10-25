'use client';
import { create } from 'zustand';

export interface KitRecord {
  id: string;
  name: string;
  description: string | null;
  season: string | null;
  total_weight_g: number;
  is_favorite: boolean;
  is_trashed: boolean;
  updated_at: string;
  materiel_kit_items?: unknown[];
}

interface KitsState {
  kits: KitRecord[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  fetchKits: () => Promise<void>;
  select: (id: string | null) => void;
  toggleFavorite: (id: string) => Promise<void>;
  toggleTrash: (id: string) => Promise<void>;
}

/** useKits — état Zustand des kits, branché sur l'API Supabase (W-K). */
export const useKits = create<KitsState>((set, get) => ({
  kits: [],
  loading: false,
  error: null,
  selectedId: null,

  fetchKits: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/materiel/kits');
      if (!res.ok) throw new Error('Erreur chargement kits');
      const data = await res.json();
      set({ kits: data.kits ?? [], loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erreur', loading: false });
    }
  },

  select: (id) => set({ selectedId: id }),

  toggleFavorite: async (id) => {
    const kit = get().kits.find((k) => k.id === id);
    if (!kit) return;
    set({ kits: get().kits.map((k) => (k.id === id ? { ...k, is_favorite: !k.is_favorite } : k)) });
    await fetch(`/api/materiel/kits/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: !kit.is_favorite }),
    });
  },

  toggleTrash: async (id) => {
    const kit = get().kits.find((k) => k.id === id);
    if (!kit) return;
    set({ kits: get().kits.map((k) => (k.id === id ? { ...k, is_trashed: !k.is_trashed } : k)) });
    await fetch(`/api/materiel/kits/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_trashed: !kit.is_trashed }),
    });
  },
}));
