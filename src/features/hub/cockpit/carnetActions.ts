'use server';

import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getTripById } from '@/lib/queries-trips';
import { convertTripToCarnetData } from '@/features/trips/engine/carnetConversionEngine';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function carnetIdForTrip(tripId: string) {
  const bytes = createHash('sha256').update(`lkdv:carnet-de-voyage:${tripId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

export async function createHubTripCarnet(tripId: string): Promise<{ id: string } | { error: string }> {
  if (!UUID.test(tripId)) return { error: 'Voyage introuvable.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Connexion requise.' };
  const trip = await getTripById(tripId, user.id);
  if (!trip || trip.user_id !== user.id) {
    return { error: 'Seul le responsable peut créer le carnet du voyage.' };
  }

  const existing = await supabase.from('carnets').select('id').eq('trip_id', tripId).eq('author_id', user.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existing.error) return { error: 'Le carnet est indisponible. Réessaie.' };
  if (existing.data) return { id: existing.data.id };

  const { carnet } = convertTripToCarnetData(trip, { isPublic: false });
  const id = carnetIdForTrip(tripId);
  const result = await supabase.from('carnets').upsert({ ...carnet, id }, { onConflict: 'id', ignoreDuplicates: true });
  if (result.error) return { error: 'Le carnet n’a pas pu être créé.' };
  const saved = await supabase.from('carnets').select('id').eq('id', id).eq('author_id', user.id).eq('trip_id', tripId).maybeSingle();
  return saved.data ? { id: saved.data.id } : { error: 'Le carnet n’a pas pu être chargé.' };
}
