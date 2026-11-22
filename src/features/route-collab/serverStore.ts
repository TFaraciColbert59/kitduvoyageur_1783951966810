import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyWorkspaceOperation,
  computeRouteImpact,
  publishWorkspaceRevision,
  type ApplyOperationCommand,
  type PublishResult,
} from './engine';
import { hasRoutePermission } from './permissions';
import { sanitizeWorkspaceForShareLink } from './shareSanitize';
import type {
  ApplyOperationResult,
  CollaborativeKitItem,
  DeparturePackManifest,
  GeometryAnchor,
  PresenceEntry,
  RouteComment,
  RouteMemberAccess,
  RouteOperationInput,
  RouteOperationRecord,
  RouteProposal,
  RouteRole,
  RouteWorkspaceState,
  ShareLinkConfig,
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
  presence: Record<string, PresenceEntry>;
}

const STORE_FILE = path.join(os.tmpdir(), 'lkdv-route-collab-store-v1.json');
const IS_VITEST = Boolean(process.env.VITEST);

const globalForStore = globalThis as unknown as {
  __lkdvRouteCollabStore?: Map<string, WorkspaceRecord>;
};

function loadFromDisk(): Map<string, WorkspaceRecord> {
  const map = new Map<string, WorkspaceRecord>();
  if (IS_VITEST) return map;
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, WorkspaceRecord>;
      for (const [id, rec] of Object.entries(parsed)) {
        map.set(id, {
          state: rec.state,
          opLog: Array.isArray(rec.opLog) ? rec.opLog : [],
          notifications: Array.isArray(rec.notifications) ? rec.notifications : [],
          presence: rec.presence ?? {},
        });
      }
    }
  } catch {
    /* ignore corrupted temp file */
  }
  return map;
}

