import 'server-only';

import { createClient } from '@/lib/supabase/server';

/** Défauts sûrs des flags A3/A9 (tous désactivés, aucune activation implicite). */
export const A3_FLAGS: AdventureFeatureFlags = {
  performance_profile_v2: false,
  route_prediction_v2: false,
  collective_intelligence: false,
  terrain_live: false,
};

/**
 * Flags de domaine consommés par les API/cron (A9 + A11, migrations
 * 20260911200000 et 20260911330000). Tous les champs sont toujours présents :
 * une absence de ligne ou une RPC indisponible vaut « désactivé ».
 */
export interface AdventureFeatureFlags {
  performance_profile_v2: boolean;
  route_prediction_v2: boolean;
  collective_intelligence: boolean;
  terrain_live: boolean;
}

function flagsFromRows(data: unknown): AdventureFeatureFlags {
  const byId = new Map(
    Array.isArray(data)
      ? (data as { id: string; enabled: boolean }[]).map((row) => [row.id, row.enabled === true])
      : []
  );
  return {
    performance_profile_v2: byId.get('performance_profile_v2') === true,
    route_prediction_v2: byId.get('route_prediction_v2') === true,
    collective_intelligence: byId.get('collective_intelligence') === true,
    terrain_live: byId.get('terrain_live') === true,
  };
}

/**
 * Lit les flags via RPC SECURITY DEFINER. Avec `userId`, applique les cohortes
 * (`current_feature_flags_for`, migration 20260911330000) ; sans, lit l'état
 * global (`current_feature_flags`). Jamais de throw : repli fail-safe tout
 * désactivé.
 */
export async function currentAdventureFeatureFlags(
  userId?: string
): Promise<AdventureFeatureFlags> {
  try {
    const supabase = await createClient();
    const response = userId
      ? await supabase.rpc('current_feature_flags_for', { p_user_id: userId })
      : await supabase.rpc('current_feature_flags');
    const { data, error } = response;
    if (error) return { ...A3_FLAGS };
    return flagsFromRows(data);
  } catch {
    return { ...A3_FLAGS };
  }
}
