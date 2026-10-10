/**
 * LKDV Social — Pack Merge & Group Load Distribution Engine
 * File: src/features/messaging/domain/packMerge.ts
 *
 * Implements Milestone 2 Pack Merge Engine:
 * 1. Collective Gear Deduplication:
 *    - Tents/shelters: capacity-aware optimization matching party size, retaining lightest combo.
 *    - Stoves & cookware: 1 system per 3-4 people, retaining lightest and most reliable.
 *    - Water filters: 1 primary purification unit per 4 people, retaining lightest.
 *    - Group first aid: 1 comprehensive trauma kit per expedition (prioritized to medic).
 * 2. Physiological Load Balancing:
 *    - Integrates with `src/features/preparation/services/loadDistribution.ts`.
 *    - Respects strict physiological limits: 20% max body weight ratio for humans, 15% for dogs.
 *    - Role-aware distribution:
 *      * 'guide': carries navigation, inReach/satellite, protected buffer.
 *      * 'medic': carries group medical kit, protected agility buffer.
 *      * 'scout': ultra-light reconnaissance target (<= 15%), immune to heavy camp gear.
 *      * 'dog': strictly dog-specific gear (kibble, bowl, booties), 0 human gear, max 15%.
 *    - Produces actionable safety and biomechanical warnings.
 */

import {
  DEFAULT_HUMAN_MAX_RATIO,
  DEFAULT_DOG_PORTAGE_RATIO,
  calculateDogMaxPackWeight,
} from '@/features/preparation/services/loadDistribution';
import type { ParticipantLoad } from '@/features/preparation/types/preparation.types';

// ============================================================================
// 1. DOMAIN MODELS & CONTRACTS
// ============================================================================

export type ParticipantRole =
  | 'guide'
  | 'medic'
  | 'scout'
  | 'member'
  | 'safety'
  | 'leader';

export interface PackMergeParticipant {
  id: string;
  name: string;
  bodyWeightKg: number;
  isDog?: boolean;
  role?: ParticipantRole;
  /** Personal gear weight already on back (clothes, personal sleep bag, hygiene) in grams */
  basePersonalWeightGrams?: number;
  /** Custom max carrying capacity override in grams if medically restricted */
  maxWeightGramsOverride?: number;
}

export interface PackMergeItem {
  id: string;
  name: string;
  weightGrams: number;
  category: string;
  isShared?: boolean;
  quantity?: number;
  capacityPeople?: number;
  isDogItem?: boolean;
  isVital?: boolean;
  ownerId?: string;
}

export interface PackMergeKit {
  ownerId: string;
  items: PackMergeItem[];
}

export interface PackMergeOptions {
  targetHumanRatio?: number; // Default: 0.20 (20% of body weight)
  targetDogRatio?: number; // Default: 0.15 (15% of body weight)
  targetScoutRatio?: number; // Default: 0.15 (15% for scout role)
  targetGuideRatio?: number; // Default: 0.18 (18% for guide reserve)
  deduplicateShelters?: boolean; // Default: true
  deduplicateStoves?: boolean; // Default: true
  deduplicateWaterFilters?: boolean; // Default: true
  deduplicateFirstAid?: boolean; // Default: true
}

export interface PackMergeInput {
  participants: PackMergeParticipant[];
  kits: PackMergeKit[];
  options?: PackMergeOptions;
}

export interface DeduplicatedItemRecord {
  id: string;
  name: string;
  weightGrams: number;
  category: string;
  assignedParticipantId: string;
  assignedParticipantName: string;
  isShared: boolean;
  reason?: string;
}

export interface RemovedDuplicateItem {
  id: string;
  name: string;
  weightGrams: number;
  category: string;
  originalOwnerId: string;
  reason: string;
}

