/* =============================================================================
   LKDV — Product State Engine : Calculateur d'État Produit Unifié
   =============================================================================
   Centralise toute la logique de détermination d'état d'un produit
   à partir des sources : equipment, catalog, kits, departures, cart
   ============================================================================= */

import {
  UserEquipmentItem,
  UnifiedProduct,
  FALLBACK_AUTHENTIC_PRODUCTS
} from '@/hooks/useEquipment';
import { CustomKit } from '@/hooks/useUserKits';
import { PlannedHike } from '@/lib/preparation/plannedHikes';
import { DeparturePreparationPlan } from '@/lib/preparation/SmartDepartureEngine';
import {
  UnifiedProductState,
  ProductOwnership,
  ProductAvailability,
  PhysicalCondition,
  PreparationState,
  ProductRelations,
  ProductAction,
  ProductActionType,
  EQUIPMENT_CATEGORIES,
  EquipmentCategory,
  CATEGORY_MAP,
  isOwned,
  isAvailable,
  isUsable,
  isReady
} from '@/types/product';

/* ---------- HELPERS : Normalisation catégories ---------- */
function normalizeCategory(cat: string): EquipmentCategory {
  const mapped = CATEGORY_MAP[cat];
  if (mapped) return mapped;
  // Recherche floue
  const lower = cat.toLowerCase();
  for (const c of EQUIPMENT_CATEGORIES) {
    if (c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase())) {
      return c;
    }
  }
  return 'Organisation & accessoires';
}

/* ---------- HELPERS : Correspondance produit catalogue ---------- */
export function findCatalogMatch(
  equipment: UserEquipmentItem,
  catalog: UnifiedProduct[]
): UnifiedProduct | null {
  // 1. Match exact par nom + marque
  let match = catalog.find(p =>
    p.name.toLowerCase() === equipment.name.toLowerCase() &&
    p.brand.toLowerCase() === (equipment.brand || '').toLowerCase()
  );
  if (match) return match;

  // 2. Match par nom seul
  match = catalog.find(p =>
    p.name.toLowerCase() === equipment.name.toLowerCase()
  );
  if (match) return match;

  // 3. Match flou (inclusion)
  match = catalog.find(p =>
    p.name.toLowerCase().includes(equipment.name.toLowerCase()) ||
    equipment.name.toLowerCase().includes(p.name.toLowerCase())
  );
  return match || null;
}

