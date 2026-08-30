import type {
  GearItem,
  ShakedownReport,
  ShakedownRecommendation,
  GearGapItem,
} from '../types/preparation.types';
import { calculateWeightBreakdown } from './weightCalculator';

export const HEAVY_THRESHOLDS: Record<string, number> = {
  shelter: 1600, // Tente > 1.6kg
  sleep: 1200, // Sac de couchage / matelas > 1.2kg
  cook: 450, // Réchaud + popote > 450g
  clothing: 650, // Veste > 650g
  water: 350, // Gourde / système > 350g
  tech: 400, // Batterie / lampe > 400g
  safety: 350, // Trousse > 350g
  navigation: 250, // GPS / boussole > 250g
  misc: 500,
};

export const ESSENTIAL_GEAR_CHECKLIST: {
  key: string;
  name: string;
  category: GearItem['category'];
  priority: GearGapItem['priority'];
  reason: string;
  suggestedProduct?: {
    name: string;
    weightGrams: number;
    priceEur: number;
    shopSlug: string;
  };
}[] = [
  {
    key: 'secours',
    name: 'Trousse de premiers secours',
    category: 'safety',
    priority: 'vital',
    reason: 'Indispensable pour soigner les coupures, ampoules et traumatismes sur le sentier.',
    suggestedProduct: {
      name: 'Kit Secours Compact Trail (140g)',
      weightGrams: 140,
      priceEur: 24.9,
      shopSlug: 'trousse-secours-compact',
    },
  },
  {
    key: 'couverture',
    name: 'Couverture de survie',
    category: 'safety',
    priority: 'vital',
    reason: 'Protection thermique d’urgence obligatoire en cas d’accident ou d’intempérie.',
    suggestedProduct: {
      name: 'Couverture de survie renforcée Mylar (60g)',
      weightGrams: 60,
      priceEur: 6.9,
      shopSlug: 'couverture-survie-mylar',
    },
  },
  {
    key: 'frontale',
    name: 'Lampe frontale rechargeable',
    category: 'tech',
    priority: 'vital',
    reason: 'Éclairage mains libres indispensable pour le bivouac et les départs matinaux.',
    suggestedProduct: {
      name: 'Lampe Frontale 350lm USB (85g)',
      weightGrams: 85,
      priceEur: 39.9,
      shopSlug: 'lampe-frontale-rechargeable',
    },
  },
  {
    key: 'filtre',
    name: 'Filtre à eau ou pastilles purifiantes',
    category: 'water',
    priority: 'vital',
    reason: 'Permet de s’approvisionner en eau potable en autonomie sans risque hydrique.',
    suggestedProduct: {
      name: 'Filtre à Eau Ultra-Compact 0.1 micron (85g)',
      weightGrams: 85,
      priceEur: 42.0,
      shopSlug: 'filtre-eau-ultralight',
    },
  },
  {
    key: 'sifflet',
    name: 'Sifflet de détresse',
    category: 'safety',
    priority: 'vital',
    reason: 'Signal sonore d’urgence audible à plusieurs kilomètres en montagne.',
  },
  {
    key: 'couteau',
    name: 'Couteau de poche pliant',
    category: 'misc',
    priority: 'recommended',
    reason: 'Outil multifonction pour la préparation des repas et réparations rapides.',
  },
  {
    key: 'briquet',
    name: 'Allume-feu / Briquet tempête',
    category: 'cook',
    priority: 'recommended',
    reason: 'Nécessaire pour le réchaud et la sécurité en cas de froid.',
  },
];

/**
 * Identifie les doublons dans les équipements emportés.
 */
export function identifyDuplicates(items: GearItem[]): string[] {
  const packedItems = items.filter((i) => i.status === 'packed' && !i.isConsumable && !i.isWorn);
  const nameMap = new Map<string, { originalName: string; qty: number }>();
  const warnings: string[] = [];

  for (const item of packedItems) {
    const key = item.name.toLowerCase().trim();
    const existing = nameMap.get(key);
    if (existing) {
      existing.qty += item.quantity || 1;
    } else {
      nameMap.set(key, { originalName: item.name, qty: item.quantity || 1 });
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
 * Détecte les équipements manquants dans la préparation (Gear Gaps).
 */
export function detectGearGaps(items: GearItem[]): GearGapItem[] {
  const allNames = items.map((i) => i.name.toLowerCase());
  const gaps: GearGapItem[] = [];

  for (const essential of ESSENTIAL_GEAR_CHECKLIST) {
    const hasItem = allNames.some((name) => name.includes(essential.key));
    if (!hasItem) {
      gaps.push({
        id: `gap-${essential.key}`,
        name: essential.name,
        category: essential.category,
        priority: essential.priority,
        reason: essential.reason,
        suggestedProduct: essential.suggestedProduct,
      });
    }
  }

  return gaps;
}

/**
 * Identifie les équipements vitaux obligatoires manquants parmi les objets dans le sac.
 */
export function identifyMissingVitals(items: GearItem[]): string[] {
  const packedItems = items.filter((i) => i.status === 'packed');
  const missing: string[] = [];

  for (const essential of ESSENTIAL_GEAR_CHECKLIST.filter((e) => e.priority === 'vital')) {
    const hasVital = packedItems.some(
      (item) =>
        (item.isVital && item.name.toLowerCase().includes(essential.key)) ||
        item.name.toLowerCase().includes(essential.key)
    );

    if (!hasVital) {
      missing.push(`Équipement vital manquant dans le sac : ${essential.name}`);
    }
  }

  return missing;
}

/**
 * Identifie les objets lourds dépassant les seuils d'optimisation par catégorie.
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
 * Génère le rapport d'audit Shakedown complet avec score sur 100 et suggestions d'allègement.
 */
export function generateShakedownReport(items: GearItem[]): ShakedownReport {
  const breakdown = calculateWeightBreakdown(items);
  const duplicateWarnings = identifyDuplicates(items);
  const missingVitalWarnings = identifyMissingVitals(items);
  const heavyItemWarnings = identifyHeavyItems(items);
  const gearGaps = detectGearGaps(items);

  const recommendations: ShakedownRecommendation[] = [];

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
    } else if (heavy.weightGrams >= 1100) {
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

  // Calcul du score Shakedown (100 - pénalités)
  let score = 100;
  score -= missingVitalWarnings.length * 15;
  score -= duplicateWarnings.length * 5;
  score -= heavyItemWarnings.length * 8;
  score = Math.min(100, Math.max(0, score));

  return {
    score,
    duplicateWarnings,
    missingVitalWarnings,
    heavyItemWarnings,
    recommendations,
    gearGaps,
    potentialWeightSavedGrams,
    potentialPercentageSaved,
  };
}
