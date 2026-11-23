/**
 * Règle de vérité « un seul tracé par voyage » (P4 / 10.1), partie pure et testée.
 *
 * - Quand un espace d'itinéraire est publié pour un voyage, la VERSION PUBLIÉE gagne : le `routeDraft` du
 *   Compas en est une copie dérivée (même identité de version, `engine = PUBLISHED_ROUTE_ENGINE`).
 * - Sans espace publié, le `routeDraft` du Compas reste la source (la lecture inverse est `compasDraft.ts`).
 * - Jamais de perte silencieuse : un routeDraft enregistré dans l'éditeur du Compas APRÈS la publication
 *   (`savedAt` plus récent) n'est pas écrasé (`editor_newer`) ; le Compas propose alors « Ouvrir dans
 *   l'itinéraire » et la prochaine publication reprend la main.
 * - Idempotent : si la copie vient déjà de cette version publiée, rien n'est réécrit.
 * - Une écriture seulement, par `writeTripRouteDraft` (features/compas/server/routeDraftWrite.ts).
 */
import { readRouteDraft, type RouteRevision } from '@/features/adventure-prep/routeRevision';
import {
  pickPublishedWorkspaceForTrip,
  publishedRevisionOf,
  publishedRevisionToRouteDraft,
  routeDraftNeedsSync,
} from './integrations';
import type { RouteWorkspaceState } from './types';

export type RouteDraftSyncPlan =
  | { readonly action: 'none'; readonly reason: 'no_published' | 'up_to_date' | 'no_geometry' | 'editor_newer' }
  | {
      readonly action: 'write';
      readonly draft: RouteRevision;
      readonly workspaceId: string;
      readonly revisionNo: number;
      /** Un routeDraft modifié à la main dans le Compas va être remplacé par la version publiée. */
      readonly replacesEditorDraft: boolean;
    };

export function planRouteDraftSync(input: {
  readonly tripId: string;
  readonly metadata: unknown;
  readonly workspaces: readonly RouteWorkspaceState[];
}): RouteDraftSyncPlan {
  const ws = pickPublishedWorkspaceForTrip(input.workspaces, input.tripId);
  if (!ws) return { action: 'none', reason: 'no_published' };
  const rev = publishedRevisionOf(ws);
  if (!rev) return { action: 'none', reason: 'no_published' };
  const draft = publishedRevisionToRouteDraft(rev, ws.sport);
  if (!draft) return { action: 'none', reason: 'no_geometry' };
  const current = readRouteDraft(input.metadata);
  if (!routeDraftNeedsSync(current, draft)) return { action: 'none', reason: 'up_to_date' };
  if (current && current.engine !== draft.engine && Date.parse(current.savedAt) > Date.parse(rev.createdAt)) {
    return { action: 'none', reason: 'editor_newer' };
  }
  return {
    action: 'write',
    draft,
    workspaceId: ws.id,
    revisionNo: rev.revisionNo,
    replacesEditorDraft: Boolean(current && current.engine !== draft.engine),
  };
}
