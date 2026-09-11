/**
 * A13 (S3) — Métadonnées Stripe existantes → entitlements (plan/pass).
 *
 *   • TEST-A13-ENT-16 : `buildStripeCheckoutMetadata` transporte plan/pass
 *     validés quand un caller en fournit (aucun prix inventé) ; sans caller,
 *     les métadonnées historiques restent strictement identiques.
 *   • TEST-A13-ENT-17 : `grantEntitlementsFromMetadata` fusionne sans jamais
 *     rétrograder le plan ; métadonnées non reconnues ⇒ aucune écriture.
 *   • TEST-A13-ENT-18 : une erreur d'écriture remonte (best-effort webhook).
 */
import { describe, it, expect, vi } from 'vitest';
import { buildStripeCheckoutMetadata } from '@/features/checkout/stripeMetadata';
import {
  grantEntitlementsFromMetadata,
  USER_ENTITLEMENTS_TABLE,
} from '@/lib/entitlements/server';

function clientWithRow(row: unknown) {
  const upsert = vi.fn(async () => ({ error: null }));
  const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select, upsert }));
  return { client: { from } as never, from, select, eq, maybeSingle, upsert };
}

describe('A13 (S3) — métadonnées Stripe et grants d’entitlements', () => {
  it('TEST-A13-ENT-16: plan/pass transportés quand fournis, historique inchangé sinon', () => {
    const withGrant = buildStripeCheckoutMetadata(
      'user-1',
      [{ id: 'p1', name: 'Pass week-end', quantity: 1 }],
      { plan: 'expedition', pass: 'weekend' }
    );
    expect(withGrant.metadata.plan).toBe('expedition');
    expect(withGrant.metadata.pass).toBe('weekend');
    expect(withGrant.metadata.user_id).toBe('user-1');

    const historical = buildStripeCheckoutMetadata('user-1', [
      { id: 'p1', name: 'Sac', quantity: 1 },
    ]);
    expect(historical.metadata.plan).toBeUndefined();
    expect(historical.metadata.pass).toBeUndefined();
  });

  it('TEST-A13-ENT-17: grant fusionné, plan jamais rétrogradé, invalides ignorés', async () => {
    const paid = clientWithRow({
      plan: 'free',
      active_passes: ['weekend'],
      source: 'user_entitlements',
    });

    const applied = await grantEntitlementsFromMetadata(paid.client, 'user-1', {
      plan: 'expedition',
      pass: 'trip',
    });
    expect(applied).toEqual({ applied: true });
    expect(paid.from).toHaveBeenCalledWith(USER_ENTITLEMENTS_TABLE);
    const [row, options] = paid.upsert.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { onConflict: string },
    ];
    expect(row).toMatchObject({
      user_id: 'user-1',
      plan: 'expedition',
      active_passes: ['weekend', 'trip'],
      source: 'stripe_metadata',
    });
    expect(options).toEqual({ onConflict: 'user_id' });

    const invalid = clientWithRow(null);
    expect(
      await grantEntitlementsFromMetadata(invalid.client, 'user-1', { plan: 'hack', pass: 'hack' })
    ).toEqual({ applied: false });
    expect(invalid.upsert).not.toHaveBeenCalled();
  });

  it('TEST-A13-ENT-18: erreur d’écriture propagée à l’appelant (webhook best-effort)', async () => {
    const upsert = vi.fn(async () => ({ error: { message: 'boom' } }));
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select, upsert })) } as never;

    await expect(
      grantEntitlementsFromMetadata(client, 'user-1', { plan: 'group' })
    ).rejects.toThrow('boom');
  });
});
