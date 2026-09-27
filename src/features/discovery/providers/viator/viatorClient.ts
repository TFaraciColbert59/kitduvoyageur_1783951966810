// src/features/discovery/providers/viator/viatorClient.ts
import 'server-only';
import {
  mapViatorStatus,
  viatorConfigError,
  viatorTimeoutError,
  viatorUpstreamError,
  viatorValidationError,
} from './viatorErrors';
import {
  viatorProductSchema,
  viatorSearchResponseSchema,
  type ViatorProductRaw,
} from './viatorSchemas';
import type { ViatorSearchParams } from './viatorTypes';

const DEFAULT_BASE_URL = 'https://api.viator.com/partner';
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_LANGUAGE = 'fr';
const DEFAULT_CURRENCY = 'EUR';
const API_VERSION = 'application/json;version=2.0';
// Hôte live + hôte sandbox officiel, listés explicitement. L'allowlist reste
// fermée : sans cet ajout, une clé sandbox ne peut cibler que la production,
// ce qui fausserait tout test de réservation (D-07).
const VIATOR_API_HOSTS = new Set(['api.viator.com', 'api.sandbox.viator.com']);

export interface ViatorClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function resolveTimeoutMs(value: string | number | undefined): number {
  const configured = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function normalizeBaseUrl(value: string | undefined): string {
  const baseUrl = (value || DEFAULT_BASE_URL).replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw viatorConfigError();
  }
  if (url.protocol !== 'https:' || url.username || url.password || !VIATOR_API_HOSTS.has(url.hostname.toLowerCase())) {
    throw viatorConfigError();
  }
  return url.toString().replace(/\/+$/, '');
}

function getViatorConfig(): ViatorClientConfig {
  const key = process.env.VIATOR_API_KEY;
  if (!key || key.includes('your-')) throw viatorConfigError();
  return {
    apiKey: key,
    baseUrl: process.env.VIATOR_API_BASE_URL,
    timeoutMs: resolveTimeoutMs(process.env.VIATOR_TIMEOUT_MS),
  };
}

export function isViatorConfigured(): boolean {
  const key = process.env.VIATOR_API_KEY;
  return Boolean(key) && !key!.includes('your-');
}

async function readErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as Record<string, unknown> | null;
    if (!body) return undefined;
    const candidate = body.message || body.detail || body.error || body.title;
    return typeof candidate === 'string' ? candidate.slice(0, 200) : undefined;
  } catch {
    return undefined;
  }
}

/** Client Viator construit à partir d'une configuration immuable. */
export function createViatorProductSearch(config: ViatorClientConfig) {
  const apiKey = config.apiKey.trim();
  if (!apiKey || apiKey.includes('your-')) throw viatorConfigError();
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const timeoutMs = resolveTimeoutMs(config.timeoutMs);
  const fetchImpl = config.fetchImpl ?? fetch;

  return async function searchProducts(params: ViatorSearchParams): Promise<ViatorProductRaw[]> {
    const url = new URL(`${baseUrl}/products/search`);
    const body = {
      filtering: {
        destination: params.destinationId,
        ...(params.tags && params.tags.length > 0 ? { tags: params.tags } : {}),
        ...(params.date ? { startDate: params.date } : {}),
        ...(params.travelers && params.travelers > 0 ? { travelers: params.travelers } : {}),
      },
      pagination: { start: 1, count: params.limit },
      currency: params.currency || DEFAULT_CURRENCY,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const forwardAbort = () => controller.abort();
    if (params.signal) {
      if (params.signal.aborted) controller.abort();
      else params.signal.addEventListener('abort', forwardAbort, { once: true });
    }

    let response: Response;
    try {
      response = await fetchImpl(url.toString(), {
        method: 'POST',
        headers: {
          Accept: API_VERSION,
          'Content-Type': 'application/json',
          'Accept-Language': params.language || DEFAULT_LANGUAGE,
          'exp-api-key': apiKey,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      throw controller.signal.aborted ? viatorTimeoutError() : viatorUpstreamError('Viator injoignable.');
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', forwardAbort);
    }

    if (!response.ok) throw mapViatorStatus(response.status, await readErrorDetail(response));

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw viatorValidationError('Réponse Viator non JSON.');
    }

    const envelope = viatorSearchResponseSchema.safeParse(payload);
    if (!envelope.success) throw viatorValidationError();

    return envelope.data.products
      .map((product) => viatorProductSchema.safeParse(product))
      .filter((result): result is { success: true; data: ViatorProductRaw } => result.success)
      .map((result) => result.data);
  };
}

/** Raccourci historique : la configuration vient de process.env. */
export async function viatorSearchProducts(params: ViatorSearchParams): Promise<ViatorProductRaw[]> {
  return createViatorProductSearch(getViatorConfig())(params);
}
