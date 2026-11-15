// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COMPARE_PERIODS,
  COMMUNITY_WINDOWS,
  HEATMAP_SPORTS,
  PERSONAL_PERIODS,
} from '../sheet/LayersExtensions';
import { useBikePois } from '../data/hooks';
import {
  parseCommunityHeatmapQuery,
  parsePersonalHeatmapQuery,
} from '@/lib/heatmaps/query';

function BikePoiProbe() {
  const query = useBikePois(
    { minLat: 45.4, maxLat: 45.9, minLng: 6.0, maxLng: 6.8, zoom: 9 },
    true,
  );
  return <div data-testid="bike-status">{query.data?.status ?? 'loading'}</div>;
}

describe('C02 & C01 contract parity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tous les filtres Heatmap UI (sport, fenêtre, période, comparaison) sont acceptés par parseCommunityHeatmapQuery et parsePersonalHeatmapQuery', () => {
    for (const s of HEATMAP_SPORTS) {
      for (const w of COMMUNITY_WINDOWS) {
        const comm = parseCommunityHeatmapQuery(
          new URLSearchParams({ sport: s.id, window: w.id }),
        );
        expect(comm.ok, `community sport=${s.id} window=${w.id}`).toBe(true);
      }
      for (const p of PERSONAL_PERIODS) {
        for (const cmp of COMPARE_PERIODS) {
          const qs = new URLSearchParams({ sport: s.id, period: p.id });
          if (cmp.id) qs.set('comparePeriod', cmp.id);
          const pers = parsePersonalHeatmapQuery(qs);
          expect(pers.ok, `personal sport=${s.id} period=${p.id} cmp=${String(cmp.id)}`).toBe(true);
        }
      }
    }
  });

  it('useBikePois préserve status=zoom_required sur réponse HTTP 400 VIEWPORT_TOO_LARGE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ status: 'zoom_required', code: 'VIEWPORT_TOO_LARGE', items: [] }),
          { status: 400 },
        ),
      ),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <BikePoiProbe />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('bike-status').textContent).toBe('zoom_required');
    });
  });
});
