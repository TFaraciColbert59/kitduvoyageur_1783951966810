export type GearCategory =
  | 'shelter'     // Tente, tarp, bivy
  | 'sleep'       // Sac de couchage, matelas, drap
  | 'cook'        // Réchaud, popote, gaz, couverts
  | 'clothing'    // Vestes, couches thermiques, rechanges
  | 'water'       // Gourdes, poches, filtres, pastilles
  | 'safety'      // Trousse secours, couverture survie, sifflet
  | 'hygiene'     // Savon bio, serviette, brosse
  | 'tech'        // Lampe frontale, batterie externe, câbles
  | 'misc';       // Bâtons, lunettes, couteau, sac étanche

export type GearStatus = 'to_buy' | 'owned' | 'packed';

export interface GearItem {
  id: string;
  name: string;
  weightGrams: number;
  category: GearCategory;
  status: GearStatus;
  isPrivate: boolean;
  isWorn: boolean;        // Porté sur soi (vêtements, chaussures, montre)
  isConsumable: boolean;  // Consommable (eau, nourriture, cartouche de gaz)
  isVital: boolean;       // Matériel indispensable de sécurité
  quantity: number;
  brand?: string;
  priceEur?: number;
  shopProductSlug?: string; // Lien catalogue / recommandation boutique
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

export interface ShakedownReport {
  duplicateWarnings: string[];
  missingVitalWarnings: string[];
  heavyItemWarnings: { itemId: string; name: string; weightGrams: number; thresholdGrams: number }[];
  recommendations: ShakedownRecommendation[];
  potentialWeightSavedGrams: number;
  potentialPercentageSaved: number;
  score: number; // 0 to 100
}
