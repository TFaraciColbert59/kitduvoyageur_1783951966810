// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render as renderDom, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UserProgressionProfile } from '@/features/progression/domain/types';

const auth = vi.hoisted(() => ({ user: { id: 'alice' } as { id: string } | null, loading: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/components/ui', () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock('@/components/progression/MaProgressionView', () => ({ default: () => <div>Drawer progression</div> }));
import { invalidateProgressionQueries } from '@/features/progression/client/progressionQuery';
import { ProgressionCompactCard } from '@/components/progression/ProgressionCompactCard';

function profile(userId = 'alice', hasData = false): UserProgressionProfile {
  return {
    userId, hasData, displayName: null, avatarUrl: null,
    points: { lifetime: hasData ? 90 : 0, season: hasData ? 90 : 0, seasonId: '2026-10' },
    level: { level: hasData ? 3 : 1, title: null, nextLevelPoints: null, progressPct: 0 },
    skills: {} as UserProgressionProfile['skills'], challenge: null,
    leaderboardRank: null, usableBalance: null, updatedAt: null, territory: null,
  };
}
function response(value: UserProgressionProfile) {
  return { ok: true, json: async () => ({ success: true, profile: value }) } as Response;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
let client: QueryClient;
function render(ui: React.ReactElement) {
  return renderDom(ui, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
}
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  auth.user = { id: 'alice' };
  auth.loading = false;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });

describe('ProgressionCompactCard async lifecycle (partial T10)', () => {
  it('keeps loading visible without invented zero or points, then shows genuine empty state', async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    render(<ProgressionCompactCard />);
    expect(screen.getByRole('region', { name: 'Progression' }).getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Chargement de votre progression…')).toBeTruthy();
    expect(screen.queryByText('Aucune progression enregistrée')).toBeNull();
    await act(async () => pending.resolve(response(profile())));
    await screen.findByText('Aucune progression enregistrée');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['http', 'network', 'payload'] as const)('distinguishes %s failure from empty and supports an actual retry', async (failure) => {
    if (failure === 'network') fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    else fetchMock.mockResolvedValueOnce({ ok: failure !== 'http', status: 503, json: async () => ({ success: false }) } as Response);
    fetchMock.mockResolvedValueOnce(response({ ...profile('alice', true), leaderboardRank: 2 }));
    render(<ProgressionCompactCard />);
    await screen.findByRole('alert');
    expect(screen.queryByText('Aucune progression enregistrée')).toBeNull();
    const retry = screen.getByRole('button', { name: 'Réessayer' });
    expect(retry.style.minHeight).toBe('44px');
    fireEvent.click(retry);
    await screen.findByText('Niveau 3');
    expect(screen.getByText('90 pts saison')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a server payload owned by another account', async () => {
    fetchMock.mockResolvedValueOnce(response(profile('bob', true)));
    render(<ProgressionCompactCard />);
    await screen.findByRole('alert');
    expect(screen.queryByText('Niveau 3')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts the former account request and ignores its late result', async () => {
    const old = deferred<Response>();
    fetchMock.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(profile('bob')));
    const view = render(<ProgressionCompactCard />);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    auth.user = { id: 'bob' };
    view.rerender(<ProgressionCompactCard />);
    await screen.findByText('Aucune progression enregistrée');
    expect(signal?.aborted).toBe(true);
    await act(async () => old.resolve(response(profile('alice', true))));
    expect(screen.queryByText('Niveau 3')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('removes the previous profile immediately on logout and never fetches as guest', async () => {
    fetchMock.mockResolvedValueOnce(response({ ...profile('alice', true), leaderboardRank: 4 }));
    const view = render(<ProgressionCompactCard />);
    await screen.findByText('Niveau 3');
    auth.user = null;
    view.rerender(<ProgressionCompactCard />);
    expect(screen.queryByText('Niveau 3')).toBeNull();
    expect(screen.getByText('Connectez-vous pour retrouver votre progression.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows the canonical profile while secondary leaderboard is pending or fails', async () => {
    const rank = deferred<Response>();
    fetchMock.mockResolvedValueOnce(response(profile('alice', true))).mockReturnValueOnce(rank.promise);
    render(<ProgressionCompactCard />);
    await screen.findByText('Niveau 3');
    expect(screen.queryByText(/Rang #/)).toBeNull();
    await act(async () => rank.resolve({ ok: false, status: 503 } as Response));
    expect(screen.getByText('Niveau 3')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ignores an old leaderboard completion after account switch', async () => {
    const rank = deferred<Response>();
    fetchMock.mockResolvedValueOnce(response(profile('alice', true))).mockReturnValueOnce(rank.promise).mockResolvedValueOnce(response(profile('bob')));
    const view = render(<ProgressionCompactCard />);
    await screen.findByText('Niveau 3');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    auth.user = { id: 'bob' };
    view.rerender(<ProgressionCompactCard />);
    await screen.findByText('Aucune progression enregistrée');
    await act(async () => rank.resolve({ ok: true, json: async () => ({ success: true, leaderboard: { rank: 7 } }) } as Response));
    expect(screen.queryByText('Rang #7')).toBeNull();
    expect(screen.queryByText('Niveau 3')).toBeNull();
  });

  it('waits for the session before loading private data', async () => {
    auth.loading = true;
    fetchMock.mockResolvedValueOnce(response(profile()));
    const view = render(<ProgressionCompactCard />);
    expect(screen.getByText('Chargement de votre progression…')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    auth.loading = false;
    view.rerender(<ProgressionCompactCard />);
    await screen.findByText('Aucune progression enregistrée');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares the profile query between mounted cards and refreshes after confirmed attribution invalidation', async () => {
    fetchMock.mockResolvedValueOnce(response(profile()))
      .mockResolvedValueOnce(response({ ...profile('alice', true), leaderboardRank: 3 }));
    render(<><ProgressionCompactCard /><ProgressionCompactCard /></>);
    await waitFor(() => expect(screen.getAllByText('Aucune progression enregistrée')).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => invalidateProgressionQueries(client, 'alice'));
    await waitFor(() => expect(screen.getAllByText('90 pts saison')).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the existing drawer presentation without duplicate hidden requests', () => {
    render(<ProgressionCompactCard variant="drawer" />);
    expect(screen.getByText('Drawer progression')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
