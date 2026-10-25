import { createClient } from '@/lib/supabase/server';

export interface KitHistoryEntry {
  id: string;
  kit_id: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/** getKitHistory — historique des versions d'un kit (W-K-8), table materiel_kit_history. */
export async function getKitHistory(kitId: string): Promise<KitHistoryEntry[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('materiel_kit_history')
      .select('id, kit_id, action, payload, created_at')
      .eq('kit_id', kitId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    return (data ?? []) as KitHistoryEntry[];
  } catch (err) {
    console.error('getKitHistory', err);
    return [];
  }
}
