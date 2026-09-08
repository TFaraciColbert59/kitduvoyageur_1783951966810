'use server';

import { tripSegmentPath } from '@/features/trips/registry/tripPaths';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createTrip, getTripById } from '@/lib/queries-trips';
import { emitEvent } from '@/lib/events/eventBus';
import { parseTripGpx } from '@/features/trips/engine/exportEngine';
import { getReusableSegments, insertSegmentIntoTripSteps } from '@/features/trips/engine/segmentEngine';
import {
  saveDraftTripSchema,
  wizardPersistInputSchema,
  type CreateTripInput,
  type SaveDraftTripInput,
  type WizardPersistInput,
} from '@/features/trips/schemas/trip.schema';
import {
  createTripStepSchema,
  updateTripStepSchema,
  reorderTripStepsSchema,
  moveStepSchema,
  insertDaySchema,
  deleteDaySchema,
  duplicateDaySchema,
} from '@/features/trips/planner/planner.schema';
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

  // Émission d'événement sur le bus unifié lkv_events
  await emitEvent({
    event_type: 'trip.created',
    actor_id: user.id,
    entity_type: 'trip',
    entity_id: trip.id,
    visibility: trip.visibility === 'public' ? 'public' : trip.group_id ? 'crew' : 'private',
    crew_id: trip.group_id || null,
    metadata: {
      title: trip.title,
      destination: trip.destination_name || trip.destination_country_code || '',
    },
  });

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
      if (updateErr) console.error('[LKDV trips] updateTrip error:', updateErr);
      throw new Error('Impossible de mettre à jour le voyage.');
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
      if (insertErr) console.error('[LKDV trips] insertTrip error:', insertErr);
      throw new Error('Impossible de créer le voyage.');
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
      throw new Error('Erreur lors de l’enregistrement des étapes.');
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

  // Émission d'événement sur le bus unifié lkv_events
  if (tripId) {
    await emitEvent({
      event_type: validated.tripId ? 'trip.updated' : 'trip.created',
      actor_id: user.id,
      entity_type: 'trip',
      entity_id: tripId,
      visibility: validated.groupId ? 'crew' : 'private',
      crew_id: validated.groupId || null,
      metadata: {
        title: validated.title,
        destination: validated.destinationName || primaryCountry || '',
        daysCount: output.steps?.length || output.total_days || 0,
      },
    });
  }

  revalidatePath('/voyages');
  revalidatePath(tripSegmentPath(slug, ''));

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

/**
 * 5. PLANIFICATEUR D'ITINÉRAIRE (CHANTIER 3)
 */

/**
 * 5.1 Ajouter une étape à un jour donné
 */
export async function addTripStepAction(
  rawInput: unknown
): Promise<{ success: boolean; stepId: string }> {
  const input = createTripStepSchema.parse(rawInput);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Vous devez être connecté pour modifier cet itinéraire.');
  }

  const trip = await getTripById(input.trip_id, user.id);
  if (!trip || !trip.permissions.canEdit) {
    throw new Error('Vous n’avez pas les droits d’édition sur ce voyage.');
  }

  let orderIndex = input.order_index;
  if (orderIndex === undefined || orderIndex === null) {
    const { data: maxStep } = await supabase
      .from('trip_steps')
      .select('order_index')
      .eq('trip_id', input.trip_id)
      .eq('day_number', input.day_number)
      .order('order_index', { ascending: false })
      .limit(1);

    orderIndex = maxStep && maxStep.length > 0 ? maxStep[0].order_index + 1 : 0;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('trip_steps')
    .insert({
      trip_id: input.trip_id,
      day_number: input.day_number,
      order_index: orderIndex,
      title: input.title,
      description: input.description ?? null,
      location_name: input.location_name ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      accommodation_name: input.accommodation_name ?? null,
      transport_mode: input.transport_mode ?? null,
      distance_km: input.distance_km ?? null,
      elevation_gain_m: input.elevation_gain_m ?? null,
      elevation_loss_m: input.elevation_loss_m ?? null,
    })
    .select('id')
    .single();

  if (insertErr || !inserted) {
    if (insertErr) console.error('[LKDV trips] insertStep error:', insertErr);
    throw new Error('Erreur lors de l’ajout de l’étape.');
  }

  revalidatePath(tripSegmentPath(trip.slug, ''));
  revalidatePath(tripSegmentPath(trip.slug, 'itineraire'));

  return { success: true, stepId: inserted.id };
}

