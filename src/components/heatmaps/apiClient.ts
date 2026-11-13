'use client';

/**
 * Client HTTP des écrans heatmaps. Toutes les erreurs sont typées avec le
 * statut : l'UI distingue explicitement 401 (session), 400 (filtre) et 503
 * (consentement/activités indisponibles) au lieu d'afficher un état vide
 * trompeur.
 */

import type {
  AggregateContributionPreferences,
  PersonalTimePeriodKind,
} from '@/features/heatmaps/types';
import type {
  CommunityHeatmapResponse,
  HeatmapApiErrorBody,
  HeatmapOptOutResponse,
  HeatmapPreferencesResponse,
  PersonalHeatmapResponse,
} from '@/lib/heatmaps/types';

export class HeatmapClientError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HeatmapClientError';
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as HeatmapApiErrorBody | null;
    throw new HeatmapClientError(
      response.status,
      body?.code ?? 'http_error',
      body?.error ?? 'Requête heatmap refusée.'
    );
  }

  return (await response.json()) as T;
}

export interface CommunityParams {
  sport: string;
  window: 'global' | 'last_7_days' | 'nocturnal';
}

export function fetchCommunityHeatmap(
  params: CommunityParams,
  signal?: AbortSignal
): Promise<CommunityHeatmapResponse> {
  const search = new URLSearchParams({ sport: params.sport, window: params.window });
  return requestJson<CommunityHeatmapResponse>(`/api/heatmaps/community?${search}`, {
    signal,
    cache: 'no-store',
  });
}

export interface PersonalParams {
  sport: string;
  period: PersonalTimePeriodKind;
  comparePeriod?: PersonalTimePeriodKind | null;
}

export function fetchPersonalHeatmap(
  params: PersonalParams,
  signal?: AbortSignal
): Promise<PersonalHeatmapResponse> {
  const search = new URLSearchParams({ sport: params.sport, period: params.period });
  if (params.comparePeriod) search.set('comparePeriod', params.comparePeriod);
  return requestJson<PersonalHeatmapResponse>(`/api/heatmaps/personal?${search}`, {
    signal,
    cache: 'no-store',
  });
}

export function fetchHeatmapPreferences(
  signal?: AbortSignal
): Promise<HeatmapPreferencesResponse> {
  return requestJson<HeatmapPreferencesResponse>('/api/heatmaps/preferences', {
    signal,
    cache: 'no-store',
  });
}

export function patchHeatmapPreferences(
  patch: Partial<
    Pick<
      AggregateContributionPreferences,
      'globalHeatmapOptOut' | 'globalHeatmap' | 'routeRecommendations' | 'mobilityAggregates'
    >
  >
): Promise<HeatmapPreferencesResponse> {
  return requestJson<HeatmapPreferencesResponse>('/api/heatmaps/preferences', {
    method: 'PATCH',
    body: JSON.stringify(patch),
    cache: 'no-store',
  });
}

export function optOutOfGlobalHeatmap(
  revokeAllAggregates: boolean
): Promise<HeatmapOptOutResponse> {
  return requestJson<HeatmapOptOutResponse>('/api/heatmaps/opt-out', {
    method: 'POST',
    body: JSON.stringify({ revokeAllAggregates }),
    cache: 'no-store',
  });
}

export function isSessionError(error: unknown): boolean {
  return error instanceof HeatmapClientError && error.status === 401;
}
