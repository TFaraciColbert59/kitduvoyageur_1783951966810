// src/features/discovery/providers/tripadvisor-terra/terraClient.ts
import 'server-only';
import { z } from 'zod';
import {
  mapTerraStatus,
  terraConfigError,
  terraTimeoutError,
  terraUpstreamError,
  terraValidationError,
} from './terraErrors';
import {
  terraLocationSchema,
  terraSearchResponseSchema,
  type TerraLocation,
  type TerraSearchItem,
} from './terraSchemas';
import type { DiscoveryCategory } from '../../types/discovery.types';

const DEFAULT_BASE_URL = 'https://terra.tripadvisor.com/api';
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_LOCALE = 'fr-FR';

/** Enums Terra confirmés par l'OpenAPI (majuscules). */
export const TERRA_CATEGORY: Record<DiscoveryCategory, 'RESTAURANT' | 'ATTRACTION' | 'HOTEL'> = {
  attractions: 'ATTRACTION',
  restaurants: 'RESTAURANT',
  hotels: 'HOTEL',
};

function resolveTimeoutMs(): number {
  const configured = Number(process.env.TRIPADVISOR_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function getTerraConfig(): { key: string; baseUrl: string } {
  const key = process.env.TRIPADVISOR_TERRA_API_KEY;
  const baseUrl = (process.env.TRIPADVISOR_TERRA_API_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/+$/,
    ''
  );
  if (!key || key.includes('your-')) {
    throw terraConfigError();
  }
  return { key, baseUrl };
}

export function isTerraConfigured(): boolean {
  const key = process.env.TRIPADVISOR_TERRA_API_KEY;
  return Boolean(key) && !key!.includes('your-');
}

type QueryValue = string | number | string[] | undefined;

async function requestJson<T>(
  pathname: string,
  params: Record<string, QueryValue>,
  schema: z.ZodType<T>,
  signal?: AbortSignal
): Promise<T> {
  const { key, baseUrl } = getTerraConfig();
  const url = new URL(`${baseUrl}${pathname}`);
  for (const [name, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => url.searchParams.append(name, entry));
    } else {
      url.searchParams.set(name, String(value));
    }
  }
  // La clé n'est JAMAIS placée dans l'URL : en-tête X-API-Key uniquement.

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
      headers: { Accept: 'application/json', 'X-API-Key': key },
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    // Aucune URL journalisée (elle ne contient pas la clé, mais on n'écrit rien).
    throw controller.signal.aborted ? terraTimeoutError() : terraUpstreamError('Terra injoignable.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }

  if (!response.ok) {
    const detail = await readProblemDetail(response);
    throw mapTerraStatus(response.status, detail);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw terraValidationError('Réponse Terra non JSON.');
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw terraValidationError();
  }
  return parsed.data;
}

/** Extrait uniquement le message « problème » de Terra (jamais de secret). */
async function readProblemDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as Record<string, unknown> | null;
    if (!body) return undefined;
    const candidate = body.detail || body.message || body.title;
    return typeof candidate === 'string' ? candidate.slice(0, 200) : undefined;
  } catch {
    return undefined;
  }
}

export interface TerraSearchParams {
  /** Requête textuelle (ex. capitale ou nom du pays). */
  searchQuery: string;
  countryCode: string;
  category: DiscoveryCategory;
  limit: number;
  locale?: string;
  signal?: AbortSignal;
}

/**
 * `GET /locations/search` — retourne la Location complète (pas de Details requis).
 *
 * NOTE : `geo_name` est volontairement OMIS. Vérifié en direct (2026-09-10) :
 * passer `geo_name=<nom>` avec `query=<même nom>` renvoie 0 résultat, alors que
 * `query=<capitale>` + `country_code` renvoie des résultats. On borne la
 * pertinence via `country_code` + `query` (capitale).
 */
export async function terraSearchLocations(params: TerraSearchParams): Promise<TerraSearchItem[]> {
  const data = await requestJson(
    '/locations/search',
    {
      query: params.searchQuery,
      country_code: params.countryCode.toUpperCase(),
      category: TERRA_CATEGORY[params.category],
      locale: params.locale || DEFAULT_LOCALE,
      page: 1,
      size: params.limit,
    },
    terraSearchResponseSchema,
    params.signal
  );
  return data.data;
}

/** `GET /locations/{id}` — conservé pour usages futurs (photos/avis). */
export async function terraLocationDetails(
  locationId: string,
  options: { locale?: string; signal?: AbortSignal } = {}
): Promise<TerraLocation> {
  return requestJson(
    `/locations/${encodeURIComponent(locationId)}`,
    { locale: options.locale || DEFAULT_LOCALE },
    terraLocationSchema,
    options.signal
  );
}
