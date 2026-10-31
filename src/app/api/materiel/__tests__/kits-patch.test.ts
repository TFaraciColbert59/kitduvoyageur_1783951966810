import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  user: { id: 'usr-123' } as { id: string } | null,
  rpc: vi.fn(),
  updateResult: vi.fn(),
  singleResult: vi.fn(),
  deleteFromItems: vi.fn(),
  insertItems: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.user } }),
    },
    rpc: mocks.rpc,
    from: (table: string) => {
      if (table === 'materiel_kits') {
        return {
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: mocks.updateResult,
                }),
              }),
            }),
          }),
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: mocks.singleResult,
              }),
            }),
          }),
        };
      }
      if (table === 'materiel_kit_items') {
        return {
          delete: () => ({
            eq: mocks.deleteFromItems,
          }),
          insert: mocks.insertItems,
        };
      }
      if (table === 'materiel_kit_history') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    },
  }),
}));

import { PATCH } from '@/app/api/materiel/kits/[id]/route';

const buildReq = (body: unknown) =>
  new NextRequest('http://localhost/api/materiel/kits/kit-abc', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

const context = { params: Promise.resolve({ id: 'kit-abc' }) };

describe('L0-1b: PATCH /api/materiel/kits/:id data-loss regression prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: 'usr-123' };
    mocks.updateResult.mockResolvedValue({ data: { id: 'kit-abc', name: 'Kit Renommé' }, error: null });
    mocks.singleResult.mockResolvedValue({ data: { id: 'kit-abc', name: 'Kit Actuel' }, error: null });
    mocks.deleteFromItems.mockResolvedValue({ error: null });
    mocks.insertItems.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: 0, error: null });
  });

  it('PATCH sans items (renommage pur) ne touche jamais aux articles', async () => {
    const res = await PATCH(buildReq({ name: 'Nouveau Nom' }), context);
    expect(res.status).toBe(200);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.deleteFromItems).not.toHaveBeenCalled();
  });

  it('PATCH items: [] sans drapeau allowEmptyItems renvoie HTTP 409 et ne vide rien (ÉCHOUE SUR CODE ACTUEL)', async () => {
    const res = await PATCH(buildReq({ name: 'Kit Test', items: [] }), context);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('Vidage non intentionnel refusé');
    expect(mocks.deleteFromItems).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('PATCH items: [] avec allowEmptyItems: true appelle RPC et autorise le vidage', async () => {
    const res = await PATCH(buildReq({ name: 'Kit Test', items: [], allowEmptyItems: true }), context);
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('replace_kit_items', {
      p_kit_id: 'kit-abc',
      p_items: [],
      p_allow_empty: true,
    });
  });

  it('PATCH avec 2 articles route atomiquement par replace_kit_items', async () => {
    const items = [
      { name: 'Tente', category: 'Couchage & Tentes' as const, weight_g: 1500, quantity: 1, is_checked: false },
      { name: 'Duvet', category: 'Couchage & Tentes' as const, weight_g: 800, quantity: 1, is_checked: false },
    ];
    const res = await PATCH(buildReq({ items }), context);
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('replace_kit_items', {
      p_kit_id: 'kit-abc',
      p_items: items,
      p_allow_empty: false,
    });
    expect(mocks.deleteFromItems).not.toHaveBeenCalled();
    expect(mocks.insertItems).not.toHaveBeenCalled();
  });

  it('Mappe erreur SQLSTATE 23514 de la RPC vers HTTP 409', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: '23514', message: 'vidage non intentionnel refusé' } });
    const res = await PATCH(buildReq({ items: [], allowEmptyItems: true }), context);
    expect(res.status).toBe(409);
  });
});
