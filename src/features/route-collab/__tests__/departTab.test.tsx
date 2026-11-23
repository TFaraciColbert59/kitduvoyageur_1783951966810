// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouteCollabWorkspace } from '../components/RouteCollabWorkspace';
import { PlanVsActualBlock } from '../components/workspace/depart/PlanVsActual';
import { HANDOFF_KEY } from '../depart/activityHandoff';
import { baseWorkspace, kit, pt, section, stage } from '../insights/__tests__/fixtures';
import type { RouteRevisionSnapshot, RouteWorkspaceState } from '../types';

const TRIP = '0b9d6d2e-6c0e-4c53-9f5c-1d5f7a1a2b3c';
const CK = '2c9d6d2e-6c0e-4c53-9f5c-1d5f7a1a2b3d';

function ws(over: Partial<RouteWorkspaceState> = {}): RouteWorkspaceState {
  const a = { ...pt('a', 'a', 45.9, 6.0), kind: 'start' as const };
  const b = { ...pt('b', 'b', 45.9, 6.13) };
  const c = { ...pt('c', 'c', 45.9, 6.26), kind: 'finish' as const };
  return {
    ...baseWorkspace({
      id: 'w-dep',
      tripId: TRIP,
      sport: 'marche',
      points: [a, b, c],
      sections: [section('s1', a, b), section('s2', b, c)],
      stages: [stage('g1', 1, 'a', 'b'), stage('g2', 2, 'b', 'c')],
      ...over,
    }),
    members: [
      { userId: 'u1', displayName: 'Alice', role: 'owner' },
      { userId: 'u2', displayName: 'Bob', role: 'participant' },
    ],
  };
}

const calls: Array<{ url: string; method: string; body: string | null }> = [];
beforeEach(() => {
  calls.length = 0;
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL, init?: { method?: string; body?: string }) => {
      const u = String(url);
      calls.push({ url: u, method: init?.method ?? 'GET', body: init?.body ?? null });
      if (u.startsWith('/api/itineraire/depart') && (init?.method ?? 'GET') === 'GET') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            fetchedAt: '2026-11-23T08:00:00Z',
            kit: [
              { id: 'i1', item_name: 'Tente 2 places', category: 'abri', quantity: 1, weight_grams: 1800, ownership: 'shared', owner_id: null, inventory_item_id: null },
              { id: 'i2', item_name: 'Réchaud', category: 'cuisine', quantity: 1, weight_grams: 400, ownership: 'shared', owner_id: null, inventory_item_id: null },
              { id: 'i3', item_name: 'Lampe frontale', category: 'electronique', quantity: 1, weight_grams: 90, ownership: 'personal', owner_id: 'u1', inventory_item_id: null },
            ],
            checklist: [
              { id: CK, label: 'Réserver le refuge', due_offset_days: 30, done: false, done_at: null, position: 0 },
              { id: 'c2', label: 'Prévenir un proche', due_offset_days: 2, done: true, done_at: '2026-11-20T00:00:00Z', position: 1 },
            ],
          }),
          { status: 200 }
        );
      }
      if (u.startsWith('/api/itineraire/depart')) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      if (u === '/api/live-tracking/safety-contacts') return new Response(JSON.stringify({ contacts: [{ id: 'x' }, { id: 'y' }] }), { status: 200 });
      if (u.startsWith('/api/itineraire/sorties')) return new Response(JSON.stringify({ status: 'ok', sessions: [] }), { status: 200 });
      return new Response('{}', { status: 503 });
    })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mount = (w = ws()) => render(<RouteCollabWorkspace initialWorkspace={w} currentUserId="u1" currentUserName="Alice" forceNoWebGL />);
async function openDepart(w = ws()) {
  mount(w);
  fireEvent.click(screen.getByRole('tab', { name: 'Départ' }));
  return screen.findByTestId('tab-panel-depart');
}

