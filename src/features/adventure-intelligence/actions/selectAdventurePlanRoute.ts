'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 2 — commande canonique de sélection du parcours réel d'un plan.
 * Zod, session requise, RPC `select_adventure_plan_route` (SECURITY DEFINER,
 * propriété du plan vérifiée en base), `correlation_id` fourni ou généré
 * côté serveur pour que toute sélection reparte corrélée.
 */
export interface SelectAdventurePlanRouteInput {
  planId: string;
  routeId: number | string;
  correlationId?: string;
}

export const selectAdventurePlanRouteSchema = z.object({
  planId: z.string().uuid('planId doit être un UUID'),
  routeId: z.coerce
    .number()
    .int('routeId doit être un entier')
    .positive('routeId doit être positif'),
  correlationId: z.string().uuid('correlationId doit être un UUID').optional(),
});

export type SelectAdventurePlanRouteResult =
  | {
      ok: true;
      planId: string;
      selectedRouteId: number;
      correlationId: string;
      tripId: string | null;
    }
  | { ok: false; status: 400 | 401 | 403 | 500; error: string };

function mapRpcError(message: string): { status: 400 | 401 | 403 | 500; error: string } {
  if (/authentification requise/.test(message)) {
    return { status: 401, error: 'Authentification requise.' };
  }
  if (/non détenu/.test(message)) {
    return { status: 403, error: 'Ce plan ne vous appartient pas.' };
  }
  if (/sans géométrie navigable/.test(message)) {
    return {
      status: 400,
      error: 'Ce parcours n’a pas de géométrie navigable vérifiée.',
    };
  }
  if (/introuvable|obligatoire/.test(message)) {
    return { status: 400, error: 'Plan ou parcours introuvable.' };
  }
  return { status: 500, error: 'Erreur lors de la sélection du parcours.' };
}

export async function selectAdventurePlanRoute(
  input: SelectAdventurePlanRouteInput
): Promise<SelectAdventurePlanRouteResult> {
  const parsed = selectAdventurePlanRouteSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    return { ok: false, status: 400, error: `Paramètres invalides : ${fields}` };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, status: 401, error: 'Authentification requise.' };
    }

    const correlationId = parsed.data.correlationId ?? randomUUID();
    const { data, error } = await supabase.rpc('select_adventure_plan_route', {
      p_plan_id: parsed.data.planId,
      p_route_id: parsed.data.routeId,
      p_correlation_id: correlationId,
    });

    if (error) {
      return { ok: false, ...mapRpcError(error.message) };
    }

    const payload = (data ?? {}) as Record<string, unknown>;
    const selectedRouteId = Number(payload.selected_route_id);
    if (!Number.isFinite(selectedRouteId)) {
      return { ok: false, status: 500, error: 'Réponse de sélection invalide.' };
    }

    revalidatePath('/hub', 'page');
    revalidatePath('/hub/itineraire', 'page');
    return {
      ok: true,
      planId: String(payload.plan_id ?? parsed.data.planId),
      selectedRouteId,
      correlationId: String(payload.correlation_id ?? correlationId),
      tripId: payload.trip_id == null ? null : String(payload.trip_id),
    };
  } catch (error) {
    console.error('[LKDV adventure] selectAdventurePlanRoute error:', error);
    return { ok: false, status: 500, error: 'Erreur serveur.' };
  }
}
