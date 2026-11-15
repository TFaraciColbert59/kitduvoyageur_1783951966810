import { describe, expect, it } from 'vitest';
import {
  ALL_HEALTH_CONSENT_SCOPES,
  P01_CONSENT_POLICY_VERSION,
  createDefaultHealthConsentState,
} from '@/features/sensors';
import {
  applyConsentMutation,
  consentMutationSchema,
  normalizeHealthConsentState,
  parseHealthConsentState,
  summarizeHealthConsent,
} from '../_lib/consent';

describe('API consentement Santé P01', () => {
  it('part de zéro autorisation accordée', () => {
    const state = createDefaultHealthConsentState(1_000);
    expect(ALL_HEALTH_CONSENT_SCOPES.every((scope) => !state.grants[scope].granted)).toBe(true);
    expect(summarizeHealthConsent(state).grantedScopes).toEqual([]);
    expect(summarizeHealthConsent(state).missingForRead).toEqual(['workouts_read']);
  });

  it('accorde un scope granulaire sans toucher aux autres', () => {
    const base = createDefaultHealthConsentState(1_000);
    const parsed = consentMutationSchema.parse({
      action: 'grant',
      scopes: ['workouts_read'],
      nowMs: 2_000,
    });
    const next = applyConsentMutation(base, parsed, 3_000);

    expect(next.grants.workouts_read.granted).toBe(true);
    expect(next.grants.workouts_read.updatedAtMs).toBe(2_000);
    expect(next.grants.workouts_write.granted).toBe(false);
    expect(summarizeHealthConsent(next).missingForRead).toEqual([]);
  });

  it('révoque tous les scopes avec revoke_all', () => {
    const base = createDefaultHealthConsentState(1_000);
    const granted = applyConsentMutation(
      base,
      consentMutationSchema.parse({
        action: 'grant',
        scopes: ['workouts_read', 'workouts_write', 'heart_rate_read'],
      }),
    );
    const revoked = applyConsentMutation(
      granted,
      consentMutationSchema.parse({ action: 'revoke_all', source: 'settings' }),
    );

    expect(revoked.grants.workouts_read.granted).toBe(false);
    expect(revoked.grants.workouts_write.granted).toBe(false);
    expect(revoked.grants.heart_rate_read.granted).toBe(false);
  });

  it('applique un résultat natif grant/denied', () => {
    const base = createDefaultHealthConsentState(1_000);
    const next = applyConsentMutation(
      base,
      consentMutationSchema.parse({
        action: 'apply_native',
        granted: ['workouts_read'],
        denied: ['heart_rate_read'],
      }),
      4_000,
    );

    expect(next.grants.workouts_read.granted).toBe(true);
    expect(next.grants.heart_rate_read.granted).toBe(false);
    expect(next.grants.heart_rate_read.source).toBe('system_revoked');
  });

  it('invalide tous les accords si la politique change', () => {
    const state = createDefaultHealthConsentState(1_000);
    state.grants.workouts_read.granted = true;
    const renamed = { ...state, policyVersion: 'ancienne-politique' };

    const normalized = normalizeHealthConsentState(renamed, 2_000);
    expect(normalized.policyVersion).toBe(P01_CONSENT_POLICY_VERSION);
    expect(normalized.grants.workouts_read.granted).toBe(false);
  });

  it('refuse un scope inconnu plutôt que de le tolérer', () => {
    const result = consentMutationSchema.safeParse({
      action: 'grant',
      scopes: ['body_temperature_read'],
    });
    expect(result.success).toBe(false);
  });

  it('relit un état valide et rejette un état incomplet', () => {
    const state = createDefaultHealthConsentState(1_000);
    expect(parseHealthConsentState(state, 2_000)?.policyVersion).toBe(P01_CONSENT_POLICY_VERSION);
    expect(parseHealthConsentState({ policyVersion: P01_CONSENT_POLICY_VERSION, grants: {} })).toBeNull();
  });
});
