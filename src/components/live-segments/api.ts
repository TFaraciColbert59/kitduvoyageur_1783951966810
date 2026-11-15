/**
 * Lot S03-UI — adaptateur client des routes `/api/live-segments`.
 *
 * `fetchImpl` est injectable : les tests n'ouvrent aucune connexion. Une
 * réponse vide ou non JSON ne devient jamais un succès silencieux.
 */

import type { FinalSegmentEffort } from '@/features/live-segments';
import type {
  DeviceSyncRequestBody,
  DeviceSyncResponse,
  ListLiveSegmentsResponse,
  LiveSegmentDetailResponse,
  SubmitEffortResponse,
} from './types';

export class LiveSegmentsApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'LiveSegmentsApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ListLiveSegmentsQuery {
  lat?: number;
  lon?: number;
  radius?: number;
  sport?: 'cycling' | 'running' | 'hiking' | 'trail' | 'gravel';
  limit?: number;
  optIn?: boolean;
}

export interface LiveSegmentsApi {
  list(query?: ListLiveSegmentsQuery): Promise<ListLiveSegmentsResponse>;
  get(id: string): Promise<LiveSegmentDetailResponse>;
  submitEffort(id: string, effort: FinalSegmentEffort): Promise<SubmitEffortResponse>;
  sync(body: DeviceSyncRequestBody): Promise<DeviceSyncResponse>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function errorFrom(response: Response, payload: unknown): LiveSegmentsApiError {
  const body = asRecord(payload);
  const message =
    typeof body.error === 'string' && body.error.length > 0
      ? body.error
      : `Échec de la requête (${response.status}).`;
  const code = typeof body.code === 'string' ? body.code : 'unknown';
  return new LiveSegmentsApiError(message, response.status, code);
}

export function createLiveSegmentsApi(
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
  base = '/api/live-segments',
): LiveSegmentsApi {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set('accept', 'application/json');
    if (init?.body) headers.set('content-type', 'application/json');
    const response = await fetchImpl(`${base}${path}`, {
      ...init,
      headers,
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw errorFrom(response, payload);
    }
    if (payload === null || typeof payload !== 'object') {
      throw new LiveSegmentsApiError(
        'Réponse serveur illisible.',
        response.status,
        'invalid_response',
      );
    }
    return payload as T;
  }

  return {
    list(query = {}) {
      const params = new URLSearchParams();
      if (query.lat !== undefined && query.lon !== undefined) {
        params.set('lat', String(query.lat));
        params.set('lon', String(query.lon));
      }
      if (query.radius !== undefined) params.set('radius', String(query.radius));
      if (query.sport) params.set('sport', query.sport);
      if (query.limit !== undefined) params.set('limit', String(query.limit));
      if (query.optIn === false) params.set('optIn', '0');
      const suffix = params.toString();
      return request<ListLiveSegmentsResponse>(suffix ? `?${suffix}` : '');
    },

    get(id) {
      return request<LiveSegmentDetailResponse>(`/${encodeURIComponent(id)}`);
    },

    submitEffort(id, effort) {
      return request<SubmitEffortResponse>(`/${encodeURIComponent(id)}/efforts`, {
        method: 'POST',
        body: JSON.stringify(effort),
      });
    },

    sync(body) {
      return request<DeviceSyncResponse>('/sync', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  };
}
