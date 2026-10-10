import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Phase 1 — tests handlers des routes (clients mockés).
 * L'identité, le rate limit, le service_role et les gardes admin sont mockés ;
 * les helpers purs et le mapping RPC (`server.ts`) sont exercés réellement.
 */

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  getServiceSupabase: vi.fn(),
  enforceRateLimit: vi.fn(),
  rpc: vi.fn(),
  requireAdmin: vi.fn(),
  checkCsrfToken: vi.fn(),
  logAdminAction: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: () => h.getServiceSupabase(),
}));

vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: (identifier: string, config: unknown) => h.enforceRateLimit(identifier, config),
}));

vi.mock('@/server/admin/requireAdmin', () => ({
  requireAdmin: (code: string) => h.requireAdmin(code),
}));

vi.mock('@/server/admin/csrf', () => ({
  checkCsrfToken: (req: unknown) => h.checkCsrfToken(req),
}));

vi.mock('@/server/admin/audit', () => ({
  logAdminAction: (input: unknown) => h.logAdminAction(input),
}));

import { POST as spendPost } from '@/app/api/loyalty/spend/route';
import { POST as earnPost } from '@/app/api/loyalty/earn/route';
import { POST as redeemPost } from '@/app/api/loyalty/redeem/route';
import { POST as ordersPost } from '@/app/api/orders/route';
import { POST as cancelPost } from '@/app/api/orders/cancel/route';
import { POST as adminConfirmPost } from '@/app/api/admin/orders/confirm/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const REWARD_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const ORDER_ID = 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const SHIPPING = {
  prenom: 'Ada',
  nom: 'Lovelace',
  email: 'ada@example.com',
  adresse: '1 rue du Test',
  codePostal: '75001',
  ville: 'Paris',
};

function post(url: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

type QueryResult = { data: unknown; error: { message: string } | null };
type QueryCall = { method: 'eq' | 'in'; args: unknown[] };

/** Chaîne PostgREST factice : chaque méthode retourne la chaîne (thenable). */
function ledger(result: QueryResult = { data: [], error: null }, calls?: QueryCall[]) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (...args: unknown[]) => {
    calls?.push({ method: 'eq', args });
    return chain;
  };
  chain.in = (...args: unknown[]) => {
    calls?.push({ method: 'in', args });
    return chain;
  };
  chain.update = () => chain;
  chain.insert = () => chain;
  chain.maybeSingle = async () => result;
  chain.single = async () => result;
  chain.then = (resolve: (value: QueryResult) => unknown) => resolve(result);
  return chain;
}

function serviceFor(result: QueryResult = { data: [], error: null }, calls?: QueryCall[]) {
  return {
    from: () => ledger(result, calls),
    rpc: (...args: unknown[]) => h.rpc(...args),
  };
}

function adminGateOk() {
  h.requireAdmin.mockResolvedValue({ ok: true, ctx: { user: { id: USER_ID }, supabase: {} } });
}

