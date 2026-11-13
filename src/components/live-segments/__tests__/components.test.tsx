// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeviceCapability } from '@/features/live-segments';
import type { LiveSegmentsApi } from '../api';
import { GhostComparison } from '../GhostComparison';
import { LiveSegmentAlertBanner } from '../LiveSegmentAlertBanner';
import { LiveSegmentDeviceSync } from '../LiveSegmentDeviceSync';
import { LiveSegmentHud } from '../LiveSegmentHud';
import { LiveSegmentResultCard } from '../LiveSegmentResultCard';
import { LiveSegmentsList } from '../LiveSegmentsList';
import { LiveSegmentsScreen } from '../LiveSegmentsScreen';
import { makeAlert, makeEffort, makeSnapshot, makeSummary } from './fixtures';

afterEach(cleanup);

const device: DeviceCapability = {
  deviceId: 'garmin-1',
  deviceName: 'Edge 1040',
  platform: 'garmin_connect',
  supportsLiveSegments: true,
  maxSyncedSegments: 10,
  supportedSports: ['cycling'],
  hasPermission: true,
  isOnline: true,
};

describe('S03-UI — bannière d’alerte', () => {
  it('annonce l’approche avec la distance et une action', () => {
    const onAction = vi.fn();
    render(
      <LiveSegmentAlertBanner
        alert={makeAlert({ type: 'approach' })}
        snapshot={makeSnapshot({ state: 'approaching', distanceToStartM: 150 })}
        onAction={onAction}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Segment à 150 m');
    fireEvent.click(screen.getByRole('button', { name: 'Voir le segment' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('passe en rôle alert pour un incident et peut être fermée', () => {
    const onDismiss = vi.fn();
    render(
      <LiveSegmentAlertBanner
        alert={makeAlert({ type: 'off_route' })}
        snapshot={makeSnapshot({ state: 'off_route' })}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Hors du tracé');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer l’alerte' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('S03-UI — comparaison fantôme', () => {
  it('affiche l’avance signée, la projection et les deux marqueurs', () => {
    const { container } = render(<GhostComparison snapshot={makeSnapshot()} />);
    expect(screen.getByText('En avance')).toBeTruthy();
    expect(screen.getAllByText('18 s').length).toBeGreaterThan(0);
    expect(screen.getByText('9 min 42 s')).toBeTruthy();
    expect(container.querySelectorAll('[data-kind="athlete"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-kind="ghost"]').length).toBeGreaterThan(0);
    expect(screen.getByText(/18 s d’avance|18 s d’avance sur/)).toBeTruthy();
  });

  it('dit explicitement qu’aucun fantôme n’est disponible', () => {
    render(
      <GhostComparison
        snapshot={makeSnapshot({ activeGhostKind: null, activeGhostLabel: null, deltaMs: null })}
      />,
    );
    expect(screen.getByText('Aucun fantôme sélectionné')).toBeTruthy();
    expect(screen.queryByText('En avance')).toBeNull();
  });
});

describe('S03-UI — HUD temps réel', () => {
  it('rend l’approche avec la distance et l’annulation', () => {
    const onStop = vi.fn();
    render(
      <LiveSegmentHud
        snapshot={makeSnapshot({
          state: 'approaching',
          distanceToStartM: 80,
          deltaMs: null,
          deltaDistanceM: null,
          projectedFinishMs: null,
        })}
        onStop={onStop}
      />,
    );
    expect(screen.getByTestId('live-segment-approach')).toBeTruthy();
    expect(screen.getByText('80 m')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler l’approche' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('rend le chrono, la progression et les commandes', () => {
    const onPause = vi.fn();
    const onStop = vi.fn();
    render(<LiveSegmentHud snapshot={makeSnapshot()} onPause={onPause} onStop={onStop} />);
    expect(screen.getByTestId('live-segment-hud')).toBeTruthy();
    expect(screen.getByLabelText('Temps écoulé 04:12')).toBeTruthy();
    const progress = screen.getByRole('progressbar', { name: 'Progression sur le segment' });
    expect(progress.getAttribute('aria-valuenow')).toBe('42');
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter' }));
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('affiche un avertissement hors tracé', () => {
    render(<LiveSegmentHud snapshot={makeSnapshot({ state: 'off_route' })} />);
    expect(screen.getByText(/Vous êtes hors du tracé/)).toBeTruthy();
  });
});

describe('S03-UI — résultat', () => {
  it('affiche un effort validé et un record personnel', () => {
    const snapshot = makeSnapshot({
      state: 'completed',
      isLiveEstimate: false,
      finalResult: makeEffort({ beatPr: true }),
    });
    render(<LiveSegmentResultCard snapshot={snapshot} onAcknowledge={() => {}} />);
    expect(screen.getByTestId('live-segment-result')).toBeTruthy();
    expect(screen.getByText('Effort validé')).toBeTruthy();
    expect(screen.getByText('Nouveau record personnel')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeTruthy();
  });

  it('affiche la raison d’invalidation sans record décoratif', () => {
    const snapshot = makeSnapshot({
      state: 'completed',
      isLiveEstimate: false,
      finalResult: makeEffort({
        isValidForLeaderboard: false,
        invalidationReason: 'gps_teleport_detected',
        beatPr: false,
      }),
    });
    render(<LiveSegmentResultCard snapshot={snapshot} />);
    expect(screen.getByText('Effort non validé')).toBeTruthy();
    expect(screen.getAllByText(/Saut GPS/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Nouveau record personnel')).toBeNull();
  });
});

describe('S03-UI — liste et écran', () => {
  it('démarre le segment choisi', () => {
    const onStart = vi.fn();
    render(<LiveSegmentsList segments={[makeSummary()]} onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer le segment Montée de test' }));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ id: 'seg-test' }));
  });

  it('annonce un catalogue vide sans inventer de segment', () => {
    render(<LiveSegmentsList segments={[]} onStart={() => {}} />);
    expect(screen.getByText('Aucun segment à proximité')).toBeTruthy();
  });

  it('rend le catalogue et signale l’absence de géolocalisation', async () => {
    render(
      <LiveSegmentsScreen
        initialSegments={[makeSummary()]}
        autoLoad={false}
        geolocation={null}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Le direct, segment par segment.' })).toBeTruthy();
    expect(screen.getByText('Montée de test')).toBeTruthy();
    expect(screen.getByText('Catalogue de démonstration')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer le segment Montée de test' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('géolocalisation n’est pas disponible'),
    );
  });
});

describe('S03-UI — synchronisation appareil', () => {
  it('prépare les références et les affiche', async () => {
    const sync = vi.fn(async () => ({
      deviceId: device.deviceId,
      references: [
        {
          segmentId: 'seg-test',
          version: 1,
          checksum: 'abc12345',
          name: 'Montée de test',
          sport: 'cycling' as const,
          direction: 'forward' as const,
          totalDistanceM: 1000,
          elevationGainM: 80,
          targetGhost: { kind: 'target' as const, label: 'Objectif 10 min', totalTimeMs: 600_000 },
        },
      ],
      skippedSegmentIds: [],
      offline: false,
      dataSource: 'demo_catalog' as const,
    }));
    const api = { sync } as unknown as LiveSegmentsApi;

    render(<LiveSegmentDeviceSync device={device} segmentIds={['seg-test']} api={api} />);
    fireEvent.click(screen.getByRole('button', { name: 'Synchroniser 1 segment(s)' }));
    await waitFor(() => expect(screen.getByText('1 référence(s) prête(s)')).toBeTruthy());
    expect(screen.getByText('Montée de test')).toBeTruthy();
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ optedIn: true }));
  });

  it('refuse un appareil incompatible sans appeler l’API', () => {
    const sync = vi.fn();
    const api = { sync } as unknown as LiveSegmentsApi;
    render(
      <LiveSegmentDeviceSync
        device={{ ...device, supportsLiveSegments: false, platform: 'web_unsupported' }}
        segmentIds={['seg-test']}
        api={api}
      />,
    );
    expect(screen.getByText('Synchronisation indisponible')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Synchroniser/ })).toBeNull();
    expect(sync).not.toHaveBeenCalled();
  });
});
