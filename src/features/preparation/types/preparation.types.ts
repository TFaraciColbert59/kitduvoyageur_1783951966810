import { normalizeItemCategory } from '@/features/materiel/services/itemCategorizer';

export type GearCategory =
  | 'shelter' // Abri / Bivouac (tente, tarp, bivy)
  | 'sleep' // Couchage (sac de couchage, matelas, drap)
  | 'cook' // Cuisine (réchaud, popote, gaz, couverts)
  | 'clothing' // Vêtements & Textile
  | 'water' // Hydratation & Traitement (filtres, gourdes)
  | 'safety' // Sécurité, Secours & Pharmacie
  | 'hygiene' // Hygiène & Soins
  | 'tech' // Électronique & Éclairage (frontale, batterie)
  | 'navigation' // Boussole, carte, GPS
  | 'misc'; // Divers (bâtons, couteau, sac étanche)

export type GearStatus = 'to_buy' | 'owned' | 'packed';

export interface GearItem {
  id: string;
  name: string;
  weightGrams: number;
  category: GearCategory;
  status: GearStatus;
  isPrivate: boolean;
  isWorn: boolean; // Porté sur soi (vêtements sur le dos, chaussures, montre, bâtons en main)
  isConsumable: boolean; // Consommable (eau, vivres, cartouche de gaz)
  isVital: boolean; // Matériel indispensable de sécurité
  quantity: number;
  brand?: string;
  priceEur?: number;
  shopProductSlug?: string; // Lien catalogue / recommandation boutique LKDV
  assignedParticipantId?: string; // ID du porteur (si kit partagé)
}

export interface HumanPublicData {
  id: string;
  firstName: string;
  avatarUrl?: string;
  bodyWeightKg?: number;
  packWeightKg: number;
  fitnessScore: number; // 0 à 100
  role: 'guide' | 'member' | 'medic';
}

export interface HumanPrivateData {
  bloodType: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'UNKNOWN';
  allergies: string[];
  iceContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  medications?: string[];
  medicalNotes?: string;
}

export interface HumanParticipant {
  id: string;
  type: 'human';
  publicData: HumanPublicData;
  privateData: HumanPrivateData;
  isUnlocked: boolean;
  unlockedAt?: number;
}

export interface DogParticipant {
  id: string;
  type: 'dog';
  name: string;
  breed: string;
  weightKg: number;
  isCarryingPack: boolean;
  packWeightKg: number;
  maxCarryingCapacityKg: number; // weightKg * 0.15
  waterRationLitersPerDay: number;
  foodRationGramsPerDay: number;
  avatarUrl?: string;
}

export type Participant = HumanParticipant | DogParticipant;

export interface WeightBreakdown {
  baseWeightGrams: number; // Matériel dans le sac hors consommables et objets portés
  wornWeightGrams: number; // Vêtements et objets portés sur soi
  consumableWeightGrams: number; // Eau, nourriture, gaz dans le sac
  totalPackWeightGrams: number; // Base + Consommables (poids sur le dos)
  totalWeightGrams: number; // Base + Consommables + Worn (poids global emporté)
  mulCategory: 'ultralight' | 'light' | 'traditional';
}

export interface ParticipantLoad {
  participantId: string;
  name: string;
  type: 'human' | 'dog';
  allocatedWeightKg: number;
  maxSafeWeightKg: number;
  loadPercentage: number; // (allocatedWeightKg / maxSafeWeightKg) * 100
  isOverloaded: boolean;
  roleOrBreed: string;
}

export interface GearGapItem {
  id: string;
  name: string;
  category: GearCategory;
  priority: 'vital' | 'recommended' | 'optional';
  reason: string;
  suggestedProduct?: {
    name: string;
    weightGrams: number;
    priceEur: number;
    shopSlug: string;
  };
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
  score: number; // 0 to 100
  duplicateWarnings: string[];
  missingVitalWarnings: string[];
  heavyItemWarnings: { itemId: string; name: string; weightGrams: number; thresholdGrams: number }[];
  recommendations: ShakedownRecommendation[];
  gearGaps: GearGapItem[];
  potentialWeightSavedGrams: number;
  potentialPercentageSaved: number;
}

export interface PreparationStats {
  checklistProgress: number; // 0 à 100%
  packedCount: number;
  ownedCount: number;
  toBuyCount: number;
  totalCount: number;
  vitalCount: number;
  vitalPackedCount: number;
  overallScore: number; // 0 à 100%
  statusLabel: string;
  statusColor: string;
}
