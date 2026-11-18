import {
  applyWorkspaceOperation,
  computeRouteImpact,
  publishWorkspaceRevision,
  type ApplyOperationCommand,
  type PublishResult,
} from './engine';
import { hasRoutePermission } from './permissions';
import type {
  ApplyOperationResult,
  DeparturePackManifest,
  GeometryAnchor,
  RouteComment,
  RouteMemberAccess,
  RouteOperationInput,
  RouteOperationRecord,
  RouteProposal,
  RouteRole,
  RouteWorkspaceState,
} from './types';

export interface GroupedRouteNotification {
  readonly id: string;
  readonly workspaceId: string;
  readonly revisionNo: number | null;
  readonly title: string;
  readonly summary: string;
  readonly affectedUserIds: readonly string[];
  readonly reasonsByUserId: Readonly<Record<string, string>>;
  readonly createdAt: string;
}

interface WorkspaceRecord {
  state: RouteWorkspaceState;
  opLog: RouteOperationRecord[];
  notifications: GroupedRouteNotification[];
}

const globalForStore = globalThis as unknown as {
  __lkdvRouteCollabStore?: Map<string, WorkspaceRecord>;
};

function getStore(): Map<string, WorkspaceRecord> {
  if (!globalForStore.__lkdvRouteCollabStore) {
    globalForStore.__lkdvRouteCollabStore = new Map();
  }
  return globalForStore.__lkdvRouteCollabStore;
}

export function resetRouteCollabStoreForTests(): void {
  getStore().clear();
}

export function createWorkspaceRecord(initial: RouteWorkspaceState): RouteWorkspaceState {
  const store = getStore();
  store.set(initial.id, { state: initial, opLog: [], notifications: [] });
  return initial;
}

export function getWorkspaceForActor(
  workspaceId: string,
  actorId: string | null,
): { ok: true; workspace: RouteWorkspaceState; notifications: readonly GroupedRouteNotification[] } | { ok: false; status: 401 | 403 | 404; error: string } {
  const rec = getStore().get(workspaceId);
  if (!rec) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
  if (!actorId) return { ok: false, status: 401, error: 'Authentification requise.' };

  const member = rec.state.members.find((m) => m.userId === actorId);
  if (!hasRoutePermission(member, 'route.read')) {
    return { ok: false, status: 403, error: 'Accès refusé ou révoqué.' };
  }

  return { ok: true, workspace: rec.state, notifications: rec.notifications };
}

export function getWorkspaceChangesAfter(
  workspaceId: string,
  actorId: string | null,
  afterSeq: number,
):
  | {
      ok: true;
      headSeq: number;
      resyncRequired: boolean;
      operations: readonly RouteOperationRecord[];
      workspace: RouteWorkspaceState;
    }
  | { ok: false; status: 401 | 403 | 404; error: string } {
  const read = getWorkspaceForActor(workspaceId, actorId);
  if (!read.ok) return read;
  const rec = getStore().get(workspaceId)!;
  const firstAvailableSeq = rec.opLog[0]?.seq ?? 1;
  const resyncRequired = afterSeq > 0 && afterSeq < firstAvailableSeq - 1;
  const operations = rec.opLog.filter((op) => op.seq > afterSeq);
  return {
    ok: true,
    headSeq: rec.state.headSeq,
    resyncRequired,
    operations,
    workspace: rec.state,
  };
}

export function submitWorkspaceOperation(
  workspaceId: string,
  command: ApplyOperationCommand,
  nowIso = new Date().toISOString(),
): ApplyOperationResult | { readonly status: 'not_found' } {
  const rec = getStore().get(workspaceId);
  if (!rec) return { status: 'not_found' };

  const { result, nextOpLog } = applyWorkspaceOperation(rec.state, rec.opLog, command, nowIso);
  if (result.status === 'accepted') {
    rec.state = result.workspace;
    rec.opLog = [...nextOpLog];
  }
  return result;
}

