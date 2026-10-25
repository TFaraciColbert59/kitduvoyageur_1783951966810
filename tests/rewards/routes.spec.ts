import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Routes du chantier Récompenses (clients mockés). Identité, limiteur et
 * client service sont simulés ; validation et mapping des réponses SQL sont
 * exercés réellement.
 */

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  getServiceSupabase: vi.fn(),
  enforceRateLimit: vi.fn(),
  rpc: vi.fn(),
  userRpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: h.getUser }, rpc: (...args: unknown[]) => h.userRpc(...args) }),
}));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: () => h.getServiceSupabase() }));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: (identifier: string, config: unknown) => h.enforceRateLimit(identifier, config),
}));

import { GET as walletGet } from '@/app/api/rewards/wallet/route';
import { PUT as goalPut, DELETE as goalDelete } from '@/app/api/rewards/goal/route';
import { POST as redeemPost } from '@/app/api/rewards/redeem/route';
import { POST as claimPost } from '@/app/api/rewards/claim/route';
import { POST as withdrawPost } from '@/app/api/rewards/withdraw/route';
import { POST as earnPost } from '@/app/api/loyalty/earn/route';
import { POST as legacyRedeemPost } from '@/app/api/loyalty/redeem/route';
import { POST as adminPost } from '@/app/api/admin/rewards/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const REWARD_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

function req(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const SNAPSHOT = {
  success: true,
  generated_at: '2026-10-25T16:00:00Z',
  balance: 300,
  program: { version: 'pilote-c-2026-10', emission_open: false, closure_reason: 'x', weekly_cap: 250, rules: [] },
  week: { start: '2026-10-19', used: 0 },
  pending_points: 0,
  goal: null,
  catalog: [],
  history: [],
  awards: [],
  redemptions: [],
  legacy: { economic_points: 0, economic_pending_points: 0, available_cash: 0, pending_cash: 0, store_credit_cents: 0 },
};

function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {};
  c.select = () => c;
  c.eq = () => c;
  c.maybeSingle = async () => result;
  return c;
}

