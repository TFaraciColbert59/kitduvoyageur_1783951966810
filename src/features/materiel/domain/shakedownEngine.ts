/**
 * Shakedown Engine Canonique — Le Kit du Voyageur
 * Moteur pur de calcul de poids, détection de vitaux, doublons, articles lourds
 * et recommandations d'allègement (Shakedown) pour le matériel de trek et voyage.
 * 
 * Zéro dépendance UI / Zéro dépendance framework.
 */

export type GearCategory =
  | 'shelter'     // Tente, tarp, bivy
  | 'sleep'       // Sac de couchage, matelas, drap
  | 'cook'        // Réchaud, popote, gaz, couverts
  | 'clothing'    // Vestes, couches thermiques, rechanges
  | 'water'       // Gourdes, poches, filtres, pastilles
  | 'safety'      // Trousse secours, couverture survie, sifflet
  | 'hygiene'     // Savon bio, serviette, brosse
  | 'tech'        // Lampe frontale, batterie externe, câbles
  | 'navigation'  // Boussole, carte, GPS
  | 'misc';       // Bâtons, lunettes, couteau, sac étanche

export type GearStatus = 'to_buy' | 'owned' | 'packed';

export interface GearItem {
  id: string;
  name: string;
  weightGrams: number;
  category: GearCategory | string;
  status: GearStatus | string;
  isPrivate?: boolean;
  isWorn?: boolean;        // Porté sur soi (vêtements, chaussures, montre, bâtons en main)
  isConsumable?: boolean;  // Consommable (eau, vivres, cartouche de gaz)
  isVital?: boolean;       // Matériel indispensable de sécurité
  quantity?: number;
  brand?: string;
  priceEur?: number;
  shopProductSlug?: string;
  assignedParticipantId?: string;
}

export interface WeightBreakdown {
  baseWeightGrams: number;       // Matériel dans le sac hors consommables et portés
  wornWeightGrams: number;       // Vêtements et objets portés sur soi
  consumableWeightGrams: number; // Eau, nourriture, gaz dans le sac
  totalPackWeightGrams: number;  // Poids réel porté sur le dos (Base + Consumables)
  totalWeightGrams: number;      // Poids global emporté (Base + Consumables + Worn)
  mulCategory: 'ultralight' | 'light' | 'traditional';
}

export interface ShakedownRecommendation {
  itemId: string;
  itemName: string;
  currentWeightGrams: number;
  suggestedName: string;
  suggestedWeightGrams: number;
  weightSavedGrams: number;
  shopSlug?: string;
  estimatedPriceEur?: number;
  reason: string;
}

export interface GearGapItem {
  id: string;
  name: string;
  category: GearCategory | string;
  priority: 'vital' | 'recommended' | 'optional';
  reason: string;
  suggestedProduct?: {
    name: string;
    weightGrams: number;
    priceEur: number;
    shopSlug: string;
  };
}

export interface ShakedownReport {
  duplicateWarnings: string[];
  missingVitalWarnings: string[];
  heavyItemWarnings: { itemId: string; name: string; weightGrams: number; thresholdGrams: number }[];
  recommendations: ShakedownRecommendation[];
  gearGaps: GearGapItem[];
  potentialWeightSavedGrams: number;
  potentialPercentageSaved: number;
  score: number; // 0 to 100
}

/** Seuils de déclenchement des alertes d'objets lourds (en grammes) */
export const HEAVY_THRESHOLDS: Record<string, number> = {
  shelter: 1600,  // Tente > 1.6kg
  sleep: 1200,    // Sac de couchage / matelas > 1.2kg
  cook: 450,      // Réchaud + popote > 450g
  clothing: 650,  // Veste > 650g
  water: 350,     // Gourde / système > 350g
  tech: 400,      // Lampe / batterie externe > 400g
  safety: 350,    // Trousse secours > 350g
  navigation: 250,// GPS / boussole > 250g
  misc: 500,      // Divers > 500g
};

/** Équipements vitaux indispensables de sécurité */
export const REQUIRED_VITALS: { key: string; label: string }[] = [
  { key: 'secours', label: 'Trousse de premiers secours' },
  { key: 'couverture', label: 'Couverture de survie' },
  { key: 'frontale', label: 'Lampe frontale' },
  { key: 'filtre', label: 'Filtre à eau ou pastilles purifiantes' },
  { key: 'sifflet', label: 'Sifflet de détresse' },
];

/** Checklist essentielle avec produits de référence boutique LKDV */
export const ESSENTIAL_GEAR_CHECKLIST: {
  key: string;
  name: string;
  category: GearCategory;
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
    name: 'Lampe frontale',
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
 * Calcule formellement le Base Weight, le Worn Weight, les Consommables et le Poids Total.
 * Règle formelle MUL :
 * - Base Weight = somme des articles avec status === 'packed' ET !isConsumable ET !isWorn.
 * - Worn Weight = somme des articles avec isWorn === true.
 * - Consumables = somme des articles avec isConsumable === true ET status === 'packed'.
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
 * Identifie les équipements vitaux obligatoires manquants parmi les objets dans le sac.
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
 * Identifie les objets lourds dépassant les seuils d'optimisation par catégorie.
 */
export function identifyHeavyItems(
  items: GearItem[]
): { itemId: string; name: string; weightGrams: number; thresholdGrams: number }[] {
  const packedItems = items.filter((i) => i.status === 'packed' && !i.isWorn && !i.isConsumable);
  const heavyList: { itemId: string; name: string; weightGrams: number; thresholdGrams: number }[] = [];

  for (const item of packedItems) {
    const cat = item.category as string;
    const threshold = HEAVY_THRESHOLDS[cat];
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
 * Génère un rapport Shakedown exhaustif avec score sur 100 et recommandations d'allègement.
 */
export function generateShakedownReport(items: GearItem[]): ShakedownReport {
  const breakdown = calculateWeightBreakdown(items);
  const duplicateWarnings = identifyDuplicates(items);
  const missingVitalWarnings = identifyMissingVitals(items);
  const heavyItemWarnings = identifyHeavyItems(items);
  const gearGaps = detectGearGaps(items);

  const recommendations: ShakedownRecommendation[] = [];

  // Recommandations concrètes pour les objets lourds
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

  // Score Shakedown sur 100
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
    gearGaps,
    potentialWeightSavedGrams,
    potentialPercentageSaved,
    score,
  };
}
