import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/geodata', () => ({ fetchAdminRegions: vi.fn() }));

import { fetchAdminRegions } from '@/lib/geodata';
import { GET } from '@/app/api/pays/[code]/regions/route';

const regionsMock = vi.mocked(fetchAdminRegions);
const params = (code: string) => ({ params: Promise.resolve({ code }) });

describe('GET /api/pays/[code]/regions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuse un code invalide', async () => {
    const res = await GET(new Request('http://localhost'), params('X'));
    expect(res.status).toBe(400);
  });

  it('renvoie les régions réelles (limit 12)', async () => {
    regionsMock.mockResolvedValue(
      Array.from({ length: 20 }).map((_, i) => ({ id: String(i), name: `Région ${i}` })) as never
    );
    const res = await GET(new Request('http://localhost'), params('IS'));
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.items).toHaveLength(12);
    expect(body.items[0].name).toBe('Région 0');
  });

  it('état vide si aucune région', async () => {
    regionsMock.mockResolvedValue([] as never);
    const res = await GET(new Request('http://localhost'), params('FR'));
    expect((await res.json()).status).toBe('empty');
  });

  it('gère l’erreur référentiel', async () => {
    regionsMock.mockRejectedValue(new Error('db'));
    const res = await GET(new Request('http://localhost'), params('JP'));
    expect(res.status).toBe(502);
  });
});
