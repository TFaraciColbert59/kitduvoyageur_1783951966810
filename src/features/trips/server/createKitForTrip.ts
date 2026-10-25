import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildAutogenPreparation,
  flattenPreparationKitItems,
  type PreparationLayers,
} from '../engine/autogenPreparation';
import { kitItemMatchesOwned } from '../engine/kitCompletenessEngine';
import { selectKitProducts, type KitProduct } from '../engine/selectKitProducts';
import { splitDays } from '../domain/deterministicActivityContent';
import { loadKitCatalogue } from './createTripFromAutogenIntent';

/**
 * Kit déterministe garanti (fix « kit jamais manquant »).
 *
 * Le repli `createTrip` de la préparation sentier peut aboutir sans kit
 * (génération concurrente en 409, usine indisponible). Ce module construit
 * alors un kit RÉEL depuis le catalogue (`shop_products`) et le moteur de
 * sélection de l'usine, sinon depuis les règles contextuelles déterministes
 * (`buildAutogenPreparation`) — jamais un voyage sans kit.
 *
 * Insertions batchées (miroir exact du chemin T10) :
 *   1. `materiel_kits` (UNE ligne) ;
 *   2. `materiel_kit_items` (UN batch, `product_id` catalogue quand connu) ;
 *   3. `trip_items` (UN batch, `needed`/`missing` selon l'inventaire réel) ;
 *   4. `trips` : `kit_id` + `metadata.kit_source = 'deterministic'`.
 *
 * Best-effort : toute erreur est journalisée et rend `{ kitId: null,
 * itemCount: 0 }` — jamais d'exception vers l'appelant.
 */

export interface CreateKitForTripTrail {
  id: number;
  name: string;
  distanceKm?: number | null;
}

export interface CreateKitForTripMeta {
  difficulty?: string | null;
  durationHours?: number | null;
  elevationGain?: number | null;
  terrainType?: string | null;
  season?: string | null;
}

export interface CreateKitForTripArgs {
  supabase: SupabaseClient;
  userId: string;
  tripId: string;
  trail: CreateKitForTripTrail;
  meta: CreateKitForTripMeta | null;
  partySize?: number;
  layers?: Record<string, unknown> | null;
}

export interface CreateKitForTripResult {
  kitId: string | null;
  itemCount: number;
}

export const KIT_SOURCE = 'deterministic';

interface OwnedItemRow {
  id: string;
  name: string;
  weightGrams: number | null;
  condition: string | null;
}

interface KitPersistRow {
  name: string;
  category: string;
  quantity: number;
  ownership: 'personal' | 'shared';
  reason: string;
  priority: 'vital' | 'recommended' | 'optional';
  isVital: boolean;
  weightGrams: number | null;
  source: 'template' | 'contextual_kit';
  recommendationKey: string | null;
  productId: string | null;
}

