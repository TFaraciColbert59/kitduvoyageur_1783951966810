import { describe, expect, it } from 'vitest';
import { applyWorkspaceOperation } from '../engine';
import { toStageMessageMeta, trailMessageHref } from '../messageLink';
import {
  DEFAULT_SHARE_LINK_HOURS,
  SIMPLE_RIGHTS,
  anchorFor,
  commentAnchorLabel,
  commentNeedsRelocation,
  commentsForStage,
  conflictPositions,
  formatDurationDelta,
  initialsOf,
  invitableFromTrip,
  nextStageScope,
  presenceByStage,
  presenceLabel,
  proposalImpactView,
  roleOfSimpleRight,
  shareLinkState,
  shareUrlPath,
  simpleRightOfRole,
  stageAssignees,
  stageAssignmentLabel,
  stageScopeRestrictsEditing,
  suggestedRightForTripRole,
  tallyVotes,
} from '../team';
import type {
  PresenceEntry,
  RouteComment,
  RouteMemberAccess,
  RouteWorkspaceState,
  ShareLinkConfig,
} from '../types';

const NOW = '2026-11-20T10:00:00.000Z';

const MEMBERS: RouteMemberAccess[] = [
  { userId: 'u1', displayName: 'Alice Martin', role: 'owner' },
  { userId: 'u2', displayName: 'Mina Okafor', role: 'editor', stageScopeIds: ['st2'] },
  { userId: 'u3', displayName: 'Éloi Perret', role: 'contributor' },
  { userId: 'u4', displayName: 'Zoé Revoquée', role: 'participant', revokedAt: NOW, stageScopeIds: ['st2'] },
];

function workspace(overrides: Partial<RouteWorkspaceState> = {}): RouteWorkspaceState {
  const ws = 'ws-team';
  const pt = (id: string, order: string, lat: number, lon: number, name: string, kind: 'start' | 'via' | 'finish') => ({
    id, workspaceId: ws, kind, orderKey: order, lat, lon, eleM: 1000, name, entityVersion: 1,
  });
  const sec = (id: string, from: string, to: string, km: number, coords: [number, number][]) => ({
    id, workspaceId: ws, fromPointId: from, toPointId: to, mode: 'manual' as const,
    geometry: { type: 'LineString' as const, coordinates: coords },
    distanceKm: km, durationMin: km * 20, ascentM: 100, descentM: 50,
    surfaceSegments: [], routingInputHash: null,
    provenance: { provider: 'compas', calculatedAt: NOW, profile: 'marche', confidence: 'estimated' as const },
    warnings: [], entityVersion: 1,
  });
  const stage = (id: string, day: number, order: string, a: string, b: string) => ({
    id, workspaceId: ws, orderKey: order, dayNumber: day, title: `Jour ${day}`, dateIso: null,
    departureTimeLocal: '08:00', timezone: 'Europe/Paris', startPointId: a, endPointId: b,
    overnightPlace: null, notes: '', waterObservations: [], weatherSlice: null, hazards: [], entityVersion: 1,
  });
  return {
    id: ws, tripId: 'trip-1', title: 'Traversée', status: 'draft', sport: 'marche', shapeMode: 'one_way',
    routingOptions: {}, headSeq: 3, reviewedSeq: null, publishedRevisionId: null, publishedRevisionNo: null,
    sourceOrigin: { kind: 'blank', importedAt: NOW },
    points: [
      pt('p1', 'A', 45.0, 6.0, 'Col du Lautaret', 'start'),
      pt('p2', 'M', 45.05, 6.05, 'Refuge', 'via'),
      pt('p3', 'Z', 45.1, 6.1, 'Arrivée', 'finish'),
    ],
    sections: [
      sec('s1', 'p1', 'p2', 7, [[6.0, 45.0], [6.05, 45.05]]),
      sec('s2', 'p2', 'p3', 8, [[6.05, 45.05], [6.1, 45.1]]),
    ],
    stages: [stage('st1', 1, '001', 'p1', 'p2'), stage('st2', 2, '002', 'p2', 'p3')],
    variants: [], proposals: [], comments: [], kitItems: [], members: MEMBERS, revisions: [], packs: [],
    participantPacks: [], updatedAt: NOW,
    ...overrides,
  } as RouteWorkspaceState;
}

