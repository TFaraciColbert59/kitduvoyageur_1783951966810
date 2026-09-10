'use client';

import { useQuery } from '@tanstack/react-query';

export interface PaysRegion {
  id: string;
  name: string;
}

export interface PaysRegionsData {
  status: 'ok' | 'empty' | 'error';
  items: PaysRegion[];
}

/** Régions administratives réelles du pays (GeoNames). Chargées si activées. */
export function usePaysRegions(countryCode?: string, enabled = true) {
  const code = countryCode?.trim().toUpperCase();
  return useQuery<PaysRegionsData>({
    queryKey: ['pays-regions', code],
    enabled: enabled && !!code && code.length === 2,
    staleTime: 24 * 60 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch(`/api/pays/${code}/regions`, { cache: 'no-store' });
      if (!response.ok) throw new Error('regions_unavailable');
      return (await response.json()) as PaysRegionsData;
    },
  });
}
