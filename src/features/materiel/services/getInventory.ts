import type { InventoryMode, InventoryStatus } from '../domain/inventory';
import { createClient } from '@/lib/supabase/server';
import { resolveGearImage } from './gearImageResolver';

export interface InventoryItem {
  product_id?: string | null;
  serial_number?: string | null;
  description?: string | null;
  location?: string | null;
  listing_mode?: InventoryMode;
  status?: InventoryStatus;
  rental_price_cents?: number | null;
  deposit_cents?: number | null;
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  weight_g: number | null;
  price_cents: number | null;
  condition: string | null;
  photo_url: string | null;
  is_lent: boolean;
  purchase_date: string | null;
  maintenance_due_at: string | null;
  expiry_date: string | null;
  tags: string[] | null;
  quantity: number;
}

/** getInventory — inventaire de l'utilisateur (Server-only, RLS). */
export async function getInventory(): Promise<InventoryItem[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('product_ownership')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((i: any) => ({
      ...i,
      photo_url: resolveGearImage(i.name, i.category, i.photo_url),
    })) as InventoryItem[];
  } catch (err) {
    console.error('getInventory', err);
    return [];
  }
}
