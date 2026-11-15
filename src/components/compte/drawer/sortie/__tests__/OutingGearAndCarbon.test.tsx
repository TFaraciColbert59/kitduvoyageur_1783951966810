// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutingGear } from '../OutingGear';
import { OutingSummary } from '../OutingSummary';
import type { OutingDetail } from '@/features/compte/server/sorties';

const BASE_OUTING: OutingDetail = {
  id: 'out-1',
  title: 'Sortie massif de Belledonne',
  date: '2026-11-10',
  startedAt: '2026-11-10T08:00:00Z',
  endedAt: '2026-11-10T10:30:00Z',
  massif: 'Belledonne',
  routeName: null,
  sport: 'rando',
  km: 12,
  dplus: 750,
  maxAlt: 1850,
  durationS: 9000,
  paceMinPerKm: null,
  movingTimeS: 8200,
  heartRateBpm: null,
  powerW: null,
  cadenceRpm: null,
  caloriesKcal: null,
  shareMetricVisibility: { distance: true, duration: true, elevation: true, elevationGain: true, maxAltitude: true, pace: true, movingTime: true, heartRate: true, power: true, cadence: true, calories: true },
  traceFullyMasked: false,
  traceError: null,
  summary: null,
  samples: null,
  visibility: 'private',
  notes: 'Belle boucle automnale.',
  coverUrl: null,
  status: 'done',
  verified: false,
  canEdit: true,
  metricsMasked: false,
  metricVisibility: { distance: true, duration: true, elevation: true, elevationGain: true, maxAltitude: true, pace: true, movingTime: true, heartRate: true, power: true, cadence: true, calories: true },
  shareMetricsConfigured: false,
  provenance: null,
  weather: null,
  participants: [],
  photos: [],
  photosUnavailable: false,
  points: [],
  gear: [],
  kit: null,
  missingGear: 0,
  comments: [],
  kudos: { count: 0, mine: false, users: [] },
  traceSegments: [],
  traceMasked: false,
  laps: [],
};

describe('D04 OutingGear S6.10 & O02 OutingSummary S6.25 Carbone évité', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            gear: { id: 'g-bike-1', name: 'Gravel Origine', category: 'Vélo', condition: 'bon' },
            mileage: {
              totalKm: 1250,
              sessionCount: 18,
              lastUsedIso: '2026-11-10T10:30:00Z',
              missingDistanceSessions: 0,
            },
            settings: { thresholdKm: 1500, thresholdVersion: 1, notifiedVersion: null, dismissedVersion: null },
            alert: {
              due: false,
              shouldNotify: false,
              level: 'none',
              thresholdKm: 1500,
              currentKm: 1250,
              remainingKm: 250,
              progressPercent: 83,
            },
            components: [],
            persistenceReady: true,
          }),
          { status: 200 },
        ),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('permet d’ouvrir le suivi kilométrique GearMileagePanel depuis Sortie > Matériel (S6.10)', async () => {
    render(
      <OutingGear
        gear={[
          {
            id: 'og-1',
            name: 'Gravel Origine',
            weightG: 9400,
            kitId: null,
            gearItemId: 'g-bike-1',
            category: 'Vélo',
          },
        ]}
        kit={null}
        missingGear={0}
        canEdit={true}
        busy={false}
        outingId="out-1"
        onAttach={() => {}}
        onRemove={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Suivi kilométrique de Gravel Origine/i }));
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /Suivi · Gravel Origine/i })).toBeTruthy(),
    );
    await waitFor(() =>
      expect(screen.getByRole('progressbar', { name: /Kilométrage de Gravel Origine/i })).toBeTruthy(),
    );
  });

  it('affiche le carbone évité uniquement sur un trajet vélotaf/utilitaire éligible (S6.25)', () => {
    const { rerender } = render(
      <OutingSummary
        detail={{
          ...BASE_OUTING,
          sport: 'velo',
          title: 'Vélotaf Grenoble-Meylan',
          km: 10,
        }}
        saving={false}
        onSave={() => {}}
        onSaveMetrics={() => {}}
        onResetMetrics={() => {}}
        onShare={() => {}}
        onExport={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByLabelText('Estimation de carbone évité')).toBeTruthy();
    expect(screen.getByText(/−1,93 kg CO2e|−1\.93 kg CO2e/)).toBeTruthy();
    expect(screen.getByText(/ADEME 0\.193 kg CO2e\/km/i)).toBeTruthy();

    // Sortie loisir sans report modal : masqué (ni 0 ni inventé)
    rerender(
      <OutingSummary
        detail={BASE_OUTING}
        saving={false}
        onSave={() => {}}
        onSaveMetrics={() => {}}
        onResetMetrics={() => {}}
        onShare={() => {}}
        onExport={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.queryByLabelText('Estimation de carbone évité')).toBeNull();
  });
});
