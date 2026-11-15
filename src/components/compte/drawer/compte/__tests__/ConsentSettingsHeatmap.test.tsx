// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsentSettingsSheet } from '../ConsentSettingsSheet';

vi.mock('../../../overlay/OverlaySheet', () => ({
  OverlaySheet: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}));

const BASE_CONSENTS = {
  policyVersion: 'v1',
  purposes: [],
  providers: [],
};

describe('ConsentSettingsSheet — K7.06 & S6.17 agrégats et opt-out', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('affiche les préférences heatmap/agrégats et déclenche opt-out strict + PATCH finalité', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/compte/consents') {
        return new Response(JSON.stringify(BASE_CONSENTS), { status: 200 });
      }
      if (url === '/api/heatmaps/preferences' && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            preferences: {
              globalHeatmapOptOut: false,
              globalHeatmap: true,
              routeRecommendations: true,
              mobilityAggregates: false,
              revokedAt: null,
            },
          }),
          { status: 200 },
        );
      }
      if (url === '/api/heatmaps/opt-out' && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            revokedAt: '2026-11-15T12:00:00.000Z',
            preferences: {
              globalHeatmapOptOut: true,
              globalHeatmap: false,
              routeRecommendations: false,
              mobilityAggregates: false,
              revokedAt: '2026-11-15T12:00:00.000Z',
            },
          }),
          { status: 200 },
        );
      }
      if (url === '/api/heatmaps/preferences' && init?.method === 'PATCH') {
        return new Response(
          JSON.stringify({
            preferences: {
              globalHeatmapOptOut: true,
              globalHeatmap: false,
              routeRecommendations: false,
              mobilityAggregates: true,
              revokedAt: '2026-11-15T12:00:00.000Z',
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <ConsentSettingsSheet onClose={() => {}} />
      </QueryClientProvider>,
    );

    await screen.findByText('Cartes de chaleur et agrégats');
    expect(screen.getByText('Recommandations de parcours')).toBeTruthy();
    expect(screen.getByText('Données de mobilité agrégées')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tout retirer des agrégats' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/heatmaps/opt-out',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ revokeAllAggregates: true }),
        }),
      );
    });
    await screen.findByText('Opt-out strict appliqué : contribution heatmap et agrégats retirés.');

    const mobilitySwitch = screen.getByRole('switch', {
      name: 'Activer : Données de mobilité agrégées',
    });
    fireEvent.click(mobilitySwitch);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/heatmaps/preferences',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ mobilityAggregates: true }),
        }),
      );
    });
  });
});
