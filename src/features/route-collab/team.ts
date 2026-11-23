import { applyWorkspaceOperation, computeRouteImpact, workspaceTotals } from './engine';
import { haversineKm } from '@/features/adventure-prep/engine/routing';
import { describeOperation } from './undo';
import type {
  DomainConflict,
  GeometryAnchor,
  PresenceEntry,
  RouteComment,
  RouteImpactSummary,
  RouteMemberAccess,
  RouteOperationInput,
  RouteProposal,
  RouteRole,
  RouteWorkspaceState,
  ShareLinkConfig,
} from './types';

/**
 * Catégorie 8 « Équipe » : le modèle pur (aucun React, aucun réseau).
 * Tout ce que l'interface affiche sur l'équipe se lit ici, pour être testé sans écran.
 */

/* ---------- 8.2 Trois droits en vue simple ---------- */

export type SimpleRight = 'edit' | 'propose' | 'view';

export interface SimpleRightOption {
  readonly value: SimpleRight;
  readonly role: Extract<RouteRole, 'editor' | 'contributor' | 'participant'>;
  readonly label: string;
}

/** « Peut modifier » = éditeur, « peut proposer » = contributeur, « peut voir » = participant. */
export const SIMPLE_RIGHTS: readonly SimpleRightOption[] = [
  { value: 'edit', role: 'editor', label: 'Peut modifier' },
  { value: 'propose', role: 'contributor', label: 'Peut proposer' },
  { value: 'view', role: 'participant', label: 'Peut voir' },
];

export function simpleRightOfRole(role: RouteRole): SimpleRight | null {
  switch (role) {
    case 'editor':
      return 'edit';
    case 'contributor':
      return 'propose';
    case 'participant':
    case 'external_viewer':
      return 'view';
    default:
      // Responsable et coorganisateur : des fonctions, pas des droits à choisir.
      return null;
  }
}

export function roleOfSimpleRight(right: SimpleRight): SimpleRightOption['role'] {
  return (SIMPLE_RIGHTS.find((r) => r.value === right) ?? SIMPLE_RIGHTS[2]).role;
}

export function simpleRightLabel(right: SimpleRight): string {
  return (SIMPLE_RIGHTS.find((r) => r.value === right) ?? SIMPLE_RIGHTS[2]).label;
}

/** Les rôles qu'un responsable peut attribuer en vue experte. */
export const EXPERT_ASSIGNABLE_ROLES = ['co_organizer', 'editor', 'contributor', 'participant'] as const;
export type ExpertAssignableRole = (typeof EXPERT_ASSIGNABLE_ROLES)[number];