/**
 * 5.2 Mettre à jour une étape existante
 */
export async function updateTripStepAction(
  rawInput: unknown
): Promise<{ success: boolean }> {
  const input = updateTripStepSchema.parse(rawInput);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Vous devez être connecté.');
  }

  const trip = await getTripById(input.trip_id, user.id);
  if (!trip || !trip.permissions.canEdit) {
    throw new Error('Vous n’avez pas les droits d’édition sur ce voyage.');
  }

  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.location_name !== undefined) patch.location_name = input.location_name;
  if (input.latitude !== undefined) patch.latitude = input.latitude;
  if (input.longitude !== undefined) patch.longitude = input.longitude;
  if (input.accommodation_name !== undefined) patch.accommodation_name = input.accommodation_name;
  if (input.transport_mode !== undefined) patch.transport_mode = input.transport_mode;
  if (input.distance_km !== undefined) patch.distance_km = input.distance_km;
  if (input.elevation_gain_m !== undefined) patch.elevation_gain_m = input.elevation_gain_m;
  if (input.elevation_loss_m !== undefined) patch.elevation_loss_m = input.elevation_loss_m;
  if (input.day_number !== undefined) patch.day_number = input.day_number;
  if (input.order_index !== undefined) patch.order_index = input.order_index;

  const { error } = await supabase
    .from('trip_steps')
    .update(patch)
    .eq('id', input.step_id)
    .eq('trip_id', input.trip_id);

  if (error) {
    console.error('[LKDV trips] updateTripStep error:', error);
    throw new Error('Erreur lors de la mise à jour de l’étape.');
  }

  revalidatePath(tripSegmentPath(trip.slug, ''));
  revalidatePath(tripSegmentPath(trip.slug, 'itineraire'));

  return { success: true };
}

/**
 * 5.3 Supprimer une étape et retasser les indices
 */
export async function deleteTripStepAction(
  tripId: string,
  stepId: string
): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Vous devez être connecté.');
  }

  const trip = await getTripById(tripId, user.id);
  if (!trip || !trip.permissions.canEdit) {
    throw new Error('Vous n’avez pas les droits d’édition sur ce voyage.');
  }

  // 1. Lire l'étape pour connaître son day_number
  const { data: step, error: readErr } = await supabase
    .from('trip_steps')
    .select('id, day_number, trip_id')
    .eq('id', stepId)
    .single();

  if (readErr || !step) {
    throw new Error('Étape introuvable.');
  }

  // 2. Supprimer l'étape
  const { error: delErr } = await supabase.from('trip_steps').delete().eq('id', stepId);
  if (delErr) {
    console.error('[LKDV trips] deleteTripStep error:', delErr);
    throw new Error('Erreur lors de la suppression de l’étape.');
  }

  // 3. Retasser les order_index des étapes restantes du même jour
  const { data: remaining } = await supabase
    .from('trip_steps')
    .select('id, order_index')
    .eq('trip_id', tripId)
    .eq('day_number', step.day_number)
    .order('order_index', { ascending: true });

  if (remaining && remaining.length > 0) {
    // Phase 1 : indices négatifs
    for (let i = 0; i < remaining.length; i++) {
      await supabase
        .from('trip_steps')
        .update({ order_index: -1000 - i })
        .eq('id', remaining[i].id);
    }
    // Phase 2 : indices 0..N
    for (let i = 0; i < remaining.length; i++) {
      await supabase
        .from('trip_steps')
        .update({ order_index: i })
        .eq('id', remaining[i].id);
    }
  }

  revalidatePath(tripSegmentPath(trip.slug, ''));
  revalidatePath(tripSegmentPath(trip.slug, 'itineraire'));

  return { success: true };
}