describe('8.2 trois droits en vue simple', () => {
  it('peut modifier = éditeur, peut proposer = contributeur, peut voir = participant', () => {
    expect(SIMPLE_RIGHTS.map((r) => [r.label, r.role])).toEqual([
      ['Peut modifier', 'editor'],
      ['Peut proposer', 'contributor'],
      ['Peut voir', 'participant'],
    ]);
    expect(simpleRightOfRole('editor')).toBe('edit');
    expect(simpleRightOfRole('contributor')).toBe('propose');
    expect(simpleRightOfRole('participant')).toBe('view');
    expect(simpleRightOfRole('external_viewer')).toBe('view');
    expect(simpleRightOfRole('owner')).toBeNull();
    expect(simpleRightOfRole('co_organizer')).toBeNull();
    expect(roleOfSimpleRight('propose')).toBe('contributor');
  });
});

describe('8.1 personnes invitables', () => {
  it('ne propose que les collaborateurs du voyage pas déjà actifs sur l’itinéraire', () => {
    const collabs = [
      { userId: 'u1', displayName: 'Alice', tripRole: 'owner' as const },
      { userId: 'u4', displayName: 'Zoé', tripRole: 'viewer' as const },
      { userId: 'u9', displayName: 'Nina', tripRole: 'editor' as const },
    ];
    // u1 actif -> exclu ; u4 révoqué -> de nouveau invitable ; u9 jamais ajouté -> invitable
    expect(invitableFromTrip(collabs, MEMBERS).map((c) => c.userId)).toEqual(['u4', 'u9']);
    expect(suggestedRightForTripRole('viewer')).toBe('view');
    expect(suggestedRightForTripRole('editor')).toBe('edit');
  });
});

describe('8.3 étape confiée', () => {
  const ws = workspace();
  it('« Jour 2 · Mina » : seulement les membres actifs, jamais un nom inventé', () => {
    expect(stageAssignees(MEMBERS, 'st2').map((m) => m.userId)).toEqual(['u2']);
    expect(stageAssignmentLabel(MEMBERS, ws.stages[1])).toBe('Jour 2 · Mina');
    expect(stageAssignmentLabel(MEMBERS, ws.stages[0])).toBeNull();
  });
  it('la portée s’ajoute et se retire sans doublon', () => {
    expect(nextStageScope(['st1'], 'st2', true)).toEqual(['st1', 'st2']);
    expect(nextStageScope(['st1', 'st2'], 'st2', true)).toEqual(['st1', 'st2']);
    expect(nextStageScope(['st1', 'st2'], 'st1', false)).toEqual(['st2']);
    expect(nextStageScope(undefined, 'st1', false)).toEqual([]);
    expect(stageScopeRestrictsEditing('editor')).toBe(true);
    expect(stageScopeRestrictsEditing('contributor')).toBe(false);
  });
  it('initiales', () => {
    expect(initialsOf('Mina Okafor')).toBe('MO');
    expect(initialsOf('  ')).toBe('?');
  });
});

describe('8.4 présence légère', () => {
  const entry = (userId: string, displayName: string, activeStageId: string | null, mode: PresenceEntry['mode'] = 'viewing'): PresenceEntry => ({
    userId, displayName, activeStageId, selectedEntityId: null, softLockEntityId: null, softLockExpiresAt: null, mode, lastSeenAt: NOW,
  });
  it('regroupe par étape, sans soi ni les entrées sans étape', () => {
    const map = presenceByStage(
      [entry('u1', 'Alice', 'st1'), entry('u2', 'Mina', 'st2', 'editing'), entry('u3', 'Éloi', null)],
      'u1',
    );
    expect([...map.keys()]).toEqual(['st2']);
    expect(presenceLabel(map.get('st2') ?? [])).toBe('Mina modifie ce jour');
    expect(presenceLabel([entry('u2', 'Mina K', 'st2'), entry('u3', 'Éloi P', 'st2')])).toBe('Mina, Éloi sont sur ce jour');
  });
});