export function createWorkspaceProposal(params: {
  workspaceId: string;
  actorId: string;
  actorName: string;
  title: string;
  rationale: string;
  operations: readonly RouteOperationInput[];
  nowIso?: string;
}):
  | { ok: true; proposal: RouteProposal; workspace: RouteWorkspaceState }
  | { ok: false; status: 403 | 404; error: string } {
  const rec = getStore().get(params.workspaceId);
  if (!rec) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
  const member = rec.state.members.find((m) => m.userId === params.actorId);
  if (!hasRoutePermission(member, 'route.propose')) {
    return { ok: false, status: 403, error: 'Permission de proposition requise.' };
  }

  const nowIso = params.nowIso ?? new Date().toISOString();
  // Simuler l'impact avant/après sans muter le brouillon principal.
  let previewState = rec.state;
  let tempLog = rec.opLog;
  for (let i = 0; i < params.operations.length; i += 1) {
    const sim = applyWorkspaceOperation(
      previewState,
      tempLog,
      {
        opId: `sim-${Date.now()}-${i}`,
        baseSeq: previewState.headSeq,
        actorId: params.actorId,
        actorName: params.actorName,
        operation: params.operations[i],
      },
      nowIso,
    );
    if (sim.result.status === 'accepted') {
      previewState = sim.result.workspace;
      tempLog = [...sim.nextOpLog];
    }
  }
  const impact = computeRouteImpact(rec.state, previewState);
  const scopeIds = Array.from(
    new Set(
      params.operations.flatMap((op) => {
        if ('pointId' in op) return [op.pointId];
        if ('sectionId' in op) return [op.sectionId];
        if ('stageId' in op) return [op.stageId];
        return [];
      }),
    ),
  );

  const proposal: RouteProposal = {
    id: `prop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: params.workspaceId,
    baseSeq: rec.state.headSeq,
    createdBy: params.actorId,
    authorName: params.actorName,
    title: params.title,
    rationale: params.rationale,
    scopeEntityIds: scopeIds,
    operations: params.operations,
    impactPreview: impact,
    status: 'open',
    votes: {},
    createdAt: nowIso,
  };

  rec.state = {
    ...rec.state,
    proposals: [...rec.state.proposals, proposal],
    updatedAt: nowIso,
  };
  return { ok: true, proposal, workspace: rec.state };
}

export function decideWorkspaceProposal(params: {
  workspaceId: string;
  proposalId: string;
  actorId: string;
  actorName: string;
  decision: 'accept' | 'reject';
  expectedHeadSeq?: number;
  nowIso?: string;
}):
  | { ok: true; proposal: RouteProposal; workspace: RouteWorkspaceState }
  | { ok: false; status: 403 | 404 | 409; error: string } {
  const rec = getStore().get(params.workspaceId);
  if (!rec) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
  const member = rec.state.members.find((m) => m.userId === params.actorId);
  if (!hasRoutePermission(member, 'route.review')) {
    return { ok: false, status: 403, error: 'Permission de validation requise.' };
  }
  const proposal = rec.state.proposals.find((p) => p.id === params.proposalId);
  if (!proposal) return { ok: false, status: 404, error: 'Proposition introuvable.' };
  if (proposal.status !== 'open') {
    return { ok: false, status: 409, error: `Proposition déjà traitée (${proposal.status}).` };
  }

  const nowIso = params.nowIso ?? new Date().toISOString();

  if (params.decision === 'reject') {
    const updated: RouteProposal = {
      ...proposal,
      status: 'rejected',
      reviewedBy: params.actorId,
      reviewedAt: nowIso,
    };
    rec.state = {
      ...rec.state,
      proposals: rec.state.proposals.map((p) => (p.id === proposal.id ? updated : p)),
      updatedAt: nowIso,
    };
    return { ok: true, proposal: updated, workspace: rec.state };
  }

  // Vérifier l'état courant avant d'accepter une proposition.
  if (params.expectedHeadSeq !== undefined && params.expectedHeadSeq !== rec.state.headSeq) {
    return {
      ok: false,
      status: 409,
      error: `Le brouillon a changé (seq ${rec.state.headSeq} vs ${params.expectedHeadSeq}) : relisez la proposition avant acceptation.`,
    };
  }
  if (proposal.baseSeq !== rec.state.headSeq && params.expectedHeadSeq === undefined) {
    // Marquer comme obsolète si l'état de base a divergé et que l'appelant n'a pas reconfirmé.
    const superseded: RouteProposal = { ...proposal, status: 'superseded' };
    rec.state = {
      ...rec.state,
      proposals: rec.state.proposals.map((p) => (p.id === proposal.id ? superseded : p)),
      updatedAt: nowIso,
    };
    return {
      ok: false,
      status: 409,
      error: `Proposition basée sur seq ${proposal.baseSeq}, mais le brouillon est à seq ${rec.state.headSeq}. Revalidez avant d'appliquer.`,
    };
  }

  let workingState = rec.state;
  let workingLog = rec.opLog;
  for (let i = 0; i < proposal.operations.length; i += 1) {
    const res = applyWorkspaceOperation(
      workingState,
      workingLog,
      {
        opId: `accept-${proposal.id}-${i}`,
        baseSeq: workingState.headSeq,
        actorId: params.actorId,
        actorName: params.actorName,
        operation: proposal.operations[i],
      },
      nowIso,
    );
    if (res.result.status !== 'accepted') {
      return {
        ok: false,
        status: 409,
        error: 'Impossible d’appliquer la proposition sur l’état courant.',
      };
    }
    workingState = res.result.workspace;
    workingLog = [...res.nextOpLog];
  }

  const accepted: RouteProposal = {
    ...proposal,
    status: 'accepted',
    reviewedBy: params.actorId,
    reviewedAt: nowIso,
  };
  rec.state = {
    ...workingState,
    proposals: workingState.proposals.map((p) => (p.id === proposal.id ? accepted : p)),
    updatedAt: nowIso,
  };
  rec.opLog = workingLog;
  return { ok: true, proposal: accepted, workspace: rec.state };
}