/* ---------- CALCULATEUR PRINCIPAL ---------- */
export function calculateUnifiedProductState(
  equipmentItem: UserEquipmentItem | null,
  catalogProduct: UnifiedProduct | null,
  allKits: CustomKit[],
  activeDeparture: PlannedHike | null,
  departurePlan: DeparturePreparationPlan | null,
  cartItems: any[],
  allEquipment: UserEquipmentItem[]
): UnifiedProductState {
  const isEquipment = !!equipmentItem;
  const source = isEquipment ? 'equipment' : 'catalog';
  const baseProduct = equipmentItem || catalogProduct!;

  const productId = baseProduct.id || `catalog-${baseProduct.name}`;
  const name = baseProduct.name;
  const brand = baseProduct.brand || 'Sans marque';
  const category = normalizeCategory(baseProduct.category || 'Autre');
  const weight_g = baseProduct.weight_g || 0;
  const price_eur = (baseProduct as any).price_eur || 0;
  const image = baseProduct.image || undefined;

  // ---- 1. PROPRIÉTÉ ----
  let ownership: ProductOwnership = 'non_possede';
  if (isEquipment) {
    ownership = 'possede';
    // Vérifier si en attente de réception
    if (equipmentItem!.loan_status === 'a_receptionner') {
      ownership = 'a_receptionner';
    }
  } else {
    // Vérifier panier
    const inCart = cartItems.some((ci: any) =>
      ci.name.toLowerCase() === name.toLowerCase()
    );
    if (inCart) ownership = 'dans_panier';
    // TODO: vérifier commandes Stripe, intentions d'achat
  }

  // ---- 2. DISPONIBILITÉ ----
  let availability: ProductAvailability = 'disponible';
  const kitIds: string[] = [];

  if (isEquipment) {
    // Vérifier kits
    allKits.forEach(kit => {
      const inKit = kit.items?.some(item =>
        (item.gear_item_id && item.gear_item_id === equipmentItem!.id) ||
        item.item_name.toLowerCase() === equipmentItem!.name.toLowerCase()
      );
      if (inKit) kitIds.push(kit.id);
    });

    if (kitIds.length > 0) {
      availability = 'dans_kit';
    }

    // Vérifier prêt
    if (equipmentItem!.loan_status === 'prêté') {
      availability = 'prete';
    }

    // Vérifier état physique pour réparation/entretien
    const cond = equipmentItem!.condition;
    if (cond === 'à_réparer') {
      availability = 'en_reparation';
    } else if (cond === 'à_remplacer') {
      availability = 'en_entretien';
    }

    // Vérifier réservé pour départ
    if (activeDeparture && departurePlan) {
      const isRequired = departurePlan.checklist.missingItems?.some((ri: any) =>
        ri.name.toLowerCase() === equipmentItem!.name.toLowerCase()
      );
      if (isRequired) availability = 'reserve_depart';
    }

  } else {
    // Produit catalogue non possédé
    availability = 'indisponible';
  }

  // ---- 3. ÉTAT PHYSIQUE ----
  let physicalCondition: PhysicalCondition = 'bon';
  if (isEquipment) {
    const cond = equipmentItem!.condition;
    if (cond === 'neuf') physicalCondition = 'excellent';
    else if (cond === 'excellent') physicalCondition = 'excellent';
    else if (cond === 'bon') physicalCondition = 'bon';
    else if (cond === 'moyen') physicalCondition = 'a_surveiller';
    else if (cond === 'usé') physicalCondition = 'abime';
    else if (cond === 'à_réparer') physicalCondition = 'a_reparer';
    else if (cond === 'à_remplacer') physicalCondition = 'a_remplacer';
    else physicalCondition = 'bon';
  } else {
    physicalCondition = 'excellent'; // Catalogue = neuf
  }

  // ---- 4. PRÉPARATION ----
  let preparation: PreparationState = 'pret';
  if (isEquipment) {
    // Vérifier si dans kit actif mais pas "pret"
    if (availability === 'dans_kit' || availability === 'reserve_depart') {
      // Par défaut prêt, mais peut être modifié par utilisateur
      preparation = 'pret';
    }
    // Si électronique, vérifier batterie (heuristique)
    if (['Éclairage', 'Énergie & électronique', 'Navigation'].includes(category)) {
      // TODO: ajouter champ battery_level dans gear_items
      preparation = 'a_charger';
    }
  }

  // ---- 5. RELATIONS ----
  const relations: ProductRelations = {
    kits: kitIds,
    departures: [],
    recommendedForDeparture: [],
    requiredForDeparture: [],
    replacedBy: null,
    inCart: cartItems.some((ci: any) =>
      ci.name.toLowerCase() === name.toLowerCase()
    ),
    acquisitionIntentId: null,
  };

  if (activeDeparture && departurePlan) {
    // Recommandé par SmartDepartureEngine
    const isRecommended = departurePlan.checklist.inPackReady?.some((ri: any) =>
      ri.name.toLowerCase() === name.toLowerCase()
    );
    if (isRecommended) relations.recommendedForDeparture.push(activeDeparture.id);

    // Requis (manquant dans kit)
    const isRequired = departurePlan.checklist.missingItems?.some((ri: any) =>
      ri.name.toLowerCase() === name.toLowerCase()
    );
    if (isRequired) relations.requiredForDeparture.push(activeDeparture.id);
  }

  // Alternative disponible ?
  let replacedBy: string | null = null;
  if (!isEquipment || !isUsable(physicalCondition) || availability === 'prete') {
    const alternative = findAlternativeProduct(name, category, allEquipment, allKits);
    if (alternative) replacedBy = alternative.productId;
  }
  relations.replacedBy = replacedBy;

  // ---- MÉTADONNÉES TEMPORELLES ----
  const lastMaintenanceDate = equipmentItem?.last_maintenance_date || undefined;
  const nextMaintenanceDate = equipmentItem?.next_maintenance_date || undefined;
  const expiryDate = equipmentItem?.expiry_date || undefined;
  const loanToName = equipmentItem?.loan_to_name || undefined;
  const loanExpiryDate = equipmentItem?.expiry_date || undefined; // réutilisé pour date retour prêt
  const purchaseDate = equipmentItem?.acquired_at?.split('T')[0] || equipmentItem?.purchase_date?.split('T')[0] || undefined;

  // ---- FLAGS CALCULÉS ----
  const isCritical = isCriticalProduct(
    ownership, availability, physicalCondition, preparation,
    relations, activeDeparture, departurePlan
  );

  const isActionable = isCritical || isActionableProduct(
    ownership, availability, physicalCondition, preparation, relations
  );

  const suggestedAction = getRecommendedAction(
    ownership, availability, physicalCondition, preparation,
    relations, baseProduct, allEquipment, cartItems
  );

  return {
    productId,
    source,
    name,
    brand,
    category,
    weight_g,
    price_eur,
    image,
    ownership,
    availability,
    physicalCondition,
    preparation,
    relations,
    lastMaintenanceDate,
    nextMaintenanceDate,
    expiryDate,
    loanToName,
    loanExpiryDate,
    purchaseDate,
    receiptConfirmedDate: undefined,
    isCritical,
    isActionable,
    suggestedAction,
  };
}

