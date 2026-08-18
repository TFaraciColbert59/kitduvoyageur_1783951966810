/* =============================================================================
   LKDV — Types Système État Produit Unifié
   =============================================================================
   Un produit est UNE seule entité avec 5 dimensions d'état combinables :
   1. Propriété (ownership)
   2. Disponibilité (availability)
   3. État Physique (physicalCondition)
   4. Préparation (readiness)
   5. Relations (relations)
   ============================================================================= */

import { UserEquipmentItem, UnifiedProduct } from '@/hooks/useEquipment';
import { CustomKit } from '@/hooks/useUserKits';
import { PlannedHike } from '@/lib/preparation/plannedHikes';

/* ---------- 1. PROPRIÉTÉ ---------- */
export type ProductOwnership =
  | 'non_possede'           // N'existe pas dans l'inventaire utilisateur
  | 'en_attente_achat'      // Ajouté à l'inventaire, en attente d'ajout panier
  | 'dans_panier'           // Dans le panier (localStorage cart)
  | 'commande'              // Commande passée (stripe/tiers)
  | 'a_receptionner'        // Commande reçue, pas encore confirmée par user
  | 'possede'               // Dans l'inventaire, propriété confirmée
  | 'archive'               // Vendu, donné, retiré définitivement
  ;

/* ---------- 2. DISPONIBILITÉ ---------- */
export type ProductAvailability =
  | 'disponible'            // Prêt à l'emploi, dans l'inventaire
  | 'dans_kit'              // Inclus dans un kit (peut être dans plusieurs)
  | 'reserve_depart'        // Réservé pour un départ spécifique
  | 'prete'                 // Prêté à quelqu'un (loan_status === 'prêté')
  | 'en_reparation'         // En cours de réparation déclarée
  | 'en_entretien'          // Maintenance programmée/requise
  | 'perdu'                 // Déclaré perdu / introuvable
  | 'indisponible'          // Autre raison (cassé irréparable, etc.)
  ;

/* ---------- 3. ÉTAT PHYSIQUE ---------- */
export type PhysicalCondition =
  | 'excellent'             // Neuf, parfait
  | 'bon'                   // Fonctionnel, usure normale
  | 'a_surveiller'          // Usure visible, surveiller
  | 'abime'                 // Dégradé, fonctionne mais altéré
  | 'a_reparer'             // Nécessite réparation avant usage
  | 'a_remplacer'           // Doit être remplacé (fin de vie)
  ;

/* ---------- 4. PRÉPARATION ---------- */
export type PreparationState =
  | 'pret'                  // Prêt pour partir (chargé, nettoyé, vérifié)
  | 'a_charger'             // Batterie/électronique à charger
  | 'a_nettoyer'            // Nécessite nettoyage
  | 'a_reapprovisionner'    // Consommable à recharger (gaz, eau, piles)
  | 'a_verifier'            // Vérification requise avant départ
  ;

/* ---------- 5. RELATIONS ---------- */
export interface ProductRelations {
  kits: string[];                    // IDs des kits qui incluent ce produit
  departures: string[];              // IDs des départs (plannedHikes) qui le requièrent
  recommendedForDeparture: string[]; // IDs départs où il est recommandé (SmartDepartureEngine)
  requiredForDeparture: string[];    // IDs départs où il est indispensable
  replacedBy: string | null;         // ID produit alternatif qui le remplace
  inCart: boolean;                   // Présent dans le panier d'achat
  acquisitionIntentId: string | null; // ID intention d'achat si en cours
}

/* ---------- ÉTAT UNIFIÉ COMPLET ---------- */
export interface UnifiedProductState {
  // Identité
  productId: string;                 // ID unique (gear_items.id ou shop_products.id)
  source: 'equipment' | 'catalog';   // Source d'origine
  name: string;
  brand: string;
  category: string;
  weight_g: number;
  price_eur?: number;
  image?: string;

  // 5 Dimensions
  ownership: ProductOwnership;
  availability: ProductAvailability;
  physicalCondition: PhysicalCondition;
  preparation: PreparationState;
  relations: ProductRelations;

  // Métadonnées temporelles
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  expiryDate?: string;
  loanToName?: string;
  loanExpiryDate?: string;
  purchaseDate?: string;
  receiptConfirmedDate?: string;

  // Flags calculés
  isCritical: boolean;               // Bloquant pour un départ imminent
  isActionable: boolean;             // Nécessite action utilisateur maintenant
  suggestedAction?: ProductAction;   // Action recommandée par le système
}

