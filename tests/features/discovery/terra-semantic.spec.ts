import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isCategoryMatch,
  isCountryMatch,
  terraSearchByCategory,
} from '@/features/discovery/providers/tripadvisor-terra/terraAdapter';
import {
  selectTripadvisorTransport,
  tripadvisorSearchByCategory,
} from '@/features/discovery/providers/tripadvisorProvider';
import type { DiscoveryCategory } from '@/features/discovery/types/discovery.types';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const baseLocation = {
  id: 1,
  names: [{ language: 'fr-FR', value: 'Résultat', primary: true }],
  addresses: [{ city: 'Reykjavík', country_code: 'IS' }],
  categories: [{ display_name: 'Attraction', top_level_category: 'Attraction' }],
};

describe('URL effective Terra (sans secret)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const cases: Array<{
    label: string;
    query: string;
    countryCode: string;
    category: DiscoveryCategory;
    limit: number;
    terraCategory: string;
  }> = [
    { label: 'IS + Reykjavik + attractions', query: 'Reykjavik', countryCode: 'IS', category: 'attractions', limit: 6, terraCategory: 'ATTRACTION' },
    { label: 'FR + Paris + hotels', query: 'Paris', countryCode: 'FR', category: 'hotels', limit: 4, terraCategory: 'HOTEL' },
    { label: 'JP + Tokyo + restaurants', query: 'Tokyo', countryCode: 'JP', category: 'restaurants', limit: 6, terraCategory: 'RESTAURANT' },
  ];

  for (const testCase of cases) {
    it(`${testCase.label} : paramètres exacts, bounded, sans geo_name`, async () => {
      vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 'server-secret');
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
      vi.stubGlobal('fetch', fetchMock);

      await terraSearchByCategory({
        countryCode: testCase.countryCode,
        searchQuery: testCase.query,
        category: testCase.category,
        limit: testCase.limit,
      });

      const calledUrl = String(fetchMock.mock.calls[0][0]);
      const url = new URL(calledUrl);

      expect(url.pathname).toBe('/api/locations/search');
      expect(url.searchParams.get('query')).toBe(testCase.query);
      expect(url.searchParams.get('country_code')).toBe(testCase.countryCode);
      expect(url.searchParams.get('country_code')).toMatch(/^[A-Z]{2}$/);
      expect(url.searchParams.get('category')).toBe(testCase.terraCategory);
      expect(url.searchParams.get('locale')).toBe('fr-FR');
      expect(url.searchParams.get('size')).toBe(String(testCase.limit));
      expect(url.searchParams.get('page')).toBe('1');

      // Aucun paramètre interdit / indéfini / clé en URL.
      expect(url.searchParams.has('geo_name')).toBe(false);
      expect(calledUrl).not.toContain('undefined');
      expect(calledUrl).not.toContain('server-secret');
      expect(calledUrl).not.toContain('key=');
    });
  }
});

describe('Filtrage défensif pays / catégorie (champs OpenAPI)', () => {
  it('écarte un résultat hors pays quand addresses[].country_code est renseigné', () => {
    expect(isCountryMatch({ addresses: [{ country_code: 'IS' }] } as never, 'IS')).toBe(true);
    expect(isCountryMatch({ addresses: [{ country_code: 'FR' }] } as never, 'IS')).toBe(false);
    // Donnée absente → conservé (impossible de valider).
    expect(isCountryMatch({ addresses: [] } as never, 'IS')).toBe(true);
    expect(isCountryMatch({} as never, 'IS')).toBe(true);
  });

  it('écarte un résultat hors catégorie quand categories[].top_level_category est renseigné', () => {
    expect(isCategoryMatch({ categories: [{ top_level_category: 'Attraction' }] } as never, 'attractions')).toBe(true);
    expect(isCategoryMatch({ categories: [{ top_level_category: 'Experience' }] } as never, 'attractions')).toBe(true);
    expect(isCategoryMatch({ categories: [{ top_level_category: 'Accommodation' }] } as never, 'attractions')).toBe(false);
    expect(isCategoryMatch({ categories: [{ top_level_category: 'Accommodation' }] } as never, 'hotels')).toBe(true);
    expect(isCategoryMatch({ categories: [{ top_level_category: 'Eat & Drink' }] } as never, 'restaurants')).toBe(true);
    // Donnée catégorie absente → conservé.
    expect(isCategoryMatch({ categories: [{ display_name: 'X' }] } as never, 'attractions')).toBe(true);
    expect(isCategoryMatch({} as never, 'attractions')).toBe(true);
  });

  it('filtre un lot mixte : ne garde que le pays et la catégorie demandés', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 'k');
    const isAttraction = { ...baseLocation, id: 11 };
    const frHotel = {
      ...baseLocation,
      id: 22,
      names: [{ language: 'fr-FR', value: 'Hôtel parisien', primary: true }],
      addresses: [{ city: 'Paris', country_code: 'FR' }],
      categories: [{ top_level_category: 'Accommodation' }],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ location: isAttraction }, { location: frHotel }] }));
    vi.stubGlobal('fetch', fetchMock);

    const items = await terraSearchByCategory({
      countryCode: 'IS',
      searchQuery: 'Reykjavik',
      category: 'attractions',
      limit: 6,
    });

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('11');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

describe('Absence de fallback automatique Terra → Legacy', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('une erreur Terra remonte sans appeler le legacy', async () => {
    vi.stubEnv('TRIPADVISOR_PROVIDER', 'terra');
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 'terra-key');
    vi.stubEnv('TRIPADVISOR_API_KEY', 'legacy-key');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail: 'forbidden' }, 403));
    vi.stubGlobal('fetch', fetchMock);

    expect(selectTripadvisorTransport()).toBe('terra');
    await expect(
      tripadvisorSearchByCategory({
        countryCode: 'IS',
        searchQuery: 'Reykjavik',
        category: 'attractions',
        limit: 6,
      })
    ).rejects.toMatchObject({ code: 'auth' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('terra.tripadvisor.com');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('api.content.tripadvisor.com');
  });
});