const SELECTION_PRIORITY: Record<KitProduct['priority'], KitPersistRow['priority']> = {
  indispensable: 'vital',
  recommande: 'recommended',
  optionnel: 'optional',
};

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function seasonMonthFrom(season: string | null | undefined): number | null {
  if (!season) return null;
  const parsed = Number(season);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

/**
 * Inventaire personnel borné (400 lignes max) — même lecture que l'usine :
 * sert uniquement à marquer « possédé » / « manquant » et à reprendre les
 * poids RÉELS connus.
 */
async function loadOwnedItems(
  supabase: SupabaseClient,
  userId: string
): Promise<OwnedItemRow[]> {
  try {
    const { data, error } = await supabase
      .from('product_ownership')
      .select('id, name, weight_g, condition')
      .eq('user_id', userId)
      .limit(400);
    if (error || !Array.isArray(data)) return [];
    return data
      .map((row) => {
        const record = row as Record<string, unknown>;
        const weight = Number(record.weight_g);
        return {
          id: String(record.id),
          name: typeof record.name === 'string' ? record.name : '',
          weightGrams: Number.isFinite(weight) && weight > 0 ? weight : null,
          condition:
            typeof record.condition === 'string' && record.condition !== ''
              ? record.condition
              : null,
        };
      })
      .filter((row) => row.name !== '');
  } catch (error) {
    console.error('[LKDV preparer-sentier] lecture inventaire en échec:', error);
    return [];
  }
}

function findOwnedMatch(row: KitPersistRow, ownedItems: OwnedItemRow[]): OwnedItemRow | null {
  return (
    ownedItems.find((owned) =>
      kitItemMatchesOwned(row.name, owned.name, row.recommendationKey)
    ) ?? null
  );
}

export async function createKitForTrip(
  args: CreateKitForTripArgs
): Promise<CreateKitForTripResult> {
  const { supabase, userId, tripId, trail, meta } = args;
  const partySize = Math.max(1, Math.trunc(toFiniteNumber(args.partySize) ?? 1));
  let createdKitId: string | null = null;

  try {
    const days = splitDays(trail.distanceKm ?? null, meta?.durationHours ?? null);
    const layers = (args.layers ?? {}) as PreparationLayers;

    const [ownedItems, catalogue] = await Promise.all([
      loadOwnedItems(supabase, userId),
      loadKitCatalogue(supabase),
    ]);
    const selection = selectKitProducts(
      {
        activity: 'hiking',
        durationDays: days,
        season: meta?.season ?? null,
        difficulty: meta?.difficulty ?? null,
        elevationGainM: meta?.elevationGain ?? null,
        partySize,
      },
      catalogue.products
    );

    let rows: KitPersistRow[];
    if (selection.items.length > 0) {
      rows = selection.items.map((item) => ({
        name: item.product.name,
        category: item.product.category,
        quantity: item.quantity,
        ownership: item.ownership,
        reason: item.reason,
        priority: SELECTION_PRIORITY[item.product.priority],
        isVital: item.product.priority === 'indispensable',
        weightGrams: item.product.weightGrams,
        source: 'contextual_kit',
        recommendationKey: null,
        productId: catalogue.bySlug.get(item.product.slug)?.id ?? null,
      }));
    } else {
      // Catalogue indisponible : repli sur les règles contextuelles réelles de
      // l'usine (mêmes données de parcours) — jamais un kit vide.
      const preparation = buildAutogenPreparation({
        brief: null,
        layers,
        partySize,
        routeName: trail.name,
        activity: 'hiking',
        countryCode: null,
        durationDays: days,
        seasonMonth: seasonMonthFrom(meta?.season),
        route: {
          name: trail.name,
          distanceKm: trail.distanceKm ?? null,
          elevationGainM: meta?.elevationGain ?? null,
          difficulty: meta?.difficulty ?? null,
        },
      });
      rows = preparation.kit
        ? flattenPreparationKitItems(preparation.kit).map((item) => ({
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            ownership: item.ownership,
            reason: item.reason,
            priority: item.priority,
            isVital: item.isVital,
            weightGrams: null,
            source: item.source,
            recommendationKey: item.recommendationKey,
            productId: null,
          }))
        : [];
    }

    if (rows.length === 0) return { kitId: null, itemCount: 0 };

    const totalWeightGrams = rows.reduce((sum, row) => {
      const owned = findOwnedMatch(row, ownedItems);
      return sum + (owned?.weightGrams ?? row.weightGrams ?? 0) * row.quantity;
    }, 0);

    const { data: kit, error: kitError } = await supabase
      .from('materiel_kits')
      .insert({
        user_id: userId,
        name: `Kit — ${trail.name}`,
        description:
          'Kit déterministe généré depuis un sentier (catalogue réel et règles ' +
          'contextuelles LKDV, à ajuster avant départ).',
        total_weight_g: totalWeightGrams,
        is_public: false,
        is_trashed: false,
      })
      .select('id')
      .single();

    if (kitError || !kit) {
      console.error(
        '[LKDV preparer-sentier] insertion materiel_kits en échec:',
        kitError?.message
      );
      return { kitId: null, itemCount: 0 };
    }
    const kitId = String((kit as { id: string }).id);
    createdKitId = kitId;

    const kitRows = rows.map((row) => {
      const owned = findOwnedMatch(row, ownedItems);
      return {
        kit_id: kitId,
        user_id: userId,
        name: row.name,
        category: row.category,
        weight_g: owned?.weightGrams ?? row.weightGrams ?? 0,
        quantity: row.quantity,
        is_checked: false,
        ownership: row.ownership,
        owner_id: row.ownership === 'personal' ? userId : null,
        condition: owned?.condition ?? null,
        reason: row.reason,
        priority: row.priority,
        is_vital: row.isVital,
        product_id: row.productId,
      };
    });
    const { error: kitItemsError } = await supabase.from('materiel_kit_items').insert(kitRows);
    if (kitItemsError) throw new Error(`materiel_kit_items: ${kitItemsError.message}`);

    const tripItems = rows.map((row) => {
      const owned = findOwnedMatch(row, ownedItems);
      return {
        trip_id: tripId,
        item_name: row.name,
        category: row.category,
        quantity: row.quantity,
        weight_grams: owned?.weightGrams ?? row.weightGrams,
        is_packed: false,
        status: owned ? 'needed' : 'missing',
        source: owned ? 'inventory' : row.source,
        priority: row.priority,
        is_vital: row.isVital,
        is_worn: false,
        is_consumable: false,
        purchase_state: owned ? 'added' : 'needed',
        inventory_item_id: owned?.id ?? null,
        shop_product_id: row.productId,
        ownership: row.ownership,
        owner_id: row.ownership === 'personal' ? userId : null,
        condition: owned?.condition ?? null,
        reason: row.reason,
      };
    });
    const { error: tripItemsError } = await supabase.from('trip_items').insert(tripItems);
    if (tripItemsError) throw new Error(`trip_items: ${tripItemsError.message}`);

    // `metadata = metadata || { kit_source: 'deterministic' }` : fusion locale
    // (le client Supabase n'expose pas l'opérateur jsonb `||` sur `update`).
    const { data: tripRow, error: readError } = await supabase
      .from('trips')
      .select('metadata')
      .eq('id', tripId)
      .eq('user_id', userId)
      .maybeSingle();
    if (readError) throw new Error(`trips metadata: ${readError.message}`);

    const currentMetadata =
      tripRow && typeof (tripRow as { metadata?: unknown }).metadata === 'object' && tripRow.metadata
        ? ((tripRow as { metadata: Record<string, unknown> }).metadata ?? {})
        : {};

    const { error: updateError } = await supabase
      .from('trips')
      .update({
        kit_id: kitId,
        metadata: { ...currentMetadata, kit_source: KIT_SOURCE },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .eq('user_id', userId);
    if (updateError) throw new Error(`trips kit_id: ${updateError.message}`);

    return { kitId, itemCount: rows.length };
  } catch (error) {
    console.error(
      '[LKDV preparer-sentier] kit déterministe en échec:',
      error instanceof Error ? error.message : error
    );
    if (createdKitId) {
      try {
        await supabase.from('materiel_kits').delete().eq('id', createdKitId).eq('user_id', userId);
      } catch (cleanupError) {
        console.error('[LKDV preparer-sentier] compensation kit en échec:', cleanupError);
      }
    }
    return { kitId: null, itemCount: 0 };
  }
}