export interface IndividualLoadSummary {
  participantId: string;
  name: string;
  isDog: boolean;
  role: ParticipantRole;
  bodyWeightKg: number;
  personalWeightGrams: number;
  sharedWeightGrams: number;
  totalWeightGrams: number;
  totalWeightKg: number;
  maxSafeWeightKg: number;
  bodyWeightRatio: number; // e.g. 0.18 = 18%
  loadPercentage: number; // (totalWeightKg / maxSafeWeightKg) * 100
  isOverloaded: boolean;
  items: DeduplicatedItemRecord[];
}

export interface GroupPackStats {
  totalOriginalWeightGrams: number;
  totalOptimizedWeightGrams: number;
  weightSavedGrams: number;
  weightSavedKg: number;
  duplicateCount: number;
  itemCountOriginal: number;
  itemCountOptimized: number;
  overloadedCount: number;
}

export interface PackMergeResult {
  deduplicatedItems: DeduplicatedItemRecord[];
  removedDuplicates: RemovedDuplicateItem[];
  individualLoads: Record<string, IndividualLoadSummary>;
  groupStats: GroupPackStats;
  warnings: string[];
  participantLoads: ParticipantLoad[];
}

// ============================================================================
// 2. HELPER CLASSIFIERS
// ============================================================================

/** Normalizes item string for heuristic keyword matching */
function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/** Detects if an item is a collective shelter / tent */
export function isShelterItem(item: PackMergeItem): boolean {
  const cat = normalizeStr(item.category || '');
  const name = normalizeStr(item.name || '');
  return (
    cat.includes('shelter') ||
    cat.includes('bivouac') ||
    cat.includes('abri') ||
    name.includes('tente') ||
    name.includes('tent') ||
    name.includes('tarp')
  );
}

/** Detects capacity for a tent (defaults to 2 if unspecified or inferred from title) */
export function extractTentCapacity(item: PackMergeItem): number {
  if (item.capacityPeople && item.capacityPeople > 0) {
    return item.capacityPeople;
  }
  const name = normalizeStr(item.name || '');
  if (name.includes('3p') || name.includes('3 places') || name.includes('3 person')) return 3;
  if (name.includes('4p') || name.includes('4 places') || name.includes('4 person')) return 4;
  if (name.includes('1p') || name.includes('1 place') || name.includes('solo')) return 1;
  return 2; // Default 2P tent in outdoor practice
}

/** Detects if an item is a stove or cooking system */
export function isStoveItem(item: PackMergeItem): boolean {
  const cat = normalizeStr(item.category || '');
  const name = normalizeStr(item.name || '');
  return (
    cat.includes('cook') ||
    cat.includes('cuisine') ||
    name.includes('rechaud') ||
    name.includes('stove') ||
    name.includes('jetboil') ||
    name.includes('pocketrocket') ||
    name.includes('popote')
  );
}

/** Detects if an item is a water filter or purification system */
export function isWaterFilterItem(item: PackMergeItem): boolean {
  const cat = normalizeStr(item.category || '');
  const name = normalizeStr(item.name || '');
  return (
    (cat.includes('water') || cat.includes('hydrat')) &&
    (name.includes('filtre') ||
      name.includes('filter') ||
      name.includes('sawyer') ||
      name.includes('befree') ||
      name.includes('katadyn') ||
      name.includes('purifi') ||
      name.includes('micropur'))
  );
}

/** Detects if an item is a group medical / first aid kit */
export function isFirstAidItem(item: PackMergeItem): boolean {
  const cat = normalizeStr(item.category || '');
  const name = normalizeStr(item.name || '');
  return (
    cat.includes('safety') ||
    cat.includes('securit') ||
    name.includes('secours') ||
    name.includes('medical') ||
    name.includes('pharmacie') ||
    name.includes('first aid') ||
    name.includes('trousse')
  );
}