export function addWorkspaceComment(params: {
  workspaceId: string;
  actorId: string;
  actorName: string;
  body: string;
  anchor: GeometryAnchor;
  nowIso?: string;
}):
  | { ok: true; comment: RouteComment; workspace: RouteWorkspaceState }
  | { ok: false; status: 403 | 404; error: string } {
  const rec = getStore().get(params.workspaceId);
  if (!rec) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
  const member = rec.state.members.find((m) => m.userId === params.actorId);
  if (!hasRoutePermission(member, 'route.comment')) {
    return { ok: false, status: 403, error: 'Permission de commentaire requise.' };
  }
  const nowIso = params.nowIso ?? new Date().toISOString();
  const comment: RouteComment = {
    id: `cmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: params.workspaceId,
    createdBy: params.actorId,
    authorName: params.actorName,
    body: params.body,
    anchor: params.anchor,
    baseRevisionNo: rec.state.publishedRevisionNo ?? 0,
    status: 'open',
    createdAt: nowIso,
  };
  rec.state = {
    ...rec.state,
    comments: [...rec.state.comments, comment],
    updatedAt: nowIso,
  };
  return { ok: true, comment, workspace: rec.state };
}

export function relocateWorkspaceComment(params: {
  workspaceId: string;
  commentId: string;
  actorId: string;
  newAnchor: GeometryAnchor;
}): { ok: true; comment: RouteComment } | { ok: false; status: 403 | 404; error: string } {
  const rec = getStore().get(params.workspaceId);
  if (!rec) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
  const member = rec.state.members.find((m) => m.userId === params.actorId);
  if (!hasRoutePermission(member, 'route.comment')) {
    return { ok: false, status: 403, error: 'Permission insuffisante.' };
  }
  const cmt = rec.state.comments.find((c) => c.id === params.commentId);
  if (!cmt) return { ok: false, status: 404, error: 'Commentaire introuvable.' };

  const updated: RouteComment = { ...cmt, anchor: params.newAnchor, status: 'open' };
  rec.state = {
    ...rec.state,
    comments: rec.state.comments.map((c) => (c.id === cmt.id ? updated : c)),
  };
  return { ok: true, comment: updated };
}

export function publishWorkspace(params: {
  workspaceId: string;
  actorId: string;
  actorName: string;
  expectedHeadSeq: number;
  summary: string;
  acknowledgedUnknowns?: readonly string[];
  nowIso?: string;
}): PublishResult | { readonly status: 'not_found' } {
  const rec = getStore().get(params.workspaceId);
  if (!rec) return { status: 'not_found' };
  const nowIso = params.nowIso ?? new Date().toISOString();
  const prevState = rec.state;
  const res = publishWorkspaceRevision({
    workspace: rec.state,
    actorId: params.actorId,
    actorName: params.actorName,
    expectedHeadSeq: params.expectedHeadSeq,
    summary: params.summary,
    acknowledgedUnknowns: params.acknowledgedUnknowns,
    nowIso,
  });
  if (res.status === 'published') {
    rec.state = res.workspace;
    // Notification groupée par publication précisant les personnes concernées et la raison.
    const reasonsByUserId: Record<string, string> = {};
    const affectedIds = new Set<string>();
    for (const pp of res.workspace.participantPacks) {
      if (pp.userId !== params.actorId && pp.downloadedRevisionNo !== res.revision.revisionNo) {
        affectedIds.add(pp.userId);
        reasonsByUserId[pp.userId] = `Version ${res.revision.revisionNo} publiée — pack à mettre à jour`;
      }
    }
    const impact = computeRouteImpact(prevState, res.workspace);
    for (const am of impact.affectedMembers) {
      affectedIds.add(am.userId);
      reasonsByUserId[am.userId] = reasonsByUserId[am.userId]
        ? `${reasonsByUserId[am.userId]} · ${am.reason}`
        : am.reason;
    }
    if (affectedIds.size > 0) {
      rec.notifications.push({
        id: `notif-${res.revision.id}`,
        workspaceId: params.workspaceId,
        revisionNo: res.revision.revisionNo,
        title: `Version ${res.revision.revisionNo} publiée : ${res.revision.summary}`,
        summary: `${affectedIds.size} équipier(s) concerné(s)`,
        affectedUserIds: Array.from(affectedIds),
        reasonsByUserId,
        createdAt: nowIso,
      });
    }
  }
  return res;
}

export function markParticipantPackState(params: {
  workspaceId: string;
  userId: string;
  displayName: string;
  downloadedRevisionNo?: number | null;
  preparedRevisionNo?: number | null;
  status: 'not_downloaded' | 'downloading' | 'ready' | 'outdated' | 'failed';
  verifiedLocalAt?: string | null;
}): { ok: true; workspace: RouteWorkspaceState } | { ok: false; error: string } {
  const rec = getStore().get(params.workspaceId);
  if (!rec) return { ok: false, error: 'Itinéraire introuvable.' };
  const member = rec.state.members.find((m) => m.userId === params.userId);
  if (!hasRoutePermission(member, 'route.download_pack')) {
    return { ok: false, error: 'Accès au pack refusé.' };
  }

  const existing = rec.state.participantPacks.find((p) => p.userId === params.userId);
  const nextEntry = {
    userId: params.userId,
    displayName: params.displayName,
    preparedRevisionNo:
      params.preparedRevisionNo !== undefined
        ? params.preparedRevisionNo
        : existing?.preparedRevisionNo ?? null,
    downloadedRevisionNo:
      params.downloadedRevisionNo !== undefined
        ? params.downloadedRevisionNo
        : existing?.downloadedRevisionNo ?? null,
    verifiedLocalAt:
      params.verifiedLocalAt !== undefined
        ? params.verifiedLocalAt
        : existing?.verifiedLocalAt ?? null,
    status: params.status,
  };

  const nextPacks = existing
    ? rec.state.participantPacks.map((p) => (p.userId === params.userId ? nextEntry : p))
    : [...rec.state.participantPacks, nextEntry];

  rec.state = { ...rec.state, participantPacks: nextPacks };
  return { ok: true, workspace: rec.state };
}

export function updateMemberRoleOrRevoke(params: {
  workspaceId: string;
  actorId: string;
  targetUserId: string;
  role?: RouteRole;
  revoke?: boolean;
  displayName?: string;
  nowIso?: string;
}): { ok: true; workspace: RouteWorkspaceState } | { ok: false; status: 403 | 404; error: string } {
  const rec = getStore().get(params.workspaceId);
  if (!rec) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
  const actor = rec.state.members.find((m) => m.userId === params.actorId);
  if (!hasRoutePermission(actor, 'route.manage_members')) {
    return { ok: false, status: 403, error: 'Gestion des membres réservée au responsable.' };
  }
  const nowIso = params.nowIso ?? new Date().toISOString();
  const exists = rec.state.members.find((m) => m.userId === params.targetUserId);
  let nextMembers: RouteMemberAccess[];
  if (exists) {
    nextMembers = rec.state.members.map((m) =>
      m.userId === params.targetUserId
        ? {
            ...m,
            role: params.role ?? m.role,
            revokedAt: params.revoke ? nowIso : null,
          }
        : m,
    );
  } else {
    nextMembers = [
      ...rec.state.members,
      {
        userId: params.targetUserId,
        displayName: params.displayName ?? params.targetUserId,
        role: params.role ?? 'participant',
        revokedAt: params.revoke ? nowIso : null,
      },
    ];
  }
  rec.state = { ...rec.state, members: nextMembers, updatedAt: nowIso };
  return { ok: true, workspace: rec.state };
}

export function getPackManifestForRevision(
  workspaceId: string,
  actorId: string | null,
  revisionNo?: number,
):
  | { ok: true; manifest: DeparturePackManifest }
  | { ok: false; status: 401 | 403 | 404; error: string } {
  const read = getWorkspaceForActor(workspaceId, actorId);
  if (!read.ok) return read;
  const pack =
    revisionNo != null
      ? read.workspace.packs.find((p) => p.revisionNo === revisionNo)
      : read.workspace.packs[read.workspace.packs.length - 1];
  if (!pack) return { ok: false, status: 404, error: 'Pack introuvable pour cette révision.' };
  return { ok: true, manifest: pack };
}
