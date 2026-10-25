import { describe, it, expect } from 'vitest';
import {
  REDEEM_ERROR_MESSAGE,
  newIdempotencyKey,
  redeemReducer,
  shouldKeepIdempotencyKey,
  toRedeemError,
  type RedeemFlow,
} from '@/features/rewards/domain/redemption';

const keys = ['key-aaaa-0001', 'key-bbbb-0002', 'key-cccc-0003'];
function keyMaker() {
  let i = 0;
  return () => keys[i++] ?? `key-extra-${i}`;
}

describe('parcours d’échange', () => {
  it('confirmation explicite avant envoi, un seul envoi à la fois', () => {
    const make = keyMaker();
    let flow: RedeemFlow = { step: 'idle' };
    flow = redeemReducer(flow, { type: 'confirm' }, make);
    expect(flow).toEqual({ step: 'idle' });
    flow = redeemReducer(flow, { type: 'open', rewardId: 'r1' }, make);
    expect(flow).toEqual({ step: 'confirming', rewardId: 'r1', key: 'key-aaaa-0001' });
    flow = redeemReducer(flow, { type: 'confirm' }, make);
    expect(flow.step).toBe('submitting');
    // Double appui / réouverture pendant l'envoi : ignorés.
    expect(redeemReducer(flow, { type: 'confirm' }, make)).toBe(flow);
    expect(redeemReducer(flow, { type: 'open', rewardId: 'r2' }, make)).toBe(flow);
    expect(redeemReducer(flow, { type: 'cancel' }, make)).toBe(flow);
    flow = redeemReducer(flow, { type: 'success', reference: 'R-ABC', balance: 100 }, make);
    expect(flow).toEqual({ step: 'reserved', rewardId: 'r1', reference: 'R-ABC', balance: 100 });
  });

  it('erreur réseau : même clé conservée pour la nouvelle tentative', () => {
    const make = keyMaker();
    let flow: RedeemFlow = redeemReducer({ step: 'idle' }, { type: 'open', rewardId: 'r1' }, make);
    flow = redeemReducer(flow, { type: 'confirm' }, make);
    flow = redeemReducer(flow, { type: 'failure', code: 'internal_error' }, make);
    expect(flow).toMatchObject({ step: 'failed', key: 'key-aaaa-0001' });
    flow = redeemReducer(flow, { type: 'retry' }, make);
    expect(flow).toEqual({ step: 'confirming', rewardId: 'r1', key: 'key-aaaa-0001' });
  });

  it('refus métier : nouvelle clé à la tentative suivante', () => {
    const make = keyMaker();
    let flow: RedeemFlow = redeemReducer({ step: 'idle' }, { type: 'open', rewardId: 'r1' }, make);
    flow = redeemReducer(flow, { type: 'confirm' }, make);
    flow = redeemReducer(flow, { type: 'failure', code: 'out_of_stock' }, make);
    expect(flow).toMatchObject({ step: 'failed', key: null, code: 'out_of_stock' });
    flow = redeemReducer(flow, { type: 'retry' }, make);
    expect(flow).toMatchObject({ step: 'confirming', key: 'key-bbbb-0002' });
  });

  it('codes inconnus → erreur générique ; chaque refus rassure sur l’absence de débit', () => {
    expect(toRedeemError('nope')).toBe('internal_error');
    expect(toRedeemError(undefined)).toBe('internal_error');
    expect(toRedeemError('out_of_stock')).toBe('out_of_stock');
    for (const code of ['insufficient_balance', 'reward_unfunded', 'out_of_stock', 'offline', 'reward_unavailable'] as const) {
      expect(REDEEM_ERROR_MESSAGE[code]).toMatch(/Aucun point n’a été débité/);
    }
    expect(shouldKeepIdempotencyKey('offline')).toBe(true);
    expect(shouldKeepIdempotencyKey('insufficient_balance')).toBe(false);
  });

  it('clé d’idempotence conforme au format serveur', () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
    expect(newIdempotencyKey(() => 'a/b c?d-e_f0123')).toBe('rdm_abcd-e_f0123');
  });
});
