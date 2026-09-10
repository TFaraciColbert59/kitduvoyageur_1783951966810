import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getTripBySlug } from '@/lib/queries-trips';
import { generateTripContextualKit, getTripDurationDays } from '@/features/trips/engine/contextualKitEngine';
import { getTripElevationProfile } from '@/features/trips/lib/elevation';
import type { TripFull, TripItem, TripPurchaseState } from '@/features/trips/types/trip.types';
import type {
  ShopProductReference,
  ContextualGearRecommendation,
  TripKitAnalysis,
} from '@/features/trips/types/kit.types';

export interface TripKitDetailsResult {
  trip: TripFull;
  analysis: TripKitAnalysis;
  availableProducts: ShopProductReference[];
}

/**
 * Récupère tous les produits boutique actifs pour alimenter le moteur contextuel
 */
export async function getShopProducts(): Promise<ShopProductReference[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('shop_products')
    .select('id, slug, name, brand, price_eur, weight_g, category_main, image, image_alt, score_kdv')
    .eq('is_active', true)
    .order('score_kdv', { ascending: false });

  if (error) {
    console.error('[getShopProducts] Erreur Supabase :', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand || 'LKDV Sélection',
    price_eur: Number(row.price_eur || 0),
    weight_g: Number(row.weight_g || 0),
    category_main: row.category_main || 'Équipement',
    image: row.image,
    image_alt: row.image_alt,
    score_kdv: row.score_kdv,
  }));
}

/**
 * Récupère les détails du kit d'un voyage : items réels + recommandations contextuelles IA
 */
export async function getTripKitDetails(
  slug: string,
  userId?: string
): Promise<TripKitDetailsResult | null> {
  const trip = await getTripBySlug(slug, userId);
  if (!trip) return null;

  const availableProducts = await getShopProducts();

  // Déduire le mois pour la saisonnalité si start_date est renseigné
  let seasonMonth: number | undefined;
  if (trip.start_date) {
    const d = new Date(trip.start_date);
    if (!isNaN(d.getTime())) {
      seasonMonth = d.getMonth() + 1;
    }
  }

  const elevationProfile = getTripElevationProfile(trip);

  const analysis = generateTripContextualKit({
    countryCode: trip.destination_country_code,
    activity: trip.primary_activity,
    durationDays: getTripDurationDays(trip),
    seasonMonth,
    steps: trip.steps,
    currentItems: trip.items,
    availableProducts,
    elevationProfile,
  });

  return {
    trip,
    analysis,
    availableProducts,
  };
}

/**
 * Ajoute un équipement au sac du voyage
 */
export async function addTripItem(input: {
  tripId: string;
  itemName: string;
  category?: string;
  weightGrams?: number;
  quantity?: number;
  priority?: 'vital' | 'recommended' | 'optional';
  isVital?: boolean;
  isWorn?: boolean;
  isConsumable?: boolean;
  shopProductId?: string;
  inventoryItemId?: string | null;
  notes?: string;
  source?: string;
  purchaseState?: TripPurchaseState;
}): Promise<TripItem | null> {
  const supabase = await createClient();

  const isVital = input.isVital ?? (input.priority === 'vital');

  const { data, error } = await supabase
    .from('trip_items')
    .insert({
      trip_id: input.tripId,
      item_name: input.itemName,
      category: input.category || 'misc',
      weight_grams: input.weightGrams ?? null,
      quantity: input.quantity ?? 1,
      is_packed: false,
      status: 'needed',
      priority: input.priority || (isVital ? 'vital' : 'recommended'),
      is_vital: isVital,
      is_worn: input.isWorn ?? false,
      is_consumable: input.isConsumable ?? false,
      shop_product_id: input.shopProductId || null,
      inventory_item_id: input.inventoryItemId || null,
      notes: input.notes || null,
      source: input.source || 'user',
      purchase_state: input.purchaseState ?? 'needed',
    })
    .select('*')
    .single();

  if (error || !data) {
    console.error('[addTripItem] Erreur insertion :', error);
    return null;
  }

  return data as TripItem;
}

/**
 * Bascule l'état emballé d'un équipement.
 * `userId` renseigne packed_by → suivi des ressources par membre (hub Équipement).
 * `.select('id')` : un update bloqué par la RLS affecte 0 ligne → échec explicite.
 */
export async function toggleTripItemPacked(
  itemId: string,
  isPacked: boolean,
  userId?: string | null
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trip_items')
    .update({
      is_packed: isPacked,
      status: isPacked ? 'packed' : 'needed',
      packed_by: isPacked ? userId ?? null : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select('id');

  if (error) {
    console.error('[toggleTripItemPacked] Erreur update :', error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

/** Statut d'achat d'un équipement manquant (cycle du panneau Équipement). */
export async function setTripItemPurchaseState(
  itemId: string,
  state: TripPurchaseState
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trip_items')
    .update({ purchase_state: state, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select('id');

  if (error) {
    console.error('[setTripItemPurchaseState] Erreur update :', error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

/**
 * Supprime un équipement du voyage
 */
export async function deleteTripItem(itemId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trip_items')
    .delete()
    .eq('id', itemId)
    .select('id');

  if (error) {
    console.error('[deleteTripItem] Erreur delete :', error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

/**
 * Ajoute un produit recommandé par le kit contextuel directement dans le sac
 */
export async function addRecommendedItemToTrip(
  tripId: string,
  rec: ContextualGearRecommendation
): Promise<TripItem | null> {
  return addTripItem({
    tripId,
    itemName: rec.shopProduct ? `${rec.shopProduct.name} (${rec.shopProduct.brand})` : rec.name,
    category: rec.category,
    weightGrams: rec.weightGrams,
    quantity: 1,
    priority: rec.priority,
    isVital: rec.priority === 'vital',
    shopProductId: rec.shopProduct?.id,
    notes: rec.reason,
    source: 'contextual_kit',
    purchaseState: 'added',
  });
}