/**
 * 5.4 Réordonner les étapes d'un jour (anti-collision d'unicité)
 */
export async function reorderTripStepsAction(
  rawInput: unknown
): Promise<{ success: boolean }> {
  const input = reorderTripStepsSchema.parse(rawInput);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Vous devez être connecté.');
  }

  const trip = await getTripById(input.trip_id, user.id);
  if (!trip || !trip.permissions.canEdit) {
    throw new Error('Vous n’avez pas les droits d’édition sur ce voyage.');
  }

  // Phase 1 : indices temporaires négatifs pour libérer les positions
  for (let i = 0; i < input.step_ids_in_order.length; i++) {
    const id = input.step_ids_in_order[i];
    await supabase
      .from('trip_steps')
      .update({ order_index: -1000 - i })
      .eq('id', id)
      .eq('trip_id', input.trip_id);
  }

  // Phase 2 : indices finaux ordonnés 0, 1, 2...
  for (let i = 0; i < input.step_ids_in_order.length; i++) {
    const id = input.step_ids_in_order[i];
    await supabase
      .from('trip_steps')
      .update({ order_index: i })
      .eq('id', id)
      .eq('trip_id', input.trip_id);
  }

  revalidatePath(tripSegmentPath(trip.slug, ''));
  revalidatePath(tripSegmentPath(trip.slug, 'itineraire'));

  return { success: true };
}

/**
 * 5.5 Déplacer une étape vers un autre jour
 */
export async function moveStepToDayAction(
  rawInput: unknown
): Promise<{ success: boolean }> {
  const input = moveStepSchema.parse(rawInput);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Vous devez être connecté.');
  }

  const trip = await getTripById(input.trip_id, user.id);
  if (!trip || !trip.permissions.canEdit) {
    throw new Error('Vous n’avez pas les droits d’édition sur ce voyage.');
  }

  // 1. Étapes du jour cible
  const { data: targetSteps } = await supabase
    .from('trip_steps')
    .select('id, order_index')
    .eq('trip_id', input.trip_id)
    .eq('day_number', input.to_day_number)
    .order('order_index', { ascending: true });

  const existingTargetIds = (targetSteps || []).map((s) => s.id).filter((id) => id !== input.step_id);

  // Position d'insertion
  let insertAt = input.target_order_index;
  if (insertAt == null || insertAt < 0 || insertAt > existingTargetIds.length) {
    insertAt = existingTargetIds.length;
  }
  existingTargetIds.splice(insertAt, 0, input.step_id);

  // 2. Assigner le nouveau jour et un index temporaire à l'étape déplacée
  await supabase
    .from('trip_steps')
    .update({
      day_number: input.to_day_number,
      order_index: -9999,
    })
    .eq('id', input.step_id)
    .eq('trip_id', input.trip_id);

  // 3. Réindexer le jour cible (indices négatifs puis 0..N)
  for (let i = 0; i < existingTargetIds.length; i++) {
    await supabase
      .from('trip_steps')
      .update({ order_index: -1000 - i })
      .eq('id', existingTargetIds[i]);
  }
  for (let i = 0; i < existingTargetIds.length; i++) {
    await supabase
      .from('trip_steps')
      .update({ order_index: i })
      .eq('id', existingTargetIds[i]);
  }

  // 4. Retasser le jour source si différent
  if (input.from_day_number !== input.to_day_number) {
    const { data: sourceSteps } = await supabase
      .from('trip_steps')
      .select('id, order_index')
      .eq('trip_id', input.trip_id)
      .eq('day_number', input.from_day_number)
      .order('order_index', { ascending: true });

    if (sourceSteps && sourceSteps.length > 0) {
      for (let i = 0; i < sourceSteps.length; i++) {
        await supabase
          .from('trip_steps')
          .update({ order_index: -1000 - i })
          .eq('id', sourceSteps[i].id);
      }
      for (let i = 0; i < sourceSteps.length; i++) {
        await supabase
          .from('trip_steps')
          .update({ order_index: i })
          .eq('id', sourceSteps[i].id);
      }
    }
  }

  revalidatePath(tripSegmentPath(trip.slug, ''));
  revalidatePath(tripSegmentPath(trip.slug, 'itineraire'));

  return { success: true };
}

