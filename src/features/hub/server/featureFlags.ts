import 'server-only';

import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { FeatureFlags } from '../engine/hubNature';

/** Défauts sûrs = seeds de la migration H4.2 (source fallback). */
export const DEFAULT_FLAGS: FeatureFlags = {
  hub_all_enabled: true,
  hub_possession_enabled: false,
  hub_sortie_enabled: false,
  hub_collectif_enabled: false,
  explorer_unified_map_enabled: false,
  explorer_v2_enabled: false,
  hub_camp_v1: true,
  updatedAt: 0,
  source: 'fallback',
};

/**
 * En environnement local / CI E2E uniquement (jamais sur Vercel production),
 * permet au cookie `lkv_ff_hub_camp_v1=1|0` de basculer `hub_camp_v1` afin de
 * vérifier en tests E2E les deux chemins (`flag off` vs `flag on`, critère I-05).
 */
async function readLocalHubCampOverride(): Promise<boolean | undefined> {
  if (process.env.VERCEL_ENV === 'production') {
    return undefined;
  }
  // Essai sur appareil via un serveur local (`LKDV_LOCAL_HUB_CAMP=1 next start`) : la
  // WebView native n'a pas de moyen de poser le cookie ci-dessous. Opt-in explicite,
  // inopérant tant que la variable n'est pas définie et jamais honoré en production Vercel.
  if (process.env.LKDV_LOCAL_HUB_CAMP === '1') return true;
  if (process.env.LKDV_LOCAL_HUB_CAMP === '0') return false;

  try {
    const headerStore = await headers();
    const host = (headerStore.get('host') || '').split(':')[0];
    const isLocalHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '' ||
      process.env.NODE_ENV !== 'production';
    if (!isLocalHost) return undefined;

    const cookieStore = await cookies();
    const raw = cookieStore.get('lkv_ff_hub_camp_v1')?.value;
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    // Sur simulateur ou appareil mobile local (ex. iPhone / WebView native), activer par défaut
    return true;
  } catch {
    return undefined;
  }
}

/**
 * H4.2 — Lit les feature flags via RPC `current_feature_flags()`
 * (SECURITY DEFINER, table RLS SELECT authenticated).
 * ATLAS Phase 7 : si une session est présente, lit `current_feature_flags_for`
 * pour appliquer les cohortes de rollout (5 %/25 %…) ; sinon flags globaux.
 * Jamais de throw : repli sur DEFAULT_FLAGS si table absente / RPC manquant.
 */
export async function currentFeatureFlags(): Promise<FeatureFlags> {
  const localCampOverride = await readLocalHubCampOverride();

  try {
    const supabase = await createClient();

    let rpcName = 'current_feature_flags';
    let rpcParams: Record<string, unknown> = {};
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        rpcName = 'current_feature_flags_for';
        rpcParams = { p_user_id: authData.user.id };
      }
    } catch {
      // pas de session (anonyme) → flags globaux
    }

    const { data, error } = await supabase.rpc(rpcName, rpcParams);
    if (error || !Array.isArray(data)) {
      return localCampOverride === undefined
        ? DEFAULT_FLAGS
        : { ...DEFAULT_FLAGS, hub_camp_v1: localCampOverride };
    }
    const byId = new Map((data as { id: string; enabled: boolean }[]).map((r) => [r.id, r.enabled]));
    return {
      hub_all_enabled: byId.get('hub_all_enabled') ?? true,
      hub_possession_enabled: byId.get('hub_possession_enabled') ?? false,
      hub_sortie_enabled: byId.get('hub_sortie_enabled') ?? false,
      hub_collectif_enabled: byId.get('hub_collectif_enabled') ?? false,
      explorer_unified_map_enabled: byId.get('explorer_unified_map_enabled') ?? false,
      explorer_v2_enabled: byId.get('explorer_v2_enabled') ?? false,
      hub_camp_v1: localCampOverride ?? byId.get('hub_camp_v1') ?? false,
      updatedAt: Date.now(),
      source: 'rpc',
    };
  } catch {
    return localCampOverride === undefined
      ? DEFAULT_FLAGS
      : { ...DEFAULT_FLAGS, hub_camp_v1: localCampOverride };
  }
}
