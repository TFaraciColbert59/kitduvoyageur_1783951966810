import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  VIATOR_ALLOWED_HOSTS,
  normalizeViatorProduct,
  validateViatorUrl,
  viatorSearchByCategory,
} from '@/features/discovery/providers/viator/viatorAdapter';
import { isViatorConfigured, viatorSearchProducts } from '@/features/discovery/providers/viator/viatorClient';
import {
  resolveViatorDestinationId,
  VIATOR_DESTINATION_IDS,
} from '@/features/discovery/providers/viator/viatorData';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const rawProduct = {
  productCode: '227717P1',
  title: 'Tour privé du Mont Fuji',
  description: 'Une journée guidée.',
  images: [
    {
      imageSource: 'SUPPLIER_PROVIDED',
      isCover: true,
      variants: [
        {
          width: 100,
          height: 100,
          url: 'https://media-cdn.tripadvisor.com/media/attractions-splice-spp-100x100/15/1b/87/e6.jpg',
        },
        {
          width: 400,
          height: 400,
          url: 'https://media-cdn.tripadvisor.com/media/attractions-splice-spp-400x400/15/1b/87/e6.jpg',
        },
        {
          width: 1200,
          height: 1200,
          url: 'https://media-cdn.tripadvisor.com/media/attractions-splice-spp-1200x1200/15/1b/87/e6.jpg',
        },
      ],
    },
  ],
  reviews: { totalReviews: 120, combinedAverageRating: 4.7 },
  pricing: { summary: { fromPrice: 89.5 }, currency: 'EUR' },
  productUrl: 'https://www.viator.com/tours/X/d123-227717P1?mcid=1&pid=P1&medium=api',
  destinations: [{ ref: '15', primary: true }],
  flags: ['FREE_CANCELLATION'],
};

describe('Validation des URLs Viator', () => {
  it('accepte uniquement https + domaine viator.com', () => {
    const ok = validateViatorUrl(rawProduct.productUrl);
    expect(ok).toContain('viator.com');
    expect(VIATOR_ALLOWED_HOSTS).toContain('viator.com');
  });

  it('rejette http, javascript:, data: et domaines arbitraires', () => {
    for (const bad of [
      'http://www.viator.com/x',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'https://evil.example/viator',
      'https://viator.com.evil.example/',
      'https://user:pass@www.viator.com/x',
    ]) {
      expect(validateViatorUrl(bad)).toBeNull();
    }
  });
});

describe('Mapping destination Viator par pays (aucun ID global)', () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it('aucun ID inventé : code inconnu → null', () => {
    expect(VIATOR_DESTINATION_IDS.IS).toBeDefined();
    expect(resolveViatorDestinationId('ZZ')).toBeNull();
    expect(resolveViatorDestinationId('../etc')).toBeNull();
  });

  it('env JSON par pays prioritaire sur la table embarquée', () => {
    vi.stubEnv('VIATOR_DESTINATION_IDS', JSON.stringify({ IS: '111', FR: '222' }));
    expect(resolveViatorDestinationId('is')).toBe('111');
    expect(resolveViatorDestinationId('FR')).toBe('222');
    expect(resolveViatorDestinationId('JP')).toBe('334'); // table embarquée (Tokyo)
  });

  it('rejette un ID non numérique', () => {
    vi.stubEnv('VIATOR_DESTINATION_IDS', JSON.stringify({ IS: 'abc' }));
    expect(resolveViatorDestinationId('IS')).toBeNull();
  });
});

