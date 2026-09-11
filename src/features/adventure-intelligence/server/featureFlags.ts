import 'server-only';

import { createClient } from '@/lib/supabase/server';

/** Défauts sûrs des flags A3 (migration 20260911150000, tous désactivés). */
export const A3_FLAGS = {
  performance_profile_v2: false,
  route_prediction_v2: false,
};

/**
 * Flags de domaine consommés par les API/cron (A9, migration 20260911200000).
 * `collective_intelligence`/`terrain_live` restent `undefined` si la RPC ne les
 * renvoie pas : les consommateurs les traitent comme désactivés (`!== true`).
 */
export interface AdventureFeatureFlags {
  performance_profile_v2: boolean;
  route_prediction_v2: boolean;
  collective_intelligence?: boolean;
  terrain_live?: boolean;
}

/**
 * Lit les flags via la RPC `current_feature_flags()` (SECURITY DEFINER).
 * Jamais de throw : repli fail-safe sur `A3_FLAGS` (A3 désactivés, flags A9
 * absents ⇒ traités comme désactivés par les consommateurs).
 */
export async function currentAdventureFeatureFlags(): Promise<AdventureFeatureFlags> {
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
      collective_intelligence: byId.get('collective_intelligence'),
      terrain_live: byId.get('terrain_live'),
    };
  } catch {
    return { ...A3_FLAGS };
  }
}
