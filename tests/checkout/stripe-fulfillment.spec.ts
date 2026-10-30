import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const fake = vi.hoisted(() => ({
  canonical: true,
  canonicalError: false,
  intentError: false,
  session: vi.fn(),
  tables: [] as string[],
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (table: string) => {
    fake.tables.push(table);
    const builder = {
      select: () => builder, eq: () => builder,
      maybeSingle: async () => ({ data: fake.canonical ? { id: 'product-1' } : null,
        error: fake.canonicalError ? { message: 'unavailable' } : null }),
      single: async () => ({ data: { price_eur: 25, name: 'Canonical product' }, error: null }),
      upsert: async () => ({ error: fake.intentError ? { message: 'storage unavailable' } : null }),
    };
    return builder;
  } }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock('stripe', () => ({ default: class {
  checkout = { sessions: { create: fake.session } };
} }));

describe('Stripe checkout fulfillment boundary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    fake.canonical = true;
    fake.canonicalError = false;
    fake.intentError = false;
    fake.tables = [];
    fake.session.mockResolvedValue({ id: 'cs_fixture', url: 'https://checkout.stripe.test/fixture' });
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-service-role');
    vi.stubEnv('KIT_REF_SECRET', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  async function checkout(items = [{ id: 'product-1', name: 'Legacy kit', priceEur: 25, quantity: 1 }]) {
    const { POST } = await import('@/app/api/checkout/route');
    return POST(new NextRequest('http://localhost/api/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    }));
  }

  it('refuses an unmapped legacy kit before any Stripe charge is created', async () => {
    fake.canonical = false;
    const response = await checkout();
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ details: [expect.stringContaining('indisponible')] });
    expect(fake.session).not.toHaveBeenCalled();
    expect(fake.tables).toEqual(['shop_products']);
  });

  it('fails closed when canonical inventory cannot be checked', async () => {
    fake.canonicalError = true;
    expect((await checkout()).status).toBe(400);
    expect(fake.session).not.toHaveBeenCalled();
  });

  it('records the canonical id in Stripe product metadata for reliable line mapping', async () => {
    expect((await checkout()).status).toBe(200);
    expect(fake.session).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [expect.objectContaining({ price_data: expect.objectContaining({
        product_data: expect.objectContaining({ metadata: { product_id: 'product-1' } }),
      }) })],
    }));
  });

  it('does not create a payment when its externalized cart failed to persist', async () => {
    fake.intentError = true;
    const items = Array.from({ length: 12 }, (_, index) => ({
      id: `product-${index}`, name: 'Cart item', priceEur: 25, quantity: 1,
    }));
    expect((await checkout(items)).status).toBe(500);
    expect(fake.tables).toContain('checkout_intents');
    expect(fake.session).not.toHaveBeenCalled();
  });
});
