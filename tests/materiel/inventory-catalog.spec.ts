import { expect, it, vi, beforeEach } from 'vitest';
const query = vi.hoisted(() => ({ select: vi.fn(), in: vi.fn(), eq: vi.fn() }));
const client = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/server', () => ({ createClient: client }));
import { getInventoryCatalog } from '@/features/materiel/services/getInventoryCatalog';
beforeEach(() => {
  vi.clearAllMocks();
  query.select.mockReturnValue(query);
  query.in.mockReturnValue(query);
  client.mockResolvedValue({ from: () => query });
});
it('ignores invalid UUID before accessing catalog', async () => {
  expect(await getInventoryCatalog(['../../private', 'bad'])).toEqual([]);
  expect(client).not.toHaveBeenCalled();
});
it('loads only active public fields and normalizes category and euros', async () => {
  query.eq.mockResolvedValue({
    data: [
      {
        id: '12345678-1234-4123-8123-123456789abc',
        slug: 'sac',
        name: 'Sac',
        brand: 'Test',
        category: 'unknown',
        weight_g: 200,
        price_eur: 12.5,
        serial_number: 'PRIVATE',
      },
    ],
    error: null,
  });
  const result = await getInventoryCatalog(['12345678-1234-4123-8123-123456789abc']);
  expect(query.select).toHaveBeenCalledWith('id,slug,name,brand,category,weight_g,price_eur');
  expect(query.eq).toHaveBeenCalledWith('is_active', true);
  expect(result[0]).toMatchObject({ category: 'Autre', price_cents: 1250 });
  expect(result[0]).not.toHaveProperty('serial_number');
});

it('maps known catalog categories to inventory categories', async () => {
  query.eq.mockResolvedValue({
    data: [
      {
        id: '12345678-1234-4123-8123-123456789abc',
        slug: 'tent',
        name: 'Tente',
        category: 'Tentes',
        weight_g: 100,
        price_eur: 10,
      },
    ],
    error: null,
  });
  expect((await getInventoryCatalog(['12345678-1234-4123-8123-123456789abc']))[0].category).toBe(
    'Couchage & Tentes'
  );
});
