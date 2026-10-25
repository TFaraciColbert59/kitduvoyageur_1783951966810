'use client';

import { useQuery } from '@tanstack/react-query';
import type { PaysTrail } from '../types';

export type { PaysTrail } from '../types';

export interface PaysTrailsData {
  status: 'ok' | 'empty' | 'error';
  items: PaysTrail[];
}

/** Sentiers réels du pays (bbox PostGIS). Chargés uniquement si activés. */
export function usePaysTrails(countryCode?: string, enabled = true) {
  const code = countryCode?.trim().toUpperCase();
  return useQuery<PaysTrailsData>({
    queryKey: ['pays-trails', code],
    enabled: enabled && !!code && code.length === 2,
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch(`/api/pays/${code}/trails`, { cache: 'no-store' });
      if (!response.ok) throw new Error('trails_unavailable');
      return (await response.json()) as PaysTrailsData;
    },
  });
}