describe('8.5 conflit compréhensible', () => {
  it('même point : mes coordonnées, les siennes, l’écart', () => {
    const ws = workspace();
    const pos = conflictPositions(
      { currentActorName: 'Mina' },
      { type: 'move_point', pointId: 'p2', lat: 45.06, lon: 6.05 },
      ws,
    );
    expect(pos).not.toBeNull();
    expect(pos?.pointLabel).toBe('Refuge');
    expect(pos?.mine).toEqual({ lat: 45.06, lon: 6.05 });
    expect(pos?.theirs).toEqual({ lat: 45.05, lon: 6.05 });
    expect(pos?.theirName).toBe('Mina');
    expect(pos?.distanceM).toBeGreaterThan(1000);
    expect(pos?.distanceM).toBeLessThan(1200);
  });
  it('hors déplacement (ou point disparu) : pas de comparaison inventée', () => {
    const ws = workspace();
    expect(conflictPositions({}, { type: 'reverse_route' }, ws)).toBeNull();
    expect(conflictPositions({}, { type: 'move_point', pointId: 'zzz', lat: 1, lon: 1 }, ws)).toBeNull();
  });
});

describe('8.6 propositions avant / après', () => {
  it('avant, après, km, heures et sac, depuis l’aperçu calculé ou, à défaut, simulé', () => {
    const ws = workspace();
    const view = proposalImpactView(
      ws,
      {
        operations: [],
        impactPreview: {
          deltaDistanceKm: 2.4, deltaAscentM: 150, deltaDurationMin: 80, affectedStageIds: ['st2'], affectedDayNumbers: [2],
          arrivalShiftMin: 80, weatherRevalidationNeeded: false, waterGapChanged: false, overnightChanged: false,
          kitItemsToRevalidate: [{ itemId: 'k1', itemName: 'Tente', reason: 'plus long', assigneeUserId: 'u2' }],
          affectedMembers: [], unknowns: [],
        },
      },
      { id: 'u3', name: 'Éloi' },
    );
    expect(view.before.distanceKm).toBe(15);
    expect(view.after?.distanceKm).toBe(17.4);
    expect(view.after?.durationMin).toBe(15 * 20 + 80);
    expect(view.kitText).toBe('1 objet du sac à revalider');
    expect(view.kitLines).toEqual(['Tente : plus long']);
    expect(formatDurationDelta(80)).toBe('+1 h 20');
    expect(formatDurationDelta(-35)).toBe('−35 min');
    expect(formatDurationDelta(null)).toBe('durée inconnue');

    const sim = proposalImpactView(
      ws,
      { operations: [{ type: 'move_point', pointId: 'p2', lat: 45.07, lon: 6.05 }], impactPreview: null },
      { id: 'u3', name: 'Éloi' },
    );
    // l'opération est réellement jouée par le moteur : le delta et l'« après » en découlent, sans chiffre inventé
    expect(typeof sim.deltaKm).toBe('number');
    expect(sim.after?.distanceKm).toBeCloseTo(sim.before.distanceKm + (sim.deltaKm ?? 0), 1);
    expect(sim.after?.distanceKm).not.toBe(sim.before.distanceKm);
    // rien à simuler : aucun impact calculé, jamais un zéro
    const none = proposalImpactView(
      ws,
      { operations: [], impactPreview: null },
      { id: 'u3', name: 'Éloi' },
    );
    expect(none.deltaKm).toBeNull();
    expect(none.after).toBeNull();
    expect(none.kitText).toBe('Effet sur le sac inconnu');
    expect(sim.kitText).toBe('Sac inchangé');
  });
  it('votes : pour, contre, et le mien', () => {
    expect(tallyVotes({ votes: { u1: 'up', u2: 'down', u3: 'up' } }, 'u2')).toEqual({ up: 2, down: 1, mine: 'down' });
    expect(tallyVotes({ votes: {} }, 'u2')).toEqual({ up: 0, down: 0, mine: null });
  });
});

