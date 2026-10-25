'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  Recommendation,
  RecommendationDuration,
  RecommendationLevel,
} from '../types';

export interface PaysRecommendationsData {
  status: 'ok' | 'empty' | 'error';
  synthesis: string | null;
  synthesisProvider: 'ai' | 'none';
  recommendations: Recommendation[];
}

/** Recommandations contextualisées (profil + durée + saison) du pays. */
export function usePaysRecommendations(
  countryCode: string | undefined,
  level: RecommendationLevel = 'modere',
  duration: RecommendationDuration = 'semaine',
  enabled = true
) {
  const code = countryCode?.trim().toUpperCase();
  return useQuery<PaysRecommendationsData>({
    queryKey: ['pays-recommendations', code, level, duration],
    enabled: enabled && !!code && code.length === 2,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const search = new URLSearchParams({ level, duration });
      const response = await fetch(`/api/pays/${code}/recommendations?${search.toString()}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('recommendations_unavailable');
      return (await response.json()) as PaysRecommendationsData;
    },
  });
}
