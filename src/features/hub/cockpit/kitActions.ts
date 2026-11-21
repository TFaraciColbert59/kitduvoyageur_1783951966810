'use server';

import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ToggleKitItemResult =
  | { ok: true; itemId: string; packed: boolean }
  | { ok: false; message: string };

export async function toggleCockpitKitItem(input: {
  tripId: string;
  itemId: string;
  packed: boolean;
}): Promise<ToggleKitItemResult> {
  if (!UUID.test(input.tripId) || !UUID.test(input.itemId)) {
    return { ok: false, message: 'Élément introuvable.' };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Connexion requise.' };

  const { data, error } = await supabase
    .from('trip_items')
    .update({
      is_packed: input.packed,
      packed_by: input.packed ? user.id : null,
      status: input.packed ? 'packed' : 'needed',
    })
    .eq('id', input.itemId)
    .eq('trip_id', input.tripId)
    .select('id,is_packed')
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.code === '42501'
        ? 'Droits insuffisants pour modifier le kit de ce voyage.'
        : 'Impossible de mettre à jour cet élément.',
    };
  }
  return { ok: true, itemId: data.id, packed: Boolean(data.is_packed) };
}
