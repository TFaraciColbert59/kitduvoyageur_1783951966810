import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface TripItemImage {
  itemId: string;
  url: string | null;
}

/**
 * Images du kit d'une sortie — une seule passe batchée :
 * trip_items(trip) → shop_products.image (produit boutique) puis
 * product_ownership.photo_url (item d'inventaire photographié).
 * Jamais d'image fabriquée : null = la carte affiche une tuile initiale.
 */
export async function getTripItemImages(tripId: string): Promise<TripItemImage[]> {
  const supabase = await createClient();
  try {
    const { data: itemRows } = await supabase
      .from('trip_items')
      .select('id, item_name, shop_product_id, inventory_item_id, is_packed, quantity')
      .eq('trip_id', tripId);
    const items = ((itemRows ?? []) as Array<{
      id: string;
      item_name: string;
      shop_product_id: string | null;
      inventory_item_id: string | null;
      is_packed: boolean;
      quantity: number;
    }>);
    if (items.length === 0) return [];

    const shopIds = [...new Set(items.map((i) => i.shop_product_id).filter((x): x is string => Boolean(x)))];
    const invIds = [...new Set(items.map((i) => i.inventory_item_id).filter((x): x is string => Boolean(x)))];

    const [shopRes, invRes] = await Promise.all([
      shopIds.length > 0
        ? supabase.from('shop_products').select('id, image').in('id', shopIds)
        : Promise.resolve({ data: null }),
      invIds.length > 0
        ? supabase.from('product_ownership').select('id, photo_url').in('id', invIds)
        : Promise.resolve({ data: null }),
    ]);

    const shopImageById = new Map<string, string>();
    for (const row of (shopRes.data ?? []) as Array<{ id: string; image: string | null }>) {
      if (row.image) shopImageById.set(row.id, row.image);
    }
    const invPhotoById = new Map<string, string>();
    for (const row of (invRes.data ?? []) as Array<{ id: string; photo_url: string | null }>) {
      if (row.photo_url) invPhotoById.set(row.id, row.photo_url);
    }

    return items.map((i) => ({
      itemId: i.id,
      url:
        (i.shop_product_id ? shopImageById.get(i.shop_product_id) : undefined) ??
        (i.inventory_item_id ? invPhotoById.get(i.inventory_item_id) : undefined) ??
        null,
    }));
  } catch (err) {
    console.error('[LKDV hub] item images error:', err);
    return [];
  }
}
