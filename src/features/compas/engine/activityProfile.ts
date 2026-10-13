/**
 * Compas — profil de déplacement d'une activité (distance du jour, moyen,
 * natures de lieux préférées). Module PUR : aucune I/O.
 *
 * Sorti de `itinerary.ts` pour que le choix des bases d'un pays
 * (`countryBases.ts`) et celui du massif d'une île (`islands.ts`) lisent le
 * MÊME barème que le planificateur, sans dépendre de lui.
 */
import type { StageMove } from './autofill';
import type { AreaPlaceKind } from './itinerary';

export interface Profile {
  move: StageMove;
  /** Distance du jour sur le terrain (km) : min, cible, max. */
  dayKm: [number, number, number];
  /** Vol d'oiseau ≈ terrain × ce coefficient (sentiers et routes serpentent). */
  crow: number;
  /** Préférence de nature de lieu (plus haut = mieux). */
  prefer: Partial<Record<AreaPlaceKind, number>>;
  itinerant: boolean;
}

const FOOT: Profile = {
  move: 'marche',
  dayKm: [10, 16, 22],
  crow: 0.65,
  prefer: { village: 3, hamlet: 2.5, hut: 2.5, town: 2, camp: 1.5, city: 0.5 },
  itinerant: true,
};
// « mixed » (aucune activité dite) n'est pas ici : un séjour sans activité se
// fait depuis une base (une ville, une région), jamais en randonnée d'étape en étape.
const PROFILES: Record<string, Profile> = {
  trekking: FOOT,
  hiking: FOOT,
  bivouac: { ...FOOT, prefer: { ...FOOT.prefer, camp: 3, hut: 3 } },
  bushcraft: { ...FOOT, dayKm: [6, 10, 15] },
  cycling: {
    move: 'velo',
    dayKm: [45, 70, 95],
    crow: 0.75,
    prefer: { town: 3, village: 2.5, city: 2, hamlet: 1 },
    itinerant: true,
  },
  roadtrip: {
    move: 'voiture',
    dayKm: [120, 200, 280],
    crow: 0.75,
    prefer: { town: 3, city: 3, village: 1.5 },
    itinerant: true,
  },
  vanlife: {
    move: 'voiture',
    dayKm: [80, 150, 230],
    crow: 0.75,
    prefer: { town: 2.5, village: 2.5, city: 1.5, camp: 3 },
    itinerant: true,
  },
};
/** Séjour sur une base, en véhicule : aussi le moyen d'un changement de base à pied ou à vélo. */
export const BASE: Profile = {
  move: 'voiture',
  dayKm: [100, 200, 300],
  crow: 0.75,
  prefer: { town: 3, city: 3, village: 2 },
  itinerant: false,
};
/** Base dans un village (ski, escalade, alpinisme) plutôt qu'en ville. */
export const MOUNTAIN_BASE = new Set(['ski', 'climbing', 'mountaineering', 'trail', 'running']);

/** Activité de montagne : l'altitude des lieux compte (base, hauteurs). */
export function isMountainActivity(activity: string): boolean {
  return MOUNTAIN_BASE.has(activity);
}

/** Bonus d'altitude d'une base de montagne : 0 sous 400 m, plafonné à 1 400 m. */
export function altitudeBonus(eleM: number | null): number {
  return eleM == null ? 0 : Math.min(2, Math.max(0, (eleM - 400) / 500));
}

export function profileFor(activity: string): Profile {
  const p = PROFILES[activity];
  if (p) return p;
  if (MOUNTAIN_BASE.has(activity)) return { ...BASE, prefer: { village: 3, town: 2.5, hamlet: 1.5, city: 1, hut: 1 } };
  return BASE;
}

/** Jours passés au même endroit avant de changer de base (séjour sur place). */
export function baseStay(activity: string): number {
  if (activity === 'citytrip' || activity === 'cultural') return 3;
  if (activity === 'roadtrip' || activity === 'vanlife') return 2;
  return 4;
}

/** Rang administratif d'une nature de lieu : une ville avant un bourg, un bourg avant un village. */
export const RANK: Record<AreaPlaceKind, number> = { city: 5, town: 4, village: 3, hamlet: 2, hut: 1, camp: 1 };