describe('Phase 1 — handlers des routes (mocks)', () => {
  beforeEach(() => {
    h.getUser.mockReset();
    h.getServiceSupabase.mockReset();
    h.enforceRateLimit.mockReset();
    h.rpc.mockReset();
    h.requireAdmin.mockReset();
    h.checkCsrfToken.mockReset();
    h.logAdminAction.mockReset();

    h.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    h.getServiceSupabase.mockReturnValue(serviceFor());
    h.enforceRateLimit.mockResolvedValue(null);
    h.checkCsrfToken.mockResolvedValue(true);
    h.logAdminAction.mockResolvedValue(undefined);
  });

  describe('POST /api/loyalty/spend', () => {
    const validBody = { points: 100, reason: 'Article offert', sourceId: 'cart_free_apply:item-1' };

    it('401 sans session vérifiée (et aucun rate limit consommé)', async () => {
      h.getUser.mockResolvedValue({ data: { user: null } });
      const res = await spendPost(post('/api/loyalty/spend', validBody));
      expect(res.status).toBe(401);
      expect(h.enforceRateLimit).not.toHaveBeenCalled();
    });

    it('429 quand le limiteur refuse', async () => {
      h.enforceRateLimit.mockResolvedValue(
        NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
      );
      const res = await spendPost(post('/api/loyalty/spend', validBody));
      expect(res.status).toBe(429);
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it('503 quand le client service_role est indisponible', async () => {
      h.getServiceSupabase.mockReturnValue(null);
      const res = await spendPost(post('/api/loyalty/spend', validBody));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'service_indisponible' });
    });

    it('400 corps invalide', async () => {
      const res = await spendPost(
        post('/api/loyalty/spend', { points: 0, sourceId: 'cart_free_apply:x' })
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_points' });
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it('409 solde insuffisant (erreur métier RPC)', async () => {
      h.rpc.mockResolvedValue({
        data: { success: false, error: 'insufficient_balance' },
        error: null,
      });
      const res = await spendPost(post('/api/loyalty/spend', validBody));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'insufficient_balance' });
    });

    it('200 nominal : passe-plat du payload DB (level inclus, rejeu idempotent)', async () => {
      h.rpc.mockResolvedValue({
        data: { success: true, balance: 120, level: 'Aventurier', idempotent: true },
        error: null,
      });
      const res = await spendPost(post('/api/loyalty/spend', validBody));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        success: true,
        balance: 120,
        level: 'Aventurier',
        idempotent: true,
      });
      expect(h.rpc).toHaveBeenCalledWith(
        'legacy_loyalty_spend',
        expect.objectContaining({ p_user_id: USER_ID, p_points: 100 })
      );
    });
  });

  describe('POST /api/loyalty/redeem', () => {
    const validBody = { rewardId: REWARD_ID };

    it('409 déjà échangée (erreur métier RPC)', async () => {
      h.rpc.mockResolvedValue({
        data: { success: false, error: 'already_redeemed' },
        error: null,
      });
      const res = await redeemPost(post('/api/loyalty/redeem', validBody));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'already_redeemed' });
    });

    it('200 nominal (balance + level)', async () => {
      h.rpc.mockResolvedValue({
        data: { success: true, balance: 50, level: 'Explorateur' },
        error: null,
      });
      const res = await redeemPost(post('/api/loyalty/redeem', validBody));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, balance: 50, level: 'Explorateur' });
    });
  });

  describe('POST /api/loyalty/earn', () => {
    const validBody = { action: 'rapport_expedition', sourceId: 'report_42' };

    it('403 si la source n’appartient pas au membre (aucun crédit)', async () => {
      h.getServiceSupabase.mockReturnValue(serviceFor({ data: null, error: null }));
      const res = await earnPost(post('/api/loyalty/earn', validBody));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'action_not_verified' });
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it('200 si le rapport appartient au membre (id brut vérifié)', async () => {
      h.getServiceSupabase.mockReturnValue(serviceFor({ data: { id: 'report_42' }, error: null }));
      h.rpc.mockResolvedValue({
        data: { success: true, balance: 75, level: 'Explorateur' },
        error: null,
      });
      const res = await earnPost(post('/api/loyalty/earn', validBody));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, balance: 75, level: 'Explorateur' });
      expect(h.rpc).toHaveBeenCalledWith(
        'legacy_loyalty_earn',
        expect.objectContaining({ p_source_id: 'rapport:report_42', p_points: 75 })
      );
    });
  });

  describe('POST /api/orders', () => {
    const validBody = {
      items: [{ slug: 'sac-40l', quantity: 1 }],
      shippingOption: 'standard',
      shipping: SHIPPING,
    };

    it('400 corps invalide', async () => {
      const res = await ordersPost(post('/api/orders', {}));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_items' });
    });

    it('400 slug inconnu après résolution catalogue', async () => {
      h.getServiceSupabase.mockReturnValue(serviceFor({ data: [], error: null }));
      const res = await ordersPost(post('/api/orders', validBody));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'unknown_product' });
      expect(h.rpc).not.toHaveBeenCalled();
    });

    it('200 nominal : prix serveur et création RPC', async () => {
      h.getServiceSupabase.mockReturnValue(
        serviceFor({
          data: [{ id: 'p1', slug: 'sac-40l', name: 'Sac 40L', price_eur: 89.5 }],
          error: null,
        })
      );
      h.rpc.mockResolvedValue({
        data: { success: true, orderId: ORDER_ID, orderNumber: 'KDV-1', totalEur: 95.4 },
        error: null,
      });
      const res = await ordersPost(post('/api/orders', validBody));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        success: true,
        orderId: ORDER_ID,
        orderNumber: 'KDV-1',
        totalEur: 95.4,
      });
      expect(h.rpc).toHaveBeenCalledWith(
        'create_shop_order',
        expect.objectContaining({
          p_user_id: USER_ID,
          p_payment_method: 'virement',
          p_shipping_option: 'standard',
        })
      );
    });
  });

  describe('POST /api/orders/cancel', () => {
    it('401 sans session vérifiée', async () => {
      h.getUser.mockResolvedValue({ data: { user: null } });
      const res = await cancelPost(post('/api/orders/cancel', { orderId: ORDER_ID }));
      expect(res.status).toBe(401);
    });

    it('400 orderId non UUID', async () => {
      const res = await cancelPost(post('/api/orders/cancel', { orderId: 'nope' }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_order' });
    });

    it('409 quand aucune ligne n’est annulable', async () => {
      h.getServiceSupabase.mockReturnValue(serviceFor({ data: [], error: null }));
      const res = await cancelPost(post('/api/orders/cancel', { orderId: ORDER_ID }));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'not_cancellable' });
    });

    it('200 quand une ligne pending ou confirmée est annulée (filtre in)', async () => {
      const calls: QueryCall[] = [];
      h.getServiceSupabase.mockReturnValue(
        serviceFor({ data: [{ id: ORDER_ID }], error: null }, calls)
      );
      const res = await cancelPost(post('/api/orders/cancel', { orderId: ORDER_ID }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(calls).toContainEqual({ method: 'in', args: ['status', ['pending', 'confirmed']] });
    });
  });

  describe('POST /api/admin/orders/confirm', () => {
    const validBody = { orderId: ORDER_ID };

    it('403 non-admin (garde requireAdmin orders.write)', async () => {
      h.requireAdmin.mockResolvedValue({
        ok: false,
        response: NextResponse.json({ error: 'Accès interdit' }, { status: 403 }),
      });
      const res = await adminConfirmPost(post('/api/admin/orders/confirm', validBody));
      expect(res.status).toBe(403);
      expect(h.requireAdmin).toHaveBeenCalledWith('orders.write');
    });

    it('400 orderId invalide', async () => {
      adminGateOk();
      const res = await adminConfirmPost(post('/api/admin/orders/confirm', { orderId: 'nope' }));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('invalid_body');
    });

    it('409 not_confirmable quand la commande n’est pas pending', async () => {
      adminGateOk();
      h.getServiceSupabase.mockReturnValue(serviceFor({ data: [], error: null }));
      const res = await adminConfirmPost(post('/api/admin/orders/confirm', validBody));
      expect(res.status).toBe(409);
      expect((await res.json()).error.code).toBe('not_confirmable');
    });

    it('200 nominal : la confirmation est auditée', async () => {
      adminGateOk();
      h.getServiceSupabase.mockReturnValue(serviceFor({ data: [{ id: ORDER_ID }], error: null }));
      const res = await adminConfirmPost(post('/api/admin/orders/confirm', validBody));
      expect(res.status).toBe(200);
      const payload = await res.json();
      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual({ success: true });
      expect(h.logAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'orders.confirm', target_id: ORDER_ID })
      );
    });
  });
});
