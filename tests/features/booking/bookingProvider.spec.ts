import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOKING_PROVIDER_ERROR_CODES,
  BookingProviderError,
  createBookingProvider,
  createRouteStackBookingProvider,
  createViatorBookingProvider,
  type BookingProviderEnv,
  type BookingProviderRouter,
  type BookingSearchRequest,
  type RouteStackToolCaller,
} from '@/features/booking/server/bookingProvider';
import { createRouteStackSessionKey } from '@/features/booking/server/routeStackBookingProvider';

const sdkMock = vi.hoisted(() => ({
  streamableConnectOutcomes: [] as Array<'ok' | 'transport-mismatch' | 'error'>,
  sseConnectOutcomes: [] as Array<'ok' | 'error'>,
  toolOutcomes: [] as unknown[],
  toolCalls: [] as Array<{ name: string; arguments?: Record<string, unknown> }>,
  streamableUrls: [] as string[],
  sseUrls: [] as string[],
  authorizationHeaders: [] as Array<string | undefined>,
  closedClients: 0,
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  class Client {
    async connect(transport: { kind: string }) {
      if (transport.kind === 'streamable-http') {
        const outcome = sdkMock.streamableConnectOutcomes.shift() ?? 'ok';
        if (outcome === 'transport-mismatch') throw new Error('404 Not Found');
        if (outcome === 'error') throw new Error('connect failed');
        return;
      }
      const outcome = sdkMock.sseConnectOutcomes.shift() ?? 'ok';
      if (outcome === 'error') throw new Error('sse connect failed');
    }

    async callTool(input: { name: string; arguments?: Record<string, unknown> }) {
      sdkMock.toolCalls.push(input);
      const outcome = sdkMock.toolOutcomes.shift();
      if (outcome instanceof Error) throw outcome;
      return outcome ?? { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
    }

    async close() {
      sdkMock.closedClients += 1;
    }
  }

  return { Client };
});

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class {
    readonly kind = 'streamable-http';
    constructor(url: URL, options: { requestInit?: { headers?: Record<string, string> } }) {
      sdkMock.streamableUrls.push(url.toString());
      sdkMock.authorizationHeaders.push(options.requestInit?.headers?.Authorization);
    }
  },
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: class {
    readonly kind = 'sse';
    constructor(url: URL, options: { requestInit?: { headers?: Record<string, string> } }) {
      sdkMock.sseUrls.push(url.toString());
      sdkMock.authorizationHeaders.push(options.requestInit?.headers?.Authorization);
    }
  },
}));

beforeEach(() => {
  sdkMock.streamableConnectOutcomes.length = 0;
  sdkMock.sseConnectOutcomes.length = 0;
  sdkMock.toolOutcomes.length = 0;
  sdkMock.toolCalls.length = 0;
  sdkMock.streamableUrls.length = 0;
  sdkMock.sseUrls.length = 0;
  sdkMock.authorizationHeaders.length = 0;
  sdkMock.closedClients = 0;
  vi.unstubAllGlobals();
});

const flightRequest: BookingSearchRequest = {
  vertical: 'flight',
  origin: 'CDG',
  destination: 'NRT',
  departure: '2026-11-12',
  return: '2026-11-21',
  travelers: 2,
  currency: 'EUR',
  limit: 5,
};

function env(values: BookingProviderEnv): BookingProviderEnv {
  return values;
}

describe('BookingProvider — contrat commun', () => {
  it('expose une factory stable et un provider indisponible quand aucun fournisseur n’est activé', async () => {
    const provider = createBookingProvider({ env: env({}) });

    expect(provider.id).toBe('router');
    expect(provider.mode).toBe('disabled');
    expect(provider.isConfigured()).toBe(false);
    expect(provider.supportedVerticals).toEqual([]);
    await expect(provider.search(flightRequest)).rejects.toMatchObject({
      code: BOOKING_PROVIDER_ERROR_CODES.unavailable,
    });
  });

  it('sélectionne RouteStack via le serveur sans exposer la clé', () => {
    const provider = createBookingProvider({
      env: env({
        BOOKING_PROVIDER: 'routestack',
        ROUTESTACK_API_KEY: 'server-only-key',
      }),
    });

    expect(provider.id).toBe('router');
    expect(provider.providerFor('flight').id).toBe('routestack');
    expect(provider.isConfigured()).toBe(true);
    expect(JSON.stringify(provider)).not.toContain('server-only-key');
  });
});

