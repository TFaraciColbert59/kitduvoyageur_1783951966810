import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { FeatureFlags } from '../engine/hubNature';

/** Défauts sûrs = seeds de la migration H4.2 (source fallback). */
export const DEFAULT_FLAGS: FeatureFlags = {
  hub_all_enabled: true,
  hub_possession_enabled: false,
  hub_sortie_enabled: false,
  hub_collectif_enabled: false,
  updatedAt: 0,
  source: 'fallback',
};

/**
 * H4.2 — Lit les feature flags via RPC `current_feature_flags()`
 * (SECURITY DEFINER, table RLS SELECT authenticated).
 * Jamais de throw : repli sur DEFAULT_FLAGS si table absente / RPC manquant.
 */
export async function currentFeatureFlags(): Promise<FeatureFlags> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('current_feature_flags');
    if (error || !Array.isArray(data)) return DEFAULT_FLAGS;
    const byId = new Map((data as { id: string; enabled: boolean }[]).map((r) => [r.id, r.enabled]));
    return {
      hub_all_enabled: byId.get('hub_all_enabled') ?? true,
      hub_possession_enabled: byId.get('hub_possession_enabled') ?? false,
      hub_sortie_enabled: byId.get('hub_sortie_enabled') ?? false,
      hub_collectif_enabled: byId.get('hub_collectif_enabled') ?? false,
      updatedAt: Date.now(),
      source: 'rpc',
    };
  } catch {
    return DEFAULT_FLAGS;
  }
}