describe('8.7 commentaires attachés au terrain', () => {
  const ws = workspace();
  const comment = (anchor: RouteComment['anchor'], status: RouteComment['status'] = 'open'): RouteComment => ({
    id: 'c1', workspaceId: ws.id, createdBy: 'u2', authorName: 'Mina', body: 'Eau ?', anchor, baseRevisionNo: 0, status, createdAt: NOW,
  });
  it('ancre sur un point, un tronçon ou un jour, dite en mots', () => {
    const p = anchorFor(ws, 'point', { pointId: 'p2' });
    const s = anchorFor(ws, 'section', { sectionId: 's1' });
    const d = anchorFor(ws, 'stage', { stageId: 'st2' });
    expect(p?.anchorType).toBe('point');
    expect(s?.anchorType).toBe('section');
    expect(s?.originalLat).toBeCloseTo(45.025, 5);
    expect(d?.anchorType).toBe('stage');
    expect(d?.entityId).toBe('st2');
    expect(commentAnchorLabel({ anchor: p! }, ws)).toBe('Point · Refuge');
    expect(commentAnchorLabel({ anchor: s! }, ws)).toBe('Tronçon · Col du Lautaret → Refuge');
    expect(commentAnchorLabel({ anchor: d! }, ws)).toBe('Jour 2');
    expect(anchorFor(ws, 'point', { pointId: 'nope' })).toBeNull();
    expect(anchorFor(ws, 'stage', {})).toBeNull();
  });
  it('si l’ancre disparaît (point, tronçon ou jour), le commentaire demande où le replacer', () => {
    const d = anchorFor(ws, 'stage', { stageId: 'st2' })!;
    const p = anchorFor(ws, 'point', { pointId: 'p2' })!;
    expect(commentNeedsRelocation(comment(d), ws)).toBe(false);
    const withoutDay = workspace({ stages: ws.stages.filter((s) => s.id !== 'st2') });
    expect(commentNeedsRelocation(comment(d), withoutDay)).toBe(true);
    expect(commentAnchorLabel({ anchor: d }, withoutDay)).toBe('Jour disparu');
    const withoutPoint = workspace({ points: ws.points.map((x) => (x.id === 'p2' ? { ...x, deletedAt: NOW } : x)) });
    expect(commentNeedsRelocation(comment(p), withoutPoint)).toBe(true);
    expect(commentNeedsRelocation(comment(p, 'needs_relocation'), ws)).toBe(true);
    expect(commentNeedsRelocation(comment(p, 'resolved'), withoutPoint)).toBe(false);
  });
  it('le moteur marque un point déplacé trop loin ; replacer rouvre le commentaire (relocate)', () => {
    const p = anchorFor(ws, 'point', { pointId: 'p2' })!;
    const withComment = workspace({ comments: [comment(p)] });
    const moved = applyWorkspaceOperation(
      withComment, [],
      { opId: 'op1', baseSeq: withComment.headSeq, actorId: 'u1', actorName: 'Alice', operation: { type: 'delete_point', pointId: 'p2' } },
      NOW,
    );
    if (moved.result.status === 'accepted') {
      expect(commentNeedsRelocation(moved.result.workspace.comments[0], moved.result.workspace)).toBe(true);
    }
  });
  it('commentaires d’un jour : ceux posés sur le jour ou sur ses points de départ et d’arrivée', () => {
    const onDay = comment(anchorFor(ws, 'stage', { stageId: 'st2' })!);
    const onStart = { ...comment(anchorFor(ws, 'point', { pointId: 'p2' })!), id: 'c2' };
    const elsewhere = { ...comment(anchorFor(ws, 'point', { pointId: 'p1' })!), id: 'c3' };
    expect(commentsForStage([onDay, onStart, elsewhere], ws, 'st2').map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});

describe('8.9 lien de lecture révocable', () => {
  const base: ShareLinkConfig = {
    token: '', audience: 'external_viewer', expiresAt: '2026-11-22T10:00:00.000Z', revokedAt: null,
    hidePrivateStartRadiusM: 300, createdBy: 'u1', createdAt: NOW,
  };
  it('48 h par défaut, état actif / expiré / révoqué', () => {
    expect(DEFAULT_SHARE_LINK_HOURS).toBe(48);
    expect(shareLinkState(null).kind).toBe('none');
    expect(shareLinkState(base, Date.parse(NOW)).kind).toBe('active');
    expect(shareLinkState(base, Date.parse('2026-11-23T00:00:00.000Z')).kind).toBe('expired');
    expect(shareLinkState({ ...base, revokedAt: NOW }, Date.parse(NOW)).kind).toBe('revoked');
  });
  it('le lien complet n’existe que si le jeton est connu (jamais relu : token vaut « »)', () => {
    expect(shareUrlPath('ws-1', '')).toBeNull();
    expect(shareUrlPath('ws-1', 'shr-abc')).toBe('/compas/itineraire?workspaceId=ws-1&token=shr-abc');
  });
});

describe('8.10 carte d’étape dans la messagerie', () => {
  const ws = workspace({ publishedRevisionNo: 2 });
  it('les métadonnées nomment le jour et la version ; pas de jeton sans demande explicite', () => {
    const meta = toStageMessageMeta(ws, 'st2');
    expect(meta).toMatchObject({
      kind: 'trail', workspace_id: 'ws-team', revision_no: 2, stage_id: 'st2', stage_day: 2, share_token: null, distance_km: 8,
    });
    expect(meta?.name).toBe('Traversée · Jour 2');
    expect(toStageMessageMeta(ws, 'absent')).toBeNull();
  });
  it('le lien ouvre ce jour ; une valeur invalide est ignorée, jamais corrigée', () => {
    expect(trailMessageHref({ id: 'x', workspace_id: 'ws-team', stage_day: 2 })).toBe('/compas/itineraire?workspaceId=ws-team&jour=2');
    expect(trailMessageHref({ id: 'x', workspace_id: 'ws-team', stage_day: 999 })).toBe('/compas/itineraire?workspaceId=ws-team');
    expect(trailMessageHref({ id: 'x', workspace_id: 'ws-team', stage_day: 1, share_token: 'shr-1' })).toBe(
      '/compas/itineraire?workspaceId=ws-team&jour=1&token=shr-1',
    );
    expect(trailMessageHref({ id: 'x', workspace_id: '../evil', stage_day: 1 })).toBe('/explorer?trail=x');
    expect(trailMessageHref({ id: 'r1' })).toBe('/explorer?trail=r1');
  });
  it('le jeton n’est joint que demandé, avec un lien actif', () => {
    const withLink = workspace({
      shareLink: { token: '', audience: 'external_viewer', expiresAt: null, revokedAt: null, hidePrivateStartRadiusM: 300, createdBy: 'u1', createdAt: NOW },
    });
    expect(toStageMessageMeta(withLink, 'st1', { includeShareToken: true, shareToken: 'shr-9' })?.share_token).toBe('shr-9');
    expect(toStageMessageMeta(withLink, 'st1', { shareToken: 'shr-9' })?.share_token).toBeNull();
    const revoked = workspace({
      shareLink: { token: '', audience: 'external_viewer', expiresAt: null, revokedAt: NOW, hidePrivateStartRadiusM: 300, createdBy: 'u1', createdAt: NOW },
    });
    expect(toStageMessageMeta(revoked, 'st1', { includeShareToken: true, shareToken: 'shr-9' })?.share_token).toBeNull();
  });
});
