'use server';

import { createClient } from '@/lib/supabase/server';

export type TripLifecycleState =
  | 'draft'
  | 'planned'
  | 'ready'
  | 'active'
  | 'paused'
  | 'completed'
  | 'recount'
  | 'cancelled';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATES = new Set<TripLifecycleState>([
  'draft', 'planned', 'ready', 'active', 'paused', 'completed', 'recount', 'cancelled',
]);

export type LifecycleTransitionResult =
  | { ok: true; fromState: string; toState: TripLifecycleState; occurredAt: string }
  | { ok: false; message: string };

export async function transitionHubTripLifecycle(input: {
  tripId: string;
  toState: TripLifecycleState;
  operationId: string;
  note?: string;
}): Promise<LifecycleTransitionResult> {
  if (!UUID.test(input.tripId) || !UUID.test(input.operationId)) {
    return { ok: false, message: 'Identifiant de voyage ou d’opération invalide.' };
  }
  if (!VALID_STATES.has(input.toState)) {
    return { ok: false, message: 'État du cycle de vie invalide.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Connexion requise.' };

  const { data, error } = await supabase.rpc('transition_trip_lifecycle', {
    p_trip_id: input.tripId,
    p_to_state: input.toState,
    p_operation_id: input.operationId,
    p_note: input.note?.trim().slice(0, 500) || null,
  });

  if (error || !data) {
    return {
      ok: false,
      message: error?.code === '42501'
        ? 'Droits insuffisants pour modifier l’état du voyage.'
        : error?.code === '40001'
          ? 'Cette opération a déjà été utilisée pour un autre état.'
          : 'Impossible de mettre à jour l’état du voyage.',
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    fromState: String(row.from_state ?? ''),
    toState: row.to_state as TripLifecycleState,
    occurredAt: String(row.occurred_at ?? new Date().toISOString()),
  };
}