describe('Départ · prêt à partir, liste du HUB, contact de sécurité', () => {
  it('lit la liste du HUB et les contacts ; cocher passe par la même liste (PATCH)', async () => {
    const panel = await openDepart();
    const items = await within(panel).findByTestId('checklist-items');
    expect(within(items).getByText('Réserver le refuge')).toBeTruthy();
    await waitFor(() => expect(within(panel).getByTestId('fact-checklist').textContent).toMatch(/1 sur 2 faits/));
    await waitFor(() => expect(within(panel).getByTestId('safety-contact-row').textContent).toMatch(/2 contacts/));
    fireEvent.click(within(panel).getByTestId(`check-${CK}`));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.body?.includes(CK) && c.body?.includes('"done":true'))).toBe(true));
    await waitFor(() => expect(within(panel).getByTestId('fact-checklist').textContent).toMatch(/2 sur 2 faits/));
    expect(within(panel).getByTestId('checklist-hub-link').getAttribute('href')).toBe('/hub/checklist');
  });

  it('itinéraire non rattaché à un voyage : liste du HUB non lue, aucun appel, contacts inconnus', async () => {
    const panel = await openDepart(ws({ tripId: 'trip-local' }));
    expect(within(panel).getByTestId('checklist-unlinked')).toBeTruthy();
    expect(within(panel).getByTestId('fact-checklist').textContent).toMatch(/non lue/);
    expect(calls.some((c) => c.url.startsWith('/api/itineraire/depart'))).toBe(false);
    expect(within(panel).getByTestId('readiness-unknown').textContent).toMatch(/non lus?/);
  });

  it('un seul bouton de publication, avec le résumé de la séquence relue ; taille du pack annoncée', async () => {
    const panel = await openDepart();
    expect(within(panel).getByTestId('publish-summary').textContent).toMatch(/^Première version : .* km, 2 étapes, 0 objet/);
    expect(within(panel).getByTestId('publish-panel').getAttribute('data-based-on-seq')).toBe('1');
    expect(within(panel).getAllByRole('button', { name: /Publier v1/ })).toHaveLength(1);
    expect(within(panel).getByTestId('pack-size').textContent).toMatch(/environ .* Ko/);
    expect(within(panel).getByTestId('pack-block').textContent).toMatch(/Fonds de carte non inclus/);
  });

  it('publier envoie le résumé, puis l’état des participants est visible par l’organisateur', async () => {
    const panel = await openDepart();
    fireEvent.click(within(panel).getByRole('button', { name: /Publier v1/ }));
    await waitFor(() => expect(within(panel).getByTestId('participants-rows')).toBeTruthy());
    expect(within(panel).getByTestId('participant-u2').textContent).toMatch(/Pas encore ouvert|v1 disponible/);
    expect(within(panel).getByTestId('publish-summary').textContent).toMatch(/Aucun changement relevé/);
  });

  it('démarrer l’activité écrit la passation (version + sac) et ouvre le lien du suivi en direct', async () => {
    const w = ws({ kitItems: [kit('k1', { name: 'Tente', assigneeUserId: 'u1', shared: false })] });
    const panel = await openDepart(w);
    fireEvent.click(within(panel).getByRole('button', { name: /Publier v1/ }));
    await waitFor(() => expect((within(panel).getByTestId('start-activity') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(panel).getByTestId('start-activity'));
    const h = JSON.parse(window.localStorage.getItem(HANDOFF_KEY) ?? 'null');
    expect(h).toMatchObject({ tripId: TRIP, workspaceId: 'w-dep', revisionNo: 1 });
    expect(h.kitSnapshot).toHaveLength(1);
    expect(h.kitSnapshot[0]).toMatchObject({ name: 'Tente' });
    await waitFor(() => expect(within(panel).getByTestId('cockpit-link').getAttribute('href')).toBe(`/randonnee-active?tripId=${TRIP}`));
  });
});

describe('Sac & Matériel · sac du voyage, revérification ciblée, qui porte quoi', () => {
  async function openKit() {
    const panel = await openDepart();
    fireEvent.click(within(panel).getByTestId('fact-kit'));
    return screen.findByTestId('subdrawer-kit');
  }
  it('importe le sac du voyage une seule fois et propose qui porte quoi', async () => {
    const drawer = await openKit();
    fireEvent.click(within(drawer).getByTestId('import-trip-kit'));
    await waitFor(() => expect(within(drawer).getByTestId('import-note').textContent).toMatch(/3 objets ajoutés depuis le sac du voyage/));
    expect(within(drawer).getByTestId('kit-item-trip-item-i1')).toBeTruthy();
    expect(within(drawer).getByTestId('kit-item-trip-item-i3').textContent).toMatch(/Porté par Alice/);
    // Deuxième import : rien en double.
    fireEvent.click(within(drawer).getByTestId('import-trip-kit'));
    await waitFor(() => expect(within(drawer).getByTestId('import-note').textContent).toMatch(/0 objet ajouté/));
    expect(drawer.querySelectorAll('[data-testid^="kit-item-trip-item-"]')).toHaveLength(3);
    // Qui porte quoi : niveau et allure inconnus dits, répartition des deux objets communs.
    const gear = within(drawer).getByTestId('shared-gear');
    expect(within(gear).getByTestId('shared-gear-unknown').textContent).toMatch(/Alice, Bob/);
    fireEvent.click(within(gear).getByTestId('apply-shared-gear'));
    await waitFor(() => expect(within(drawer).getByTestId('kit-item-trip-item-i1').textContent).toMatch(/Porté par/));
    expect(within(drawer).getByTestId('kit-item-trip-item-i2').textContent).toMatch(/Porté par/);
    expect(within(drawer).getByTestId('apply-shared-gear').hasAttribute('disabled')).toBe(true);
  });
});