function persistToDisk(store: Map<string, WorkspaceRecord>): void {
  if (IS_VITEST) return;
  try {
    const obj: Record<string, WorkspaceRecord> = {};
    for (const [k, v] of store.entries()) obj[k] = v;
    const tmp = `${STORE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
    fs.renameSync(tmp, STORE_FILE);
  } catch {
    /* ignore disk write failure */
  }
}

function getStore(): Map<string, WorkspaceRecord> {
  if (IS_VITEST) {
    if (!globalForStore.__lkdvRouteCollabStore) {
      globalForStore.__lkdvRouteCollabStore = new Map();
    }
    return globalForStore.__lkdvRouteCollabStore;
  }
  // Relire depuis le disque garantit la cohérence entre workers Next.js.
  const loaded = loadFromDisk();
  globalForStore.__lkdvRouteCollabStore = loaded;
  return loaded;
}

/** Purge les présences > 30 s et libère les verrous souples expirés (réutilisé par le store Supabase). */
export function prunePresence(presence: Record<string, PresenceEntry>, nowMs = Date.now()): PresenceEntry[] {
  const active: PresenceEntry[] = [];
  for (const [uid, entry] of Object.entries(presence)) {
    const seen = Date.parse(entry.lastSeenAt);
    if (!Number.isFinite(seen) || nowMs - seen > 30_000) {
      delete presence[uid];
      continue;
    }
    const lockExpired =
      entry.softLockExpiresAt != null && Date.parse(entry.softLockExpiresAt) <= nowMs;
    active.push(
      lockExpired ? { ...entry, softLockEntityId: null, softLockExpiresAt: null } : entry,
    );
  }
  return active;
}

export function resetRouteCollabStoreForTests(): void {
  if (globalForStore.__lkdvRouteCollabStore) {
    globalForStore.__lkdvRouteCollabStore.clear();
  }
  if (!IS_VITEST) {
    try {
      if (fs.existsSync(STORE_FILE)) fs.unlinkSync(STORE_FILE);
    } catch {
      /* ignore */
    }
  }
}

export function createWorkspaceRecord(initial: RouteWorkspaceState): RouteWorkspaceState {
  const store = getStore();
  store.set(initial.id, { state: initial, opLog: [], notifications: [], presence: {} });
  persistToDisk(store);
  return initial;
}

export function listWorkspacesForActor(actorId: string | null): RouteWorkspaceState[] {
  if (!actorId) return [];
  const store = getStore();
  const out: RouteWorkspaceState[] = [];
  for (const rec of store.values()) {
    const member = rec.state.members.find((m) => m.userId === actorId);
    if (hasRoutePermission(member, 'route.read')) {
      out.push(rec.state);
    }
  }
  return out;
}

export function getWorkspaceForActor(
  workspaceId: string,
  actorId: string | null,
  shareToken?: string | null,
):
  | {
      ok: true;
      workspace: RouteWorkspaceState;
      notifications: readonly GroupedRouteNotification[];
      presence: readonly PresenceEntry[];
      accessMode: 'member' | 'share_link';
    }
  | { ok: false; status: 401 | 403 | 404; error: string } {
  const store = getStore();
  const rec = store.get(workspaceId);
  if (!rec) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };

  if (actorId) {
    const member = rec.state.members.find((m) => m.userId === actorId);
    if (hasRoutePermission(member, 'route.read')) {
      return {
        ok: true,
        workspace: rec.state,
        notifications: rec.notifications,
        presence: prunePresence(rec.presence),
        accessMode: 'member',
      };
    }
  }

  // Vérification d'un lien de partage lecture seule (portée limitée, durée, révocation)
  if (shareToken && rec.state.shareLink && rec.state.shareLink.token === shareToken) {
    const link = rec.state.shareLink;
    if (link.revokedAt) {
      return { ok: false, status: 403, error: 'Ce lien de partage a été révoqué.' };
    }
    if (link.expiresAt && Date.parse(link.expiresAt) <= Date.now()) {
      return { ok: false, status: 403, error: 'Ce lien de partage a expiré.' };
    }
    // Ne jamais exposer les brouillons internes ni la zone de départ privée (RGPD, 8.9).
    const sanitized: RouteWorkspaceState = sanitizeWorkspaceForShareLink(rec.state);
    return {
      ok: true,
      workspace: sanitized,
      notifications: [],
      presence: [],
      accessMode: 'share_link',
    };
  }

  if (!actorId) return { ok: false, status: 401, error: 'Authentification requise.' };
  return { ok: false, status: 403, error: 'Accès refusé ou révoqué.' };
}

export function getWorkspaceChangesAfter(
  workspaceId: string,
  actorId: string | null,
  afterSeq: number,
  shareToken?: string | null,
):
  | {
      ok: true;
      headSeq: number;
      resyncRequired: boolean;
      operations: readonly RouteOperationRecord[];
      workspace: RouteWorkspaceState;
      presence: readonly PresenceEntry[];
      notifications: readonly GroupedRouteNotification[];
    }
  | { ok: false; status: 401 | 403 | 404; error: string } {
  const read = getWorkspaceForActor(workspaceId, actorId, shareToken);
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
    workspace: read.workspace,
    presence: read.presence,
    notifications: read.notifications,
  };
}

export function updateWorkspacePresence(params: {
  workspaceId: string;
  actorId: string;
  actorName: string;
  activeStageId?: string | null;
  selectedEntityId?: string | null;
  softLockEntityId?: string | null;
  mode?: 'viewing' | 'editing' | 'reviewing';
  nowIso?: string;
}): { ok: true; presence: readonly PresenceEntry[] } | { ok: false; status: 403 | 404; error: string } {
  const store = getStore();
  const rec = store.get(params.workspaceId);
  if (!rec) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
  const member = rec.state.members.find((m) => m.userId === params.actorId);
  if (!hasRoutePermission(member, 'route.read')) {
    return { ok: false, status: 403, error: 'Accès refusé.' };
  }
  const nowMs = params.nowIso ? Date.parse(params.nowIso) : Date.now();
  const nowIso = new Date(nowMs).toISOString();
  rec.presence[params.actorId] = {
    userId: params.actorId,
    displayName: params.actorName,
    activeStageId: params.activeStageId ?? null,
    selectedEntityId: params.selectedEntityId ?? null,
    softLockEntityId: params.softLockEntityId ?? null,
    softLockExpiresAt: params.softLockEntityId ? new Date(nowMs + 15_000).toISOString() : null,
    mode: params.mode ?? 'viewing',
    lastSeenAt: nowIso,
  };
  const active = prunePresence(rec.presence, nowMs);
  persistToDisk(store);
  return { ok: true, presence: active };
}

export function submitWorkspaceOperation(
  workspaceId: string,
  command: ApplyOperationCommand,
  nowIso = new Date().toISOString(),
): ApplyOperationResult | { readonly status: 'not_found' } {
  const store = getStore();
  const rec = store.get(workspaceId);
  if (!rec) return { status: 'not_found' };

  const { result, nextOpLog } = applyWorkspaceOperation(rec.state, rec.opLog, command, nowIso);
  if (result.status === 'accepted') {
    rec.state = result.workspace;
    rec.opLog = [...nextOpLog];
    persistToDisk(store);
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
  const store = getStore();
  const rec = store.get(params.workspaceId);
  if (!rec) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
  const member = rec.state.members.find((m) => m.userId === params.actorId);
  if (!hasRoutePermission(member, 'route.propose')) {
    return { ok: false, status: 403, error: 'Permission de proposition requise.' };
  }

  const nowIso = params.nowIso ?? new Date().toISOString();
  // Simuler l'impact avant/après sans muter le brouillon principal (en tant qu'owner virtuel pour la preview).
  let previewState = rec.state;
  let tempLog = rec.opLog;
  const ownerId = rec.state.members.find((m) => m.role === 'owner')?.userId ?? params.actorId;
  for (let i = 0; i < params.operations.length; i += 1) {
    const sim = applyWorkspaceOperation(
      previewState,
      tempLog,
      {
        opId: `sim-${Date.now()}-${i}`,
        baseSeq: previewState.headSeq,
        actorId: ownerId,
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
  persistToDisk(store);
  return { ok: true, proposal, workspace: rec.state };
}

export function voteWorkspaceProposal(params: {
  workspaceId: string;
  proposalId: string;
  actorId: string;
  vote: 'up' | 'down';
}): { ok: true; proposal: RouteProposal; workspace: RouteWorkspaceState } | { ok: false; status: 403 | 404; error: string } {
  const store = getStore();
  const rec = store.get(params.workspaceId);
  if (!rec) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
  const member = rec.state.members.find((m) => m.userId === params.actorId);
  if (!hasRoutePermission(member, 'route.comment')) {
    return { ok: false, status: 403, error: 'Permission de vote insuffisante.' };
  }
  const proposal = rec.state.proposals.find((p) => p.id === params.proposalId);
  if (!proposal) return { ok: false, status: 404, error: 'Proposition introuvable.' };
  const updated: RouteProposal = {
    ...proposal,
    votes: { ...proposal.votes, [params.actorId]: params.vote },
  };
  rec.state = {
    ...rec.state,
    proposals: rec.state.proposals.map((p) => (p.id === proposal.id ? updated : p)),
    updatedAt: new Date().toISOString(),
  };
  persistToDisk(store);
  return { ok: true, proposal: updated, workspace: rec.state };
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
  const store = getStore();
  const rec = store.get(params.workspaceId);
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
    persistToDisk(store);
    return { ok: true, proposal: updated, workspace: rec.state };
  }

  if (params.expectedHeadSeq !== undefined && params.expectedHeadSeq !== rec.state.headSeq) {
    return {
      ok: false,
      status: 409,
      error: `Le brouillon a changé (seq ${rec.state.headSeq} vs ${params.expectedHeadSeq}) : relisez la proposition avant acceptation.`,
    };
  }
  if (proposal.baseSeq !== rec.state.headSeq && params.expectedHeadSeq === undefined) {
    const superseded: RouteProposal = { ...proposal, status: 'superseded' };
    rec.state = {
      ...rec.state,
      proposals: rec.state.proposals.map((p) => (p.id === proposal.id ? superseded : p)),
      updatedAt: nowIso,
    };
    persistToDisk(store);
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
  persistToDisk(store);
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
  const store = getStore();
  const rec = store.get(params.workspaceId);
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
  persistToDisk(store);
  return { ok: true, comment, workspace: rec.state };
}

export function relocateWorkspaceComment(params: {
  workspaceId: string;
  commentId: string;
  actorId: string;
  newAnchor: GeometryAnchor;
}): { ok: true; comment: RouteComment; workspace: RouteWorkspaceState } | { ok: false; status: 403 | 404; error: string } {
  const store = getStore();
  const rec = store.get(params.workspaceId);
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
    updatedAt: new Date().toISOString(),
  };
  persistToDisk(store);
  return { ok: true, comment: updated, workspace: rec.state };
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
  const store = getStore();
  const rec = store.get(params.workspaceId);
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
    persistToDisk(store);
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
  const store = getStore();
  const rec = store.get(params.workspaceId);
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

  rec.state = { ...rec.state, participantPacks: nextPacks, updatedAt: new Date().toISOString() };
  persistToDisk(store);
  return { ok: true, workspace: rec.state };
}

export function updateWorkspaceKitItem(params: {
  workspaceId: string;
  actorId: string;
  action: 'assign' | 'revalidate' | 'add';
  itemId?: string;
  assigneeUserId?: string | null;
  newItem?: CollaborativeKitItem;
}): { ok: true; workspace: RouteWorkspaceState } | { ok: false; status: 403 | 404; error: string } {
  const store = getStore();
  const rec = store.get(params.workspaceId);
  if (!rec) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
  const member = rec.state.members.find((m) => m.userId === params.actorId);
  if (!hasRoutePermission(member, 'route.edit_stages') && !hasRoutePermission(member, 'route.edit_geometry')) {
    return { ok: false, status: 403, error: 'Permission d’édition du kit requise.' };
  }

  let nextKit = rec.state.kitItems.slice();
  if (params.action === 'add' && params.newItem) {
    nextKit = [...nextKit, params.newItem];
  } else if (params.action === 'assign' && params.itemId) {
    const assignee = rec.state.members.find((m) => m.userId === params.assigneeUserId);
    nextKit = nextKit.map((item) =>
      item.id === params.itemId
        ? {
            ...item,
            assigneeUserId: params.assigneeUserId ?? null,
            assigneeName: assignee?.displayName ?? null,
            status: params.assigneeUserId ? 'confirmed' : 'unassigned',
          }
        : item,
    );
  } else if (params.action === 'revalidate' && params.itemId) {
    nextKit = nextKit.map((item) =>
      item.id === params.itemId ? { ...item, status: 'confirmed', revalidationReason: null } : item,
    );
  }

  rec.state = { ...rec.state, kitItems: nextKit, updatedAt: new Date().toISOString() };
  persistToDisk(store);
  return { ok: true, workspace: rec.state };
}

export function updateMemberRoleOrRevoke(params: {
  workspaceId: string;
  actorId: string;
  targetUserId: string;
  role?: RouteRole;
  delegatedPublish?: boolean;
  revoke?: boolean;
  displayName?: string;
  nowIso?: string;
}): { ok: true; workspace: RouteWorkspaceState } | { ok: false; status: 403 | 404; error: string } {
  const store = getStore();
  const rec = store.get(params.workspaceId);
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
            delegatedPublish: params.delegatedPublish ?? m.delegatedPublish,
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
        delegatedPublish: params.delegatedPublish ?? false,
        revokedAt: params.revoke ? nowIso : null,
      },
    ];
  }
  if (params.revoke) {
    delete rec.presence[params.targetUserId];
  }
  rec.state = { ...rec.state, members: nextMembers, updatedAt: nowIso };
  persistToDisk(store);
  return { ok: true, workspace: rec.state };
}

export function manageShareLink(params: {
  workspaceId: string;
  actorId: string;
  action: 'create' | 'revoke';
  expiresInHours?: number;
  hidePrivateStartRadiusM?: number;
}): { ok: true; shareLink: ShareLinkConfig | null; workspace: RouteWorkspaceState } | { ok: false; status: 403 | 404; error: string } {
  const store = getStore();
  const rec = store.get(params.workspaceId);
  if (!rec) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
  const actor = rec.state.members.find((m) => m.userId === params.actorId);
  if (!hasRoutePermission(actor, 'route.manage_privacy')) {
    return { ok: false, status: 403, error: 'Gestion du partage réservée au responsable.' };
  }
  const now = new Date();
  let nextLink: ShareLinkConfig | null = rec.state.shareLink ?? null;
  if (params.action === 'revoke' && nextLink) {
    nextLink = { ...nextLink, revokedAt: now.toISOString() };
  } else if (params.action === 'create') {
    const token = `shr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const expiresAt = params.expiresInHours
      ? new Date(now.getTime() + params.expiresInHours * 3600_000).toISOString()
      : null;
    nextLink = {
      token,
      audience: 'external_viewer',
      expiresAt,
      revokedAt: null,
      hidePrivateStartRadiusM: params.hidePrivateStartRadiusM ?? 500,
      createdBy: params.actorId,
      createdAt: now.toISOString(),
    };
  }
  rec.state = { ...rec.state, shareLink: nextLink, updatedAt: now.toISOString() };
  persistToDisk(store);
  return { ok: true, shareLink: nextLink, workspace: rec.state };
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
