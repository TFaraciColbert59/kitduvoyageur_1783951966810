'use client';

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import dynamic from 'next/dynamic';

const KitSheetModal = dynamic(() => import('./components/KitSheetModal'), {
  ssr: false,
});

export interface KitSheetOpenParams {
  kitId: string;
  /** Contexte d'attribution (tracking) : d'où provient l'ouverture. */
  context?: string;
}

interface KitSheetContextValue {
  openKit: (kitId: string, context?: string) => void;
  closeKit: () => void;
}

const KitSheetContext = createContext<KitSheetContextValue | null>(null);

/**
 * Le kit n'habite pas une adresse : il circule. Ce contexte global permet à
 * n'importe quel point de l'app (feed, messagerie, produit, cockpit) d'ouvrir
 * le KitSheet — bottom sheet mobile, drawer desktop. Monté UNE seule fois dans
 * le layout racine.
 */
export function KitSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<KitSheetOpenParams | null>(null);

  const openKit = useCallback((kitId: string, context?: string) => {
    setState({ kitId, context });
  }, []);

  const closeKit = useCallback(() => setState(null), []);

  const value = useMemo(() => ({ openKit, closeKit }), [openKit, closeKit]);

  return (
    <KitSheetContext.Provider value={value}>
      {children}
      {state && <KitSheetModal kitId={state.kitId} context={state.context} onClose={closeKit} />}
    </KitSheetContext.Provider>
  );
}

export function useKitSheet(): KitSheetContextValue {
  const ctx = useContext(KitSheetContext);
  if (!ctx) {
    throw new Error('useKitSheet doit être utilisé sous <KitSheetProvider>');
  }
  return ctx;
}