/* ---------- DÉTERMINATION CRITICITÉ ---------- */
function isCriticalProduct(
  ownership: ProductOwnership,
  availability: ProductAvailability,
  physicalCondition: PhysicalCondition,
  preparation: PreparationState,
  relations: ProductRelations,
  activeDeparture: PlannedHike | null,
  departurePlan: DeparturePreparationPlan | null
): boolean {
  // Critique si requis pour départ imminent ET indisponible
  if (activeDeparture && departurePlan && relations.requiredForDeparture.length > 0) {
    const daysLeft = activeDeparture.targetDate
      ? Math.ceil((new Date(activeDeparture.targetDate).getTime() - Date.now()) / 86400000)
      : null;

    if (daysLeft !== null && daysLeft <= 7) {
      if (!isOwned(ownership)) return true;
      if (!isAvailable(availability)) return true;
      if (!isUsable(physicalCondition)) return true;
      if (!isReady(preparation)) return true;
    }
  }

  // Critique si entretien dépassé
  // TODO: vérifier nextMaintenanceDate

  // Critique si périmé
  // TODO: vérifier expiryDate

  return false;
}

/* ---------- DÉTERMINATION ACTIONNABLE ---------- */
function isActionableProduct(
  ownership: ProductOwnership,
  availability: ProductAvailability,
  physicalCondition: PhysicalCondition,
  preparation: PreparationState,
  relations: ProductRelations
): boolean {
  if (ownership === 'en_attente_achat' || ownership === 'dans_panier') return true;
  if (ownership === 'a_receptionner') return true;
  if (availability === 'prete') return true;
  if (availability === 'en_reparation') return true;
  if (availability === 'en_entretien') return true;
  if (availability === 'perdu') return true;
  if (physicalCondition === 'a_reparer' || physicalCondition === 'a_remplacer') return true;
  if (preparation === 'a_charger' || preparation === 'a_verifier') return true;
  if (relations.replacedBy) return true;
  return false;
}

