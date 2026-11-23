import { z } from 'zod';

/**
 * Préférences d'interface de /compas/itineraire rangées par compte (4.1, table `user_ui_prefs`, RLS `auth.uid()`).
 * Une seule clé pour l'instant : `routeViewMode` (Simple / Expert). Toute autre clé est refusée à l'écriture et
 * ignorée à la lecture. Module pur, partagé par la route et le client.
 */
export const ROUTE_VIEW_MODES = ['simple', 'expert'] as const;
export type RouteViewMode = (typeof ROUTE_VIEW_MODES)[number];

export const uiPrefsPutSchema = z.object({ routeViewMode: z.enum(ROUTE_VIEW_MODES) }).strict();

export function readRouteViewMode(prefs: unknown): RouteViewMode | null {
  if (!prefs || typeof prefs !== 'object') return null;
  const v = (prefs as Record<string, unknown>).routeViewMode;
  return v === 'simple' || v === 'expert' ? v : null;
}
