'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { eventAdventureRefSchema, type EventAdventureRef } from '@/features/hub/context/eventAdventureRef';
import { setActiveAdventureAction } from '@/features/hub/context/activeAdventureServer';
import { resolveEventAdventure } from '@/features/hub/server/resolveEventAdventure';

type FormResult = { error?: string; message?: string };

export async function openEventAdventure(ref: EventAdventureRef): Promise<FormResult> {
  const eventRef = eventAdventureRefSchema.safeParse(ref);
  const linked = eventRef.success ? await resolveEventAdventure(eventRef.data) : null;
  if (!linked) return { error: 'Cette aventure est indisponible.' };

  const result = await setActiveAdventureAction({
    nature: 'sortie',
    id: linked.id,
    slug: linked.slug,
    title: linked.title,
  });
  if (!result.success) return { error: 'Impossible d’ouvrir le HUB. Réessaie.' };
  redirect('/hub');
}

export async function saveEventAdventure(
  ref: EventAdventureRef,
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  const eventRef = eventAdventureRefSchema.safeParse(ref);
  const trip = z.union([z.string().uuid(), z.literal('')]).safeParse(form.get('tripId'));
  if (!eventRef.success || !trip.success) return { error: 'Sélection invalide.' };

  const client = await createClient();
  const { error } = await client.rpc('set_event_trip', {
    p_source_kind: eventRef.data.kind,
    p_event_id: eventRef.data.id,
    p_trip_id: trip.data || null,
  });
  if (error) return { error: 'Impossible de modifier l’aventure liée.' };

  revalidatePath('/sorties/' + eventRef.data.id);
  revalidatePath('/hub', 'layout');
  return { message: trip.data ? 'Aventure liée.' : 'Lien retiré.' };
}