export function isExpertAssignableRole(value: string): value is ExpertAssignableRole {
  return (EXPERT_ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

/* ---------- 8.3 Une étape confiée à quelqu'un ---------- */

export function activeMembers(members: readonly RouteMemberAccess[]): RouteMemberAccess[] {
  return members.filter((m) => !m.revokedAt);
}

export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return letters || '?';
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Les membres à qui ce jour est confié. */
export function stageAssignees(members: readonly RouteMemberAccess[], stageId: string): RouteMemberAccess[] {
  return activeMembers(members).filter((m) => m.stageScopeIds?.includes(stageId));
}

/** « Jour 2 · Mina » : jamais de nom inventé, rien quand l'étape n'est confiée à personne. */
export function stageAssignmentLabel(
  members: readonly RouteMemberAccess[],
  stage: { readonly id: string; readonly dayNumber: number },
): string | null {
  const who = stageAssignees(members, stage.id);
  if (who.length === 0) return null;
  return `Jour ${stage.dayNumber} · ${who.map((m) => firstNameOf(m.displayName)).join(', ')}`;
}

/** Nouvelle portée d'un membre après avoir (dé)confié une étape ; sans doublon, ordre conservé. */
export function nextStageScope(
  current: readonly string[] | undefined,
  stageId: string,
  assigned: boolean,
): string[] {
  const base = (current ?? []).filter((id) => id !== stageId);
  return assigned ? [...base, stageId] : base;
}

/**
 * Une portée non vide restreint l'édition du membre à ces étapes (`hasRoutePermission`). Seuls les rôles qui
 * modifient le tracé sont concernés : on le dit avant de confier, pour que personne ne perde la main sans le savoir.
 */
export function stageScopeRestrictsEditing(role: RouteRole): boolean {
  return role === 'editor' || role === 'co_organizer';
}

/* ---------- 8.4 Présence légère ---------- */

/** Qui travaille sur quelle étape (soi exclu) : sert au contour de la chip de jour, sans curseur. */
export function presenceByStage(
  presence: readonly PresenceEntry[],
  currentUserId: string,
): Map<string, PresenceEntry[]> {
  const out = new Map<string, PresenceEntry[]>();
  for (const entry of presence) {
    if (entry.userId === currentUserId || !entry.activeStageId) continue;
    const list = out.get(entry.activeStageId) ?? [];
    list.push(entry);
    out.set(entry.activeStageId, list);
  }
  return out;
}

export function presenceLabel(entries: readonly PresenceEntry[]): string {
  if (entries.length === 0) return '';
  const verb = (e: PresenceEntry) => (e.mode === 'editing' ? 'modifie' : e.mode === 'reviewing' ? 'relit' : 'regarde');
  if (entries.length === 1) return `${firstNameOf(entries[0].displayName)} ${verb(entries[0])} ce jour`;
  return `${entries.map((e) => firstNameOf(e.displayName)).join(', ')} sont sur ce jour`;
}

/* ---------- 8.5 Conflit compréhensible ---------- */

export interface ConflictPositions {
  readonly pointLabel: string;
  readonly mine: { readonly lat: number; readonly lon: number };
  readonly theirs: { readonly lat: number; readonly lon: number };
  readonly distanceM: number;
  readonly theirName: string | null;
}

/**
 * Les deux positions d'un même point : celle que je voulais, celle qui est en place. `null` quand l'opération en
 * conflit n'est pas un déplacement (on retombe alors sur les résumés textes de la base).
 */
export function conflictPositions(
  conflict: Pick<DomainConflict, 'currentActorName'>,
  pendingOp: RouteOperationInput,
  current: RouteWorkspaceState,
): ConflictPositions | null {
  if (pendingOp.type !== 'move_point') return null;
  const point = current.points.find((p) => p.id === pendingOp.pointId && !p.deletedAt);
  if (!point) return null;
  const distanceM = Math.round(
    haversineKm({ lat: pendingOp.lat, lon: pendingOp.lon }, { lat: point.lat, lon: point.lon }) * 1000,
  );
  return {
    pointLabel: point.name?.trim() || 'ce point',
    mine: { lat: pendingOp.lat, lon: pendingOp.lon },
    theirs: { lat: point.lat, lon: point.lon },
    distanceM,
    theirName: conflict.currentActorName ?? null,
  };
}

export function formatCoord(c: { readonly lat: number; readonly lon: number }): string {
  const f = (n: number) => n.toFixed(5).replace('.', ',');
  return `${f(c.lat)} · ${f(c.lon)}`;
}

export function formatMeters(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Une proposition à partir d'une opération refusée par conflit : titre sans jargon. */
export function conflictProposalTitle(pendingOp: RouteOperationInput, current: RouteWorkspaceState): string {
  return `Ma version : ${describeOperation(pendingOp, current)}`.slice(0, 160);
}

/* ---------- 8.6 Propositions avant / après ---------- */

export interface ProposalFigures {
  readonly distanceKm: number;
  readonly durationMin: number | null;
  readonly ascentM: number | null;
}

export interface ProposalImpactView {
  readonly before: ProposalFigures;
  readonly after: ProposalFigures | null;
  readonly deltaKm: number | null;
  readonly deltaDurationMin: number | null;
  readonly kitLines: readonly string[];
  readonly kitText: string;
  readonly impact: RouteImpactSummary | null;
}

/** Simule les opérations sur l'état courant, comme le serveur, sans rien muter. */
export function simulateOperations(
  workspace: RouteWorkspaceState,
  operations: readonly RouteOperationInput[],
  actorId: string,
  actorName: string,
  nowIso: string = new Date().toISOString(),
): RouteWorkspaceState {
  let state = workspace;
  let log: Parameters<typeof applyWorkspaceOperation>[1] = [];
  const owner = workspace.members.find((m) => m.role === 'owner')?.userId ?? actorId;
  operations.forEach((operation, i) => {
    const sim = applyWorkspaceOperation(
      state,
      log,
      { opId: `sim-${i}`, baseSeq: state.headSeq, actorId: owner, actorName, operation },
      nowIso,
    );
    if (sim.result.status === 'accepted') {
      state = sim.result.workspace;
      log = sim.nextOpLog;
    }
  });
  return state;
}

export function formatKm(km: number, signed = false): string {
  const sign = signed && km > 0 ? '+' : signed && km < 0 ? '−' : '';
  return `${sign}${Math.abs(km).toFixed(1).replace('.', ',')} km`;
}

export function formatDurationDelta(min: number | null): string {
  if (min == null) return 'durée inconnue';
  if (min === 0) return 'même durée';
  const sign = min > 0 ? '+' : '−';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m} min`;
  return `${sign}${h} h${m > 0 ? ` ${String(m).padStart(2, '0')}` : ''}`;
}

export function formatDuration(min: number | null): string {
  if (min == null) return 'durée inconnue';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h === 0 ? `${m} min` : `${h} h${m > 0 ? ` ${String(m).padStart(2, '0')}` : ''}`;
}

/**
 * Avant / après d'une proposition : chiffres actuels, chiffres après application, km, heures et sac.
 * Le calcul stocké à la création vaut pour le delta ; à défaut (proposition locale), on le simule.
 */
export function proposalImpactView(
  workspace: RouteWorkspaceState,
  proposal: Pick<RouteProposal, 'operations' | 'impactPreview'>,
  actor: { readonly id: string; readonly name: string },
): ProposalImpactView {
  const t = workspaceTotals(workspace);
  const before: ProposalFigures = { distanceKm: t.distanceKm, durationMin: t.durationMin, ascentM: t.ascentM };
  let impact = proposal.impactPreview;
  let afterState: RouteWorkspaceState | null = null;
  if (!impact) {
    afterState = simulateOperations(workspace, proposal.operations, actor.id, actor.name);
    impact = afterState === workspace ? null : computeRouteImpact(workspace, afterState);
  }
  const deltaKm = impact ? impact.deltaDistanceKm : null;
  const deltaDurationMin = impact ? impact.deltaDurationMin : null;
  const after: ProposalFigures | null = impact
    ? {
        distanceKm: Number((before.distanceKm + impact.deltaDistanceKm).toFixed(2)),
        durationMin:
          before.durationMin != null && impact.deltaDurationMin != null
            ? before.durationMin + impact.deltaDurationMin
            : null,
        ascentM:
          before.ascentM != null && impact.deltaAscentM != null ? before.ascentM + impact.deltaAscentM : null,
      }
    : null;
  const kitLines = impact ? impact.kitItemsToRevalidate.map((k) => `${k.itemName} : ${k.reason}`) : [];
  const kitText = !impact
    ? 'Effet sur le sac inconnu'
    : kitLines.length === 0
      ? 'Sac inchangé'
      : `${kitLines.length} objet${kitLines.length > 1 ? 's' : ''} du sac à revalider`;
  return { before, after, deltaKm, deltaDurationMin, kitLines, kitText, impact };
}

export interface VoteTally {
  readonly up: number;
  readonly down: number;
  readonly mine: 'up' | 'down' | null;
}

export function tallyVotes(proposal: Pick<RouteProposal, 'votes'>, userId: string): VoteTally {
  const values = Object.values(proposal.votes);
  return {
    up: values.filter((v) => v === 'up').length,
    down: values.filter((v) => v === 'down').length,
    mine: proposal.votes[userId] ?? null,
  };
}

export const PROPOSAL_STATUS_LABEL: Record<RouteProposal['status'], string> = {
  open: 'Ouverte',
  accepted: 'Acceptée',
  rejected: 'Refusée',
  superseded: 'Remplacée',
};

/* ---------- 8.7 Commentaires attachés au terrain ---------- */

export type CommentAnchorKind = GeometryAnchor['anchorType'];

export function stageAnchor(
  stage: { readonly id: string; readonly entityVersion: number },
  at: { readonly lat: number; readonly lon: number },
): GeometryAnchor {
  return {
    anchorType: 'stage',
    entityId: stage.id,
    entityVersion: stage.entityVersion,
    originalLat: at.lat,
    originalLon: at.lon,
    maxRelocateMeters: 250,
  };
}

/** Où le commentaire est posé, dit en mots : « Point · Col du Lautaret », « Tronçon · A → B », « Jour 2 ». */
export function commentAnchorLabel(comment: Pick<RouteComment, 'anchor'>, workspace: RouteWorkspaceState): string {
  const { anchor } = comment;
  if (anchor.anchorType === 'point') {
    const pt = workspace.points.find((p) => p.id === anchor.entityId && !p.deletedAt);
    return pt ? `Point · ${pt.name?.trim() || 'sans nom'}` : 'Point disparu';
  }
  if (anchor.anchorType === 'section') {
    const sec = workspace.sections.find((s) => s.id === anchor.entityId);
    if (!sec) return 'Tronçon disparu';
    const from = workspace.points.find((p) => p.id === sec.fromPointId)?.name?.trim();
    const to = workspace.points.find((p) => p.id === sec.toPointId)?.name?.trim();
    return from && to ? `Tronçon · ${from} → ${to}` : 'Tronçon';
  }
  if (anchor.anchorType === 'stage') {
    const st = workspace.stages.find((s) => s.id === anchor.entityId);
    return st ? `Jour ${st.dayNumber}` : 'Jour disparu';
  }
  return 'Position sur la carte';
}

/**
 * Le moteur marque les points et tronçons disparus ou déplacés ; un jour supprimé n'était pas relevé. On complète
 * ici : un commentaire dont l'ancre n'existe plus demande où le replacer, qu'il soit déjà marqué ou non.
 */
export function commentNeedsRelocation(comment: RouteComment, workspace: RouteWorkspaceState): boolean {
  if (comment.status === 'resolved') return false;
  if (comment.status === 'needs_relocation') return true;
  const { anchor } = comment;
  if (anchor.anchorType === 'stage') return !workspace.stages.some((s) => s.id === anchor.entityId);
  if (anchor.anchorType === 'point') {
    return !workspace.points.some((p) => p.id === anchor.entityId && !p.deletedAt);
  }
  if (anchor.anchorType === 'section') return !workspace.sections.some((s) => s.id === anchor.entityId);
  return false;
}

export function commentsForStage(
  comments: readonly RouteComment[],
  workspace: RouteWorkspaceState,
  stageId: string,
): RouteComment[] {
  const stage = workspace.stages.find((s) => s.id === stageId);
  if (!stage) return [];
  return comments.filter((c) => {
    const a = c.anchor;
    if (a.anchorType === 'stage') return a.entityId === stageId;
    if (a.anchorType === 'point') return a.entityId === stage.startPointId || a.entityId === stage.endPointId;
    return false;
  });
}

/* ---------- 8.9 Lien de lecture révocable ---------- */

export const DEFAULT_SHARE_LINK_HOURS = 48;

export type ShareLinkState =
  | { readonly kind: 'none' }
  | { readonly kind: 'active'; readonly expiresAt: string | null }
  | { readonly kind: 'expired'; readonly expiresAt: string }
  | { readonly kind: 'revoked' };

export function shareLinkState(link: ShareLinkConfig | null | undefined, nowMs: number = Date.now()): ShareLinkState {
  if (!link) return { kind: 'none' };
  if (link.revokedAt) return { kind: 'revoked' };
  if (link.expiresAt) {
    const exp = Date.parse(link.expiresAt);
    if (Number.isFinite(exp) && exp <= nowMs) return { kind: 'expired', expiresAt: link.expiresAt };
  }
  return { kind: 'active', expiresAt: link.expiresAt ?? null };
}

export function formatShareExpiry(iso: string | null): string {
  if (!iso) return 'sans date limite';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'date inconnue';
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/** Lien complet : seulement quand le jeton vient d'être renvoyé (jamais relisible ensuite, `token` vaut ''). */
export function shareUrlPath(workspaceId: string, token: string): string | null {
  if (!token) return null;
  return `/compas/itineraire?workspaceId=${encodeURIComponent(workspaceId)}&token=${encodeURIComponent(token)}`;
}

/* ---------- 8.1 Personnes invitables ---------- */

export interface InvitableCollaborator {
  readonly userId: string;
  readonly displayName: string;
  /** Rôle dans le voyage (`trip_collaborators`). */
  readonly tripRole: 'owner' | 'editor' | 'viewer';
}

/** Les invitables sont les collaborateurs du voyage qui ne sont pas déjà actifs sur l'itinéraire. */
export function invitableFromTrip(
  collaborators: readonly InvitableCollaborator[],
  members: readonly RouteMemberAccess[],
): InvitableCollaborator[] {
  const active = new Set(activeMembers(members).map((m) => m.userId));
  return collaborators.filter((c) => !active.has(c.userId));
}

/** Droit proposé d'office : un « éditeur » du voyage peut modifier, un « lecteur » peut voir. */
export function suggestedRightForTripRole(role: InvitableCollaborator['tripRole']): SimpleRight {
  return role === 'viewer' ? 'view' : 'edit';
}

/** Le flux d'invitation du Compas (`HUB_GROUP_PATH` : /hub/groupe) : pas un second système de membres. */
export const TRIP_INVITE_FLOW_PATH = '/hub/groupe';

/* ---------- 8.7 (suite) Choisir l'ancre ---------- */

export type CommentTarget = 'point' | 'section' | 'stage';

/**
 * L'ancre d'un commentaire sur ce qui est sélectionné : un point, un tronçon (au milieu de ses extrémités) ou un jour
 * (à son départ). `null` si la cible n'existe pas : on le dit à la personne plutôt que d'ancrer au hasard.
 */
export function anchorFor(
  workspace: RouteWorkspaceState,
  target: CommentTarget,
  ids: { readonly pointId?: string | null; readonly sectionId?: string | null; readonly stageId?: string | null },
): GeometryAnchor | null {
  const live = workspace.points.filter((p) => !p.deletedAt);
  if (target === 'point') {
    const pt = live.find((p) => p.id === ids.pointId);
    if (!pt) return null;
    return {
      anchorType: 'point',
      entityId: pt.id,
      entityVersion: pt.entityVersion,
      originalLat: pt.lat,
      originalLon: pt.lon,
      maxRelocateMeters: 250,
    };
  }
  if (target === 'section') {
    const sec = workspace.sections.find((s) => s.id === ids.sectionId);
    if (!sec) return null;
    const a = live.find((p) => p.id === sec.fromPointId);
    const b = live.find((p) => p.id === sec.toPointId);
    const first = sec.geometry.coordinates[0];
    const at = a && b ? { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 } : a ?? b ?? (first ? { lat: first[1], lon: first[0] } : null);
    if (!at) return null;
    return {
      anchorType: 'section',
      entityId: sec.id,
      entityVersion: sec.entityVersion,
      originalLat: at.lat,
      originalLon: at.lon,
      maxRelocateMeters: 250,
    };
  }
  const st = workspace.stages.find((s) => s.id === ids.stageId);
  if (!st) return null;
  const start = live.find((p) => p.id === st.startPointId);
  return start ? stageAnchor(st, start) : null;
}

export const COMMENT_TARGET_LABEL: Record<CommentTarget, string> = {
  point: 'le point',
  section: 'le tronçon',
  stage: 'le jour',
};
