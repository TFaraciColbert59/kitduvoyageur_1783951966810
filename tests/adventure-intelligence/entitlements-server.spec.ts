/**
 * A13 (S3) — Entitlements serveur (plans/passes → gating 402).
 *
 *   • TEST-A13-ENT-01 : résolution plan/passes depuis la table, entitlements
 *     effectifs calculés par le domaine (source `user_entitlements`).
 *   • TEST-A13-ENT-02 : plan/passe inconnus ⇒ jamais d'accès, free par défaut.
 *   • TEST-A13-ENT-03 : `requireEntitlement` ⇒ 402 { error, requiredPlan }.
 *   • TEST-A13-ENT-04 : erreur de lecture ⇒ free fail-safe (jamais d'accès).
 *   • TEST-A13-ENT-05 : métadonnées Stripe `plan`/`pass` parsées strictement.
 *   • TEST-A13-ENT-06 : configuration Stripe explicite (`configured:false`, aucun
 *     prix inventé — uniquement des booléens).
 *   • TEST-A13-ENT-07 : quota de génération — free réduit, entitlements étendus.
 *   • TEST-A13-ENT-08 : fusion de grants (plan jamais rétrogradé, passes union).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  entitlementGate,
  entitlementRequiredResponse,
  generationQuotaFor,
  mergeEntitlementGrants,
  parseEntitlementMetadata,
  parsePassIds,
  parsePlanId,
  requireEntitlement,
  resolveEntitlementsFromRow,
  resolveUserEntitlements,
  stripeBillingConfiguration,
  FREE_GENERATION_QUOTA_PER_HOUR,
  STRIPE_PRICE_ENV_KEYS,
  USER_ENTITLEMENTS_TABLE,
} from '@/lib/entitlements/server';
import { GENERATION_QUOTA_PER_HOUR } from '@/features/adventure-intelligence/domain/generationLimits';

function clientWithRow(row: unknown, error: { message: string } | null = null) {
  const maybeSingle = vi.fn(async () => ({ data: row, error }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as never, from, select, eq, maybeSingle };
}

describe('A13 (S3) — entitlements serveur', () => {
  it('TEST-A13-ENT-01: plan + passes actifs ⇒ entitlements effectifs du domaine', async () => {
    const { client, from } = clientWithRow({
      plan: 'expedition',
      active_passes: ['weekend'],
      source: 'stripe_metadata',
    });

    const resolved = await resolveUserEntitlements(client, 'user-1');

    expect(from).toHaveBeenCalledWith(USER_ENTITLEMENTS_TABLE);
    expect(resolved.plan).toBe('expedition');
    expect(resolved.activePasses).toEqual(['weekend']);
    expect(resolved.source).toBe('stripe_metadata');
    expect(resolved.entitlements).toContain('trek');
    expect(resolved.entitlements).toContain('full_generation');
    expect(resolved.entitlements).toContain('offline');
    expect(resolved.entitlements).not.toContain('group');
  });

  it('TEST-A13-ENT-02: plan/passe inconnus ⇒ free, aucun accès accordé', () => {
    expect(parsePlanId('plan-mythique')).toBe('free');
    expect(parsePlanId(null)).toBe('free');
    expect(parsePlanId(42)).toBe('free');
    expect(parsePassIds(['weekend', 'mystere', 7, null])).toEqual(['weekend']);

    const resolved = resolveEntitlementsFromRow({
      plan: 'plan-mythique',
      active_passes: ['inconnu'],
      source: 'n_importe_quoi',
    });
    expect(resolved.plan).toBe('free');
    expect(resolved.activePasses).toEqual([]);
    expect(resolved.entitlements).toEqual([]);
    expect(resolved.source).toBe('default_free');

    expect(entitlementGate(resolved, 'group')).toEqual({
      granted: false,
      requiredPlan: 'group',
    });
    expect(entitlementGate(resolved, 'trek')).toEqual({
      granted: false,
      requiredPlan: 'expedition',
    });
  });

  it('TEST-A13-ENT-03: requireEntitlement refusé ⇒ 402 explicite, accordé ⇒ ok', async () => {
    const free = clientWithRow(null);
    const denied = await requireEntitlement(free.client, 'user-1', 'group');
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.response.status).toBe(402);
      const body = await denied.response.json();
      expect(body).toEqual({ error: 'entitlement_required', requiredPlan: 'group' });
    }

    const paid = clientWithRow({ plan: 'group', active_passes: [], source: 'manual' });
    const allowed = await requireEntitlement(paid.client, 'user-1', 'monitoring');
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.resolved.plan).toBe('group');
    }

    const response = entitlementRequiredResponse('trek');
    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: 'entitlement_required', requiredPlan: 'expedition' });
  });

  it('TEST-A13-ENT-04: table indisponible/erreur ⇒ free fail-safe, jamais d’accès', async () => {
    const broken = clientWithRow(null, { message: 'relation does not exist' });
    const resolved = await resolveUserEntitlements(broken.client, 'user-1');

    expect(resolved.plan).toBe('free');
    expect(resolved.entitlements).toEqual([]);
    expect(resolved.source).toBe('unavailable');

    const throwing = {
      from: () => {
        throw new Error('boom');
      },
    } as never;
    const safe = await resolveUserEntitlements(throwing, 'user-1');
    expect(safe.plan).toBe('free');
    expect(safe.source).toBe('unavailable');
  });

  it('TEST-A13-ENT-05: métadonnées Stripe parses strictement plan/pass', () => {
    expect(parseEntitlementMetadata({ plan: 'group', pass: 'trip' })).toEqual({
      plan: 'group',
      passes: ['trip'],
    });
    expect(parseEntitlementMetadata({ passes: 'weekend,expedition' })).toEqual({
      plan: null,
      passes: ['weekend', 'expedition'],
    });
    expect(parseEntitlementMetadata({ plan: 'hack', pass: 'hack' })).toEqual({
      plan: null,
      passes: [],
    });
    expect(parseEntitlementMetadata(undefined)).toEqual({ plan: null, passes: [] });
  });

  it('TEST-A13-ENT-06: configuration Stripe explicite, aucun prix inventé', () => {
    const none = stripeBillingConfiguration({});
    expect(none.configured).toBe(false);
    expect(none.secretKey).toBe(false);
    expect(Object.values(none.priceIds).every((present) => present === false)).toBe(true);

    const partial = stripeBillingConfiguration({
      STRIPE_SECRET_KEY: 'sk_test_x',
      [STRIPE_PRICE_ENV_KEYS.expedition]: 'price_123',
    });
    expect(partial.secretKey).toBe(true);
    expect(partial.priceIds.expedition).toBe(true);
    expect(partial.priceIds.group).toBe(false);
    expect(partial.configured).toBe(true);

    const json = JSON.stringify(partial);
    expect(json).not.toContain('price_123');
    expect(json).not.toContain('sk_test_x');

    const keyOnly = stripeBillingConfiguration({ STRIPE_SECRET_KEY: 'sk_test_x' });
    expect(keyOnly.configured).toBe(false);
  });

  it('TEST-A13-ENT-07: quota free réduit explicite, quota standard sinon', () => {
    const free = resolveEntitlementsFromRow(null);
    expect(generationQuotaFor(free)).toBe(FREE_GENERATION_QUOTA_PER_HOUR);
    expect(FREE_GENERATION_QUOTA_PER_HOUR).toBeLessThan(GENERATION_QUOTA_PER_HOUR);

    const paid = resolveEntitlementsFromRow({ plan: 'explorer', active_passes: [] });
    expect(generationQuotaFor(paid)).toBe(GENERATION_QUOTA_PER_HOUR);

    const passer = resolveEntitlementsFromRow({ plan: 'free', active_passes: ['weekend'] });
    expect(generationQuotaFor(passer)).toBe(GENERATION_QUOTA_PER_HOUR);
  });

  it('TEST-A13-ENT-08: fusion des grants — plan jamais rétrogradé, passes union', () => {
    expect(
      mergeEntitlementGrants(
        { plan: 'expedition', passes: ['trip'], source: 'user_entitlements' },
        { plan: 'free', passes: ['weekend'], source: 'stripe_metadata' }
      )
    ).toEqual({ plan: 'expedition', passes: ['trip', 'weekend'] });

    expect(
      mergeEntitlementGrants(
        null,
        { plan: 'group', passes: ['expedition'], source: 'stripe_metadata' }
      )
    ).toEqual({ plan: 'group', passes: ['expedition'] });

    expect(
      mergeEntitlementGrants(
        { plan: 'free', passes: [], source: 'user_entitlements' },
        { plan: 'free', passes: [], source: 'stripe_metadata' }
      )
    ).toEqual({ plan: 'free', passes: [] });
  });
});
