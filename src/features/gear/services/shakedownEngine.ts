import { GearItem, WeightBreakdown, ShakedownReport, ShakedownRecommendation } from '../types/gear.types';

// Thresholds for heavy item warnings (in grams)
export const HEAVY_THRESHOLDS: Record<string, number> = {
  shelter: 1600,  // Tent > 1.6kg
  sleep: 1200,    // Sleeping bag/pad > 1.2kg
  cook: 450,      // Stove + pot > 450g
  clothing: 650,  // Single jacket > 650g
  tech: 400,      // Powerbank/electronics > 400g
};

// Required vital keywords to ensure safety
export const REQUIRED_VITALS: { key: string; label: string }[] = [
  { key: 'secours', label: 'Trousse de premiers secours' },
  { key: 'couverture', label: 'Couverture de survie' },
  { key: 'frontale', label: 'Lampe frontale' },
  { key: 'filtre', label: 'Filtre à eau ou pastilles purifiantes' },
  { key: 'sifflet', label: 'Sifflet de détresse' },
];

/**
 * Calculates formal Base Weight, Worn Weight, and Consumables.
 * Base Weight = sum(weight * qty) for packed items that are NOT worn and NOT consumable.
 */
export function calculateWeightBreakdown(items: GearItem[]): WeightBreakdown {
  let baseWeightGrams = 0;
  let wornWeightGrams = 0;
  let consumableWeightGrams = 0;

  for (const item of items) {
    const qty = item.quantity > 0 ? item.quantity : 1;
    const totalItemWeight = item.weightGrams * qty;

    if (item.isWorn) {
      wornWeightGrams += totalItemWeight;
    } else if (item.status === 'packed') {
      if (item.isConsumable) {
        consumableWeightGrams += totalItemWeight;
      } else {
        baseWeightGrams += totalItemWeight;
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
 * Identifies duplicate redundant items in packed gear.
 */
export function identifyDuplicates(items: GearItem[]): string[] {
  const packedItems = items.filter((i) => i.status === 'packed' && !i.isConsumable && !i.isWorn);
  const nameMap = new Map<string, { originalName: string; qty: number }>();
  const warnings: string[] = [];

  for (const item of packedItems) {
    const key = item.name.toLowerCase().trim();
    const existing = nameMap.get(key);
    if (existing) {
      existing.qty += item.quantity;
    } else {
      nameMap.set(key, { originalName: item.name, qty: item.quantity });
    }
  }

  for (const { originalName, qty } of nameMap.values()) {
    if (qty > 1) {
      warnings.push(`Doublon détecté : ${qty}x "${originalName}" dans le sac.`);
    }
  }

  return warnings;
}

/**
 * Identifies missing vital safety equipment from packed items.
 */
export function identifyMissingVitals(items: GearItem[]): string[] {
  const packedItems = items.filter((i) => i.status === 'packed');
  const missing: string[] = [];

  for (const vital of REQUIRED_VITALS) {
    const hasVital = packedItems.some(
      (item) =>
        (item.isVital && item.name.toLowerCase().includes(vital.key)) ||
        item.name.toLowerCase().includes(vital.key)
    );

    if (!hasVital) {
      missing.push(`Équipement vital manquant : ${vital.label}`);
    }
  }

  return missing;
}

/**
 * Identifies heavy items exceeding category optimization thresholds.
 */
export function identifyHeavyItems(
  items: GearItem[]
): { itemId: string; name: string; weightGrams: number; thresholdGrams: number }[] {
  const packedItems = items.filter((i) => i.status === 'packed' && !i.isWorn && !i.isConsumable);
  const heavyList: { itemId: string; name: string; weightGrams: number; thresholdGrams: number }[] = [];

  for (const item of packedItems) {
    const threshold = HEAVY_THRESHOLDS[item.category];
    if (threshold && item.weightGrams > threshold) {
      heavyList.push({
        itemId: item.id,
        name: item.name,
        weightGrams: item.weightGrams,
        thresholdGrams: threshold,
      });
    }
  }

  return heavyList;
}

/**
 * Generates an exhaustive Shakedown optimization report.
 */
export function generateShakedownReport(items: GearItem[]): ShakedownReport {
  const breakdown = calculateWeightBreakdown(items);
  const duplicateWarnings = identifyDuplicates(items);
  const missingVitalWarnings = identifyMissingVitals(items);
  const heavyItemWarnings = identifyHeavyItems(items);

  const recommendations: ShakedownRecommendation[] = [];

  // Generate actionable replacement recommendations for heavy items
  for (const heavy of heavyItemWarnings) {
    if (heavy.weightGrams >= 1800) {
      recommendations.push({
        itemId: heavy.itemId,
        itemName: heavy.name,
        currentWeightGrams: heavy.weightGrams,
        suggestedName: 'Tente 2P Ultra-Light SilNylon (950g)',
        suggestedWeightGrams: 950,
        weightSavedGrams: heavy.weightGrams - 950,
        shopSlug: 'tente-ultralight-2p',
        estimatedPriceEur: 189,
        reason: 'Remplacer par un abri ultra-léger permet d’économiser près de 1 kg sur le dos.',
      });
    } else if (heavy.weightGrams >= 1200) {
      recommendations.push({
        itemId: heavy.itemId,
        itemName: heavy.name,
        currentWeightGrams: heavy.weightGrams,
        suggestedName: 'Duvet 800FP Hydrophobe (620g)',
        suggestedWeightGrams: 620,
        weightSavedGrams: heavy.weightGrams - 620,
        shopSlug: 'sac-couchage-duvet-800fp',
        estimatedPriceEur: 219,
        reason: 'Un garnissage en duvet de haute qualité offre le meilleur ratio chaleur/poids.',
      });
    }
  }

  const potentialWeightSavedGrams = recommendations.reduce((acc, r) => acc + r.weightSavedGrams, 0);
  const potentialPercentageSaved =
    breakdown.baseWeightGrams > 0
      ? Math.round((potentialWeightSavedGrams / breakdown.baseWeightGrams) * 100)
      : 0;

  // Base score calculation (100 - penalties for missing vitals, duplicates, heavy items)
  let score = 100;
  score -= missingVitalWarnings.length * 15;
  score -= duplicateWarnings.length * 5;
  score -= heavyItemWarnings.length * 8;
  score = Math.min(100, Math.max(0, score));

  return {
    duplicateWarnings,
    missingVitalWarnings,
    heavyItemWarnings,
    recommendations,
    potentialWeightSavedGrams,
    potentialPercentageSaved,
    score,
  };
}
