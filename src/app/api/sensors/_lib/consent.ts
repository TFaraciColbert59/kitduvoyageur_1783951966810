/**
 * Lot D02 (P01 / S6.16) — normalisation serveur du consentement Santé.
 *
 * Le contrat `src/features/sensors` reste la seule source des règles
 * (scopes, politique, transitions). Ce module ne fait que valider l'entrée
 * HTTP et exposer un résumé lisible par l'écran.
 */
import { z } from 'zod';
import {
  ALL_HEALTH_CONSENT_SCOPES,
  P01_CONSENT_POLICY_VERSION,
  applyNativePermissionResult,
  createDefaultHealthConsentState,
  getMissingHealthScopes,
  grantHealthConsent,
  revokeAllHealthConsents,
  revokeHealthConsent,
} from '@/features/sensors';
import type { HealthConsentScope, HealthConsentState } from '@/features/sensors';

export const HEALTH_CONSENT_COOKIE = 'lkdv_health_consent_v1';

export const HEALTH_SCOPE_VALUES = [
  'workouts_read',
  'workouts_write',
  'heart_rate_read',
  'heart_rate_write',
  'cadence_read',
  'power_read',
  'distance_read',
  'calories_write',
] as const satisfies readonly HealthConsentScope[];

export const REQUIRED_READ_SCOPES: readonly HealthConsentScope[] = ['workouts_read'];
export const REQUIRED_WRITE_BASE_SCOPES: readonly HealthConsentScope[] = ['workouts_write'];

export interface HealthScopeDescriptor {
  scope: HealthConsentScope;
  label: string;
  description: string;
  group: 'read' | 'write';
  requiredForRead: boolean;
  requiredForWrite: boolean;
  /** Scopes d'écriture demandés seulement quand la séance porte la donnée. */
  conditionalForWrite: boolean;
}

export const HEALTH_SCOPE_DESCRIPTORS: readonly HealthScopeDescriptor[] = [
  {
    scope: 'workouts_read',
    label: 'Lire les séances',
    description: 'Importer les séances réalisées dans Santé.',
    group: 'read',
    requiredForRead: true,
    requiredForWrite: false,
    conditionalForWrite: false,
  },
  {
    scope: 'heart_rate_read',
    label: 'Lire la fréquence cardiaque',
    description: 'Lire les mesures cardiaques associées aux séances.',
    group: 'read',
    requiredForRead: false,
    requiredForWrite: false,
    conditionalForWrite: false,
  },
  {
    scope: 'cadence_read',
    label: 'Lire la cadence',
    description: 'Lire la cadence de course ou de pédalage.',
    group: 'read',
    requiredForRead: false,
    requiredForWrite: false,
    conditionalForWrite: false,
  },
  {
    scope: 'power_read',
    label: 'Lire la puissance',
    description: 'Lire la puissance mesurée par un capteur.',
    group: 'read',
    requiredForRead: false,
    requiredForWrite: false,
    conditionalForWrite: false,
  },
  {
    scope: 'distance_read',
    label: 'Lire la distance',
    description: 'Lire la distance enregistrée par Santé.',
    group: 'read',
    requiredForRead: false,
    requiredForWrite: false,
    conditionalForWrite: false,
  },
  {
    scope: 'workouts_write',
    label: 'Écrire les séances',
    description: 'Enregistrer une séance LKDV dans Santé.',
    group: 'write',
    requiredForRead: false,
    requiredForWrite: true,
    conditionalForWrite: false,
  },
  {
    scope: 'heart_rate_write',
    label: 'Écrire la fréquence cardiaque',
    description: 'Ajouter les mesures cardiaques d’une séance.',
    group: 'write',
    requiredForRead: false,
    requiredForWrite: false,
    conditionalForWrite: true,
  },
  {
    scope: 'calories_write',
    label: 'Écrire les calories',
    description: 'Ajouter les calories actives d’une séance.',
    group: 'write',
    requiredForRead: false,
    requiredForWrite: false,
    conditionalForWrite: true,
  },
];

const scopeSchema = z.enum(HEALTH_SCOPE_VALUES);
const sourceSchema = z.enum(['user_prompt', 'settings', 'system_revoked']);
const epochMsSchema = z.number().int().nonnegative().max(4_102_444_800_000);

const grantSchema = z.object({
  scope: scopeSchema,
  granted: z.boolean(),
  updatedAtMs: epochMsSchema,
  policyVersion: z.string().trim().min(1).max(64),
  source: sourceSchema,
});

const grantShape = Object.fromEntries(
  HEALTH_SCOPE_VALUES.map((scope) => [scope, grantSchema]),
) as Record<HealthConsentScope, typeof grantSchema>;

export const healthConsentStateSchema = z.object({
  policyVersion: z.string().trim().min(1).max(64),
  grants: z.object(grantShape),
});

const mutationBase = {
  nowMs: epochMsSchema.optional(),
  state: healthConsentStateSchema.optional(),
};

