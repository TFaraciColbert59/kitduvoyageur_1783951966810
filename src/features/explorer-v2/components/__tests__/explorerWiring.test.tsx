// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ExplorerLiveSegmentsPanel } from '../ExplorerLiveSegmentsPanel';
import { ExplorerLiveTrackingPanel, ExplorerBeaconBar } from '../ExplorerLiveTrackingPanel';
import { liveTrackingApi } from '@/components/compte/live-tracking/liveTrackingApi';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@lkdv.fr' }, loading: false }),
}));

vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic: vi.fn() }),
}));

describe('ExplorerV2 S03 & P02 wiring', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('ExplorerLiveSegmentsPanel charge le catalogue et respecte le opt-out P01', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'demo-semnoz',
              version: 1,
              name: 'Montée du Semnoz',
              sport: 'cycling',
              direction: 'forward',
              totalDistanceM: 4200,
              elevationGainM: 310,
              region: 'Annecy',
              dataSource: 'demo_catalog',
              pointCount: 2,
              points: [
                { lat: 45.858, lon: 6.105, cumulativeDistanceM: 0 },
                { lat: 45.87, lon: 6.12, cumulativeDistanceM: 4200 },
              ],
              start: { lat: 45.858, lon: 6.105, cumulativeDistanceM: 0 },
              ghostProfiles: [],
              distanceFromViewerM: 500,
            },
          ],
          dataSource: 'demo_catalog',
          catalogSize: 1,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    render(<ExplorerLiveSegmentsPanel sport="velo" center={[6.105, 45.858]} online />);

    await waitFor(() => {
      expect(screen.getByText('Montée du Semnoz')).toBeTruthy();
    });

    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);
    expect(
      screen.getByText(/Live Segments désactivé pour cette sortie/i)
    ).toBeTruthy();
  });

  it('ExplorerBeaconBar et ExplorerLiveTrackingPanel permettent de stopper et révoquer Beacon en 1 clic', async () => {
    const activeStatus = {
      sessions: [
        {
          sessionId: 'sess-beacon-1',
          ownerUserId: 'user-1',
          status: 'active' as const,
          startedAtMs: 1_700_000_000_000,
          updatedAtMs: 1_700_000_010_000,
        },
      ],
      links: [],
      contacts: [],
      activeSessionId: 'sess-beacon-1',
      shareBaseUrl: 'https://lkdv.test/suivi/',
      watch: null,
      notifications: [],
      nowMs: 1_700_000_010_000,
    };

    const getStatusSpy = vi
      .spyOn(liveTrackingApi, 'getStatus')
      .mockResolvedValue(activeStatus);
    const updateSpy = vi.spyOn(liveTrackingApi, 'updateSession').mockImplementation(async () => {
      getStatusSpy.mockResolvedValue({ ...activeStatus, activeSessionId: null, sessions: [] });
      return {
        sessionId: 'sess-beacon-1',
        ownerUserId: 'user-1',
        status: 'ended',
        startedAtMs: 1_700_000_000_000,
        updatedAtMs: 1_700_000_020_000,
      };
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    render(
      <>
        <ExplorerLiveTrackingPanel />
        <ExplorerBeaconBar center={[6.1, 45.8]} online onOpenSafety={vi.fn()} />
      </>
    );

    expect(screen.getByRole('tab', { name: 'Lien & Beacon' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Proches' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Montre' })).toBeTruthy();

    await waitFor(() => {
      expect(getStatusSpy).toHaveBeenCalled();
    });

    const stopBtn = await screen.findByRole('button', {
      name: /Arrêter et révoquer le partage Beacon/i,
    });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('sess-beacon-1', 'ended');
    });
  });
});
