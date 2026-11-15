// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { GuestTrackingReadResult } from '@/features/live-tracking';

import { GuestLiveView } from '../GuestLiveView';

const NOW_MS = Date.UTC(2026, 10, 13, 10, 0, 0);

function successResult(): GuestTrackingReadResult {
  return {
    ok: true,
    sessionId: 'sess-1',
    status: 'active',
    expiresAtIso: new Date(NOW_MS + 3_600_000).toISOString(),
    latestPosition: {
      lat: 45.188529,
      lng: 5.724524,
      accuracyM: 8,
      recordedAtIso: new Date(NOW_MS - 20_000).toISOString(),
      ageSeconds: 20,
      freshness: 'live',
      isStale: false,
    },
    trail: [
      {
        lat: 45.188,
        lng: 5.724,
        accuracyM: 8,
        recordedAtIso: new Date(NOW_MS - 80_000).toISOString(),
        ageSeconds: 80,
        freshness: 'stale',
        isStale: true,
      },
      {
        lat: 45.188529,
        lng: 5.724524,
        accuracyM: 8,
        recordedAtIso: new Date(NOW_MS - 20_000).toISOString(),
        ageSeconds: 20,
        freshness: 'live',
        isStale: false,
      },
    ],
  };
}

afterEach(() => cleanup());

describe('GuestLiveView — écran invité fail-closed', () => {
  it('affiche la position, la fraîcheur et le tracé quand le jeton est valide', () => {
    render(<GuestLiveView token="jeton" initialResult={successResult()} refreshIntervalMs={0} />);

    expect(screen.getByRole('heading', { name: 'Position partagée' })).toBeTruthy();
    expect(screen.getByText('45.18853')).toBeTruthy();
    expect(screen.getByText('5.72452')).toBeTruthy();
    expect(screen.getAllByText('En direct').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2 points')).toBeTruthy();
    expect(screen.getByText(/précision ±8 m/)).toBeTruthy();
  });

  it.each([
    ['revoked', 'Partage arrêté'],
    ['expired', 'Lien expiré'],
    ['session_ended', 'Balade terminée'],
    ['privacy_denied', 'Position non partagée'],
    ['invalid_token', 'Lien invalide'],
  ] as const)('ne montre aucune coordonnée pour la cause %s', (reason, title) => {
    render(
      <GuestLiveView token="jeton" initialResult={{ ok: false, reason }} refreshIntervalMs={0} />
    );

    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.queryByText('Latitude')).toBeNull();
    expect(screen.queryByText('Longitude')).toBeNull();
    expect(screen.queryByText(/45\.18853/)).toBeNull();
  });

  it('affiche l’attente de première position sans inventer de coordonnées', () => {
    const result: GuestTrackingReadResult = {
      ok: true,
      sessionId: 'sess-1',
      status: 'paused',
      expiresAtIso: new Date(NOW_MS + 1_800_000).toISOString(),
      latestPosition: null,
      trail: [],
    };
    render(<GuestLiveView token="jeton" initialResult={result} refreshIntervalMs={0} />);

    expect(screen.getByText('En attente de la première position')).toBeTruthy();
    expect(screen.getByText('En pause')).toBeTruthy();
    expect(screen.queryByText('Latitude')).toBeNull();
  });
});