export const consentMutationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('grant'),
    scopes: z.array(scopeSchema).min(1).max(HEALTH_SCOPE_VALUES.length),
    source: sourceSchema.optional(),
    ...mutationBase,
  }),
  z.object({
    action: z.literal('revoke'),
    scopes: z.array(scopeSchema).min(1).max(HEALTH_SCOPE_VALUES.length),
    source: sourceSchema.optional(),
    ...mutationBase,
  }),
  z.object({
    action: z.literal('revoke_all'),
    source: sourceSchema.optional(),
    ...mutationBase,
  }),
  z.object({
    action: z.literal('apply_native'),
    granted: z.array(scopeSchema).max(HEALTH_SCOPE_VALUES.length).default([]),
    denied: z.array(scopeSchema).max(HEALTH_SCOPE_VALUES.length).default([]),
    ...mutationBase,
  }),
  z.object({
    action: z.literal('replace'),
    state: healthConsentStateSchema,
    ...mutationBase,
  }),
]);

export type ConsentMutation = z.infer<typeof consentMutationSchema>;

/**
 * Toute politique différente invalide les autorisations précédentes : on ne
 * réutilise jamais un consentement accordé pour une autre version du texte.
 */
export function normalizeHealthConsentState(
  raw: HealthConsentState | null | undefined,
  nowMs: number = Date.now(),
): HealthConsentState {
  const fallback = createDefaultHealthConsentState(nowMs, P01_CONSENT_POLICY_VERSION);
  if (!raw || raw.policyVersion !== P01_CONSENT_POLICY_VERSION) return fallback;

  const grants = {} as HealthConsentState['grants'];
  for (const scope of HEALTH_SCOPE_VALUES) {
    const grant = raw.grants[scope];
    const validPolicy = grant?.policyVersion === P01_CONSENT_POLICY_VERSION;
    grants[scope] = {
      scope,
      granted: Boolean(grant?.granted && validPolicy),
      updatedAtMs: Number.isFinite(grant?.updatedAtMs) ? grant.updatedAtMs : nowMs,
      policyVersion: P01_CONSENT_POLICY_VERSION,
      source: grant?.source ?? 'settings',
    };
  }
  return { policyVersion: P01_CONSENT_POLICY_VERSION, grants };
}

export function parseHealthConsentState(
  value: unknown,
  nowMs: number = Date.now(),
): HealthConsentState | null {
  const parsed = healthConsentStateSchema.safeParse(value);
  if (!parsed.success) return null;
  return normalizeHealthConsentState(parsed.data, nowMs);
}

export function applyConsentMutation(
  current: HealthConsentState,
  mutation: ConsentMutation,
  nowMs: number = Date.now(),
): HealthConsentState {
  const at = mutation.nowMs ?? nowMs;
  const base = normalizeHealthConsentState(mutation.state ?? current, at);

  switch (mutation.action) {
    case 'grant':
      return grantHealthConsent(base, mutation.scopes, mutation.source ?? 'user_prompt', at);
    case 'revoke':
      return revokeHealthConsent(base, mutation.scopes, mutation.source ?? 'settings', at);
    case 'revoke_all':
      return revokeAllHealthConsents(base, mutation.source ?? 'settings', at);
    case 'apply_native':
      return applyNativePermissionResult(
        base,
        { granted: mutation.granted, denied: mutation.denied },
        at,
      );
    case 'replace':
      return normalizeHealthConsentState(mutation.state, at);
  }
}

export interface HealthConsentSummary {
  policyVersion: string;
  scopes: readonly HealthScopeDescriptor[];
  grantedScopes: HealthConsentScope[];
  revokedScopes: HealthConsentScope[];
  missingForRead: HealthConsentScope[];
  missingForWrite: HealthConsentScope[];
  allScopesGranted: boolean;
}

export function summarizeHealthConsent(state: HealthConsentState): HealthConsentSummary {
  const grantedScopes = HEALTH_SCOPE_VALUES.filter((scope) => state.grants[scope]?.granted);
  const revokedScopes = HEALTH_SCOPE_VALUES.filter((scope) => !state.grants[scope]?.granted);
  return {
    policyVersion: state.policyVersion,
    scopes: HEALTH_SCOPE_DESCRIPTORS,
    grantedScopes,
    revokedScopes,
    missingForRead: getMissingHealthScopes(state, REQUIRED_READ_SCOPES),
    missingForWrite: getMissingHealthScopes(state, REQUIRED_WRITE_BASE_SCOPES),
    allScopesGranted: grantedScopes.length === ALL_HEALTH_CONSENT_SCOPES.length,
  };
}

export function consentResponsePayload(state: HealthConsentState, nowMs: number = Date.now()) {
  return {
    state,
    summary: summarizeHealthConsent(state),
    policyVersion: P01_CONSENT_POLICY_VERSION,
    generatedAtMs: nowMs,
  };
}