/* ---------- RECHERCHE ALTERNATIVE ---------- */
function findAlternativeProduct(
  name: string,
  category: EquipmentCategory,
  allEquipment: UserEquipmentItem[],
  allKits: CustomKit[]
): UnifiedProductState | null {
  // 1. Chercher dans l'inventaire un produit même catégorie, utilisable
  const sameCategory = allEquipment.filter(e =>
    normalizeCategory(e.category || '').toLowerCase() === category.toLowerCase() &&
    isUsable(e.condition as PhysicalCondition) &&
    e.name.toLowerCase() !== name.toLowerCase()
  );

  if (sameCategory.length > 0) {
    // Retourner le premier disponible (le plus léger de préférence)
    const best = sameCategory.sort((a, b) => (a.weight_g || 0) - (b.weight_g || 0))[0];
    // Créer un état minimal pour l'alternative
    return {
      productId: best.id,
      source: 'equipment',
      name: best.name,
      brand: best.brand || '',
      category,
      weight_g: best.weight_g || 0,
      ownership: 'possede',
      availability: 'disponible',
      physicalCondition: best.condition as PhysicalCondition,
      preparation: 'pret',
      relations: { kits: [], departures: [], recommendedForDeparture: [], requiredForDeparture: [], replacedBy: null, inCart: false, acquisitionIntentId: null },
      isCritical: false,
      isActionable: false,
    };
  }

  return null;
}
/* ---------- ACTION RECOMMANDÉE ---------- */
function getRecommendedAction(
  ownership: ProductOwnership,
  availability: ProductAvailability,
  physicalCondition: PhysicalCondition,
  preparation: PreparationState,
  relations: ProductRelations,
  baseProduct: UserEquipmentItem | UnifiedProduct,
  allEquipment: UserEquipmentItem[],
  cartItems: any[]
): ProductAction | undefined {
  const name = baseProduct.name;
  const category = normalizeCategory(baseProduct.category || 'Autre');
  const weight_g = baseProduct.weight_g || 0;
  const price_eur = 'price_eur' in baseProduct ? baseProduct.price_eur : undefined;

  // PRIORITÉ 1 : Réception confirmée
  if (ownership === 'a_receptionner') {
    return {
      type: 'confirm_receipt',
      label: 'Confirmer la réception',
      description: 'Marquer comme reçu et possédé',
      variant: 'primary',
      icon: '✅',
      priority: 1,
    };
  }

  // PRIORITÉ 2 : Prêt à récupérer
  if (availability === 'prete') {
    return {
      type: 'view_loan',
      label: 'Voir le prêt',
      description: `Prêté à ${relations.kits[0] || 'quelqu\'un'}`,
      variant: 'secondary',
      icon: '🤝',
      priority: 2,
    };
  }

  // PRIORITÉ 3 : Réparation/entretien
  if (availability === 'en_reparation' || physicalCondition === 'a_reparer') {
    return {
      type: 'follow_repair',
      label: 'Suivre la réparation',
      description: 'Déclarer la fin de réparation',
      variant: 'secondary',
      icon: '🔧',
      priority: 3,
    };
  }

  if (availability === 'en_entretien') {
    return {
      type: 'schedule_maintenance',
      label: 'Planifier l\'entretien',
      description: 'Entretien requis ou en cours',
      variant: 'secondary',
      icon: '📅',
      priority: 4,
    };
  }

  // PRIORITÉ 4 : Perdu
  if (availability === 'perdu' || physicalCondition === 'a_remplacer') {
    if (relations.replacedBy) {
      return {
        type: 'use_alternative',
        label: 'Utiliser l\'alternative',
        description: 'Un équipement équivalent est disponible',
        variant: 'primary',
        icon: '🔄',
        priority: 5,
      };
    }
    return {
      type: 'buy_replacement',
      label: 'Remplacer (Panier)',
      description: 'Aucune alternative disponible',
      variant: 'destructive',
      icon: '🛒',
      priority: 6,
    };
  }

  // PRIORITÉ 5 : Non possédé mais requis/recommandé
  if (!isOwned(ownership) && (relations.requiredForDeparture.length > 0 || relations.recommendedForDeparture.length > 0)) {
    const inCart = cartItems.some((ci: any) => ci.name.toLowerCase() === name.toLowerCase());
    if (inCart) {
      return {
        type: 'view_cart',
        label: 'Déjà au panier',
        description: 'En attente de commande',
        variant: 'secondary',
        icon: '🛒',
        priority: 7,
      };
    }
    return {
      type: 'add_to_cart',
      label: 'Ajouter au panier',
      description: relations.requiredForDeparture.length > 0 ? 'Indispensable pour le départ' : 'Recommandé pour le départ',
      variant: 'primary',
      icon: '🛒',
      priority: 8,
    };
  }

  // PRIORITÉ 6 : Possédé mais pas dans kit actif
  if (isOwned(ownership) && availability === 'disponible' && relations.kits.length === 0) {
    return {
      type: 'add_to_kit',
      label: 'Ajouter au kit',
      description: 'Disponible pour vos kits',
      variant: 'secondary',
      icon: '🎒',
      priority: 9,
    };
  }

  // PRIORITÉ 7 : Préparation
  if (preparation === 'a_charger') {
    return {
      type: 'mark_charged',
      label: 'Marquer comme chargé',
      description: 'Batterie à recharger avant départ',
      variant: 'secondary',
      icon: '🔋',
      priority: 10,
    };
  }

  if (preparation === 'a_verifier') {
    return {
      type: 'mark_verified',
      label: 'Marquer comme vérifié',
      description: 'Vérification requise',
      variant: 'secondary',
      icon: '✓',
      priority: 11,
    };
  }

  // PRIORITÉ 8 : Possédé et prêt - action par défaut
  if (isOwned(ownership) && isAvailable(availability) && isUsable(physicalCondition) && isReady(preparation)) {
    return {
      type: 'view',
      label: 'Voir les détails',
      description: 'Équipement opérationnel',
      variant: 'ghost',
      icon: '👁️',
      priority: 99,
    };
  }

  return undefined;
}

