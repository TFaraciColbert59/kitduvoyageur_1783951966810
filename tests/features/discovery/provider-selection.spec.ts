import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/geodata', () => ({ fetchCountryByIso: vi.fn() }));
vi.mock('@/features/discovery/providers/tripadvisorProvider', () => ({
  isTripadvisorConfigured: vi.fn(),
  tripadvisorSearchByCategory: vi.fn(),
  selectTripadvisorTransport: vi.fn(),
}));

import { fetchCountryByIso } from '@/lib/geodata';
import {
  isTripadvisorConfigured,
  tripadvisorSearchByCategory,
} from '@/features/discovery/providers/tripadvisorProvider';
import { getDiscoveryProvider, isTerraEnabled } from '@/features/discovery/config';
import { getDiscovery } from '@/features/discovery/services/discoveryService';

const geoMock = vi.mocked(fetchCountryByIso);
const configuredMock = vi.mocked(isTripadvisorConfigured);
const searchMock = vi.mocked(tripadvisorSearchByCategory);

describe('Sélection du fournisseur de découverte (kill-switch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    configuredMock.mockReturnValue(true);
    geoMock.mockResolvedValue({ name: 'Islande', name_en: 'Iceland', capital: 'Reykjavik' } as never);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('Klook est le défaut ; Terra désactivé par défaut', () => {
    expect(getDiscoveryProvider()).toBe('klook');
    expect(isTerraEnabled()).toBe(false);
  });

  it('DISCOVERY_PROVIDER=terra sans DISCOVERY_TERRA_ENABLED=true → editorial (pas Terra)', () => {
    vi.stubEnv('DISCOVERY_PROVIDER', 'terra');
    expect(getDiscoveryProvider()).toBe('editorial');
  });

  it('DISCOVERY_PROVIDER=terra + enabled=true → terra', () => {
    vi.stubEnv('DISCOVERY_PROVIDER', 'terra');
    vi.stubEnv('DISCOVERY_TERRA_ENABLED', 'true');
    expect(getDiscoveryProvider()).toBe('terra');
  });

  it('provider klook : zéro appel Terra, zéro fetch réseau, statut unconfigured', async () => {
    vi.stubEnv('DISCOVERY_PROVIDER', 'klook');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await getDiscovery({ countryCode: 'IS', category: 'attractions' });

    expect(result.status).toBe('unconfigured');
    expect(result.items).toHaveLength(0);
    expect(searchMock).not.toHaveBeenCalled();
    expect(configuredMock).not.toHaveBeenCalled();
    expect(geoMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('provider editorial : zéro appel externe', async () => {
    vi.stubEnv('DISCOVERY_PROVIDER', 'editorial');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await getDiscovery({ countryCode: 'FR', category: 'hotels' });

    expect(result.status).toBe('unconfigured');
    expect(searchMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DISCOVERY_PROVIDER=terra désactivé → aucun appel Terra même si clé/transport dispo', async () => {
    vi.stubEnv('DISCOVERY_PROVIDER', 'terra');
    vi.stubEnv('DISCOVERY_TERRA_ENABLED', 'false');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await getDiscovery({ countryCode: 'IS', category: 'attractions' });

    expect(result.status).toBe('unconfigured');
    expect(searchMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('provider legacy : transport forcé legacy, sans fallback', async () => {
    vi.stubEnv('DISCOVERY_PROVIDER', 'legacy');
    searchMock.mockResolvedValue([]);
    await getDiscovery({ countryCode: 'IS', category: 'attractions' });
    expect(searchMock).toHaveBeenCalledWith(expect.anything(), 'legacy');
  });

  it('provider terra activé mais non configuré → unconfigured, aucun fallback vers legacy', async () => {
    vi.stubEnv('DISCOVERY_PROVIDER', 'terra');
    vi.stubEnv('DISCOVERY_TERRA_ENABLED', 'true');
    configuredMock.mockReturnValue(false);

    const result = await getDiscovery({ countryCode: 'IS', category: 'attractions' });

    expect(result.status).toBe('unconfigured');
    expect(searchMock).not.toHaveBeenCalled();
    expect(configuredMock).toHaveBeenCalledWith('terra');
  });
});

describe('Sélection Viator (sans fallback Terra)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv('DISCOVERY_PROVIDER', 'viator');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('viator non configuré → unconfigured, zéro fetch, zéro appel tripadvisor', async () => {
    vi.stubEnv('VIATOR_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(getDiscoveryProvider()).toBe('viator');
    const result = await getDiscovery({ countryCode: 'IS', category: 'attractions' });

    expect(result.status).toBe('unconfigured');
    expect(result.provider).toBe('viator');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('viator configuré + destination → un seul POST /products/search, provider viator, pas de Terra', async () => {
    vi.stubEnv('VIATOR_API_KEY', 'viator-secret');
    vi.stubEnv('VIATOR_DESTINATION_IDS', JSON.stringify({ IS: '15' }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        products: [
          {
            productCode: 'P1',
            title: 'Expérience',
            pricing: { summary: { fromPrice: 50 }, currency: 'EUR' },
            productUrl: 'https://www.viator.com/tours/X/d15-P1?pid=P1',
            reviews: { totalReviews: 10, combinedAverageRating: 4.5 },
            images: [{ imageSource: 'https://media.tacdn.com/x.jpg', isCover: true }],
            flags: ['FREE_CANCELLATION'],
          },
        ],
        totalCount: 1,
      }),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await getDiscovery({ countryCode: 'IS', category: 'attractions' });

    expect(result.status).toBe('ok');
    expect(result.provider).toBe('viator');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].priceFrom).toBe(50);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('api.viator.com');
    expect(url).not.toContain('terra.tripadvisor.com');
    expect(url).not.toContain('viator-secret');
    expect(searchMock).not.toHaveBeenCalled();
    expect((init.headers as Record<string, string>)['exp-api-key']).toBe('viator-secret');
  });

  it('viator : section Destinations → filtrée par tag officiel 12716', async () => {
    vi.stubEnv('VIATOR_API_KEY', 'viator-secret');
    vi.stubEnv('VIATOR_DESTINATION_IDS', JSON.stringify({ IS: '905' }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        products: [{ productCode: 'P1', title: 'Attraction', productUrl: 'https://www.viator.com/x?pid=P1' }],
        totalCount: 1,
      }),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await getDiscovery({
      countryCode: 'IS',
      category: 'attractions',
      section: 'destinations',
    });

    expect(result.status).toBe('ok');
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.filtering.tags).toEqual([12716]);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('viator : Gastronomie → filtrée par tags culinaires officiels', async () => {
    vi.stubEnv('VIATOR_API_KEY', 'viator-secret');
    vi.stubEnv('VIATOR_DESTINATION_IDS', JSON.stringify({ IS: '905' }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ products: [], totalCount: 0 }),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    await getDiscovery({ countryCode: 'IS', category: 'restaurants', section: 'gastronomie' });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.filtering.tags).toEqual([21567]);
  });

  it('viator : Hébergements → éditorial (aucune carte, aucun appel)', async () => {
    vi.stubEnv('VIATOR_API_KEY', 'viator-secret');
    vi.stubEnv('VIATOR_DESTINATION_IDS', JSON.stringify({ IS: '905' }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await getDiscovery({ countryCode: 'IS', category: 'hotels', section: 'hebergements' });

    expect(result.status).toBe('unconfigured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
