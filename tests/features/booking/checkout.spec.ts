import { describe, expect, it, vi } from 'vitest';

import {
  BOOKING_PROVIDER_ERROR_CODES,
  createRouteStackBookingProvider,
  createViatorBookingProvider,
  type BookingCandidate,
  type RouteStackToolCaller,
} from '@/features/booking/server/bookingProvider';

/**
 * W5 / D-03 — moitie `checkout` du contrat BookingProvider.
 *
 * Le point le plus sensible n'est pas le deeplink mais le cloisonnement des
 * identifiants : `routestack_external_userid` identifie NOTRE utilisateur chez
 * le fournisseur, `routestack_metadata` porte le contexte du voyage. Les deux
 * n'ont de sens que sur `get-payment-url`. Les fuiter sur une recherche
 * exposerait l'identifiant a tout appel, et `routestack_accountid` ne doit
 * jamais partir (D-06 / D-21).
 */
const ROUTESTACK_ENV = {
  ROUTESTACK_MODE: 'sandbox',
  ROUTESTACK_SANDBOX_API_KEY: 'k',
  ROUTESTACK_SANDBOX_PARTNER_SECRET: 's',
} as const;

const flightCandidate: BookingCandidate = {
  id: 'FL-1',
  provider: 'routestack',
  vertical: 'flight',
  title: 'CDG -> NRT',
  description: null,
  amount: 640.5,
  currency: 'EUR',
  deeplink: 'https://mcp.routestack.ai/pay/abc',
  bookingKind: 'deeplink',
  requiresRevalidation: false,
  providerReference: 'FL-1',
  metadata: { origin: 'CDG', destination: 'NRT' },
};

const toolPayload = (payload: unknown) => ({
  content: [{ type: 'text', text: JSON.stringify(payload) }],
});

describe('RouteStack checkoutUrl — cloisonnement des identifiants', () => {
  it('get-payment-url porte external_userid et metadata, jamais accountid', async () => {
    const callTool = vi
      .fn<RouteStackToolCaller>()
      .mockResolvedValue(toolPayload({ url: 'https://mcp.routestack.ai/pay/xyz' }));
    const provider = createRouteStackBookingProvider({ env: { ...ROUTESTACK_ENV }, callTool });

    const result = await provider.checkoutUrl(flightCandidate, {
      tripId: 'trip-1',
      userId: 'user-42',
      campaign: 'lkdv-prepare',
    });

    expect(callTool).toHaveBeenCalledTimes(1);
    const [name, args] = callTool.mock.calls[0];
    expect(name).toBe('get-payment-url');
    expect(args.routestack_external_userid).toBe('user-42');
    expect(args.routestack_metadata).toEqual({
      trip_id: 'trip-1',
      vertical: 'flight',
      campaign: 'lkdv-prepare',
    });
    expect(args.routestack_accountid).toBeUndefined();
    expect(result.mode).toBe('deeplink');
  });

  it('aucun identifiant de compte ne fuite dans les outils de recherche', async () => {
    const callTool = vi.fn<RouteStackToolCaller>().mockResolvedValue(toolPayload({ result: [] }));
    const provider = createRouteStackBookingProvider({ env: { ...ROUTESTACK_ENV }, callTool });

    await provider
      .search({
        vertical: 'flight',
        origin: 'CDG',
        destination: 'NRT',
        departure: '2026-11-12',
        travelers: 2,
      })
      .catch(() => undefined);

    expect(callTool).toHaveBeenCalled();
    for (const [, args] of callTool.mock.calls) {
      expect(args.routestack_external_userid).toBeUndefined();
      expect(args.routestack_metadata).toBeUndefined();
      expect(args.routestack_accountid).toBeUndefined();
    }
  });

  it('deeplink hors allowlist est refuse plutot que retourne', async () => {
    const callTool = vi
      .fn<RouteStackToolCaller>()
      .mockResolvedValue(toolPayload({ url: 'https://evil.example.com/pay' }));
    const provider = createRouteStackBookingProvider({ env: { ...ROUTESTACK_ENV }, callTool });

    const result = await provider.checkoutUrl(flightCandidate, {
      tripId: 'trip-1',
      userId: 'user-42',
    });

    expect(result.url).toBeNull();
  });
});

describe('RouteStack checkoutUrl — modes de checkout', () => {
  it('checkoutMode deeplink (defaut) retourne l URL', async () => {
    const callTool = vi
      .fn<RouteStackToolCaller>()
      .mockResolvedValue(toolPayload({ url: 'https://mcp.routestack.ai/pay/xyz' }));
    const provider = createRouteStackBookingProvider({ env: { ...ROUTESTACK_ENV }, callTool });

    const result = await provider.checkoutUrl(flightCandidate, {
      tripId: 'trip-1',
      userId: 'user-42',
    });
    expect(result.mode).toBe('deeplink');
    expect(result.url).toContain('routestack.ai');
  });

  it('checkoutMode acp est gere et ne renvoie pas de deeplink', async () => {
    const callTool = vi
      .fn<RouteStackToolCaller>()
      .mockResolvedValue(toolPayload({ url: 'https://mcp.routestack.ai/pay/xyz' }));
    const provider = createRouteStackBookingProvider({
      env: { ...ROUTESTACK_ENV, ROUTESTACK_CHECKOUT_MODE: 'acp' },
      callTool,
    });

    const result = await provider.checkoutUrl(flightCandidate, {
      tripId: 'trip-1',
      userId: 'user-42',
    });
    expect(result.mode).toBe('acp');
    expect(result.url).toBeNull();
    expect(callTool).toHaveBeenCalledTimes(1);
  });
});

