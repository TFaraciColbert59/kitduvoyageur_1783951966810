/**
 * Lot D03-UI — client HTTP de la surface montres.
 *
 * Toutes les mutations renvoient l'état calculé par le serveur ; l'UI ne
 * fabrique jamais un accusé de réception ni un paquet « disponible » en
 * local. `fetchImpl` est injectable pour les tests (aucun réseau).
 */

import type {
  WatchDeviceProfile,
  WatchFieldLayoutConfig,
  WatchLiveMetricsInput,
  WatchLiveSyncFrame,
  WatchNextManeuver,
  WatchOfflinePackChunk,
  WatchOfflinePackManifest,
  WatchRoutePoiInput,
  WatchSessionBatchEnvelope,
} from '@/features/watches';
import type {
  WatchApplyFrameResponse,
  WatchDeviceRegistrationResponse,
  WatchDevicesResponse,
  WatchFieldLayoutValidation,
  WatchFrameResponse,
  WatchHandoffResponse,
  WatchLiveSyncStateResponse,
  WatchPackResponse,
  WatchPacksResponse,
  WatchSessionIngestResponse,
  WatchSessionsResponse,
  WatchStatusResponse,
} from './types';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class WatchesApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'WatchesApiError';
    this.status = status;
    this.code = code;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function errorFrom(response: Response, payload: unknown): WatchesApiError {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const message =
    typeof body.error === 'string' && body.error.length > 0
      ? body.error
      : `Échec de la requête montres (${response.status}).`;
  const code = typeof body.code === 'string' ? body.code : 'unknown';
  return new WatchesApiError(message, response.status, code);
}

export interface WatchApi {
  getStatus(params?: {
    platform?: string;
    deviceId?: string;
    xcodeWatchKitTargetPresent?: boolean;
    wearOsGradleModulePresent?: boolean;
    runtimeBridgeInjected?: boolean;
  }): Promise<WatchStatusResponse>;
  listDevices(): Promise<WatchDevicesResponse>;
  registerDevice(profile: WatchDeviceProfile): Promise<WatchDeviceRegistrationResponse>;
  removeDevice(deviceId: string): Promise<{ removed: boolean; deviceId: string }>;
  listSessions(): Promise<WatchSessionsResponse>;
  ingestBatch(batch: WatchSessionBatchEnvelope): Promise<WatchSessionIngestResponse>;
  listPacks(): Promise<WatchPacksResponse>;
  stagePack(manifest: WatchOfflinePackManifest, totalChunks?: number): Promise<WatchPackResponse>;
  ingestChunk(chunk: WatchOfflinePackChunk): Promise<{
    ack: { packId: string; routeRevision: number; ackedChunkIndex: number };
    pack: WatchPackResponse['pack'];
  }>;
  verifyPack(packId: string, checksumSha256: string): Promise<WatchPackResponse>;
  removePack(packId: string): Promise<{ removed: boolean; packId: string }>;
  getLiveSync(sessionId: string): Promise<WatchLiveSyncStateResponse>;
  buildFrame(input: {
    sessionId: string;
    routeId: string | null;
    metrics: WatchLiveMetricsInput;
    pois?: readonly WatchRoutePoiInput[];
    nextManeuver?: WatchNextManeuver | null;
    nowUtcMs?: number;
  }): Promise<WatchFrameResponse>;
  setLayout(config: WatchFieldLayoutConfig): Promise<{ layout: WatchFieldLayoutValidation }>;
  validateLayout(config: WatchFieldLayoutConfig): Promise<WatchFieldLayoutValidation>;
  handoff(input: {
    sessionId: string;
    toSource: 'phone' | 'watch';
    lastAcceptedSeq: number;
  }): Promise<WatchHandoffResponse>;
  applyFrame(frame: WatchLiveSyncFrame): Promise<WatchApplyFrameResponse>;
}

export function createWatchesApi(
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
  base = '/api/watches',
): WatchApi {
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


  return {
    getStatus(params = {}) {
      const search = new URLSearchParams();
      if (params.platform) search.set('platform', params.platform);
      if (params.deviceId) search.set('deviceId', params.deviceId);
      if (params.xcodeWatchKitTargetPresent) search.set('xcodeWatchKitTargetPresent', '1');
      if (params.wearOsGradleModulePresent) search.set('wearOsGradleModulePresent', '1');
      if (params.runtimeBridgeInjected) search.set('runtimeBridgeInjected', '1');
      const query = search.toString();
      return request<WatchStatusResponse>(`/status${query ? `?${query}` : ''}`);
    },

    listDevices() {
      return request<WatchDevicesResponse>('/devices');
    },

    registerDevice(profile) {
      return request<WatchDeviceRegistrationResponse>('/devices', {
        method: 'POST',
        body: JSON.stringify(profile),
      });
    },

    removeDevice(deviceId) {
      return request<{ removed: boolean; deviceId: string }>(
        `/devices/${encodeURIComponent(deviceId)}`,
        { method: 'DELETE' },
      );
    },

    listSessions() {
      return request<WatchSessionsResponse>('/sessions');
    },

    ingestBatch(batch) {
      return request<WatchSessionIngestResponse>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ batch }),
      });
    },

    listPacks() {
      return request<WatchPacksResponse>('/packs');
    },

    stagePack(manifest, totalChunks) {
      return request<WatchPackResponse>('/packs', {
        method: 'POST',
        body: JSON.stringify({ manifest, totalChunks }),
      });
    },

    ingestChunk(chunk) {
      return request<{
        ack: { packId: string; routeRevision: number; ackedChunkIndex: number };
        pack: WatchPackResponse['pack'];
      }>(`/packs/${encodeURIComponent(chunk.packId)}/chunks`, {
        method: 'POST',
        body: JSON.stringify({ chunk }),
      });
    },

    verifyPack(packId, checksumSha256) {
      return request<WatchPackResponse>(`/packs/${encodeURIComponent(packId)}/verify`, {
        method: 'POST',
        body: JSON.stringify({ checksumSha256 }),
      });
    },

    removePack(packId) {
      return request<{ removed: boolean; packId: string }>(
        `/packs/${encodeURIComponent(packId)}`,
        { method: 'DELETE' },
      );
    },

    getLiveSync(sessionId) {
      return request<WatchLiveSyncStateResponse>(
        `/live-sync?sessionId=${encodeURIComponent(sessionId)}`,
      );
    },

    buildFrame(input) {
      return request<WatchFrameResponse>('/live-sync/frame', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: input.sessionId,
          routeId: input.routeId,
          metrics: input.metrics,
          pois: input.pois,
          nextManeuver: input.nextManeuver ?? null,
          nowUtcMs: input.nowUtcMs,
        }),
      });
    },

    setLayout(config) {
      return request<{ layout: WatchFieldLayoutValidation }>('/live-sync', {
        method: 'POST',
        body: JSON.stringify({ action: 'set_layout', config }),
      });
    },

    validateLayout(config) {
      return request<WatchFieldLayoutValidation>('/fields/validate', {
        method: 'POST',
        body: JSON.stringify(config),
      });
    },

    handoff(input) {
      return request<WatchHandoffResponse>('/live-sync', {
        method: 'POST',
        body: JSON.stringify({ action: 'handoff', ...input }),
      });
    },

    applyFrame(frame) {
      return request<WatchApplyFrameResponse>('/live-sync', {
        method: 'POST',
        body: JSON.stringify({ action: 'apply_frame', frame }),
      });
    },
  };
}
