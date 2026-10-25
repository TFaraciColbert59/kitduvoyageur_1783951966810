import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  terraLocationSchema,
  terraSearchResponseSchema,
} from '@/features/discovery/providers/tripadvisor-terra/terraSchemas';
import {
  TERRA_CATEGORY,
  isTerraConfigured,
  terraLocationDetails,
  terraSearchLocations,
} from '@/features/discovery/providers/tripadvisor-terra/terraClient';
import {
  normalizeTerraLocation,
  terraSearchByCategory,
} from '@/features/discovery/providers/tripadvisor-terra/terraAdapter';
import {
  isTripadvisorConfigured,
  selectTripadvisorTransport,
  tripadvisorSearchByCategory,
} from '@/features/discovery/providers/tripadvisorProvider';
import { discoveryItemSchema } from '@/features/discovery/schemas/discovery.schema';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const terraLocation = {
  id: 325764,
  names: [
    { language: 'en-US', value: 'Blue Lagoon', primary: false },
    { language: 'fr-FR', value: 'Lagon bleu', primary: true },
  ],
  descriptions: [{ language: 'fr-FR', value: 'Lagon géothermal.' }],
  addresses: [{ city: 'Grindavík', formatted: 'Norðurljósavegur 9, 240 Grindavík', country_code: 'IS' }],
  coordinates: { latitude: 63.88, longitude: -22.45 },
  categories: [{ display_name: 'Sources chaudes' }],
  traveler_ratings: {
    overall: { rating: 4.5, count: 12000, icon_url: 'https://static.tacdn.com/bubbles.png' },
  },
  urls: { tripadvisor: { main: 'https://www.tripadvisor.com/Attraction_Review-g1' } },
  photos: { total_count: 42 },
  status: { value: 'OPEN' },
};

const terraSearchBody = {
  data: [{ location: terraLocation, matched_value: { language: 'fr', value: 'Islande' } }],
  pagination: { page: 1, size: 6, total_elements: 1, total_pages: 1 },
};

describe('Terra schemas', () => {
  it('accepte une Location partielle (champs non garantis optionnels)', () => {
    const parsed = terraLocationSchema.safeParse({ id: 42 });
    expect(parsed.success).toBe(true);
  });

  it('accepte la réponse Search complète et expose la pagination', () => {
    const parsed = terraSearchResponseSchema.safeParse(terraSearchBody);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data).toHaveLength(1);
      expect(parsed.data.pagination).toBeTruthy();
    }
  });

  it('rejette une Location malformée (id non scalaire)', () => {
    expect(terraLocationSchema.safeParse({ id: { bad: true } }).success).toBe(false);
  });
});

describe('Terra mapping (enums confirmés OpenAPI)', () => {
  it('mappe les catégories normalisées vers les enums Terra en majuscules', () => {
    expect(TERRA_CATEGORY).toEqual({
      attractions: 'ATTRACTION',
      restaurants: 'RESTAURANT',
      hotels: 'HOTEL',
    });
  });

  it('normalise une Location Terra vers le modèle interne (jamais le brut)', () => {
    const item = normalizeTerraLocation({
      countryCode: 'is',
      category: 'attractions',
      location: terraLocation as never,
    });

    expect(item).not.toBeNull();
    expect(item!.id).toBe('325764');
    expect(item!.name).toBe('Lagon bleu');
    expect(item!.description).toBe('Lagon géothermal.');
    expect(item!.countryCode).toBe('IS');
    expect(item!.city).toBe('Grindavík');
    expect(item!.latitude).toBeCloseTo(63.88);
    expect(item!.rating).toBe(4.5);
    expect(item!.reviewCount).toBe(12000);
    expect(item!.ratingImageUrl).toContain('static.tacdn.com');
    expect(item!.tripadvisorUrl).toContain('tripadvisor.com');
    expect(item!.category).toBe('Sources chaudes');
    expect(item!.photoUrl).toBeNull();
    expect(item!.isBookable).toBe(false);
    // Le schéma interne valide → aucune fuite de forme Terra vers l'UI.
    expect(discoveryItemSchema.safeParse(item).success).toBe(true);
    expect(JSON.stringify(item)).not.toContain('traveler_ratings');
  });

  it('n’invente pas de nom et retourne null si le nom est absent', () => {
    expect(
      normalizeTerraLocation({ countryCode: 'IS', category: 'hotels', location: { id: 1 } as never })
    ).toBeNull();
  });
});