/**
 * 5.6 Insérer un jour vide (décale tous les jours suivants de +1)
 */
export async function insertDayAction(
  rawInput: unknown
): Promise<{ success: boolean }> {
  const input = insertDaySchema.parse(rawInput);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Vous devez être connecté.');
  }

  const trip = await getTripById(input.trip_id, user.id);
  if (!trip || !trip.permissions.canEdit) {
    throw new Error('Vous n’avez pas les droits d’édition sur ce voyage.');
  }

  // Trouver tous les jours > after_day_number
  const { data: stepsToShift } = await supabase
    .from('trip_steps')
    .select('id, day_number')
    .eq('trip_id', input.trip_id)
    .gt('day_number', input.after_day_number)
    .order('day_number', { ascending: false }); // Ordre décroissant pour éviter les collisions

  if (stepsToShift && stepsToShift.length > 0) {
    // Décalage en ordre décroissant
    for (const step of stepsToShift) {
      await supabase
        .from('trip_steps')
        .update({ day_number: step.day_number + 1 })
        .eq('id', step.id);
    }
  }

  // Si le voyage a des dates précises, décaler la date de fin de +1 jour
  if (trip.end_date) {
    const end = new Date(trip.end_date);
    end.setDate(end.getDate() + 1);
    await supabase
      .from('trips')
      .update({ end_date: end.toISOString().split('T')[0] })
      .eq('id', trip.id);
  }

  revalidatePath(tripSegmentPath(trip.slug, ''));
  revalidatePath(tripSegmentPath(trip.slug, 'itineraire'));

  return { success: true };
}

/**
 * 5.7 Supprimer un jour (décale tous les jours suivants de -1)
 */
export async function deleteDayAction(
  rawInput: unknown
): Promise<{ success: boolean }> {
  const input = deleteDaySchema.parse(rawInput);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Vous devez être connecté.');
  }

  const trip = await getTripById(input.trip_id, user.id);
  if (!trip || !trip.permissions.canEdit) {
    throw new Error('Vous n’avez pas les droits d’édition sur ce voyage.');
  }

  // 1. Vérifier si le jour contient des étapes
  const { data: daySteps } = await supabase
    .from('trip_steps')
    .select('id')
    .eq('trip_id', input.trip_id)
    .eq('day_number', input.day_number);

  if (daySteps && daySteps.length > 0) {
    if (!input.cascade_steps) {
      throw new Error(
        'Cette journée contient des étapes. Confirmez la suppression pour les supprimer.'
      );
    }
    await supabase
      .from('trip_steps')
      .delete()
      .eq('trip_id', input.trip_id)
      .eq('day_number', input.day_number);
  }

  // 2. Décaler tous les jours suivants de -1 (dans l'ordre croissant)
  const { data: stepsToShift } = await supabase
    .from('trip_steps')
    .select('id, day_number')
    .eq('trip_id', input.trip_id)
    .gt('day_number', input.day_number)
    .order('day_number', { ascending: true });

  if (stepsToShift && stepsToShift.length > 0) {
    for (const step of stepsToShift) {
      await supabase
        .from('trip_steps')
        .update({ day_number: step.day_number - 1 })
        .eq('id', step.id);
    }
  }

  // Si le voyage a des dates précises, ajuster end_date si plus d'un jour
  if (trip.end_date && trip.start_date && trip.end_date > trip.start_date) {
    const end = new Date(trip.end_date);
    end.setDate(end.getDate() - 1);
    await supabase
      .from('trips')
      .update({ end_date: end.toISOString().split('T')[0] })
      .eq('id', trip.id);
  }

  revalidatePath(tripSegmentPath(trip.slug, ''));
  revalidatePath(tripSegmentPath(trip.slug, 'itineraire'));

  return { success: true };
}

