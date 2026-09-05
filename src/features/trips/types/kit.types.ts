/**
 * Types pour le Chantier 6 : IA & Kit Contextuel (Boutique LKDV, équipement, marge pleine)
 */

export interface ShopProductReference {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price_eur: number;
  weight_g: number;
  category_main: string;
  image?: string | null;
  image_alt?: string | null;
  score_kdv?: number | null;
}

export interface ContextualGearRecommendation {
  id: string;
  name: string;
  category: 'shelter' | 'sleep' | 'clothing' | 'cook' | 'water' | 'tech' | 'safety' | 'navigation' | 'misc';
  priority: 'vital' | 'recommended' | 'optional';
  reason: string;
  weightGrams: number;
  shopProduct: ShopProductReference | null;
}

export interface TripKitAnalysis {
  totalItemsCount: number;
  packedItemsCount: number;
  vitalItemsCount: number;
  packedVitalCount: number;
  completionPercent: number;
  totalWeightGrams: number;
  baseWeightGrams: number;
  wornWeightGrams: number;
  consumableWeightGrams: number;
  weightCategory: 'ultralight' | 'light' | 'standard' | 'heavy';
  maxAltitudeM: number;
  seasonContext: string;
  climateWarnings: string[];
  vitalGaps: ContextualGearRecommendation[];
  recommendedGaps: ContextualGearRecommendation[];
}
