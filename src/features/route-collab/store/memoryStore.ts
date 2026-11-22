import * as server from '../serverStore';
import type { RouteCollabStore } from './types';

/**
 * Enveloppe asynchrone de `serverStore.ts` (Map en mémoire + fichier JSON temporaire).
 * Aucune logique ici : sert aux tests Vitest et de repli quand Supabase n'est pas configuré.
 */
export const memoryRouteCollabStore: RouteCollabStore = {
  kind: 'memory',
  createWorkspaceRecord: async (initial) => server.createWorkspaceRecord(initial),
  listWorkspacesForActor: async (actorId) => server.listWorkspacesForActor(actorId),
  getWorkspaceForActor: async (workspaceId, actorId, shareToken) =>
    server.getWorkspaceForActor(workspaceId, actorId, shareToken),
  getWorkspaceChangesAfter: async (workspaceId, actorId, afterSeq, shareToken) =>
    server.getWorkspaceChangesAfter(workspaceId, actorId, afterSeq, shareToken),
  updateWorkspacePresence: async (params) => server.updateWorkspacePresence(params),
  submitWorkspaceOperation: async (workspaceId, command, nowIso) =>
    server.submitWorkspaceOperation(workspaceId, command, nowIso),
  createWorkspaceProposal: async (params) => server.createWorkspaceProposal(params),
  voteWorkspaceProposal: async (params) => server.voteWorkspaceProposal(params),
  decideWorkspaceProposal: async (params) => server.decideWorkspaceProposal(params),
  addWorkspaceComment: async (params) => server.addWorkspaceComment(params),
  relocateWorkspaceComment: async (params) => server.relocateWorkspaceComment(params),
  publishWorkspace: async (params) => server.publishWorkspace(params),
  markParticipantPackState: async (params) => server.markParticipantPackState(params),
  updateWorkspaceKitItem: async (params) => server.updateWorkspaceKitItem(params),
  updateMemberRoleOrRevoke: async (params) => server.updateMemberRoleOrRevoke(params),
  manageShareLink: async (params) => server.manageShareLink(params),
  getPackManifestForRevision: async (workspaceId, actorId, revisionNo) =>
    server.getPackManifestForRevision(workspaceId, actorId, revisionNo),
};
