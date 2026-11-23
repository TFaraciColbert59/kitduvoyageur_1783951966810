// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouteCollabWorkspace } from '../components/RouteCollabWorkspace';
import { Banners } from '../components/workspace/Banners';
import { RouteWorkspaceProvider, type RouteWorkspaceApi } from '../components/workspace/WorkspaceContext';
import { anchorFor } from '../team';
import type { RouteComment, RouteProposal, RouteWorkspaceState } from '../types';

const NOW = '2026-11-20T10:00:00.000Z';

function makeWorkspace(overrides: Partial<RouteWorkspaceState> = {}): RouteWorkspaceState {
  const ws = 'ws-team-ui';
  const pt = (id: string, order: string, lat: number, lon: number, name: string, kind: 'start' | 'via' | 'finish') => ({
    id, workspaceId: ws, kind, orderKey: order, lat, lon, eleM: 1000, name, entityVersion: 1,
  });
  const sec = (id: string, a: string, b: string, coords: [number, number][]) => ({
    id, workspaceId: ws, fromPointId: a, toPointId: b, mode: 'manual' as const,
    geometry: { type: 'LineString' as const, coordinates: coords }, distanceKm: 7.5, durationMin: 130, ascentM: 400, descentM: 100,
    surfaceSegments: [], routingInputHash: null,
    provenance: { provider: 'compas', calculatedAt: NOW, profile: 'marche', confidence: 'estimated' as const },
    warnings: [], entityVersion: 1,
  });
  const stage = (id: string, day: number, a: string, b: string) => ({
    id, workspaceId: ws, orderKey: `00${day}`, dayNumber: day, title: `Jour ${day}`, dateIso: null, departureTimeLocal: '08:00',
    timezone: 'Europe/Paris', startPointId: a, endPointId: b, overnightPlace: null, notes: '', waterObservations: [],
    weatherSlice: null, hazards: [], entityVersion: 1,
  });
  return {
    id: ws, tripId: 'trip-1', title: 'Traversée', status: 'draft', sport: 'marche', shapeMode: 'one_way', routingOptions: {},
    headSeq: 0, reviewedSeq: null, publishedRevisionId: null, publishedRevisionNo: null, sourceOrigin: { kind: 'blank', importedAt: NOW },
    points: [pt('p1', 'A', 45, 6, 'Lautaret', 'start'), pt('p2', 'M', 45.05, 6.05, 'Refuge', 'via'), pt('p3', 'Z', 45.1, 6.1, 'Arrivée', 'finish')],
    sections: [sec('s1', 'p1', 'p2', [[6, 45], [6.05, 45.05]]), sec('s2', 'p2', 'p3', [[6.05, 45.05], [6.1, 45.1]])],
    stages: [stage('st1', 1, 'p1', 'p2'), stage('st2', 2, 'p2', 'p3')],
    variants: [], proposals: [], comments: [], kitItems: [],
    members: [
      { userId: 'u1', displayName: 'Alice Martin', role: 'owner' },
      { userId: 'u2', displayName: 'Mina Okafor', role: 'editor', stageScopeIds: ['st2'] },
      { userId: 'u3', displayName: 'Éloi Perret', role: 'contributor' },
    ],
    revisions: [], packs: [], participantPacks: [], updatedAt: NOW,
    ...overrides,
  } as RouteWorkspaceState;
}

function mount(ws = makeWorkspace()) {
  return render(<RouteCollabWorkspace initialWorkspace={ws} currentUserId="u1" currentUserName="Alice Martin" forceNoWebGL={true} />);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const openTeam = () => fireEvent.click(screen.getByRole('tab', { name: 'Équipe' }));

describe('8.2 trois droits en vue simple, rôles détaillés en vue experte', () => {
  it('simple : « Peut modifier / proposer » ; expert : Éditeur / Contributeur', () => {
    mount();
    openTeam();
    const rows = screen.getByTestId('member-rows');
    expect([...rows.querySelectorAll('small')].map((n) => n.textContent)).toEqual(['Responsable', 'Peut modifier · J2', 'Peut proposer']);
    const select = within(rows).getByLabelText('Droit de Mina Okafor') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['Peut modifier', 'Peut proposer', 'Peut voir']);
    fireEvent.click(screen.getByTestId('view-mode-expert'));
    const expertSelect = within(screen.getByTestId('member-rows')).getByLabelText('Droit de Mina Okafor') as HTMLSelectElement;
    expect([...expertSelect.options].map((o) => o.textContent)).toEqual(['Coorganisateur', 'Éditeur', 'Contributeur', 'Participant']);
    expect([...screen.getByTestId('member-rows').querySelectorAll('small')].map((n) => n.textContent)).toEqual([
      'Responsable',
      'Éditeur · J2',
      'Contributeur',
    ]);
  });

  it('chaque ligne de membre reste une ligne (une recette) et les boutons de contrôle font ≥ 44 px par classe', () => {
    mount();
    openTeam();
    expect(screen.getByTestId('member-rows').querySelectorAll('.v5-li').length).toBe(3);
    expect(screen.getByLabelText('Révoquer Mina Okafor').className).toMatch(/rcw-tap/);
  });
});

