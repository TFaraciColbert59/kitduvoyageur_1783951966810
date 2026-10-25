import { create } from 'zustand';
import { GearItem, GearCategory, GearStatus, WeightBreakdown, ShakedownReport } from '../types/gear.types';
import { calculateWeightBreakdown, generateShakedownReport } from '../services/shakedownEngine';

const GEAR_STORAGE_KEY = 'lkdv_gear_state_v1';

const DEFAULT_GEAR: GearItem[] = [
  {
    id: 'gear-1',
    name: 'Tente Dôme 2 Places Double Toit',
    weightGrams: 2150,
    category: 'shelter',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
    brand: 'Forclaz',
  },
  {
    id: 'gear-2',
    name: 'Sac de couchage 0°C Synthétique',
    weightGrams: 1420,
    category: 'sleep',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
    brand: 'Millet',
  },
  {
    id: 'gear-3',
    name: 'Matelas gonflable isolé R-Value 3.8',
    weightGrams: 490,
    category: 'sleep',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
    brand: 'Sea to Summit',
  },
  {
    id: 'gear-4',
    name: 'Réchaud à vis ultra-compact',
    weightGrams: 75,
    category: 'cook',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
    brand: 'Soto',
  },
  {
    id: 'gear-5',
    name: 'Cartouche de gaz 230g',
    weightGrams: 380,
    category: 'cook',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: true, // Consumable
    isVital: false,
    quantity: 1,
  },
  {
    id: 'gear-6',
    name: 'Gourde souple 1L avec filtre à eau',
    weightGrams: 95,
    category: 'water',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: true, // Vital
    quantity: 1,
    brand: 'Katadyn BeFree',
  },
  {
    id: 'gear-7',
    name: 'Trousse de secours & Couverture de survie',
    weightGrams: 160,
    category: 'safety',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: true, // Vital
    quantity: 1,
    brand: 'Care Plus',
  },
  {
    id: 'gear-8',
    name: 'Lampe frontale 350 lumens rechargeable',
    weightGrams: 85,
    category: 'tech',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: true, // Vital
    quantity: 1,
    brand: 'Petzl',
  },
  {
    id: 'gear-9',
    name: 'Veste Gore-Tex 3 couches',
    weightGrams: 380,
    category: 'clothing',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
    brand: 'Arc’teryx',
  },
  {
    id: 'gear-10',
    name: 'Chaussures de trail Mid imperméables',
    weightGrams: 890,
    category: 'clothing',
    status: 'packed',
    isPrivate: false,
    isWorn: true, // Worn on body
    isConsumable: false,
    isVital: false,
    quantity: 1,
    brand: 'Salomon',
  },
  {
    id: 'gear-11',
    name: 'Bâtons de marche carbone pliables',
    weightGrams: 310,
    category: 'misc',
    status: 'packed',
    isPrivate: false,
    isWorn: true, // Worn / in hands
    isConsumable: false,
    isVital: false,
    quantity: 1,
    brand: 'Black Diamond',
  },
];

interface GearStoreState {
  items: GearItem[];
  categoryFilter: GearCategory | 'all';
  statusFilter: GearStatus | 'all';

  // Actions
  setCategoryFilter: (category: GearCategory | 'all') => void;
  setStatusFilter: (status: GearStatus | 'all') => void;
  setItemStatus: (id: string, status: GearStatus) => void;
  toggleItemWorn: (id: string) => void;
  addItem: (item: Omit<GearItem, 'id'>) => void;
  updateItem: (id: string, partial: Partial<GearItem>) => void;
  removeItem: (id: string) => void;

  getWeightBreakdown: () => WeightBreakdown;
  getShakedownReport: () => ShakedownReport;
}

function loadStoredGear(): GearItem[] {
  if (typeof window === 'undefined') return DEFAULT_GEAR;
  try {
    const raw = localStorage.getItem(GEAR_STORAGE_KEY);
    if (!raw) return DEFAULT_GEAR;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_GEAR;
  }
}

function persistGear(items: GearItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GEAR_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export const useGearStore = create<GearStoreState>((set, get) => {
  const initialItems = loadStoredGear();

  return {
    items: initialItems,
    categoryFilter: 'all',
    statusFilter: 'all',

    setCategoryFilter: (category) => set({ categoryFilter: category }),
    setStatusFilter: (status) => set({ statusFilter: status }),

    setItemStatus: (id, status) => {
      set((state) => {
        const nextItems = state.items.map((item) =>
          item.id === id ? { ...item, status } : item
        );
        persistGear(nextItems);
        return { items: nextItems };
      });
    },

    toggleItemWorn: (id) => {
      set((state) => {
        const nextItems = state.items.map((item) =>
          item.id === id ? { ...item, isWorn: !item.isWorn } : item
        );
        persistGear(nextItems);
        return { items: nextItems };
      });
    },

    addItem: (itemData) => {
      set((state) => {
        const newId = `gear-${Date.now()}`;
        const newItem: GearItem = {
          ...itemData,
          id: newId,
        };
        const nextItems = [...state.items, newItem];
        persistGear(nextItems);
        return { items: nextItems };
      });
    },

    updateItem: (id, partial) => {
      set((state) => {
        const nextItems = state.items.map((item) =>
          item.id === id ? { ...item, ...partial } : item
        );
        persistGear(nextItems);
        return { items: nextItems };
      });
    },

    removeItem: (id) => {
      set((state) => {
        const nextItems = state.items.filter((item) => item.id !== id);
        persistGear(nextItems);
        return { items: nextItems };
      });
    },

    getWeightBreakdown: () => {
      return calculateWeightBreakdown(get().items);
    },

    getShakedownReport: () => {
      return generateShakedownReport(get().items);
    },
  };
});
