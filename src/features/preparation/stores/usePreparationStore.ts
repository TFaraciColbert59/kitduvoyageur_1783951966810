import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  GearItem,
  GearCategory,
  GearStatus,
  HumanParticipant,
  DogParticipant,
  WeightBreakdown,
  PreparationStats,
  ParticipantLoad,
  ShakedownReport,
} from '../types/preparation.types';
import {
  calculateWeightBreakdown,
  calculatePreparationStats,
} from '../services/weightCalculator';
import {
  calculateDogMaxPackWeight,
  calculateDogWaterRation,
  calculateDogFoodRation,
  calculateParticipantLoads,
} from '../services/loadDistribution';
import { generateShakedownReport } from '../services/gearGapEngine';

const PREPARATION_STORAGE_KEY = 'lkdv_preparation_state_v2';

export const DEFAULT_PREPARATION_GEAR: GearItem[] = [
  {
    id: 'gear-1',
    name: 'Tente Dôme 2P Ultra-Light',
    weightGrams: 1720,
    category: 'shelter',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
    brand: 'MSR Hubba',
  },
  {
    id: 'gear-2',
    name: 'Sac de couchage 0°C Duvet',
    weightGrams: 770,
    category: 'sleep',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
    brand: 'Valandré',
  },
  {
    id: 'gear-3',
    name: 'Matelas gonflable isolé R-3.8',
    weightGrams: 430,
    category: 'sleep',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
    brand: 'Therm-a-Rest',
  },
  {
    id: 'gear-4',
    name: 'Réchaud compact & Popote titane',
    weightGrams: 370,
    category: 'cook',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
    brand: 'MSR PocketRocket',
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
    name: 'Gourde filtrante 1L',
    weightGrams: 85,
    category: 'water',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: true, // Vital
    quantity: 1,
    brand: 'Sawyer Mini',
  },
  {
    id: 'gear-7',
    name: 'Trousse de secours & Couverture de survie',
    weightGrams: 250,
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
    name: 'Lampe frontale rechargeable 350lm',
    weightGrams: 100,
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
    name: 'Veste imperméable 3 couches',
    weightGrams: 400,
    category: 'clothing',
    status: 'packed',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: false,
    quantity: 1,
    brand: 'Gore-Tex',
  },
  {
    id: 'gear-10',
    name: 'Chaussures de randonnée Gore-Tex',
    weightGrams: 920,
    category: 'clothing',
    status: 'packed',
    isPrivate: false,
    isWorn: true, // Worn on body
    isConsumable: false,
    isVital: false,
    quantity: 1,
  },
  {
    id: 'gear-11',
    name: 'Bâtons de marche carbone',
    weightGrams: 340,
    category: 'misc',
    status: 'packed',
    isPrivate: false,
    isWorn: true, // In hands
    isConsumable: false,
    isVital: false,
    quantity: 1,
  },
  {
    id: 'gear-12',
    name: 'Sifflet de détresse',
    weightGrams: 15,
    category: 'safety',
    status: 'to_buy',
    isPrivate: false,
    isWorn: false,
    isConsumable: false,
    isVital: true,
    quantity: 1,
  },
];

export const DEFAULT_PREPARATION_HUMANS: HumanParticipant[] = [
  {
    id: 'human-1',
    type: 'human',
    publicData: {
      id: 'human-1',
      firstName: 'Alexandre',
      bodyWeightKg: 74,
      packWeightKg: 4.3,
      fitnessScore: 92,
      role: 'guide',
    },
    privateData: {
      bloodType: 'O+',
      allergies: ['Pénicilline'],
      iceContact: {
        name: 'Claire Dupont',
        phone: '+33 6 12 34 56 78',
        relationship: 'Conjointe',
      },
      medications: ['Antihistaminique d’urgence'],
      medicalNotes: 'Sensibilité cheville droite après entorse en 2024.',
    },
    isUnlocked: false,
  },
  {
    id: 'human-2',
    type: 'human',
    publicData: {
      id: 'human-2',
      firstName: 'Sarah',
      bodyWeightKg: 62,
      packWeightKg: 4.1,
      fitnessScore: 84,
      role: 'member',
    },
    privateData: {
      bloodType: 'A+',
      allergies: ['Arachides'],
      iceContact: {
        name: 'Marc Martin',
        phone: '+33 6 98 76 54 32',
        relationship: 'Frère',
      },
    },
    isUnlocked: false,
  },
];