describe('routes Récompenses', () => {
  beforeEach(() => {
    for (const fn of Object.values(h)) fn.mockReset();
    h.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    h.enforceRateLimit.mockResolvedValue(null);
    h.getServiceSupabase.mockReturnValue({ rpc: (...args: unknown[]) => h.rpc(...args), from: (...args: unknown[]) => h.from(...args) });
  });

  describe('GET /api/rewards/wallet', () => {
    it('401 sans session, aucun appel base', async () => {
      h.getUser.mockResolvedValue({ data: { user: null } });
      const res = await walletGet(req('GET', '/api/rewards/wallet'));
      expect(res.status).toBe(401);
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it('200 : snapshot du membre de la session, cache privé', async () => {
      h.rpc.mockResolvedValue({ data: SNAPSHOT, error: null });
      const res = await walletGet(req('GET', '/api/rewards/wallet'));
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      const json = await res.json();
      expect(json.snapshot.balance).toBe(300);
      expect(h.rpc).toHaveBeenCalledWith('rewards_wallet_snapshot', { p_user_id: USER_ID });
    });

    it('500 si le snapshot est illisible (pas de solde inventé), sans message SQL', async () => {
      h.rpc.mockResolvedValue({ data: { success: true, balance: 'beaucoup' }, error: null });
      const res = await walletGet(req('GET', '/api/rewards/wallet'));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'internal_error' });
    });

    it('503 si le client service manque', async () => {
      h.getServiceSupabase.mockReturnValue(null);
      const res = await walletGet(req('GET', '/api/rewards/wallet'));
      expect(res.status).toBe(503);
    });

    it('erreur SQL : code générique, message jamais exposé', async () => {
      h.rpc.mockResolvedValue({ data: null, error: { message: 'relation secret does not exist', code: '42P01' } });
      const res = await walletGet(req('GET', '/api/rewards/wallet'));
      expect(res.status).toBe(500);
      expect(JSON.stringify(await res.json())).not.toContain('secret');
    });
  });

  describe('objectif', () => {
    it('PUT valide → rewards_set_goal avec l’identité de session', async () => {
      h.rpc.mockResolvedValue({ data: { success: true, goal: { reward_id: REWARD_ID } }, error: null });
      const res = await goalPut(req('PUT', '/api/rewards/goal', { rewardId: REWARD_ID }));
      expect(res.status).toBe(200);
      expect(h.rpc).toHaveBeenCalledWith('rewards_set_goal', { p_user_id: USER_ID, p_reward_id: REWARD_ID });
    });

    it('PUT refuse un identifiant de membre fourni par le client', async () => {
      const res = await goalPut(req('PUT', '/api/rewards/goal', { rewardId: REWARD_ID, userId: 'autre' }));
      expect(res.status).toBe(400);
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it('PUT objet indisponible → 409', async () => {
      h.rpc.mockResolvedValue({ data: { success: false, error: 'reward_unavailable' }, error: null });
      const res = await goalPut(req('PUT', '/api/rewards/goal', { rewardId: REWARD_ID }));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'reward_unavailable' });
    });

    it('DELETE retire l’objectif', async () => {
      h.rpc.mockResolvedValue({ data: { success: true, goal: null }, error: null });
      const res = await goalDelete(req('DELETE', '/api/rewards/goal'));
      expect(res.status).toBe(200);
      expect(h.rpc).toHaveBeenCalledWith('rewards_set_goal', { p_user_id: USER_ID, p_reward_id: null });
    });
  });

  describe('POST /api/rewards/redeem', () => {
    const body = { rewardId: REWARD_ID, idempotencyKey: 'rdm_0123456789abcdef' };

    it('limiteur fail-closed (ressource économique)', async () => {
      h.rpc.mockResolvedValue({ data: { success: true, status: 'reserved', balance: 0 }, error: null });
      await redeemPost(req('POST', '/api/rewards/redeem', body));
      expect(h.enforceRateLimit).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ scope: 'rewards-redeem', failMode: 'closed' }));
    });

    it('points ou prix fournis par le client refusés', async () => {
      const res = await redeemPost(req('POST', '/api/rewards/redeem', { ...body, points: 1 }));
      expect(res.status).toBe(400);
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it('clé d’idempotence invalide refusée', async () => {
      const res = await redeemPost(req('POST', '/api/rewards/redeem', { ...body, idempotencyKey: 'court' }));
      expect(res.status).toBe(400);
    });

    it('réservation : référence, solde, clé transmise', async () => {
      h.rpc.mockResolvedValue({
        data: { success: true, status: 'reserved', redemption_id: 'r-1', reference: 'R-ABCDEF1234', points_spent: 400, balance: 785 },
        error: null,
      });
      const res = await redeemPost(req('POST', '/api/rewards/redeem', body));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ success: true, status: 'reserved', reference: 'R-ABCDEF1234', balance: 785, idempotent: false });
      expect(h.rpc).toHaveBeenCalledWith('rewards_redeem', {
        p_user_id: USER_ID,
        p_reward_id: REWARD_ID,
        p_idempotency_key: 'rdm_0123456789abcdef',
      });
    });

    it.each([
      ['reward_unfunded', 409],
      ['out_of_stock', 409],
      ['insufficient_balance', 409],
      ['idempotency_conflict', 409],
      ['payment_required', 409],
    ])('refus métier %s → %i', async (code, status) => {
      h.rpc.mockResolvedValue({ data: { success: false, error: code }, error: null });
      const res = await redeemPost(req('POST', '/api/rewards/redeem', body));
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: code });
    });
  });

  describe('émissions legacy fermées', () => {
    it('/api/rewards/claim : 410 emission_closed, aucun appel base', async () => {
      const res = await claimPost(req('POST', '/api/rewards/claim', { action_type: 'group_message', target_id: REWARD_ID, target_type: 'group' }));
      expect(res.status).toBe(410);
      expect((await res.json()).error).toBe('emission_closed');
      expect(h.rpc).not.toHaveBeenCalled();
      expect(h.getUser).not.toHaveBeenCalled();
    });

    it('/api/loyalty/redeem : 410, aucun débit legacy', async () => {
      const res = await legacyRedeemPost(req('POST', '/api/loyalty/redeem', { rewardId: REWARD_ID }));
      expect(res.status).toBe(410);
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it('/api/loyalty/earn : rapport vérifié mais programme fermé → 409 emission_closed, jamais legacy_loyalty_earn', async () => {
      h.from.mockReturnValue(chain({ data: { id: 'report_42' }, error: null }));
      h.rpc.mockResolvedValue({ data: { success: false, error: 'unknown_rule' }, error: null });
      const res = await earnPost(req('POST', '/api/loyalty/earn', { action: 'rapport_expedition', sourceId: 'report_42' }));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'emission_closed' });
      expect(h.rpc).toHaveBeenCalledWith('rewards_award_points', {
        p_user_id: USER_ID,
        p_rule_key: 'rapport_expedition',
        p_source_type: 'kit_report',
        p_source_id: 'rapport:report_42',
      });
      expect(h.rpc).not.toHaveBeenCalledWith('legacy_loyalty_earn', expect.anything());
    });

    it('/api/loyalty/earn : rapport d’autrui → 403, aucune attribution', async () => {
      h.from.mockReturnValue(chain({ data: null, error: null }));
      const res = await earnPost(req('POST', '/api/loyalty/earn', { action: 'rapport_expedition', sourceId: 'report_42' }));
      expect(res.status).toBe(403);
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it('/api/loyalty/earn : si un jour ouvert, la décision serveur est relayée telle quelle', async () => {
      h.from.mockReturnValue(chain({ data: { id: 'report_42' }, error: null }));
      h.rpc.mockResolvedValue({ data: { success: true, status: 'pending', points: 25 }, error: null });
      const res = await earnPost(req('POST', '/api/loyalty/earn', { action: 'rapport_expedition', sourceId: 'report_42' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ success: true, status: 'pending', points: 25 });
    });
  });

  describe('POST /api/admin/rewards — compensations', () => {
    const REDEMPTION_ID = 'c1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

    it('403 hors administrateur, aucune écriture', async () => {
      h.userRpc.mockResolvedValue({ data: false, error: null });
      const res = await adminPost(req('POST', '/api/admin/rewards', { action: 'cancel_redemption', redemption_id: REDEMPTION_ID, reason: 'x' }));
      expect(res.status).toBe(403);
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it('annulation sans motif refusée', async () => {
      h.userRpc.mockResolvedValue({ data: true, error: null });
      const res = await adminPost(req('POST', '/api/admin/rewards', { action: 'cancel_redemption', redemption_id: REDEMPTION_ID, reason: '  ' }));
      expect(res.status).toBe(400);
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it('annulation : fonction SQL idempotente appelée avec le motif', async () => {
      h.userRpc.mockResolvedValue({ data: true, error: null });
      h.rpc.mockResolvedValue({ data: { success: true, status: 'cancelled', refunded: 400, balance: 900 }, error: null });
      const res = await adminPost(req('POST', '/api/admin/rewards', { action: 'cancel_redemption', redemption_id: REDEMPTION_ID, reason: 'Rupture fournisseur' }));
      expect(res.status).toBe(200);
      expect(h.rpc).toHaveBeenCalledWith('rewards_cancel_redemption', { p_redemption_id: REDEMPTION_ID, p_reason: 'Rupture fournisseur' });
    });

    it('contre-écriture d’un échange expédié : refus métier relayé', async () => {
      h.userRpc.mockResolvedValue({ data: true, error: null });
      h.rpc.mockResolvedValue({ data: { success: false, error: 'not_cancellable', status: 'shipped' }, error: null });
      const res = await adminPost(req('POST', '/api/admin/rewards', { action: 'cancel_redemption', redemption_id: REDEMPTION_ID, reason: 'test' }));
      expect(res.status).toBe(409);
    });

    it('points_program mal formé refusé avant écriture', async () => {
      h.userRpc.mockResolvedValue({ data: true, error: null });
      const res = await adminPost(req('POST', '/api/admin/rewards', {
        action: 'update_config', key: 'points_program', value: { emission_open: 'oui', weekly_cap: 250, rules: {} },
      }));
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/rewards/withdraw (droits cash acquis)', () => {
    const valid = {
      amount: 25.5,
      payment_provider: 'bank_transfer',
      idempotency_key: '2c0d3c0e-8a1f-4c55-9d10-7b5a1f3e9c21',
      metadata: { iban: 'FR7630006000011234567890189', bic: 'AGRIFRPP' },
    };

    it('corps valide transmis à request_withdrawal', async () => {
      h.userRpc.mockResolvedValue({ data: 'w-1', error: null });
      const res = await withdrawPost(req('POST', '/api/rewards/withdraw', valid));
      expect(res.status).toBe(200);
      expect(h.userRpc).toHaveBeenCalledWith('request_withdrawal', expect.objectContaining({ p_amount: 25.5, p_payment_provider: 'bank_transfer' }));
    });

    it.each([
      ['montant texte', { ...valid, amount: '25' }],
      ['montant à trois décimales', { ...valid, amount: 10.123 }],
      ['fournisseur inconnu', { ...valid, payment_provider: 'crypto' }],
      ['IBAN manquant', { ...valid, metadata: { bic: 'AGRIFRPP' } }],
      ['champ libre dans les métadonnées', { ...valid, metadata: { ...valid.metadata, note: '<script>' } }],
      ['PayPal sans e-mail', { ...valid, payment_provider: 'paypal', metadata: {} }],
    ])('400 : %s', async (_label, body) => {
      const res = await withdrawPost(req('POST', '/api/rewards/withdraw', body));
      expect(res.status).toBe(400);
      expect(h.userRpc).not.toHaveBeenCalled();
    });

    it('refus SQL : message générique, aucun détail interne', async () => {
      h.userRpc.mockResolvedValue({ data: null, error: { message: 'Solde insuffisant pour user 1111', code: 'P0001' } });
      const res = await withdrawPost(req('POST', '/api/rewards/withdraw', valid));
      expect(res.status).toBe(400);
      expect(JSON.stringify(await res.json())).not.toContain('1111');
    });
  });
});
