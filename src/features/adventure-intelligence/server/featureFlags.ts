import 'server-only';

import { createClient } from '@/lib/supabase/server';

/** Défauts sûrs des flags A3 (migration 20260911150000, tous désactivés). */
export const A3_FLAGS = {
  performance_profile_v2: false,
  route_prediction_v2: false,
};

/**
 * Lit les flags A3 via la RPC `current_feature_flags()` (SECURITY DEFINER).
 * Jamais de throw : repli fail-safe sur `A3_FLAGS` (tout désactivé).
 */
export async function currentAdventureFeatureFlags(): Promise<typeof A3_FLAGS> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('current_feature_flags');
    if (error || !Array.isArray(data)) return { ...A3_FLAGS };

    const byId = new Map(
      (data as { id: string; enabled: boolean }[]).map((row) => [row.id, row.enabled])
    );

    return {
      performance_profile_v2: byId.get('performance_profile_v2') ?? false,
      route_prediction_v2: byId.get('route_prediction_v2') ?? false,
    };
  } catch {
    return { ...A3_FLAGS };
  }
}
