// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicHeatmapLayer } from '@/features/heatmaps/types';
import CommunityHeatmapPanel from '@/components/heatmaps/CommunityHeatmapPanel';
import PersonalHeatmapPanel from '@/components/heatmaps/PersonalHeatmapPanel';
import ContributionPreferencesPanel from '@/components/heatmaps/ContributionPreferencesPanel';
import { HeatmapClientError } from '@/components/heatmaps/apiClient';

afterEach(cleanup);

const COMMUNITY_LAYER: PublicHeatmapLayer = {
  kind: 'community',
  processorVersion: 'c02-heatmap-v1',
  sport: 'all',
  timeWindow: 'global',
  gridResolutionDeg: 0.001,
  minContributors: 5,
  computedAt: '2026-06-15T12:00:00.000Z',
  cells: [
    {
      cellId: 'g1000:100:100',
      cellCenterLat: 45.8325,
      cellCenterLng: 6.8655,
      cellBounds: [6.865, 45.832, 6.866, 45.833],
      distinctContributorCount: 7,
      passageCount: 12,
      intensity: 0.8,
      band: 'peak',
    },
  ],
  suppressedCellCount: 2,
  eligibleActivityCount: 3,
  excludedActivityCount: 4,
  maskedPointCount: 5,
  geojson: { type: 'FeatureCollection', features: [] },
};

const PREFERENCES = {
  userId: 'user-1',
  globalHeatmapOptOut: true,
  globalHeatmap: false,
  routeRecommendations: false,
  mobilityAggregates: false,
  updatedAt: '2026-06-15T12:00:00.000Z',
  revision: 1,
};

describe('CommunityHeatmapPanel', () => {
  it('affiche la couche agrégée et recharge au changement de sport', async () => {
    const user = userEvent.setup();
    const loader = vi.fn().mockResolvedValue({ layer: COMMUNITY_LAYER });

    render(<CommunityHeatmapPanel loadLayer={loader} />);

    expect(await screen.findByText('Zones les plus parcourues')).toBeTruthy();
    expect(screen.getByText('7 pers. · 12 pass.')).toBeTruthy();
    expect(loader).toHaveBeenCalledWith(
      { sport: 'all', window: 'global' },
      expect.anything()
    );

    await user.click(screen.getByRole('tab', { name: 'Randonnée' }));

    await waitFor(() =>
      expect(loader).toHaveBeenLastCalledWith(
        { sport: 'rando', window: 'global' },
        expect.anything()
      )
    );
  });

  it('n’affiche pas un état vide trompeur quand le consentement est indisponible', async () => {
    const loader = vi
      .fn()
      .mockRejectedValue(
        new HeatmapClientError(503, 'consent_unavailable', 'Consentements indisponibles.')
      );

    render(<CommunityHeatmapPanel loadLayer={loader} />);

    expect(await screen.findByText('Consentements indisponibles')).toBeTruthy();
    expect(screen.getByText(/aucune contribution n'est publiée/i)).toBeTruthy();
  });

  it('explique le seuil quand aucune cellule n’est publiable', async () => {
    const loader = vi.fn().mockResolvedValue({
      layer: { ...COMMUNITY_LAYER, cells: [], suppressedCellCount: 9 },
    });

    render(<CommunityHeatmapPanel loadLayer={loader} />);

    expect(await screen.findByText(/Aucune cellule ne franchit encore le seuil/i)).toBeTruthy();
  });
});

describe('PersonalHeatmapPanel', () => {
  it('demande la session sur un 401 sans afficher de données', async () => {
    const loader = vi.fn().mockRejectedValue(new HeatmapClientError(401, 'unauthorized', 'Session requise.'));

    render(<PersonalHeatmapPanel loadLayer={loader} />);

    expect(await screen.findByText('Votre heatmap est privée')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeTruthy();
  });
});

describe('ContributionPreferencesPanel', () => {
  it('enregistre un consentement explicite et coupe la heatmap mondiale', async () => {
    const user = userEvent.setup();
    const load = vi.fn().mockResolvedValue({ preferences: PREFERENCES });
    const save = vi.fn().mockResolvedValue({
      preferences: {
        ...PREFERENCES,
        globalHeatmapOptOut: false,
        globalHeatmap: true,
        revision: 2,
      },
    });
    const optOut = vi.fn().mockResolvedValue({
      preferences: { ...PREFERENCES, revision: 3 },
      revokedAt: '2026-06-15T12:05:00.000Z',
    });

    render(
      <ContributionPreferencesPanel
        loadPreferences={load}
        savePreferences={save}
        optOut={optOut}
      />
    );

    const heatmapSwitch = await screen.findByRole('switch', { name: /Heatmap mondiale/i });
    await user.click(heatmapSwitch);
    await user.click(screen.getByRole('button', { name: 'Enregistrer mes choix' }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          globalHeatmap: true,
          globalHeatmapOptOut: false,
          routeRecommendations: false,
          mobilityAggregates: false,
        })
      )
    );

    await user.click(screen.getByRole('button', { name: 'Couper la heatmap mondiale' }));
    await waitFor(() => expect(optOut).toHaveBeenCalledWith(false));
  });

  it('n’active rien par défaut et explique l’absence de consentement', async () => {
    const load = vi.fn().mockResolvedValue({ preferences: PREFERENCES });
    render(<ContributionPreferencesPanel loadPreferences={load} />);

    expect(await screen.findByText('Ce que vous autorisez')).toBeTruthy();
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(3);
    for (const control of switches) {
      expect(control.getAttribute('aria-checked')).toBe('false');
    }
  });
});
