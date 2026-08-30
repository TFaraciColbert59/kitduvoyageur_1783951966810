import type { GearItem, WeightBreakdown, PreparationStats, Participant } from '../types/preparation.types';

/**
 * Calcule formellement le Base Weight, le Worn Weight, les Consommables et le Poids Total.
 * Règle de calcul :
 * - Base Weight = somme des poids des articles avec status === 'packed' ET !isConsumable ET !isWorn.
 * - Worn Weight = somme des poids des articles avec isWorn === true.
 * - Consumables = somme des poids des articles avec isConsumable === true ET status === 'packed'.
 * - Total Pack Weight = Base Weight + Consumables (charge sur le dos).
 * - Total Weight = Base Weight + Consumables + Worn (tout ce qui est emporté).
 */
export function calculateWeightBreakdown(items: GearItem[]): WeightBreakdown {
  let baseWeightGrams = 0;
  let wornWeightGrams = 0;
  let consumableWeightGrams = 0;

  for (const item of items) {
    const qty = Math.max(1, item.quantity || 1);
    const itemTotalWeight = (item.weightGrams || 0) * qty;

    if (item.isWorn) {
      wornWeightGrams += itemTotalWeight;
    } else if (item.status === 'packed') {
      if (item.isConsumable) {
        consumableWeightGrams += itemTotalWeight;
      } else {
        baseWeightGrams += itemTotalWeight;
      }
    }
  }

  const totalPackWeightGrams = baseWeightGrams + consumableWeightGrams;
  const totalWeightGrams = baseWeightGrams + consumableWeightGrams + wornWeightGrams;

  let mulCategory: WeightBreakdown['mulCategory'] = 'traditional';
  if (baseWeightGrams < 4500) {
    mulCategory = 'ultralight';
  } else if (baseWeightGrams < 9000) {
    mulCategory = 'light';
  }

  return {
    baseWeightGrams,
    wornWeightGrams,
    consumableWeightGrams,
    totalPackWeightGrams,
    totalWeightGrams,
    mulCategory,
  };
}

/**
 * Calcule les statistiques d'avancement de la préparation du trek.
 */
export function calculatePreparationStats(
  items: GearItem[],
  participants: Participant[] = []
): PreparationStats {
  const totalCount = items.length;
  const packedCount = items.filter((i) => i.status === 'packed').length;
  const ownedCount = items.filter((i) => i.status === 'owned').length;
  const toBuyCount = items.filter((i) => i.status === 'to_buy').length;

  const vitalItems = items.filter((i) => i.isVital);
  const vitalCount = vitalItems.length;
  const vitalPackedCount = vitalItems.filter((i) => i.status === 'packed').length;

  const checklistProgress = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;
  const vitalProgress = vitalCount > 0 ? Math.round((vitalPackedCount / vitalCount) * 100) : 100;

  // Calcul du score global : 60% checklist + 30% vitaux + 10% statut équipe
  let overallScore = Math.round(checklistProgress * 0.6 + vitalProgress * 0.3);
  if (participants.length > 0) {
    overallScore += 10;
  }
  overallScore = Math.min(100, Math.max(0, overallScore));

  let statusLabel = 'En préparation';
  let statusColor = 'bg-amber-100 text-amber-800 border-amber-300';

  if (overallScore >= 90) {
    statusLabel = 'Paré au départ (A+)';
    statusColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  } else if (overallScore >= 70) {
    statusLabel = 'Presque prêt';
    statusColor = 'bg-teal-100 text-teal-800 border-teal-300';
  } else if (overallScore < 40) {
    statusLabel = 'Début de préparation';
    statusColor = 'bg-rose-100 text-rose-800 border-rose-300';
  }

  return {
    checklistProgress,
    packedCount,
    ownedCount,
    toBuyCount,
    totalCount,
    vitalCount,
    vitalPackedCount,
    overallScore,
    statusLabel,
    statusColor,
  };
}
