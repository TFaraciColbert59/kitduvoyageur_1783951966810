// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouteCollabWorkspace } from '../components/RouteCollabWorkspace';
import { baseWorkspace, pt, section, stage } from '../insights/__tests__/fixtures';
import type { RouteWorkspaceState } from '../types';

const TRIP = '0b9d6d2e-6c0e-4c53-9f5c-1d5f7a1a2b3c';

function ws(): RouteWorkspaceState {
  const a = { ...pt('a', 'a', 45.9, 6.0), kind: 'start' as const };
  const b = { ...pt('b', 'b', 45.9, 6.13), kind: 'finish' as const };
  return {
    ...baseWorkspace({ id: 'w-pub', tripId: TRIP, sport: 'marche', points: [a, b], sections: [section('s1', a, b)], stages: [stage('g1', 1, 'a', 'b')] }),
    members: [{ userId: 'u1', displayName: 'Alice', role: 'owner' }],
  };
}

const calls: string[] = [];
let draftStatus = 500;

beforeEach(() => {
  calls.length = 0;
  draftStatus = 500;
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      calls.push(u);
      if (u.endsWith('/publish')) {
        return new Response(JSON.stringify({ status: 'published', revision: { revisionNo: 1 }, workspace: { ...ws(), publishedRevisionNo: 1, headSeq: 0 } }), { status: 200 });
      }
      if (u === '/api/itineraire/sync-draft') return new Response('{}', { status: draftStatus });
      if (u === '/api/itineraire/budget-sync') return new Response('{}', { status: 403 });
      return new Response('{}', { status: 503 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('9.4 · suites d’une publication (tracé du Compas, budget)', () => {
  it('un échec du tracé du Compas est annoncé dans l’îlot avec « Réessayer », la publication reste valide', async () => {
    render(<RouteCollabWorkspace initialWorkspace={ws()} currentUserId="u1" currentUserName="Alice" serverSynced forceNoWebGL />);
    fireEvent.click(screen.getByRole('tab', { name: 'Départ' }));
    fireEvent.click(await screen.findByRole('button', { name: /Publier v1/i }));
    const issue = await screen.findByTestId('publish-sync-issue');
    expect(issue.textContent).toMatch(/Tracé du Compas non mis à jour · réessayer/);
    // Le budget refusé (403) n'a pas de droit à annoncer : pas de message budget.
    expect(issue.textContent).not.toMatch(/Budget/);
    expect(calls).toContain('/api/itineraire/sync-draft');
    expect(calls).toContain('/api/itineraire/budget-sync');
    draftStatus = 200;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(calls.filter((c) => c === '/api/itineraire/sync-draft')).toHaveLength(2));
  });
});