export const DEFAULT_PREPARATION_DOGS: DogParticipant[] = [
  {
    id: 'dog-1',
    type: 'dog',
    name: 'Taïga',
    breed: 'Berger Australien',
    weightKg: 24,
    isCarryingPack: true,
    packWeightKg: 2.5,
    maxCarryingCapacityKg: calculateDogMaxPackWeight(24),
    waterRationLitersPerDay: calculateDogWaterRation(24, 600, 22),
    foodRationGramsPerDay: calculateDogFoodRation(24, true),
  },
];

export type PreparationTab = 'gear' | 'team' | 'shakedown' | 'weight';

export interface PreparationStoreState {
  trekName: string;
  destination: string;
  targetDate: string;

  items: GearItem[];
  humans: HumanParticipant[];
  dogs: DogParticipant[];

  activeTab: PreparationTab;
  categoryFilter: GearCategory | 'all';
  statusFilter: GearStatus | 'all';

  // Actions Items
  setItemStatus: (id: string, status: GearStatus) => void;
  toggleItemWorn: (id: string) => void;
  addItem: (item: Omit<GearItem, 'id'>) => void;
  updateItem: (id: string, partial: Partial<GearItem>) => void;
  removeItem: (id: string) => void;
  setItems: (items: GearItem[]) => void;

  // Actions Participants
  addHuman: (human: Omit<HumanParticipant, 'id' | 'isUnlocked'>) => void;
  updateHuman: (id: string, partial: Partial<HumanParticipant>) => void;
  removeHuman: (id: string) => void;
  unlockParticipant: (id: string) => void;
  lockParticipant: (id: string) => void;
  lockAll: () => void;

  // Actions Chiens
  addDog: (dog: Omit<DogParticipant, 'id' | 'maxCarryingCapacityKg' | 'waterRationLitersPerDay' | 'foodRationGramsPerDay'>) => void;
  updateDog: (id: string, partial: Partial<DogParticipant>) => void;
  removeDog: (id: string) => void;

  // Navigation & Filtres
  setActiveTab: (tab: PreparationTab) => void;
  setCategoryFilter: (category: GearCategory | 'all') => void;
  setStatusFilter: (status: GearStatus | 'all') => void;
  setTrekInfo: (info: { trekName?: string; destination?: string; targetDate?: string }) => void;

  // Getters Dérivés
  getWeightBreakdown: () => WeightBreakdown;
  getPreparationStats: () => PreparationStats;
  getParticipantLoads: () => ParticipantLoad[];
  getShakedownReport: () => ShakedownReport;
}

