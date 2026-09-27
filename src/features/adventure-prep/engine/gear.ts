import { activityById } from '../catalog';
import type { AdventurePrepDraft, GearCategory, GearNeed } from '../types';

interface GearBlueprint {
  id: string;
  name: string;
  category: GearCategory;
  vital: boolean;
  /** Catégories d'activites qui rendent cet equipement necessaire. */
  forCategories?: readonly string[];
  forActivities?: readonly string[];
  forNights?: readonly string[];
  always?: boolean;
}

const BLUEPRINTS: readonly GearBlueprint[] = [
  { id: 'eau', name: 'Eau', category: 'water', vital: true, always: true },
  { id: 'sac', name: 'Sac à dos', category: 'misc', vital: true, always: true },
  {
    id: 'navigation',
    name: 'Navigation (papier ou hors ligne)',
    category: 'navigation',
    vital: true,
    forCategories: ['neige_montagne', 'a_pied', 'eau'],
  },
  {
    id: 'coupe-vent',
    name: 'Coupe-vent et imperméable',
    category: 'clothing',
    vital: false,
    forCategories: ['neige_montagne', 'a_pied'],
  },
  {
    id: 'phare',
    name: 'Lampe frontale',
    category: 'safety',
    vital: false,
    forCategories: ['neige_montagne', 'eau'],
  },
  { id: 'trousse', name: 'Trousse de secours', category: 'safety', vital: true, always: true },
  {
    id: 'abri',
    name: 'Abri de nuit',
    category: 'shelter',
    vital: false,
    forNights: ['bivouac'],
  },
  {
    id: 'cuitage',
    name: 'Matériel de cuisson',
    category: 'cook',
    vital: false,
    forCategories: ['a_pied', 'eau'],
    forNights: ['bivouac'],
  },
  {
    id: 'dormeur',
    name: 'Dormeur ou sac de couchage',
    category: 'sleep',
    vital: false,
    forNights: ['bivouac'],
  },
  {
    id: 'chaussures',
    name: 'Chaussures de secours',
    category: 'clothing',
    vital: false,
    forCategories: ['a_pied', 'a_velo'],
  },
  { id: 'casque', name: 'Casque', category: 'safety', vital: true, forCategories: ['a_velo'] },
  { id: 'gilet', name: 'Gilet de nage', category: 'safety', vital: true, forCategories: ['eau'] },
  { id: 'batelier', name: 'Bâche ou couverture', category: 'misc', vital: false, forActivities: ['bivouac'] },
];

/** Besoins derives du choix d'activite. Rien n'est coche : posseder n'est pas preparer. */
export function buildGearNeeds(draft: AdventurePrepDraft): GearNeed[] {
  const selection = draft.activities;
  const primary = activityById(selection.primary ?? '');
  const extras = selection.extra.map((id) => activityById(id)).filter((a) => a !== undefined);
  const categories = new Set<string>();
  for (const activity of [primary, ...extras]) {
    if (activity) categories.add(activity.category);
  }
  const nights = new Set(selection.nights);
  const activityIds = new Set([selection.primary, ...selection.extra].filter((id): id is string => !!id));

  return BLUEPRINTS.filter((blueprint) => {
    if (blueprint.always) return true;
    if (blueprint.forCategories?.some((category) => categories.has(category))) return true;
    if (blueprint.forActivities?.some((id) => activityIds.has(id))) return true;
    if (blueprint.forNights?.some((id) => nights.has(id))) return true;
    return false;
  }).map((blueprint) => ({
    id: blueprint.id,
    name: blueprint.name,
    category: blueprint.category,
    quantity: 1,
    vital: blueprint.vital,
    requiredFor: [...categories],
    ownerId: null,
    weightGrams: null,
    packed: false,
  }));
}

export interface PackWeight {
  grams: number | null;
  hasGaps: boolean;
}

/**
 * Besoins derives du brouillon, enrichis de ce que l'utilisateur a saisi.
 *
 * Fonction PURE : elle ne depend pas du store, donc le premier rendu serveur
 * et le premier rendu client produisent exactement la meme liste. Sans cela,
 * l'ecran affichait « Aucun équipement identifié » avant que l'effet de
 * synchronisation ne rattrape.
 */
export function resolvedGear(draft: AdventurePrepDraft): GearNeed[] {
  const needs = buildGearNeeds(draft);
  const byId = new Map(needs.map((item) => [item.id, item]));
  return draft.gear
    .map((item) => {
      const fresh = byId.get(item.id);
      return fresh ? { ...fresh, ownerId: item.ownerId, weightGrams: item.weightGrams } : item;
    })
    .concat(needs.filter((item) => !draft.gear.some((existing) => existing.id === item.id)));
}

/** Somme seulement si tous les poids sont connus : jamais de total partiel. */
export function packWeight(gear: readonly GearNeed[]): PackWeight {
  // Un sac vide n'est pas un sac de 0 kg : l'information reste inconnue.
  if (gear.length === 0) return { grams: null, hasGaps: true };
  const hasGaps = gear.some((item) => item.weightGrams === null);
  if (hasGaps) return { grams: null, hasGaps: true };
  return {
    grams: gear.reduce((total, item) => total + (item.weightGrams ?? 0) * item.quantity, 0),
    hasGaps: false,
  };
}

export interface GearGap {
  name: string;
  /** `inconnu` : on n'a pas demandé. `absent` : on a demandé, personne ne l'a. */
  ownership: 'inconnu' | 'absent';
}

export function gearGaps(
  gear: readonly GearNeed[],
  packedGearIds: readonly string[],
): GearGap[] {
  return gear
    .filter((item) => !packedGearIds.includes(item.id))
    .map((item) => ({ name: item.name, ownership: item.ownerId === null ? 'inconnu' : 'absent' }));
}

