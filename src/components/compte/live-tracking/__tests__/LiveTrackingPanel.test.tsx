// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LiveSessionState } from '@/features/live-tracking';
import type {
  CreatedShareLinkView,
  OwnerLiveTrackingStatus,
  ShareLinkView,
} from '@/features/compte/live-tracking/types';

import { LiveTrackingPanel } from '../LiveTrackingPanel';
import type { LiveTrackingApi } from '../liveTrackingApi';

const NOW_MS = Date.UTC(2026, 10, 13, 10, 0, 0);

const SESSION: LiveSessionState = {
  sessionId: 'sess-1',
  ownerUserId: 'user-1',
  status: 'active',
  startedAtMs: NOW_MS - 60_000,
  endedAtMs: null,
};

const LINK: ShareLinkView = {
  id: 'link-1',
  sessionId: 'sess-1',
  label: 'Vercors',
  createdAtIso: new Date(NOW_MS - 30_000).toISOString(),
  expiresAtIso: new Date(NOW_MS + 3_600_000).toISOString(),
  revokedAtIso: null,
  lastAccessedAtIso: null,
  includeTrail: true,
  status: 'active',
};

function statusOf(overrides: Partial<OwnerLiveTrackingStatus> = {}): OwnerLiveTrackingStatus {
  return {
    sessions: [SESSION],
    links: [],
    contacts: [],
    activeSessionId: 'sess-1',
    shareBaseUrl: 'https://lkdv.test/live/',
    watch: null,
    notifications: [],
    nowMs: NOW_MS,
    ...overrides,
  };
}

function createdOf(shareUrl = 'https://lkdv.test/live/jeton-brut'): CreatedShareLinkView {
  return {
    link: LINK,
    shareUrl,
    expiresAtIso: LINK.expiresAtIso,
  };
}

function mockApi(overrides: Partial<LiveTrackingApi> = {}): LiveTrackingApi {
  const api: LiveTrackingApi = {
    getStatus: vi.fn(async () => statusOf()),
    startSession: vi.fn(async () => SESSION),
    updateSession: vi.fn(async () => ({ ...SESSION, status: 'ended' as const, endedAtMs: NOW_MS })),
    endSession: vi.fn(async () => undefined),
    listLinks: vi.fn(async () => []),
    createShareLink: vi.fn(async () => createdOf()),
    revokeShareLink: vi.fn(async () => undefined),
    listContacts: vi.fn(async () => []),
    addContact: vi.fn(async () => ({}) as never),
    setContactConsent: vi.fn(async () => ({}) as never),
    removeContact: vi.fn(async () => undefined),
    fetchGuestView: vi.fn(async () => ({ ok: false, reason: 'invalid_token' as const })),
    broadcast: vi.fn(async () => ({
      notifiedContactIds: [],
      skippedUnconsentedIds: [],
      failedContactIds: [],
    })),
    watchCommand: vi.fn(async () => ({
      ok: false as const,
      error: 'watch_not_paired' as const,
      message: 'Montre absente',
    })),
  };
  return Object.assign(api, overrides);
}

afterEach(() => cleanup());

describe('LiveTrackingPanel — écran propriétaire', () => {
  it('crée un lien depuis une séance active et révèle l’URL une seule fois', async () => {
    const api = mockApi();
    render(<LiveTrackingPanel api={api} initialStatus={statusOf()} />);

    expect(screen.getByText('Partage actif')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Créer le lien de suivi' }));

    await waitFor(() => {
      expect(api.createShareLink).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        durationMinutes: 60,
        label: undefined,
        includeTrail: true,
      });
    });
    expect(await screen.findByDisplayValue('https://lkdv.test/live/jeton-brut')).toBeTruthy();
    expect(screen.getByText(/Visible une fois/)).toBeTruthy();
    expect(api.startSession).not.toHaveBeenCalled();
  });

  it('démarre une séance à la volée si aucun partage n’existe', async () => {
    const api = mockApi({
      startSession: vi.fn(async () => ({ ...SESSION, sessionId: 'sess-new' })),
      createShareLink: vi.fn(async () => createdOf('https://lkdv.test/live/nouveau-jeton')),
    });
    render(
      <LiveTrackingPanel
        api={api}
        initialStatus={statusOf({ sessions: [], activeSessionId: null })}
      />
    );

    expect(screen.getByText('Aucun partage actif')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Créer le lien de suivi' }));

    await waitFor(() => {
      expect(api.startSession).toHaveBeenCalledTimes(1);
      expect(api.createShareLink).toHaveBeenCalledWith({
        sessionId: 'sess-new',
        durationMinutes: 60,
        label: undefined,
        includeTrail: true,
      });
    });
    expect(await screen.findByDisplayValue('https://lkdv.test/live/nouveau-jeton')).toBeTruthy();
  });

  it('révoque un lien actif et termine la séance', async () => {
    const api = mockApi();
    render(<LiveTrackingPanel api={api} initialStatus={statusOf({ links: [LINK] })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Révoquer' }));
    await waitFor(() => {
      expect(api.revokeShareLink).toHaveBeenCalledWith('link-1', 'sess-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Terminer le partage' }));
    await waitFor(() => {
      expect(api.updateSession).toHaveBeenCalledWith('sess-1', 'ended');
    });
  });

  it('affiche une erreur explicite et permet de réessayer', async () => {
    const api = mockApi({
      getStatus: vi.fn(async () => {
        throw new Error('Réseau indisponible.');
      }),
    });
    render(<LiveTrackingPanel api={api} />);

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Réseau indisponible.')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(api.getStatus).toHaveBeenCalledTimes(2));
  });

  it('prévient les contacts de sécurité et compte les envois réels', async () => {
    const api = mockApi({
      broadcast: vi.fn(async () => ({
        notifiedContactIds: ['c1', 'c2'],
        skippedUnconsentedIds: [],
        failedContactIds: [],
      })),
    });
    render(<LiveTrackingPanel api={api} initialStatus={statusOf()} />);

    fireEvent.click(screen.getByRole('button', { name: /Prévenir mes contacts/ }));
    await waitFor(() => {
      expect(api.broadcast).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        event: 'safety_ping',
        shareUrl: undefined,
      });
    });
    expect(await screen.findByText('2 contacts de sécurité prévenus.')).toBeTruthy();
  });
});