describe('Carnet · plan contre réel', () => {
  it('superpose les tracés, dit l’écart par jour et le sac emporté ; sans version suivie, aucune comparaison', () => {
    const base = ws({ kitItems: [kit('k1', { name: 'Tente', weightGrams: 1000 })] });
    const rev: RouteRevisionSnapshot = {
      id: 'rev1', workspaceId: 'w-dep', revisionNo: 1, parentRevisionId: null, basedOnSeq: 1, createdBy: 'u1', createdByName: 'Alice', createdAt: '2026-07-01T00:00:00Z', kind: 'published', summary: 'v1',
      points: base.points, sections: base.sections, stages: base.stages, kitSnapshot: base.kitItems, acknowledgedUnknowns: [],
    };
    const workspace = { ...base, revisions: [rev] };
    const sample = (lon: number, t: string) => ({ lat: 45.9, lon, t });
    const session = {
      sessionId: 's1', startedAt: '2026-07-10T08:00:00Z', endedAt: '2026-07-10T14:00:00Z', distanceKm: 18, durationSeconds: 21600, elevationGainM: 900,
      track: [sample(6.0, '2026-07-10T08:00:00Z'), sample(6.065, '2026-07-10T09:30:00Z'), sample(6.13, '2026-07-10T11:00:00Z'), sample(6.2, '2026-07-10T12:30:00Z'), sample(6.26, '2026-07-10T14:00:00Z')],
      kitSnapshot: [{ id: 'k1', name: 'Tente', category: 'x', weightGrams: 1000, quantity: 1, shared: false, assigneeUserId: 'u1' }], routeRevisionId: 'rev1',
    };
    const replay = vi.fn();
    render(<PlanVsActualBlock workspace={workspace} sessions={[session, { ...session, sessionId: 's2', routeRevisionId: 'inconnue' }]} status="ready" reason={null} onReplay={replay} />);
    const s1 = screen.getByTestId('session-s1');
    expect(within(s1).getByTestId('overlay-svg').querySelectorAll('path')).toHaveLength(2);
    expect(within(s1).getByTestId('compare-km').textContent).toMatch(/−2 km|-2 km/);
    expect(within(s1).getByTestId('compare-day-1').textContent).toMatch(/prévu 2 h 30 · réel 3 h/);
    expect(within(s1).getByTestId('compare-kit').textContent).toMatch(/1 objet pour 1 prévu/);
    const s2 = screen.getByTestId('session-s2');
    expect(s2.textContent).toMatch(/version suivie non retrouvée/);
    expect(within(s2).queryByTestId('compare-km')).toBeNull();
    fireEvent.click(within(s1).getByTestId('replay-s1'));
    expect(replay).toHaveBeenCalledWith({ sessionId: 's1', startedAt: '2026-07-10T08:00:00Z' });
  });

  it('« Reprendre cette sortie » : brouillon à la provenance de la sortie, même voyage', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.startsWith('/api/itineraire/sorties')) return new Response(JSON.stringify({ status: 'ok', sessions: [{ sessionId: 'sess-9', startedAt: '2026-07-10T08:00:00Z', endedAt: null, distanceKm: 5, durationSeconds: 3600, elevationGainM: null, track: [], kitSnapshot: null, routeRevisionId: null }] }), { status: 200 });
      return new Response('{}', { status: 503 });
    }));
    mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Départ' }));
    fireEvent.click(await screen.findByRole('button', { name: /Activité & Carnet/ }));
    fireEvent.click(await screen.findByTestId('replay-sess-9'));
    await waitFor(() => expect(screen.getByTestId('status-message').textContent).toMatch(/provenance conservée/));
  });
});
