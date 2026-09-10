'use client';

import { useQuery } from '@tanstack/react-query';
import { getTripadvisorAttribution } from '../constants';
import type {
  DiscoveryCategory,
  DiscoveryResponse,
  DiscoverySectionName,
} from '../types/discovery.types';

export interface UseDiscoveryParams {
  countryCode: string;
  category: DiscoveryCategory;
  section?: DiscoverySectionName;
  limit?: number;
  enabled?: boolean;
}

/**
 * Contenu Tripadvisor chargé À LA DEMANDE, uniquement quand la section est
 * ouverte. Aucun cache persistant : `cache: no-store` + `staleTime/gcTime: 0`.
 * Un 429 (quota) devient un état discret, jamais une erreur bloquante.
 */
export function useDiscovery({
  countryCode,
  category,
  section,
  limit,
  enabled = true,
}: UseDiscoveryParams) {
  const code = countryCode.trim().toUpperCase();

  return useQuery<DiscoveryResponse>({
    queryKey: ['discovery', 'provider', code, category, section ?? 'default', limit ?? 'default'],
    enabled: enabled && code.length === 2,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const search = new URLSearchParams({ countryCode: code, category });
      if (section) search.set('section', section);
      if (limit) search.set('limit', String(limit));

      const response = await fetch(`/api/discovery/search?${search.toString()}`, {
        cache: 'no-store',
      });

      if (response.status === 429) {
        return {
          status: 'quota',
          reason: 'quota',
          provider: 'tripadvisor',
          category,
          countryCode: code,
          items: [],
          attribution: getTripadvisorAttribution(),
        } satisfies DiscoveryResponse;
      }

      if (!response.ok) {
        throw new Error('Échec du chargement du contenu Tripadvisor');
      }

      return (await response.json()) as DiscoveryResponse;
    },
  });
}
