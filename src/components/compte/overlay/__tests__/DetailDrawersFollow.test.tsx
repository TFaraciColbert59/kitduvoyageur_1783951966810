// @vitest-environment jsdom
/**
 * Preuves ciblées du tiroir Profil (DetailDrawers) :
 * - une demande `pending` est réellement affichée « Demande envoyée » ;
 * - deux clics rapides ne produisent qu'un seul appel API ;
 * - un échec restaure l'état précédent.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'viewer-1' } as { id: string } | null },
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  calls: [] as Array<{ url: string; init?: RequestInit }>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.auth.user }),
}));

/** Même lecture filtrée que le host réel : fixtures, sans simuler PostgREST. */
function tableQuery(table: string) {
  const filters: Array<[string, unknown]> = [];
  const matching = () =>
    (mocks.rows[table] ?? []).filter((row) =>
      filters.every(([column, value]) => row[column] === value)
    );
  const result = () => {
    const rows = matching();
    return { data: rows, error: null, count: rows.length };
  };
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order']) {
    query[method] = (...args: unknown[]) => {
      if (method === 'eq') filters.push([String(args[0]), args[1]]);
      return query;
    };
  }
  query.limit = () => Promise.resolve(result());
  query.maybeSingle = () => Promise.resolve({ data: matching()[0] ?? null, error: null });
  query.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result()).then(onFulfilled, onRejected);
  return query;
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: (table: string) => tableQuery(table) }),
}));

import { ProfilePreviewDrawer } from '../DetailDrawers';

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

let followAnswer: () => Promise<unknown>;

beforeEach(() => {
  mocks.auth.user = { id: 'viewer-1' };
  mocks.rows = {
    public_profiles: [
      {
        id: 'target-1',
        full_name: 'Alice Randonneuse',
        handle: 'alice',
        bio: 'Bivouacs légers',
        trust_score: 82,
      },
    ],
    user_follows: [],
    follow_requests: [],
  };
  mocks.calls = [];
  followAnswer = () => Promise.resolve(json({ status: 'following' }));
  vi.stubGlobal('fetch', (input: unknown, init?: RequestInit) => {
    const url = String(input);
    mocks.calls.push({ url, init });
    return followAnswer();
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderDrawer() {
  return render(<ProfilePreviewDrawer userId="target-1" onClose={() => {}} />);
}

describe('DetailDrawers — suivi réel', () => {
  it('affiche réellement « Demande envoyée » pour une demande pending', async () => {
    mocks.rows.follow_requests = [
      { requester_id: 'viewer-1', target_id: 'target-1', status: 'pending' },
    ];
    renderDrawer();

    expect(await screen.findByText('Demande envoyée')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Demande envoyée' })
    ).toBeTruthy();
    expect(mocks.calls).toHaveLength(0);
  });

  it('un seul appel API pour deux clics rapides', async () => {
    let release!: (value: unknown) => void;
    followAnswer = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    renderDrawer();

    const button = await screen.findByRole('button', { name: 'Suivre' });
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(mocks.calls).toHaveLength(1);
    expect(mocks.calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(mocks.calls[0].init?.body))).toEqual({ userId: 'target-1' });

    await act(async () => release(json({ status: 'following' })));
    await waitFor(() => expect(screen.getByText('Abonné')).toBeTruthy());
  });

  it('restaure l’état précédent quand l’API échoue', async () => {
    followAnswer = () => Promise.resolve(json({ error: 'follow_failed' }, 500));
    renderDrawer();

    const button = await screen.findByRole('button', { name: 'Suivre' });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Suivre' })).toBeTruthy();
    expect(screen.queryByText('Abonné')).toBeNull();
  });

  it('une réponse périmée ne réarme pas le verrou d’une requête en cours', async () => {
    const releases: Array<(value: unknown) => void> = [];
    followAnswer = () =>
      new Promise((resolve) => {
        releases.push(resolve);
      });
    mocks.rows.public_profiles = [
      { id: 'target-1', full_name: 'Alice Randonneuse', handle: 'alice' },
      { id: 'target-2', full_name: 'Bruno Traverseur', handle: 'bruno' },
    ];
    const view = renderDrawer();

    fireEvent.click(await screen.findByRole('button', { name: 'Suivre' }));
    view.rerender(<ProfilePreviewDrawer userId="target-2" onClose={() => {}} />);

    const second = await screen.findByRole('button', { name: 'Suivre' });
    fireEvent.click(second);
    expect(mocks.calls).toHaveLength(2);

    // La première requête (target-1) répond après le changement de cible.
    await act(async () => releases[0](json({ status: 'following' })));

    // Le verrou de la seconde requête doit rester posé. On retire l'attribut
    // `disabled` pour éprouver directement le garde impératif, sans dépendre
    // de la couche de présentation qui le masque.
    const busyButton = screen.getByRole('button', { name: 'Abonné' });
    busyButton.removeAttribute('disabled');
    fireEvent.click(busyButton);
    expect(mocks.calls).toHaveLength(2);

    await act(async () => releases[1](json({ status: 'following' })));
    await waitFor(() => expect(screen.getByText('Abonné')).toBeTruthy());
  });
});