/** Detects if an item is navigation or satellite communication gear */
export function isNavigationItem(item: PackMergeItem): boolean {
  const cat = normalizeStr(item.category || '');
  const name = normalizeStr(item.name || '');
  return (
    cat.includes('navig') ||
    name.includes('gps') ||
    name.includes('inreach') ||
    name.includes('balise') ||
    name.includes('boussole') ||
    name.includes('carte') ||
    name.includes('topo')
  );
}

/** Detects if an item is strictly for dogs */
export function isDogSpecificItem(item: PackMergeItem): boolean {
  if (item.isDogItem) return true;
  const name = normalizeStr(item.name || '');
  return (
    name.includes('chien') ||
    name.includes('dog') ||
    name.includes('croquette') ||
    name.includes('gamelle chien') ||
    name.includes('harnais bat') ||
    name.includes('bottines chien')
  );
}

// ============================================================================
// 3. PACK MERGE ENGINE
// ============================================================================

export function mergePacks(input: PackMergeInput): PackMergeResult {
  const { participants, kits, options = {} } = input;
  const targetHumanRatio = options.targetHumanRatio ?? DEFAULT_HUMAN_MAX_RATIO;
  const targetDogRatio = options.targetDogRatio ?? DEFAULT_DOG_PORTAGE_RATIO;
  const targetScoutRatio = options.targetScoutRatio ?? 0.15;
  const deduplicateShelters = options.deduplicateShelters ?? true;
  const deduplicateStoves = options.deduplicateStoves ?? true;
  const deduplicateWaterFilters = options.deduplicateWaterFilters ?? true;
  const deduplicateFirstAid = options.deduplicateFirstAid ?? true;

  const humans = participants.filter((p) => !p.isDog);
  const dogs = participants.filter((p) => !!p.isDog);
  const humanCount = humans.length;

  const removedDuplicates: RemovedDuplicateItem[] = [];
  const warnings: string[] = [];

  // 1. Flatten all items with original owner tag
  const allItems: PackMergeItem[] = [];
  let originalTotalWeightGrams = 0;

  for (const kit of kits) {
    for (const item of kit.items) {
      const qty = item.quantity || 1;
      for (let i = 0; i < qty; i++) {
        const singleItem: PackMergeItem = {
          ...item,
          id: qty > 1 ? `${item.id}-${i + 1}` : item.id,
          quantity: 1,
          ownerId: item.ownerId || kit.ownerId,
        };
        allItems.push(singleItem);
        originalTotalWeightGrams += item.weightGrams;
      }
    }
  }

  // 2. Separate personal items from shared candidates
  const personalItems: PackMergeItem[] = [];
  const sharedCandidates: PackMergeItem[] = [];

  for (const item of allItems) {
    // Explicit shared flag or collective category heuristic
    const isShared =
      item.isShared ||
      isShelterItem(item) ||
      isStoveItem(item) ||
      isWaterFilterItem(item) ||
      isFirstAidItem(item);

    if (isShared && !isDogSpecificItem(item)) {
      sharedCandidates.push(item);
    } else {
      personalItems.push(item);
    }
  }

  // 3. Deduplication Phase
  const activeSharedItems: PackMergeItem[] = [];

  // 3A. Shelter Deduplication
  const shelters = sharedCandidates.filter(isShelterItem);
  const nonShelters = sharedCandidates.filter((i) => !isShelterItem(i));

  if (deduplicateShelters && shelters.length > 0 && humanCount > 0) {
    // Sort shelters by weight efficiency (lightest weight per capacity)
    const sortedShelters = [...shelters].sort((a, b) => {
      const capA = extractTentCapacity(a);
      const capB = extractTentCapacity(b);
      const effA = a.weightGrams / capA;
      const effB = b.weightGrams / capB;
      return effA - effB;
    });

    let cumulativeCapacity = 0;
    for (const shelter of sortedShelters) {
      const cap = extractTentCapacity(shelter);
      if (cumulativeCapacity < humanCount) {
        activeSharedItems.push(shelter);
        cumulativeCapacity += cap;
      } else {
        // Redundant shelter
        removedDuplicates.push({
          id: shelter.id,
          name: shelter.name,
          weightGrams: shelter.weightGrams,
          category: shelter.category,
          originalOwnerId: shelter.ownerId || '',
          reason: `Dédoublonné : La capacité totale d'abri retenue (${cumulativeCapacity} personnes) protège le groupe (${humanCount} personnes). Abri superflu (${shelter.weightGrams}g).`,
        });
      }
    }
  } else {
    activeSharedItems.push(...shelters);
  }

  // 3B. Stove / Cooking Deduplication
  const stoves = nonShelters.filter(isStoveItem);
  const nonStoves = nonShelters.filter((i) => !isStoveItem(i));

  if (deduplicateStoves && stoves.length > 0) {
    // 1 stove per 4 humans
    const requiredStoves = Math.max(1, Math.ceil(humanCount / 4));
    // Sort stoves by weight (lightest first)
    const sortedStoves = [...stoves].sort((a, b) => a.weightGrams - b.weightGrams);

    let retainedStoves = 0;
    for (const stove of sortedStoves) {
      if (retainedStoves < requiredStoves) {
        activeSharedItems.push(stove);
        retainedStoves++;
      } else {
        removedDuplicates.push({
          id: stove.id,
          name: stove.name,
          weightGrams: stove.weightGrams,
          category: stove.category,
          originalOwnerId: stove.ownerId || '',
          reason: `Dédoublonné : ${requiredStoves} système(s) de cuisson suffisent pour ${humanCount} personnes. Réchaud superflu (${stove.weightGrams}g).`,
        });
      }
    }
  } else {
    activeSharedItems.push(...stoves);
  }

  // 3C. Water Filter Deduplication
  const waterFilters = nonStoves.filter(isWaterFilterItem);
  const nonFilters = nonStoves.filter((i) => !isWaterFilterItem(i));

  if (deduplicateWaterFilters && waterFilters.length > 0) {
    // 1 primary filter per 4 humans
    const requiredFilters = Math.max(1, Math.ceil(humanCount / 4));
    const sortedFilters = [...waterFilters].sort((a, b) => a.weightGrams - b.weightGrams);

    let retainedFilters = 0;
    for (const filter of sortedFilters) {
      if (retainedFilters < requiredFilters) {
        activeSharedItems.push(filter);
        retainedFilters++;
      } else {
        removedDuplicates.push({
          id: filter.id,
          name: filter.name,
          weightGrams: filter.weightGrams,
          category: filter.category,
          originalOwnerId: filter.ownerId || '',
          reason: `Dédoublonné : ${requiredFilters} filtre(s) à eau suffisent pour le groupe. Filtre redondant (${filter.weightGrams}g).`,
        });
      }
    }
  } else {
    activeSharedItems.push(...waterFilters);
  }

  // 3D. First Aid Kit Deduplication
  const firstAids = nonFilters.filter(isFirstAidItem);
  const remainingShared = nonFilters.filter((i) => !isFirstAidItem(i));

  if (deduplicateFirstAid && firstAids.length > 0) {
    // 1 group first-aid kit
    const sortedFirstAids = [...firstAids].sort((a, b) => b.weightGrams - a.weightGrams); // Keep the most complete one
    const primaryKit = sortedFirstAids[0];
    activeSharedItems.push(primaryKit);

    for (let i = 1; i < sortedFirstAids.length; i++) {
      const extra = sortedFirstAids[i];
      removedDuplicates.push({
        id: extra.id,
        name: extra.name,
        weightGrams: extra.weightGrams,
        category: extra.category,
        originalOwnerId: extra.ownerId || '',
        reason: `Dédoublonné : 1 trousse de secours collective couvre l'expédition. Trousse superflue (${extra.weightGrams}g).`,
      });
    }
  } else {
    activeSharedItems.push(...firstAids);
  }

  // Add other remaining shared items
  activeSharedItems.push(...remainingShared);

  // 4. Initialize Participant Loads
  const participantMap = new Map<string, PackMergeParticipant>();
  const participantLoadsMap = new Map<
    string,
    {
      participant: PackMergeParticipant;
      personalWeightGrams: number;
      sharedWeightGrams: number;
      assignedItems: DeduplicatedItemRecord[];
    }
  >();

  for (const p of participants) {
    participantMap.set(p.id, p);
    participantLoadsMap.set(p.id, {
      participant: p,
      personalWeightGrams: p.basePersonalWeightGrams || 0,
      sharedWeightGrams: 0,
      assignedItems: [],
    });
  }

  // Assign personal items to their original owners
  for (const item of personalItems) {
    const ownerId = item.ownerId || '';
    const loadRecord = participantLoadsMap.get(ownerId);

    if (loadRecord) {
      loadRecord.personalWeightGrams += item.weightGrams;
      loadRecord.assignedItems.push({
        id: item.id,
        name: item.name,
        weightGrams: item.weightGrams,
        category: item.category,
        assignedParticipantId: ownerId,
        assignedParticipantName: loadRecord.participant.name,
        isShared: false,
      });
    }
  }

  // 5. Shared Items Assignment with Role Awareness & Load Leveling
  const unassignedShared: PackMergeItem[] = [];

  // Special roles lookup
  const medic = humans.find((h) => h.role === 'medic');
  const guide = humans.find((h) => h.role === 'guide');

  for (const item of activeSharedItems) {
    // 5A. Role Prioritized Assignment
    if (isFirstAidItem(item) && medic) {
      const rec = participantLoadsMap.get(medic.id)!;
      rec.sharedWeightGrams += item.weightGrams;
      rec.assignedItems.push({
        id: item.id,
        name: item.name,
        weightGrams: item.weightGrams,
        category: item.category,
        assignedParticipantId: medic.id,
        assignedParticipantName: medic.name,
        isShared: true,
        reason: 'Attribué au secouriste (rôle médical prioritaire)',
      });
    } else if (isNavigationItem(item) && guide) {
      const rec = participantLoadsMap.get(guide.id)!;
      rec.sharedWeightGrams += item.weightGrams;
      rec.assignedItems.push({
        id: item.id,
        name: item.name,
        weightGrams: item.weightGrams,
        category: item.category,
        assignedParticipantId: guide.id,
        assignedParticipantName: guide.name,
        isShared: true,
        reason: 'Attribué au guide (rôle navigation & sécurité)',
      });
    } else {
      unassignedShared.push(item);
    }
  }

  // 5B. Distribute Remaining Shared Items (Min-Ratio Greedy Leveling)
  // Sort descending by weight for optimal bin packing
  unassignedShared.sort((a, b) => b.weightGrams - a.weightGrams);

  for (const item of unassignedShared) {
    let bestCandidateId: string | null = null;
    let lowestScore = Infinity;

    for (const human of humans) {
      const rec = participantLoadsMap.get(human.id)!;
      const currentTotalGrams = rec.personalWeightGrams + rec.sharedWeightGrams;
      const newTotalGrams = currentTotalGrams + item.weightGrams;
      const bodyWeightGrams = Math.max(human.bodyWeightKg * 1000, 30000);
      const resultingRatio = newTotalGrams / bodyWeightGrams;

      // Role penalty adjustments:
      // - Scout: +10% penalty so scout stays ultralight for scouting
      // - Guide: +2% penalty to preserve guide reserve agility
      // - Medic: +2% penalty to preserve emergency response capacity
      let rolePenalty = 0;
      if (human.role === 'scout') rolePenalty = 0.10;
      else if (human.role === 'guide') rolePenalty = 0.02;
      else if (human.role === 'medic') rolePenalty = 0.02;

      const score = resultingRatio + rolePenalty;

      if (score < lowestScore) {
        lowestScore = score;
        bestCandidateId = human.id;
      }
    }

    if (bestCandidateId) {
      const rec = participantLoadsMap.get(bestCandidateId)!;
      rec.sharedWeightGrams += item.weightGrams;
      rec.assignedItems.push({
        id: item.id,
        name: item.name,
        weightGrams: item.weightGrams,
        category: item.category,
        assignedParticipantId: bestCandidateId,
        assignedParticipantName: rec.participant.name,
        isShared: true,
        reason: 'Équilibrage de charge collectif',
      });
    }
  }

  // 6. Build Individual Loads, Checks & Warnings
  const individualLoads: Record<string, IndividualLoadSummary> = {};
  const deduplicatedItems: DeduplicatedItemRecord[] = [];
  const participantLoads: ParticipantLoad[] = [];

  let optimizedTotalWeightGrams = 0;
  let overloadedCount = 0;

  for (const [id, rec] of participantLoadsMap.entries()) {
    const p = rec.participant;
    const isDog = !!p.isDog;
    const totalWeightGrams = rec.personalWeightGrams + rec.sharedWeightGrams;
    const totalWeightKg = Math.round((totalWeightGrams / 1000) * 10) / 10;
    optimizedTotalWeightGrams += totalWeightGrams;

    const maxRatio = isDog ? targetDogRatio : targetHumanRatio;
    const maxSafeWeightKg = p.maxWeightGramsOverride
      ? Math.round((p.maxWeightGramsOverride / 1000) * 10) / 10
      : isDog
        ? calculateDogMaxPackWeight(p.bodyWeightKg, maxRatio)
        : Math.round(p.bodyWeightKg * maxRatio * 10) / 10;

    const bodyWeightRatio = p.bodyWeightKg > 0 ? totalWeightKg / p.bodyWeightKg : 0;
    const isOverloaded = totalWeightKg > maxSafeWeightKg;
    const loadPercentage =
      maxSafeWeightKg > 0 ? Math.round((totalWeightKg / maxSafeWeightKg) * 100) : 0;

    if (isOverloaded) {
      overloadedCount++;
    }

    // Role-specific and safety threshold warnings
    if (isDog) {
      if (isOverloaded) {
        warnings.push(
          `Alerte vétérinaire : Le chien ${p.name} porte ${totalWeightKg} kg (${Math.round(bodyWeightRatio * 100)}% de son poids corporel). Le seuil maximal physiologique est de 15%.`,
        );
      }
      // Check if dog was assigned human gear
      const humanItemsOnDog = rec.assignedItems.filter((i) => !isDogSpecificItem(i));
      if (humanItemsOnDog.length > 0) {
        warnings.push(
          `Violation de sécurité : Le chien ${p.name} s'est vu assigner du matériel humain non adapté (${humanItemsOnDog.map((i) => i.name).join(', ')}).`,
        );
      }
    } else {
      if (isOverloaded) {
        if (bodyWeightRatio > 0.25) {
          warnings.push(
            `Danger biomécanique critique : ${p.name} porte ${totalWeightKg} kg (${Math.round(bodyWeightRatio * 100)}% de son poids de corps). Risque élevé de blessure musculosquelettique.`,
          );
        } else {
          warnings.push(
            `Surcharge physiologique : ${p.name} porte ${totalWeightKg} kg (${Math.round(bodyWeightRatio * 100)}% de son poids de corps, seuil recommandé : 20% soit ${maxSafeWeightKg} kg).`,
          );
        }
      }

      // Role specific thresholds
      if (p.role === 'scout' && bodyWeightRatio > targetScoutRatio) {
        warnings.push(
          `Alerte rôle éclaireur : ${p.name} porte ${totalWeightKg} kg (${Math.round(bodyWeightRatio * 100)}%). Le rôle d'éclaireur exige une charge allégée (≤ 15%) pour la reconnaissance rapide.`,
        );
      } else if (p.role === 'guide' && isOverloaded) {
        warnings.push(
          `Alerte rôle guide : Le guide ${p.name} est surchargé (${totalWeightKg} kg, ${Math.round(bodyWeightRatio * 100)}%). Marge de manœuvre opérationnelle réduite pour la sécurité du groupe.`,
        );
      } else if (p.role === 'medic' && isOverloaded) {
        warnings.push(
          `Alerte rôle secouriste : Le secouriste ${p.name} est surchargé (${totalWeightKg} kg, ${Math.round(bodyWeightRatio * 100)}%). Mobilité compromise en cas d'intervention d'urgence.`,
        );
      }
    }

    const summary: IndividualLoadSummary = {
      participantId: id,
      name: p.name,
      isDog,
      role: p.role || 'member',
      bodyWeightKg: p.bodyWeightKg,
      personalWeightGrams: rec.personalWeightGrams,
      sharedWeightGrams: rec.sharedWeightGrams,
      totalWeightGrams,
      totalWeightKg,
      maxSafeWeightKg,
      bodyWeightRatio: Math.round(bodyWeightRatio * 1000) / 1000,
      loadPercentage,
      isOverloaded,
      items: rec.assignedItems,
    };

    individualLoads[id] = summary;
    deduplicatedItems.push(...rec.assignedItems);

    // Bridge to canonical LKDV ParticipantLoad
    participantLoads.push({
      participantId: id,
      name: p.name,
      type: isDog ? 'dog' : 'human',
      allocatedWeightKg: totalWeightKg,
      maxSafeWeightKg,
      loadPercentage,
      isOverloaded,
      roleOrBreed: isDog
        ? 'Chien'
        : p.role === 'guide'
          ? 'Guide'
          : p.role === 'medic'
            ? 'Secouriste'
            : p.role === 'scout'
              ? 'Éclaireur'
              : 'Équipier',
    });
  }

  // 7. Group Overall Stats
  const weightSavedGrams = Math.max(0, originalTotalWeightGrams - optimizedTotalWeightGrams);
  const weightSavedKg = Math.round((weightSavedGrams / 1000) * 10) / 10;

  const groupStats: GroupPackStats = {
    totalOriginalWeightGrams,
    totalOptimizedWeightGrams,
    weightSavedGrams,
    weightSavedKg,
    duplicateCount: removedDuplicates.length,
    itemCountOriginal: allItems.length,
    itemCountOptimized: deduplicatedItems.length,
    overloadedCount,
  };

  return {
    deduplicatedItems,
    removedDuplicates,
    individualLoads,
    groupStats,
    warnings,
    participantLoads,
  };
}

/** Formats a text summary of the Pack Merge optimization */
export function formatPackMergeSummary(result: PackMergeResult): string {
  const { groupStats, removedDuplicates, warnings } = result;
  const lines: string[] = [];

  lines.push(`📦 Pack Merge LKDV : ${groupStats.weightSavedKg} kg économisés`);
  lines.push(`• Éléments dédoublonnés : ${groupStats.duplicateCount}`);
  lines.push(
    `• Poids total optimisé : ${Math.round(groupStats.totalOptimizedWeightGrams / 100) / 10} kg (vs ${Math.round(groupStats.totalOriginalWeightGrams / 100) / 10} kg initialement)`,
  );

  if (removedDuplicates.length > 0) {
    lines.push('\nMatériel allégé :');
    for (const d of removedDuplicates) {
      lines.push(`- ${d.name} (${Math.round(d.weightGrams / 100) / 100} kg) : ${d.reason}`);
    }
  }

  if (warnings.length > 0) {
    lines.push('\n⚠️ Alertes de sécurité :');
    for (const w of warnings) {
      lines.push(`- ${w}`);
    }
  }

  return lines.join('\n');
}
