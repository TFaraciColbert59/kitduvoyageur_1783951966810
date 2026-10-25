// src/features/discovery/providers/tripadvisor/tripadvisorClient.ts
import 'server-only';
import { z } from 'zod';
import {
  authError,
  configError,
  notFoundError,
  quotaError,
  timeoutError,
  upstreamError,
  validationError,
} from './tripadvisorErrors';
import {
  taLocationDetailsSchema,
  taSearchResponseSchema,
  type TaLocationDetails,
  type TaSearchItem,
} from './tripadvisorSchemas';
import type { DiscoveryCategory } from '../../types/discovery.types';

const DEFAULT_BASE_URL = 'https://api.content.tripadvisor.com/api/v1';
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_LANGUAGE = 'fr';

function resolveTimeoutMs(): number {
  const configured = Number(process.env.TRIPADVISOR_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

/** Tripadvisor n'accepte que les clés ASCII A2 ; on mappe nos 3 catégories. */
const SEARCH_CATEGORY: Record<DiscoveryCategory, string> = {
  attractions: 'attractions',
  restaurants: 'restaurants',
  hotels: 'hotels',
};

function getConfig(): { key: string; baseUrl: string } {
  const key = process.env.TRIPADVISOR_API_KEY;
  const baseUrl = (process.env.TRIPADVISOR_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  if (!key || key.includes('your-')) {
    throw configError();
  }
  return { key, baseUrl };
}

export function isLegacyTripadvisorConfigured(): boolean {
  const key = process.env.TRIPADVISOR_API_KEY;
  return Boolean(key) && !key!.includes('your-');
}

/**
 * En-têtes optionnels si la clé Tripadvisor est restreinte par domaine
 * (voir doc « API Security ») : un Referer/Origin d'un domaine autorisé est
 * alors requis. Jamais la clé — seulement l'origine publique du site.
 */
function refererHeaders(): Record<string, string> {
  const referer = process.env.TRIPADVISOR_REFERER || process.env.NEXT_PUBLIC_SITE_URL;
  if (!referer) return {};
  return { Referer: referer, Origin: referer.replace(/\/+$/, '') };
}

async function requestJson<T>(
  pathname: string,
  params: Record<string, string>,
  schema: z.ZodType<T>,
  signal?: AbortSignal
): Promise<T> {
  const { key, baseUrl } = getConfig();
  const url = new URL(`${baseUrl}${pathname}`);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  url.searchParams.set('key', key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), resolveTimeoutMs());
  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json', ...refererHeaders() },
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    // Aucune URL journalisée : elle contient la clé.
    throw controller.signal.aborted ? timeoutError() : upstreamError('Service Tripadvisor injoignable.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }

  if (!response.ok) {
    throw mapHttpStatus(response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw validationError('Réponse Tripadvisor non JSON.');
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw validationError();
  }
  return parsed.data;
}

function mapHttpStatus(status: number) {
  if (status === 400) return validationError('Requête Tripadvisor invalide.');
  if (status === 401 || status === 403) return authError(status);
  if (status === 404) return notFoundError(status);
  if (status === 429) return quotaError(status);
  if (status >= 500) return upstreamError('Erreur serveur Tripadvisor.', status);
  return upstreamError(`Réponse Tripadvisor inattendue (${status}).`, status);
}

export async function taSearchLocations(params: {
  searchQuery: string;
  category: DiscoveryCategory;
  signal?: AbortSignal;
}): Promise<TaSearchItem[]> {
  const data = await requestJson(
    '/location/search',
    {
      searchQuery: params.searchQuery,
      category: SEARCH_CATEGORY[params.category],
      language: DEFAULT_LANGUAGE,
    },
    taSearchResponseSchema,
    params.signal
  );
  return data.data;
}

export async function taLocationDetails(
  locationId: string,
  options: { signal?: AbortSignal } = {}
): Promise<TaLocationDetails> {
  return requestJson(
    `/location/${encodeURIComponent(locationId)}/details`,
    { language: DEFAULT_LANGUAGE },
    taLocationDetailsSchema,
    options.signal
  );
}
