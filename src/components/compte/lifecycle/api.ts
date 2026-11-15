/**
 * Lot A02 — adaptateur client des routes `/api/activities/lifecycle`.
 *
 * Toutes les mutations renvoient l'état persisté par le serveur : l'UI ne
 * fabrique jamais un état « optimiste » à afficher comme s'il était vrai.
 * `fetchImpl` est injectable pour les tests (aucun réseau).
 */

import type {
  ActivityMetadataPatch,
  CropBounds,
  CropPreviewResult,
  DistanceElevationCorrectionInput,
  LifecycleActivityRecord,
  LifecycleMediaAction,
  ProjectionRecalculationEvent,
  SplitActivitySpec,
} from '@/features/activity/lifecycle';

export interface LifecycleListResponse {
  items: LifecycleActivityRecord[];
  totalMatched: number;
  expiredDeletedCount: number;
  requestSeq: number;
}

export interface LifecycleMutationResponse {
  record: LifecycleActivityRecord;
  projectionEvent?: ProjectionRecalculationEvent | null;
  sportChanged?: boolean;
  alreadyDeleted?: boolean;
  spikesRemoved?: number;
}

export interface CropResponse {
  preview: CropPreviewResult;
  record: LifecycleActivityRecord | null;
}

export interface SplitResponse {
  parentRecord: LifecycleActivityRecord;
  parts: LifecycleActivityRecord[];
  projectionEvent: ProjectionRecalculationEvent;
  idempotentReplay: boolean;
}

export class LifecycleApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly currentRevision?: number;

  constructor(message: string, status: number, code: string, currentRevision?: number) {
    super(message);
    this.name = 'LifecycleApiError';
    this.status = status;
    this.code = code;
    this.currentRevision = currentRevision;
  }
}

export interface LifecycleApi {
  list(params?: {
    q?: string;
    trash?: boolean;
    limit?: number;
    requestSeq?: number;
  }): Promise<LifecycleListResponse>;
  get(id: string): Promise<LifecycleActivityRecord>;
  updateMetadata(
    id: string,
    patch: ActivityMetadataPatch,
    expectedRevision?: number
  ): Promise<LifecycleMutationResponse>;
  updateMedia(id: string, action: LifecycleMediaAction): Promise<LifecycleMutationResponse>;
  quickEdit(
    id: string,
    body: { action: 'apply'; patch: ActivityMetadataPatch } | { action: 'dismiss' }
  ): Promise<LifecycleMutationResponse>;
  previewCrop(id: string, bounds: CropBounds): Promise<CropResponse>;
  crop(id: string, bounds: CropBounds): Promise<CropResponse>;
  restoreGeometry(id: string): Promise<LifecycleMutationResponse>;
  split(id: string, spec: SplitActivitySpec): Promise<SplitResponse>;
  correct(id: string, input: DistanceElevationCorrectionInput): Promise<LifecycleMutationResponse>;
  smoothGps(id: string, maxPlausibleSpeedMs?: number): Promise<LifecycleMutationResponse>;
  revertCorrection(id: string): Promise<LifecycleMutationResponse>;
  trash(id: string): Promise<LifecycleMutationResponse>;
  restore(id: string): Promise<LifecycleMutationResponse>;
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

function errorFrom(response: Response, payload: unknown): LifecycleApiError {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const message =
    typeof body.error === 'string' && body.error.length > 0
      ? body.error
      : `Échec de la requête (${response.status}).`;
  const code = typeof body.code === 'string' ? body.code : 'unknown';
  const currentRevision =
    typeof body.currentRevision === 'number' ? body.currentRevision : undefined;
  return new LifecycleApiError(message, response.status, code, currentRevision);
}

export function createLifecycleApi(
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
  base = '/api/activities/lifecycle'
): LifecycleApi {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    const payload = await readJson(response);
    if (!response.ok) throw errorFrom(response, payload);
    return payload as T;
  }

  const path = (id: string, suffix = '') => `/${encodeURIComponent(id)}${suffix}`;

  return {
    list({ q, trash, limit, requestSeq } = {}) {
      const search = new URLSearchParams();
      if (q && q.trim().length > 0) search.set('q', q.trim());
      if (trash) search.set('trash', '1');
      if (limit) search.set('limit', String(limit));
      if (requestSeq) search.set('requestSeq', String(requestSeq));
      const query = search.toString();
      return request<LifecycleListResponse>(query ? `?${query}` : '');
    },

    async get(id) {
      const response = await request<{ record: LifecycleActivityRecord }>(path(id));
      return response.record;
    },

    updateMetadata(id, patch, expectedRevision) {
      return request<LifecycleMutationResponse>(path(id), {
        method: 'PATCH',
        body: JSON.stringify({ ...patch, expectedRevision }),
      });
    },

    updateMedia(id, action) {
      return request<LifecycleMutationResponse>(path(id, '/media'), {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
    },

    quickEdit(id, body) {
      return request<LifecycleMutationResponse>(path(id, '/quick-edit'), {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    previewCrop(id, bounds) {
      return request<CropResponse>(path(id, '/crop'), {
        method: 'POST',
        body: JSON.stringify({ ...bounds, previewOnly: true }),
      });
    },

    crop(id, bounds) {
      return request<CropResponse>(path(id, '/crop'), {
        method: 'POST',
        body: JSON.stringify(bounds),
      });
    },

    restoreGeometry(id) {
      return request<LifecycleMutationResponse>(path(id, '/crop'), { method: 'DELETE' });
    },

    split(id, spec) {
      return request<SplitResponse>(path(id, '/split'), {
        method: 'POST',
        body: JSON.stringify(spec),
      });
    },

    correct(id, input) {
      return request<LifecycleMutationResponse>(path(id, '/correction'), {
        method: 'POST',
        body: JSON.stringify({ kind: 'distance_elevation', ...input }),
      });
    },

    smoothGps(id, maxPlausibleSpeedMs) {
      return request<LifecycleMutationResponse>(path(id, '/correction'), {
        method: 'POST',
        body: JSON.stringify({ kind: 'gps_spikes', maxPlausibleSpeedMs }),
      });
    },

    revertCorrection(id) {
      return request<LifecycleMutationResponse>(path(id, '/correction'), {
        method: 'DELETE',
      });
    },

    trash(id) {
      return request<LifecycleMutationResponse>(path(id, '/trash'), {
        method: 'POST',
        body: JSON.stringify({ action: 'delete' }),
      });
    },

    restore(id) {
      return request<LifecycleMutationResponse>(path(id, '/trash'), {
        method: 'POST',
        body: JSON.stringify({ action: 'restore' }),
      });
    },
  };
}
