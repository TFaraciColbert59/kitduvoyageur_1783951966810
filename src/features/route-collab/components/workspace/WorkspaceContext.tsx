'use client';

import { createContext, useContext } from 'react';
import type { RouteWorkspaceApi } from './useRouteWorkspaceState';

export type { RouteWorkspaceApi } from './useRouteWorkspaceState';

const RouteWorkspaceContext = createContext<RouteWorkspaceApi | null>(null);

/** Fournisseur de l'état et des handlers du Compas itinéraire (valeur = `useRouteWorkspaceState`). */
export const RouteWorkspaceProvider = RouteWorkspaceContext.Provider;

/** Accès à l'état partagé par la carte, les onglets et les sous-tiroirs. */
export function useRouteWorkspace(): RouteWorkspaceApi {
  const value = useContext(RouteWorkspaceContext);
  if (!value) {
    throw new Error('useRouteWorkspace doit être utilisé sous <RouteWorkspaceProvider>.');
  }
  return value;
}
