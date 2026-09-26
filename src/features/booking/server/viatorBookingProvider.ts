import 'server-only';

import { z } from 'zod';
import {
  VIATOR_DESTINATION_IDS,
} from '@/features/discovery/providers/viator/viatorData';
import {
  createViatorProductSearch,
  type ViatorClientConfig,
} from '@/features/discovery/providers/viator/viatorClient';
import { viatorProductSchema } from '@/features/discovery/providers/viator/viatorSchemas';
import { validateBookingSearchRequest } from './bookingSchemas';
import {
  BOOKING_PROVIDER_ERROR_CODES,
  BookingProviderError,
  normalizeBookingProviderError,
} from './bookingProviderErrors';
import type {
  BookingCandidate,
  BookingProvider,
  BookingProviderEnv,
  BookingProviderMode,
  BookingSearchRequest,
  BookingSearchResult,
} from './bookingProviderTypes';

const DEFAULT_LIMIT = 5;
const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 600;
const VIATOR_HOSTS = new Set(['viator.com', 'www.viator.com']);
const VIATOR_CITY_DESTINATION_IDS: Record<string, string> = {
  TOKYO: '334',
  PARIS: '479',
  REYKJAVIK: '905',
};

export interface ViatorSearchProductsParams {
  destination: string;
  destinationId: string;
  limit: number;
  date?: string;
  travelers?: number;
  currency?: string;
}

export type ViatorSearchProductsLike = (
  params: ViatorSearchProductsParams
) => Promise<unknown[]>;

interface ViatorProviderOptions {
  env?: BookingProviderEnv;
  searchProducts?: ViatorSearchProductsLike;
  now?: () => Date;
}

function boolEnv(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function resolveMode(env: BookingProviderEnv): BookingProviderMode {
  const requested = (env.VIATOR_BOOKING_MODE || 'sandbox').trim().toLowerCase();
  if (requested === 'sandbox') return 'sandbox';
  if (requested === 'full' || requested === 'live') {
    return boolEnv(env.VIATOR_BOOKING_FULL_ENABLED) ? 'live' : 'disabled';
  }
  return 'disabled';
}

function parseDestinationMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && /^\d+$/.test(value) && /^[A-Za-z0-9 _-]{1,120}$/.test(key)) {
        out[key.trim().toUpperCase()] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

function resolveDestinationId(destination: string, env: BookingProviderEnv): string {
  const value = destination.trim();
  if (/^\d+$/.test(value)) return value;
  const key = value.toUpperCase();
  const envMap = parseDestinationMap(env.VIATOR_DESTINATION_IDS);
  const resolved =
    envMap[key] ||
    VIATOR_CITY_DESTINATION_IDS[key] ||
    VIATOR_DESTINATION_IDS[key];
  if (!resolved || !/^\d+$/.test(resolved)) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.validation,
      provider: 'viator',
      message: 'Destination Viator non résolue. Utilisez un identifiant numérique ou une destination connue.',
    });
  }
  return resolved;
}

function normalizeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (!VIATOR_HOSTS.has(host) && !host.endsWith('.viator.com')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function defaultSearchProducts(env: BookingProviderEnv): ViatorSearchProductsLike {
  const key = env.VIATOR_API_KEY?.trim();
  if (!key) throw new BookingProviderError({
    code: BOOKING_PROVIDER_ERROR_CODES.config,
    provider: 'viator',
    message: 'VIATOR_API_KEY est absente.',
  });
  const config: ViatorClientConfig = {
    apiKey: key,
    baseUrl: env.VIATOR_API_BASE_URL,
    timeoutMs: Number(env.VIATOR_TIMEOUT_MS) || undefined,
  };
  const search = createViatorProductSearch(config);
  return async (params) =>
    search({
      destinationId: params.destinationId,
      category: 'attractions',
      limit: params.limit,
      countryCode: 'XX',
      currency: params.currency,
      date: params.date,
      travelers: params.travelers,
    });
}

function normalizeOffers(
  rawProducts: unknown[],
  limit: number,
  requestedDate: string | undefined,
  travelers: number | undefined
): BookingCandidate[] {
  const offers: BookingCandidate[] = [];
  const seen = new Set<string>();
  for (const raw of rawProducts) {
    const parsed = viatorProductSchema.safeParse(raw);
    if (!parsed.success) continue;
    const product = parsed.data;
    const title = product.title?.trim().slice(0, MAX_TITLE_LENGTH);
    const id = product.productCode?.trim();
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const amount = product.pricing?.summary?.fromPrice;
    const currency = product.pricing?.currency?.trim().toUpperCase();
    const deeplink = normalizeHttpsUrl(product.productUrl);
    offers.push({
      id,
      provider: 'viator',
      vertical: 'activity',
      title,
      description: product.description?.trim().slice(0, MAX_DESCRIPTION_LENGTH) || null,
      amount: typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 ? amount : null,
      currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
      deeplink,
      bookingKind: deeplink ? 'deeplink' : 'search',
      requiresRevalidation: true,
      providerReference: id,
      metadata: {
        productCode: id,
        durationMinutes:
          product.duration?.fixedDurationInMinutes ??
          product.duration?.variableDurationFromMinutes ??
          null,
        requestedDate: requestedDate ?? null,
        travelers: travelers ?? 1,
        availabilityRevalidationRequired: true,
      },
    });
    if (offers.length >= limit) break;
  }
  return offers;
}

export function createViatorBookingProvider(options: ViatorProviderOptions = {}): BookingProvider {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const mode = resolveMode(env);
  const isConfigured = () => {
    const key = env.VIATOR_API_KEY?.trim();
    if (mode === 'disabled' || !key || key.includes('your-')) return false;
    try {
      defaultSearchProducts(env);
      return true;
    } catch {
      return false;
    }
  };
  const searchProducts = options.searchProducts ?? (isConfigured() ? defaultSearchProducts(env) : undefined);

  return {
    id: 'viator',
    mode,
    supportedVerticals: ['activity'],
    supports(vertical) {
      return vertical === 'activity';
    },
    isConfigured,
    async search(request) {
      if (!isConfigured() || !searchProducts) {
        throw new BookingProviderError({
          code: BOOKING_PROVIDER_ERROR_CODES.config,
          provider: 'viator',
          message: 'La réservation Viator n’est pas activée sur ce serveur.',
        });
      }
      const validated = validateBookingSearchRequest(request);
      if (validated.vertical !== 'activity') {
        throw new BookingProviderError({
          code: BOOKING_PROVIDER_ERROR_CODES.validation,
          provider: 'viator',
          message: 'Viator ne propose que des activités dans ce moteur.',
        });
      }
      const destinationId = resolveDestinationId(validated.destination, env);
      let products: unknown[];
      try {
        products = await searchProducts({
          destination: validated.destination,
          destinationId,
          date: validated.date,
          travelers: validated.travelers,
          currency: validated.currency,
          limit: validated.limit ?? DEFAULT_LIMIT,
        });
      } catch (error) {
        throw normalizeBookingProviderError(error, 'viator');
      }
      return {
        provider: 'viator',
        mode: mode === 'live' ? 'live' : 'sandbox',
        offers: normalizeOffers(
          Array.isArray(products) ? products : [],
          validated.limit ?? DEFAULT_LIMIT,
          validated.date,
          validated.travelers
        ),
        fetchedAt: now().toISOString(),
      } satisfies BookingSearchResult;
    },
  };
}
