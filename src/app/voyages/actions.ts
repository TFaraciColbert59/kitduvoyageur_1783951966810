'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createTrip, getTripById } from '@/lib/queries-trips';
import {
  createTripSchema,
  saveDraftTripSchema,
  wizardPersistInputSchema,
  type CreateTripInput,
  type SaveDraftTripInput,
  type WizardPersistInput,
} from '@/features/trips/schemas/trip.schema';
import {
  buildItinerary,
  type CandidateStep,
  type CandidateItem,
  type PlannerOutput,
} from '@/features/trips/engine';
import {
  SEED_DESTINATION_STEPS,
  SEED_CANDIDATE_ITEMS,
} from '@/features/trips/data/destinationsSeed';

/**
 * 1. Création simple d'un voyage
 */
export async function createTripAction(input: CreateTripInput): Promise<{ slug: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Vous devez être connecté pour créer un voyage.');
  }

  const trip = await createTrip(input, user.id);
  revalidatePath('/voyages');
  return { slug: trip.slug };
}

/**
 * 2. Sauvegarde d'un brouillon de voyage (Étape 3+ du Wizard)
 */
export async function saveDraftTripAction(
  input: SaveDraftTripInput
): Promise<{ tripId: string | null; slug: string | null }> {
  const validated = saveDraftTripSchema.parse(input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Non authentifié : le client gère le draft dans localStorage
    return { tripId: null, slug: null };
  }

  const primaryCountry = validated.countries[0] || null;

  if (validated.tripId) {
    // Mise à jour d'un voyage brouillon existant
    const { data: updated, error } = await supabase
      .from('trips')
      .update({
        title: validated.title,
        description: validated.description || null,
        destination_country_code: primaryCountry,
        destination_name: validated.destinationName || null,
        start_date: validated.startDate || null,
        end_date: validated.endDate || null,
        primary_activity: validated.activityType,
        difficulty: validated.difficulty,
        group_id: validated.groupId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.tripId)
      .eq('user_id', user.id)
      .select('id, slug')
      .single();

    if (error) {
      console.error('[LKDV trips] saveDraftTripAction update error:', error);
      return { tripId: validated.tripId, slug: null };
    }

    return { tripId: updated.id, slug: updated.slug };
  }

  // Création initiale du brouillon
  const { data: created, error } = await supabase
    .from('trips')
    .insert({
      title: validated.title,
      description: validated.description || null,
      destination_country_code: primaryCountry,
      destination_name: validated.destinationName || null,
      start_date: validated.startDate || null,
      end_date: validated.endDate || null,
      primary_activity: validated.activityType,
      difficulty: validated.difficulty,
      status: 'draft',
      visibility: 'private',
      group_id: validated.groupId || null,
      user_id: user.id,
    })
    .select('id, slug')
    .single();

  if (error) {
    console.error('[LKDV trips] saveDraftTripAction insert error:', error);
    return { tripId: null, slug: null };
  }

  return { tripId: created.id, slug: created.slug };
}

/**
 * 3. Génération déterministe et persistance complète de l'itinéraire
 */
export async function generateAndPersistItinerary(
  input: WizardPersistInput
): Promise<{
  success: boolean;
  tripId: string | null;
  slug: string | null;
  output: PlannerOutput;
}> {
  const validated = wizardPersistInputSchema.parse(input);
  const supabase = await createClient();

  // 1. Récupération des étapes candidates depuis destination_steps
  const { data: dbSteps, error: stepsErr } = await supabase
    .from('destination_steps')
    .select('*')
    .in('country_code', validated.countries);

  if (stepsErr) {
    console.warn('[LKDV trips] Erreur lecture destination_steps, fallback local:', stepsErr);
  }

  // Fallback si la base est inaccessible ou incomplète
  let candidatePool: CandidateStep[] = [];
  if (dbSteps && dbSteps.length > 0) {
    candidatePool = dbSteps.map((s: any) => ({
      id: s.id,
      country_code: s.country_code,
      title: s.title,
      location_name: s.location_name,
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
      description: s.description || undefined,
      distance_km: s.distance_km ? Number(s.distance_km) : undefined,
      elevation_gain_m: s.elevation_gain_m ? Number(s.elevation_gain_m) : undefined,
      elevation_loss_m: s.elevation_loss_m ? Number(s.elevation_loss_m) : undefined,
      difficulty: s.difficulty,
      activity_type: s.activity_type,
      order_hint: s.order_hint,
      is_demanding: s.is_demanding,
    }));
  }

  // Si des pays demandés ne sont pas dans dbSteps, injecter les graines SEED
  for (const countryCode of validated.countries) {
    const hasCode = candidatePool.some((s) => s.country_code === countryCode);
    if (!hasCode) {
      const seeds = SEED_DESTINATION_STEPS.filter((s) => s.country_code === countryCode);
      candidatePool.push(...seeds);
    }
  }

  // 2. Exécution du moteur pur déterministe (ZÉRO appel LLM)
  const output = buildItinerary(
    {
      countries: validated.countries.map((c) => ({ country_code: c })),
      duration_days: validated.durationDays,
      start_date: validated.startDate || null,
      end_date: validated.endDate || null,
      styles: [validated.activityType, validated.accommodationType],
      pace: validated.pace,
      travelers_count: validated.travelersCount,
    },
    {
      candidateSteps: candidatePool,
      candidateItems: SEED_CANDIDATE_ITEMS as CandidateItem[],
    }
  );

  // 3. Persistance si l'utilisateur est authentifié
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Non authentifié : retourne l'itinéraire calculé pour affichage / aperçu
    return {
      success: true,
      tripId: null,
      slug: null,
      output,
    };
  }

  const primaryCountry = validated.countries[0] || null;
  let tripId = validated.tripId;
  let slug = '';

  if (tripId) {
    // Mise à jour du voyage existant
    const { data: updated, error: updateErr } = await supabase
      .from('trips')
      .update({
        title: validated.title,
        description: validated.description || null,
        destination_country_code: primaryCountry,
        destination_name: validated.destinationName || null,
        start_date: validated.startDate || null,
        end_date: validated.endDate || null,
        status: validated.publishStatus,
        primary_activity: validated.activityType,
        difficulty: validated.difficulty,
        group_id: validated.groupId || null,
        metadata: {
          countries: validated.countries,
          pace: validated.pace,
          accommodation_type: validated.accommodationType,
          travelers_count: validated.travelersCount,
          group_type: validated.groupType,
          engine_summary: output.allocations,
          warnings: output.warnings,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .select('id, slug')
      .single();

    if (updateErr || !updated) {
      throw new Error(`Impossible de mettre à jour le voyage: ${updateErr?.message || 'Inconnu'}`);
    }
    slug = updated.slug;
  } else {
    // Création d'un nouveau voyage
    const { data: created, error: insertErr } = await supabase
      .from('trips')
      .insert({
        title: validated.title,
        description: validated.description || null,
        destination_country_code: primaryCountry,
        destination_name: validated.destinationName || null,
        start_date: validated.startDate || null,
        end_date: validated.endDate || null,
        status: validated.publishStatus,
        visibility: 'private',
        primary_activity: validated.activityType,
        difficulty: validated.difficulty,
        group_id: validated.groupId || null,
        user_id: user.id,
        metadata: {
          countries: validated.countries,
          pace: validated.pace,
          accommodation_type: validated.accommodationType,
          travelers_count: validated.travelersCount,
          group_type: validated.groupType,
          engine_summary: output.allocations,
          warnings: output.warnings,
        },
      })
      .select('id, slug')
      .single();

    if (insertErr || !created) {
      throw new Error(`Impossible de créer le voyage: ${insertErr?.message || 'Inconnu'}`);
    }
    tripId = created.id;
    slug = created.slug;
  }

  // 4. Nettoyage des étapes existantes et des items template (préserve source='user')
  await supabase.from('trip_steps').delete().eq('trip_id', tripId);
  await supabase
    .from('trip_items')
    .delete()
    .eq('trip_id', tripId)
    .or('source.eq.template,source.eq.import,source.is.null');

  // 5. Insertion des étapes générées
  if (output.steps.length > 0) {
    const stepsPayload = output.steps.map((s) => ({
      trip_id: tripId!,
      day_number: s.day_number,
      order_index: s.order_index,
      title: s.title,
      description: s.description,
      location_name: s.location_name,
      latitude: s.latitude,
      longitude: s.longitude,
      accommodation_name: s.accommodation_name,
      transport_mode: s.transport_mode,
      distance_km: s.distance_km,
      elevation_gain_m: s.elevation_gain_m,
      elevation_loss_m: s.elevation_loss_m,
    }));

    const { error: stepsInsertErr } = await supabase.from('trip_steps').insert(stepsPayload);
    if (stepsInsertErr) {
      console.error('[LKDV trips] Erreur insertion trip_steps:', stepsInsertErr);
      throw new Error(`Erreur insertion des étapes: ${stepsInsertErr.message}`);
    }
  }

  // 6. Insertion des items matériels générés
  if (output.items.length > 0) {
    const itemsPayload = output.items.map((it) => ({
      trip_id: tripId!,
      item_name: it.item_name,
      category: it.category,
      quantity: it.quantity,
      weight_grams: it.weight_grams,
      is_packed: false,
      status: 'needed' as const,
      source: 'template',
    }));

    const { error: itemsInsertErr } = await supabase.from('trip_items').insert(itemsPayload);
    if (itemsInsertErr) {
      console.error('[LKDV trips] Erreur insertion trip_items:', itemsInsertErr);
      // Non bloquant mais tracé
    }
  }

  revalidatePath('/voyages');
  revalidatePath(`/voyages/${slug}`);

  return {
    success: true,
    tripId: tripId ?? null,
    slug,
    output,
  };
}

/**
 * 4. Régénération de l'itinéraire d'un voyage existant (préserve source='user')
 */
export async function regenerateItineraryAction(
  tripId: string
): Promise<{ success: boolean; output: PlannerOutput }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Vous devez être connecté pour régénérer un itinéraire.');
  }

  const trip = await getTripById(tripId, user.id);
  if (!trip) {
    throw new Error('Voyage introuvable.');
  }

  if (!trip.permissions.canEdit) {
    throw new Error('Vous n’avez pas les droits d’édition sur ce voyage.');
  }

  const metadata = (trip.metadata as any) || {};
  const countries: string[] =
    metadata.countries && Array.isArray(metadata.countries) && metadata.countries.length > 0
      ? metadata.countries
      : trip.destination_country_code
      ? [trip.destination_country_code]
      : ['FR'];

  let durationDays = 7;
  if (trip.start_date && trip.end_date) {
    const d1 = new Date(trip.start_date);
    const d2 = new Date(trip.end_date);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)) + 1;
    if (diff > 0) durationDays = diff;
  }

  const result = await generateAndPersistItinerary({
    tripId: trip.id,
    title: trip.title,
    description: trip.description ?? undefined,
    countries,
    destinationName: trip.destination_name ?? undefined,
    startDate: trip.start_date ?? undefined,
    endDate: trip.end_date ?? undefined,
    durationDays,
    pace: metadata.pace || 'standard',
    activityType: trip.primary_activity || 'trekking',
    difficulty: trip.difficulty || 'moderate',
    accommodationType: metadata.accommodation_type || 'bivouac',
    travelersCount: metadata.travelers_count || 1,
    groupType: metadata.group_type || 'solo',
    groupId: trip.group_id,
    publishStatus: trip.status === 'draft' ? 'draft' : 'planned',
  });

  return { success: true, output: result.output };
}
