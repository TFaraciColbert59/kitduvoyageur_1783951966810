// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OutingAudienceSheet } from '../OutingAudienceSheet';
import { SettingsPane } from '../../compte/SettingsPane';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  }),
}));

describe('P01 OutingAudienceSheet & SettingsPane contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('OutingAudienceSheet lit { shareLink } sur GET et poste { ttlHours: 168 } sur POST', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (url.endsWith('/trace-privacy')) {
        return new Response(JSON.stringify({ tracePrivacy: { hideStartM: 0, hideEndM: 0, hideAll: false } }), {
          status: 200,
        });
      }
      if (url.endsWith('/share-link') && method === 'GET') {
        return new Response(JSON.stringify({ shareLink: null }), { status: 200 });
      }
      if (url.endsWith('/share-link') && method === 'POST') {
        expect(init?.body).toBe(JSON.stringify({ ttlHours: 168 }));
        return new Response(
          JSON.stringify({
            token: 'tok-valid-123',
            shareLink: { active: true, expiresAt: '2026-11-22T12:00:00Z' },
          }),
          { status: 201 }
        );
      }
      if (url.endsWith('/share-link') && method === 'DELETE') {
        return new Response(JSON.stringify({ revoked: true }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });

    render(
      <OutingAudienceSheet
        open
        outingId="11111111-1111-4111-8111-111111111111"
        title="Sortie Test"
        current="followers"
        canEdit
        onClose={() => undefined}
        onApply={async () => undefined}
      />
    );

    const createBtn = await screen.findByRole('button', { name: /Créer un lien/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText(/\?shareToken=tok-valid-123/)).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/compte/sorties/11111111-1111-4111-8111-111111111111/share-link',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ttlHours: 168 }),
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /Révoquer/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Créer un lien/i })).toBeTruthy();
    });
  });

  it('SettingsPane synchronise et persiste defaultOutingVisibility côté serveur', async () => {
    const profileBase = {
      id: 'u1',
      email: 'u1@lkdv.fr',
      name: 'Alice',
      handle: 'alice',
      bio: '',
      location: '',
      avatarUrl: null,
      coverUrl: null,
      links: [],
      visibility: 'public',
      defaultOutingVisibility: 'followers',
      notificationPrefs: { social: true, loans: true, orders: true, system: true, quietHours: false },
      twoFaEnabled: false,
    };

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body ?? '{}')) as { defaultOutingVisibility?: string };
        return new Response(
          JSON.stringify({ ...profileBase, defaultOutingVisibility: body.defaultOutingVisibility ?? 'public' }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify(profileBase), { status: 200 });
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SettingsPane />
      </QueryClientProvider>
    );

    const select = (await screen.findByLabelText(
      /Visibilité par défaut des nouvelles sorties/i
    )) as HTMLSelectElement;
    await waitFor(() => {
      expect(select.value).toBe('followers');
    });

    fireEvent.change(select, { target: { value: 'public' } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/compte/compte/profile',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ defaultOutingVisibility: 'public' }),
        })
      );
    });
  });
});
