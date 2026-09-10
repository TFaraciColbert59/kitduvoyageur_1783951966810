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

function resolveTimeoutMs(): number {
  const configured = Number(process.env.VIATOR_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function getViatorConfig(): { key: string; baseUrl: string } {
  const key = process.env.VIATOR_API_KEY;
  const baseUrl = (process.env.VIATOR_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  if (!key || key.includes('your-')) {
    throw viatorConfigError();
  }
  return { key, baseUrl };
}

export function isViatorConfigured(): boolean {
  const key = process.env.VIATOR_API_KEY;
  return Boolean(key) && !key!.includes('your-');
}

/**
 * `POST /products/search` — un seul appel par recherche. La clé est transmise
 * EXCLUSIVEMENT dans l'en-tête `exp-api-key` (jamais en URL). Aucun retry.
 */
export async function viatorSearchProducts(params: ViatorSearchParams): Promise<ViatorProductRaw[]> {
  const { key, baseUrl } = getViatorConfig();
  const url = new URL(`${baseUrl}/products/search`);

  const body = {
    filtering: {
      destination: params.destinationId,
      ...(params.tags && params.tags.length > 0 ? { tags: params.tags } : {}),
    },
    pagination: { start: 1, count: params.limit },
    currency: params.currency || DEFAULT_CURRENCY,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), resolveTimeoutMs());
  const forwardAbort = () => controller.abort();
  if (params.signal) {
    if (params.signal.aborted) controller.abort();
    else params.signal.addEventListener('abort', forwardAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Accept: API_VERSION,
        'Content-Type': 'application/json',
        'Accept-Language': params.language || DEFAULT_LANGUAGE,
        'exp-api-key': key,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    throw controller.signal.aborted ? viatorTimeoutError() : viatorUpstreamError('Viator injoignable.');
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', forwardAbort);
  }

  if (!response.ok) {
    throw mapViatorStatus(response.status, await readErrorDetail(response));
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw viatorValidationError('Réponse Viator non JSON.');
  }

  const envelope = viatorSearchResponseSchema.safeParse(payload);
  if (!envelope.success) {
    throw viatorValidationError();
  }

  return envelope.data.products
    .map((product) => viatorProductSchema.safeParse(product))
    .filter((result): result is { success: true; data: ViatorProductRaw } => result.success)
    .map((result) => result.data);
}

/** Extrait uniquement un message d'erreur textuel (jamais de secret). */
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
