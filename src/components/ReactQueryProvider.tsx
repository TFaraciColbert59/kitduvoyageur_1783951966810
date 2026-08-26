'use client';
import React, { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * ReactQueryProvider — singleton QueryClient stable.
 *
 * Le QueryClient est créé UNE SEULE FOIS via useState(() => ...) pour éviter
 * que le cache soit détruit à chaque re-render du provider.
 * Sans ça, chaque navigation vers un écran déjà visité re-fetche depuis zéro.
 *
 * defaultOptions globaux :
 * - staleTime 60s  → les données fraîches ne déclenchent pas de refetch inutile
 * - gcTime 5 min   → les données restent en RAM 5 min après unmount
 * - retry 1        → un seul retry réseau (économise la batterie mobile)
 * - refetchOnWindowFocus false → pas de refetch au retour d'une autre app
 */
export default function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,            // 1 min — données fraîches sans refetch
            gcTime: 5 * 60_000,           // 5 min en mémoire après unmount
            retry: 1,                     // 1 retry réseau max (mobile)
            refetchOnWindowFocus: false,  // pas de refetch au focus (mobile)
            refetchOnReconnect: true,     // refresh silencieux au retour réseau
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
