/**
 * Phase 8 — Idempotence des événements Stripe (`public.stripe_events`).
 *
 * Chaque événement vérifié est réservé via un INSERT à clé primaire
 * (`event_id`). Une livraison dupliquée (retry Stripe, double livraison)
 * rencontre la violation d'unicité 23505 et n'est jamais retraitée.
 *
 * En cas d'échec de traitement, la réservation est supprimée pour que le retry
 * Stripe puisse reprendre l'événement — jamais de perte silencieuse.
 * Aucun appel réseau ici : uniquement le client Supabase service_role injecté.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizeStripeEvent, type StripeEventLike } from './events';

export const STRIPE_EVENTS_TABLE = 'stripe_events';

export interface BeginStripeEventResult {
  /** Vrai si c'est la première livraison (réservation acquise). */
  firstDelivery: boolean;
  eventId: string;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return 'erreur supabase inconnue';
}

function errorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/**
 * Réserve l'événement. `firstDelivery: false` (doublon) ne lève jamais ;
 * une erreur d'infrastructure (hors 23505) est propagée à l'appelant.
 */
export async function beginStripeEvent(
  client: SupabaseClient,
  event: StripeEventLike
): Promise<BeginStripeEventResult> {
  const summary = summarizeStripeEvent(event);
  const { data, error } = await client
    .from(STRIPE_EVENTS_TABLE)
    .insert({
      event_id: summary.eventId,
      type: summary.type,
      kind: summary.kind,
      livemode: summary.livemode,
      object_id: summary.objectId,
      status: 'processing',
    })
    .select('event_id')
    .maybeSingle();

  if (error) {
    if (errorCode(error) === '23505') {
      return { firstDelivery: false, eventId: summary.eventId };
    }
    throw new Error(`stripe_events: réservation impossible — ${errorMessage(error)}`);
  }

  return {
    firstDelivery: data?.event_id === summary.eventId,
    eventId: summary.eventId,
  };
}

/** Marque l'événement comme traité (idempotent). */
export async function markStripeEventProcessed(
  client: SupabaseClient,
  eventId: string
): Promise<void> {
  const { error } = await client
    .from(STRIPE_EVENTS_TABLE)
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('event_id', eventId);
  if (error) {
    throw new Error(`stripe_events: marquage impossible — ${errorMessage(error)}`);
  }
}

/**
 * Libère la réservation après échec pour autoriser le retry Stripe.
 * Best-effort : ne jette jamais (l'échec initial reste prioritaire).
 */
export async function releaseStripeEvent(
  client: SupabaseClient,
  eventId: string
): Promise<void> {
  try {
    const { error } = await client
      .from(STRIPE_EVENTS_TABLE)
      .delete()
      .eq('event_id', eventId);
    if (error) {
      console.error('⚠️ stripe_events: libération impossible', errorMessage(error));
    }
  } catch (error) {
    console.error('⚠️ stripe_events: libération impossible', errorMessage(error));
  }
}