/**
 * 5.8 Dupliquer un jour (insère un jour et copie ses étapes)
 */
export async function duplicateDayAction(
  rawInput: unknown
): Promise<{ success: boolean }> {
  const input = duplicateDaySchema.parse(rawInput);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Vous devez être connecté.');
  }

  const trip = await getTripById(input.trip_id, user.id);
  if (!trip || !trip.permissions.canEdit) {
    throw new Error('Vous n’avez pas les droits d’édition sur ce voyage.');
  }

  // 1. Décaler tous les jours > day_number
  const { data: stepsToShift } = await supabase
    .from('trip_steps')
    .select('id, day_number')
    .eq('trip_id', input.trip_id)
    .gt('day_number', input.day_number)
    .order('day_number', { ascending: false });

  if (stepsToShift && stepsToShift.length > 0) {
    for (const step of stepsToShift) {
      await supabase
        .from('trip_steps')
        .update({ day_number: step.day_number + 1 })
        .eq('id', step.id);
    }
  }

  // 2. Copier les étapes du jour source vers day_number + 1
  const { data: sourceSteps } = await supabase
    .from('trip_steps')
    .select('*')
    .eq('trip_id', input.trip_id)
    .eq('day_number', input.day_number)
    .order('order_index', { ascending: true });

  if (sourceSteps && sourceSteps.length > 0) {
    const duplicates = sourceSteps.map((s) => ({
      trip_id: input.trip_id,
      day_number: input.day_number + 1,
      order_index: s.order_index,
      title: `${s.title} (copie)`,
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

    await supabase.from('trip_steps').insert(duplicates);
  }

  // 3. Ajuster end_date si existante
  if (trip.end_date) {
    const end = new Date(trip.end_date);
    end.setDate(end.getDate() + 1);
    await supabase
      .from('trips')
      .update({ end_date: end.toISOString().split('T')[0] })
      .eq('id', trip.id);
  }

  revalidatePath(tripSegmentPath(trip.slug, ''));
  revalidatePath(tripSegmentPath(trip.slug, 'itineraire'));

  return { success: true };
}

/**
 * Enregistre le changement de phase d'un voyage sur le bus d'événements
 */
export async function recordTripPhaseChangeAction(
  tripId: string,
  newPhase: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Connexion requise' };
  }

  const { data: trip, error } = await supabase
    .from('trips')
    .select('id, title, group_id, visibility')
    .eq('id', tripId)
    .single();

  if (error || !trip) {
    return { success: false, error: 'Voyage introuvable' };
  }

  await emitEvent({
    event_type: 'trip.phase_changed',
    actor_id: user.id,
    entity_type: 'trip',
    entity_id: tripId,
    visibility: trip.visibility === 'public' ? 'public' : trip.group_id ? 'crew' : 'private',
    crew_id: trip.group_id || null,
    metadata: {
      phase: newPhase,
      title: trip.title,
    },
  });

  return { success: true };
}

/**
 * 11. Importe une trace GPX 1.1 certifiée dans un voyage existant
 */
export async function importGpxToTripAction(
  tripId: string,
  gpxContent: string
): Promise<{ success: boolean; importedCount: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, importedCount: 0, error: 'Connexion requise.' };
  }

  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('id, slug, title, group_id, visibility')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) {
    return { success: false, importedCount: 0, error: 'Voyage introuvable.' };
  }

  const parsed = parseTripGpx(gpxContent);
  if (!parsed.isValid || parsed.suggestedSteps.length === 0) {
    return {
      success: false,
      importedCount: 0,
      error: 'Format GPX invalide ou aucun waypoint/trace exploitable détecté.',
    };
  }

  // Trouver le dernier numéro de jour actuel
  const { data: existingSteps } = await supabase
    .from('trip_steps')
    .select('day_number')
    .eq('trip_id', tripId)
    .order('day_number', { ascending: false })
    .limit(1);

  const startDay = (existingSteps && existingSteps.length > 0 ? existingSteps[0].day_number : 0) + 1;

  const payload = parsed.suggestedSteps.map((step, idx) => ({
    trip_id: tripId,
    day_number: startDay + idx,
    order_index: 0,
    title: step.title,
    description: step.description || null,
    location_name: step.title,
    latitude: step.latitude,
    longitude: step.longitude,
    elevation_gain_m: step.elevation_gain_m || null,
    elevation_loss_m: step.elevation_loss_m || null,
    distance_km: step.distance_km || null,
    transport_mode: 'foot',
  }));

  const { error: insertErr } = await supabase.from('trip_steps').insert(payload);
  if (insertErr) {
    console.error('[LKDV trips] importGPXAction insert error:', insertErr);
    return { success: false, importedCount: 0, error: 'Impossible d’importer les étapes du tracé GPX.' };
  }

  await emitEvent({
    event_type: 'trip.updated',
    actor_id: user.id,
    entity_type: 'trip',
    entity_id: tripId,
    visibility: trip.visibility === 'public' ? 'public' : trip.group_id ? 'crew' : 'private',
    crew_id: trip.group_id || null,
    metadata: {
      action: 'gpx_imported',
      title: trip.title,
      importedStepsCount: payload.length,
      gpxTitle: parsed.title,
    },
  });

  revalidatePath(tripSegmentPath(trip.slug, ''));
  revalidatePath(tripSegmentPath(trip.slug, 'itineraire'));
  return { success: true, importedCount: payload.length };
}

