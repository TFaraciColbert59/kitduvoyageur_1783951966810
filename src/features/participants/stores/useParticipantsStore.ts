import { create } from 'zustand';
import {
  HumanParticipant,
  DogParticipant,
  ParticipantsGroupStats,
} from '../types/participant.types';
import {
  calculateDogMaxPackWeight,
  calculateDogWaterRation,
  calculateDogFoodRation,
} from '../services/dogCareService';

const PARTICIPANTS_STORAGE_KEY = 'lkdv_participants_state_v1';

const DEFAULT_HUMANS: HumanParticipant[] = [
  {
    id: 'human-1',
    type: 'human',
    publicData: {
      id: 'human-1',
      firstName: 'Alexandre',
      avatarUrl: '',
      packWeightKg: 11.4,
      fitnessScore: 88,
      role: 'guide',
    },
    privateData: {
      bloodType: 'O+',
      allergies: ['Pénicilline', 'Guêpes'],
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
      avatarUrl: '',
      packWeightKg: 9.8,
      fitnessScore: 76,
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

const DEFAULT_DOGS: DogParticipant[] = [
  {
    id: 'dog-1',
    type: 'dog',
    name: 'Taïga',
    breed: 'Berger Australien',
    weightKg: 24,
    isCarryingPack: true,
    packWeightKg: 2.8,
    maxCarryingCapacityKg: calculateDogMaxPackWeight(24),
    waterRationLitersPerDay: calculateDogWaterRation(24, 600, 22),
    foodRationGramsPerDay: calculateDogFoodRation(24, true),
  },
];

interface ParticipantsStoreState {
  humans: HumanParticipant[];
  dogs: DogParticipant[];

  // Actions
  unlockParticipant: (id: string) => void;
  lockParticipant: (id: string) => void;
  lockAll: () => void;

  addHuman: (human: Omit<HumanParticipant, 'id' | 'isUnlocked'>) => void;
  updateHuman: (id: string, partial: Partial<HumanParticipant>) => void;
  removeHuman: (id: string) => void;

  addDog: (dog: Omit<DogParticipant, 'id' | 'maxCarryingCapacityKg' | 'waterRationLitersPerDay' | 'foodRationGramsPerDay'>) => void;
  updateDog: (id: string, partial: Partial<DogParticipant>) => void;
  removeDog: (id: string) => void;

  getGroupStats: () => ParticipantsGroupStats;
}

function loadStoredParticipants(): { humans: HumanParticipant[]; dogs: DogParticipant[] } {
  if (typeof window === 'undefined') return { humans: DEFAULT_HUMANS, dogs: DEFAULT_DOGS };
  try {
    const raw = localStorage.getItem(PARTICIPANTS_STORAGE_KEY);
    if (!raw) return { humans: DEFAULT_HUMANS, dogs: DEFAULT_DOGS };
    const parsed = JSON.parse(raw);
    return {
      // Ensure all loaded participants are locked by default for security
      humans: (parsed.humans || DEFAULT_HUMANS).map((h: HumanParticipant) => ({ ...h, isUnlocked: false })),
      dogs: parsed.dogs || DEFAULT_DOGS,
    };
  } catch {
    return { humans: DEFAULT_HUMANS, dogs: DEFAULT_DOGS };
  }
}

function persistParticipants(humans: HumanParticipant[], dogs: DogParticipant[]) {
  if (typeof window === 'undefined') return;
  try {
    // Persist locked state by default
    const safeHumans = humans.map((h) => ({ ...h, isUnlocked: false }));
    localStorage.setItem(
      PARTICIPANTS_STORAGE_KEY,
      JSON.stringify({ humans: safeHumans, dogs })
    );
  } catch {}
}

export const useParticipantsStore = create<ParticipantsStoreState>((set, get) => {
  const initial = loadStoredParticipants();

  return {
    humans: initial.humans,
    dogs: initial.dogs,

    unlockParticipant: (id: string) => {
      set((state) => ({
        humans: state.humans.map((h) =>
          h.id === id ? { ...h, isUnlocked: true, unlockedAt: Date.now() } : h
        ),
      }));
    },

    lockParticipant: (id: string) => {
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

    addHuman: (humanData) => {
      set((state) => {
        const newId = `human-${Date.now()}`;
        const newHuman: HumanParticipant = {
          ...humanData,
          id: newId,
          type: 'human',
          isUnlocked: false,
        };
        const nextHumans = [...state.humans, newHuman];
        persistParticipants(nextHumans, state.dogs);
        return { humans: nextHumans };
      });
    },

    updateHuman: (id, partial) => {
      set((state) => {
        const nextHumans = state.humans.map((h) => (h.id === id ? { ...h, ...partial } : h));
        persistParticipants(nextHumans, state.dogs);
        return { humans: nextHumans };
      });
    },

    removeHuman: (id) => {
      set((state) => {
        const nextHumans = state.humans.filter((h) => h.id !== id);
        persistParticipants(nextHumans, state.dogs);
        return { humans: nextHumans };
      });
    },

    addDog: (dogData) => {
      set((state) => {
        const newId = `dog-${Date.now()}`;
        const maxCapacity = calculateDogMaxPackWeight(dogData.weightKg);
        const waterRation = calculateDogWaterRation(dogData.weightKg, 500, 20);
        const foodRation = calculateDogFoodRation(dogData.weightKg, dogData.isCarryingPack);

        const newDog: DogParticipant = {
          ...dogData,
          id: newId,
          type: 'dog',
          maxCarryingCapacityKg: maxCapacity,
          waterRationLitersPerDay: waterRation,
          foodRationGramsPerDay: foodRation,
        };

        const nextDogs = [...state.dogs, newDog];
        persistParticipants(state.humans, nextDogs);
        return { dogs: nextDogs };
      });
    },

    updateDog: (id, partial) => {
      set((state) => {
        const nextDogs = state.dogs.map((d) => {
          if (d.id !== id) return d;
          const updated = { ...d, ...partial };
          if (partial.weightKg !== undefined) {
            updated.maxCarryingCapacityKg = calculateDogMaxPackWeight(updated.weightKg);
            updated.waterRationLitersPerDay = calculateDogWaterRation(updated.weightKg, 500, 20);
            updated.foodRationGramsPerDay = calculateDogFoodRation(updated.weightKg, updated.isCarryingPack);
          }
          return updated;
        });
        persistParticipants(state.humans, nextDogs);
        return { dogs: nextDogs };
      });
    },

    removeDog: (id) => {
      set((state) => {
        const nextDogs = state.dogs.filter((d) => d.id !== id);
        persistParticipants(state.humans, nextDogs);
        return { dogs: nextDogs };
      });
    },

    getGroupStats: () => {
      const { humans, dogs } = get();
      const totalHumans = humans.length;
      const totalDogs = dogs.length;

      const totalPackWeightKg =
        humans.reduce((acc, h) => acc + h.publicData.packWeightKg, 0) +
        dogs.reduce((acc, d) => acc + (d.isCarryingPack ? d.packWeightKg : 0), 0);

      const totalWaterDailyLiters =
        totalHumans * 2.5 +
        dogs.reduce((acc, d) => acc + d.waterRationLitersPerDay, 0);

      return {
        totalHumans,
        totalDogs,
        totalGroupWeightKg: Math.round(totalPackWeightKg * 10) / 10,
        totalPackWeightKg: Math.round(totalPackWeightKg * 10) / 10,
        totalWaterDailyLiters: Math.round(totalWaterDailyLiters * 10) / 10,
      };
    },
  };
});
