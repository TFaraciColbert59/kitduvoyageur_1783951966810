'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getTripById } from '@/lib/queries-trips';
import { tripSegmentPath } from '@/features/trips/registry/tripPaths';
import { HUB_HOME_HREF, hubSectionHref } from '@/features/hub/registry/hubSectionRegistry';

/**
 * Roadbook — actions des points d'intérêt du voyage (trip_pois).
 * RLS : lecture `can_read_trip`, écriture `can_edit_trip` (migration trips_core).
 */

const uuidSchema = z.string().uuid('Identifiant invalide');
const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide')
  .max(120);

const poiCategorySchema = z.enum([
  'water',
  'refuge',
  'summit',
  'viewpoint',
  'camp',
  'pass',
  'food',
  'other',
]);

const addPoiSchema = z.object({
  tripId: uuidSchema,
  tripSlug: slugSchema,
  name: z.string().trim().min(1, 'Le nom est requis.').max(150),
  category: poiCategorySchema.default('other'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  stepId: uuidSchema.nullable().optional(),
  notes: z.string().trim().max(600).nullable().optional(),
});

const updatePoiSchema = z.object({
  tripId: uuidSchema,
  tripSlug: slugSchema,
  poiId: uuidSchema,
  visited: z.boolean().optional(),
  stepId: uuidSchema.nullable().optional(),
  notes: z.string().trim().max(600).nullable().optional(),
});

const deletePoiSchema = z.object({
  tripId: uuidSchema,
  tripSlug: slugSchema,
  poiId: uuidSchema,
});

async function requireTripEditor(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Vous devez être connecté pour modifier les points d’intérêt' } as const;

  const trip = await getTripById(tripId, user.id);
  if (!trip) return { error: 'Voyage introuvable ou non autorisé' } as const;
  if (!trip.permissions.canEdit) {
    return { error: 'Seuls les organisateurs et éditeurs peuvent modifier les points d’intérêt' } as const;
  }
  return { userId: user.id } as const;
}

function revalidateTrip(slug: string) {
  revalidatePath(tripSegmentPath(slug, ''));
  revalidatePath(tripSegmentPath(slug, 'itineraire'));
  revalidatePath(HUB_HOME_HREF);
  revalidatePath(hubSectionHref({ nature: 'sortie', slug }, 'itinerary'));
}

export async function addTripPoiAction(
  rawInput: unknown
): Promise<{ success: boolean; poiId?: string; error?: string }> {
  try {
    const parsed = addPoiSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Point d’intérêt invalide' };
    }
    const auth = await requireTripEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('trip_pois')
      .insert({
        trip_id: parsed.data.tripId,
        step_id: parsed.data.stepId ?? null,
        name: parsed.data.name,
        category: parsed.data.category,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        notes: parsed.data.notes ?? null,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[LKDV poi] add error:', error);
      return { success: false, error: 'Impossible d’ajouter ce point d’intérêt' };
    }

    revalidateTrip(parsed.data.tripSlug);
    return { success: true, poiId: data.id };
  } catch (err) {
    console.error('[LKDV poi] addTripPoiAction error:', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

export async function updateTripPoiAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = updatePoiSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: 'Requête invalide' };
    }
    const auth = await requireTripEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error };

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.visited !== undefined) patch.visited = parsed.data.visited;
    if (parsed.data.stepId !== undefined) patch.step_id = parsed.data.stepId;
    if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes ?? null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('trip_pois')
      .update(patch)
      .eq('id', parsed.data.poiId)
      .eq('trip_id', parsed.data.tripId)
      .select('id')
      .single();

    if (error || !data) {
      console.error('[LKDV poi] update error:', error);
      return { success: false, error: 'Impossible de mettre à jour ce point d’intérêt' };
    }

    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[LKDV poi] updateTripPoiAction error:', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

export async function deleteTripPoiAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = deletePoiSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: 'Requête invalide' };
    }
    const auth = await requireTripEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error };

    const supabase = await createClient();
    const { error } = await supabase
      .from('trip_pois')
      .delete()
      .eq('id', parsed.data.poiId)
      .eq('trip_id', parsed.data.tripId);

    if (error) {
      console.error('[LKDV poi] delete error:', error);
      return { success: false, error: 'Impossible de supprimer ce point d’intérêt' };
    }

    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[LKDV poi] deleteTripPoiAction error:', err);
    return { success: false, error: 'Erreur serveur' };
  }
}
