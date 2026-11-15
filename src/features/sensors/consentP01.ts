import type {
  HealthConsentGrant,
  HealthConsentScope,
  HealthConsentState,
} from './types';

export const P01_CONSENT_POLICY_VERSION = 'p01-s6.16-v1';

export const ALL_HEALTH_CONSENT_SCOPES: readonly HealthConsentScope[] = [
  'workouts_read',
  'workouts_write',
  'heart_rate_read',
  'heart_rate_write',
  'cadence_read',
  'power_read',
  'distance_read',
  'calories_write',
] as const;

export function createDefaultHealthConsentState(
  nowMs: number = Date.now(),
  policyVersion: string = P01_CONSENT_POLICY_VERSION,
): HealthConsentState {
  const grants = {} as Record<HealthConsentScope, HealthConsentGrant>;
  for (const scope of ALL_HEALTH_CONSENT_SCOPES) {
    grants[scope] = {
      scope,
      granted: false,
      updatedAtMs: nowMs,
      policyVersion,
      source: 'settings',
    };
  }
  return { policyVersion, grants };
}

export function setHealthConsentScopes(
  state: HealthConsentState,
  scopes: readonly HealthConsentScope[],
  granted: boolean,
  source: HealthConsentGrant['source'] = 'user_prompt',
  nowMs: number = Date.now(),
): HealthConsentState {
  const nextGrants: Record<HealthConsentScope, HealthConsentGrant> = { ...state.grants };
  for (const scope of scopes) {
    nextGrants[scope] = {
      scope,
      granted,
      updatedAtMs: nowMs,
      policyVersion: state.policyVersion,
      source,
    };
  }
  return {
    policyVersion: state.policyVersion,
    grants: nextGrants,
  };
}

export function grantHealthConsent(
  state: HealthConsentState,
  scopes: readonly HealthConsentScope[],
  source: HealthConsentGrant['source'] = 'user_prompt',
  nowMs: number = Date.now(),
): HealthConsentState {
  return setHealthConsentScopes(state, scopes, true, source, nowMs);
}

export function revokeHealthConsent(
  state: HealthConsentState,
  scopes: readonly HealthConsentScope[],
  source: HealthConsentGrant['source'] = 'settings',
  nowMs: number = Date.now(),
): HealthConsentState {
  return setHealthConsentScopes(state, scopes, false, source, nowMs);
}

export function revokeAllHealthConsents(
  state: HealthConsentState,
  source: HealthConsentGrant['source'] = 'settings',
  nowMs: number = Date.now(),
): HealthConsentState {
  return setHealthConsentScopes(state, ALL_HEALTH_CONSENT_SCOPES, false, source, nowMs);
}

export function getMissingHealthScopes(
  state: HealthConsentState,
  requiredScopes: readonly HealthConsentScope[],
): HealthConsentScope[] {
  return requiredScopes.filter((scope) => !state.grants[scope]?.granted);
}

export function hasHealthConsent(
  state: HealthConsentState,
  requiredScopes: readonly HealthConsentScope[],
): boolean {
  return getMissingHealthScopes(state, requiredScopes).length === 0;
}

export function applyNativePermissionResult(
  state: HealthConsentState,
  result: { granted: readonly HealthConsentScope[]; denied: readonly HealthConsentScope[] },
  nowMs: number = Date.now(),
): HealthConsentState {
  let next = grantHealthConsent(state, result.granted, 'user_prompt', nowMs);
  next = revokeHealthConsent(next, result.denied, 'system_revoked', nowMs);
  return next;
}
