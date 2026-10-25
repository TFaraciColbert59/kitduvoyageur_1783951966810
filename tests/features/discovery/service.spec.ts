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
import { authError, quotaError } from '@/features/discovery/providers/tripadvisor/tripadvisorErrors';
import { getDiscovery } from '@/features/discovery/services/discoveryService';
import type { DiscoveryItem } from '@/features/discovery/types/discovery.types';

const geoMock = vi.mocked(fetchCountryByIso);
const configuredMock = vi.mocked(isTripadvisorConfigured);
const searchMock = vi.mocked(tripadvisorSearchByCategory);

const sampleItem: DiscoveryItem = {
  id: '1',
  provider: 'tripadvisor',
  type: 'attractions',
  name: 'Blue Lagoon',
  description: null,
  countryCode: 'IS',
  city: 'Grindavík',
  address: null,
  latitude: null,
  longitude: null,
  rating: 4.5,
  reviewCount: 12000,
  photoUrl: null,
  ratingImageUrl: 'https://static.tacdn.com/bubbles.png',
  tripadvisorUrl: 'https://www.tripadvisor.com/x',
  category: null,
  isBookable: false,
};

describe('discovery service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DISCOVERY_PROVIDER', 'terra');
    vi.stubEnv('DISCOVERY_TERRA_ENABLED', 'true');
    configuredMock.mockReturnValue(true);
    geoMock.mockResolvedValue({ name: 'Islande', name_en: 'Iceland' } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renvoie `unconfigured` sans appel réseau ni référentiel si l’API n’est pas configurée', async () => {
    configuredMock.mockReturnValue(false);
    const result = await getDiscovery({ countryCode: 'IS', category: 'attractions' });

    expect(result.status).toBe('unconfigured');
    expect(result.reason).toBe('missing_config');
    expect(searchMock).not.toHaveBeenCalled();
    expect(geoMock).not.toHaveBeenCalled();
  });

  it('renvoie `ok` avec des éléments normalisés', async () => {
    searchMock.mockResolvedValue([sampleItem]);
    const result = await getDiscovery({ countryCode: 'is', category: 'attractions', limit: 6 });

    expect(result.status).toBe('ok');
    expect(result.countryCode).toBe('IS');
    expect(result.items).toHaveLength(1);
    expect(result.attribution.label).toContain('Tripadvisor');
  });

  it('utilise la capitale comme requête de recherche (fallback name_en/name)', async () => {
    geoMock.mockResolvedValue({ name: 'Islande', name_en: 'Iceland', capital: 'Reykjavik' } as never);
    searchMock.mockResolvedValue([sampleItem]);
    await getDiscovery({ countryCode: 'IS', category: 'attractions' });
    expect(searchMock).toHaveBeenCalledWith(
      expect.objectContaining({ countryCode: 'IS', searchQuery: 'Reykjavik' }),
      'terra'
    );

    geoMock.mockResolvedValue({ name: 'Pays Sans Capitale', name_en: 'NoCapital', capital: null } as never);
    await getDiscovery({ countryCode: 'ZZ', category: 'attractions' });
    expect(searchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ searchQuery: 'NoCapital' }),
      'terra'
    );
  });

  it('renvoie `empty` quand aucun résultat', async () => {
    searchMock.mockResolvedValue([]);
    const result = await getDiscovery({ countryCode: 'FR', category: 'hotels' });
    expect(result.status).toBe('empty');
    expect(result.reason).toBe('empty');
  });

  it('signale un pays inconnu sans appeler Tripadvisor', async () => {
    geoMock.mockResolvedValue(null as never);
    const result = await getDiscovery({ countryCode: 'ZZ', category: 'attractions' });
    expect(result.status).toBe('error');
    expect(result.reason).toBe('unknown_country');
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('transforme un quota en statut `quota`', async () => {
    searchMock.mockRejectedValue(quotaError());
    const result = await getDiscovery({ countryCode: 'IS', category: 'attractions' });
    expect(result.status).toBe('quota');
    expect(result.reason).toBe('quota');
  });

  it('transforme un refus d’accès en erreur `auth` non bloquante', async () => {
    searchMock.mockRejectedValue(authError(403));
    const result = await getDiscovery({ countryCode: 'IS', category: 'attractions' });
    expect(result.status).toBe('error');
    expect(result.reason).toBe('auth');
    expect(result.items).toHaveLength(0);
  });

  it('ne renvoie jamais le format brut Tripadvisor', async () => {
    searchMock.mockResolvedValue([sampleItem]);
    const result = await getDiscovery({ countryCode: 'IS', category: 'attractions' });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('location_id');
    expect(serialized).not.toContain('num_reviews');
    expect(serialized).not.toContain('rating_image_url');
  });
});
