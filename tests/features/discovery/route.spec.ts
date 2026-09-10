import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@/features/discovery/services/discoveryService', () => ({
  getDiscovery: vi.fn(),
}));

import { getDiscovery } from '@/features/discovery/services/discoveryService';
import { GET } from '@/app/api/discovery/search/route';
import { getTripadvisorAttribution } from '@/features/discovery/constants';
import type { DiscoveryResponse } from '@/features/discovery/types/discovery.types';

const getDiscoveryMock = vi.mocked(getDiscovery);

function baseResponse(overrides: Partial<DiscoveryResponse> = {}): DiscoveryResponse {
  return {
    status: 'ok',
    provider: 'tripadvisor',
    category: 'attractions',
    countryCode: 'FR',
    items: [],
    attribution: getTripadvisorAttribution(),
    ...overrides,
  };
}

function makeRequest(params: Record<string, string>, ip = '10.0.0.1') {
  const searchParams = new URLSearchParams(params);
  return {
    headers: new Headers({ 'x-forwarded-for': ip }),
    nextUrl: { searchParams },
  } as unknown as NextRequest;
}

describe('GET /api/discovery/search (route sécurisée)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDiscoveryMock.mockResolvedValue(baseResponse());
  });

  it('refuse une catégorie interdite', async () => {
    const res = await GET(makeRequest({ countryCode: 'FR', category: 'bars' }));
    expect(res.status).toBe(400);
    expect(getDiscoveryMock).not.toHaveBeenCalled();
  });

  it('refuse un paramètre inconnu (protection anti-proxy ouvert)', async () => {
    const res = await GET(
      makeRequest({ countryCode: 'FR', category: 'attractions', url: 'https://evil.example' })
    );
    expect(res.status).toBe(400);
    expect(getDiscoveryMock).not.toHaveBeenCalled();
  });

  it('refuse toute clé transmise par le client', async () => {
    const res = await GET(
      makeRequest({ countryCode: 'FR', category: 'attractions', key: 'leaked-key' })
    );
    expect(res.status).toBe(400);
    expect(getDiscoveryMock).not.toHaveBeenCalled();
  });

  it('transmet une requête valide au service et répond 200 sans clé', async () => {
    const res = await GET(makeRequest({ countryCode: 'fr', category: 'hotels' }));
    expect(res.status).toBe(200);
    expect(getDiscoveryMock).toHaveBeenCalledWith({
      countryCode: 'FR',
      category: 'hotels',
      limit: undefined,
    });
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain('leaked-key');
  });

  it('propage le quota en 429', async () => {
    getDiscoveryMock.mockResolvedValue(baseResponse({ status: 'quota', reason: 'quota' }));
    const res = await GET(makeRequest({ countryCode: 'FR', category: 'attractions' }));
    expect(res.status).toBe(429);
  });

  it('renvoie 404 pour un pays inconnu et 502 pour une erreur amont', async () => {
    getDiscoveryMock.mockResolvedValue(
      baseResponse({ status: 'error', reason: 'unknown_country' })
    );
    expect((await GET(makeRequest({ countryCode: 'ZZ', category: 'attractions' }))).status).toBe(404);

    getDiscoveryMock.mockResolvedValue(baseResponse({ status: 'error', reason: 'upstream' }));
    expect((await GET(makeRequest({ countryCode: 'IS', category: 'attractions' }))).status).toBe(502);
  });

  it('applique un rate limit par IP', async () => {
    let lastStatus = 200;
    for (let i = 0; i < 31; i += 1) {
      const res = await GET(makeRequest({ countryCode: 'FR', category: 'attractions' }, '203.0.113.9'));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