describe('BookingProvider — routage par verticale', () => {
  it('routes les verticales de transport vers RouteStack et les activités vers Viator', async () => {
    const router = createBookingProvider({
      env: env({
        BOOKING_PROVIDER: 'auto',
        ROUTESTACK_API_KEY: 'route-key',
        VIATOR_API_KEY: 'viator-key',
      }),
    }) as BookingProviderRouter;

    expect(router.id).toBe('router');
    expect(router.supportedVerticals).toEqual(['flight', 'hotel', 'car', 'activity']);
    expect(router.providerFor('flight').id).toBe('routestack');
    expect(router.providerFor('hotel').id).toBe('routestack');
    expect(router.providerFor('car').id).toBe('routestack');
    expect(router.providerFor('activity').id).toBe('viator');
  });

  it('refuse une destination de ville non résolue sans envoyer de requête Viator', async () => {
    const searchProducts = vi.fn();
    const provider = createViatorBookingProvider({
      env: env({ VIATOR_API_KEY: 'k' }),
      searchProducts,
    });

    await expect(
      provider.search({
        vertical: 'activity',
        destination: 'Ville Inconnue',
        date: '2026-11-12',
      })
    ).rejects.toMatchObject({ code: BOOKING_PROVIDER_ERROR_CODES.validation });
    expect(searchProducts).not.toHaveBeenCalled();
  });

  it('rejette les dates calendaires impossibles et les périodes inversées', async () => {
    await expect(
      createRouteStackBookingProvider({ env: env({ ROUTESTACK_API_KEY: 'k' }) }).search({
        vertical: 'hotel',
        destination: '235402',
        checkIn: '2026-02-31',
        checkOut: '2026-03-01',
      })
    ).rejects.toMatchObject({ code: BOOKING_PROVIDER_ERROR_CODES.validation });
  });
});
describe('RouteStackBookingProvider', () => {
  it('valide la requête avant de contacter le MCP', async () => {
    const callTool = vi.fn<RouteStackToolCaller>();
    const provider = createRouteStackBookingProvider({
      env: env({ ROUTESTACK_API_KEY: 'k' }),
      callTool,
    });

    await expect(
      provider.search({ vertical: 'flight', origin: 'CDG' } as unknown as BookingSearchRequest)
    ).rejects.toMatchObject({ code: BOOKING_PROVIDER_ERROR_CODES.validation });
    expect(callTool).not.toHaveBeenCalled();
  });

  it('normalise les offres JSON du MCP et refuse les liens non https', async () => {
    const callTool = vi.fn<RouteStackToolCaller>().mockResolvedValue({
      isError: false,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            offers: [
              {
                id: 'hotel-1',
                name: 'Hôtel Test',
                description: 'Chambre double',
                amount: 189.5,
                currency: 'EUR',
                deeplink: 'https://routestack.ai/book/hotel-1',
              },
              {
                id: 'hotel-2',
                name: 'Lien douteux',
                amount: 90,
                currency: 'EUR',
                deeplink: 'javascript:alert(1)',
              },
            ],
          }),
        },
      ],
    });
    const provider = createRouteStackBookingProvider({
      env: env({ ROUTESTACK_API_KEY: 'k' }),
      callTool,
    });

    const result = await provider.search({
      vertical: 'hotel',
      destination: '235402',
      checkIn: '2026-11-12',
      checkOut: '2026-11-21',
      travelers: 2,
    });

    expect(callTool).toHaveBeenCalledWith('hotel_search', {
      destinationId: '235402',
      checkIn: '2026-11-12',
      checkOut: '2026-11-21',
      rooms: [{ adults: 2, children: 0 }],
      lat: 0,
      long: 0,
      currency: 'EUR',
      page: 1,
      limit: 5,
    });
    expect(result.provider).toBe('routestack');
    expect(result.offers).toHaveLength(2);
    expect(result.offers[0]).toMatchObject({
      id: 'hotel-1',
      title: 'Hôtel Test',
      amount: 189.5,
      currency: 'EUR',
      deeplink: 'https://routestack.ai/book/hotel-1',
    });
    expect(result.offers[1]).toMatchObject({ id: 'hotel-2', deeplink: null });
    expect(result.offers[0].untitled).toBeUndefined();
  });

  it('signale une offre que RouteStack ne nomme pas (titre de repli)', async () => {
    const callTool = vi.fn<RouteStackToolCaller>().mockResolvedValue({
      isError: false,
      content: [{ type: 'text', text: JSON.stringify({ offers: [{ id: 'hotel-3', amount: 70 }] }) }],
    });
    const provider = createRouteStackBookingProvider({
      env: env({ ROUTESTACK_API_KEY: 'k' }),
      callTool,
    });

    const result = await provider.search({
      vertical: 'hotel',
      destination: 'Villard-de-Lans',
      checkIn: '2026-11-12',
      checkOut: '2026-11-13',
      travelers: 1,
    });

    expect(result.offers[0]).toMatchObject({ title: 'Hôtel · Villard-de-Lans', untitled: true });
  });

  it('normalise les erreurs HTTP et les réponses isError en BookingProviderError', async () => {
    const callTool = vi.fn<RouteStackToolCaller>().mockRejectedValue(
      Object.assign(new Error('rate limited'), { status: 429 })
    );
    const provider = createRouteStackBookingProvider({
      env: env({ ROUTESTACK_API_KEY: 'k' }),
      callTool,
    });

    await expect(
      provider.search({
        vertical: 'hotel',
        destination: 'Tokyo',
        checkIn: '2026-11-12',
        checkOut: '2026-11-21',
      })
    ).rejects.toMatchObject({ code: BOOKING_PROVIDER_ERROR_CODES.quota, retryable: true });

    callTool.mockResolvedValueOnce({
      isError: true,
      content: [{ type: 'text', text: 'tool unavailable' }],
    });
    await expect(
      provider.search({
        vertical: 'hotel',
        destination: 'Tokyo',
        checkIn: '2026-11-12',
        checkOut: '2026-11-21',
      })
    ).rejects.toBeInstanceOf(BookingProviderError);
  });
  it('utilise les noms d’outils et filtres officiels RouteStack', async () => {
    const callTool = vi.fn<RouteStackToolCaller>()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ result: [] }) }],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ result: [{ id: 'TYO', code: 'Tokyo' }] }) }],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ result: [] }) }],
      });
    const provider = createRouteStackBookingProvider({
      env: env({ ROUTESTACK_API_KEY: 'official-tools-key' }),
      callTool,
    });

    await provider.search(flightRequest);
    expect(callTool).toHaveBeenNthCalledWith(1, 'flight_search', {
      filter: {
        origin: 'CDG',
        destination: 'NRT',
        departureDate: '2026-11-12',
        returnDate: '2026-11-21',
        adults: 2,
        cabinClass: 'economy',
        tripType: 'round_trip',
      },
    });

    await provider.search({
      vertical: 'car',
      destination: 'Tokyo',
      pickupAt: '2026-11-12T10:00:00Z',
      dropoffAt: '2026-11-21T10:00:00Z',
      travelers: 1,
    });
    expect(callTool).toHaveBeenNthCalledWith(2, 'car_locations', { query: 'Tokyo' });
    expect(callTool).toHaveBeenNthCalledWith(3, 'car_search', {
      filter: {
        pickup: { type: 'city', code: 'Tokyo' },
        dropoff: { type: 'city', code: 'Tokyo' },
        pickupDate: '2026-11-12T10:00:00Z',
        dropoffDate: '2026-11-21T10:00:00Z',
        driverAge: 30,
      },
    });
  });

  it('normalise les structures RouteStack imbriquées sans inventer de prix', async () => {
    const callTool = vi.fn<RouteStackToolCaller>().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            result: {
              currency: 'EUR',
              correlationId: 'corr-1',
              result: [
                {
                  fareSourceCode: 'AF-123',
                  flights: [
                    { from: 'CDG', to: 'NRT', airline: 'Air France', flightCode: 'AF274' },
                  ],
                  ourprice: 642.4,
                },
              ],
            },
          }),
        },
      ],
    });
    const provider = createRouteStackBookingProvider({
      env: env({ ROUTESTACK_API_KEY: 'nested-shape-key' }),
      callTool,
    });

    const result = await provider.search(flightRequest);

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).toMatchObject({
      id: 'AF-123',
      title: 'CDG → NRT',
      amount: 642.4,
      currency: 'EUR',
      deeplink: null,
    });
  });

  it('hache la clé de cache et ne conserve jamais la clé brute en mémoire', () => {
    const key = createRouteStackSessionKey({
      ROUTESTACK_API_KEY: 'raw-secret-key',
      ROUTESTACK_MCP_URL: 'https://mcp.routestack.ai/sse',
    });

    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain('raw-secret-key');
  });

  it('authentifie par partner-token puis utilise le transport Streamable HTTP', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'partner-token-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    sdkMock.streamableConnectOutcomes.push('ok');
    sdkMock.toolOutcomes.push({
      content: [{ type: 'text', text: JSON.stringify({ result: [] }) }],
    });
    const provider = createRouteStackBookingProvider({
      env: env({
        ROUTESTACK_API_KEY: 'partner-key',
        ROUTESTACK_API_SECRET: 'partner-secret',
      }),
    });

    await provider.search(flightRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [tokenUrl, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(tokenUrl.toString()).toBe('https://mcp.routestack.ai/mcp/auth/partner-token');
    const body = JSON.parse(String(init.body)) as {
      apiKey: string;
      hmac: string;
      timestamp: number;
      nonce: string;
    };
    expect(body.apiKey).toBe('partner-key');
    expect(body.hmac).toBe(
      createHmac('sha256', 'partner-secret')
        .update(`${body.apiKey}:${body.timestamp}:${body.nonce}`)
        .digest('base64url')
    );
    expect(sdkMock.streamableUrls).toEqual(['https://mcp.routestack.ai/sse']);
    expect(sdkMock.sseUrls).toEqual([]);
    expect(sdkMock.authorizationHeaders).toEqual(['Bearer partner-token-1']);
  });

  it('replie sur SSE puis referme la session et se reconnecte après une erreur', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: 'partner-token-2' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    sdkMock.streamableConnectOutcomes.push('transport-mismatch', 'ok');
    sdkMock.sseConnectOutcomes.push('ok', 'ok');
    sdkMock.toolOutcomes.push(
      Object.assign(new Error('session expired'), { status: 401 }),
      { content: [{ type: 'text', text: JSON.stringify({ result: [] }) }] }
    );
    const provider = createRouteStackBookingProvider({
      env: env({
        ROUTESTACK_API_KEY: 'fallback-key',
        ROUTESTACK_API_SECRET: 'fallback-secret',
      }),
    });

    await expect(provider.search(flightRequest)).rejects.toMatchObject({
      code: BOOKING_PROVIDER_ERROR_CODES.auth,
    });
    expect(sdkMock.sseUrls).toHaveLength(1);

    await expect(provider.search(flightRequest)).resolves.toMatchObject({
      provider: 'routestack',
    });
    expect(sdkMock.closedClients).toBeGreaterThanOrEqual(1);
    expect(sdkMock.streamableUrls).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('ViatorBookingProvider', () => {
  it('reste en sandbox par défaut', () => {
    const provider = createViatorBookingProvider({
      env: env({ VIATOR_API_KEY: 'k' }),
      searchProducts: vi.fn(),
    });

    expect(provider.mode).toBe('sandbox');
    expect(provider.isConfigured()).toBe(true);
  });

  it('bloque le mode full tant que le flag explicite n’est pas activé', async () => {
    const searchProducts = vi.fn();
    const provider = createViatorBookingProvider({
      env: env({ VIATOR_API_KEY: 'k', VIATOR_BOOKING_MODE: 'full' }),
      searchProducts,
    });

    expect(provider.mode).toBe('disabled');
    expect(provider.isConfigured()).toBe(false);
    await expect(
      provider.search({
        vertical: 'activity',
        destination: 'Tokyo',
        date: '2026-11-12',
      })
    ).rejects.toMatchObject({ code: BOOKING_PROVIDER_ERROR_CODES.config });
    expect(searchProducts).not.toHaveBeenCalled();
  });

  it('convertit les produits Viator en offres et conserve le mode sandbox', async () => {
    const searchProducts = vi.fn().mockResolvedValue([
      {
        productCode: 'P1',
        title: 'Atelier de sushi',
        description: 'Cours pratique',
        pricing: { summary: { fromPrice: 55 }, currency: 'EUR' },
        productUrl: 'https://www.viator.com/tours/X/d123-P1',
        duration: { fixedDurationInMinutes: 120 },
      },
    ]);
    const provider = createViatorBookingProvider({
      env: env({ VIATOR_API_KEY: 'k' }),
      searchProducts,
    });

    const result = await provider.search({
      vertical: 'activity',
      destination: 'Tokyo',
      date: '2026-11-12',
      travelers: 2,
    });

    expect(searchProducts).toHaveBeenCalledWith(expect.objectContaining({
      destination: 'Tokyo',
      date: '2026-11-12',
      travelers: 2,
      limit: 5,
    }));
    expect(result.offers[0]).toMatchObject({
      id: 'P1',
      title: 'Atelier de sushi',
      amount: 55,
      currency: 'EUR',
      deeplink: 'https://www.viator.com/tours/X/d123-P1',
    });
  });
});




