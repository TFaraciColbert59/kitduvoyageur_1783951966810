'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  selectRerouteCandidate,
  type RerouteCandidate,
} from '../domain/reroute';

/**
 * Phase 6 — Reroutage réel d'un plan : cherche des parcours NAVIGABLES réels
 * (`phase3_search_navigable_routes`, même prédicat géométrique que
 * `phase3_route_navigable`), les revérifie un à un, puis sélectionne via la
 * commande canonique `select_adventure_plan_route` (SECURITY DEFINER, propriété
 * vérifiée en base). Aucune estimation, aucune géométrie synthétique : un plan
 * sans candidat navigable retourne une erreur explicite, jamais un faux tracé.
 */
export interface RerouteAdventurePlanRouteInput {
  planId: string;
  lat: number;
  lng: number;
  radiusKm?: number;
  terms?: string[];
  /** Parcours courant : jamais reproposé comme alternative. */
  excludeRouteId?: number;
  correlationId?: string;
}

export const rerouteAdventurePlanRouteSchema = z.object({
  planId: z.string().uuid('planId doit être un UUID'),
  lat: z
    .number()
    .min(-90, 'lat doit être compris entre -90 et 90')
    .max(90, 'lat doit être compris entre -90 et 90'),
  lng: z
    .number()
    .min(-180, 'lng doit être compris entre -180 et 180')
    .max(180, 'lng doit être compris entre -180 et 180'),
  radiusKm: z.number().min(1).max(500).optional(),
  terms: z
    .array(z.string().min(3, 'un terme doit contenir au moins 3 caractères').max(80))
    .max(5, '5 termes maximum')
    .optional(),
  excludeRouteId: z.number().int().positive().optional(),
  correlationId: z.string().uuid('correlationId doit être un UUID').optional(),
});

export type RerouteAdventurePlanRouteResult =
  | {
      ok: true;
      planId: string;
      routeId: number;
      distanceM: number | null;
      correlationId: string;
      tripId: string | null;
    }
  | { ok: false; status: 400 | 401 | 403 | 404 | 500; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Lignes RPC → candidats typés (les invalides sont écartées, jamais devinées). */
export function parseRerouteCandidates(data: unknown): RerouteCandidate[] {
  if (!Array.isArray(data)) return [];
  const candidates: RerouteCandidate[] = [];
  for (const row of data) {
    const record = asRecord(row);
    if (!record) continue;
    const routeId = Number(record.route_id);
    const distanceM = record.distance_m == null ? null : Number(record.distance_m);
    const matchCount = Number(record.match_count ?? 0);
    candidates.push({
      routeId: Number.isInteger(routeId) ? routeId : -1,
      distanceM: distanceM != null && Number.isFinite(distanceM) ? distanceM : null,
      matchCount: Number.isFinite(matchCount) ? matchCount : 0,
    });
  }
  return candidates;
}

function mapSelectRpcError(message: string): { status: 400 | 401 | 403 | 500; error: string } {
  if (/authentification requise/.test(message)) {
    return { status: 401, error: 'Authentification requise.' };
  }
  if (/non détenu/.test(message)) {
    return { status: 403, error: 'Ce plan ne vous appartient pas.' };
  }
  if (/sans géométrie navigable/.test(message)) {
    return { status: 400, error: 'Ce parcours n’a pas de géométrie navigable vérifiée.' };
  }
  if (/introuvable|obligatoire/.test(message)) {
    return { status: 400, error: 'Plan ou parcours introuvable.' };
  }
  return { status: 500, error: 'Erreur lors du reroutage.' };
}

export async function rerouteAdventurePlanRoute(
  input: RerouteAdventurePlanRouteInput
): Promise<RerouteAdventurePlanRouteResult> {
  const parsed = rerouteAdventurePlanRouteSchema.safeParse(input);
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

    const { data: searchData, error: searchError } = await supabase.rpc(
      'phase3_search_navigable_routes',
      {
        p_lat: parsed.data.lat,
        p_lng: parsed.data.lng,
        p_radius_km: parsed.data.radiusKm ?? 50,
        p_terms: parsed.data.terms ?? null,
        p_limit: 3,
      }
    );
    if (searchError) {
      return { ok: false, ...mapSelectRpcError(searchError.message) };
    }

    let candidates = parseRerouteCandidates(searchData);
    const excludeRouteId = parsed.data.excludeRouteId ?? null;
    let chosen = selectRerouteCandidate(candidates, { excludeRouteId });

    // Revérification individuelle : le prédicat de navigabilité exact, jamais
    // celui d'une estimation. Un candidat qui échoue est écarté, on essaie le suivant.
    while (chosen) {
      const { data: navigable, error: navigableError } = await supabase.rpc(
        'phase3_route_navigable',
        { p_route_id: chosen.routeId }
      );
      if (navigableError) {
        return { ok: false, ...mapSelectRpcError(navigableError.message) };
      }
      if (navigable === true) break;
      candidates = candidates.filter((candidate) => candidate.routeId !== chosen!.routeId);
      chosen = selectRerouteCandidate(candidates, { excludeRouteId });
    }

    if (!chosen) {
      return {
        ok: false,
        status: 404,
        error: 'Aucun parcours navigable alternatif trouvé autour de cette position.',
      };
    }

    const correlationId = parsed.data.correlationId ?? randomUUID();
    const { data: selectData, error: selectError } = await supabase.rpc(
      'select_adventure_plan_route',
      {
        p_plan_id: parsed.data.planId,
        p_route_id: chosen.routeId,
        p_correlation_id: correlationId,
      }
    );
    if (selectError) {
      return { ok: false, ...mapSelectRpcError(selectError.message) };
    }

    const payload = asRecord(selectData) ?? {};
    const selectedRouteId = Number(payload.selected_route_id);
    if (!Number.isFinite(selectedRouteId)) {
      return { ok: false, status: 500, error: 'Réponse de reroutage invalide.' };
    }

    revalidatePath('/hub', 'page');
    revalidatePath('/hub/itineraire', 'page');
    return {
      ok: true,
      planId: String(payload.plan_id ?? parsed.data.planId),
      routeId: selectedRouteId,
      distanceM: chosen.distanceM,
      correlationId: String(payload.correlation_id ?? correlationId),
      tripId: payload.trip_id == null ? null : String(payload.trip_id),
    };
  } catch (error) {
    console.error('[LKDV adventure] rerouteAdventurePlanRoute error:', error);
    return { ok: false, status: 500, error: 'Erreur serveur.' };
  }
}