describe('Mapping produit Viator (modèle normalisé)', () => {
  it('normalise tous les champs disponibles', () => {
    const item = normalizeViatorProduct({
      countryCode: 'jp',
      category: 'attractions',
      product: rawProduct as never,
    });
    expect(item).not.toBeNull();
    expect(item!.id).toBe('227717P1');
    expect(item!.provider).toBe('viator');
    expect(item!.type).toBe('attractions');
    expect(item!.name).toBe('Tour privé du Mont Fuji');
    expect(item!.description).toBe('Une journée guidée.');
    expect(item!.countryCode).toBe('JP');
    expect(item!.photoUrl).toContain('spp-400x400');
    expect(item!.photoUrl).toContain('media-cdn.tripadvisor.com');
    expect(item!.rating).toBe(4.7);
    expect(item!.reviewCount).toBe(120);
    expect(item!.priceFrom).toBe(89.5);
    expect(item!.currency).toBe('EUR');
    expect(item!.freeCancellation).toBe(true);
    expect(item!.affiliateUrl).toContain('viator.com');
    expect(item!.productCode).toBe('227717P1');
    expect(item!.isBookable).toBe(false);
    expect(item!.bookingMode).toBe('external');
    expect(item!.bookingProvider).toBe('viator');
    expect(JSON.stringify(item)).not.toContain('combinedAverageRating');
  });

  it('ne fabrique ni image, ni prix, ni note, ni avis quand absents', () => {
    const item = normalizeViatorProduct({
      countryCode: 'JP',
      category: 'attractions',
      product: {
        productCode: 'X1',
        title: 'Sans données',
        images: [],
        reviews: { totalReviews: 0, combinedAverageRating: 0 },
        pricing: { summary: { fromPrice: null }, currency: 'EUR' },
        productUrl: null,
        flags: [],
      } as never,
    });
    expect(item!.photoUrl).toBeNull();
    expect(item!.priceFrom).toBeNull();
    expect(item!.rating).toBeNull();
    expect(item!.reviewCount).toBeNull();
    expect(item!.freeCancellation).toBeNull();
    expect(item!.affiliateUrl).toBeNull();
  });

  it('ignore un libellé imageSource (SUPPLIER_PROVIDED) et utilise variants', () => {
    const item = normalizeViatorProduct({
      countryCode: 'JP',
      category: 'attractions',
      product: {
        productCode: 'I1',
        title: 'T',
        images: [
          {
            isCover: true,
            imageSource: 'SUPPLIER_PROVIDED',
            variants: [
              { width: 400, height: 400, url: 'https://media-cdn.tripadvisor.com/x-400x400.jpg' },
            ],
          },
        ],
      } as never,
    });
    expect(item!.photoUrl).toBe('https://media-cdn.tripadvisor.com/x-400x400.jpg');
  });

  it('rejette une image sur un hôte non autorisé', () => {
    const item = normalizeViatorProduct({
      countryCode: 'JP',
      category: 'attractions',
      product: {
        productCode: 'I2',
        title: 'T',
        images: [{ isCover: true, variants: [{ width: 400, height: 400, url: 'https://evil.example/x.jpg' }] }],
      } as never,
    });
    expect(item!.photoUrl).toBeNull();
  });

  it('utilise imageSource quand c’est une vraie URL autorisée', () => {
    const item = normalizeViatorProduct({
      countryCode: 'JP',
      category: 'attractions',
      product: {
        productCode: 'I3',
        title: 'T',
        images: [
          { isCover: true, imageSource: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/x.jpg' },
        ],
      } as never,
    });
    expect(item!.photoUrl).toContain('dynamic-media-cdn.tripadvisor.com');
  });

  it('écarte un produit sans titre', () => {
    expect(
      normalizeViatorProduct({
        countryCode: 'JP',
        category: 'attractions',
        product: { productCode: 'X', title: '' } as never,
      })
    ).toBeNull();
  });
});

describe('Client Viator (exp-api-key, no-store, erreurs typées)', () => {
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

  it('échoue en config si la clé est absente, sans appel réseau', async () => {
    vi.stubEnv('VIATOR_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      viatorSearchProducts({ destinationId: '15', category: 'attractions', limit: 6, countryCode: 'JP' })
    ).rejects.toMatchObject({ code: 'config' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isViatorConfigured()).toBe(false);
  });

  it('POST /products/search : clé en header, jamais en URL ; body correct', async () => {
    vi.stubEnv('VIATOR_API_KEY', 'viator-secret');
    vi.stubEnv('VIATOR_API_BASE_URL', 'https://api.viator.com/partner');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ products: [rawProduct], totalCount: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const products = await viatorSearchProducts({
      destinationId: '15',
      category: 'attractions',
      limit: 6,
      countryCode: 'JP',
    });

    expect(products).toHaveLength(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('/products/search');
    expect(calledUrl).not.toContain('viator-secret');
    expect(calledUrl).not.toContain('exp-api-key');
    expect((init.headers as Record<string, string>)['exp-api-key']).toBe('viator-secret');
    expect((init.headers as Record<string, string>)['Accept']).toContain('version=2.0');
    expect(init.method).toBe('POST');
    expect(init.cache).toBe('no-store');
    const body = JSON.parse(String(init.body));
    expect(body.filtering).toEqual({ destination: '15' });
    expect(body.pagination).toEqual({ start: 1, count: 6 });
    expect(body.currency).toBe('EUR');
  });

  it('ignore un produit invalide sans casser la réponse', async () => {
    vi.stubEnv('VIATOR_API_KEY', 'k');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ products: [rawProduct, { bad: true }], totalCount: 2 }))
    );
    const products = await viatorSearchProducts({
      destinationId: '15',
      category: 'attractions',
      limit: 6,
      countryCode: 'JP',
    });
    expect(products).toHaveLength(1);
  });

  it('mappe 400/401/403/404/429/5xx vers une erreur typée', async () => {
    vi.stubEnv('VIATOR_API_KEY', 'k');
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
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'x' }, status)));
      await expect(
        viatorSearchProducts({ destinationId: '15', category: 'attractions', limit: 6, countryCode: 'JP' })
      ).rejects.toMatchObject({ code });
      vi.unstubAllGlobals();
    }
  });

  it('timeout configurable', async () => {
    vi.stubEnv('VIATOR_API_KEY', 'k');
    vi.stubEnv('VIATOR_TIMEOUT_MS', '5');
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      })
    );
    await expect(
      viatorSearchProducts({ destinationId: '15', category: 'attractions', limit: 6, countryCode: 'JP' })
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('rejette une réponse non JSON', async () => {
    vi.stubEnv('VIATOR_API_KEY', 'k');
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
    await expect(
      viatorSearchProducts({ destinationId: '15', category: 'attractions', limit: 6, countryCode: 'JP' })
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('ne journalise jamais la clé', async () => {
    vi.stubEnv('VIATOR_API_KEY', 'leak-me-not');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    const spies = [
      vi.spyOn(console, 'error').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'log').mockImplementation(() => {}),
    ];
    await expect(
      viatorSearchProducts({ destinationId: '15', category: 'attractions', limit: 6, countryCode: 'JP' })
    ).rejects.toMatchObject({ code: 'upstream' });
    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain('leak-me-not');
      }
    }
  });

  it('plafonne à `limit` (≤ 6 en v1), sans pagination', async () => {
    vi.stubEnv('VIATOR_API_KEY', 'k');
    const many = {
      products: Array.from({ length: 10 }).map((_, i) => ({ ...rawProduct, productCode: `P${i}` })),
      totalCount: 10,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(many));
    vi.stubGlobal('fetch', fetchMock);

    const items = await viatorSearchByCategory({
      destinationId: '15',
      category: 'attractions',
      limit: 6,
      countryCode: 'JP',
    });
    expect(items).toHaveLength(6);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.pagination).toEqual({ start: 1, count: 6 });
  });
});
