/**
 * Brouillon sans compte (1.7) : on trace sans se connecter ; l'atelier est gardé sur l'appareil
 * (`pendingDraft.ts`) et repris après `/connexion`. La connexion n'est demandée qu'à l'enregistrement.
 */
import { z } from 'zod';
import {
  clearPendingRouteDraft,
  readPendingRouteDraft,
  savePendingRouteDraft,
  type SavePendingRouteResult,
} from '@/features/compas/engine/pendingDraft';
import { buildItineraryHref } from './insights/deepLinks';
import type { RouteWorkspaceState } from './types';

const stateShape = z
  .object({
    id: z.string().min(1).max(120),
    tripId: z.string().min(1).max(120),
    title: z.string().max(300),
    sport: z.enum(['marche', 'route', 'gravel', 'vtt', 'enduro']),
    points: z.array(z.object({ id: z.string(), lat: z.number(), lon: z.number(), orderKey: z.string() }).passthrough()).max(2000),
    sections: z.array(z.object({ id: z.string(), fromPointId: z.string(), toPointId: z.string() }).passthrough()).max(2000),
    stages: z.array(z.object({ id: z.string() }).passthrough()).max(100),
  })
  .passthrough();

/** Un atelier sans point n'est pas un brouillon : rien à garder. */
export function hasDraftContent(ws: Pick<RouteWorkspaceState, 'points'>): boolean {
  return ws.points.some((p) => !p.deletedAt);
}

export function saveGuestWorkspace(ws: RouteWorkspaceState): SavePendingRouteResult | 'empty' {
  if (!hasDraftContent(ws)) {
    clearPendingRouteDraft();
    return 'empty';
  }
  return savePendingRouteDraft({ workspace: ws, tripId: ws.tripId });
}

/** Brouillon repris, validé ; `null` s'il manque, a expiré ou est illisible (jamais deviné). */
export function readGuestWorkspace(expectedTripId?: string | null): RouteWorkspaceState | null {
  const pending = readPendingRouteDraft();
  if (!pending) return null;
  const parsed = stateShape.safeParse(pending.workspace);
  if (!parsed.success) return null;
  if (expectedTripId && pending.tripId && pending.tripId !== expectedTripId) return null;
  return parsed.data as unknown as RouteWorkspaceState;
}

export function clearGuestWorkspace(): void {
  clearPendingRouteDraft();
}

/** Lien de connexion qui ramène sur l'itinéraire (même voyage, même point d'entrée). */
export function loginHrefForRoute(tripId?: string | null): string {
  const back = buildItineraryHref(tripId ? { tripId } : {});
  return `/connexion?next=${encodeURIComponent(back)}`;
}

export const GUEST_USER_ID = 'guest-local';

/**
 * Reprise après connexion : le brouillon appartient désormais à la personne connectée (sans quoi elle ne
 * pourrait plus le modifier : seul « guest-local » en était propriétaire). Rattaché au voyage d'entrée s'il y en a un.
 */
export function adoptGuestWorkspace(
  ws: RouteWorkspaceState,
  who: { userId: string; userName: string; tripId?: string | null },
): RouteWorkspaceState {
  const members = ws.members.some((m) => m.userId === GUEST_USER_ID)
    ? ws.members.map((m) => (m.userId === GUEST_USER_ID ? { ...m, userId: who.userId, displayName: who.userName } : m))
    : ws.members.some((m) => m.userId === who.userId)
      ? ws.members
      : [{ userId: who.userId, displayName: who.userName, role: 'owner' as const }, ...ws.members];
  return {
    ...ws,
    tripId: who.tripId ?? ws.tripId,
    members,
    kitItems: ws.kitItems.map((k) =>
      k.assigneeUserId === GUEST_USER_ID ? { ...k, assigneeUserId: who.userId, assigneeName: who.userName } : k,
    ),
  };
}