/* ---------- ACTIONS PRODUIT ---------- */
export type ProductActionType =
  | 'view'                    // Voir détails
  | 'add_to_kit'              // Ajouter au kit actif/recommandé
  | 'view_loan'               // Voir détails du prêt
  | 'declare_action'          // Déclarer réparation/entretien/perte
  | 'follow_repair'           // Suivre réparation en cours
  | 'schedule_maintenance'    // Planifier/valider entretien
  | 'mark_lost'               // Déclarer perdu
  | 'replace_in_kit'          // Remplacer dans le kit par alternative
  | 'add_to_inventory'        // Ajouter à l'inventaire (depuis catalogue)
  | 'add_to_cart'             // Ajouter au panier d'achat
  | 'view_cart'               // Voir panier
  | 'follow_reception'        // Suivre livraison
  | 'confirm_receipt'         // Confirmer réception → devient possédé
  | 'use_alternative'         // Utiliser l'alternative disponible
  | 'buy_replacement'         // Acheter remplacement (dernier recours)
  | 'mark_ready'              // Marquer comme prêt (préparation)
  | 'mark_charged'            // Marquer comme chargé
  | 'mark_verified'           // Marquer comme vérifié
  ;

export interface ProductAction {
  type: ProductActionType;
  label: string;
  description?: string;
  variant: 'primary' | 'secondary' | 'destructive' | 'ghost';
  href?: string;              // Si navigation
  onClick?: () => void;       // Si action locale
  icon?: string;              // Emoji ou SVG
  priority: number;           // Pour tri (1 = haute priorité)
}

/* ---------- HELPERS TYPE GUARDS ---------- */
export function isOwned(ownership: ProductOwnership): boolean {
  return ['possede', 'a_receptionner', 'commande', 'dans_panier', 'en_attente_achat'].includes(ownership);
}

export function isAvailable(availability: ProductAvailability): boolean {
  return ['disponible', 'dans_kit', 'reserve_depart'].includes(availability);
}

export function isUsable(condition: PhysicalCondition): boolean {
  return ['excellent', 'bon', 'a_surveiller'].includes(condition);
}

export function isReady(preparation: PreparationState): boolean {
  return preparation === 'pret';
}

/* ---------- CALCULATEURS D'ÉTAT (à implémenter dans product-state.ts) ---------- */
export interface ProductStateCalculator {
  // Calcule l'état unifié à partir des sources brutes
  calculateUnifiedState: (
    equipmentItem: UserEquipmentItem | null,
    catalogProduct: UnifiedProduct | null,
    kits: CustomKit[],
    activeDeparture: PlannedHike | null,
    departurePlan: any, // DeparturePreparationPlan
    cartItems: any[]
  ) => UnifiedProductState;

  // Trouve les alternatives disponibles pour un produit
  findAlternatives: (productState: UnifiedProductState, allEquipment: UserEquipmentItem[]) => UnifiedProductState[];

  // Détermine l'action recommandée prioritaire
  getRecommendedAction: (productState: UnifiedProductState) => ProductAction | null;

  // Calcule le score de préparation pour un départ
  calculateDepartureReadiness: (kit: CustomKit, departure: PlannedHike, equipment: UserEquipmentItem[]) => {
    readinessPct: number;
    missingItems: UnifiedProductState[];
    unavailableItems: UnifiedProductState[];
    consumablesNeeded: { label: string; qty: string; critical: boolean }[];
  };
}

/* ---------- CONSTANTES CATÉGORIES (alignées avec l'existant) ---------- */
export const EQUIPMENT_CATEGORIES = [
  'Abri & couchage',
  'Cuisine & eau',
  'Vêtements & portage',
  'Hygiène & santé',
  'Orientation & sécurité',
  'Énergie & électronique',
  'Protection météo',
  'Réparation & urgence',
  'Organisation & accessoires',
] as const;

export type EquipmentCategory = typeof EQUIPMENT_CATEGORIES[number];

/* Mapping catégories legacy → nouvelles */
export const CATEGORY_MAP: Record<string, EquipmentCategory> = {
  'Couchage': 'Abri & couchage',
  'Portage': 'Vêtements & portage',
  'Cuisine': 'Cuisine & eau',
  'Vêtement': 'Vêtements & portage',
  'Navigation': 'Orientation & sécurité',
  'Éclairage': 'Énergie & électronique',
  'Sécurité': 'Orientation & sécurité',
  'Autre': 'Organisation & accessoires',
};