describe('8.1 invitation : le flux du voyage, pas un second système', () => {
  it('« Inviter au voyage » renvoie au flux d’invitation du Compas ; plus de recherche dans toute la base', () => {
    mount();
    openTeam();
    const link = screen.getByTestId('invite-to-trip') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/hub/groupe');
    expect(screen.queryByLabelText(/Inviter un membre LKDV/)).toBeNull();
    expect(screen.getByTestId('invite-empty')).toBeTruthy();
  });
});

describe('8.3 / 8.4 étape confiée, présence', () => {
  it('« Jour 2 · Mina » : avatar sur la chip du jour 2, rien sur le jour 1', () => {
    mount();
    const days = screen.getByTestId('pill-days');
    const j2 = within(days).getByRole('tab', { name: /Jour 2/ });
    expect(j2.getAttribute('aria-label')).toMatch(/confié à Mina/);
    expect(j2.getAttribute('data-assigned')).toBe('true');
    expect(within(j2).getByTestId('day-avatar-st2').textContent).toBe('M');
    const j1 = within(days).getByRole('tab', { name: /Jour 1/ });
    expect(j1.getAttribute('data-assigned')).toBeNull();
    expect(within(j1).queryByTestId('day-avatar-st1')).toBeNull();
  });

  it('on confie un jour depuis l’onglet Équipe, et on le retire', () => {
    mount(makeWorkspace({ members: makeWorkspace().members.map((m) => ({ ...m, stageScopeIds: undefined })) }));
    openTeam();
    const assign = screen.getByTestId('stage-assignments');
    const j1 = within(assign).getByLabelText('Qui s’occupe du jour 1') as HTMLSelectElement;
    expect([...j1.options].map((o) => o.textContent)).toEqual(['Personne', 'Mina (limité à ses jours)', 'Éloi']);
    fireEvent.change(j1, { target: { value: 'u2' } });
    expect(within(screen.getByTestId('pill-days')).getByRole('tab', { name: /Jour 1/ }).getAttribute('aria-label')).toMatch(/confié à Mina/);
    expect(screen.getByTestId('status-message').textContent).toMatch(/Jour 1 confié à Mina/);
    fireEvent.change(within(screen.getByTestId('stage-assignments')).getByLabelText('Qui s’occupe du jour 1'), { target: { value: '' } });
    expect(within(screen.getByTestId('pill-days')).getByRole('tab', { name: /Jour 1/ }).getAttribute('data-assigned')).toBeNull();
  });
});

describe('8.9 lien de lecture révocable', () => {
  const link = { token: '', audience: 'external_viewer' as const, expiresAt: new Date(Date.now() + 40 * 3600_000).toISOString(), revokedAt: null, hidePrivateStartRadiusM: 300, createdBy: 'u1', createdAt: NOW };

  it('relecture : jamais de lien complet, mais « Lien actif · expire … · Révoquer »', () => {
    mount(makeWorkspace({ shareLink: link }));
    openTeam();
    fireEvent.click(screen.getByRole('button', { name: /Partage & Lien/ }));
    const drawer = screen.getByTestId('subdrawer-sharing');
    expect(within(drawer).queryByTestId('share-link-url')).toBeNull();
    expect(within(drawer).getByTestId('share-link-active').textContent).toMatch(/Lien actif · expire le .* · zone de départ privée masquée \(300 m\)/);
    expect(within(drawer).getByTestId('share-link-revoke')).toBeTruthy();
  });

  it('création : le lien complet s’affiche une fois (« il ne sera plus affiché »), puis révocation immédiate', () => {
    mount();
    openTeam();
    fireEvent.click(screen.getByRole('button', { name: /Partage & Lien/ }));
    const drawer = () => screen.getByTestId('subdrawer-sharing');
    expect(within(drawer()).queryByTestId('share-link-url')).toBeNull();
    fireEvent.click(within(drawer()).getByTestId('share-link-create'));
    expect(within(drawer()).getByTestId('share-link-create').textContent).toMatch(/48 h/);
    expect(within(drawer()).getByTestId('share-link-url').textContent).toMatch(/^\/compas\/itineraire\?workspaceId=ws-team-ui&token=/);
    expect(within(drawer()).getByTestId('share-link-once').textContent).toMatch(/ne sera plus affiché/);
    fireEvent.click(within(drawer()).getByTestId('share-link-revoke'));
    expect(within(drawer()).queryByTestId('share-link-url')).toBeNull();
    expect(within(drawer()).getByTestId('share-link-revoked').textContent).toMatch(/Lien révoqué/);
  });

  it('un lien expiré le dit et ne montre rien', () => {
    mount(makeWorkspace({ shareLink: { ...link, expiresAt: '2026-11-01T10:00:00.000Z' } }));
    openTeam();
    fireEvent.click(screen.getByRole('button', { name: /Partage & Lien/ }));
    expect(screen.getByTestId('share-link-expired').textContent).toMatch(/Lien expiré/);
    expect(screen.queryByTestId('share-link-revoke')).toBeNull();
  });
});

