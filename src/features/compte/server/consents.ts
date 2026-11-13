import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CONSENT_POLICY_VERSION,
  CONSENT_PURPOSES,
  DISABLED_CONSENT_PURPOSES,
  listConsentsForUser,
  type ConsentPurpose,
  type ConsentRow,
} from '@/features/adventure-intelligence/server/consents';
import {
  CONSENT_PROVIDER_DEFINITIONS,
  CONSENT_USAGE_COPY,
  type ConsentProviderState,
  type ConsentSettingsPayload,
  type ConsentUsageState,
} from '../domain/consentSettings';

const PROVIDER_REASON =
  'Aucun contrat de connexion par fournisseur (compte, jeton, portées) n’existe. Aucune connexion ni aucun consentement fournisseur n’est simulé.';

function isKnownPurpose(value: string): value is ConsentPurpose {
  return CONSENT_PURPOSES.some((purpose) => purpose === value);
}

function isNewer(row: ConsentRow, current: ConsentRow | undefined): boolean {
  if (!current) return true;
  if (row.policy_version !== current.policy_version) {
    return row.policy_version > current.policy_version;
  }
  return row.updated_at > current.updated_at;
}

/**
 * Charge l'état réel des consentements par usage et la liste des fournisseurs
 * dépendants. Aucune lecture de connecteur, aucun jeton, aucune donnée de
 * santé : le contrat existant s'arrête aux finalités.
 */
export async function loadConsentSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<ConsentSettingsPayload> {
  const rows = await listConsentsForUser(supabase, userId, { onError: 'throw' });
  const latest = new Map<ConsentPurpose, ConsentRow>();

  for (const row of rows) {
    if (!isKnownPurpose(row.purpose)) continue;
    if (isNewer(row, latest.get(row.purpose))) {
      latest.set(row.purpose, row);
    }
  }

  const purposes: ConsentUsageState[] = CONSENT_PURPOSES.map((purpose): ConsentUsageState => {
    const copy = CONSENT_USAGE_COPY[purpose];
    const row = latest.get(purpose);
    const disabled = DISABLED_CONSENT_PURPOSES.includes(purpose);
    return {
      ...copy,
      granted: !disabled && row?.granted === true && row.revoked_at === null,
      disabled,
      policyVersion: row?.policy_version ?? null,
      grantedAt: row?.granted_at ?? null,
      revokedAt: row?.revoked_at ?? null,
    };
  });

  const providers: ConsentProviderState[] = CONSENT_PROVIDER_DEFINITIONS.map(
    (provider): ConsentProviderState => ({
      ...provider,
      connected: false,
      revocable: false,
      status: 'contract_missing',
      reason:
        provider.kind === 'health'
          ? 'Aucun connecteur santé réel n’est livré et la finalité « Données de santé » est désactivée par le contrat.'
          : PROVIDER_REASON,
    })
  );

  return {
    purposes,
    providers,
    policyVersion: CONSENT_POLICY_VERSION,
    externalReadinessDisabled: true,
    fetchedAt: new Date().toISOString(),
  };
}
