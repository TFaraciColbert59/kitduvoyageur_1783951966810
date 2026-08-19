/**
 * LKDV — Mon Matériel : types partagés du domaine.
 * Les types applicatifs (UserEquipmentItem, CustomKit, PlannedHike, UnifiedProduct)
 * restent définis dans leurs hooks/libs existants ; ce module centralise les types
 * du domaine v3 (contextes, prêts, commandes, disponibilité) utilisés par les
 * fonctions pures et les composants de l'expérience « Mon Matériel ».
 */

import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { CustomKit } from '@/hooks/useUserKits';
import type { PlannedHike } from '@/lib/preparation/plannedHikes';

/** Ligne d'une commande (« En commande »). */
export interface OrderedProductItem {
  orderId: string;
  orderItemId: string;
  productId?: string | null;
  slug?: string;
  name: string;
  brand?: string;
  category?: string;
  weightG?: number;
  priceEur?: number;
  quantity: number;
  status: string;
  createdAt?: string | null;
  /** Destination mémorisée lors du « Ajouter à l'équipement » (kit, checklist, départ). */
  destination?: GearDestination;
}

/** Destination d'un objet ajouté à l'équipement (flux universel Cas C). */
export interface GearDestination {
  type: 'kit' | 'checklist' | 'departure' | 'inventory';
  refId?: string;
  label?: string;
  reason?: string;
}

/** Enregistrement de prêt issu de la table `loans`. */
export interface GearLoanRecord {
  id: string;
  gear_item_id?: string | null;
  loaned_to: string;
  loaned_at?: string | null;
  returned_at?: string | null;
  status?: string;
}

/** Événement d'historique issu de la table `gear_history`. */
export interface GearHistoryEvent {
  id: string;
  gear_item_id: string;
  event_type?: string;
  event_date?: string;
  notes?: string | null;
}

/** Contexte passé aux fonctions pures du domaine (aucun effet de bord). */
export interface GearStatusContext {
  now?: Date;
  /** Prêts actifs de l'inventaire du user (table `loans`). */
  activeLoans?: GearLoanRecord[];
  /** Lignes « en commande » rattachées au user. */
  orderedItems?: OrderedProductItem[];
  /** Ids d'équipements réservés par le prochain départ (items du kit assigné). */
  hikeCommittedGearIds?: string[];
  /** Ids d'équipements présents dans les kits actifs. */
  kitMembershipIds?: string[];
  /** Départ actif si renseigné (affichage d'engagement et de conflit). */
  activeDeparture?: Pick<PlannedHike, 'id' | 'name' | 'targetDate'> & { assignedKitId?: string } | null;
  /** Kits actifs (pour l'enrichissement de la disponibilité / engagement). */
  kits?: CustomKit[];
  /** Randonnées planifiées (pour l'enrichissement de la disponibilité). */
  plannedHikes?: PlannedHike[];
}

/** Statut applicatif d'un objet : miroir minimal, aide à l'UI. */
export type GearPossession = 'owned' | 'unowned';
export type GearAvailabilityState = 'available' | 'on_loan' | 'unavailable' | 'not_owned';

export type { UserEquipmentItem, CustomKit, PlannedHike };