describe('8.6 / 8.7 propositions et commentaires dans le tiroir', () => {
  const proposal: RouteProposal = {
    id: 'prop-1', workspaceId: 'ws-team-ui', baseSeq: 0, createdBy: 'u3', authorName: 'Éloi Perret', title: 'Passer par la crête',
    rationale: 'Moins boueux', scopeEntityIds: ['p2'], operations: [{ type: 'move_point', pointId: 'p2', lat: 45.06, lon: 6.05 }],
    impactPreview: {
      deltaDistanceKm: 2.4, deltaAscentM: 150, deltaDurationMin: 80, affectedStageIds: ['st1'], affectedDayNumbers: [1],
      arrivalShiftMin: 80, weatherRevalidationNeeded: false, waterGapChanged: false, overnightChanged: false,
      kitItemsToRevalidate: [{ itemId: 'k1', itemName: 'Tente', reason: 'plus long', assigneeUserId: 'u2' }],
      affectedMembers: [], unknowns: [],
    },
    status: 'open', votes: { u2: 'up' }, createdAt: NOW,
  };
  const lost: RouteComment = {
    id: 'c-lost', workspaceId: 'ws-team-ui', createdBy: 'u2', authorName: 'Mina Okafor', body: 'Eau ?',
    anchor: { anchorType: 'stage', entityId: 'jour-supprime', entityVersion: 1, originalLat: 45, originalLon: 6, maxRelocateMeters: 250 },
    baseRevisionNo: 0, status: 'open', createdAt: NOW,
  };

  it('avant / après : raison, km, heures, sac ; vote et décision', () => {
    mount(makeWorkspace({ proposals: [proposal] }));
    openTeam();
    fireEvent.click(screen.getByRole('button', { name: 'Voir tout' }));
    const card = screen.getByTestId('proposal-prop-1');
    expect(card.textContent).toMatch(/Raison : Moins boueux/);
    expect(within(card).getByTestId('proposal-impact').textContent).toMatch(/Avant/);
    expect(within(card).getByTestId('proposal-impact').textContent).toMatch(/Après/);
    expect(within(card).getByTestId('proposal-delta').textContent).toBe('+2,4 km · +1 h 20 · 1 objet du sac à revalider');
    expect(within(card).getByTestId('votes-prop-1').textContent).toMatch(/Pour 1 · Contre 0/);
    expect(within(card).getByRole('button', { name: 'Contre' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(within(card).getByRole('button', { name: 'Contre' }));
    expect(screen.getByTestId('votes-prop-1').textContent).toMatch(/Pour 1 · Contre 1 · Votre vote : contre/);
    fireEvent.click(within(screen.getByTestId('proposal-prop-1')).getByRole('button', { name: 'Accepter' }));
    expect(screen.getByTestId('proposal-prop-1').getAttribute('data-status')).toBe('accepted');
  });

  it('un commentaire dont le jour a disparu demande où le replacer, puis se replace', () => {
    const ws = makeWorkspace({ comments: [lost] });
    mount(ws);
    openTeam();
    fireEvent.click(screen.getByRole('button', { name: 'Voir tout' }));
    const c = screen.getByTestId('comment-c-lost');
    expect(c.getAttribute('data-lost')).toBe('true');
    expect(c.textContent).toMatch(/Jour disparu/);
    expect(c.textContent).toMatch(/Où voulez-vous le replacer/);
    fireEvent.click(within(c).getByRole('button', { name: 'Sur le jour actif' }));
    const after = screen.getByTestId('comment-c-lost');
    expect(after.getAttribute('data-lost')).toBe('false');
    expect(after.textContent).toMatch(/Jour 1/);
  });

  it('on commente un point, un tronçon ou un jour', () => {
    mount();
    openTeam();
    fireEvent.click(screen.getByRole('button', { name: 'Voir tout' }));
    const drawer = screen.getByTestId('subdrawer-proposals');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Jour' }));
    fireEvent.change(within(drawer).getByPlaceholderText(/Commentaire posé sur le terrain/), { target: { value: 'Prévoir 2 L d’eau' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Ajouter un commentaire' }));
    expect(screen.getByTestId('status-message').textContent).toMatch(/Commentaire posé : Jour 1/);
    expect(within(screen.getByTestId('subdrawer-proposals')).getByText(/Prévoir 2 L d’eau/)).toBeTruthy();
    expect(anchorFor(makeWorkspace(), 'stage', { stageId: 'st1' })?.anchorType).toBe('stage');
  });
});

describe('8.5 conflit compréhensible', () => {
  function bannersWith(over: Partial<RouteWorkspaceApi>) {
    const base = {
      activeConflict: {
        conflict: {
          entityId: 'p2', entityType: 'point', entityLabel: 'Refuge', expectedVersion: 1, currentVersion: 2,
          currentActorName: 'Mina', message: 'Le point a changé.', yourSummary: 'Déplacer', currentSummary: 'Déplacé par Mina',
        },
        pendingOp: { type: 'move_point', pointId: 'p2', lat: 45.06, lon: 6.05 },
      },
      setActiveConflict: vi.fn(),
      openSubDrawer: vi.fn(),
      runOperation: vi.fn(async () => true),
      handleCreateDetourVariant: vi.fn(),
      handleProposeFromConflict: vi.fn(),
      canPropose: true,
      workspace: makeWorkspace({ points: makeWorkspace().points.map((p) => (p.id === 'p2' ? { ...p, lat: 45.04 } : p)) }),
      ...over,
    };
    render(
      <RouteWorkspaceProvider value={base as unknown as RouteWorkspaceApi}>
        <Banners />
      </RouteWorkspaceProvider>,
    );
    return base;
  }

  it('les deux positions côte à côte, trois gestes dits simplement', () => {
    const ctx = bannersWith({});
    const sides = screen.getByTestId('conflict-sides');
    expect(within(sides).getByText('La mienne')).toBeTruthy();
    expect(within(sides).getByText(/La sienne · Mina/)).toBeTruthy();
    expect(sides.textContent).toMatch(/45,06000 · 6,05000/);
    expect(sides.textContent).toMatch(/45,04000 · 6,05000/);
    expect(sides.textContent).toMatch(/2,2 km d’écart/);
    fireEvent.click(screen.getByRole('button', { name: 'Garder la mienne' }));
    expect(ctx.runOperation).toHaveBeenCalledWith({ type: 'move_point', pointId: 'p2', lat: 45.06, lon: 6.05 }, {});
    expect(ctx.setActiveConflict).toHaveBeenCalledWith(null);
  });

  it('« Garder la sienne » ferme sans rien appliquer ; « Proposer » transmet ma version ; sans droit de proposer, pas de bouton', () => {
    const ctx = bannersWith({});
    fireEvent.click(screen.getByRole('button', { name: 'Garder la sienne' }));
    expect(ctx.runOperation).not.toHaveBeenCalled();
    expect(ctx.setActiveConflict).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'Proposer' }));
    expect(ctx.handleProposeFromConflict).toHaveBeenCalledTimes(1);
    cleanup();
    bannersWith({ canPropose: false });
    expect(screen.queryByRole('button', { name: 'Proposer' })).toBeNull();
  });

  it('hors déplacement : on retombe sur les résumés, sans inventer de positions', () => {
    bannersWith({
      activeConflict: {
        conflict: { entityId: 'st1', entityType: 'stage', entityLabel: 'Jour 1', expectedVersion: 1, currentVersion: 2, message: 'Jour modifié.', yourSummary: 'Ma note', currentSummary: 'Sa note' },
        pendingOp: { type: 'update_stage_note', stageId: 'st1', notes: 'x' },
      } as RouteWorkspaceApi['activeConflict'],
    });
    expect(screen.queryByTestId('conflict-sides')).toBeNull();
    expect(screen.getByTestId('conflict-modal').textContent).toMatch(/En place : Sa note · Votre saisie : Ma note/);
  });
});
