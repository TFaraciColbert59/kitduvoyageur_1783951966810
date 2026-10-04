import { beforeEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null, rpc: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    rpc: mocks.rpc,
  }),
}));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: async () => null }));
import { POST } from '@/app/api/marketplace/listings/route';
import { POST as action } from '@/app/api/marketplace/transactions/[id]/actions/route';
const request = (body: unknown) =>
  new NextRequest('http://localhost/api/marketplace', {
    method: 'POST',
    body: JSON.stringify(body),
  });
beforeEach(() => {
  mocks.user = { id: 'owner' };
  mocks.rpc.mockReset();
});
it('rejects unauthenticated publication', async () => {
  mocks.user = null;
  expect((await POST(request({}))).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('rejects private data and malformed cents', async () => {
  expect(
    (await POST(request({ item_id: 'id', price_cents: 1.2, serial_number: 'private' }))).status
  ).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('preserves business conflict HTTP status', async () => {
  mocks.rpc.mockResolvedValue({ error: { code: 'PT409', message: 'Objet engagé' } });
  expect(
    (
      await action(request({ action: 'accept' }), {
        params: Promise.resolve({ id: 'b2cff5d6-37fc-43d5-bf6f-7d8dacb89922' }),
      })
    ).status
  ).toBe(409);
});
it('returns actual persisted publication', async () => {
  mocks.rpc.mockResolvedValue({ data: { id: 'persisted' }, error: null });
  const r = await POST(
    request({
      item_id: 'b2cff5d6-37fc-43d5-bf6f-7d8dacb89922',
      description: 'Description publique',
      public_location: 'Paris',
      price_cents: 100,
    })
  );
  expect(r.status).toBe(201);
  expect(await r.json()).toEqual({ listing: { id: 'persisted' } });
});