/* ---------- CALCUL PRÉPARATION DÉPART ---------- */
export function calculateDepartureReadiness(
  kit: CustomKit,
  departure: PlannedHike,
  allEquipment: UserEquipmentItem[],
  departurePlan: DeparturePreparationPlan | null
) {
  const kitItems = kit.items || [];
  const missingItems: UnifiedProductState[] = [];
  const unavailableItems: UnifiedProductState[] = [];
  let owned = 0;

  kitItems.forEach(ki => {
    const matchingEquipment = allEquipment.find(e =>
      (ki.gear_item_id && e.id === ki.gear_item_id) ||
      e.name.toLowerCase() === ki.item_name.toLowerCase()
    );

    if (matchingEquipment) {
      owned++;
      const state = calculateUnifiedProductState(
        matchingEquipment,
        null,
        [kit], // kits contenant ce kit
        departure,
        departurePlan,
        [], // cart
        allEquipment
      );

      if (!isAvailable(state.availability) || !isUsable(state.physicalCondition)) {
        unavailableItems.push(state);
      }
    } else {
      // Produit manquant - créer état "non possédé"
      const catalogMatch = FALLBACK_AUTHENTIC_PRODUCTS.find(p =>
        p.name.toLowerCase().includes(ki.item_name.toLowerCase()) ||
        ki.item_name.toLowerCase().includes(p.name.toLowerCase())
      );

      const missingState: UnifiedProductState = {
        productId: `missing-${ki.id}`,
        source: 'catalog',
        name: ki.item_name,
        brand: '',
        category: normalizeCategory(ki.category || 'Autre'),
        weight_g: ki.weight_g || 0,
        price_eur: catalogMatch?.price_eur,
        ownership: 'non_possede',
        availability: 'indisponible',
        physicalCondition: 'excellent',
        preparation: 'pret',
        relations: {
          kits: [kit.id],
          departures: [departure.id],
          recommendedForDeparture: departurePlan?.checklist.inPackReady?.some(r => r.name.toLowerCase() === ki.item_name.toLowerCase()) ? [departure.id] : [],
          requiredForDeparture: departurePlan?.checklist.missingItems?.some(r => r.name.toLowerCase() === ki.item_name.toLowerCase()) ? [departure.id] : [],
          replacedBy: null,
          inCart: false,
          acquisitionIntentId: null,
        },
        isCritical: departurePlan?.checklist.missingItems?.some(r => r.name.toLowerCase() === ki.item_name.toLowerCase()) || false,
        isActionable: true,
        suggestedAction: {
          type: 'add_to_cart',
          label: 'Ajouter au panier',
          description: 'Manquant pour ce départ',
          variant: 'primary',
          icon: '🛒',
          priority: 1,
        },
      };
      missingItems.push(missingState);
    }
  });

  const readinessPct = kitItems.length > 0 ? Math.round((owned / kitItems.length) * 100) : 100;

  // Consommables
  const consumablesNeeded: { label: string; qty: string; critical: boolean }[] = [];
  if (departurePlan) {
    if (departurePlan.consumables.fuelGrams > 0) {
      consumablesNeeded.push({
        label: `Cartouche de gaz (~${departurePlan.consumables.fuelGrams}g)`,
        qty: `${departurePlan.consumables.fuelGrams}g`,
        critical: true,
      });
    }
    if (departurePlan.consumables.waterLiters > 0) {
      consumablesNeeded.push({
        label: `Eau : ${departurePlan.consumables.waterLiters}L`,
        qty: `${departurePlan.consumables.waterLiters}L`,
        critical: true,
      });
    }
    if (departurePlan.consumables.foodMealsCount > 0) {
      consumablesNeeded.push({
        label: `Repas : ${departurePlan.consumables.foodMealsCount}`,
        qty: `${departurePlan.consumables.foodMealsCount}`,
        critical: false,
      });
    }
  }

  return {
    readinessPct,
    ownedCount: owned,
    totalCount: kitItems.length,
    missingItems,
    unavailableItems,
    consumablesNeeded,
  };
}

/* ---------- EXPORT PRINCIPAL ---------- */
export const ProductStateEngine = {
  calculateUnifiedProductState,
  calculateDepartureReadiness,
  findAlternativeProduct,
  getRecommendedAction,
  normalizeCategory,
  findCatalogMatch,
};