/**
 * 12. Insère un tronçon d'itinéraire réutilisable certifié dans un voyage
 */
export async function insertSegmentToTripAction(
  tripId: string,
  segmentId: string,
  targetDayNumber: number
): Promise<{ success: boolean; insertedCount: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, insertedCount: 0, error: 'Connexion requise.' };
  }

  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('id, slug, title, group_id, visibility')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) {
    return { success: false, insertedCount: 0, error: 'Voyage introuvable.' };
  }

  const segment = getReusableSegments().find((s) => s.id === segmentId);
  if (!segment) {
    return { success: false, insertedCount: 0, error: 'Tronçon réutilisable introuvable.' };
  }

  // Récupérer les étapes existantes
  const { data: existingSteps } = await supabase
    .from('trip_steps')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number', { ascending: true })
    .order('order_index', { ascending: true });

  const updatedSteps = insertSegmentIntoTripSteps(existingSteps || [], segment, targetDayNumber);

  // Supprimer les étapes et réinsérer les étapes ordonnées
  await supabase.from('trip_steps').delete().eq('trip_id', tripId);

  const payload = updatedSteps.map((s, idx) => ({
    trip_id: tripId,
    day_number: s.day_number,
    order_index: s.order_index ?? idx,
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

  const { error: insertErr } = await supabase.from('trip_steps').insert(payload);
  if (insertErr) {
    console.error('[LKDV trips] insertSegmentToTripAction error:', insertErr);
    return { success: false, insertedCount: 0, error: 'Impossible d’insérer le tronçon dans le voyage.' };
  }

  await emitEvent({
    event_type: 'trip.updated',
    actor_id: user.id,
    entity_type: 'trip',
    entity_id: tripId,
    visibility: trip.visibility === 'public' ? 'public' : trip.group_id ? 'crew' : 'private',
    crew_id: trip.group_id || null,
    metadata: {
      action: 'segment_inserted',
      title: trip.title,
      segmentTitle: segment.title,
      insertedStepsCount: segment.steps.length,
    },
  });

  revalidatePath(tripSegmentPath(trip.slug, ''));
  revalidatePath(tripSegmentPath(trip.slug, 'itineraire'));
  return { success: true, insertedCount: segment.steps.length };
}

