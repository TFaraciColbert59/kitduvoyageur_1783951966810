// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LeaderboardScreen } from '../LeaderboardScreen';
import {
  ANTI_CHEAT,
  ENTRIES,
  SEGMENT,
  makeLeaderboardResult,
  makeLocalLegendResult,
} from './fixtures';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubFetch(leaderboard = makeLeaderboardResult()) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const payload = url.includes('/local-legends')
      ? { success: true, segment: SEGMENT, localLegend: makeLocalLegendResult() }
      : { success: true, segment: SEGMENT, leaderboard, antiCheat: ANTI_CHEAT };
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('LeaderboardScreen', () => {
  it('rend le classement initial et bascule vers Local Legend', () => {
    stubFetch();
    render(
      <LeaderboardScreen
        segment={SEGMENT}
        initialLeaderboard={makeLeaderboardResult()}
        initialLocalLegend={makeLocalLegendResult()}
        initialAntiCheat={ANTI_CHEAT}
        isAuthenticated={false}
      />
    );

    expect(screen.getByRole('heading', { name: 'Montée du Belvédère' })).toBeTruthy();
    expect(screen.getByText('Camille Martin')).toBeTruthy();
    expect(screen.getByText(/2 passages écartés avant publication/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Local Legend' }));
    expect(screen.getByRole('heading', { name: 'Local Legend' })).toBeTruthy();
    expect(screen.getByText('Titulaire actuel')).toBeTruthy();
  });

  it('recharge le classement avec la période choisie', async () => {
    const fetchMock = stubFetch();
    render(
      <LeaderboardScreen
        segment={SEGMENT}
        initialLeaderboard={makeLeaderboardResult()}
        initialLocalLegend={makeLocalLegendResult()}
        initialAntiCheat={ANTI_CHEAT}
        isAuthenticated={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Période'), { target: { value: 'this_month' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.some((url) => url.includes('period=this_month'))).toBe(true);
    expect(urls.some((url) => url.includes('/local-legends'))).toBe(true);
  });

  it('pagine par offset sans curseur implicite', async () => {
    const fetchMock = stubFetch(
      makeLeaderboardResult({
        page: {
          limit: 20,
          offset: 0,
          totalEntries: 30,
          hasMore: true,
          nextCursor: 'offset:20',
        },
      })
    );

    render(
      <LeaderboardScreen
        segment={SEGMENT}
        initialLeaderboard={makeLeaderboardResult({
          page: {
            limit: 20,
            offset: 0,
            totalEntries: 30,
            hasMore: true,
            nextCursor: 'offset:20',
          },
        })}
        initialLocalLegend={makeLocalLegendResult()}
        initialAntiCheat={ANTI_CHEAT}
        isAuthenticated={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.some((url) => url.includes('offset=20'))).toBe(true);
  });

  it('affiche les titres et la position du spectateur', () => {
    stubFetch();
    render(
      <LeaderboardScreen
        segment={SEGMENT}
        initialLeaderboard={makeLeaderboardResult({
          entries: ENTRIES.slice(0, 2),
          viewerEntry: ENTRIES[2],
          page: { limit: 20, offset: 0, totalEntries: 3, hasMore: false, nextCursor: null },
        })}
        initialLocalLegend={makeLocalLegendResult()}
        initialAntiCheat={ANTI_CHEAT}
        isAuthenticated
      />
    );

    expect(screen.getByText('QOM')).toBeTruthy();
    expect(screen.getByText('KOM')).toBeTruthy();
    expect(screen.getByLabelText('Votre position au classement')).toBeTruthy();
  });
});