describe('Terra client (X-API-KEY, no-store, erreurs typées)', () => {
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

  it('échoue en config si la clé Terra est absente, sans appel réseau', async () => {
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      terraSearchLocations({
        searchQuery: 'Islande',
        countryCode: 'IS',
        category: 'attractions',
        limit: 6,
      })
    ).rejects.toMatchObject({ code: 'config' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie la clé dans X-API-Key et JAMAIS dans l’URL', async () => {
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 'terra-secret');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(terraSearchBody));
    vi.stubGlobal('fetch', fetchMock);

    const items = await terraSearchLocations({
      searchQuery: 'Islande',
      countryCode: 'IS',
      category: 'hotels',
      limit: 4,
    });

    expect(items).toHaveLength(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).not.toContain('terra-secret');
    expect(calledUrl).not.toContain('key=');
    expect(calledUrl).toContain('locale=fr-FR');
    expect(calledUrl).toContain('category=HOTEL');
    expect(calledUrl).toContain('country_code=IS');
    expect(calledUrl).toContain('size=4');
    // Régressions : geo_name nulle les résultats, et la clé ne doit jamais être en URL.
    expect(calledUrl).not.toContain('geo_name');
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('terra-secret');
    expect(init.cache).toBe('no-store');
  });

  it('mappe les statuts 400/401/403/404/429/5xx vers une erreur typée', async () => {
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 'k');
    const cases: Array<[number, string]> = [
      [400, 'validation'],
      [401, 'auth'],
      [403, 'auth'],
      [404, 'not_found'],
      [429, 'quota'],
      [500, 'upstream'],
      [503, 'upstream'],
    ];
    for (const [status, code] of cases) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ detail: 'x', title: 't' }, status))
      );
      await expect(terraLocationDetails('1')).rejects.toMatchObject({ code });
      vi.unstubAllGlobals();
    }
  });

  it('rejette une réponse non JSON avec une erreur de validation', async () => {
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 'k');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('bad');
        },
      } as unknown as Response)
    );
    await expect(terraLocationDetails('1')).rejects.toMatchObject({ code: 'validation' });
  });

  it('déclenche un timeout configurable', async () => {
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 'k');
    vi.stubEnv('TRIPADVISOR_TIMEOUT_MS', '5');
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      })
    );
    await expect(terraLocationDetails('1')).rejects.toMatchObject({ code: 'timeout' });
  });

  it('ne journalise jamais la clé', async () => {
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 'leak-me-not');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    const spies = [
      vi.spyOn(console, 'error').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'log').mockImplementation(() => {}),
    ];
    await expect(terraLocationDetails('1')).rejects.toMatchObject({ code: 'upstream' });
    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain('leak-me-not');
      }
    }
  });

  it('expose un état de configuration sans valeur de clé', () => {
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', '');
    expect(isTerraConfigured()).toBe(false);
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 'real');
    expect(isTerraConfigured()).toBe(true);
  });
});

describe('Terra adapter (Search → normalisé, sans N+1)', () => {
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

  it('un seul appel Search, aucun appel Details, plafond respecté', async () => {
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 'k');
    const many = {
      data: Array.from({ length: 10 }).map((_, i) => ({
        location: { ...terraLocation, id: 1000 + i, names: [{ language: 'fr-FR', value: `Lieu ${i}` }] },
      })),
      pagination: { page: 1, size: 20, total_elements: 10, total_pages: 1 },
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(many));
    vi.stubGlobal('fetch', fetchMock);

    const items = await terraSearchByCategory({
      countryCode: 'IS',
      searchQuery: 'Islande',
      category: 'attractions',
      limit: 6,
    });

    expect(items).toHaveLength(6);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/locations/search');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/locations/1');
  });
});

describe('Sélection serveur du transport Tripadvisor', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('respecte TRIPADVISOR_PROVIDER=terra/legacy et l’absence de clé', () => {
    vi.stubEnv('TRIPADVISOR_PROVIDER', 'terra');
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 't');
    expect(selectTripadvisorTransport()).toBe('terra');
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', '');
    expect(selectTripadvisorTransport()).toBe('none');

    vi.stubEnv('TRIPADVISOR_PROVIDER', 'legacy');
    vi.stubEnv('TRIPADVISOR_API_KEY', 'l');
    expect(selectTripadvisorTransport()).toBe('legacy');
  });

  it('préfère Terra par défaut quand sa clé est présente, sinon legacy', () => {
    vi.stubEnv('TRIPADVISOR_PROVIDER', '');
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 't');
    vi.stubEnv('TRIPADVISOR_API_KEY', 'l');
    expect(selectTripadvisorTransport()).toBe('terra');

    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', '');
    expect(selectTripadvisorTransport()).toBe('legacy');

    vi.stubEnv('TRIPADVISOR_API_KEY', '');
    expect(isTripadvisorConfigured()).toBe(false);
  });

  it('dispatche vers Terra (pas de Details) quand le transport est terra', async () => {
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', 'k');
    vi.stubEnv('TRIPADVISOR_PROVIDER', 'terra');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(terraSearchBody));
    vi.stubGlobal('fetch', fetchMock);

    const items = await tripadvisorSearchByCategory({
      countryCode: 'IS',
      searchQuery: 'Islande',
      category: 'attractions',
      limit: 6,
    });

    expect(items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('terra.tripadvisor.com');
    vi.unstubAllGlobals();
  });

  it('conserve le provider legacy inchangé (Search + Details)', async () => {
    vi.stubEnv('TRIPADVISOR_TERRA_API_KEY', '');
    vi.stubEnv('TRIPADVISOR_API_KEY', 'legacy-key');
    vi.stubEnv('TRIPADVISOR_PROVIDER', 'legacy');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ location_id: 9, name: 'X', address_obj: { city: 'Reykjavík' } }] })
      )
      .mockResolvedValueOnce(
        jsonResponse({ name: 'X', rating: '4.0', num_reviews: '10', web_url: 'https://www.tripadvisor.com/x' })
      );
    vi.stubGlobal('fetch', fetchMock);

    const items = await tripadvisorSearchByCategory({
      countryCode: 'IS',
      searchQuery: 'Islande',
      category: 'attractions',
      limit: 1,
    });

    expect(items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.content.tripadvisor.com');
    vi.unstubAllGlobals();
  });
});
