import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  enforceRateLimit: vi.fn(),
  createBookingProvider: vi.fn(),
  providerSearch: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/features/booking/server/bookingProvider', () => ({
  createBookingProvider: mocks.createBookingProvider,
}));

import { POST } from '@/app/api/booking/search/route';
import {
  BOOKING_PROVIDER_ERROR_CODES,
  BookingProviderError,
} from '@/features/booking/server/bookingProviderErrors';
import type {
  BookingProviderRouter,
  BookingSearchResult,
} from '@/features/booking/server/bookingProviderTypes';

const USER_ID = 'user-booking-search';
const ROUTE_URL = 'http://localhost/api/booking/search';

const validPayload = {
  vertical: 'hotel',
  destination: 'Lyon',
  checkIn: '2027-04-10',
  checkOut: '2027-04-12',
} as const;

const searchResult: BookingSearchResult = {
  provider: 'routestack',
  mode: 'sandbox',
  offers: [
    {
      id: 'hotel-offer-1',
      provider: 'routestack',
      vertical: 'hotel',
      title: 'Hôtel de démonstration',
      description: null,
      amount: 128,
      currency: 'EUR',
      deeplink: 'https://www.routestack.com/',
      bookingKind: 'revalidation',
      requiresRevalidation: true,
      providerReference: 'opaque-reference',
      metadata: {},
    },
  ],
  fetchedAt: '2026-09-26T10:00:00.000Z',
};

function sessionClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
  } as never;
}

function providerRouter(): BookingProviderRouter {
  const verticalProvider = {
    id: 'routestack',
    mode: 'sandbox',
    supportedVerticals: ['hotel'],
    supports: vi.fn(() => true),
    isConfigured: vi.fn(() => true),
    search: mocks.providerSearch,
  };

  return {
    id: 'router',
    mode: 'sandbox',
    supportedVerticals: ['hotel'],
    supports: vi.fn(() => true),
    isConfigured: vi.fn(() => true),
    providerFor: vi.fn(() => verticalProvider),
    search: mocks.providerSearch,
  } as unknown as BookingProviderRouter;
}

function request(body: BodyInit, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(ROUTE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

function jsonRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return request(JSON.stringify(body), headers);
}

describe('POST /api/booking/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.createBookingProvider.mockReturnValue(providerRouter());
    mocks.providerSearch.mockResolvedValue(searchResult);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuse une requête sans utilisateur avec 401', async () => {
    mocks.createClient.mockResolvedValue(sessionClient(null));

    const response = await POST(jsonRequest(validPayload));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.createBookingProvider).not.toHaveBeenCalled();
  });

  it.each([
    ['JSON malformé', '{'],
    ['requête non conforme au schéma', { ...validPayload, checkOut: '2027-04-09' }],
  ])('refuse un corps invalide avec 400 (%s)', async (_label, body) => {
    const response = await POST(jsonRequest(body));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_request');
    expect(mocks.providerSearch).not.toHaveBeenCalled();
  });

  it('refuse un corps supérieur à 32 Kio avec 413', async () => {
    const oversized = JSON.stringify({
      ...validPayload,
      padding: 'x'.repeat(32 * 1024),
    });

    const response = await POST(request(oversized));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: 'payload_too_large' });
    expect(mocks.providerSearch).not.toHaveBeenCalled();
  });

  it('propage le refus de quota avec 429 sans appeler le provider', async () => {
    mocks.enforceRateLimit.mockResolvedValueOnce(
      NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'x-ratelimit-remaining': '0' } }
      )
    );

    const response = await POST(jsonRequest(validPayload));

    expect(response.status).toBe(429);
    expect(response.headers.get('x-ratelimit-remaining')).toBe('0');
    await expect(response.json()).resolves.toEqual({ error: 'rate_limited' });
    expect(mocks.createBookingProvider).not.toHaveBeenCalled();
    expect(mocks.providerSearch).not.toHaveBeenCalled();
  });

  it('renvoie les candidats du provider avec 200 et un cache privé', async () => {
    const response = await POST(jsonRequest(validPayload));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ success: true, data: searchResult });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(USER_ID, {
      scope: 'booking-search',
      limit: 30,
      windowMs: 600_000,
      failMode: 'closed',
    });
    expect(mocks.providerSearch).toHaveBeenCalledWith({
      ...validPayload,
      travelers: 1,
      currency: 'EUR',
      limit: 5,
    });
  });

  it('transforme une erreur provider 502 en réponse publique normalisée', async () => {
    mocks.providerSearch.mockRejectedValueOnce(
      new BookingProviderError({
        code: BOOKING_PROVIDER_ERROR_CODES.auth,
        provider: 'routestack',
        message: 'Identifiants RouteStack invalides',
        retryable: false,
      })
    );

    const response = await POST(jsonRequest(validPayload));

    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      error: 'booking_search_failed',
      code: 'auth',
      retryable: false,
    });
  });

  it('transforme une erreur provider 503 en réponse publique normalisée', async () => {
    mocks.providerSearch.mockRejectedValueOnce(
      new BookingProviderError({
        code: BOOKING_PROVIDER_ERROR_CODES.unavailable,
        provider: 'routestack',
        message: 'Transport indisponible',
        retryable: true,
      })
    );

    const response = await POST(jsonRequest(validPayload));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'booking_search_failed',
      code: 'unavailable',
      retryable: true,
    });
  });

  it('ne divulgue ni secret, ni cause, ni message interne dans une erreur inattendue', async () => {
    const secret = 'sb_rst_do_not_expose';
    mocks.providerSearch.mockRejectedValueOnce(
      new Error(`upstream failure with token=${secret}`)
    );

    const response = await POST(jsonRequest(validPayload));
    const rawBody = JSON.stringify(await response.json());

    expect(response.status).toBe(502);
    expect(rawBody).not.toContain(secret);
    expect(rawBody).not.toContain('upstream failure');
    expect(rawBody).not.toContain('stack');
    expect(rawBody).not.toContain('cause');
  });
});