export const usePreparationStore = create<PreparationStoreState>()(
  persist(
    (set, get) => ({
      trekName: 'Trek Jura 2 jours',
      destination: 'Massif du Jura — Crêtes Franco-Suisses',
      targetDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),

      items: DEFAULT_PREPARATION_GEAR,
      humans: DEFAULT_PREPARATION_HUMANS,
      dogs: DEFAULT_PREPARATION_DOGS,

      activeTab: 'gear',
      categoryFilter: 'all',
      statusFilter: 'all',

      // Items
      setItemStatus: (id, status) => {
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, status } : i)),
        }));
      },

      toggleItemWorn: (id) => {
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, isWorn: !i.isWorn } : i)),
        }));
      },

      addItem: (itemData) => {
        const newItem: GearItem = {
          ...itemData,
          id: `gear-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        };
        set((state) => ({ items: [...state.items, newItem] }));
      },

      updateItem: (id, partial) => {
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, ...partial } : i)),
        }));
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));
      },

      setItems: (items) => {
        set({ items });
      },

      // Humans
      addHuman: (humanData) => {
        const newHuman: HumanParticipant = {
          ...humanData,
          id: `human-${Date.now()}`,
          type: 'human',
          isUnlocked: false,
        };
        set((state) => ({ humans: [...state.humans, newHuman] }));
      },

      updateHuman: (id, partial) => {
        set((state) => ({
          humans: state.humans.map((h) => (h.id === id ? { ...h, ...partial } : h)),
        }));
      },

      removeHuman: (id) => {
        set((state) => ({
          humans: state.humans.filter((h) => h.id !== id),
        }));
      },

      unlockParticipant: (id) => {
        set((state) => ({
          humans: state.humans.map((h) =>
            h.id === id ? { ...h, isUnlocked: true, unlockedAt: Date.now() } : h
          ),
        }));
      },

      lockParticipant: (id) => {
        set((state) => ({
          humans: state.humans.map((h) =>
            h.id === id ? { ...h, isUnlocked: false, unlockedAt: undefined } : h
          ),
        }));
      },

      lockAll: () => {
        set((state) => ({
          humans: state.humans.map((h) => ({ ...h, isUnlocked: false, unlockedAt: undefined })),
        }));
      },

      // Dogs
      addDog: (dogData) => {
        const weightKg = dogData.weightKg || 15;
        const newDog: DogParticipant = {
          ...dogData,
          id: `dog-${Date.now()}`,
          type: 'dog',
          weightKg,
          maxCarryingCapacityKg: calculateDogMaxPackWeight(weightKg),
          waterRationLitersPerDay: calculateDogWaterRation(weightKg, 500, 20),
          foodRationGramsPerDay: calculateDogFoodRation(weightKg, dogData.isCarryingPack),
        };
        set((state) => ({ dogs: [...state.dogs, newDog] }));
      },

      updateDog: (id, partial) => {
        set((state) => ({
          dogs: state.dogs.map((d) => {
            if (d.id !== id) return d;
            const updated = { ...d, ...partial };
            if (partial.weightKg !== undefined) {
              updated.maxCarryingCapacityKg = calculateDogMaxPackWeight(updated.weightKg);
              updated.waterRationLitersPerDay = calculateDogWaterRation(updated.weightKg, 500, 20);
              updated.foodRationGramsPerDay = calculateDogFoodRation(updated.weightKg, updated.isCarryingPack);
            }
            return updated;
          }),
        }));
      },

      removeDog: (id) => {
        set((state) => ({
          dogs: state.dogs.filter((d) => d.id !== id),
        }));
      },

      // Nav & Filter
      setActiveTab: (tab) => set({ activeTab: tab }),
      setCategoryFilter: (cat) => set({ categoryFilter: cat }),
      setStatusFilter: (status) => set({ statusFilter: status }),
      setTrekInfo: (info) =>
        set((state) => ({
          trekName: info.trekName ?? state.trekName,
          destination: info.destination ?? state.destination,
          targetDate: info.targetDate ?? state.targetDate,
        })),

      // Getters
      getWeightBreakdown: () => {
        return calculateWeightBreakdown(get().items);
      },

      getPreparationStats: () => {
        const { items, humans, dogs } = get();
        return calculatePreparationStats(items, [...humans, ...dogs]);
      },

      getParticipantLoads: () => {
        const { items, humans, dogs } = get();
        return calculateParticipantLoads(items, humans, dogs);
      },

      getShakedownReport: () => {
        return generateShakedownReport(get().items);
      },
    }),
    {
      name: PREPARATION_STORAGE_KEY,
      partialize: (state) => ({
        items: state.items,
        humans: state.humans.map((h) => ({ ...h, isUnlocked: false })), // Always persist locked
        dogs: state.dogs,
        trekName: state.trekName,
        destination: state.destination,
        targetDate: state.targetDate,
      }),
    }
  )
);
