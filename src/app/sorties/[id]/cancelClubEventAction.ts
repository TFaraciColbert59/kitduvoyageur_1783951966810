'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export async function cancelClubEventAction(id: string): Promise<{ cancelledAt?: string; error?: string }> {
  const eventId = z.string().uuid().safeParse(id);
  if (!eventId.success) return { error: 'Sortie introuvable.' };

  const client = await createClient();
  const { data, error } = await client.rpc('cancel_club_event', { p_event_id: eventId.data });
  if (error?.code === '42501') return { error: 'Seul l’organisateur peut annuler cette sortie.' };
  if (error || typeof data !== 'string') return { error: 'Impossible d’annuler la sortie. Réessaie.' };

  revalidatePath('/sorties/' + eventId.data);
  revalidatePath('/hub', 'layout');
  revalidatePath('/compte');
  return { cancelledAt: data };
}
