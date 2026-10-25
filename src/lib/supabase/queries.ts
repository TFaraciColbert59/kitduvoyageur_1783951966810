import { createClient } from '@/lib/supabase/client';

export interface GearItemData {
  id: string;
  user_id?: string;
  name: string;
  brand?: string;
  model?: string;
  category: string;
  condition?: string;
  weight_g: number;
  purchase_price?: number;
  purchase_date?: string;
  image?: string;
  alt?: string;
  quantity?: number;
  is_favorite?: boolean;
  notes?: string;
  loan_status?: string;
  loan_to_name?: string;
  is_listed_for_sale?: boolean;
}

/** Fetch a single gear item for the current user.
 *  Returns `null` when the item does not exist (PGRST116) for the user.
 *  Throws for real network/DB errors so the UI can show a retry state. */
export async function fetchGearItem(
  gearId: string,
  userId: string,
  supabase = createClient()
): Promise<GearItemData | null> {
  const { data, error } = await supabase
    .from('gear_items')
    .select('*')
    .eq('id', gearId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('fetchGearItem error', error);
    throw error;
  }
  if (!data) return null;
  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    brand: data.brand || '',
    model: data.model || '',
    category: data.category || 'autre',
    condition: data.condition || 'excellent',
    weight_g: data.weight_g || 0,
    purchase_price: data.purchase_price || 0,
    purchase_date: data.purchase_date,
    image: data.image || '',
    alt: data.alt || data.name,
    quantity: data.quantity || 1,
    is_favorite: data.is_favorite || false,
    notes: data.notes || '',
    loan_status: data.loan_status,
    loan_to_name: data.loan_to_name,
    is_listed_for_sale: data.is_listed_for_sale || false,
  } as unknown as GearItemData;
}

/** Fetch all images for a gear item – expects a separate table `gear_images` with column `url` */
export async function fetchGearImages(
  gearId: string,
  supabase = createClient()
): Promise<string[]> {
  const { data, error } = await supabase
    .from('gear_images')
    .select('url')
    .eq('gear_item_id', gearId);
  if (error) {
    console.error('fetchGearImages error', error);
    return [];
  }
  return data?.map((row: any) => row.url) ?? [];
}

/** Fetch kits that contain this gear item */
export async function fetchItemKits(
  gearId: string,
  supabase = createClient()
): Promise<any[]> {
  const { data, error } = await supabase
    .from('kit_items')
    .select('kit_id, kits(name, description)')
    .eq('gear_item_id', gearId);
  if (error) {
    console.error('fetchItemKits error', error);
    return [];
  }
  // Return an array of kits with minimal info
  return data?.map((row: any) => ({
    kitId: row.kit_id,
    name: row.kits?.name,
    description: row.kits?.description,
  })) ?? [];
}

/** Fetch loans (active and past) for this gear item */
export async function fetchItemLoans(
  gearId: string,
  supabase = createClient()
): Promise<any[]> {
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .eq('gear_item_id', gearId);
  if (error) {
    console.error('fetchItemLoans error', error);
    return [];
  }
  return data ?? [];
}

/** Fetch a consolidated history timeline for the gear item */
export async function fetchItemHistory(
  gearId: string,
  supabase = createClient()
): Promise<any[]> {
  // Attempt to read a dedicated history table; if missing, fallback to empty array.
  const { data, error } = await supabase
    .from('gear_history')
    .select('*')
    .eq('gear_item_id', gearId)
    .order('event_date', { ascending: false });
  if (error) {
    console.warn('gear_history table not found or empty, returning empty history');
    return [];
  }
  return data ?? [];
}

/** Update gear item fields */
export async function updateGearItem(
  gearId: string,
  userId: string,
  updates: Partial<GearItemData>,
  supabase = createClient()
): Promise<boolean> {
  const { error } = await supabase
    .from('gear_items')
    .update(updates)
    .eq('id', gearId)
    .eq('user_id', userId);
  if (error) {
    console.error('updateGearItem error', error);
    return false;
  }
  return true;
}


