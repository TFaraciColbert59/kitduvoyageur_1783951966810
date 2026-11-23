// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouteCollabWorkspace } from '../components/RouteCollabWorkspace';
import { resetPlacesForTests } from '../components/workspace/stages/useStagePlaces';
import { baseWorkspace, pt, section, stage } from '../insights/__tests__/fixtures';
import type { RouteWorkspaceState } from '../types';

function ws(): RouteWorkspaceState {
  const a = { ...pt('a', 'a', 45.9, 6.0), name: 'Départ', kind: 'start' as const };
  const b = { ...pt('b', 'b', 45.9, 6.13), name: 'Col' };
  const c = { ...pt('c', 'c', 45.9, 6.26), name: 'Refuge' };
  const d = { ...pt('d', 'd', 45.9, 6.39), name: 'Arrivée', kind: 'finish' as const };
  return {
    ...baseWorkspace({
      id: 'w-ui',
      sport: 'marche',
      points: [a, b, c, d],
      sections: [section('s1', a, b), section('s2', b, c), section('s3', c, d)],
      stages: [stage('g1', 1, 'a', 'c', { dateIso: '2026-10-24', departureTimeLocal: '14:30' }), stage('g2', 2, 'c', 'd', { dateIso: '2026-10-25' })],
    }),
    members: [{ userId: 'u1', displayName: 'Alice', role: 'owner' }],
  };
}

const poi = (id: number, category: string, lat: number, lon: number, name: string) => ({ id, name, category, lat, lon, distanceM: 0, elevationM: null });

beforeEach(() => {
  resetPlacesForTests();
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.startsWith('/api/itineraire/lieux')) {
        return new Response(
          JSON.stringify({ status: 'ok', partial: false, fetchedAt: '2026-11-22T10:00:00Z', pois: [poi(1, 'refuge', 45.9, 6.265, 'Refuge du Col'), poi(2, 'water', 45.9, 6.1, 'Source du Pré')] }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 503 });
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mount = () => render(<RouteCollabWorkspace initialWorkspace={ws()} currentUserId="u1" currentUserName="Alice" forceNoWebGL />);

describe('Tracer : profil, forme, point supprimé recousu, versions', () => {
  it('choisir « Trail » met le profil à jour et marque les tronçons à recalculer', async () => {
    mount();
    const trail = await screen.findByTestId('profile-trail');
    expect(screen.getByTestId('profile-rando').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(trail);
    await waitFor(() => expect(screen.getByTestId('profile-trail').getAttribute('aria-pressed')).toBe('true'));
  });

  it('un point supprimé depuis son tiroir : le tracé est recousu en un seul tronçon', async () => {
    mount();
    fireEvent.click(screen.getByText(/2\. Col/));
    const del = await screen.findByTestId('delete-point');
    fireEvent.click(del);
    await waitFor(() => expect(screen.queryByText(/Col$/)).toBeNull());
    await waitFor(() => expect(screen.getByTestId('list-mode-fallback').textContent).not.toMatch(/2\. Col/));
  });

  it('sans version publiée, la frise le dit', async () => {
    mount();
    const box = await screen.findByTestId('version-timeline');
    expect(box.textContent).toMatch(/Aucune version publiée/);
  });
});

describe('Étapes : jours, arrivée vs coucher, nuits réelles, découpage', () => {
  const openEtapes = async () => {
    mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Étapes' }));
    return screen.findByTestId('tab-panel-etapes');
  };

  it('une carte par jour, avec la date locale et l’arrivée en orange après le coucher', async () => {
    const panel = await openEtapes();
    const card1 = within(panel).getByTestId('day-category-g1');
    expect(card1.textContent).toMatch(/samedi 24 octobre 2026/);
    expect(within(card1).getByTestId('arrival-g1').getAttribute('data-late')).toBe('true');
    expect(card1.textContent).toMatch(/Arrivée après le coucher/);
    const card2 = within(panel).getByTestId('day-category-g2');
    expect(card2.textContent).toMatch(/Changement d’heure : journée de 25 h/);
  });

  it('nuits : avant relevé rien n’est inventé ; après relevé, un lieu réel du barème est proposé', async () => {
    const panel = await openEtapes();
    expect(within(panel).getByTestId('day-category-g1').textContent).toMatch(/lieux pas encore relevés/);
    fireEvent.click(within(panel).getByTestId('load-places-g1'));
    await waitFor(() => expect(within(panel).getByTestId('day-category-g1').textContent).toMatch(/1 nuit réelle possible/));
  });

  it('le tiroir du jour reprend la lecture du Compas : chiffres, « Ce soir », choix d’une nuit réelle', async () => {
    const panel = await openEtapes();
    fireEvent.click(within(panel).getByLabelText('Ouvrir Jour 1'));
    const drawer = await screen.findByTestId('subdrawer-stage');
    expect(within(drawer).getByTestId('day-stats-g1').textContent).toMatch(/Distance/);
    await waitFor(() => expect(within(drawer).getByTestId('night-g1').textContent).toMatch(/Refuge du Col/));
    expect(within(drawer).getByTestId('night-g1').textContent).toMatch(/repère du barème/);
    fireEvent.click(within(drawer).getByLabelText(/Retenir pour la nuit : Refuge du Col/));
    await waitFor(() => expect(within(screen.getByTestId('subdrawer-stage')).getByTestId('night-g1').textContent).toMatch(/OpenStreetMap/));
  });

  it('6.9 : le tiroir du jour reprend l’en-tête du Compas v5 (bandeau, flèches ≥ 44 px, « A → B · Jour N »)', async () => {
    const panel = await openEtapes();
    fireEvent.click(within(panel).getByLabelText('Ouvrir Jour 1'));
    const drawer = await screen.findByTestId('subdrawer-stage');
    const hero = within(drawer).getByTestId('day-hero');
    expect(hero.className).toBe('v5-hero');
    expect((within(hero).getByLabelText('Jour précédent') as HTMLButtonElement).disabled).toBe(true);
    expect(within(hero).getByLabelText('Jour suivant').className).toMatch(/v5-rbtn v5-lg rts-icon-btn/);
    expect(within(drawer).getByTestId('day-meta').textContent).toBe('Départ → Refuge · Jour 1');
    fireEvent.click(within(hero).getByLabelText('Jour suivant'));
    await waitFor(() => expect(within(screen.getByTestId('subdrawer-stage')).getByTestId('day-meta').textContent).toBe('Refuge → Arrivée · Jour 2'));
  });

  it('proposer un découpage : explication, règle, puis application', async () => {
    const panel = await openEtapes();
    fireEvent.click(within(panel).getByTestId('propose-split'));
    const proposal = await within(panel).findByTestId('split-proposal');
    expect(proposal.textContent).toMatch(/jours? de/);
    expect(proposal.textContent).toMatch(/Naismith/);
    fireEvent.click(within(proposal).getByTestId('apply-split'));
    await waitFor(() => expect(within(panel).queryByTestId('split-proposal')).toBeNull());
  });

  it('jour de repos : ajouté puis retiré', async () => {
    const panel = await openEtapes();
    fireEvent.click(within(panel).getByTestId('add-rest-g1'));
    await waitFor(() => expect(within(panel).getAllByText(/Jour de repos/).length).toBeGreaterThan(0));
    const rest = panel.querySelector('[data-kind="rest"]') as HTMLElement;
    expect(rest).toBeTruthy();
    fireEvent.click(within(rest).getByText(/Retirer ce jour de repos/));
    await waitFor(() => expect(panel.querySelector('[data-kind="rest"]')).toBeNull());
  });
});
