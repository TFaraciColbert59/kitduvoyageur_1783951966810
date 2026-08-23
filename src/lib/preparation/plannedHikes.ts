import { newId } from '@/lib/uuid';

/**
 * LKDV — Planned Hikes Manager
 * Gestion des randonnées planifiées enregistrées depuis le préparateur ou explorateur
 * vers le système unifié Mon Matériel.
 */

export interface PlannedHike {
  id: string;
  routeId?: string;
  name: string;
  distanceKm: number;
  elevationGain?: number;
  elevationLoss?: number;
  difficulty?: string;
  season?: string;
  terrain?: string;
  hasWaterPoints?: boolean;
  waterPointsCount?: number;
  hasRefuges?: boolean;
  isOvernight?: boolean;
  nightsCount?: number;
  targetDate: string; // YYYY-MM-DD
  createdAt: string;
  weather?: any;
  /** Kit LKDV assigné à cette sortie (affiché et sélectionnable depuis Mon Matériel). */
  assignedKitId?: string;
  /** Compagnons de sortie (informational, saisi dans le cockpit). */
  companions?: string;
}

const STORAGE_KEY = 'lkdv_planned_hikes';
const ACTIVE_HIKE_KEY = 'lkdv_active_planned_hike_id';

export const DEFAULT_SAMPLE_HIKES: PlannedHike[] = [
  {
    id: 'sample-tmb-1',
    name: 'Tour du Mont-Blanc — Étape 1',
    distanceKm: 14.5,
    elevationGain: 950,
    elevationLoss: 400,
    difficulty: 'Difficile',
    season: 'Été',
    terrain: 'Haute Montagne',
    hasWaterPoints: true,
    waterPointsCount: 2,
    hasRefuges: true,
    isOvernight: true,
    nightsCount: 1,
    targetDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    weather: {
      tempC: 14,
      precipitationProbability: 0.15,
      windKmH: 20,
      uvIndex: 6,
      condition: 'Éclaircies en altitude',
      isAlert: false,
    },
  },
  {
    id: 'sample-calanques',
    name: 'Massif des Calanques — Sentier Côtier',
    distanceKm: 11.2,
    elevationGain: 420,
    elevationLoss: 420,
    difficulty: 'Moyen',
    season: 'Printemps',
    terrain: 'Rocheux & Littoral',
    hasWaterPoints: false,
    waterPointsCount: 0,
    hasRefuges: false,
    isOvernight: false,
    targetDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    weather: {
      tempC: 24,
      precipitationProbability: 0,
      windKmH: 15,
      uvIndex: 8,
      condition: 'Ensoleillé & Chaud',
      isAlert: false,
    },
  },
];

export function getPlannedHikes(): PlannedHike[] {
  if (typeof window === 'undefined') return DEFAULT_SAMPLE_HIKES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SAMPLE_HIKES));
      return DEFAULT_SAMPLE_HIKES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SAMPLE_HIKES;
  }
}

export function savePlannedHike(hikeData: Omit<PlannedHike, 'id' | 'createdAt'>): PlannedHike {
  const all = getPlannedHikes();
  const newHike: PlannedHike = {
    ...hikeData,
    id: newId(),
    createdAt: new Date().toISOString(),
  };
  const updated = [newHike, ...all.filter((h) => h.routeId !== hikeData.routeId)];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      localStorage.setItem(ACTIVE_HIKE_KEY, newHike.id);
    } catch {}
  }
  return newHike;
}

export function getActivePlannedHike(): PlannedHike {
  const all = getPlannedHikes();
  if (typeof window === 'undefined') return all[0] || DEFAULT_SAMPLE_HIKES[0];
  try {
    const activeId = localStorage.getItem(ACTIVE_HIKE_KEY);
    const found = all.find((h) => h.id === activeId);
    return found || all[0] || DEFAULT_SAMPLE_HIKES[0];
  } catch {
    return all[0] || DEFAULT_SAMPLE_HIKES[0];
  }
}

export function setActivePlannedHikeId(id: string) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ACTIVE_HIKE_KEY, id);
    } catch {}
  }
}

function persist(all: PlannedHike[]): PlannedHike[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
  }
  return all;
}

/** Met à jour partiellement une randonnée planifiée (ex. kit assigné, compagnons). */
export function updatePlannedHike(id: string, patch: Partial<Omit<PlannedHike, 'id' | 'createdAt'>>): PlannedHike[] {
  const all = getPlannedHikes().map((h) => (h.id === id ? { ...h, ...patch } : h));
  persist(all);
  return all;
}

/** Supprime une randonnée planifiée. */
export function removePlannedHike(id: string): PlannedHike[] {
  const all = getPlannedHikes().filter((h) => h.id !== id);
  persist(all);
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem(ACTIVE_HIKE_KEY) === id) {
        localStorage.removeItem(ACTIVE_HIKE_KEY);
      }
    } catch {}
  }
  return all;
}
