import 'server-only';

import type { createClient } from '@/lib/supabase/server';
import type { ConnectorConsentPurpose } from '@/features/connectors';
import { getConnectorSession } from './serverStore';

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface ConsentRow {
  purpose: string;
  granted: boolean | null;
  policy_version: string | null;
}

const KNOWN_PURPOSES: readonly ConnectorConsentPurpose[] = [
  'personal_performance',
  'collective_terrain',
  'live_location',
  'group_location',
  'external_readiness',
];

/**
 * Hydrate les finalités P01 depuis `adventure_data_consents` (source de vérité
 * RGPD existante) au lieu de supposer un consentement par défaut.
 * Toute erreur laisse le snapshot en l'état : fail-closed, jamais fail-open.
 */
export async function hydrateConnectorConsentFromDb(userId: string, supabase: Supabase): Promise<void> {
  try {
    if (!supabase || typeof supabase.from !== 'function') return;
    const { data, error } = await supabase
      .from('adventure_data_consents')
      .select('purpose,granted,policy_version')
      .eq('user_id', userId);

    if (error || !Array.isArray(data)) return;

    const purposes: Partial<Record<ConnectorConsentPurpose, boolean>> = {};
    let policyVersion: string | null = null;
    for (const row of data as ConsentRow[]) {
      if (!KNOWN_PURPOSES.includes(row.purpose as ConnectorConsentPurpose)) continue;
      // `external_readiness` reste structurellement désactivé en Phase 1.
      purposes[row.purpose as ConnectorConsentPurpose] =
        row.purpose === 'external_readiness' ? false : row.granted === true;
      if (row.policy_version) policyVersion = row.policy_version;
    }

    const session = getConnectorSession(userId);
    session.snapshot = {
      ...session.snapshot,
      purposes,
      policyVersion: policyVersion ?? session.snapshot.policyVersion,
    };
  } catch {
    // Base indisponible : on conserve le snapshot courant (fail-closed).
  }
}
