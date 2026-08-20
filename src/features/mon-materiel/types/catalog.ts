/**
 * LKDV — Mon Matériel : types du catalogue & groupes.
 * Interfaces nommées du plan v3 (2.3) : CatalogProduct, GroupKitItem,
 * DeparturePlan, Alert, MiniWidgetDTO.
 */

import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { CustomKit, CustomKitItem } from '@/hooks/useUserKits';
import type { PlannedHike } from '@/lib/preparation/plannedHikes';
import type { GearAlert } from '../domain/gear-alerts';

/** Ligne brute de `shop_products` (catalogue boutique). */
export interface CatalogProduct {
  id: string;
  slug?: string;
  name: string;
  brand?: string;
  category?: string;
  category_main?: string;
  weight_g?: number;
  weight_grams?: number;
  price_eur?: number;
  image?: string;
  image_alt?: string;
  rating?: number;
  review_count?: number;
  essentiality?: 'indispensable' | 'recommande' | 'optionnel';
  score_kdv?: number;
  description?: string;
  stock?: number;
  is_active?: boolean;
}

/** Lecture d'une ligne `group_kit_items` (engagement partagé de groupe). */
export interface GroupKitItem {
  id: string;
  group_id: string;
  assigned_to?: string | null;
  name: string;
  weight_grams?: number;
  category?: string;
  quantity?: number;
  is_shared?: boolean;
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  /** Décorée par GroupService : nom du groupe parent. */
  groupName?: string;
}

/** Ligne de `travel_groups` (projetée pour le cockpit). */
export interface TravelGroupLite {
  id: string;
  name: string;
  destination?: string;
  visibility?: string;
  owner_id?: string;
  departure_date?: string | null;
  return_date?: string | null;
}

/** Plan de départ normalisé (source : SmartDepartureEngine / plannedHikes). */
export interface DeparturePlan {
  id: string;
  name: string;
  departureDate: string | null;
  assignedKitId?: string | null;
  distanceKm: number;
  elevationGain: number;
  days: number;
  isOvernight: boolean;
  companions?: string;
  totalPackWeightG?: number;
}

/** Type partagé d'alerte (miroir minimal du domaine). */
export type Alert = GearAlert;

/** DTO standard rendu par les hooks du domaine. */
export interface MiniWidgetDTO<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
}

export type { UserEquipmentItem, CustomKit, CustomKitItem, PlannedHike };