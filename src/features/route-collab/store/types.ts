import type * as ServerStore from '../serverStore';

/**
 * Contrat de stockage de l'itinéraire collaboratif.
 *
 * Deux implémentations :
 *  - `memoryStore.ts` : enveloppe asynchrone de `serverStore.ts` (Map + fichier temporaire),
 *    utilisée par Vitest et quand Supabase n'est pas configuré ;
 *  - `supabaseStore.ts` : état complet dans `route_workspaces.state_snapshot`, lecture avec le
 *    client Supabase de l'utilisateur (RLS) et écriture uniquement via des RPC SECURITY DEFINER.
 *
 * Les méthodes reprennent exactement les noms, paramètres et retours de `serverStore.ts`,
 * rendus asynchrones : les routes API font `await store.xxx(...)`.
 */

type Fn<K extends keyof typeof ServerStore> = (typeof ServerStore)[K];
type AsyncFn<K extends keyof typeof ServerStore> = Fn<K> extends (...args: infer A) => infer R
  ? (...args: A) => Promise<R>
  : never;

export type GroupedRouteNotification = ServerStore.GroupedRouteNotification;

export interface RouteCollabStore {
  /** `memory` : Map + fichier temporaire ; `supabase` : base de données avec RLS. */
  readonly kind: 'memory' | 'supabase';

  /**
   * Crée l'espace. En mode Supabase, lève `RouteCollabStoreError` (403) si l'utilisateur n'a pas
   * le droit d'éditer le voyage rattaché, et l'identifiant est un UUID attribué par le store.
   */
  createWorkspaceRecord: AsyncFn<'createWorkspaceRecord'>;
  listWorkspacesForActor: AsyncFn<'listWorkspacesForActor'>;
  getWorkspaceForActor: AsyncFn<'getWorkspaceForActor'>;
  getWorkspaceChangesAfter: AsyncFn<'getWorkspaceChangesAfter'>;
  /**
   * Présence : reste en mémoire process dans les deux implémentations pour l'instant
   * (elle passera par Supabase Realtime Broadcast plus tard).
   */
  updateWorkspacePresence: AsyncFn<'updateWorkspacePresence'>;
  submitWorkspaceOperation: AsyncFn<'submitWorkspaceOperation'>;
  createWorkspaceProposal: AsyncFn<'createWorkspaceProposal'>;
  voteWorkspaceProposal: AsyncFn<'voteWorkspaceProposal'>;
  decideWorkspaceProposal: AsyncFn<'decideWorkspaceProposal'>;
  addWorkspaceComment: AsyncFn<'addWorkspaceComment'>;
  relocateWorkspaceComment: AsyncFn<'relocateWorkspaceComment'>;
  publishWorkspace: AsyncFn<'publishWorkspace'>;
  markParticipantPackState: AsyncFn<'markParticipantPackState'>;
  updateWorkspaceKitItem: AsyncFn<'updateWorkspaceKitItem'>;
  updateMemberRoleOrRevoke: AsyncFn<'updateMemberRoleOrRevoke'>;
  manageShareLink: AsyncFn<'manageShareLink'>;
  getPackManifestForRevision: AsyncFn<'getPackManifestForRevision'>;
}

/** Erreur inattendue ou refus dont la route doit traduire le statut HTTP. */
export class RouteCollabStoreError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 500;

  constructor(status: 400 | 403 | 404 | 409 | 500, message: string) {
    super(message);
    this.name = 'RouteCollabStoreError';
    this.status = status;
  }
}