describe('RouteStack checkoutUrl — 401 et 402', () => {
  it('401 declenche un renouvellement puis un nouvel essai', async () => {
    const authError = Object.assign(new Error('unauthorized'), { status: 401 });
    const callTool = vi
      .fn<RouteStackToolCaller>()
      .mockRejectedValueOnce(authError)
      .mockResolvedValueOnce(toolPayload({ url: 'https://mcp.routestack.ai/pay/after-refresh' }));

    const provider = createRouteStackBookingProvider({ env: { ...ROUTESTACK_ENV }, callTool });
    const result = await provider.checkoutUrl(flightCandidate, {
      tripId: 'trip-1',
      userId: 'user-42',
    });

    expect(callTool).toHaveBeenCalledTimes(2);
    expect(result.url).toContain('after-refresh');
  });

  it('402 remonte une erreur quota typee, sans reessai infini', async () => {
    const quotaError = Object.assign(new Error('payment required'), { status: 402 });
    const callTool = vi.fn<RouteStackToolCaller>().mockRejectedValue(quotaError);

    const provider = createRouteStackBookingProvider({ env: { ...ROUTESTACK_ENV }, callTool });

    await expect(
      provider.checkoutUrl(flightCandidate, { tripId: 'trip-1', userId: 'user-42' })
    ).rejects.toMatchObject({ code: BOOKING_PROVIDER_ERROR_CODES.quota });

    expect(callTool).toHaveBeenCalledTimes(1);
  });

  it('checkout sans configuration echoue en config, sans appel reseau', async () => {
    const callTool = vi.fn<RouteStackToolCaller>();
    const provider = createRouteStackBookingProvider({
      env: { ROUTESTACK_MODE: 'production', ROUTESTACK_SANDBOX_API_KEY: 'k' },
      callTool,
    });

    await expect(
      provider.checkoutUrl(flightCandidate, { tripId: 'trip-1', userId: 'user-42' })
    ).rejects.toMatchObject({ code: BOOKING_PROVIDER_ERROR_CODES.config });
    expect(callTool).not.toHaveBeenCalled();
  });
});

describe('Viator checkoutUrl — externe sous attribution', () => {
  const activityCandidate: BookingCandidate = {
    id: 'ACT-1',
    provider: 'viator',
    vertical: 'activity',
    title: 'Visite guidee',
    description: null,
    amount: 42,
    currency: 'EUR',
    deeplink: 'https://www.viator.com/experiences/1',
    bookingKind: 'deeplink',
    requiresRevalidation: false,
    providerReference: '1',
    metadata: {},
  };

  it('mode external, URL porte l attribution quand elle est configuree', async () => {
    const provider = createViatorBookingProvider({
      env: {
        VIATOR_MODE: 'full',
        VIATOR_FULL_API_KEY: 'k',
        VIATOR_BOOKING_ENABLED: 'true',
        VIATOR_PID: '123456789',
        VIATOR_CAMPAIGN: 'lkdv-prepare',
      },
      searchProducts: vi.fn(),
    });

    const result = await provider.checkoutUrl(activityCandidate, {
      tripId: 'trip-1',
      userId: 'user-42',
    });

    expect(result.mode).toBe('external');
    expect(result.url).toContain('pid=123456789');
    expect(result.url).toContain('campaign=lkdv-prepare');
    expect(result.url).toContain('medium=api');
  });

  it('reservation verrouillee -> refus, pas de lien externe', async () => {
    const provider = createViatorBookingProvider({
      env: { VIATOR_MODE: 'full', VIATOR_FULL_API_KEY: 'k' },
      searchProducts: vi.fn(),
    });

    await expect(
      provider.checkoutUrl(activityCandidate, { tripId: 'trip-1', userId: 'user-42' })
    ).rejects.toMatchObject({ code: BOOKING_PROVIDER_ERROR_CODES.config });
  });

  it('candidat sans deeplink -> refus explicite', async () => {
    const provider = createViatorBookingProvider({
      env: {
        VIATOR_MODE: 'full',
        VIATOR_FULL_API_KEY: 'k',
        VIATOR_BOOKING_ENABLED: 'true',
      },
      searchProducts: vi.fn(),
    });

    await expect(
      provider.checkoutUrl(
        { ...activityCandidate, deeplink: null },
        { tripId: 'trip-1', userId: 'user-42' }
      )
    ).rejects.toMatchObject({ code: BOOKING_PROVIDER_ERROR_CODES.validation });
  });
});